const SPREADSHEET_ID = '1Hc-U6YnTrFxIfeG_wjwLpbYV-ghR0XGDSjuXGyMtSCg';
const ENROLLMENT_HEADERS = [
  'Staff No.',
  'Join',
  'Commitment Tier',
  'Offer Gap',
  'Enroll date',
  'Target completion Date',
  'Current Team size',
  'Target team size',
  'Offer target',
  'Assessment date time',
  'Carried out by',
  '1st Follow up Remarks',
  '1st Follow up Date',
  '2nd Follow Remarks',
  '2nd Foloow up Date'
];

const HEADER_ALIASES = {
  '1st assessment Reamarks': '1st Follow up Remarks',
  '1st assessment Remarks': '1st Follow up Remarks',
  '1st Follow up Reamarks': '1st Follow up Remarks',
  '1st assessment Date': '1st Follow up Date',
  '2nd assessment Remarks': '2nd Follow Remarks',
  '2nd Follow Reamarks': '2nd Follow Remarks',
  '2nd Commitment Date': '2nd Foloow up Date',
  '2nd assessment date': '2nd Foloow up Date',
  '2nd Follow up': '2nd Foloow up Date'
};

const COLUMN_FORMATS = {
  'Current Team size': '0',
  'Target team size': '0',
  'Offer target': '0',
  'Enroll date': 'yyyy-mm-dd',
  'Target completion Date': 'yyyy-mm-dd',
  'Assessment date time': 'yyyy-mm-dd hh:mm',
  '1st Follow up Date': 'yyyy-mm-dd hh:mm',
  '2nd Foloow up Date': 'yyyy-mm-dd'
};

function doGet(event) {
  const sheetName = event.parameter.sheet || 'Master';
  const callback = String(event.parameter.callback || 'callback').replace(/[^\w.$]/g, '');
  let payload;

  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
    payload = JSON.stringify({
      sheet: sheetName,
      updatedAt: new Date().toISOString(),
      values: sheet.getDataRange().getDisplayValues()
    });
  } catch (error) {
    payload = JSON.stringify({
      error: error.message,
      sheet: sheetName,
      updatedAt: new Date().toISOString()
    });
  }

  return ContentService
    .createTextOutput(`${callback}(${payload});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(event) {
  try {
    const payload = JSON.parse(event.postData.contents || '{}');
    const sheetName = payload.sheetName || 'enrollment detail';
    const data = canonicalizeData_(payload.data || {});
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);

    const headers = ensureHeaders_(sheet, ENROLLMENT_HEADERS);
    applyColumnFormats_(sheet, headers);

    const staffNo = String(data['Staff No.'] || '').trim();
    if (!staffNo) throw new Error('Missing Staff No.');

    const rowIndex = findOrCreateStaffRow_(sheet, headers, staffNo);
    Object.keys(data).forEach((key) => {
      const colIndex = headers.indexOf(key) + 1;
      if (colIndex > 0) {
        const range = sheet.getRange(rowIndex, colIndex);
        if (COLUMN_FORMATS[key]) range.setNumberFormat(COLUMN_FORMATS[key]);
        range.setValue(data[key]);
      }
    });

    return jsonResponse_({ ok: true, action: payload.action || '', staffNo });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message });
  }
}

function canonicalizeData_(data) {
  const output = {};
  Object.keys(data).forEach((key) => {
    const canonicalKey = HEADER_ALIASES[key] || key;
    output[canonicalKey] = data[key];
  });
  return output;
}

function applyColumnFormats_(sheet, headers) {
  const rowCount = Math.max(sheet.getMaxRows() - 1, 1);
  Object.keys(COLUMN_FORMATS).forEach((header) => {
    const colIndex = headers.indexOf(header) + 1;
    if (colIndex > 0) {
      sheet.getRange(2, colIndex, rowCount, 1).setNumberFormat(COLUMN_FORMATS[header]);
    }
  });
}

function ensureHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  requiredHeaders.forEach((header) => {
    if (headers.indexOf(header) === -1) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
    }
  });
  return headers;
}

function findOrCreateStaffRow_(sheet, headers, staffNo) {
  const staffNoCol = headers.indexOf('Staff No.') + 1;
  if (!staffNoCol) throw new Error('Missing Staff No. header');
  const lastRow = Math.max(sheet.getLastRow(), 1);
  if (lastRow > 1) {
    const values = sheet.getRange(2, staffNoCol, lastRow - 1, 1).getValues();
    const foundIndex = values.findIndex((row) => String(row[0]).trim() === staffNo);
    if (foundIndex >= 0) return foundIndex + 2;
  }
  const nextRow = lastRow + 1;
  sheet.getRange(nextRow, staffNoCol).setValue(staffNo);
  return nextRow;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
