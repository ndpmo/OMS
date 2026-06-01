const loginBtn = document.querySelector("#loginBtn");
const staffLogin = document.querySelector("#staffLogin");
const statusEl = document.querySelector("#portalStatus");
const myContentEl = document.querySelector("#myContent");
const KEY = "redbook_content_bank_v1";

loginBtn.addEventListener("click", () => {
  const staff = staffLogin.value.trim();
  if (!staff) return setStatus("Please enter your staff number.", true);

  const state = loadState();
  const mine = (state.approved || []).filter((item) => item.assignedTo === staff);
  renderMine(mine, staff);
});

function renderMine(items, staff) {
  myContentEl.innerHTML = "";
  if (!items.length) {
    setStatus(`No assigned content found for ${staff}.`, true);
    myContentEl.innerHTML = "<p>No assigned items yet.</p>";
    return;
  }

  setStatus(`${items.length} assigned item(s) loaded.`);
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
      card.innerHTML = `<h3>${escapeHtml(item.title || topic)}</h3>
        <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
        <p><strong>Hashtags:</strong> ${escapeHtml(item.hashtags)}</p>
        <p><strong>Photo Content Direction:</strong> ${escapeHtml(item.photoDirection || "-")}</p>
        <p><strong>Photo Instruction:</strong> ${escapeHtml(item.photoInstruction || "-")}</p>`;

      const row = document.createElement("div");
      row.className = "row";
      row.appendChild(copyButton("Copy 文章主題", topic));
      row.appendChild(copyButton("Copy 文章", item.content || ""));
      row.appendChild(copyButton("Copy hashtag", item.hashtags || ""));
      if (item.referenceImageFileUrl || item.referenceImageDataUrl) {
        row.appendChild(downloadImageButton(
          item.referenceImageName || "reference-image",
          item.referenceImageFileUrl || item.referenceImageDataUrl
        ));
      }
      card.appendChild(row);
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
      setStatus(`${label} copied.`);
    } catch {
      setStatus(`${label} failed. Try manual copy.`, true);
    }
  });
  return btn;
}

function downloadImageButton(fileName, href) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Download Reference Image";
  btn.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.download = fileName || "reference-image";
    a.click();
    setStatus("Reference image download started.");
  });
  return btn;
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
