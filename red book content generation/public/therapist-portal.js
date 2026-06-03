const loginBtn = document.querySelector("#loginBtn");
const applyFilterBtn = document.querySelector("#applyFilterBtn");
const staffLogin = document.querySelector("#staffLogin");
const dateFromInput = document.querySelector("#dateFrom");
const dateToInput = document.querySelector("#dateTo");
const dateSortSelect = document.querySelector("#dateSort");
const statusEl = document.querySelector("#portalStatus");
const myContentEl = document.querySelector("#myContent");
const managerBackLink = document.querySelector("#managerBackLink");
const managerPasswordDialog = document.querySelector("#managerPasswordDialog");
const managerPasswordInput = document.querySelector("#managerPasswordInput");
const managerPasswordSubmit = document.querySelector("#managerPasswordSubmit");
const managerPasswordCancel = document.querySelector("#managerPasswordCancel");
const managerPasswordStatus = document.querySelector("#managerPasswordStatus");
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

managerBackLink?.addEventListener("click", (event) => {
  event.preventDefault();
  if (!managerPasswordDialog?.showModal) {
    const password = window.prompt("請輸入管理後台密碼");
    checkManagerPassword(password || "").then((ok) => {
      if (ok) window.location.href = managerBackLink.href;
      else setStatus("管理後台密碼錯誤。", true);
    }).catch((error) => {
      setStatus(`無法驗證管理後台密碼：${error.message || "請檢查 Apps Script 設定"}`, true);
    });
    return;
  }
  if (managerPasswordInput) managerPasswordInput.value = "";
  if (managerPasswordStatus) managerPasswordStatus.textContent = "";
  managerPasswordDialog.showModal();
  managerPasswordInput?.focus();
});

managerPasswordSubmit?.addEventListener("click", async () => {
  const password = String(managerPasswordInput?.value || "");
  if (managerPasswordStatus) {
    managerPasswordStatus.textContent = "正在驗證密碼...";
    managerPasswordStatus.style.color = "";
  }
  if (managerPasswordSubmit) managerPasswordSubmit.disabled = true;
  try {
    const isCorrect = await checkManagerPassword(password);
    if (!isCorrect) {
      if (managerPasswordStatus) {
        managerPasswordStatus.textContent = "密碼錯誤，請再試一次。";
        managerPasswordStatus.style.color = "#b53d1c";
      }
      managerPasswordInput?.focus();
      return;
    }
    window.location.href = managerBackLink.href;
  } catch (error) {
    if (managerPasswordStatus) {
      managerPasswordStatus.textContent = `無法驗證密碼：${error.message || "請檢查 Apps Script 設定"}`;
      managerPasswordStatus.style.color = "#b53d1c";
    }
    managerPasswordInput?.focus();
  } finally {
    if (managerPasswordSubmit) managerPasswordSubmit.disabled = false;
  }
});

async function checkManagerPassword(password) {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  const state = loadState();
  const appsScriptUrl = String(state.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL).trim();
  const qs = new URLSearchParams({
    action: "managerAuth",
    hash: hashHex
  });
  const url = appsScriptUrl.includes("?") ? `${appsScriptUrl}&${qs.toString()}` : `${appsScriptUrl}?${qs.toString()}`;
  const response = await fetch(url, { method: "GET" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || "password check failed");
  }
  return result.authorized === true;
}

managerPasswordCancel?.addEventListener("click", () => {
  managerPasswordDialog?.close();
});

managerPasswordInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    managerPasswordSubmit?.click();
  }
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
  const grouped = groupByPublishDateAndTopic(items);
  grouped.forEach(({ topic, publishDate, items: topicItems }) => {
    const section = document.createElement("section");
    section.className = "panel";
    section.innerHTML = `
      <p class="eyebrow">預定發布日期：${escapeHtml(publishDate || "-")}</p>
      <h2>文章主題：${escapeHtml(topic)}</h2>
    `;

    const wrap = document.createElement("div");
    wrap.className = "grid";
    topicItems.forEach((item) => {
      const card = document.createElement("article");
      card.className = "card";
      const referenceImages = getReferenceImages(item);
      card.innerHTML = `<h3>${escapeHtml(item.title || topic)}</h3>
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
      imageRequirementSection.innerHTML = "<p><strong>圖片要求（治療師發文需遵守）</strong></p>";

      const specifiedImageSection = document.createElement("div");
      specifiedImageSection.className = "panel";
      specifiedImageSection.style.marginTop = "10px";
      specifiedImageSection.innerHTML = `
        <p><strong>貼文指定圖片：</strong>若有指定，發文時請務必使用</p>
      `;
      if (referenceImages.length) {
        const previewTitle = document.createElement("p");
        previewTitle.innerHTML = `<strong>指定圖片預覽：</strong>共 ${referenceImages.length} 張`;
        specifiedImageSection.appendChild(previewTitle);
        referenceImages.forEach((image, index) => {
          const previewSrc = getImagePreviewSrc(image);
          if (previewSrc) {
            const imageLabel = document.createElement("p");
            imageLabel.innerHTML = `<strong>圖片 ${index + 1}：</strong>${escapeHtml(image.name || "指定圖片")}`;
            specifiedImageSection.appendChild(imageLabel);

            const preview = document.createElement("img");
            preview.src = previewSrc;
            preview.alt = image.name || "reference-image";
            preview.style.width = "100%";
            preview.style.maxWidth = "100%";
            preview.style.borderRadius = "10px";
            preview.style.border = "1px solid #d5deea";
            preview.style.display = "block";
            preview.style.margin = "8px 0";
            specifiedImageSection.appendChild(preview);
          }
        });

        const holdHint = document.createElement("p");
        holdHint.className = "status";
        holdHint.textContent = "手機可長按圖片直接儲存；桌面可右鍵另存圖片。";
        specifiedImageSection.appendChild(holdHint);
      } else {
        const noPreview = document.createElement("p");
        noPreview.innerHTML = "<strong>指定圖片預覽：</strong>目前未指定。";
        specifiedImageSection.appendChild(noPreview);
      }
      imageRequirementSection.appendChild(specifiedImageSection);

      const otherImageSection = document.createElement("div");
      otherImageSection.className = "panel";
      otherImageSection.style.marginTop = "10px";
      otherImageSection.innerHTML = `
        <p><strong>其他圖片方向：</strong> ${escapeHtml(item.photoDirection || "-")}</p>
      `;
      otherImageSection.appendChild(linkButton("開啟參考圖片資料夾", "https://drive.google.com/drive/u/2/folders/1NNiM2b4kTrQcH7FMU3hW-e1Wb9qPPhBl"));
      imageRequirementSection.appendChild(otherImageSection);

      card.appendChild(imageRequirementSection);
      wrap.appendChild(card);
    });

    section.appendChild(wrap);
    myContentEl.appendChild(section);
  });
}

function groupByPublishDateAndTopic(items) {
  const map = {};
  items.forEach((item) => {
    const topic = item.topic || "未分類主題";
    const publishDate = normalizeDateKey(item.topicDate) || String(item.topicDate || "").trim() || "-";
    const key = `${publishDate}__${topic}`;
    if (!map[key]) map[key] = { topic, publishDate, items: [] };
    map[key].items.push(item);
  });
  return Object.values(map);
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

function getReferenceImages(item) {
  const parsedFromUrl = parseReferenceImageList(item.referenceImageFileUrl);
  const parsedFromId = parseReferenceImageIds(item.referenceImageFileId);
  const explicitImages = Array.isArray(item.referenceImages) ? item.referenceImages : [];
  const merged = [...explicitImages, ...parsedFromUrl];

  parsedFromId.forEach((id, index) => {
    if (!merged[index]) merged[index] = {};
    merged[index].fileId = merged[index].fileId || id;
  });

  if (!merged.length && (item.referenceImageDataUrl || item.referenceImageFileId || item.referenceImageFileUrl || item.referenceImageName)) {
    merged.push({
      name: item.referenceImageName || "",
      dataUrl: item.referenceImageDataUrl || "",
      fileId: item.referenceImageFileId || "",
      fileUrl: item.referenceImageFileUrl || ""
    });
  }

  return merged
    .map((image) => ({
      name: image.name || "",
      dataUrl: image.dataUrl || "",
      fileId: image.fileId || image.id || "",
      fileUrl: image.fileUrl || image.url || ""
    }))
    .filter((image) => image.dataUrl || image.fileId || image.fileUrl || image.name);
}

function parseReferenceImageList(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => {
        if (typeof entry === "string") return { fileUrl: entry };
        return {
          name: entry.name || "",
          fileId: entry.fileId || entry.id || "",
          fileUrl: entry.fileUrl || entry.url || ""
        };
      });
    }
  } catch {
    // Fall through to legacy text splitting.
  }
  return raw.split(/\n+/).filter(Boolean).map((url) => ({ fileUrl: url }));
}

function parseReferenceImageIds(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x || "").trim()).filter(Boolean);
  } catch {
    // Fall through to legacy text splitting.
  }
  return raw.split(/\n+/).filter(Boolean);
}

function getImagePreviewSrc(image) {
  if (image.dataUrl) return image.dataUrl;
  if (image.fileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(image.fileId)}&sz=w1000`;
  }
  return image.fileUrl || "";
}

function getImageDownloadHref(image) {
  if (image.dataUrl) return image.dataUrl;
  if (image.fileId) {
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(image.fileId)}`;
  }
  return image.fileUrl || "";
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
