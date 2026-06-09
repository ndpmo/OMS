import { APPS_SCRIPT_API_URL, SPREADSHEET_ID } from "../config.js";
import { mockStaffRows } from "../data/mockData.js";

const RAW_DATA_SHEET = "RAW DATA";
const STAFF_NO_COLUMNS = ["staff no", "Staff No", "Therapist Staff No"];
const SYSTEM_COLUMNS = new Set(["Center", "Therapist", "staff no", "Staff No", "Therapist Staff No", "Reward point"]);

function normalizeStaff(row, index) {
  const raw = Array.isArray(row)
    ? {
        Center: row[0],
        Therapist: row[1],
        "staff no": row[2]
      }
    : row;

  const missionCounts = Object.entries(raw).reduce((counts, [key, value]) => {
    if (!SYSTEM_COLUMNS.has(key) && value !== "" && value !== null && value !== undefined) {
      counts[key] = value;
    }
    return counts;
  }, {});

  const staffNo = STAFF_NO_COLUMNS.map((column) => raw[column]).find((value) => value !== "" && value !== null && value !== undefined);
  const currentBP = Number(raw["Reward point"] || raw["Reward Point"] || 0);
  const completedMissions = Object.values(missionCounts).filter((value) => Number(value) > 0 || value === "Y").length;

  return {
    id: String(staffNo || "").trim(),
    name: raw.Therapist || `Therapist ${index + 1}`,
    role: "美容治療師",
    branch: raw.Center || "未設定中心",
    currentBP,
    lifetimeBP: currentBP,
    monthBP: currentBP,
    rank: index + 1,
    customerBase: { current: Number(raw["Reach 30 ACB"] || 0), target: 30 },
    referrals: Number(raw["Tail Giftcard Book"] || 0) + Number(raw["ＷeBuy Paid Trial Purchase"] || 0),
    recruitment:
      Number(raw["Referee accepted offer 龍頭"] || 0) +
      Number(raw["Referee accepted offer (refer by NJ) 龍尾"] || 0),
    completedMissions,
    missionCounts,
    raw
  };
}

export async function fetchStaffRows() {
  if (!APPS_SCRIPT_API_URL) {
    return {
      staff: addPointRanks(mockStaffRows.map(normalizeStaff)),
      source: "mock",
      message: "尚未設定 Apps Script URL，現正顯示示範員工資料。"
    };
  }

  try {
    const url = new URL(APPS_SCRIPT_API_URL);
    url.searchParams.set("spreadsheetId", SPREADSHEET_ID);
    url.searchParams.set("sheet", RAW_DATA_SHEET);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const staffRows = rows.filter((row) => {
      const staffNo = Array.isArray(row)
        ? row[2]
        : STAFF_NO_COLUMNS.map((column) => row[column]).find((value) => value !== "" && value !== null && value !== undefined);
      return staffNo !== "staff no" && staffNo !== null && staffNo !== undefined && String(staffNo).trim() !== "";
    });

    if (!payload.success || staffRows.length === 0) {
      return {
        staff: addPointRanks(mockStaffRows.map(normalizeStaff)),
        source: "mock",
        message: "RAW DATA 未有 staff no，現正顯示示範員工資料。"
      };
    }

    return {
      staff: addPointRanks(staffRows.map(normalizeStaff)),
      source: "api",
      message: `已從 RAW DATA 載入 ${staffRows.length} 位員工。`
    };
  } catch (error) {
    return {
      staff: addPointRanks(mockStaffRows.map(normalizeStaff)),
      source: "mock",
      message: `RAW DATA 讀取失敗，現正顯示示範員工資料。${error.message}`
    };
  }
}

function addPointRanks(staff) {
  const ranksById = new Map();

  [...staff]
    .sort((a, b) => b.currentBP - a.currentBP)
    .forEach((member, index) => {
      ranksById.set(member.id || member.name, index + 1);
    });

  return staff.map((member) => ({
    ...member,
    rank: ranksById.get(member.id || member.name) || staff.length
  }));
}
