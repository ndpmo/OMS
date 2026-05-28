const SPREADSHEET_ID = '1W6r0sQaQ96t1x2pF6ZodgVFqt6-odVWu-l1RWJXr7sw';
const SHEET_NAME = 'Hourly Results';
const TRACKS_SHEET_NAME = 'Tracked Posts';
const APIFY_ACTOR_URL = 'https://api.apify.com/v2/acts/dltik~rednote-xiaohongshu-scraper/run-sync-get-dataset-items';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const HEADERS = [
  'fetched_at',
  'note_id',
  'title',
  'kol_name',
  'user_id',
  'red_id',
  'post_type',
  'likes',
  'comments',
  'saves',
  'shares',
  'views',
  'hourly_likes',
  'hourly_comments',
  'hourly_saves',
  'hourly_shares',
  'daily_likes',
  'daily_comments',
  'daily_saves',
  'daily_shares',
  'post_url'
];

const TRACK_HEADERS = ['note_id', 'submitted_url', 'created_at', 'last_checked_at', 'next_check_at', 'status', 'error'];

function doGet(event) {
  if (event && event.parameter && event.parameter.action) {
    return handleApiGet_(event.parameter);
  }

  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Redbook Hourly Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, SHEET_NAME, HEADERS);
  ensureSheet_(ss, TRACKS_SHEET_NAME, TRACK_HEADERS);
  return getDashboardData();
}

function saveApifyToken(token) {
  if (!token || !String(token).trim()) {
    throw new Error('Apify token is required.');
  }
  PropertiesService.getScriptProperties().setProperty('APIFY_TOKEN', String(token).trim());
  return { ok: true };
}

function addTrack(urlOrId) {
  setup();
  const noteId = extractNoteId_(urlOrId);
  if (!noteId) {
    throw new Error('Please submit a valid Xiaohongshu URL or 24-character note ID.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TRACKS_SHEET_NAME);
  const rows = getObjects_(sheet);
  const existingIndex = rows.findIndex((row) => row.note_id === noteId);
  const now = new Date();

  if (existingIndex === -1) {
    sheet.appendRow([
      noteId,
      String(urlOrId).trim(),
      now,
      '',
      now,
      'queued',
      ''
    ]);
  }

  return getDashboardData();
}

function refreshOne(noteId, options) {
  options = options || {};
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, SHEET_NAME, HEADERS);
  ensureSheet_(ss, TRACKS_SHEET_NAME, TRACK_HEADERS);
  const tracksSheet = ss.getSheetByName(TRACKS_SHEET_NAME);
  const tracks = getObjects_(tracksSheet);
  const trackIndex = tracks.findIndex((row) => row.note_id === noteId);
  if (trackIndex === -1) {
    throw new Error('Tracked post not found.');
  }

  const track = tracks[trackIndex];
  const cooldown = getCooldown_(track.last_checked_at);
  if (!options.force && cooldown.blocked) {
    updateTrackStatus_(tracksSheet, trackIndex, 'cooldown', `請於 ${cooldown.nextAllowedText} 後再刷新。`);
    return { skipped: true, reason: 'cooldown', nextAllowedAt: cooldown.nextAllowedAt };
  }

  try {
    updateTrackStatus_(tracksSheet, trackIndex, 'checking', '');
    const sample = fetchMetrics_(noteId);
    const resultsSheet = ss.getSheetByName(SHEET_NAME);
    const previous = getLatestSample_(resultsSheet, noteId);
    const dailyBaseline = getDailyBaseline_(resultsSheet, noteId, new Date(sample.fetchedAt));
    const hourlyDelta = metricDelta_(sample, previous);
    const dailyDelta = metricDelta_(sample, dailyBaseline);

    resultsSheet.appendRow(makeRow_(sample, hourlyDelta, dailyDelta));
    updateTrackStatus_(tracksSheet, trackIndex, 'active', '', sample.fetchedAt);
  } catch (error) {
    updateTrackStatus_(tracksSheet, trackIndex, 'error', error.message);
    throw error;
  }
}

function refreshAllTrackedPosts() {
  setup();
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tracks = getObjects_(ss.getSheetByName(TRACKS_SHEET_NAME));
  const summary = { refreshed: 0, skipped: 0, errors: 0 };
  tracks.forEach((track) => {
    if (track.note_id) {
      try {
        const result = refreshOne(track.note_id);
        result && result.skipped ? summary.skipped++ : summary.refreshed++;
      } catch (error) {
        summary.errors++;
        console.error(`${track.note_id}: ${error.message}`);
      }
    }
  });
  return summary;
}

function getDashboardData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, SHEET_NAME, HEADERS);
  ensureSheet_(ss, TRACKS_SHEET_NAME, TRACK_HEADERS);
  const results = getObjects_(ss.getSheetByName(SHEET_NAME));
  const tracks = getObjects_(ss.getSheetByName(TRACKS_SHEET_NAME));

  const latestByPost = {};
  results.forEach((row) => {
    if (!row.note_id) return;
    latestByPost[row.note_id] = row;
  });

  return {
    hasToken: Boolean(PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN')),
    tracks: tracks.map((track) => ({
      ...track,
      latest: latestByPost[track.note_id] || null
    })),
    recentRows: results.slice(-20).reverse()
  };
}

function handleApiGet_(params) {
  try {
    const action = params.action;
    let data;

    if (action === 'setup') {
      data = setup();
    } else if (action === 'dashboard') {
      data = getDashboardData();
    } else if (action === 'addTrack') {
      data = addTrack(params.url || params.noteId || '');
    } else if (action === 'refreshAll') {
      data = refreshAllTrackedPosts();
    } else if (action === 'saveToken') {
      data = saveApifyToken(params.token || '');
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    return jsonp_(params.callback, { ok: true, data });
  } catch (error) {
    return jsonp_(params.callback, { ok: false, error: error.message });
  }
}

function jsonp_(callback, payload) {
  const safeCallback = String(callback || 'callback').replace(/[^\w.$]/g, '');
  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(payload)})`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function fetchMetrics_(noteId) {
  const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) {
    throw new Error('Set your Apify token first.');
  }

  const response = UrlFetchApp.fetch(`${APIFY_ACTOR_URL}?token=${encodeURIComponent(token)}`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      mode: 'post',
      noteUrls: [noteId],
      maxResultsPerInput: 1
    }),
    muteHttpExceptions: true
  });

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`Apify returned HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
  }

  const items = JSON.parse(response.getContentText());
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Apify returned no data for this note.');
  }

  const item = items[0];
  const author = item.author || item.user || item.userInfo || {};
  const interact = item.interactInfo || item.interaction || item.stats || {};
  return {
    fetchedAt: item.scrapedAt || item._fetchedAt || item.fetchedAt || new Date(),
    noteId: item.noteId || item.id || item.note_id || noteId,
    title: item.title || item.noteTitle || item.displayTitle || item.descTitle || '',
    author: item.userName || item.nickname || author.nickname || author.name || author.userName || '',
    userId: item.userId || item.user_id || author.userId || author.id || '',
    redId: item.userRedId || item.redId || item.red_id || author.redId || author.red_id || '',
    type: item.noteType || item.type || item.note_type || '',
    likes: numberOrBlank_(firstValue_(item.likedCount, item.likes, item.likeCount, item.liked_count, interact.likedCount, interact.likes, interact.likeCount)),
    comments: numberOrBlank_(firstValue_(item.commentsCount, item.commentCount, item.comments, item.comments_count, interact.commentCount, interact.comments)),
    saves: numberOrBlank_(firstValue_(item.collectedCount, item.collectCount, item.collects, item.saves, item.collected_count, interact.collectedCount, interact.collectCount, interact.collects)),
    shares: numberOrBlank_(firstValue_(item.sharedCount, item.shareCount, item.shares, item.shared_count, interact.sharedCount, interact.shareCount, interact.shares)),
    views: numberOrBlank_(firstValue_(item.viewCount, item.views, item.view_count, interact.viewCount, interact.views)),
    pageUrl: item.notePageUrl || item.url || item.noteUrl || `https://www.xiaohongshu.com/explore/${noteId}`
  };
}

function makeRow_(sample, hourlyDelta, dailyDelta) {
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
    sample.saves,
    sample.shares,
    sample.views,
    hourlyDelta.likes,
    hourlyDelta.comments,
    hourlyDelta.saves,
    hourlyDelta.shares,
    dailyDelta.likes,
    dailyDelta.comments,
    dailyDelta.saves,
    dailyDelta.shares,
    sample.pageUrl
  ];
}

function extractNoteId_(input) {
  const text = String(input || '').trim();
  const match = text.match(/(?:explore|discovery\/item)\/([a-f0-9]{24})/i);
  if (match) return match[1];
  if (/^[a-f0-9]{24}$/i.test(text)) return text;
  return '';
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map((row) =>
    headers.reduce((object, header, index) => {
      object[header] = row[index];
      return object;
    }, {})
  );
}

function getLatestSample_(sheet, noteId) {
  const rows = getObjects_(sheet).filter((row) => row.note_id === noteId);
  return rowToSample_(rows.at(-1));
}

function getDailyBaseline_(sheet, noteId, fetchedAt) {
  const target = fetchedAt.getTime() - ONE_DAY_MS;
  const rows = getObjects_(sheet).filter((row) => row.note_id === noteId);
  for (let i = rows.length - 1; i >= 0; i--) {
    const rowTime = new Date(rows[i].fetched_at).getTime();
    if (rowTime <= target) return rowToSample_(rows[i]);
  }
  return null;
}

function rowToSample_(row) {
  if (!row) return null;
  return {
    likes: numberOrBlank_(row.likes),
    comments: numberOrBlank_(row.comments),
    saves: numberOrBlank_(row.saves),
    shares: numberOrBlank_(row.shares)
  };
}

function metricDelta_(current, previous) {
  return {
    likes: diff_(current.likes, previous && previous.likes),
    comments: diff_(current.comments, previous && previous.comments),
    saves: diff_(current.saves, previous && previous.saves),
    shares: diff_(current.shares, previous && previous.shares)
  };
}

function diff_(current, previous) {
  return typeof current === 'number' && typeof previous === 'number' ? current - previous : '';
}

function numberOrBlank_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : '';
}

function firstValue_() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== '') return arguments[i];
  }
  return '';
}

function updateTrackStatus_(sheet, zeroBasedDataIndex, status, error, checkedAt) {
  const row = zeroBasedDataIndex + 2;
  const now = new Date();
  sheet.getRange(row, 4, 1, 4).setValues([[
    checkedAt || '',
    new Date(now.getTime() + 60 * 60 * 1000),
    status,
    error || ''
  ]]);
}

function getCooldown_(lastCheckedAt) {
  if (!lastCheckedAt) return { blocked: false };
  const last = new Date(lastCheckedAt).getTime();
  if (!Number.isFinite(last)) return { blocked: false };
  const nextAllowedAt = new Date(last + 60 * 60 * 1000);
  const blocked = Date.now() < nextAllowedAt.getTime();
  return {
    blocked,
    nextAllowedAt,
    nextAllowedText: Utilities.formatDate(nextAllowedAt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
  };
}
