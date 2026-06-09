const form = document.querySelector("#generator-form");
const queueEl = document.querySelector("#queue");
const approvedEl = document.querySelector("#approved");
const statusEl = document.querySelector("#status");
const assignBtn = document.querySelector("#assignBtn");

const KEY = "redbook_content_bank_v1";
let memoryState = { queue: [], approved: [] };

let state = loadState();
render();

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
    persist();
    render();
    setStatus(`${generated.length} versions generated. Review and approve individually.`);
  } catch (error) {
    setStatus(`Gemini failed (${error.message}). Using template fallback.`, true);
    const generated = Array.from({ length: count }, (_, i) =>
      buildVersion({ topic, wordCount, hashtags, direction, index: i + 1 })
    );
    state.queue = generated;
    state.approved = [];
    persist();
    render();
  } finally {
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
    if (!raw) return { queue: [], approved: [] };
    const parsed = JSON.parse(raw);
    return { queue: parsed.queue || [], approved: parsed.approved || [] };
  } catch {
    return { queue: [], approved: [] };
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
