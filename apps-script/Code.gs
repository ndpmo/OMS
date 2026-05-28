const SPREADSHEET_ID = '1W6r0sQaQ96t1x2pF6ZodgVFqt6-odVWu-l1RWJXr7sw';
const SHEET_NAME = 'Hourly Results';
const TRACKS_SHEET_NAME = 'Tracked Posts';
const APIFY_ACTOR_URL = 'https://api.apify.com/v2/acts/sian.agency~xiaohongshu-rednote-scraper/run-sync-get-dataset-items';
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
  installHourlyTrigger_();
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

  refreshOne(noteId);
  return getDashboardData();
}

function refreshOne(noteId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, SHEET_NAME, HEADERS);
  ensureSheet_(ss, TRACKS_SHEET_NAME, TRACK_HEADERS);
  const tracksSheet = ss.getSheetByName(TRACKS_SHEET_NAME);
  const tracks = getObjects_(tracksSheet);
  const trackIndex = tracks.findIndex((row) => row.note_id === noteId);
  if (trackIndex === -1) {
    throw new Error('Tracked post not found.');
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
  tracks.forEach((track) => {
    if (track.note_id) {
      try {
        refreshOne(track.note_id);
      } catch (error) {
        console.error(`${track.note_id}: ${error.message}`);
      }
    }
  });
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
      refreshAllTrackedPosts();
      data = getDashboardData();
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
      operation: 'noteDetail',
      noteId
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
  return {
    fetchedAt: item._fetchedAt || new Date(),
    noteId: item.noteId || item.id || noteId,
    title: item.noteTitle || item.title || '',
    author: item.userName || (item.user && (item.user.nickname || item.user.name)) || '',
    userId: item.userId || (item.user && item.user.id) || '',
    redId: item.userRedId || (item.user && item.user.red_id) || '',
    type: item.noteType || item.type || '',
    likes: numberOrBlank_(item.likedCount ?? item.liked_count),
    comments: numberOrBlank_(item.commentsCount ?? item.comments_count),
    saves: numberOrBlank_(item.collectedCount ?? item.collected_count),
    shares: numberOrBlank_(item.sharedCount ?? item.shared_count),
    views: numberOrBlank_(item.viewCount ?? item.view_count),
    pageUrl: item.notePageUrl || `https://www.xiaohongshu.com/explore/${noteId}`
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

function installHourlyTrigger_() {
  const handler = 'refreshAllTrackedPosts';
  const exists = ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === handler);
  if (!exists) {
    ScriptApp.newTrigger(handler).timeBased().everyHours(1).create();
  }
}
