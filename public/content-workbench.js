const form = document.querySelector("#generator-form");
const queueEl = document.querySelector("#queue");
const approvedEl = document.querySelector("#approved");
const statusEl = document.querySelector("#status");
const assignBtn = document.querySelector("#assignBtn");

const KEY = "redbook_content_bank_v1";

let state = loadState();
render();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const topic = document.querySelector("#topic").value.trim();
  const wordCount = document.querySelector("#wordCount").value.trim();
  const hashtags = document.querySelector("#hashtags").value.trim();
  const direction = document.querySelector("#direction").value.trim();
  const count = Number(document.querySelector("#count").value);

  if (!topic || !wordCount || !hashtags || !direction || !count) {
    setStatus("Please fill all fields.", true);
    return;
  }

  const generated = Array.from({ length: count }, (_, i) => buildVersion({ topic, wordCount, hashtags, direction, index: i + 1 }));
  state.queue = generated;
  state.approved = [];
  persist();
  render();
  setStatus(`${count} versions generated. Review and approve individually.`);
});

assignBtn.addEventListener("click", () => {
  const staff = document.querySelector("#staffNumber").value.trim();
  const n = Number(document.querySelector("#assignCount").value || 1);
  if (!staff) return setStatus("Enter staff number.", true);
  if (n < 1) return setStatus("Assign count must be at least 1.", true);

  const unassigned = state.approved.filter((item) => !item.assignedTo);
  if (!unassigned.length) return setStatus("No unassigned approved content.", true);

  const toAssign = unassigned.slice(0, n);
  toAssign.forEach((item) => (item.assignedTo = staff));
  persist();
  render();
  setStatus(`Assigned ${toAssign.length} item(s) to staff ${staff}.`);
});

function buildVersion({ topic, wordCount, hashtags, direction, index }) {
  return {
    id: cryptoRandomId(),
    title: `${topic} - Version ${index}`,
    content: `Hook: Share one strong observation about ${topic}.\n\nBody (${wordCount} words target): Use this direction -> ${direction}. Include practical steps, one personal perspective, and one result-focused close.\n\nCTA: Ask readers to comment or save for later.`,
    hashtags,
    assignedTo: ""
  };
}

function render() {
  queueEl.innerHTML = "";
  approvedEl.innerHTML = "";

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
    state.queue = state.queue.filter((x) => x.id !== item.id);
    state.approved.push(item);
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

function cardForApproved(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `<h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.content).replaceAll("\n", "<br>")}</p>
    <p><strong>Hashtags:</strong> ${escapeHtml(item.hashtags)}</p>
    <p><strong>Assigned:</strong> ${item.assignedTo ? escapeHtml(item.assignedTo) : "Not assigned"}</p>`;
  return card;
}

function button(label, onClick, ghost = false) {
  const b = document.createElement("button");
  b.type = "button";
  if (ghost) b.className = "ghost";
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function persist() { localStorage.setItem(KEY, JSON.stringify(state)); }
function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { queue: [], approved: [] };
    const parsed = JSON.parse(raw);
    return { queue: parsed.queue || [], approved: parsed.approved || [] };
  } catch {
    return { queue: [], approved: [] };
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

function cryptoRandomId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
