/**
 * Redbook Content Backend (Google Apps Script)
 * Sheet tabs expected:
 * 1) "staff list"   columns: A FLOOR | B NAME | C Staff No. | D XHS account name
 * 2) "assignments"  (auto-created if missing)
 */

const STAFF_SHEET = "staff list";
const ASSIGN_SHEET = "assignments";
const GENERATED_SHEET = "generated";
const SPREADSHEET_ID = "14O9d5M4d8mfGvNPN-KXZy6FSI3OF4g2cKNfX13Gj3lI";
const DRIVE_FOLDER_ID = "1aI1eTl4oJqdh41Q5lE-qekCSF1yvLXYU";
const TZ = Session.getScriptTimeZone() || "Asia/Hong_Kong";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Redbook Setup")
    .addItem("Create Required Tabs", "setupRedbookSheets")
    .addToUi();
}

function setupRedbookSheets() {
  const ss = getWorkbook_();
  ensureStaffSheet_(ss);
  ensureGeneratedSheet_(ss);
  ensureAssignSheet_(ss);
}

function authorizeDriveAccess() {
  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
  const uploaded = saveReferenceImageToDrive_("redbook-drive-auth-test.png", tinyPng);
  if (!uploaded.fileId) {
    throw new Error(uploaded.error || "Drive authorization test failed.");
  }
  Logger.log("Drive upload authorization OK: " + uploaded.fileUrl);
  return uploaded.fileUrl;
}

function getWorkbook_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function doGet(e) {
  const action = (e.parameter.action || "").trim();

  if (action === "staff") {
    return jsonOut({ ok: true, staff: getStaffList_() });
  }

  if (action === "byStaff") {
    const staffNo = String(e.parameter.staffNo || "").trim();
    if (!staffNo) return jsonOut({ ok: false, error: "Missing staffNo" });
    return jsonOut({ ok: true, rows: getAssignmentsByStaff_(staffNo) });
  }

  if (action === "topicProgress") {
    return jsonOut({ ok: true, topics: getTopicProgress_() });
  }

  if (action === "testDriveUpload") {
    const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    const uploaded = saveReferenceImageToDrive_("redbook-upload-test.png", tinyPng);
    if (!uploaded.fileId) {
      return jsonOut({ ok: false, error: uploaded.error || "Drive upload test failed. Check Apps Script authorization and folder access." });
    }
    return jsonOut({ ok: true, fileId: uploaded.fileId, fileUrl: uploaded.fileUrl });
  }

  if (action === "approveAssignOne") {
    const topic = String(e.parameter.topic || "").trim();
    const topicDate = String(e.parameter.topicDate || "").trim();
    const assignDate = String(e.parameter.assignDate || "").trim();
    const id = String(e.parameter.id || "").trim();
    const generatedAt = String(e.parameter.generatedAt || "").trim();
    const approvedAt = String(e.parameter.approvedAt || "").trim();
    const assignedTo = String(e.parameter.assignedTo || "").trim();

    if (!topic || !topicDate || !id) {
      return jsonOut({ ok: false, error: "Missing topic/topicDate/id" });
    }

    const generated = findGeneratedById_(id);
    const result = appendAssignedDirect_(topic, topicDate, assignDate, {
      id: id,
      title: generated ? generated.title : "",
      hashtags: generated ? generated.hashtags : "",
      content: generated ? generated.content : "",
      photoDirection: generated ? generated.photoDirection : "",
      photoInstruction: generated ? generated.photoInstruction : "",
      referenceImageFileId: generated ? generated.referenceImageFileId : "",
      referenceImageFileUrl: generated ? generated.referenceImageFileUrl : "",
      generatedAt: generatedAt || (generated ? generated.generatedAt : ""),
      approvedAt: approvedAt,
      assignedTo: assignedTo
    });
    return jsonOut({ ok: true, inserted: result.inserted });
  }

  return jsonOut({ ok: true, message: "Redbook Apps Script is running." });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    const action = String(body.action || "").trim();

    if (action === "approveAndAssign") {
      const topic = String(body.topic || "").trim();
      const topicDate = String(body.topicDate || "").trim();
      const items = Array.isArray(body.items) ? body.items : [];
      const assignDate = String(body.assignDate || "").trim();

      if (!topic || !topicDate || !items.length) {
        return jsonOut({ ok: false, error: "Missing topic/topicDate/items" });
      }

      const result = approveAndAssign_(topic, topicDate, items, assignDate);
      return jsonOut({ ok: true, inserted: result.inserted, assigned: result.assigned });
    }

    if (action === "appendApprovedOnly") {
      const topic = String(body.topic || "").trim();
      const topicDate = String(body.topicDate || "").trim();
      const items = Array.isArray(body.items) ? body.items : [];

      if (!topic || !topicDate || !items.length) {
        return jsonOut({ ok: false, error: "Missing topic/topicDate/items" });
      }

      const result = appendApprovedOnly_(topic, topicDate, items);
      return jsonOut({ ok: true, inserted: result.inserted });
    }

    if (action === "appendGeneratedOnly") {
      const topic = String(body.topic || "").trim();
      const topicDate = String(body.topicDate || "").trim();
      const items = Array.isArray(body.items) ? body.items : [];

      if (!topic || !topicDate || !items.length) {
        return jsonOut({ ok: false, error: "Missing topic/topicDate/items" });
      }

      const result = appendGeneratedOnly_(topic, topicDate, items);
      return jsonOut({ ok: true, inserted: result.inserted });
    }

    if (action === "approveAssignOneWithImage") {
      const topic = String(body.topic || "").trim();
      const topicDate = String(body.topicDate || "").trim();
      const assignDate = String(body.assignDate || "").trim();
      const id = String(body.id || "").trim();
      const generatedAt = String(body.generatedAt || "").trim();
      const approvedAt = String(body.approvedAt || "").trim();
      const assignedTo = String(body.assignedTo || "").trim();
      const title = String(body.title || "").trim();
      const hashtags = String(body.hashtags || "").trim();
      const content = String(body.content || "").trim();
      const photoDirection = String(body.photoDirection || "").trim();
      const photoInstruction = String(body.photoInstruction || "").trim();
      const referenceImageName = String(body.referenceImageName || "").trim();
      const referenceImageDataUrl = String(body.referenceImageDataUrl || "").trim();

      if (!topic || !topicDate || !id) {
        return jsonOut({ ok: false, error: "Missing topic/topicDate/id" });
      }

      const generated = findGeneratedById_(id);
      let uploaded = {
        fileId: generated ? generated.referenceImageFileId : "",
        fileUrl: generated ? generated.referenceImageFileUrl : ""
      };
      if (!uploaded.fileId && referenceImageDataUrl) {
        uploaded = saveReferenceImageToDrive_(referenceImageName, referenceImageDataUrl);
      }
      const result = appendAssignedDirect_(topic, topicDate, assignDate, {
        id: id,
        title: title,
        hashtags: hashtags,
        content: content,
        photoDirection: photoDirection,
        photoInstruction: photoInstruction,
        referenceImageFileId: uploaded.fileId || "",
        referenceImageFileUrl: uploaded.fileUrl || "",
        generatedAt: generatedAt,
        approvedAt: approvedAt,
        assignedTo: assignedTo
      });
      return jsonOut({ ok: true, inserted: result.inserted, uploaded: uploaded.fileId ? 1 : 0 });
    }

    return jsonOut({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message || String(err) });
  }
}

function approveAndAssign_(topic, topicDate, items, assignDate) {
  const ss = getWorkbook_();
  const sheet = ensureAssignSheet_(ss);
  const staff = getStaffList_();
  if (!staff.length) throw new Error("No staff found in 'staff list' col C.");

  const props = PropertiesService.getScriptProperties();
  const key = "rr_index_" + topic + "_" + topicDate;
  let rrIndex = Number(props.getProperty(key) || 0);

  const now = new Date();
  const genDate = topicDate;
  const asgDate = assignDate || Utilities.formatDate(now, TZ, "yyyy-MM-dd");

  const rows = [];
  const assigned = [];

  items.forEach(function (item, i) {
    const staffRow = staff[rrIndex % staff.length];
    rrIndex += 1;

    const row = {
      id: item.id || ("auto_" + Date.now() + "_" + i),
      topic: topic,
      topicDate: genDate,
      generatedAt: item.generatedAt || "",
      approvedAt: item.approvedAt || isoNow_(),
      assignDate: asgDate,
      assignedAt: isoNow_(),
      staffNo: staffRow.staffNo,
      staffName: staffRow.name,
      floor: staffRow.floor,
      xhsAccount: staffRow.xhsAccount,
      title: item.title || "",
      hashtags: item.hashtags || "",
      content: item.content || ""
    };

    rows.push(toAssignRow_(row));
    assigned.push(row);
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  props.setProperty(key, String(rrIndex));
  return { inserted: rows.length, assigned: assigned };
}

function appendApprovedOnly_(topic, topicDate, items) {
  const ss = getWorkbook_();
  const sheet = ensureAssignSheet_(ss);

  const rows = items.map(function (item, i) {
    const row = {
      id: item.id || ("approved_" + Date.now() + "_" + i),
      topic: topic,
      topicDate: topicDate,
      generatedAt: item.generatedAt || "",
      approvedAt: item.approvedAt || isoNow_(),
      assignDate: "",
      assignedAt: "",
      staffNo: "",
      staffName: "",
      floor: "",
      xhsAccount: "",
      title: item.title || "",
      hashtags: item.hashtags || "",
      content: item.content || ""
    };
    return toAssignRow_(row);
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }

  return { inserted: rows.length };
}

function appendGeneratedOnly_(topic, topicDate, items) {
  const ss = getWorkbook_();
  const sheet = ensureGeneratedSheet_(ss);
  const referenceItem = items.find(function (item) {
    return item.referenceImageDataUrl;
  }) || {};
  const uploaded = saveReferenceImageToDrive_(
    referenceItem.referenceImageName || "",
    referenceItem.referenceImageDataUrl || ""
  );

  const rows = items.map(function (item, i) {
    return [
      item.id || ("generated_" + Date.now() + "_" + i),
      topic,
      topicDate,
      item.generatedAt || isoNow_(),
      item.title || "",
      item.hashtags || "",
      item.content || "",
      item.photoDirection || "",
      item.photoInstruction || "",
      uploaded.fileId || "",
      uploaded.fileUrl || ""
    ];
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { inserted: rows.length };
}

function appendAssignedDirect_(topic, topicDate, assignDate, item) {
  const ss = getWorkbook_();
  const sheet = ensureAssignSheet_(ss);
  const staff = getStaffList_();
  const byNo = {};
  staff.forEach(function (s) { byNo[s.staffNo] = s; });
  const nowIso = isoNow_();
  const asgDate = assignDate || Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
  const staffRow = byNo[item.assignedTo] || { staffNo: item.assignedTo || "", name: "", floor: "", xhsAccount: "" };

  const row = [
    item.id || ("auto_" + Date.now()),
    topic,
    topicDate,
    item.generatedAt || nowIso,
    item.approvedAt || nowIso,
    asgDate,
    nowIso,
    staffRow.staffNo || "",
    staffRow.name || "",
    staffRow.floor || "",
    staffRow.xhsAccount || "",
    item.title || "",
    item.hashtags || "",
    item.content || "",
    item.photoDirection || "",
    item.photoInstruction || "",
    item.referenceImageFileId || "",
    item.referenceImageFileUrl || ""
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return { inserted: 1 };
}

function getAssignmentsByStaff_(staffNo) {
  const ss = getWorkbook_();
  const sheet = ensureAssignSheet_(ss);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const header = values[0];
  const idx = indexMap_(header);

  return values.slice(1)
    .filter(function (r) { return String(r[idx.staffNo] || "").trim() === staffNo; })
    .map(function (r) {
      return {
        id: r[idx.id],
        topic: r[idx.topic],
        topicDate: r[idx.topicDate],
        generatedAt: r[idx.generatedAt],
        approvedAt: r[idx.approvedAt],
        assignDate: r[idx.assignDate],
        assignedAt: r[idx.assignedAt],
        staffNo: r[idx.staffNo],
        staffName: r[idx.staffName],
        floor: r[idx.floor],
        xhsAccount: r[idx.xhsAccount],
        title: r[idx.title],
        hashtags: r[idx.hashtags],
        content: r[idx.content],
        photoDirection: r[idx.photoDirection],
        photoInstruction: r[idx.photoInstruction],
        referenceImageFileId: r[idx.referenceImageFileId],
        referenceImageFileUrl: r[idx.referenceImageFileUrl]
      };
    });
}

function getStaffList_() {
  const ss = getWorkbook_();
  const sh = ss.getSheetByName(STAFF_SHEET);
  if (!sh) throw new Error("Missing sheet: " + STAFF_SHEET);

  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1)
    .map(function (r) {
      return {
        floor: String(r[0] || "").trim(),
        name: String(r[1] || "").trim(),
        staffNo: String(r[2] || "").trim(),
        xhsAccount: String(r[3] || "").trim()
      };
    })
    .filter(function (x) { return x.staffNo; });
}

function ensureAssignSheet_(ss) {
  let sh = ss.getSheetByName(ASSIGN_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ASSIGN_SHEET);
  }

  const headers = [
    "id",
    "topic",
    "topicDate",
    "generatedAt",
    "approvedAt",
    "assignDate",
    "assignedAt",
    "staffNo",
    "staffName",
    "floor",
    "xhsAccount",
    "title",
    "hashtags",
    "content",
    "photoDirection",
    "photoInstruction",
    "referenceImageFileId",
    "referenceImageFileUrl"
  ];

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const same = headers.every(function (h, i) { return String(existing[i] || "").trim() === h; });
    if (!same) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  }

  return sh;
}

function ensureStaffSheet_(ss) {
  let sh = ss.getSheetByName(STAFF_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STAFF_SHEET);
  }

  const headers = ["FLOOR", "NAME", "Staff No.", "XHS account name"];
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const same = headers.every(function (h, i) { return String(existing[i] || "").trim() === h; });
    if (!same) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  }

  return sh;
}

function ensureGeneratedSheet_(ss) {
  let sh = ss.getSheetByName(GENERATED_SHEET);
  if (!sh) {
    sh = ss.insertSheet(GENERATED_SHEET);
  }
  const headers = [
    "id",
    "topic",
    "topicDate",
    "generatedAt",
    "title",
    "hashtags",
    "content",
    "photoDirection",
    "photoInstruction",
    "referenceImageFileId",
    "referenceImageFileUrl"
  ];
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    const same = headers.every(function (h, i) { return String(existing[i] || "").trim() === h; });
    if (!same) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function toAssignRow_(x) {
  return [
    x.id,
    x.topic,
    x.topicDate,
    x.generatedAt,
    x.approvedAt,
    x.assignDate,
    x.assignedAt,
    x.staffNo,
    x.staffName,
    x.floor,
    x.xhsAccount,
    x.title,
    x.hashtags,
    x.content,
    x.photoDirection || "",
    x.photoInstruction || "",
    x.referenceImageFileId || "",
    x.referenceImageFileUrl || ""
  ];
}

function indexMap_(header) {
  const map = {};
  header.forEach(function (h, i) { map[String(h)] = i; });
  // Backward compatibility for old typo column names.
  if (map.referenceImageFileId === undefined && map.referenceImageFieldId !== undefined) {
    map.referenceImageFileId = map.referenceImageFieldId;
  }
  if (map.referenceImageFileUrl === undefined && map.referenceImageFieldUrl !== undefined) {
    map.referenceImageFileUrl = map.referenceImageFieldUrl;
  }
  return map;
}

function isoNow_() {
  return new Date().toISOString();
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTopicProgress_() {
  const ss = getWorkbook_();
  const generatedSheet = ensureGeneratedSheet_(ss);
  const assignSheet = ensureAssignSheet_(ss);
  const staffCount = getStaffList_().length;

  const generatedValues = generatedSheet.getDataRange().getValues();
  const assignValues = assignSheet.getDataRange().getValues();
  const map = {};

  if (generatedValues.length > 1) {
    const h = indexMap_(generatedValues[0]);
    generatedValues.slice(1).forEach(function (r) {
      const topic = String(r[h.topic] || "").trim();
      if (!topic) return;
      if (!map[topic]) map[topic] = { generated: 0, approved: 0, assigned: 0, missing: 0 };
      map[topic].generated += 1;
    });
  }

  if (assignValues.length > 1) {
    const h = indexMap_(assignValues[0]);
    assignValues.slice(1).forEach(function (r) {
      const topic = String(r[h.topic] || "").trim();
      if (!topic) return;
      if (!map[topic]) map[topic] = { generated: 0, approved: 0, assigned: 0, missing: 0 };
      map[topic].approved += 1;
      if (String(r[h.staffNo] || "").trim()) map[topic].assigned += 1;
    });
  }

  Object.keys(map).forEach(function (k) {
    map[k].missing = Math.max(0, staffCount - map[k].assigned);
  });
  return map;
}

function findGeneratedById_(id) {
  const ss = getWorkbook_();
  const generatedSheet = ensureGeneratedSheet_(ss);
  const values = generatedSheet.getDataRange().getValues();
  if (values.length <= 1) return null;
  const h = indexMap_(values[0]);
  for (let i = 1; i < values.length; i += 1) {
    const r = values[i];
    if (String(r[h.id] || "").trim() === id) {
      return {
        id: String(r[h.id] || ""),
        topic: String(r[h.topic] || ""),
        topicDate: String(r[h.topicDate] || ""),
        generatedAt: String(r[h.generatedAt] || ""),
        title: String(r[h.title] || ""),
        hashtags: String(r[h.hashtags] || ""),
        content: String(r[h.content] || ""),
        photoDirection: String(r[h.photoDirection] || ""),
        photoInstruction: String(r[h.photoInstruction] || ""),
        referenceImageFileId: String(r[h.referenceImageFileId] || ""),
        referenceImageFileUrl: String(r[h.referenceImageFileUrl] || "")
      };
    }
  }
  return null;
}

function saveReferenceImageToDrive_(fileName, dataUrl) {
  if (!dataUrl) return { fileId: "", fileUrl: "", error: "" };
  try {
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex < 0) return { fileId: "", fileUrl: "", error: "Invalid data URL." };
    const meta = dataUrl.substring(0, commaIndex);
    const b64 = dataUrl.substring(commaIndex + 1);
    const mimeMatch = meta.match(/^data:(.*?);base64$/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const bytes = Utilities.base64Decode(b64);
    const safeName = fileName || ("reference_" + Date.now() + ".png");
    const blob = Utilities.newBlob(bytes, mimeType, safeName);
    let file = null;
    try {
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      file = folder.createFile(blob);
    } catch (folderErr) {
      // Fallback: still save file to root drive to avoid losing image assignment.
      file = DriveApp.createFile(blob);
    }
    if (!file) return { fileId: "", fileUrl: "", error: "Drive file object was not created." };
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (shareErr) {
      // Keep file even if public sharing cannot be changed in current domain policy.
    }
    return { fileId: file.getId(), fileUrl: file.getUrl(), error: "" };
  } catch (err) {
    return { fileId: "", fileUrl: "", error: err.message || String(err) };
  }
}
