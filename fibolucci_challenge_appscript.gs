const CHALLENGE_SPREADSHEET_ID = '1LJvr42xmpcPkR1WBn8G0gaZ2-2foXzGv7yvYrq_dpQg';
const CHALLENGE_SHEET_NAME = 'Sheet1';
const CHALLENGE_START = '2026-05-22';
const CHALLENGE_END = '2026-06-17';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'challengeData';
  if (action !== 'challengeData') {
    return jsonOut_({ ok: false, error: 'Unknown action' });
  }

  try {
    const payload = buildChallengePayload_();
    return jsonOut_({ ok: true, ...payload, updatedAt: new Date().toISOString() });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message, updatedAt: new Date().toISOString() });
  }
}

function buildChallengePayload_() {
  const ss = SpreadsheetApp.openById(CHALLENGE_SPREADSHEET_ID);
  const sh = ss.getSheetByName(CHALLENGE_SHEET_NAME) || ss.getSheets()[0];
  const values = sh.getDataRange().getDisplayValues();
  if (!values.length) {
    return { rows: [] };
  }

  const headerInfo = findHeaderRow_(values);
  if (!headerInfo) {
    throw new Error('Missing required columns: Brand, Therapist, Prepaid Invoice Date, FALSE, TRUE');
  }

  const headerRow = headerInfo.rowIndex;
  const headers = headerInfo.headers;
  const idx = {
    brand: headers.indexOf('BRAND'),
    therapist: headers.indexOf('THERAPIST'),
    date: headers.indexOf('PREPAID INVOICE DATE'),
    head: headers.indexOf('FALSE'),
    tail: headers.indexOf('TRUE')
  };

  const start = new Date(CHALLENGE_START + 'T00:00:00');
  const end = new Date(CHALLENGE_END + 'T23:59:59');
  const byTherapist = {};

  for (let r = headerRow + 1; r < values.length; r++) {
    const row = values[r];
    const brand = String(row[idx.brand] || '').trim();
    const therapist = String(row[idx.therapist] || '').trim();
    const rawDate = row[idx.date];
    const headCount = Number(row[idx.head] || 0);
    const tailCount = Number(row[idx.tail] || 0);

    if (!brand || !therapist || !rawDate || (headCount <= 0 && tailCount <= 0)) continue;

    const dt = parseSheetDate_(rawDate);
    if (!dt || dt < start || dt > end) continue;

    const key = `${brand}||${therapist}`;
    if (!byTherapist[key]) {
      byTherapist[key] = { brand, therapist, headByDate: {}, tailByDate: {}, totalHead: 0, totalTail: 0 };
    }

    const dayKey = Utilities.formatDate(dt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    byTherapist[key].headByDate[dayKey] = (byTherapist[key].headByDate[dayKey] || 0) + headCount;
    byTherapist[key].tailByDate[dayKey] = (byTherapist[key].tailByDate[dayKey] || 0) + tailCount;
    byTherapist[key].totalHead += headCount;
    byTherapist[key].totalTail += tailCount;
  }

  const rows = Object.keys(byTherapist)
    .map(k => byTherapist[k])
    .sort((a, b) => a.brand.localeCompare(b.brand) || a.therapist.localeCompare(b.therapist));

  return {
    challengeStart: CHALLENGE_START,
    challengeEnd: CHALLENGE_END,
    rows
  };
}

function findHeaderRow_(values) {
  const maxRowsToScan = Math.min(values.length, 10);
  for (let r = 0; r < maxRowsToScan; r++) {
    const headers = values[r].map(h => String(h).trim().toUpperCase());
    const hasRequired =
      headers.indexOf('BRAND') >= 0 &&
      headers.indexOf('THERAPIST') >= 0 &&
      headers.indexOf('PREPAID INVOICE DATE') >= 0 &&
      headers.indexOf('FALSE') >= 0 &&
      headers.indexOf('TRUE') >= 0;

    if (hasRequired) {
      return { rowIndex: r, headers };
    }
  }
  return null;
}

function parseSheetDate_(raw) {
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw)) {
    return raw;
  }
  const text = String(raw || '').trim();
  if (!text) return null;

  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]);
    return new Date(y, mo, d);
  }

  const dt = new Date(text);
  return isNaN(dt) ? null : dt;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
