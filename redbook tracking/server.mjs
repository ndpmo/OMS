import http from "node:http";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
const ACTOR_URL =
  "https://api.apify.com/v2/acts/sian.agency~xiaohongshu-rednote-scraper/run-sync-get-dataset-items";
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "tracks.json");
const CSV_PATH = path.join(DATA_DIR, "redbook-hourly-results.csv");
const SHEET_NAME = "Hourly Results";
const HEADERS = [
  "fetched_at",
  "note_id",
  "title",
  "kol_name",
  "user_id",
  "red_id",
  "post_type",
  "likes",
  "comments",
  "saves",
  "shares",
  "views",
  "hourly_likes",
  "hourly_comments",
  "hourly_saves",
  "hourly_shares",
  "daily_likes",
  "daily_comments",
  "daily_saves",
  "daily_shares",
  "post_url"
];

const tracks = new Map();
let saveQueue = Promise.resolve();
let googleAccessToken = null;
let googleHeaderReady = false;

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function extractNoteId(input) {
  const trimmed = String(input || "").trim();
  const match = trimmed.match(/(?:explore|discovery\/item)\/([a-f0-9]{24})/i);
  if (match) return match[1];
  if (/^[a-f0-9]{24}$/i.test(trimmed)) return trimmed;
  return null;
}

function formatPost(item) {
  return {
    fetchedAt: item._fetchedAt || new Date().toISOString(),
    status: item.status || "success",
    noteId: item.noteId || item.id,
    title: item.noteTitle || item.title || "",
    author: item.userName || item.user?.nickname || item.user?.name || "",
    userId: item.userId || item.user?.id || "",
    redId: item.userRedId || item.user?.red_id || "",
    type: item.noteType || item.type || "",
    likes: item.likedCount ?? item.liked_count ?? null,
    comments: item.commentsCount ?? item.comments_count ?? null,
    collects: item.collectedCount ?? item.collected_count ?? null,
    shares: item.sharedCount ?? item.shared_count ?? null,
    views: item.viewCount ?? item.view_count ?? null,
    description: item.noteDesc || item.desc || "",
    pageUrl: item.notePageUrl || `https://www.xiaohongshu.com/explore/${item.noteId || item.id}`
  };
}

function makeRow(sample) {
  return [
    sample.fetchedAt,
    sample.noteId,
    sample.title,
    sample.author,
    sample.userId,
    sample.redId,
    sample.type,
    sample.likes,
    sample.comments,
    sample.collects,
    sample.shares,
    sample.views,
    sample.hourlyDelta?.likes,
    sample.hourlyDelta?.comments,
    sample.hourlyDelta?.collects,
    sample.hourlyDelta?.shares,
    sample.dailyDelta?.likes,
    sample.dailyDelta?.comments,
    sample.dailyDelta?.collects,
    sample.dailyDelta?.shares,
    sample.pageUrl
  ];
}

async function fetchMetrics(track) {
  if (!APIFY_TOKEN) {
    throw new Error("Missing APIFY_TOKEN environment variable.");
  }

  track.state = "checking";
  track.error = "";
  track.lastStartedAt = new Date().toISOString();

  const response = await fetch(`${ACTOR_URL}?token=${encodeURIComponent(APIFY_TOKEN)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operation: "noteDetail",
      noteId: track.noteId
    })
  });

  if (!response.ok) {
    throw new Error(`Apify returned HTTP ${response.status}`);
  }

  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Apify returned no rows for this note.");
  }

  const next = formatPost(items[0]);
  const previous = track.samples.at(-1);
  const dayBaseline = findDailyBaseline(track.samples, next.fetchedAt);
  next.hourlyDelta = metricDelta(next, previous);
  next.dailyDelta = metricDelta(next, dayBaseline);
  next.delta = next.hourlyDelta;

  track.samples.push(next);
  track.latest = next;
  track.state = "active";
  track.lastCheckedAt = next.fetchedAt;
  track.nextCheckAt = new Date(Date.now() + ONE_HOUR).toISOString();

  await persistSample(next);
  await saveTracks();
}

function diff(current, previous) {
  if (typeof current !== "number" || typeof previous !== "number") return null;
  return current - previous;
}

function metricDelta(current, previous) {
  return previous
    ? {
        likes: diff(current.likes, previous.likes),
        comments: diff(current.comments, previous.comments),
        collects: diff(current.collects, previous.collects),
        shares: diff(current.shares, previous.shares)
      }
    : { likes: null, comments: null, collects: null, shares: null };
}

function findDailyBaseline(samples, fetchedAt) {
  const target = new Date(fetchedAt).getTime() - ONE_DAY;
  return [...samples]
    .reverse()
    .find((sample) => new Date(sample.fetchedAt).getTime() <= target);
}

async function refreshTrack(track) {
  try {
    await fetchMetrics(track);
  } catch (error) {
    track.state = "error";
    track.error = error.message;
    track.nextCheckAt = new Date(Date.now() + ONE_HOUR).toISOString();
    await saveTracks();
  }
}

async function loadTracks() {
  try {
    const saved = JSON.parse(await readFile(STORE_PATH, "utf8"));
    for (const track of saved.tracks || []) {
      tracks.set(track.noteId, track);
    }
  } catch {
    await mkdir(DATA_DIR, { recursive: true });
    await ensureCsvHeader();
  }
}

async function saveTracks() {
  saveQueue = saveQueue.then(async () => {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(STORE_PATH, JSON.stringify({ tracks: [...tracks.values()] }, null, 2));
  });
  return saveQueue;
}

async function persistSample(sample) {
  await ensureCsvHeader();
  await appendFile(CSV_PATH, `${toCsvLine(makeRow(sample))}\n`);
  await appendGoogleSheetRow(sample);
}

async function ensureCsvHeader() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(CSV_PATH, "utf8");
  } catch {
    await writeFile(CSV_PATH, `${toCsvLine(HEADERS)}\n`);
  }
}

function toCsvLine(values) {
  return values
    .map((value) => {
      const text = value === null || value === undefined ? "" : String(value);
      return `"${text.replaceAll('"', '""')}"`;
    })
    .join(",");
}

async function appendGoogleSheetRow(sample) {
  if (!GOOGLE_SHEET_ID || !GOOGLE_SERVICE_ACCOUNT_JSON) return;

  const accessToken = await getGoogleAccessToken();
  await ensureGoogleSheetHeader(accessToken);
  const range = encodeURIComponent(`${SHEET_NAME}!A:U`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken.token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ values: [makeRow(sample)] })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets sync failed: ${response.status} ${text}`);
  }
}

async function ensureGoogleSheetHeader(accessToken) {
  if (googleHeaderReady) return;

  const range = encodeURIComponent(`${SHEET_NAME}!A1:U1`);
  const readResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}`,
    { headers: { authorization: `Bearer ${accessToken.token}` } }
  );

  if (readResponse.status === 400) {
    throw new Error(`Google Sheet tab "${SHEET_NAME}" is missing.`);
  }

  if (!readResponse.ok) {
    const text = await readResponse.text();
    throw new Error(`Google Sheets header check failed: ${readResponse.status} ${text}`);
  }

  const data = await readResponse.json();
  if (!data.values?.length) {
    const writeResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${accessToken.token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ values: [HEADERS] })
      }
    );

    if (!writeResponse.ok) {
      const text = await writeResponse.text();
      throw new Error(`Google Sheets header write failed: ${writeResponse.status} ${text}`);
    }
  }

  googleHeaderReady = true;
}

async function getGoogleAccessToken() {
  if (googleAccessToken && googleAccessToken.expiresAt > Date.now() + 60_000) {
    return googleAccessToken;
  }

  const account = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const encodedHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedClaim = base64Url(JSON.stringify(claim));
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${encodedHeader}.${encodedClaim}`)
    .sign(account.private_key, "base64url");
  const assertion = `${encodedHeader}.${encodedClaim}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google auth failed: ${response.status} ${text}`);
  }

  const token = await response.json();
  googleAccessToken = {
    token: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000
  };
  return googleAccessToken;
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

setInterval(() => {
  for (const track of tracks.values()) {
    if (Date.now() >= new Date(track.nextCheckAt || 0).getTime()) {
      refreshTrack(track);
    }
  }
}, 60 * 1000);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function generateContentWithGemini({
  topic,
  wordCount,
  hashtags,
  direction,
  count
}) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing on the server.");
  }

  const prompt = [
    `Generate ${count} unique Xiaohongshu (Little Redbook) content versions.`,
    `Topic: ${topic}`,
    `Target word count per version: about ${wordCount} words`,
    `Hashtags to include or adapt: ${hashtags}`,
    `Direction: ${direction}`,
    "Return ONLY valid JSON as an array.",
    "Each item must contain: title, content, hashtags.",
    "hashtags can be a string with space-separated tags."
  ].join("\n");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 260)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned empty content.");

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini response was not valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini JSON must be an array.");
  }

  return parsed.map((item, i) => ({
    title: item?.title || `${topic} - Version ${i + 1}`,
    content: item?.content || "",
    hashtags: item?.hashtags || hashtags
  }));
}

async function serveStatic(res, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.join(__dirname, "public", file);
  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8"
  };

  try {
    const content = await readFile(filePath);
    res.writeHead(200, { "content-type": types[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/tracks") {
    json(res, 200, {
      tracks: [...tracks.values()],
      storage: {
        localCsv: "/api/export.csv",
        googleSheets: Boolean(GOOGLE_SHEET_ID && GOOGLE_SERVICE_ACCOUNT_JSON)
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/export.csv") {
    await ensureCsvHeader();
    const content = await readFile(CSV_PATH);
    res.writeHead(200, {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="redbook-hourly-results.csv"'
    });
    res.end(content);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/track") {
    try {
      const body = await readBody(req);
      const noteId = extractNoteId(body.url);
      if (!noteId) {
        json(res, 400, { error: "Please submit a valid Xiaohongshu note URL or note ID." });
        return;
      }

      const existing = tracks.get(noteId);
      if (existing) {
        json(res, 200, { track: existing });
        return;
      }

      const track = {
        noteId,
        submittedUrl: body.url,
        createdAt: new Date().toISOString(),
        state: "queued",
        error: "",
        latest: null,
        samples: [],
        nextCheckAt: new Date().toISOString()
      };
      tracks.set(noteId, track);
      await saveTracks();
      refreshTrack(track);
      json(res, 202, { track });
    } catch (error) {
      json(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/refresh") {
    const body = await readBody(req);
    const track = tracks.get(body.noteId);
    if (!track) {
      json(res, 404, { error: "Track not found." });
      return;
    }
    refreshTrack(track);
    json(res, 202, { track });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/generate-content") {
    try {
      const body = await readBody(req);
      const topic = String(body.topic || "").trim();
      const wordCount = String(body.wordCount || "").trim();
      const hashtags = String(body.hashtags || "").trim();
      const direction = String(body.direction || "").trim();
      const count = Number(body.count || 0);

      if (!topic || !wordCount || !hashtags || !direction || !count) {
        json(res, 400, { error: "Missing required fields." });
        return;
      }
      if (count < 1 || count > 40) {
        json(res, 400, { error: "count must be between 1 and 40 per request." });
        return;
      }

      const items = await generateContentWithGemini({
        topic,
        wordCount,
        hashtags,
        direction,
        count
      });
      json(res, 200, { items });
    } catch (error) {
      json(res, 500, { error: error.message });
    }
    return;
  }

  if (req.method === "GET") {
    await serveStatic(res, url.pathname);
    return;
  }

  json(res, 405, { error: "Method not allowed" });
});

await loadTracks();

server.listen(PORT, () => {
  console.log(`Redbook tracker running at http://localhost:${PORT}`);
});
