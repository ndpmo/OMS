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
const saveDraftBtn = document.querySelector("#saveDraftBtn");
const loadDraftBtn = document.querySelector("#loadDraftBtn");
const clearDraftBtn = document.querySelector("#clearDraftBtn");
const resetLocalBtn = document.querySelector("#resetLocalBtn");
const connectionStatusEl = document.querySelector("#connectionStatus");
const fallbackStaffListInput = document.querySelector("#fallbackStaffList");
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxm91pim17BsLNvVDlD5vESopFXxgrA3lZlhzhi3Fuc83HGrrL3uROi8qZEq6z_1y6M/exec";

const KEY = "redbook_content_bank_v1";
const DRAFT_KEY = "redbook_manager_input_draft_v1";
const WINDOW_DRAFT_KEY = "__redbookManagerDraft";
let memoryState = { queue: [], approved: [], generationLogs: [] };
let isGenerating = false;
let generatingCount = 0;
let cachedStaff = [];
let remoteTopicProgress = null;
let latestReferenceImages = [];

let state = loadState();
if (!state.appsScriptUrl) {
  state.appsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
}
const topicDateInput = document.querySelector("#topicDate");
if (topicDateInput && !topicDateInput.value) {
  topicDateInput.value = formatDateOnly(new Date());
}
appsScriptUrlInput.value = state.appsScriptUrl || "";
applySavedManagerDraft({ silent: true });
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

saveDraftBtn?.addEventListener("click", () => {
  saveManagerDraft();
  setStatus("已儲存目前輸入內容。API 金鑰及圖片檔案不會被保存。");
});

loadDraftBtn?.addEventListener("click", () => {
  const loaded = applySavedManagerDraft();
  if (loaded) setStatus("已載入已儲存的輸入內容。請重新貼上 API 金鑰及重新選擇圖片。");
  else setStatus("未找到已儲存的輸入內容。", true);
});

clearDraftBtn?.addEventListener("click", () => {
  clearManagerDraft();
  setStatus("已清除已儲存的輸入內容。");
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
  const files = Array.from(event.target.files || []);
  latestReferenceImages = [];
  if (!files.length) return;
  try {
    latestReferenceImages = await Promise.all(files.map(fileToDataUrl));
    setStatus(`已準備 ${latestReferenceImages.length} 張指定圖片：${latestReferenceImages.map((x) => x.name).join("、")}`);
  } catch (error) {
    setStatus(`讀取指定圖片失敗：${error.message}`, true);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveManagerDraft({ silent: true });
  const topic = document.querySelector("#topic").value.trim();
  const topicDate = document.querySelector("#topicDate").value.trim();
  const provider = document.querySelector("#provider").value.trim() || "openrouter";
  const apiKey = document.querySelector("#apiKey").value.trim();
  const openrouterKey = document.querySelector("#openrouterKey").value.trim();
  const openrouterModel = document.querySelector("#openrouterModel").value.trim() || "openrouter/auto";
  const model = document.querySelector("#model").value.trim() || "gemini-2.5-flash";
  const wordCount = document.querySelector("#wordCount").value.trim();
  const hashtags = document.querySelector("#hashtags").value.trim();
  const photoDirection = document.querySelector("#photoDirection").value.trim();
  const referenceImageFiles = Array.from(document.querySelector("#referenceImage").files || []);
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
  let referenceImages = [];
  if (referenceImageFiles.length) {
    const selectedNames = referenceImageFiles.map((file) => file.name).join("|");
    const cachedNames = latestReferenceImages.map((image) => image.name).join("|");
    referenceImages = selectedNames === cachedNames
      ? latestReferenceImages
      : await Promise.all(referenceImageFiles.map(fileToDataUrl));
    latestReferenceImages = referenceImages;
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
      referenceImages,
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

async function generateWithGeminiBatches({ apiKey, openrouterKey, openrouterModel, provider, model, topic, topicDate, wordCount, hashtags, photoDirection, referenceImages, direction, count }) {
  const batchSize = 20;
  const output = [];
  let cursor = 1;
  const modelChain = uniqueModels([model, "gemini-2.5-flash", "gemini-2.0-flash"]);
  const languagePreference = detectChineseScriptPreference(direction);

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
          languagePreference,
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
          languagePreference,
          take
        }))?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const parsed = JSON.parse(rawText);
    const items = (Array.isArray(parsed) ? parsed : []).map((item, i) => ({
      id: cryptoRandomId(),
      title: normalizeGeneratedScript(item.title || `${topic} - Version ${cursor + i}`, languagePreference),
      topic,
      topicDate: topicDate || formatDateOnly(new Date()),
      generatedAt: new Date().toISOString(),
      content: normalizeGeneratedScript(item.content || "", languagePreference),
      hashtags: normalizeHashtags(normalizeGeneratedScript(item.hashtags || hashtags, languagePreference)),
      photoDirection: photoDirection || "",
      photoInstruction: "",
      referenceImageName: getReferenceImageNames(referenceImages),
      referenceImageDataUrl: referenceImages?.[0]?.dataUrl || "",
      referenceImages: normalizeReferenceImages(referenceImages),
      assignedTo: ""
    }));
    cursor += items.length;
    output.push(...items);
  }

  return output.slice(0, count);
}

async function requestOpenRouter({ apiKey, model, topic, wordCount, hashtags, direction, languagePreference, take }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(languagePreference) },
        { role: "user", content: buildGeminiPrompt({ topic, wordCount, hashtags, direction, languagePreference, count: take }) }
      ]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "OpenRouter request failed.");
  return data?.choices?.[0]?.message?.content || "[]";
}

async function requestGeminiWithFallback({ apiKey, modelChain, topic, wordCount, hashtags, direction, languagePreference, take }) {
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
                text: buildGeminiPrompt({ topic, wordCount, hashtags, direction, languagePreference, count: take })
              }]
            }],
            systemInstruction: {
              parts: [{ text: buildSystemPrompt(languagePreference) }]
            },
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

function buildSystemPrompt(languagePreference) {
  return [
    "Return only a valid JSON array. Do not include markdown or explanation.",
    "Each array item must include exactly these content fields: title, content, hashtags.",
    buildLanguageInstruction(languagePreference)
  ].filter(Boolean).join("\n");
}

function buildGeminiPrompt({ topic, wordCount, hashtags, direction, languagePreference, count }) {
  return [
    `Generate ${count} unique Xiaohongshu (Little Redbook) content versions.`,
    `Topic: ${topic}`,
    `Target word count per version: about ${wordCount} words`,
    `Hashtags to include or adapt: ${hashtags}`,
    `Direction: ${direction}`,
    buildLanguageInstruction(languagePreference),
    "Hashtag formatting rule: separate hashtags with spaces only. Do not use commas between hashtags.",
    "Return ONLY valid JSON array.",
    "Each item must include keys: title, content, hashtags."
  ].filter(Boolean).join("\\n");
}

function detectChineseScriptPreference(text) {
  const value = String(text || "").toLowerCase();
  if (/(简体|簡體|简体字|簡體字|simplified chinese|simplified)/i.test(value)) return "simplified";
  if (/(繁体|繁體|traditional chinese|traditional)/i.test(value)) return "traditional";
  return "";
}

function buildLanguageInstruction(languagePreference) {
  if (languagePreference === "simplified") {
    return [
      "LANGUAGE REQUIREMENT: Write all generated title, content, and hashtags in Simplified Chinese only.",
      "Do not output Traditional Chinese characters such as 體、醫、針、無、創、韓、國、風、濕、導、療、師、標、籤、護、膚、長.",
      "If the source prompt uses Traditional Chinese, convert the wording to Simplified Chinese in the output."
    ].join(" ");
  }
  if (languagePreference === "traditional") {
    return "LANGUAGE REQUIREMENT: Write all generated title, content, and hashtags in Traditional Chinese only.";
  }
  return "LANGUAGE REQUIREMENT: Follow the written Chinese script requested inside Direction. If Direction says Simplified Chinese or 用簡體字/用简体字, output Simplified Chinese only.";
}

function normalizeGeneratedScript(text, languagePreference) {
  if (languagePreference !== "simplified") return String(text || "");
  return toSimplifiedChineseCommon(text);
}

function normalizeHashtags(text) {
  return String(text || "")
    .replace(/[,，、]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReferenceImages(images) {
  return (Array.isArray(images) ? images : [])
    .filter((image) => image && (image.dataUrl || image.fileId || image.fileUrl || image.name))
    .map((image) => ({
      name: image.name || "",
      dataUrl: image.dataUrl || "",
      fileId: image.fileId || "",
      fileUrl: image.fileUrl || ""
    }));
}

function getReferenceImageNames(images) {
  return normalizeReferenceImages(images)
    .map((image) => image.name)
    .filter(Boolean)
    .join("\n");
}

function toSimplifiedChineseCommon(text) {
  const map = {
    "醫": "医", "療": "疗", "針": "针", "無": "无", "創": "创", "韓": "韩", "國": "国", "風": "风", "趨": "趋", "勢": "势",
    "熱": "热", "傳": "传", "統": "统", "復": "复", "長": "长", "導": "导", "護": "护", "膚": "肤", "類": "类",
    "筆": "笔", "記": "记", "專": "专", "驚": "惊", "與": "与", "詞": "词", "淺": "浅", "顯": "显", "寫": "写",
    "標": "标", "題": "题", "籤": "签", "讀": "读", "嘗": "尝", "傷": "伤", "見": "见", "議": "议", "資": "资", "訊": "讯",
    "總": "总", "週": "周", "強": "强", "腫": "肿", "潤": "润", "緻": "致", "準": "准", "損": "损", "減": "减",
    "層": "层", "皺": "皱", "紋": "纹", "儀": "仪", "過": "过", "雙": "双", "頻": "频", "聲": "声", "分鐘": "分钟",
    "動": "动", "協": "协", "煥": "焕", "將": "将", "濃": "浓", "營": "营", "養": "养", "滲": "渗", "適": "适",
    "種": "种", "業": "业", "內": "内", "絕": "绝", "對": "对", "現": "现", "諧": "谐", "變": "变", "價": "价",
    "這": "这", "個": "个", "點": "点", "還": "还", "讓": "让", "開": "开", "關": "关", "擔": "担", "擁": "拥",
    "鬆": "松", "實": "实", "數": "数", "據": "据", "專": "专", "態": "态", "愛": "爱", "帶": "带", "嗎": "吗",
    "別": "别", "條": "条", "體": "体", "們": "们", "對": "对", "裡": "里", "剛": "刚", "氣": "气", "從": "从",
    "為": "为", "沒": "没", "發": "发", "滿": "满", "臉": "脸", "紅": "红", "級": "级", "爛": "烂", "應": "应",
    "該": "该", "選": "选", "寶": "宝", "貝": "贝", "網": "网", "區": "区", "嗎": "吗", "唸": "念", "詫": "诧"
  };
  return String(text || "").replace(/[醫療針無創韓國風趨勢熱傳統復長導護膚類筆記專驚與詞淺顯寫標題籤讀嘗傷見議資訊總週強腫潤緻準損減層皺紋儀過雙頻聲動協煥將濃營養滲適種業內絕對現諧變價這個點還讓開關擔擁鬆實數據態愛帶嗎別條體們裡剛氣從為沒發滿臉紅級爛應該選寶貝網區唸詫]/g, (char) => map[char] || char);
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
    hashtags: normalizeHashtags(hashtags),
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
    const restored = await ensureItemReferenceImages(item);
    if (!restored) {
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
        if (hasReferenceImageData(item)) {
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

async function ensureItemReferenceImages(item) {
  const images = normalizeReferenceImages(item.referenceImages);
  const hasExpectedImages = images.length || item.referenceImageName;
  const hasData = images.some((image) => image.dataUrl) || item.referenceImageDataUrl;
  if (!hasExpectedImages || hasData) return true;

  const activeFiles = Array.from(document.querySelector("#referenceImage")?.files || []);
  if (!activeFiles.length) return false;
  try {
    const selectedNames = activeFiles.map((file) => file.name).join("|");
    const cachedNames = latestReferenceImages.map((image) => image.name).join("|");
    const reread = selectedNames === cachedNames
      ? latestReferenceImages
      : await Promise.all(activeFiles.map(fileToDataUrl));
    latestReferenceImages = reread;
    item.referenceImages = normalizeReferenceImages(reread);
    item.referenceImageName = getReferenceImageNames(reread);
    item.referenceImageDataUrl = item.referenceImages[0]?.dataUrl || "";
    return true;
  } catch (error) {
    setStatus(`審批前讀取指定圖片失敗：${error.message}`, true);
    return false;
  }
}

function hasReferenceImageData(item) {
  return Boolean(
    item.referenceImageDataUrl ||
    normalizeReferenceImages(item.referenceImages).some((image) => image.dataUrl)
  );
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
    referenceImageDataUrl: item.referenceImageDataUrl || "",
    referenceImages: normalizeReferenceImages(item.referenceImages)
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
    const topic = stats.topic || getTopicFromProgressKey(key);
    const publishDate = stats.topicDate || getDateFromProgressKey(key);
    card.innerHTML = `
      <p class="kpi-row"><strong>預定發布日期：</strong>${escapeHtml(publishDate || "-")}</p>
      <p class="kpi-title">${escapeHtml(topic)}</p>
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
    const topicDate = normalizeProgressDate(item.topicDate) || "-";
    const key = `${topicDate}__${topic}`;
    if (!map[key]) map[key] = { topic, topicDate, generated: 0, approved: 0, assigned: 0, missing: 0 };
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
    .map(([key, stats]) => {
      const topic = stats.topic || getTopicFromProgressKey(key);
      const publishDate = stats.topicDate || getDateFromProgressKey(key);
      return `<p class="kpi-row"><strong>${escapeHtml(publishDate || "-")}｜文章主題：${escapeHtml(topic)}</strong>｜${stats.missing} 位治療師尚未分配</p>`;
    })
    .join("");
}

function normalizeProgressDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return formatDateOnly(parsed);
}

function getDateFromProgressKey(key) {
  const text = String(key || "");
  return text.includes("__") ? text.split("__")[0] : "";
}

function getTopicFromProgressKey(key) {
  const text = String(key || "");
  return text.includes("__") ? text.split("__").slice(1).join("__") : text;
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
    referenceImages: normalizeReferenceImages(item.referenceImages).map((image) => ({ ...image, dataUrl: "" })),
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

function getManagerDraftFromForm() {
  return {
    savedAt: new Date().toISOString(),
    appsScriptUrl: getFieldValue("appsScriptUrl"),
    provider: getFieldValue("provider"),
    model: getFieldValue("model"),
    openrouterModel: getFieldValue("openrouterModel"),
    topic: getFieldValue("topic"),
    topicDate: getFieldValue("topicDate"),
    wordCount: getFieldValue("wordCount"),
    hashtags: getFieldValue("hashtags"),
    photoDirection: getFieldValue("photoDirection"),
    direction: getFieldValue("direction"),
    count: getFieldValue("count"),
    fallbackStaffList: getFieldValue("fallbackStaffList")
  };
}

function saveManagerDraft(options = {}) {
  const draft = getManagerDraftFromForm();
  state.appsScriptUrl = draft.appsScriptUrl || state.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
  state.fallbackStaffNumbers = parseFallbackStaff(draft.fallbackStaffList || "");
  persist();

  try {
    if (canUseLocalStorage()) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } else {
      saveDraftToWindowName(draft);
    }
  } catch (error) {
    saveDraftToWindowName(draft);
    if (!options.silent) {
      setStatus("瀏覽器未能永久保存，已暫存在目前分頁。", true);
    }
  }
}

function applySavedManagerDraft(options = {}) {
  const draft = loadManagerDraft();
  if (!draft) return false;

  setFieldValue("appsScriptUrl", draft.appsScriptUrl);
  setFieldValue("provider", draft.provider || "openrouter");
  setFieldValue("model", draft.model);
  setFieldValue("openrouterModel", draft.openrouterModel);
  setFieldValue("topic", draft.topic);
  setFieldValue("topicDate", draft.topicDate);
  setFieldValue("wordCount", draft.wordCount);
  setFieldValue("hashtags", draft.hashtags);
  setFieldValue("photoDirection", draft.photoDirection);
  setFieldValue("direction", draft.direction);
  setFieldValue("count", draft.count);
  setFieldValue("fallbackStaffList", draft.fallbackStaffList);

  state.appsScriptUrl = draft.appsScriptUrl || state.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
  state.fallbackStaffNumbers = parseFallbackStaff(draft.fallbackStaffList || "");
  updateProviderFieldVisibility();
  persist();
  if (!options.silent) {
    setStatus("已載入已儲存的輸入內容。");
  }
  return true;
}

function loadManagerDraft() {
  try {
    if (canUseLocalStorage()) {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    }
  } catch {
    // Fall through to window.name fallback.
  }
  return loadDraftFromWindowName();
}

function clearManagerDraft() {
  try {
    if (canUseLocalStorage()) {
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // Keep clearing fallback below.
  }
  saveDraftToWindowName(null);
}

function getFieldValue(id) {
  return String(document.querySelector(`#${id}`)?.value || "").trim();
}

function setFieldValue(id, value) {
  if (value === undefined || value === null) return;
  const el = document.querySelector(`#${id}`);
  if (el) el.value = String(value);
}

function loadDraftFromWindowName() {
  try {
    const data = JSON.parse(window.name || "{}");
    return data && data[WINDOW_DRAFT_KEY] ? data[WINDOW_DRAFT_KEY] : null;
  } catch {
    return null;
  }
}

function saveDraftToWindowName(draft) {
  try {
    const data = JSON.parse(window.name || "{}");
    if (draft) data[WINDOW_DRAFT_KEY] = draft;
    else delete data[WINDOW_DRAFT_KEY];
    window.name = JSON.stringify(data);
  } catch {
    window.name = draft ? JSON.stringify({ [WINDOW_DRAFT_KEY]: draft }) : "";
  }
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
    referenceImageDataUrl: "",
    referenceImages: normalizeReferenceImages(item.referenceImages).map((image) => ({ ...image, dataUrl: "" }))
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
  const provider = providerSelect?.value || "openrouter";
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
      referenceImageDataUrl: index === 0 ? (item.referenceImageDataUrl || "") : "",
      referenceImages: index === 0
        ? normalizeReferenceImages(item.referenceImages)
        : normalizeReferenceImages(item.referenceImages).map((image) => ({ ...image, dataUrl: "" }))
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
