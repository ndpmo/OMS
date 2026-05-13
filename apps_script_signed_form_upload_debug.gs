const SPREADSHEET_ID = '1Hc-U6YnTrFxIfeG_wjwLpbYV-ghR0XGDSjuXGyMtSCg';
const ENROLLMENT_SHEET_NAME = 'enrollment detail';
const SIGNED_FORM_FOLDER_ID = '1mFQwhT82w35_ZPeEmJiawV4TtPEIgX-V';

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
  '2nd Follow up Date',
  'Signed Form Name',
  'Signed Form File ID',
  'Signed Form URL'
];

const HEADER_ALIASES = {
  'Staff No': 'Staff No.',
  'Staff Number': 'Staff No.',
  'Staff ID': 'Staff No.',

  '1st assessment Reamarks': '1st Follow up Remarks',
  '1st assessment Remarks': '1st Follow up Remarks',
  '1st Follow up Reamarks': '1st Follow up Remarks',
  '1st Follow up Remark': '1st Follow up Remarks',
  '1st assessment Date': '1st Follow up Date',
  '1st Follow Date': '1st Follow up Date',

  'Signed Contract Name': 'Signed Form Name',
  'Signed Contract File ID': 'Signed Form File ID',
  'Signed Contract URL': 'Signed Form URL',
  'Signed Form Link': 'Signed Form URL',
  'Uploaded Contract': 'Signed Form URL',

  '2nd assessment Remarks': '2nd Follow Remarks',
  '2nd Follow Reamarks': '2nd Follow Remarks',
  '2nd Follow up Remarks': '2nd Follow Remarks',
  '2nd Follow Remark': '2nd Follow Remarks',

  '2nd Commitment Date': '2nd Follow up Date',
  '2nd assessment date': '2nd Follow up Date',
  '2nd assessment Date': '2nd Follow up Date',
  '2nd Follow up': '2nd Follow up Date',
  '2nd Foloow up Date': '2nd Follow up Date',
  '2nd  Follow up Date': '2nd Follow up Date',
  '2nd Follow up Date': '2nd Follow up Date'
};

const COLUMN_FORMATS = {
  'Current Team size': '0',
  'Target team size': '0',
  'Offer target': '0',
  'Enroll date': 'yyyy-mm-dd',
  'Target completion Date': 'yyyy-mm-dd',
  'Assessment date time': 'yyyy-mm-dd hh:mm',
  '1st Follow up Date': 'yyyy-mm-dd hh:mm',
  '2nd Follow up Date': 'yyyy-mm-dd'
};

function doGet(event) {
  const sheetName = event && event.parameter && event.parameter.sheet
    ? event.parameter.sheet
    : 'Master';
  const callback = String(
    event && event.parameter && event.parameter.callback
      ? event.parameter.callback
      : 'callback'
  ).replace(/[^\w.$]/g, '');

  let payload;

  try {
    if (event && event.parameter && event.parameter.action === 'testUpload') {
      const testFile = createDriveUploadTestFile_();
      payload = JSON.stringify({
        ok: true,
        action: 'testUpload',
        message: 'Drive upload test file created.',
        file: testFile,
        updatedAt: new Date().toISOString()
      });
      return ContentService
        .createTextOutput(`${callback}(${payload});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    if (event && event.parameter && event.parameter.action === 'findSignedForm') {
      const fileName = event.parameter.name || '';
      const file = findSignedFormByName_(fileName);
      payload = JSON.stringify({
        ok: true,
        action: 'findSignedForm',
        found: Boolean(file),
        file,
        updatedAt: new Date().toISOString()
      });
      return ContentService
        .createTextOutput(`${callback}(${payload});`)
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    payload = JSON.stringify({
      ok: true,
      sheet: sheetName,
      updatedAt: new Date().toISOString(),
      values: sheet.getDataRange().getDisplayValues()
    });
  } catch (error) {
    payload = JSON.stringify({
      ok: false,
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
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    if (!event || !event.postData || !event.postData.contents) {
      throw new Error('Missing POST body.');
    }

    const payload = JSON.parse(event.postData.contents || '{}');
    const sheetName = payload.sheetName || ENROLLMENT_SHEET_NAME;
    const action = payload.action || '';
    const data = canonicalizeData_(payload.data || {});

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const headers = forceEnrollmentHeaders_(sheet);
    applyColumnFormats_(sheet, headers);

    const staffNo = String(data['Staff No.'] || '').trim();

    if (!staffNo) {
      throw new Error('Missing Staff No.');
    }

    // Signed form upload is optional; missing Y forms are highlighted in the dashboard.
    let signedForm = null;
    const hasSignedForm = payload.file && payload.file.base64;
    if (action === 'saveAssessment' && hasSignedForm) {
      signedForm = saveSignedForm_(payload.file, staffNo, data);
      data['Signed Form Name'] = signedForm.name;
      data['Signed Form File ID'] = signedForm.id;
      data['Signed Form URL'] = signedForm.url;
    }

    const rowIndex = findOrCreateStaffRow_(sheet, headers, staffNo);

    Object.keys(data).forEach((key) => {
      const canonicalKey = canonicalHeader_(key);
      const colIndex = headers.indexOf(canonicalKey) + 1;

      if (colIndex > 0) {
        const range = sheet.getRange(rowIndex, colIndex);

        if (COLUMN_FORMATS[canonicalKey]) {
          range.setNumberFormat(COLUMN_FORMATS[canonicalKey]);
        }

        range.setValue(data[key]);
      }
    });

    return jsonResponse_({
      ok: true,
      action,
      sheet: sheetName,
      staffNo,
      rowIndex,
      signedForm,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error.message,
      updatedAt: new Date().toISOString()
    });
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

function saveSignedForm_(filePayload, staffNo, data) {
  if (!filePayload || !filePayload.base64) {
    throw new Error('Signed form attachment is required before saving assessment.');
  }

  const brand = data && data.Brand ? data.Brand : '';
  const fileName = sanitizeDriveFileName_(
    filePayload.name || `${staffNo}_${brand || 'brand'}`
  );
  const mimeType = filePayload.mimeType || 'application/octet-stream';
  const bytes = Utilities.base64Decode(filePayload.base64);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);
  const folder = DriveApp.getFolderById(SIGNED_FORM_FOLDER_ID);

  // Replace old copy with the same exact name to avoid duplicates.
  const existingFiles = folder.getFilesByName(fileName);
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }

  const file = folder.createFile(blob).setName(fileName);

  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl()
  };
}

function sanitizeDriveFileName_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/gi, '_')
    .replace(/^_+|_+$/g, '') || 'signed_form';
}

function canonicalizeData_(data) {
  const output = {};

  Object.keys(data).forEach((key) => {
    const canonicalKey = canonicalHeader_(key);
    output[canonicalKey] = data[key];
  });

  return output;
}

function canonicalHeader_(header) {
  const raw = String(header || '').trim();
  const normalized = raw.replace(/\s+/g, ' ');

  if (HEADER_ALIASES[raw]) return HEADER_ALIASES[raw];
  if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized];

  return normalized;
}

function forceEnrollmentHeaders_(sheet) {
  sheet.getRange(1, 1, 1, ENROLLMENT_HEADERS.length).setValues([ENROLLMENT_HEADERS]);

  const lastColumn = sheet.getLastColumn();

  if (lastColumn > ENROLLMENT_HEADERS.length) {
    const extraHeaderRange = sheet.getRange(
      1,
      ENROLLMENT_HEADERS.length + 1,
      1,
      lastColumn - ENROLLMENT_HEADERS.length
    );

    const extraHeaders = extraHeaderRange.getDisplayValues()[0];

    extraHeaders.forEach((header, index) => {
      const canonical = canonicalHeader_(header);

      if (
        canonical === '2nd Follow up Date' ||
        canonical === '2nd Follow Remarks' ||
        canonical === ''
      ) {
        sheet.getRange(1, ENROLLMENT_HEADERS.length + 1 + index).clearContent();
      }
    });
  }

  return ENROLLMENT_HEADERS.slice();
}

function applyColumnFormats_(sheet, headers) {
  Object.keys(COLUMN_FORMATS).forEach((header) => {
    const colIndex = headers.indexOf(header) + 1;

    if (colIndex > 0) {
      const numRows = Math.max(sheet.getMaxRows() - 1, 1);
      sheet.getRange(2, colIndex, numRows, 1).setNumberFormat(COLUMN_FORMATS[header]);
    }
  });
}

function findOrCreateStaffRow_(sheet, headers, staffNo) {
  const staffNoColIndex = headers.indexOf('Staff No.') + 1;

  if (staffNoColIndex <= 0) {
    throw new Error('Missing Staff No. header.');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow >= 2) {
    const values = sheet
      .getRange(2, staffNoColIndex, lastRow - 1, 1)
      .getDisplayValues()
      .flat()
      .map(value => String(value || '').trim());

    const foundIndex = values.findIndex(value => value === staffNo);

    if (foundIndex >= 0) {
      return foundIndex + 2;
    }
  }

  const newRowIndex = Math.max(lastRow + 1, 2);
  sheet.getRange(newRowIndex, staffNoColIndex).setValue(staffNo);

  return newRowIndex;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}


function createDriveUploadTestFile_() {
  const folder = DriveApp.getFolderById(SIGNED_FORM_FOLDER_ID);
  const fileName = 'TEST_UPLOAD_from_apps_script';

  const existingFiles = folder.getFilesByName(fileName);
  while (existingFiles.hasNext()) {
    existingFiles.next().setTrashed(true);
  }

  const blob = Utilities.newBlob(
    'If you can see this file, Apps Script has permission to upload to the Leadership Program form folder.',
    'text/plain',
    fileName
  );

  const file = folder.createFile(blob).setName(fileName);
  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl()
  };
}

function findSignedFormByName_(fileName) {
  const safeName = sanitizeDriveFileName_(fileName);
  if (!safeName) return null;

  const folder = DriveApp.getFolderById(SIGNED_FORM_FOLDER_ID);
  const files = folder.getFilesByName(safeName);

  if (files.hasNext()) {
    return signedFormFileInfo_(files.next());
  }

  const safeBaseName = safeName.replace(/\.[a-z0-9]{1,8}$/i, '');
  const allFiles = folder.getFiles();
  while (allFiles.hasNext()) {
    const file = allFiles.next();
    const candidateBaseName = sanitizeDriveFileName_(file.getName()).replace(/\.[a-z0-9]{1,8}$/i, '');
    if (candidateBaseName === safeBaseName) {
      return signedFormFileInfo_(file);
    }
  }

  return null;
}

function signedFormFileInfo_(file) {
  return {
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
    updatedAt: file.getLastUpdated().toISOString()
  };
}

function testWriteEnrollmentDetailWithFile() {
  const testBlob = Utilities.newBlob('Test signed form content', 'text/plain', 'TEST001_dermes');
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        sheetName: 'enrollment detail',
        action: 'saveAssessment',
        data: {
          'Staff No.': 'TEST001',
          'Join': 'Y',
          'Commitment Tier': 'TL',
          'Offer Gap': 'Test offer gap',
          'Enroll date': '2026-05-13',
          'Target completion Date': '2026-06-30',
          'Current Team size': 3,
          'Target team size': 6,
          'Offer target': 3,
          'Assessment date time': '2026-05-13 13:12',
          'Carried out by': 'Test User',
          '1st Follow up Remarks': 'Test first remarks',
          '1st Follow up Date': '2026-05-13 13:12'
        },
        file: {
          name: 'TEST001_dermes',
          originalName: 'test.txt',
          mimeType: testBlob.getContentType(),
          base64: Utilities.base64Encode(testBlob.getBytes())
        }
      })
    }
  };

  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}

function authorizeDriveAndSheetsAccess() {
  const folder = DriveApp.getFolderById(SIGNED_FORM_FOLDER_ID);
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const authTestFile = folder.createFile(
    Utilities.newBlob(
      'Temporary authorization test file. This file can be deleted.',
      'text/plain',
      'TEMP_AUTHORIZATION_TEST_DELETE_ME'
    )
  );
  authTestFile.setTrashed(true);

  Logger.log(`Drive folder authorized: ${folder.getName()}`);
  Logger.log(`Drive write authorized: ${authTestFile.getId()}`);
  Logger.log(`Spreadsheet authorized: ${spreadsheet.getName()}`);
}

function diagnoseDriveUploadAccess() {
  try {
    const rootTest = DriveApp.createFile(
      Utilities.newBlob(
        'Root write test. This file can be deleted.',
        'text/plain',
        'TEMP_ROOT_WRITE_TEST_DELETE_ME'
      )
    );
    Logger.log(`Root Drive write: OK (${rootTest.getId()})`);
    rootTest.setTrashed(true);
  } catch (error) {
    Logger.log(`Root Drive write: FAILED - ${error.message}`);
  }

  try {
    const folder = DriveApp.getFolderById(SIGNED_FORM_FOLDER_ID);
    Logger.log(`Target folder read: OK (${folder.getName()})`);

    const folderTest = folder.createFile(
      Utilities.newBlob(
        'Folder write test. This file can be deleted.',
        'text/plain',
        'TEMP_FOLDER_WRITE_TEST_DELETE_ME'
      )
    );
    Logger.log(`Target folder write: OK (${folderTest.getId()})`);
    folderTest.setTrashed(true);
  } catch (error) {
    Logger.log(`Target folder write/read: FAILED - ${error.message}`);
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    Logger.log(`Spreadsheet access: OK (${spreadsheet.getName()})`);
  } catch (error) {
    Logger.log(`Spreadsheet access: FAILED - ${error.message}`);
  }
}
