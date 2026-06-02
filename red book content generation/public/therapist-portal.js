const loginBtn = document.querySelector("#loginBtn");
const applyFilterBtn = document.querySelector("#applyFilterBtn");
const staffLogin = document.querySelector("#staffLogin");
const dateFromInput = document.querySelector("#dateFrom");
const dateToInput = document.querySelector("#dateTo");
const dateSortSelect = document.querySelector("#dateSort");
const statusEl = document.querySelector("#portalStatus");
const myContentEl = document.querySelector("#myContent");
const KEY = "redbook_content_bank_v1";
const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxm91pim17BsLNvVDlD5vESopFXxgrA3lZlhzhi3Fuc83HGrrL3uROi8qZEq6z_1y6M/exec";
let currentItems = [];
let currentStaff = "";
const today = formatDateOnly(new Date());
if (dateFromInput) dateFromInput.value = today;
if (dateToInput) dateToInput.value = today;

loginBtn.addEventListener("click", () => {
  loadForStaff();
});

async function loadForStaff() {
  const staff = staffLogin.value.trim();
  if (!staff) return setStatus("請輸入員工編號。", true);

  const state = loadState();
  const localItems = (state.approved || []).filter((item) => item.assignedTo === staff);
  const appsScriptUrl = String(state.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL).trim();
  if (appsScriptUrl) {
    try {
      const remoteItems = await fetchAssignments(appsScriptUrl, staff);
      if (remoteItems.length) {
        currentItems = remoteItems;
        setStatus(`已從雲端載入 ${remoteItems.length} 筆分配內容。`);
      } else {
        currentItems = localItems;
        if (!localItems.length) {
          setStatus("雲端已連線，但此員工目前沒有分配內容。", true);
        }
      }
    } catch (error) {
      currentItems = localItems;
      if (!localItems.length) {
        setStatus(`雲端讀取失敗：${error.message || "請檢查 Apps Script 部署權限"}`, true);
      }
    }
  } else {
    currentItems = localItems;
  }
  currentStaff = staff;
  applyAndRender();
}

applyFilterBtn?.addEventListener("click", () => {
  if (!currentStaff) return setStatus("請先輸入員工編號並載入內容。", true);
  applyAndRender();
});

function applyAndRender() {
  const dateFrom = String(dateFromInput?.value || "").trim();
  const dateTo = String(dateToInput?.value || "").trim();
  const sortOrder = dateSortSelect?.value === "desc" ? "desc" : "asc";
  let filtered = [...currentItems];
  if (dateFrom || dateTo) {
    filtered = filtered.filter((item) => {
      const d = normalizeDateKey(item.topicDate);
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }
  filtered.sort((a, b) => {
    const av = normalizeDateKey(a.topicDate);
    const bv = normalizeDateKey(b.topicDate);
    if (av === bv) return 0;
    return sortOrder === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  if ((dateFrom || dateTo) && !filtered.length && currentItems.length) {
    const fallbackItems = [...currentItems].sort((a, b) => {
      const av = normalizeDateKey(a.topicDate);
      const bv = normalizeDateKey(b.topicDate);
      if (av === bv) return 0;
      return sortOrder === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    renderMine(fallbackItems, currentStaff, { dateFrom: "", dateTo: "", sortOrder, autoFallback: true });
    return;
  }
  renderMine(filtered, currentStaff, { dateFrom, dateTo, sortOrder });
}

function renderMine(items, staff, filters) {
  const { dateFrom, dateTo, sortOrder, autoFallback } = filters;
  myContentEl.innerHTML = "";
  if (!items.length) {
    if (dateFrom || dateTo) setStatus(`員工 ${staff} 在所選日期範圍沒有分配內容。`, true);
    else setStatus(`找不到員工 ${staff} 的分配內容。`, true);
    myContentEl.innerHTML = "<p>目前尚無分配內容。</p>";
    return;
  }

  if (autoFallback) {
    setStatus(`所選日期範圍沒有內容，已自動顯示員工 ${staff} 全部分配（排序：${sortOrder === "asc" ? "日期舊到新" : "日期新到舊"}）。`);
  } else {
    setStatus(`已載入 ${items.length} 筆分配內容（排序：${sortOrder === "asc" ? "日期舊到新" : "日期新到舊"}）。`);
  }
  const grouped = groupByTopic(items);
  Object.entries(grouped).forEach(([topic, topicItems]) => {
    const section = document.createElement("section");
    section.className = "panel";
    section.innerHTML = `<h2>文章主題: ${escapeHtml(topic)}</h2>`;

    const wrap = document.createElement("div");
    wrap.className = "grid";
    topicItems.forEach((item) => {
      const card = document.createElement("article");
      card.className = "card";
      const imageName = escapeHtml(item.referenceImageName || "未指定");
      card.innerHTML = `<h3>${escapeHtml(item.title || topic)}</h3>
        <p><strong>計劃發文日期：</strong> ${escapeHtml(item.topicDate || "-")}</p>
        <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
        <p><strong>標籤：</strong> ${escapeHtml(item.hashtags)}</p>`;

      const row = document.createElement("div");
      row.className = "row";
      row.appendChild(copyButton("複製文章主題", topic));
      row.appendChild(copyButton("複製文章", item.content || ""));
      row.appendChild(copyButton("複製 hashtag", item.hashtags || ""));
      card.appendChild(row);

      const imageRequirementSection = document.createElement("div");
      imageRequirementSection.className = "panel";
      imageRequirementSection.style.marginTop = "10px";
      imageRequirementSection.innerHTML = `
        <p><strong>圖片要求（治療師發文需遵守）</strong></p>
        <p><strong>貼文指定圖片：</strong>若有指定，發文時請務必使用</p>
        <p><strong>指定圖片檔案：</strong>${imageName}</p>
        <p><strong>其他圖片方向：</strong> ${escapeHtml(item.photoDirection || "-")}</p>
        <p><strong>其他圖片說明：</strong> ${escapeHtml(item.photoInstruction || "-")}</p>
      `;
      imageRequirementSection.appendChild(linkButton("開啟參考圖片資料夾", "https://drive.google.com/drive/u/2/folders/1NNiM2b4kTrQcH7FMU3hW-e1Wb9qPPhBl"));
      const previewSrc = getImagePreviewSrc(item);
      const downloadHref = getImageDownloadHref(item);
      if (previewSrc || downloadHref) {
        const previewTitle = document.createElement("p");
        previewTitle.innerHTML = "<strong>指定圖片預覽：</strong>";
        imageRequirementSection.appendChild(previewTitle);
        if (previewSrc) {
          const preview = document.createElement("img");
          preview.src = previewSrc;
          preview.alt = item.referenceImageName || "reference-image";
          preview.style.width = "100%";
          preview.style.maxWidth = "100%";
          preview.style.borderRadius = "10px";
          preview.style.border = "1px solid #d5deea";
          preview.style.display = "block";
          preview.style.margin = "8px 0";
          imageRequirementSection.appendChild(preview);
        }

        const holdHint = document.createElement("p");
        holdHint.className = "status";
        holdHint.textContent = "手機可長按圖片直接儲存。";
        imageRequirementSection.appendChild(holdHint);

        imageRequirementSection.appendChild(downloadImageButton(
          item.referenceImageName || "reference-image",
          downloadHref || previewSrc
        ));
      } else {
        const noPreview = document.createElement("p");
        noPreview.innerHTML = "<strong>指定圖片預覽：</strong>目前未指定，請使用上方資料夾連結確認最新素材。";
        imageRequirementSection.appendChild(noPreview);
      }
      card.appendChild(imageRequirementSection);
      wrap.appendChild(card);
    });

    section.appendChild(wrap);
    myContentEl.appendChild(section);
  });
}

function groupByTopic(items) {
  const map = {};
  items.forEach((item) => {
    const topic = item.topic || "未分類主題";
    if (!map[topic]) map[topic] = [];
    map[topic].push(item);
  });
  return map;
}

function copyButton(label, value) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} 已複製。`);
    } catch {
      setStatus(`${label} 複製失敗，請手動複製。`, true);
    }
  });
  return btn;
}

function downloadImageButton(fileName, href) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "下載參考圖片";
  btn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.download = fileName || "reference-image";
    a.click();
    setStatus("已開始下載參考圖片。");
  });
  return btn;
}

function getImagePreviewSrc(item) {
  if (item.referenceImageDataUrl) return item.referenceImageDataUrl;
  if (item.referenceImageFileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.referenceImageFileId)}&sz=w1000`;
  }
  return "";
}

function getImageDownloadHref(item) {
  if (item.referenceImageDataUrl) return item.referenceImageDataUrl;
  if (item.referenceImageFileId) {
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(item.referenceImageFileId)}`;
  }
  return item.referenceImageFileUrl || "";
}

function linkButton(label, href) {
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = label;
  a.className = "ghost";
  a.style.display = "inline-flex";
  a.style.alignItems = "center";
  a.style.justifyContent = "center";
  a.style.minHeight = "42px";
  a.style.padding = "10px 14px";
  a.style.borderRadius = "11px";
  a.style.border = "1px solid rgba(11, 110, 153, 0.45)";
  a.style.textDecoration = "none";
  a.style.fontWeight = "700";
  return a;
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{\"approved\":[]}");
  } catch {
    return { approved: [] };
  }
}

async function fetchAssignments(baseUrl, staffNo) {
  const qs = new URLSearchParams({
    action: "byStaff",
    staffNo: String(staffNo || "").trim()
  });
  const url = baseUrl.includes("?") ? `${baseUrl}&${qs.toString()}` : `${baseUrl}?${qs.toString()}`;
  const response = await fetch(url, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || "fetch assignments failed");
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return rows.map((r) => ({
    id: r.id || "",
    topic: r.topic || "",
    topicDate: r.topicDate || "",
    generatedAt: r.generatedAt || "",
    approvedAt: r.approvedAt || "",
    assignedDate: r.assignDate || "",
    assignedAt: r.assignedAt || "",
    assignedTo: r.staffNo || "",
    staffName: r.staffName || "",
    floor: r.floor || "",
    xhsAccount: r.xhsAccount || "",
    title: r.title || "",
    hashtags: r.hashtags || "",
    content: r.content || "",
    photoDirection: r.photoDirection || "",
    photoInstruction: r.photoInstruction || "",
    referenceImageName: r.referenceImageFile || "",
    referenceImageFileId: r.referenceImageFileId || "",
    referenceImageFileUrl: r.referenceImageFileUrl || "",
    referenceImageDataUrl: ""
  }));
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

function formatDateOnly(value) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const dd = ddmmyyyy[1].padStart(2, "0");
    const mm = ddmmyyyy[2].padStart(2, "0");
    const yyyy = ddmmyyyy[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return formatDateOnly(parsed);
}
