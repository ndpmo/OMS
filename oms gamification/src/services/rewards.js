import { APPS_SCRIPT_API_URL, SPREADSHEET_ID } from "../config.js";
import { rewards as mockRewards } from "../data/mockData.js";

const REWARD_SHEET = "Reward List";
const gradients = ["pearl", "blush", "orchid", "sunrise", "champagne"];

function normalizeReward(row, index) {
  const raw = Array.isArray(row)
    ? {
        Type: row[0],
        "Reward Item Name": row[1],
        "Beauty Points": row[3]
      }
    : row;

  return {
    category: raw.Type || "其他",
    name: raw["Reward Item Name"] || raw["Gift Name"] || `Reward ${index + 1}`,
    cashValue: Number(raw["cash value"] || raw["Cash Value"] || 0),
    cost: Number(raw["Beauty Points"] || raw["BP"] || raw.D || 0),
    gradient: gradients[index % gradients.length],
    raw
  };
}

export async function fetchRewards() {
  if (!APPS_SCRIPT_API_URL) {
    return {
      rewards: mockRewards,
      source: "mock",
      message: "尚未設定 Apps Script URL，現正顯示示範獎賞資料。"
    };
  }

  try {
    const url = new URL(APPS_SCRIPT_API_URL);
    url.searchParams.set("spreadsheetId", SPREADSHEET_ID);
    url.searchParams.set("sheet", REWARD_SHEET);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const rewardRows = rows.filter((row) => {
      const name = Array.isArray(row) ? row[1] : row["Reward Item Name"] || row["Gift Name"];
      return name && name !== "Gift Name" && name !== "Reward Item Name";
    });

    if (!payload.success || rewardRows.length === 0) {
      return {
        rewards: mockRewards,
        source: "mock",
        message: "Reward List 未有資料，現正顯示示範獎賞資料。"
      };
    }

    return {
      rewards: rewardRows.map(normalizeReward),
      source: "api",
      message: `已從 Reward List 載入 ${rewardRows.length} 個獎賞。`
    };
  } catch (error) {
    return {
      rewards: mockRewards,
      source: "mock",
      message: `Reward List 讀取失敗，現正顯示示範獎賞資料。${error.message}`
    };
  }
}
