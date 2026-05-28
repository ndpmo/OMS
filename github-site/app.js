const form = document.querySelector('#track-form');
const input = document.querySelector('#url-input');
const message = document.querySelector('#form-message');
const body = document.querySelector('#tracks-body');
const storageStatus = document.querySelector('#storage-status');
const refreshAll = document.querySelector('#refresh-all');
const tokenPanel = document.querySelector('#token-panel');
const tokenInput = document.querySelector('#token-input');
const saveToken = document.querySelector('#save-token');

const apiUrl = window.TRACKER_API_URL || '';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('Checking post...');
  try {
    await callApi('addTrack', { url: input.value });
    input.value = '';
    setMessage('Tracking started.');
    await loadDashboard();
  } catch (error) {
    setMessage(error.message, true);
  }
});

refreshAll.addEventListener('click', async () => {
  setMessage('Refreshing tracked posts...');
  try {
    await callApi('refreshAll');
    await loadDashboard();
    setMessage('Refresh complete.');
  } catch (error) {
    setMessage(error.message, true);
  }
});

saveToken.addEventListener('click', async () => {
  setMessage('Saving token...');
  try {
    await callApi('saveToken', { token: tokenInput.value });
    tokenInput.value = '';
    setMessage('Token saved. You can start tracking now.');
    await loadDashboard();
  } catch (error) {
    setMessage(error.message, true);
  }
});

async function loadDashboard() {
  if (!apiUrl || apiUrl.includes('PASTE_YOUR')) {
    storageStatus.textContent = 'Set TRACKER_API_URL in config.js after deploying Apps Script.';
    return;
  }

  const data = await callApi('dashboard');
  render(data);
}

function render(data) {
  storageStatus.textContent = data.hasToken
    ? 'Apps Script is connected. Google Sheet is the source of truth.'
    : 'Apps Script is connected, but the Apify token still needs to be saved in Script Properties.';
  tokenPanel.hidden = Boolean(data.hasToken);

  const rows = data.tracks || [];
  body.innerHTML = rows.length
    ? rows.map(renderTrack).join('')
    : '<tr class="empty-row"><td colspan="10">No posts tracked yet.</td></tr>';
}

function renderTrack(track) {
  const latest = track.latest || {};
  return `
    <tr>
      <td>
        <strong>${escapeHtml(latest.title || track.note_id)}</strong>
        <span class="sub">${escapeHtml(track.note_id || '')}</span>
      </td>
      <td>
        <strong>${escapeHtml(latest.kol_name || '-')}</strong>
        <span class="sub">Red ID ${escapeHtml(latest.red_id || '-')}</span>
      </td>
      <td class="metric">${num(latest.likes)}</td>
      <td class="metric">${num(latest.comments)}</td>
      <td class="metric">${num(latest.saves)}</td>
      <td class="metric">${num(latest.shares)}</td>
      <td>${change(latest, 'hourly')}</td>
      <td>${change(latest, 'daily')}</td>
      <td>${date(track.last_checked_at || latest.fetched_at)}</td>
      <td>${escapeHtml(track.status || '-')}<span class="sub">${escapeHtml(track.error || '')}</span></td>
    </tr>
  `;
}

function callApi(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callback = `trackerCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement('script');
    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('callback', callback);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    window[callback] = (payload) => {
      cleanup();
      payload.ok ? resolve(payload.data) : reject(new Error(payload.error || 'Apps Script request failed.'));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Could not reach Apps Script web app.'));
    };

    function cleanup() {
      delete window[callback];
      script.remove();
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function change(row, prefix) {
  const likes = row[`${prefix}_likes`];
  if (likes === '' || likes === undefined) return '<span class="sub">Baseline pending</span>';
  return `
    <span class="mini-change">Likes ${signed(likes)}</span>
    <span class="mini-change">Comments ${signed(row[`${prefix}_comments`])}</span>
    <span class="mini-change">Saves ${signed(row[`${prefix}_saves`])}</span>
    <span class="mini-change">Shares ${signed(row[`${prefix}_shares`])}</span>
  `;
}

function num(value) {
  return typeof value === 'number' ? value.toLocaleString() : '-';
}

function signed(value) {
  return typeof value === 'number' ? `${value >= 0 ? '+' : ''}${value.toLocaleString()}` : '-';
}

function date(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#c93b35' : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

loadDashboard();
setInterval(loadDashboard, 30000);
