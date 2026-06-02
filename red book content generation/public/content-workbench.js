const form = document.querySelector("#generator-form");
const queueEl = document.querySelector("#queue");
const statusEl = document.querySelector("#status");
const topicSummaryEl = document.querySelector("#topicSummary");
const topicGapSummaryEl = document.querySelector("#topicGapSummary");
const downloadLogBtn = document.querySelector("#downloadLogBtn");
const syncApprovedBtn = document.querySelector("#syncApprovedBtn");
const appsScriptUrlInput = document.querySelector("#appsScriptUrl");
const providerSelect = document.querySelector("#provider");
const geminiKeyWrap = document.querySelector("#geminiKeyWrap");
const geminiModelWrap = document.querySelector("#geminiModelWrap");
const openrouterKeyWrap = document.querySelector("#openrouterKeyWrap");
const openrouterModelWrap = document.querySelector("#openrouterModelWrap");
const testConnectionBtn = document.querySelector("#testConnectionBtn");
const testUploadBtn = document.querySelector("#testUploadBtn");
const resetLocalBtn = document.querySelector("#resetLocalBtn");
const connectionStatusEl = document.querySelector("#connectionStatus");
const fallbackStaffListInput = document.querySelector("#fallbackStaffList");
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxm91pim17BsLNvVDlD5vESopFXxgrA3lZlhzhi3Fuc83HGrrL3uROi8qZEq6z_1y6M/exec";

const KEY = "redbook_content_bank_v1";
let memoryState = { queue: [], approved: [], generationLogs: [] };
let isGenerating = false;
let generatingCount = 0;
let cachedStaff = [];
let remoteTopicProgress = null;
let latestReferenceImage = null;

let state = loadState();
if (!state.appsScriptUrl) {
  state.appsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
}
const topicDateInput = document.querySelector("#topicDate");
if (topicDateInput && !topicDateInput.value) {
  topicDateInput.value = formatDateOnly(new Date());
}
appsScriptUrlInput.value = state.appsScriptUrl || "";
appsScriptUrlInput.addEventListener("change", () => {
  state.appsScriptUrl = appsScriptUrlInput.value.trim();
  persist();
});
fallbackStaffListInput.value = (state.fallbackStaffNumbers || []).join("\n");
fallbackStaffListInput.addEventListener("change", () => {
  state.fallbackStaffNumbers = parseFallbackStaff(fallbackStaffListInput.value);
  persist();
  render();
});

testConnectionBtn.addEventListener("click", async () => {
  const url = String(appsScriptUrlInput.value || "").trim();
  if (!url) {
    setStatus("請先輸入 Apps Script 網址。", true);
    if (connectionStatusEl) connectionStatusEl.textContent = "缺少網址";
    return;
  }
  state.appsScriptUrl = url;
  persist();

  testConnectionBtn.disabled = true;
  if (connectionStatusEl) {
    connectionStatusEl.textContent = "測試中...";
    connectionStatusEl.style.color = "";
  }
  try {
    const result = await testSheetConnection(url);
    setStatus(`已連線。可用員工資料：${result.staffCount}。`);
    if (connectionStatusEl) {
      connectionStatusEl.textContent = `已連線（${result.staffCount} 位員工）`;
      connectionStatusEl.style.color = "#0f766e";
    }
  } catch (error) {
    setStatus(`連線測試失敗：${error.message}`, true);
    if (connectionStatusEl) {
      connectionStatusEl.textContent = `失敗：${error.message}`;
      connectionStatusEl.style.color = "#b53d1c";
    }
  } finally {
    testConnectionBtn.disabled = false;
  }
});

testUploadBtn?.addEventListener("click", async () => {
  const url = String(appsScriptUrlInput.value || state.appsScriptUrl || "").trim();
  if (!url) {
    setStatus("請先輸入 Apps Script 網址。", true);
    if (connectionStatusEl) {
      connectionStatusEl.textContent = "缺少 Apps Script 網址";
      connectionStatusEl.style.color = "#b53d1c";
    }
    return;
  }
  state.appsScriptUrl = url;
  persist();
  testUploadBtn.disabled = true;
  const originalText = testUploadBtn.textContent;
  testUploadBtn.textContent = "測試中...";
  setStatus("正在測試 Drive 圖片上傳...");
  if (connectionStatusEl) {
    connectionStatusEl.textContent = "正在測試圖片上傳...";
    connectionStatusEl.style.color = "";
  }
  try {
    const data = await fetchJsonWithAction(url, "testDriveUpload");
    if (!data?.ok || !data.fileId) {
      throw new Error(data?.error || "Drive upload test failed.");
    }
    setStatus(`圖片上傳測試成功：${data.fileId}`);
    if (connectionStatusEl) {
      connectionStatusEl.textContent = `圖片上傳成功：${data.fileId}`;
      connectionStatusEl.style.color = "#0f766e";
    }
  } catch (error) {
    setStatus(`圖片上傳測試失敗：${error.message}`, true);
    if (connectionStatusEl) {
      connectionStatusEl.textContent = `圖片上傳失敗：${error.message}`;
      connectionStatusEl.style.color = "#b53d1c";
    }
  } finally {
    testUploadBtn.disabled = false;
    testUploadBtn.textContent = originalText || "測試圖片上傳";
  }
});

resetLocalBtn.addEventListener("click", () => {
  const keepUrl = state.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
  const keepFallback = state.fallbackStaffNumbers || [];
  state = {
    queue: [],
    approved: [],
    generationLogs: [],
    appsScriptUrl: keepUrl,
    fallbackStaffNumbers: keepFallback,
    assignmentCursor: {}
  };
  if (canUseLocalStorage()) {
    localStorage.removeItem(KEY);
  }
  persist();
  render();
  setStatus("已重設本機快取，面板已清空。");
});
render();
loadStaffForAutoAssign();
syncFromSheet();
setInterval(syncFromSheet, 20000);
updateProviderFieldVisibility();
providerSelect.addEventListener("change", updateProviderFieldVisibility);
document.querySelector("#referenceImage")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0] || null;
  latestReferenceImage = null;
  if (!file) return;
  try {
    latestReferenceImage = await fileToDataUrl(file);
    setStatus(`已準備指定圖片：${latestReferenceImage.name}`);
  } catch (error) {
    setStatus(`讀取指定圖片失敗：${error.message}`, true);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const topic = document.querySelector("#topic").value.trim();
  const topicDate = document.querySelector("#topicDate").value.trim();
  const provider = document.querySelector("#provider").value.trim() || "gemini";
  const apiKey = document.querySelector("#apiKey").value.trim();
  const openrouterKey = document.querySelector("#openrouterKey").value.trim();
  const openrouterModel = document.querySelector("#openrouterModel").value.trim() || "openrouter/auto";
  const model = document.querySelector("#model").value.trim() || "gemini-2.5-flash";
  const wordCount = document.querySelector("#wordCount").value.trim();
  const hashtags = document.querySelector("#hashtags").value.trim();
  const photoDirection = document.querySelector("#photoDirection").value.trim();
  const photoInstruction = document.querySelector("#photoInstruction").value.trim();
  const referenceImageFile = document.querySelector("#referenceImage").files?.[0] || null;
  const direction = document.querySelector("#direction").value.trim();
  const count = Number(document.querySelector("#count").value);

  if (!topic || !topicDate || !wordCount || !hashtags || !direction || !count) {
    setStatus("請填寫所有必填欄位。", true);
    return;
  }
  if (provider === "gemini" && !apiKey) {
    setStatus("請先貼上 Gemini API 金鑰再生成。", true);
    return;
  }
  if (provider === "openrouter" && !openrouterKey) {
    setStatus("請先貼上 OpenRouter API 金鑰再生成。", true);
    return;
  }
  let referenceImage = null;
  if (referenceImageFile) {
    referenceImage = latestReferenceImage?.name === referenceImageFile.name
      ? latestReferenceImage
      : await fileToDataUrl(referenceImageFile);
    latestReferenceImage = referenceImage;
  }

  setStatus("正在使用模型生成...");
  isGenerating = true;
  generatingCount = count;
  render();
  form.querySelector("button[type='submit']").disabled = true;
  try {
    const generated = await generateWithGeminiBatches({
      apiKey,
      openrouterKey,
      openrouterModel,
      provider,
      model,
      topic,
      topicDate,
      wordCount,
      hashtags,
      photoDirection,
      photoInstruction,
      referenceImage,
      direction,
      count
    });
    state.queue = generated;
    state.approved = [];
    state.generationLogs = state.generationLogs || [];
    persist();
    render();
    await autoSyncGenerated(generated);
    setStatus(`${generated.length} 個版本已生成，請逐一審批。`);
  } catch (error) {
    setStatus(`生成失敗（${error.message}）。`, true);
  } finally {
    isGenerating = false;
    generatingCount = 0;
    render();
    form.querySelector("button[type='submit']").disabled = false;
  }
});

async function generateWithGeminiBatches({ apiKey, openrouterKey, openrouterModel, provider, model, topic, topicDate, wordCount, hashtags, photoDirection, photoInstruction, referenceImage, direction, count }) {
  const batchSize = 20;
  const output = [];
  let cursor = 1;
  const modelChain = uniqueModels([model, "gemini-2.5-flash", "gemini-2.0-flash"]);

  while (output.length < count) {
    const take = Math.min(batchSize, count - output.length);
    setStatus(`Generating ${output.length + 1}-${output.length + take} of ${count}...`);
    const rawText = provider === "openrouter"
      ? await requestOpenRouter({
          apiKey: openrouterKey,
          model: openrouterModel,
          topic,
          wordCount,
          hashtags,
          direction,
          take
        })
      : (await requestGeminiWithFallback({
          apiKey,
          modelChain,
          topic,
          wordCount,
          hashtags,
          referenceImage,
          direction,
          take
        }))?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const parsed = JSON.parse(rawText);
    const items = (Array.isArray(parsed) ? parsed : []).map((item, i) => ({
      id: cryptoRandomId(),
      title: item.title || `${topic} - Version ${cursor + i}`,
      topic,
      topicDate: topicDate || formatDateOnly(new Date()),
      generatedAt: new Date().toISOString(),
      content: item.content || "",
      hashtags: item.hashtags || hashtags,
      photoDirection: photoDirection || "",
      photoInstruction: photoInstruction || "",
      referenceImageName: referenceImage?.name || "",
      referenceImageDataUrl: referenceImage?.dataUrl || "",
      assignedTo: ""
    }));
    cursor += items.length;
    output.push(...items);
  }

  return output.slice(0, count);
}

async function requestOpenRouter({ apiKey, model, topic, wordCount, hashtags, direction, take }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Return only valid JSON array." },
        { role: "user", content: buildGeminiPrompt({ topic, wordCount, hashtags, direction, count: take }) }
      ]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "OpenRouter request failed.");
  return data?.choices?.[0]?.message?.content || "[]";
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
  renderTopicSummary();
  renderTopicGapSummary();

  if (isGenerating) {
    queueEl.innerHTML = "";
    const placeholderCount = Math.min(generatingCount || 1, 6);
    for (let i = 1; i <= placeholderCount; i += 1) {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <h3>正在生成版本 ${i}...</h3>
        <p>AI 正在準備內容，完成後會自動更新。</p>
        <p><strong>狀態：</strong> 生成中...</p>
      `;
      queueEl.appendChild(card);
    }
    return;
  }

  if (!state.queue.length) {
    queueEl.innerHTML = "<p>目前審核佇列沒有內容。</p>";
  }

  state.queue.forEach((item) => queueEl.appendChild(cardForQueue(item)));
}

function cardForQueue(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `<h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
    <p><strong>Hashtags:</strong> ${escapeHtml(item.hashtags)}</p>`;

  const row = document.createElement("div");
  row.className = "row";
  const approve = button("審批", async () => {
    const activeFile = document.querySelector("#referenceImage")?.files?.[0] || null;
    if (item.referenceImageName && !item.referenceImageDataUrl && activeFile) {
      try {
        const reread = latestReferenceImage?.name === activeFile.name ? latestReferenceImage : await fileToDataUrl(activeFile);
        item.referenceImageName = item.referenceImageName || reread.name;
        item.referenceImageDataUrl = reread.dataUrl;
        latestReferenceImage = reread;
      } catch (error) {
        setStatus(`審批前讀取指定圖片失敗：${error.message}`, true);
        return;
      }
    }
    if (item.referenceImageName && !item.referenceImageDataUrl) {
      setStatus("指定圖片資料已遺失，請重新選擇圖片後再審批。", true);
      return;
    }
    autoAssign審批dItem(item);
    state.queue = state.queue.filter((x) => x.id !== item.id);
    item.approvedAt = new Date().toISOString();
    state.approved.push(item);
    upsertLog(item);
    persist();
    render();
    if (state.appsScriptUrl && item.assignedTo) {
      try {
        if (item.referenceImageDataUrl) {
          await syncApprovedOneWithImage(item);
        } else {
          await sync審批dOneReliable(item);
        }
        item.syncedAt = new Date().toISOString();
        upsertLog(item);
        persist();
      } catch (error) {
        setStatus(`審批d locally, but sheet assignment sync failed: ${error.message}`, true);
      }
    }
  });
  const reject = button("退回", () => {
    state.queue = state.queue.filter((x) => x.id !== item.id);
    persist();
    render();
  }, true);
  row.append(approve, reject);
  card.appendChild(row);
  return card;
}

async function syncApprovedOneWithImage(item) {
  await postToAppsScript({
    action: "approveAssignOneWithImage",
    id: item.id || "",
    topic: item.topic || "",
    topicDate: item.topicDate || formatDateOnly(new Date()),
    assignDate: item.assignedDate || formatDateOnly(new Date()),
    generatedAt: item.generatedAt || "",
    approvedAt: item.approvedAt || "",
    assignedTo: item.assignedTo || "",
    title: item.title || "",
    hashtags: item.hashtags || "",
    content: item.content || "",
    photoDirection: item.photoDirection || "",
    photoInstruction: item.photoInstruction || "",
    referenceImageName: item.referenceImageName || "",
    referenceImageDataUrl: item.referenceImageDataUrl || ""
  });
}

function autoAssign審批dItem(item) {
  const assignPool = cachedStaff.length ? cachedStaff : (state.fallbackStaffNumbers || []).map((x) => ({ staffNo: x }));
  if (!assignPool.length) return;
  const key = `${item.topic || item.title || "Untitled"}`;
  state.assignmentCursor = state.assignmentCursor || {};
  const idx = Number(state.assignmentCursor[key] || 0);
  const staff = assignPool[idx % assignPool.length];
  item.assignedTo = staff.staffNo;
  item.assignedDate = item.topicDate || formatDateOnly(new Date());
  item.assignedAt = new Date().toISOString();
  state.assignmentCursor[key] = idx + 1;
}

function renderTopicSummary() {
  topicSummaryEl.innerHTML = "";
  const grouped = remoteTopicProgress || groupByTopicDate();
  const entries = Object.entries(grouped);
  if (!entries.length) {
    topicSummaryEl.innerHTML = "<p>尚未生成任何主題。</p>";
    return;
  }
  for (const [key, stats] of entries) {
    const card = document.createElement("article");
    card.className = "kpi-card";
    card.innerHTML = `
      <p class="kpi-title">${escapeHtml(key)}</p>
      <p class="kpi-row">已生成： ${stats.generated}</p>
      <p class="kpi-row">審批d: ${stats.approved}</p>
      <p class="kpi-row">已分配： ${stats.assigned}</p>
      <p class="kpi-row">尚未分配治療師： ${stats.missing}</p>
    `;
    topicSummaryEl.appendChild(card);
  }
}

function groupByTopicDate() {
  const map = {};
  const add = (item, kind) => {
    const topic = item.topic || item.title || "Untitled";
    const key = topic;
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
    const staffCount = cachedStaff.length || (state.fallbackStaffNumbers || []).length;
    map[key].missing = Math.max(0, staffCount - map[key].assigned);
  });
  return map;
}

function renderTopicGapSummary() {
  if (!topicGapSummaryEl) return;
  const grouped = remoteTopicProgress || groupByTopicDate();
  const entries = Object.entries(grouped);
  if (!entries.length) {
    topicGapSummaryEl.innerHTML = "";
    return;
  }
  topicGapSummaryEl.innerHTML = entries
    .map(([key, stats]) => `<p class="kpi-row"><strong>${escapeHtml(key)}</strong>: ${stats.missing} 位治療師尚未分配</p>`)
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
    referenceImageName: item.referenceImageName || "",
    referenceImageDataUrl: item.referenceImageDataUrl || "",
    content: item.content || ""
  };
  if (idx >= 0) state.generationLogs[idx] = row;
  else state.generationLogs.push(row);
}

downloadLogBtn.addEventListener("click", () => {
  const rows = state.generationLogs || [];
  if (!rows.length) {
    setStatus("No logs yet. 審批 at least one item first.", true);
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

syncApprovedBtn?.addEventListener("click", async () => {
  if (!state.appsScriptUrl) {
    setStatus("請先輸入 Apps Script 網址。", true);
    return;
  }
  const items = (state.approved || []).filter((x) => x.approvedAt);
  if (!items.length) {
    setStatus("目前沒有可同步的已審批內容。", true);
    return;
  }
  try {
    await postToAppsScript({
      action: "appendApprovedOnly",
      topic: items[0]?.topic || "",
      topicDate: items[0]?.topicDate || formatDateOnly(new Date()),
      items
    });
    setStatus(`已同步 ${items.length} 筆已審批內容到試算表。`);
  } catch (error) {
    setStatus(`同步失敗：${error.message}`, true);
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
  const safeState = buildStorageSafeState(state);
  if (!canUseLocalStorage()) {
    memoryState = structuredCloneSafe(safeState);
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(safeState));
  } catch (error) {
    memoryState = structuredCloneSafe(safeState);
    setStatus("本機快取已達上限，已改用暫存記憶體（重整頁面後不保留）。", true);
  }
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
      appsScriptUrl: parsed.appsScriptUrl || "",
      fallbackStaffNumbers: parsed.fallbackStaffNumbers || []
    };
  } catch {
    return { queue: [], approved: [], generationLogs: [], appsScriptUrl: "", fallbackStaffNumbers: [] };
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

function buildStorageSafeState(source) {
  const cleanItem = (item) => ({
    ...item,
    referenceImageDataUrl: ""
  });
  return {
    ...source,
    queue: Array.isArray(source.queue) ? source.queue.map(cleanItem) : [],
    approved: Array.isArray(source.approved) ? source.approved.map(cleanItem) : [],
    generationLogs: Array.isArray(source.generationLogs)
      ? source.generationLogs.map((x) => ({ ...x, referenceImageDataUrl: "" }))
      : []
  };
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

function fileToDataUrl(file) {
  if (file?.type?.startsWith("image/")) {
    return compressImageToDataUrl(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name || "reference-image", dataUrl: String(reader.result || "") });
    reader.onerror = () => reject(new Error("Image read failed."));
    reader.readAsDataURL(file);
  });
}

function compressImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const outputName = file.name ? file.name.replace(/\.[^.]+$/, ".jpg") : "reference-image.jpg";
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Image compression failed."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve({ name: outputName, dataUrl: String(reader.result || "") });
          reader.onerror = () => reject(new Error("Compressed image read failed."));
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.86);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image preview failed."));
    };
    img.src = objectUrl;
  });
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

async function sync審批dOneReliable(item) {
  const base = String(state.appsScriptUrl || "").trim();
  if (!base) throw new Error("Missing Apps Script URL.");
  const params = new URLSearchParams({
    action: "approveAssignOne",
    id: item.id || "",
    topic: item.topic || "",
    topicDate: item.topicDate || formatDateOnly(new Date()),
    assignDate: item.assignedDate || formatDateOnly(new Date()),
    generatedAt: item.generatedAt || "",
    approvedAt: item.approvedAt || "",
    assignedTo: item.assignedTo || ""
  });
  const url = base.includes("?") ? `${base}&${params.toString()}` : `${base}?${params.toString()}`;
  const response = await fetch(url, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Failed to save approved item to sheet.");
  }
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
    if (connectionStatusEl) {
      connectionStatusEl.textContent = "無法讀取試算表員工名單，改用備援名單。";
      connectionStatusEl.style.color = "#b45309";
    }
  }
}

async function syncFromSheet() {
  const url = String(state.appsScriptUrl || "").trim();
  if (!url) return;
  try {
    const data = await fetchJsonWithAction(url, "topicProgress");
    if (data?.ok && data.topics && typeof data.topics === "object") {
      remoteTopicProgress = data.topics;
      render();
    }
  } catch {
    // Keep local view when remote sync is unavailable.
  }
}

async function fetchJsonWithAction(baseUrl, action) {
  const url = baseUrl.includes("?") ? `${baseUrl}&action=${encodeURIComponent(action)}` : `${baseUrl}?action=${encodeURIComponent(action)}`;
  const response = await fetch(url, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Request failed");
  return data;
}

function parseFallbackStaff(text) {
  return String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function updateProviderFieldVisibility() {
  const provider = providerSelect?.value || "gemini";
  const showGemini = provider === "gemini";
  if (geminiKeyWrap) geminiKeyWrap.style.display = showGemini ? "" : "none";
  if (geminiModelWrap) geminiModelWrap.style.display = showGemini ? "" : "none";
  if (openrouterKeyWrap) openrouterKeyWrap.style.display = showGemini ? "none" : "";
  if (openrouterModelWrap) openrouterModelWrap.style.display = showGemini ? "none" : "";
}

async function autoSyncGenerated(items) {
  if (!state.appsScriptUrl || !Array.isArray(items) || !items.length) return;
  try {
    const compactItems = items.map((item, index) => ({
      ...item,
      referenceImageDataUrl: index === 0 ? (item.referenceImageDataUrl || "") : ""
    }));
    await postToAppsScript({
      action: "appendGeneratedOnly",
      topic: items[0]?.topic || document.querySelector("#topic").value.trim() || "",
      topicDate: items[0]?.topicDate || formatDateOnly(new Date()),
      items: compactItems
    });
  } catch (error) {
    setStatus(`本地已生成，但同步到 generated 分頁失敗：${error.message}`, true);
  }
}
