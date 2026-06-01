const loginBtn = document.querySelector("#loginBtn");
const staffLogin = document.querySelector("#staffLogin");
const statusEl = document.querySelector("#portalStatus");
const myContentEl = document.querySelector("#myContent");
const KEY = "redbook_content_bank_v1";

loginBtn.addEventListener("click", () => {
  const staff = staffLogin.value.trim();
  if (!staff) return setStatus("請輸入員工編號。", true);

  const state = loadState();
  const mine = (state.approved || []).filter((item) => item.assignedTo === staff);
  renderMine(mine, staff);
});

function renderMine(items, staff) {
  myContentEl.innerHTML = "";
  if (!items.length) {
    setStatus(`找不到員工 ${staff} 的分配內容。`, true);
    myContentEl.innerHTML = "<p>目前尚無分配內容。</p>";
    return;
  }

  setStatus(`已載入 ${items.length} 筆分配內容。`);
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
        <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
        <p><strong>標籤：</strong> ${escapeHtml(item.hashtags)}</p>
        <p><strong>貼文指定圖片：</strong>若有指定，發文時請務必使用。<strong>指定圖片檔案：</strong>${imageName}</p>`;

      const row = document.createElement("div");
      row.className = "row";
      row.appendChild(copyButton("複製文章主題", topic));
      row.appendChild(copyButton("複製文章", item.content || ""));
      row.appendChild(copyButton("複製 hashtag", item.hashtags || ""));
      row.appendChild(linkButton("開啟參考圖片資料夾", "https://drive.google.com/drive/u/2/folders/1NNiM2b4kTrQcH7FMU3hW-e1Wb9qPPhBl"));
      card.appendChild(row);

      const otherImageGuide = document.createElement("div");
      otherImageGuide.className = "panel";
      otherImageGuide.style.marginTop = "10px";
      otherImageGuide.innerHTML = `
        <p><strong>其他圖片拍攝指引（治療師發文需遵守）</strong></p>
        <p><strong>圖片方向：</strong> ${escapeHtml(item.photoDirection || "-")}</p>
        <p><strong>圖片說明：</strong> ${escapeHtml(item.photoInstruction || "-")}</p>
      `;
      card.appendChild(otherImageGuide);

      const downloadSection = document.createElement("div");
      downloadSection.className = "panel";
      downloadSection.style.marginTop = "10px";
      if (item.referenceImageFileUrl || item.referenceImageDataUrl) {
        downloadSection.innerHTML = `<p><strong>指定圖片檔案：</strong>${escapeHtml(item.referenceImageName || "reference-image")}</p>`;
        const preview = document.createElement("img");
        preview.src = item.referenceImageFileUrl || item.referenceImageDataUrl;
        preview.alt = item.referenceImageName || "reference-image";
        preview.style.width = "100%";
        preview.style.maxWidth = "360px";
        preview.style.borderRadius = "10px";
        preview.style.border = "1px solid #d5deea";
        preview.style.display = "block";
        preview.style.margin = "8px 0";
        downloadSection.appendChild(preview);

        const holdHint = document.createElement("p");
        holdHint.className = "status";
        holdHint.textContent = "手機可長按圖片直接儲存。";
        downloadSection.appendChild(holdHint);

        downloadSection.appendChild(downloadImageButton(
          item.referenceImageName || "reference-image",
          item.referenceImageFileUrl || item.referenceImageDataUrl
        ));
      } else {
        downloadSection.innerHTML = "<p><strong>指定圖片檔案：</strong>目前未指定，請使用上方資料夾連結確認最新素材。</p>";
      }
      card.appendChild(downloadSection);
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
