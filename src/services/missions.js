import { APPS_SCRIPT_API_URL, SOURCE_SHEET, SPREADSHEET_ID } from "../config.js";
import { mockMissions } from "../data/mockData.js";

const defaultProgress = {
  "Reach 30 cutomer base": { progressCurrent: 18, progressTarget: 30 },
  "Reach 30 Customer Base": { progressCurrent: 18, progressTarget: 30 },
  "Customer Activation": { progressCurrent: 6, progressTarget: 10 },
  "Redeemed Wellcome Product Pack": { progressCurrent: 6, progressTarget: 10 },
  "Paid Trial Purchase": { progressCurrent: 10, progressTarget: 10 },
  "Head Paid Trial Purchase": { progressCurrent: 10, progressTarget: 10 },
  Referral: { progressCurrent: 2, progressTarget: 5 },
  "Gift Card Referral": { progressCurrent: 1, progressTarget: 4 },
  "Tail Giftcard Book": { progressCurrent: 1, progressTarget: 4 },
  "WeBuy Referral": { progressCurrent: 0, progressTarget: 3 },
  "ＷeBuy Paid Trial Purchase": { progressCurrent: 0, progressTarget: 3 },
  "Livestream Participation": { progressCurrent: 3, progressTarget: 4 },
  "ACB View Livestream": { progressCurrent: 3, progressTarget: 4 },
  "ICB View Livestream": { progressCurrent: 2, progressTarget: 4 },
  "Candidate Interview": { progressCurrent: 4, progressTarget: 6 },
  "Offer Accepted": { progressCurrent: 2, progressTarget: 3 },
  "Referee accepted offer 龍頭": { progressCurrent: 2, progressTarget: 3 },
  "Referee accepted offer (refer by NJ) 龍尾": { progressCurrent: 1, progressTarget: 3 },
  "Training Completed": { progressCurrent: 1, progressTarget: 2 },
  "Referee Onboarded with contract Signed": { progressCurrent: 1, progressTarget: 2 },
  "First Customer Served": { progressCurrent: 1, progressTarget: 1 },
  "Referee onsales": { progressCurrent: 1, progressTarget: 1 },
  "Team Expansion": { progressCurrent: 0, progressTarget: 2 },
  "3X Referee onsales": { progressCurrent: 0, progressTarget: 3 },
  "5X Referee onsales": { progressCurrent: 0, progressTarget: 5 },
  "Recruitment Network Bonus": { progressCurrent: 3, progressTarget: 5 }
};

const groupByType = {
  Customer: "客戶 Fibonacci",
  Recruitment: "治療師招聘 Fibonacci"
};

function normalizeMission(mission, index) {
  const sheetMission = Array.isArray(mission)
    ? {
        Type: mission[0],
        "Mission Type": mission[1],
        "Mission Detail": mission[2],
        "System Display Name": mission[3],
        "System Display Detail": mission[4],
        "Regular Quantum Points": mission[5]
      }
    : mission;
  const name =
    sheetMission["System Display Name"] ||
    sheetMission["Mission Detail"] ||
    sheetMission["Mission Type"] ||
    `Mission ${index + 1}`;
  const rawDetail = sheetMission["Mission Detail"] || name;
  const displayDetail =
    sheetMission["System Display Detail"] ||
    sheetMission["Bonus mechanics"] ||
    rawDetail;
  const progress = defaultProgress[name] || {
    progressCurrent: sheetMission.progressCurrent ?? 0,
    progressTarget: sheetMission.progressTarget ?? 1
  };
  const type = sheetMission.Type || sheetMission.Group;
  const group = groupByType[type] || sheetMission.Group || "客戶 Fibonacci";
  const category = sheetMission["Mission Type"] || sheetMission.Category || "General";

  return {
    ...sheetMission,
    "Mission Type": sheetMission["Mission Type"] || name,
    "Mission Detail": rawDetail,
    "System Display Name": name,
    "System Display Detail": displayDetail,
    "Bonus mechanics": displayDetail,
    "Regular Quantum Points": Number(sheetMission["Regular Quantum Points"] || sheetMission.BP || sheetMission.F || 0),
    Group: group,
    Category: category,
    "New Joiner Only": Boolean(sheetMission["New Joiner Only"] || /reach 30/i.test(`${name} ${displayDetail}`)),
    status: sheetMission.status || sheetMission.Status || "In Progress",
    progressCurrent: Number(progress.progressCurrent),
    progressTarget: Number(progress.progressTarget)
  };
}

export async function fetchMissions() {
  if (!APPS_SCRIPT_API_URL) {
    return {
      missions: mockMissions,
      source: "mock",
      message: "尚未設定 Apps Script URL，現正顯示示範任務資料。"
    };
  }

  try {
    const url = new URL(APPS_SCRIPT_API_URL);
    url.searchParams.set("spreadsheetId", SPREADSHEET_ID);
    url.searchParams.set("sheet", SOURCE_SHEET);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const missionRows = rows.filter((row) => {
      const displayName = Array.isArray(row) ? row[3] : row["System Display Name"] || row["Mission Detail"];
      return displayName && displayName !== "System Display Name";
    });

    if (!payload.success || missionRows.length === 0) {
      return {
        missions: mockMissions,
        source: "mock",
        message: `${SOURCE_SHEET} 未有資料，現正顯示示範任務資料。`
      };
    }

    return {
      missions: missionRows.map(normalizeMission),
      source: "api",
      message: `已從 ${payload.sheet || SOURCE_SHEET} 載入 ${payload.count || missionRows.length} 個任務。`
    };
  } catch (error) {
    return {
      missions: mockMissions,
      source: "mock",
      message: `任務 API 讀取失敗，現正顯示示範資料。${error.message}`
    };
  }
}
