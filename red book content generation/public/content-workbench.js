const form = document.querySelector("#generator-form");
const queueEl = document.querySelector("#queue");
const approvedEl = document.querySelector("#approved");
const statusEl = document.querySelector("#status");
const assignBtn = document.querySelector("#assignBtn");
const topicSummaryEl = document.querySelector("#topicSummary");
const topicGapSummaryEl = document.querySelector("#topicGapSummary");
const downloadLogBtn = document.querySelector("#downloadLogBtn");
const syncApprovedBtn = document.querySelector("#syncApprovedBtn");
const appsScriptUrlInput = document.querySelector("#appsScriptUrl");
const testConnectionBtn = document.querySelector("#testConnectionBtn");
const connectionStatusEl = document.querySelector("#connectionStatus");
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxm91pim17BsLNvVDlD5vESopFXxgrA3lZlhzhi3Fuc83HGrrL3uROi8qZEq6z_1y6M/exec";

const KEY = "redbook_content_bank_v1";
let memoryState = { queue: [], approved: [], generationLogs: [] };
let isGenerating = false;
let generatingCount = 0;
let cachedStaff = [];

let state = loadState();
if (!state.appsScriptUrl) {
  state.appsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
}
appsScriptUrlInput.value = state.appsScriptUrl || "";
appsScriptUrlInput.addEventListener("change", () => {
  state.appsScriptUrl = appsScriptUrlInput.value.trim();
  persist();
});

testConnectionBtn.addEventListener("click", async () => {
  const url = String(appsScriptUrlInput.value || "").trim();
  if (!url) {
    setStatus("Please enter Apps Script Web App URL first.", true);
    if (connectionStatusEl) connectionStatusEl.textContent = "Missing URL";
    return;
  }
  state.appsScriptUrl = url;
  persist();

  testConnectionBtn.disabled = true;
  if (connectionStatusEl) {
    connectionStatusEl.textContent = "Testing...";
    connectionStatusEl.style.color = "";
  }
  try {
    const result = await testSheetConnection(url);
    setStatus(`Connected. Staff list rows available: ${result.staffCount}.`);
    if (connectionStatusEl) {
      connectionStatusEl.textContent = `Connected (${result.staffCount} staff)`;
      connectionStatusEl.style.color = "#0f766e";
    }
  } catch (error) {
    setStatus(`Connection test failed: ${error.message}`, true);
    if (connectionStatusEl) {
      connectionStatusEl.textContent = `Failed: ${error.message}`;
      connectionStatusEl.style.color = "#b53d1c";
    }
  } finally {
    testConnectionBtn.disabled = false;
  }
});
render();
loadStaffForAutoAssign();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const topic = document.querySelector("#topic").value.trim();
  const apiKey = document.querySelector("#apiKey").value.trim();
  const model = document.querySelector("#model").value.trim() || "gemini-2.5-flash";
  const wordCount = document.querySelector("#wordCount").value.trim();
  const hashtags = document.querySelector("#hashtags").value.trim();
  const direction = document.querySelector("#direction").value.trim();
  const count = Number(document.querySelector("#count").value);

  if (!topic || !wordCount || !hashtags || !direction || !count) {
    setStatus("Please fill all fields.", true);
    return;
  }

  setStatus("Generating with Gemini...");
  isGenerating = true;
  generatingCount = count;
  render();
  form.querySelector("button[type='submit']").disabled = true;
  try {
    const generated = await generateWithGeminiBatches({
      apiKey,
      model,
      topic,
      wordCount,
      hashtags,
      direction,
      count
    });
    state.queue = generated;
    state.approved = [];
    state.generationLogs = state.generationLogs || [];
    persist();
    render();
    await autoSyncGenerated(generated);
    setStatus(`${generated.length} versions generated. Review and approve individually.`);
  } catch (error) {
    setStatus(`Gemini failed (${error.message}). Using template fallback.`, true);
    const generated = Array.from({ length: count }, (_, i) =>
      buildVersion({ topic, wordCount, hashtags, direction, index: i + 1 })
    );
    state.queue = generated;
    state.approved = [];
    state.generationLogs = state.generationLogs || [];
    persist();
    render();
    await autoSyncGenerated(generated);
  } finally {
    isGenerating = false;
    generatingCount = 0;
    render();
    form.querySelector("button[type='submit']").disabled = false;
  }
});

async function generateWithGeminiBatches({ apiKey, model, topic, wordCount, hashtags, direction, count }) {
  if (!apiKey) {
    throw new Error("Please paste Gemini API key first.");
  }
  const batchSize = 20;
  const output = [];
  let cursor = 1;
  const modelChain = uniqueModels([model, "gemini-2.5-flash", "gemini-2.0-flash"]);

  while (output.length < count) {
    const take = Math.min(batchSize, count - output.length);
    setStatus(`Generating ${output.length + 1}-${output.length + take} of ${count}...`);
    const data = await requestGeminiWithFallback({
      apiKey,
      modelChain,
      topic,
      wordCount,
      hashtags,
      direction,
      take
    });
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const parsed = JSON.parse(rawText);
    const items = (Array.isArray(parsed) ? parsed : []).map((item, i) => ({
      id: cryptoRandomId(),
      title: item.title || `${topic} - Version ${cursor + i}`,
      content: item.content || "",
      hashtags: item.hashtags || hashtags,
      assignedTo: ""
    }));
    cursor += items.length;
    output.push(...items);
  }

  return output.slice(0, count);
}

async function requestGeminiWithFallback({ apiKey, modelChain, topic, wordCount, hashtags, direction, take }) {
  let lastError = "Failed to generate content.";
  for (let m = 0; m < modelChain.length; m += 1) {
    const activeModel = modelChain[m];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (attempt > 1) {
          await delay(attempt * 1200);
        }
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: buildGeminiPrompt({ topic, wordCount, hashtags, direction, count: take })
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });
        const data = await response.json();
        if (!response.ok) {
          lastError = data?.error?.message || "Failed to generate content.";
          if (isRetriableGeminiError(lastError) && attempt < 3) continue;
          if (isRetriableGeminiError(lastError)) break;
          throw new Error(lastError);
        }
        return data;
      } catch (error) {
        lastError = error.message || String(error);
        if (attempt < 3 && isRetriableGeminiError(lastError)) continue;
        break;
      }
    }
  }
  throw new Error(lastError);
}

function buildGeminiPrompt({ topic, wordCount, hashtags, direction, count }) {
  return [
    `Generate ${count} unique Xiaohongshu (Little Redbook) content versions.`,
    `Topic: ${topic}`,
    `Target word count per version: about ${wordCount} words`,
    `Hashtags to include or adapt: ${hashtags}`,
    `Direction: ${direction}`,
    "Return ONLY valid JSON array.",
    "Each item must include keys: title, content, hashtags."
  ].join("\\n");
}

function isRetriableGeminiError(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("high demand") ||
    text.includes("unavailable") ||
    text.includes("overloaded") ||
    text.includes("try again later") ||
    text.includes("rate limit") ||
    text.includes("429") ||
    text.includes("503")
  );
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uniqueModels(models) {
  return [...new Set(models.filter(Boolean))];
}

assignBtn.addEventListener("click", async () => {
  const staff = document.querySelector("#staffNumber").value.trim();
  const assignDate = document.querySelector("#assignDate").value || formatDateOnly(new Date());
  const n = Number(document.querySelector("#assignCount").value || 1);
  if (!staff) return setStatus("Enter staff number.", true);
  if (n < 1) return setStatus("Assign count must be at least 1.", true);

  const unassigned = state.approved.filter((item) => !item.assignedTo);
  if (!unassigned.length) return setStatus("No unassigned approved content.", true);

  const toAssign = unassigned.slice(0, n);
  toAssign.forEach((item) => {
    item.assignedTo = staff;
    item.assignedDate = assignDate;
    item.assignedAt = new Date().toISOString();
    upsertLog(item);
  });
  persist();
  render();
  setStatus(`Assigned ${toAssign.length} item(s) to staff ${staff} (${assignDate}).`);

  if (state.appsScriptUrl) {
    try {
      await postToAppsScript({
        action: "approveAndAssign",
        topic: toAssign[0]?.topic || "",
        topicDate: toAssign[0]?.topicDate || formatDateOnly(new Date()),
        assignDate,
        items: toAssign
      });
      setStatus(`Assigned ${toAssign.length} item(s) and synced to sheet.`);
    } catch (error) {
      setStatus(`Assigned locally, but sheet sync failed: ${error.message}`, true);
    }
  }
});

function buildVersion({ topic, wordCount, hashtags, direction, index }) {
  const now = new Date();
  const topicDate = formatDateOnly(now);
  return {
    id: cryptoRandomId(),
    title: `${topic} - Version ${index}`,
    topic,
    topicDate,
    generatedAt: now.toISOString(),
    content: `Hook: Share one strong observation about ${topic}.\n\nBody (${wordCount} words target): Use this direction -> ${direction}. Include practical steps, one personal perspective, and one result-focused close.\n\nCTA: Ask readers to comment or save for later.`,
    hashtags,
    assignedTo: ""
  };
}

function render() {
  queueEl.innerHTML = "";
  approvedEl.innerHTML = "";
  renderTopicSummary();
  renderTopicGapSummary();

  if (isGenerating) {
    queueEl.innerHTML = "";
    const placeholderCount = Math.min(generatingCount || 1, 6);
    for (let i = 1; i <= placeholderCount; i += 1) {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <h3>Generating Version ${i}...</h3>
        <p>AI is preparing content. This card will update automatically when ready.</p>
        <p><strong>Status:</strong> Generating...</p>
      `;
      queueEl.appendChild(card);
    }
    return;
  }

  if (!state.queue.length) {
    queueEl.innerHTML = "<p>No items in review queue yet.</p>";
  }

  state.queue.forEach((item) => queueEl.appendChild(cardForQueue(item)));
  if (!state.approved.length) {
    approvedEl.innerHTML = "<p>No approved items yet.</p>";
  }
  state.approved.forEach((item) => approvedEl.appendChild(cardForApproved(item)));
}

function cardForQueue(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `<h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
    <p><strong>Hashtags:</strong> ${escapeHtml(item.hashtags)}</p>`;

  const row = document.createElement("div");
  row.className = "row";
  const approve = button("Approve", () => {
    autoAssignApprovedItem(item);
    state.queue = state.queue.filter((x) => x.id !== item.id);
    item.approvedAt = new Date().toISOString();
    state.approved.push(item);
    upsertLog(item);
    persist();
    render();
  });
  const reject = button("Reject", () => {
    state.queue = state.queue.filter((x) => x.id !== item.id);
    persist();
    render();
  }, true);
  row.append(approve, reject);
  card.appendChild(row);
  return card;
}

function autoAssignApprovedItem(item) {
  if (!cachedStaff.length) return;
  const key = `${item.topic || item.title || "Untitled"}|${item.topicDate || formatDateOnly(new Date())}`;
  state.assignmentCursor = state.assignmentCursor || {};
  const idx = Number(state.assignmentCursor[key] || 0);
  const staff = cachedStaff[idx % cachedStaff.length];
  item.assignedTo = staff.staffNo;
  item.assignedDate = item.topicDate || formatDateOnly(new Date());
  item.assignedAt = new Date().toISOString();
  state.assignmentCursor[key] = idx + 1;
}

function cardForApproved(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `<h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
    <p><strong>Hashtags:</strong> ${escapeHtml(item.hashtags)}</p>
    <p><strong>Generated Date:</strong> ${escapeHtml(item.topicDate || "-")}</p>
    <p><strong>Assigned:</strong> ${item.assignedTo ? escapeHtml(item.assignedTo) : "Not assigned"}</p>
    <p><strong>Assigned Date:</strong> ${item.assignedDate ? escapeHtml(item.assignedDate) : "-"}</p>`;
  return card;
}

function renderTopicSummary() {
  topicSummaryEl.innerHTML = "";
  const grouped = groupByTopicDate();
  const entries = Object.entries(grouped);
  if (!entries.length) {
    topicSummaryEl.innerHTML = "<p>No topic generated yet.</p>";
    return;
  }
  for (const [key, stats] of entries) {
    const card = document.createElement("article");
    card.className = "kpi-card";
    card.innerHTML = `
      <p class="kpi-title">${escapeHtml(key)}</p>
      <p class="kpi-row">Generated: ${stats.generated}</p>
      <p class="kpi-row">Approved: ${stats.approved}</p>
      <p class="kpi-row">Assigned: ${stats.assigned}</p>
      <p class="kpi-row">Missing Therapist Assignments: ${stats.missing}</p>
    `;
    topicSummaryEl.appendChild(card);
  }
}

function groupByTopicDate() {
  const map = {};
  const add = (item, kind) => {
    const topic = item.topic || item.title || "Untitled";
    const date = item.topicDate || formatDateOnly(new Date(item.generatedAt || Date.now()));
    const key = `${topic} | ${date}`;
    if (!map[key]) map[key] = { generated: 0, approved: 0, assigned: 0, missing: 0 };
    if (kind === "generated") map[key].generated += 1;
    if (kind === "approved") map[key].approved += 1;
    if (kind === "assigned") map[key].assigned += 1;
  };
  state.queue.forEach((item) => add(item, "generated"));
  state.approved.forEach((item) => {
    add(item, "generated");
    add(item, "approved");
    if (item.assignedTo) add(item, "assigned");
  });
  Object.keys(map).forEach((key) => {
    map[key].missing = Math.max(0, cachedStaff.length - map[key].assigned);
  });
  return map;
}

function renderTopicGapSummary() {
  if (!topicGapSummaryEl) return;
  const grouped = groupByTopicDate();
  const entries = Object.entries(grouped);
  if (!entries.length) {
    topicGapSummaryEl.innerHTML = "";
    return;
  }
  topicGapSummaryEl.innerHTML = entries
    .map(([key, stats]) => `<p class="kpi-row"><strong>${escapeHtml(key)}</strong>: ${stats.missing} therapist(s) still missing assignment</p>`)
    .join("");
}

function upsertLog(item) {
  state.generationLogs = state.generationLogs || [];
  const idx = state.generationLogs.findIndex((x) => x.id === item.id);
  const row = {
    id: item.id,
    title: item.title || "",
    topic: item.topic || "",
    topicDate: item.topicDate || "",
    generatedAt: item.generatedAt || "",
    approvedAt: item.approvedAt || "",
    assignedTo: item.assignedTo || "",
    assignedDate: item.assignedDate || "",
    assignedAt: item.assignedAt || "",
    hashtags: item.hashtags || "",
    content: item.content || ""
  };
  if (idx >= 0) state.generationLogs[idx] = row;
  else state.generationLogs.push(row);
}

downloadLogBtn.addEventListener("click", () => {
  const rows = state.generationLogs || [];
  if (!rows.length) {
    setStatus("No logs yet. Approve at least one item first.", true);
    return;
  }
  const headers = [
    "id",
    "title",
    "topic",
    "topicDate",
    "generatedAt",
    "approvedAt",
    "assignedTo",
    "assignedDate",
    "assignedAt",
    "hashtags",
    "content"
  ];
  const csv = [headers.join(",")]
    .concat(rows.map((row) => headers.map((h) => csvCell(row[h] || "")).join(",")))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `redbook_content_log_${formatDateOnly(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

syncApprovedBtn.addEventListener("click", async () => {
  if (!state.appsScriptUrl) {
    setStatus("Please enter Apps Script Web App URL first.", true);
    return;
  }
  const items = (state.approved || []).filter((x) => x.approvedAt);
  if (!items.length) {
    setStatus("No approved items to sync.", true);
    return;
  }
  try {
    await postToAppsScript({
      action: "appendApprovedOnly",
      topic: items[0]?.topic || "",
      topicDate: items[0]?.topicDate || formatDateOnly(new Date()),
      items
    });
    setStatus(`Synced ${items.length} approved item(s) to sheet.`);
  } catch (error) {
    setStatus(`Sync failed: ${error.message}`, true);
  }
});

function button(label, onClick, ghost = false) {
  const b = document.createElement("button");
  b.type = "button";
  if (ghost) b.className = "ghost";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function persist() {
  if (!canUseLocalStorage()) {
    memoryState = structuredCloneSafe(state);
    return;
  }
  localStorage.setItem(KEY, JSON.stringify(state));
}

function loadState() {
  if (!canUseLocalStorage()) {
    return structuredCloneSafe(memoryState);
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { queue: [], approved: [], generationLogs: [] };
    const parsed = JSON.parse(raw);
    return {
      queue: parsed.queue || [],
      approved: parsed.approved || [],
      generationLogs: parsed.generationLogs || [],
      appsScriptUrl: parsed.appsScriptUrl || ""
    };
  } catch {
    return { queue: [], approved: [], generationLogs: [], appsScriptUrl: "" };
  }
}

function canUseLocalStorage() {
  try {
    const testKey = "__rb_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#b53d1c" : "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function formatDateOnly(value) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function csvCell(value) {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

async function postToAppsScript(payload) {
  const url = String(state.appsScriptUrl || "").trim();
  if (!url) throw new Error("Missing Apps Script URL.");
  const response = await fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  // In no-cors mode the browser returns an opaque response; we cannot read body/status.
  // If fetch resolves, we treat it as sent.
  return { ok: true, opaque: response.type === "opaque" };
}

async function testSheetConnection(baseUrl) {
  const clean = String(baseUrl || "").trim();
  const url = clean.includes("?") ? `${clean}&action=staff` : `${clean}?action=staff`;
  const response = await fetch(url, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Apps Script endpoint not reachable.");
  }
  const staff = Array.isArray(data.staff) ? data.staff : [];
  return { staffCount: staff.length, staff };
}

async function loadStaffForAutoAssign() {
  const url = String(state.appsScriptUrl || "").trim();
  if (!url) return;
  try {
    const result = await testSheetConnection(url);
    cachedStaff = result.staff || [];
    render();
  } catch {
    cachedStaff = [];
  }
}

async function autoSyncGenerated(items) {
  if (!state.appsScriptUrl || !Array.isArray(items) || !items.length) return;
  try {
    await postToAppsScript({
      action: "appendGeneratedOnly",
      topic: items[0]?.topic || document.querySelector("#topic").value.trim() || "",
      topicDate: items[0]?.topicDate || formatDateOnly(new Date()),
      items
    });
  } catch (error) {
    setStatus(`Generated locally, but generated-tab sync failed: ${error.message}`, true);
  }
}
