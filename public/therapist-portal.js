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
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
      <p><strong>Hashtags:</strong> ${escapeHtml(item.hashtags)}</p>`;

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy Content + Hashtags";
    copyBtn.addEventListener("click", async () => {
      const full = `${item.content}\n\n${item.hashtags}`;
      try {
        await navigator.clipboard.writeText(full);
        setStatus("Copied to clipboard.");
      } catch {
        setStatus("Copy failed. Try manual copy.", true);
      }
    });

    card.appendChild(copyBtn);
    myContentEl.appendChild(card);
  });
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
