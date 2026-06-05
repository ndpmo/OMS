const form = document.querySelector('#track-form');
const input = document.querySelector('#url-input');
const message = document.querySelector('#form-message');
const body = document.querySelector('#tracks-body');
const storageStatus = document.querySelector('#storage-status');
const runStatus = document.querySelector('#run-status');
const refreshAll = document.querySelector('#refresh-all');
const refreshPassword = document.querySelector('#refresh-password');
const tokenPanel = document.querySelector('#token-panel');
const tokenInput = document.querySelector('#token-input');
const saveToken = document.querySelector('#save-token');
const tokenStatus = document.querySelector('#token-status');

const apiUrl = window.TRACKER_API_URL || '';
const REFRESH_PASSWORD = '29768888pmo';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('正在讀取筆記數據...');
  try {
    const data = await callApi('addTrack', { url: input.value });
    input.value = '';
    setMessage(`已加入 ${data.added || 0} 個；更新連結 ${data.updated || 0} 個。按「立即刷新」才會抓取數據。`);
    render(data);
  } catch (error) {
    setMessage(error.message, true);
  }
});

refreshAll.addEventListener('click', async () => {
  if (refreshPassword.value.trim() !== REFRESH_PASSWORD) {
    setMessage('刷新密碼不正確，沒有扣 Apify 費用。', true);
    runStatus.textContent = '狀態：刷新已取消，密碼不正確。';
    refreshPassword.focus();
    return;
  }

  setMessage('正在刷新全部筆記...');
  runStatus.textContent = '狀態：正在呼叫 Apps Script，請稍候。';
  try {
    const summary = await callApi('refreshAll', { refreshPassword: refreshPassword.value.trim() });
    refreshPassword.value = '';
    await loadDashboard();
    const text = `刷新完成：更新 ${summary.refreshed || 0}，略過 ${summary.skipped || 0}，錯誤 ${summary.errors || 0}。`;
    setMessage(text);
    runStatus.textContent = `狀態：${text}`;
  } catch (error) {
    setMessage(error.message, true);
    runStatus.textContent = `狀態：刷新失敗，${error.message}`;
  }
});

saveToken.addEventListener('click', async () => {
  setMessage('正在儲存 Token...');
  try {
    await callApi('saveToken', { token: tokenInput.value });
    tokenInput.value = '';
    setMessage('Token 已儲存，可以開始追蹤。');
    await loadDashboard();
  } catch (error) {
    setMessage(error.message, true);
    runStatus.textContent = `狀態：Token 儲存失敗，${error.message}`;
  }
});

async function loadDashboard() {
  if (!apiUrl || apiUrl.includes('PASTE_YOUR')) {
    storageStatus.textContent = '請先在 config.js 設定 Apps Script Web App URL。';
    return;
  }

  const data = await callApi('dashboard');
  render(data);
}

function render(data) {
  storageStatus.textContent = data.hasToken
    ? 'Apps Script 已連接；輸入刷新密碼並按「立即刷新」才會更新。'
    : 'Apps Script 已連接，但仍需要先儲存 Apify Token。';
  tokenStatus.textContent = data.hasToken
    ? 'Token 已儲存。如要更換，貼上新 Token 再按儲存。'
    : '尚未儲存 Token。請貼上 Apify Token。';
  if (!data.hasToken) {
    runStatus.textContent = '狀態：缺少 Apify Token，請先儲存 Token。';
  }

  const rows = data.tracks || [];
  body.innerHTML = rows.length
    ? rows.map(renderTrack).join('')
    : '<tr class="empty-row"><td colspan="10">目前沒有追蹤中的筆記。</td></tr>';
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
        <span class="sub">小紅書號 ${escapeHtml(latest.red_id || '-')}</span>
      </td>
      <td class="metric">${num(latest.likes)}</td>
      <td class="metric">${num(latest.comments)}</td>
      <td class="metric">${num(latest.saves)}</td>
      <td class="metric">${num(latest.shares)}</td>
      <td>${change(latest, 'hourly')}</td>
      <td>${change(latest, 'daily')}</td>
      <td>${date(track.last_checked_at || latest.fetched_at)}</td>
      <td>${statusBadge(track.status)}${statusHint(track, latest)}</td>
    </tr>
  `;
}

function statusBadge(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  const labels = {
    queued: '等待刷新',
    checking: '讀取中',
    active: '已更新',
    cooldown: '已略過',
    error: '錯誤',
    unknown: '未知'
  };
  return `<span class="status-badge status-${normalized}">${labels[normalized] || escapeHtml(status || '未知')}</span>`;
}

function statusHint(track, latest) {
  const status = String(track.status || '').toLowerCase();
  if (track.error) return `<span class="sub">${escapeHtml(track.error)}</span>`;
  if (status === 'queued') return '<span class="sub">已加入清單，按「立即刷新」才會抓取數據。</span>';
  if (status === 'checking') return '<span class="sub">正在向 Apify 讀取資料。</span>';
  if (status === 'active') return `<span class="sub">上次成功：${date(track.last_checked_at || latest.fetched_at)}</span>`;
  if (status === 'cooldown') return '<span class="sub">之前因限制略過；現在可輸入刷新密碼後再試。</span>';
  return '<span class="sub">等待下一步操作。</span>';
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
  if (likes === '' || likes === undefined) return '<span class="sub">等待基準數據</span>';
  return `
    <span class="mini-change">讚 ${signed(likes)}</span>
    <span class="mini-change">留言 ${signed(row[`${prefix}_comments`])}</span>
    <span class="mini-change">收藏 ${signed(row[`${prefix}_saves`])}</span>
    <span class="mini-change">分享 ${signed(row[`${prefix}_shares`])}</span>
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
