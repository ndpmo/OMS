function doGet(e) {
  const callback = e && e.parameter && e.parameter.callback;
  const payload = getOrgChartPayload_();
  const json = JSON.stringify(payload);

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrgChartPayload_() {
  const spreadsheetId = "1Hc-U6YnTrFxIfeG_wjwLpbYV-ghR0XGDSjuXGyMtSCg";
  const sheetName = "30+2 Summary Master";
  const readRange = "B1:AZ260";

  try {
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet tab not found: " + sheetName);

    const values = sheet.getRange(readRange).getDisplayValues();
    return {
      ok: true,
      source: sheetName + "!" + readRange,
      updatedAt: new Date().toISOString(),
      values: values
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || String(error)
    };
  }
}
