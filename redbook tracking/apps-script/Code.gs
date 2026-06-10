const SPREADSHEET_ID = '1W6r0sQaQ96t1x2pF6ZodgVFqt6-odVWu-l1RWJXr7sw';
const SHEET_NAME = 'Hourly Results';
const TRACKS_SHEET_NAME = 'Tracked Posts';
const APIFY_ACTOR_URL = 'https://api.apify.com/v2/acts/habit.zhou~xiaohongshu-pro-scraper/run-sync-get-dataset-items';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_PASSWORD = '29768888pmo';

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
  'post_url',
  'submitted_url',
  'original_submitted_url',
  'region'
];

const TRACK_HEADERS = ['note_id', 'submitted_url', 'original_submitted_url', 'region', 'created_at', 'last_checked_at', 'next_check_at', 'status', 'error'];

function doGet(event) {
  const params = (event && event.parameter) || {};

  if (!params.action) {
    return jsonp_(params.callback, {
      ok: true,
      data: {
        service: 'redbook-tracking-api',
        status: 'ready',
        message: 'Backend only. Use the GitHub Pages dashboard to operate this tracker.'
      }
    });
  }

  return handleApiGet_(params, event);
}

function handleApiGet_(params, event) {
  try {
    const action = params.action;
    let data;

    if (action === 'setup') {
      data = setup();
    } else if (action === 'dashboard') {
      data = getDashboardData();
    } else if (action === 'addTrack') {
      data = addTrack(getSubmittedTrackInput_(params, event), params.region || '');
    } else if (action === 'refreshAll') {
      data = refreshAllTrackedPosts(params.refreshPassword || '', params.noteIds || '');
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
  return { saved: true };
}

function removeAutomaticRefreshTriggers() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'refreshAllTrackedPosts') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  return { ok: true };
}

function addTrack(rawInput, region) {
  setup();
  const inputs = extractNoteInputs_(rawInput);
  if (!inputs.length) {
    throw new Error('Please submit at least one valid Xiaohongshu URL, xhslink short URL, or 24-character note ID.');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(TRACKS_SHEET_NAME);
  const rows = getObjects_(sheet);
  const cleanRegion = normalizeRegion_(region);
  const existingRowsById = new Map();
  rows.forEach((row, index) => {
    existingRowsById.set(String(row.note_id), index + 2);
  });
  const now = new Date();
  let added = 0;
  let updated = 0;

  inputs.forEach((input) => {
    const existingRow = existingRowsById.get(input.noteId);
    if (existingRow) {
      const existingTrack = rows.find((row) => String(row.note_id) === input.noteId);
      const preservedOriginal = String(existingTrack?.original_submitted_url || '').trim();

      setRowValueByHeader_(sheet, existingRow, 'submitted_url', input.resolved);
      if (!preservedOriginal) {
        setRowValueByHeader_(sheet, existingRow, 'original_submitted_url', input.original || input.resolved || input.noteId);
      }
      setRowValueByHeader_(sheet, existingRow, 'region', cleanRegion);
      setRowValueByHeader_(sheet, existingRow, 'status', 'queued');
      setRowValueByHeader_(sheet, existingRow, 'error', 'Updated submitted URL/region; press refresh to fetch data.');
      updated++;
      return;
    }

    appendObjectRow_(sheet, {
      note_id: input.noteId,
      submitted_url: input.resolved,
      original_submitted_url: input.original || input.resolved || input.noteId,
      region: cleanRegion,
      created_at: now,
      last_checked_at: '',
      next_check_at: now,
      status: 'queued',
      error: ''
    });

    existingRowsById.set(input.noteId, sheet.getLastRow());
    added++;
  });

  const data = getDashboardData();
  data.added = added;
  data.skipped = updated;
  data.updated = updated;
  return data;
}

function isPriorityRefreshStatus_(status) {
  const value = String(status || '').trim().toLowerCase();
  return value === 'queued' || value === 'checking';
}

function sortTracksForRefresh_(tracks) {
  const priority = [];
  const rest = [];

  tracks.forEach((track) => {
    if (isPriorityRefreshStatus_(track.status)) {
      priority.push(track);
    } else {
      rest.push(track);
    }
  });

  return priority.concat(rest);
}

function refreshAllTrackedPosts(refreshPassword, selectedNoteIds) {
  validateRefreshPassword_(refreshPassword);
  setup();

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tracks = getObjects_(ss.getSheetByName(TRACKS_SHEET_NAME));
  const selected = parseSelectedNoteIds_(selectedNoteIds);
  const summary = { refreshed: 0, skipped: 0, errors: 0, details: [] };

  const eligible = tracks.filter((track) => {
    if (!track.note_id) return false;
    const normalizedNoteId = normalizeNoteId_(track.note_id);
    if (selected.size && !selected.has(normalizedNoteId)) return false;
    return true;
  });

  sortTracksForRefresh_(eligible).forEach((track) => {
    const normalizedNoteId = normalizeNoteId_(track.note_id);

    try {
      const result = refreshOne_(normalizedNoteId);
      if (result.skipped) {
        summary.skipped++;
      } else {
        summary.refreshed++;
      }
      summary.details.push(result);
    } catch (error) {
      summary.errors++;
      summary.details.push({ ok: false, noteId: track.note_id, error: error.message });
      console.error(`${track.note_id}: ${error.message}`);
    }
  });

  return summary;
}

function refreshOne_(noteId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tracksSheet = ss.getSheetByName(TRACKS_SHEET_NAME);
  const tracks = getObjects_(tracksSheet);
  const targetNoteId = normalizeNoteId_(noteId);
  const trackIndex = tracks.findIndex((row) => normalizeNoteId_(row.note_id) === targetNoteId);

  if (trackIndex === -1) {
    throw new Error('Tracked post not found.');
  }

  const track = tracks[trackIndex];
  try {
    updateTrackStatus_(tracksSheet, trackIndex, 'checking', '');

    const sample = fetchMetrics_(targetNoteId, track.submitted_url);
    const resultsSheet = ss.getSheetByName(SHEET_NAME);
    const previous = getLatestSample_(resultsSheet, targetNoteId);
    const dailyBaseline = getDailyBaseline_(resultsSheet, targetNoteId, new Date(sample.fetchedAt));
    const hourlyDelta = metricDelta_(sample, previous);
    const dailyDelta = metricDelta_(sample, dailyBaseline);

    appendObjectRow_(resultsSheet, makeRowObject_(
      sample,
      hourlyDelta,
      dailyDelta,
      track,
      track.region
    ));
    updateTrackStatus_(tracksSheet, trackIndex, 'active', '', sample.fetchedAt);

    return { ok: true, skipped: false, noteId: targetNoteId };
  } catch (error) {
    updateTrackStatus_(tracksSheet, trackIndex, 'error', error.message);
    throw error;
  }
}

function getDashboardData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_(ss, SHEET_NAME, HEADERS);
  ensureSheet_(ss, TRACKS_SHEET_NAME, TRACK_HEADERS);

  const results = getObjects_(ss.getSheetByName(SHEET_NAME));
  const tracks = getObjects_(ss.getSheetByName(TRACKS_SHEET_NAME));
  const latestByPost = {};

  results.forEach((row) => {
    if (row.note_id) latestByPost[row.note_id] = row;
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

function fetchMetrics_(noteId, submittedUrl) {
  const token = PropertiesService.getScriptProperties().getProperty('APIFY_TOKEN');
  if (!token) {
    throw new Error('Set your Apify token first.');
  }

  const attempts = buildApifyAttempts_(noteId, submittedUrl);
  const errors = [];
  let items = null;
  let noteUrl = '';

  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    const response = callApify_(token, attempt.payload);
    noteUrl = attempt.displayUrl;

    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      items = JSON.parse(response.getContentText());
      break;
    }

    const errorText = response.getContentText();
    errors.push(`attempt ${i + 1} ${attempt.label}: HTTP ${response.getResponseCode()} ${errorText}`);
    if (!isInvalidNoteUrlError_(response, errorText)) {
      throw new Error(`Apify returned HTTP ${response.getResponseCode()} for ${attempt.label}, ${attempt.displayUrl}: ${errorText}`);
    }
  }

  if (!items) {
    throw new Error(`Apify rejected every note URL format. ${errors.join(' | ')}`);
  }

  if (!Array.isArray(items) || !items.length) {
    throw new Error('Apify returned no data for this note.');
  }

  const item = items[0];
  if (isNoResultRow_(item)) {
    throw new Error('Apify actor did not fetch this post. It returned only internal result counters, not post data. Try adding XHS_COOKIES in Apps Script Properties, or switch back to a paid actor that supports note details without cookies.');
  }

  const sample = mapApifyItem_(item, noteId, noteUrl);

  if (isEmptyMetricRow_(sample)) {
    throw new Error(`Apify returned a row, but no usable title or metrics. Returned fields: ${describeReturnedFields_(item)}. Try adding XHS_COOKIES in Apps Script Properties, or this actor may not support this note without login cookies.`);
  }

  return sample;
}

function mapApifyItem_(item, noteId, noteUrl) {
  const author = item.author || item.user || item.userInfo || item.user_info || {};
  const interact = item.interactInfo || item.interaction || item.stats || item.statistics || item.counts || {};

  return {
    fetchedAt: firstValue_(item.scrapedAt, item._fetchedAt, item.fetchedAt, item.updatedAt, new Date()),
    noteId: firstValue_(item.noteId, item.id, item.note_id, item.noteID, noteId),
    title: firstValue_(item.title, item.noteTitle, item.displayTitle, item.descTitle, item.name, item.shareTitle),
    author: firstValue_(item.author, item.userName, item.nickname, item.authorName, item.creatorName, author.nickname, author.name, author.userName),
    userId: firstValue_(item.authorId, item.userId, item.user_id, author.userId, author.id),
    redId: firstValue_(item.userRedId, item.redId, item.red_id, author.redId, author.red_id),
    type: firstValue_(item.noteType, item.type, item.note_type, item.isVideo === true ? 'video' : item.isVideo === false ? 'note' : ''),
    likes: numberOrBlank_(firstValue_(item.likedCount, item.likes, item.likeCount, item.liked_count, interact.likedCount, interact.likes, interact.likeCount)),
    comments: numberOrBlank_(firstValue_(item.commentsCount, item.commentCount, item.comments, item.comments_count, interact.commentCount, interact.comments)),
    saves: numberOrBlank_(firstValue_(item.collectedCount, item.collectCount, item.collects, item.saves, item.collected_count, interact.collectedCount, interact.collectCount, interact.collects)),
    shares: numberOrBlank_(firstValue_(item.sharedCount, item.shareCount, item.shares, item.shared_count, interact.sharedCount, interact.shareCount, interact.shares)),
    views: numberOrBlank_(firstValue_(item.viewCount, item.views, item.view_count, interact.viewCount, interact.views)),
    pageUrl: firstValue_(item.notePageUrl, item.url, item.noteUrl, item.noteURL, noteUrl)
  };
}

function getSubmittedUrlForOutput_(track) {
  const original = String(track.original_submitted_url || '').trim();
  if (original) return original;
  return String(track.submitted_url || '').trim();
}

function makeRowObject_(sample, hourlyDelta, dailyDelta, track, region) {
  const originalSubmittedUrl = String(track.original_submitted_url || '').trim();
  const submittedUrlForOutput = getSubmittedUrlForOutput_(track);

  return {
    fetched_at: sample.fetchedAt,
    note_id: sample.noteId,
    title: sample.title,
    kol_name: sample.author,
    user_id: sample.userId,
    red_id: sample.redId,
    post_type: sample.type,
    likes: sample.likes,
    comments: sample.comments,
    saves: sample.saves,
    shares: sample.shares,
    views: sample.views,
    hourly_likes: hourlyDelta.likes,
    hourly_comments: hourlyDelta.comments,
    hourly_saves: hourlyDelta.saves,
    hourly_shares: hourlyDelta.shares,
    daily_likes: dailyDelta.likes,
    daily_comments: dailyDelta.comments,
    daily_saves: dailyDelta.saves,
    daily_shares: dailyDelta.shares,
    post_url: sample.pageUrl,
    submitted_url: submittedUrlForOutput,
    original_submitted_url: originalSubmittedUrl || submittedUrlForOutput,
    region: normalizeRegion_(region)
  };
}

function extractNoteInputs_(input) {
  const text = String(input || '').trim();
  if (!text) return [];

  const matches = [];
  const seen = {};
  const pattern = /https?:\/\/[^\s,，]+|[a-f0-9]{24}/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const raw = match[0].trim();
    const original = raw;
    const resolved = resolveShortLink_(raw);
    const noteId = extractNoteId_(resolved);

    if (noteId && !seen[noteId]) {
      matches.push({ noteId, resolved, original });
      seen[noteId] = true;
    }
  }

  return matches;
}

function extractNoteId_(input) {
  const text = String(input || '').trim();
  const match = text.match(/(?:explore|discovery\/item)\/([a-f0-9]{24})/i);
  if (match) return match[1];
  if (/^[a-f0-9]{24}$/i.test(text)) return text;
  return '';
}

function resolveShortLink_(raw) {
  if (!/^https?:\/\/(?:www\.)?xhslink\.com\//i.test(raw)) return raw;

  try {
    const response = UrlFetchApp.fetch(raw, {
      followRedirects: false,
      muteHttpExceptions: true
    });
    const headers = response.getAllHeaders();
    return headers.Location || headers.location || raw;
  } catch (error) {
    return raw;
  }
}

function validateRefreshPassword_(password) {
  if (String(password || '').trim() !== REFRESH_PASSWORD) {
    throw new Error('Refresh password is required.');
  }
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders_(sheet, headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  headers.forEach((header) => {
    if (currentHeaders.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      currentHeaders.push(header);
    }
  });
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

function setRowValueByHeader_(sheet, rowNumber, header, value) {
  ensureHeaders_(sheet, [header]);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnIndexes = headers
    .map((currentHeader, index) => currentHeader === header ? index + 1 : 0)
    .filter(Boolean);

  if (!columnIndexes.length) {
    throw new Error(`Missing required column: ${header}`);
  }

  columnIndexes.forEach((columnIndex) => {
    sheet.getRange(rowNumber, columnIndex).setValue(value);
  });
}

function appendObjectRow_(sheet, object) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((header) => object[header] !== undefined ? object[header] : '');
  sheet.appendRow(row);
}

function getLatestSample_(sheet, noteId) {
  const rows = getObjects_(sheet).filter((row) => String(row.note_id) === String(noteId));
  return rowToSample_(rows.at(-1));
}

function getDailyBaseline_(sheet, noteId, fetchedAt) {
  const target = fetchedAt.getTime() - ONE_DAY_MS;
  const rows = getObjects_(sheet).filter((row) => String(row.note_id) === String(noteId));

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

function buildNoteUrl_(noteId, submittedUrl) {
  const raw = String(submittedUrl || '').trim();
  if (/^https?:\/\/(?:www\.)?xhslink\.com\//i.test(raw)) {
    return raw;
  }

  const cleanNoteId = normalizeNoteId_(noteId) || extractNoteId_(submittedUrl);
  if (!cleanNoteId) {
    throw new Error(`Invalid Xiaohongshu note ID or URL: ${String(noteId || submittedUrl || '').slice(0, 120)}`);
  }

  const xsecToken = getUrlParam_(raw, 'xsec_token');
  const xsecSource = getUrlParam_(raw, 'xsec_source') || 'app_share';
  if (xsecToken) {
    return `https://www.xiaohongshu.com/explore/${cleanNoteId}?xsec_token=${encodeURIComponent(xsecToken)}&xsec_source=${encodeURIComponent(xsecSource)}`;
  }

  return `https://www.xiaohongshu.com/explore/${cleanNoteId}`;
}

function buildApifyAttempts_(noteId, submittedUrl) {
  const raw = String(submittedUrl || '').trim();
  const cleanNoteId = normalizeNoteId_(noteId) || extractNoteId_(submittedUrl);
  const urls = [];

  addUnique_(urls, buildNoteUrl_(cleanNoteId, submittedUrl));
  if (/^https?:\/\/(?:www\.)?xiaohongshu\.com\//i.test(raw)) addUnique_(urls, stripQuery_(raw));
  if (cleanNoteId) {
    addUnique_(urls, `https://www.xiaohongshu.com/explore/${cleanNoteId}`);
    addUnique_(urls, `https://www.xiaohongshu.com/discovery/item/${cleanNoteId}`);
    addUnique_(urls, `https://www.xiaohongshu.com/explore/${cleanNoteId}/`);
  }
  if (/^https?:\/\/(?:www\.)?xhslink\.com\//i.test(raw)) addUnique_(urls, raw);

  return urls.map((url) => ({
    label: 'noteUrls string',
    displayUrl: url,
    payload: makeApifyPayload_([url])
  })).concat(urls.map((url) => ({
    label: 'noteUrls object',
    displayUrl: url,
    payload: makeApifyPayload_([{ url }])
  })));
}

function makeApifyPayload_(noteUrls) {
  const payload = {
    mode: 'notes',
    noteUrls,
    maxItemsPerInput: 1,
    fetchComments: false
  };
  const cookiesString = PropertiesService.getScriptProperties().getProperty('XHS_COOKIES');
  if (cookiesString) payload.cookiesString = cookiesString;
  return payload;
}

function callApify_(token, payload) {
  return UrlFetchApp.fetch(`${APIFY_ACTOR_URL}?token=${encodeURIComponent(token)}`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function isInvalidNoteUrlError_(response, errorText) {
  return response.getResponseCode() === 400 &&
    /input\.noteUrls/i.test(errorText || '') &&
    /valid URLs/i.test(errorText || '');
}

function addUnique_(items, value) {
  if (value && items.indexOf(value) === -1) items.push(value);
}

function stripQuery_(url) {
  return String(url || '').split('?')[0].split('#')[0];
}

function normalizeNoteId_(value) {
  const text = String(value || '').trim();
  if (/^[a-f0-9]{24}$/i.test(text)) return text.toLowerCase();
  return extractNoteId_(text).toLowerCase();
}

function getUrlParam_(url, name) {
  const pattern = new RegExp(`[?&]${name}=([^&]*)`, 'i');
  const match = String(url || '').match(pattern);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch (error) {
    return match[1];
  }
}

function isEmptyMetricRow_(sample) {
  return !sample.title &&
    !sample.author &&
    sample.likes === 0 &&
    sample.comments === 0 &&
    sample.saves === 0 &&
    sample.shares === 0;
}

function isNoResultRow_(item) {
  const keys = Object.keys(item || {});
  return keys.length > 0 &&
    keys.every((key) => key.indexOf('_') === 0) &&
    Number(item._results_produced || 0) === 0;
}

function describeReturnedFields_(item) {
  const topLevel = Object.keys(item || {}).slice(0, 30);
  const nested = ['author', 'user', 'userInfo', 'user_info', 'interactInfo', 'interaction', 'stats', 'statistics', 'counts']
    .filter((key) => item && item[key] && typeof item[key] === 'object')
    .map((key) => `${key}: ${Object.keys(item[key]).slice(0, 20).join(', ')}`);
  return [topLevel.join(', '), ...nested].filter(Boolean).join(' | ');
}

function updateTrackStatus_(sheet, zeroBasedDataIndex, status, error, checkedAt) {
  const row = zeroBasedDataIndex + 2;
  setRowValueByHeader_(sheet, row, 'last_checked_at', checkedAt || '');
  setRowValueByHeader_(sheet, row, 'next_check_at', '');
  setRowValueByHeader_(sheet, row, 'status', status);
  setRowValueByHeader_(sheet, row, 'error', error || '');
}

function parseSelectedNoteIds_(selectedNoteIds) {
  const selected = new Set();
  String(selectedNoteIds || '').split(',').forEach((value) => {
    const noteId = normalizeNoteId_(value);
    if (noteId) selected.add(noteId);
  });
  return selected;
}

function normalizeRegion_(region) {
  const value = String(region || '').trim().toUpperCase();
  return value === 'SH' ? 'SH' : 'HK';
}

function getSubmittedTrackInput_(params, event) {
  const fromParams = params.url || params.noteId || '';
  const queryString = event && event.queryString ? String(event.queryString) : '';
  const rawUrl = extractRawQueryValue_(queryString, 'url');
  return rawUrl || fromParams;
}

function getSubmittedTrackRegion_(params, event) {
  const queryString = event && event.queryString ? String(event.queryString) : '';
  const rawRegion = extractLastRawQueryValue_(queryString, 'region');
  return rawRegion || params.region || '';
}

function extractLastRawQueryValue_(queryString, key) {
  if (!queryString) return '';
  const marker = `${key}=`;
  const prefixedMarker = `&${marker}`;
  let start = queryString.lastIndexOf(prefixedMarker);
  if (start !== -1) {
    start += prefixedMarker.length;
  } else if (queryString.startsWith(marker)) {
    start = marker.length;
  } else {
    return '';
  }

  let value = queryString.slice(start);
  const ampersand = value.indexOf('&');
  if (ampersand !== -1) value = value.slice(0, ampersand);

  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch (error) {
    return value;
  }
}

function extractRawQueryValue_(queryString, key) {
  if (!queryString) return '';
  const marker = `${key}=`;
  const start = queryString.indexOf(marker);
  if (start === -1) return '';

  let value = queryString.slice(start + marker.length);
  const knownNextParams = ['&callback=', '&action=', '&noteId=', '&region=', '&noteIds=', '&refreshPassword=', '&token='];
  let end = value.length;
  knownNextParams.forEach((param) => {
    const index = value.indexOf(param);
    if (index !== -1 && index < end) end = index;
  });
  value = value.slice(0, end);

  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch (error) {
    return value;
  }
}

function jsonp_(callback, payload) {
  const safeCallback = String(callback || 'callback').replace(/[^\w.$]/g, '');
  const output = safeCallback
    ? `${safeCallback}(${JSON.stringify(payload)})`
    : JSON.stringify(payload);

  return ContentService
    .createTextOutput(output)
    .setMimeType(safeCallback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}