/**
 * Redbook Content Backend (Google Apps Script)
 * Sheet tabs expected:
 * 1) "staff list"   columns: A FLOOR | B NAME | C Staff No. | D XHS account name
 * 2) "assignments"  (auto-created if missing)
 */

const STAFF_SHEET = "staff list";
const ASSIGN_SHEET = "assignments";
const GENERATED_SHEET = "generated";
const TZ = Session.getScriptTimeZone() || "Asia/Hong_Kong";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Redbook Setup")
    .addItem("Create Required Tabs", "setupRedbookSheets")
    .addToUi();
}

function setupRedbookSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureStaffSheet_(ss);
  ensureGeneratedSheet_(ss);
  ensureAssignSheet_(ss);
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

  if (action === "approveAssignOne") {
    const topic = String(e.parameter.topic || "").trim();
    const topicDate = String(e.parameter.topicDate || "").trim();
    const assignDate = String(e.parameter.assignDate || "").trim();
    const id = String(e.parameter.id || "").trim();
    const title = String(e.parameter.title || "").trim();
    const hashtags = String(e.parameter.hashtags || "").trim();
    const content = String(e.parameter.content || "").trim();
    const generatedAt = String(e.parameter.generatedAt || "").trim();
    const approvedAt = String(e.parameter.approvedAt || "").trim();
    const assignedTo = String(e.parameter.assignedTo || "").trim();

    if (!topic || !topicDate || !id) {
      return jsonOut({ ok: false, error: "Missing topic/topicDate/id" });
    }

    const result = appendAssignedDirect_(topic, topicDate, assignDate, {
      id: id,
      title: title,
      hashtags: hashtags,
      content: content,
      generatedAt: generatedAt,
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

    return jsonOut({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message || String(err) });
  }
}

function approveAndAssign_(topic, topicDate, items, assignDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ensureGeneratedSheet_(ss);

  const rows = items.map(function (item, i) {
    return [
      item.id || ("generated_" + Date.now() + "_" + i),
      topic,
      topicDate,
      item.generatedAt || isoNow_(),
      item.title || "",
      item.hashtags || "",
      item.content || ""
    ];
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  }
  return { inserted: rows.length };
}

function appendAssignedDirect_(topic, topicDate, assignDate, item) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    item.content || ""
  ];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return { inserted: 1 };
}

function getAssignmentsByStaff_(staffNo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
        assignDate: r[idx.assignDate],
        staffNo: r[idx.staffNo],
        staffName: r[idx.staffName],
        title: r[idx.title],
        hashtags: r[idx.hashtags],
        content: r[idx.content]
      };
    });
}

function getStaffList_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
    "content"
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
  const headers = ["id", "topic", "topicDate", "generatedAt", "title", "hashtags", "content"];
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
    x.content
  ];
}

function indexMap_(header) {
  const map = {};
  header.forEach(function (h, i) { map[String(h)] = i; });
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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
