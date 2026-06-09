const form = document.querySelector("#track-form");
const input = document.querySelector("#url-input");
const message = document.querySelector("#form-message");
const body = document.querySelector("#tracks-body");
const history = document.querySelector("#history");
const refreshAll = document.querySelector("#refresh-all");
const storageStatus = document.querySelector("#storage-status");

let tracks = [];
let storage = {};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("Starting the first check...");
  form.querySelector("button").disabled = true;

  try {
    const response = await fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: input.value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not start tracking.");
    input.value = "";
    setMessage("Tracking started. First metrics will appear shortly.");
    await loadTracks();
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    form.querySelector("button").disabled = false;
  }
});

refreshAll.addEventListener("click", async () => {
  const active = tracks.filter((track) => track.noteId);
  setMessage("Refreshing tracked posts now...");
  await Promise.all(
    active.map((track) =>
      fetch("/api/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteId: track.noteId })
      })
    )
  );
  await loadTracks();
});

async function loadTracks() {
  const response = await fetch("/api/tracks");
  const data = await response.json();
  tracks = data.tracks || [];
  storage = data.storage || {};
  render();
}

function render() {
  storageStatus.textContent = storage.googleSheets
    ? "Google Sheets sync is connected. Every hourly check appends a new row."
    : "Local CSV is active. Add Google Sheet credentials on the server to sync rows into Google Sheets.";

  if (!tracks.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="10">Submit a post URL to start the first check.</td></tr>';
    history.innerHTML = "";
    return;
  }

  body.innerHTML = tracks
    .map((track) => {
      const latest = track.latest;
      if (!latest) {
        return `
          <tr>
            <td><strong>${track.noteId}</strong><span class="sub">${track.state}</span></td>
            <td colspan="7">${track.error || "Checking Apify..."}</td>
            <td>${formatDate(track.lastStartedAt)}</td>
            <td>${formatDate(track.nextCheckAt)}</td>
          </tr>
        `;
      }

      return `
        <tr>
          <td>
            <strong>${escapeHtml(latest.title || track.noteId)}</strong>
            <span class="sub">${latest.type || "note"} · ${track.state}</span>
          </td>
          <td>
            <strong>${escapeHtml(latest.author || "-")}</strong>
            <span class="sub">Red ID ${escapeHtml(latest.redId || "-")}</span>
          </td>
          ${metricCell(latest.likes, latest.delta?.likes)}
          ${metricCell(latest.comments, latest.delta?.comments)}
          ${metricCell(latest.collects, latest.delta?.collects)}
          ${metricCell(latest.shares, latest.delta?.shares)}
          <td>${changeStack(latest.hourlyDelta)}</td>
          <td>${changeStack(latest.dailyDelta)}</td>
          <td>${formatDate(track.lastCheckedAt)}</td>
          <td>${formatDate(track.nextCheckAt)}</td>
        </tr>
      `;
    })
    .join("");

  const newest = tracks.find((track) => track.samples?.length);
  history.innerHTML = newest ? renderHistory(newest) : "";
}

function renderHistory(track) {
  const rows = [...track.samples].reverse().slice(0, 8);
  return rows
    .map(
      (sample) => `
        <div class="history-item">
          <strong>${formatDate(sample.fetchedAt)}</strong>
          <span>Likes ${formatNumber(sample.likes)}</span>
          <span>Comments ${formatNumber(sample.comments)}</span>
          <span>Saves ${formatNumber(sample.collects)}</span>
          <span>Shares ${formatNumber(sample.shares)}</span>
          <span>Hourly ${formatCompactChange(sample.hourlyDelta)}</span>
          <span>Daily ${formatCompactChange(sample.dailyDelta)}</span>
        </div>
      `
    )
    .join("");
}

function changeStack(delta) {
  if (!delta || Object.values(delta).every((value) => value === null || value === undefined)) {
    return '<span class="sub">Baseline pending</span>';
  }
  return `
    <span class="mini-change">Likes ${formatSigned(delta.likes)}</span>
    <span class="mini-change">Comments ${formatSigned(delta.comments)}</span>
    <span class="mini-change">Saves ${formatSigned(delta.collects)}</span>
    <span class="mini-change">Shares ${formatSigned(delta.shares)}</span>
  `;
}

function formatCompactChange(delta) {
  if (!delta || delta.likes === null) return "baseline";
  return `L ${formatSigned(delta.likes)} · C ${formatSigned(delta.comments)} · S ${formatSigned(delta.collects)} · Sh ${formatSigned(delta.shares)}`;
}

function formatSigned(value) {
  if (typeof value !== "number") return "-";
  return `${value >= 0 ? "+" : ""}${formatNumber(value)}`;
}

function metricCell(value, delta) {
  return `
    <td>
      <span class="metric">${formatNumber(value)}</span>
      ${delta === null || delta === undefined ? "" : `<span class="delta">${delta >= 0 ? "+" : ""}${formatNumber(delta)}</span>`}
    </td>
  `;
}

function formatNumber(value) {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#c93b35" : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loadTracks();
setInterval(loadTracks, 15000);
