const SPREADSHEET_ID = '1-9YMVkaTo4BHUIEXoltFWfMwc8i3ajvHPzUltRETRac';

function doGet(e) {
  const sheetName = e.parameter.sheet || 'Mission List';
  const spreadsheetId = e.parameter.spreadsheetId || SPREADSHEET_ID;

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return jsonOutput({
        success: false,
        sheet: sheetName,
        count: 0,
        data: [],
        error: `Sheet not found: ${sheetName}`
      });
    }

    const values = sheet.getDataRange().getValues();

    if (values.length < 2) {
      return jsonOutput({
        success: true,
        sheet: sheetName,
        count: 0,
        data: []
      });
    }

    const headers = values[0].map(header => String(header).trim());
    const rows = values.slice(1).filter(row =>
      row.some(cell => cell !== '' && cell !== null)
    );

    const data = rows.map(row => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index];
      });
      return record;
    });

    return jsonOutput({
      success: true,
      sheet: sheetName,
      count: data.length,
      data
    });
  } catch (error) {
    return jsonOutput({
      success: false,
      sheet: sheetName,
      count: 0,
      data: [],
      error: error.message
    });
  }
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
