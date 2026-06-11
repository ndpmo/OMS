const form = document.querySelector('#track-form');
const input = document.querySelector('#url-input');
const regionSelect = document.querySelector('#region-select');
const message = document.querySelector('#form-message');
const body = document.querySelector('#tracks-body');
const storageStatus = document.querySelector('#storage-status');
const runStatus = document.querySelector('#run-status');
const refreshAll = document.querySelector('#refresh-all');
const refreshPassword = document.querySelector('#refresh-password');
const bulkSelectTracks = document.querySelector('#bulk-select-tracks');
const tokenPanel = document.querySelector('#token-panel');
const tokenInput = document.querySelector('#token-input');
const saveToken = document.querySelector('#save-token');
const tokenStatus = document.querySelector('#token-status');
const selectedTrackIds = new Set();
let dashboardTracks = [];
const apiUrl = window.TRACKER_API_URL || '';
const REFRESH_PASSWORD = '29768888pmo';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('正在讀取筆記數據...');
  try {
    const data = await callApi('addTrack', { url: input.value, region: regionSelect.value });
    input.value = '';
    setMessage(`已加入 ${data.added || 0} 個；更新連結 ${data.updated || 0} 個。按「立即刷新」才會抓取數據。`);
    render(data);
  } catch (error) {
    setMessage(error.message, true);
  }
});

bulkSelectTracks.addEventListener('change', () => {
  applyBulkSelection(bulkSelectTracks.value);
});

refreshAll.addEventListener('click', async () => {
  if (refreshPassword.value.trim() !== REFRESH_PASSWORD) {
    setMessage('刷新密碼不正確，沒有扣 Apify 費用。', true);
    runStatus.textContent = '狀態：刷新已取消，密碼不正確。';
    refreshPassword.focus();
    return;
  }

  const selectedNoteIds = Array.from(selectedTrackIds);
  if (!selectedNoteIds.length) {
    setMessage('請先勾選要刷新的筆記，避免刷新未選取的列。', true);
    runStatus.textContent = '狀態：刷新已取消，沒有勾選任何筆記。';
    return;
  }

  setMessage(`正在刷新 ${selectedNoteIds.length} 個已勾選筆記...`);
  runStatus.textContent = '狀態：正在呼叫 Apps Script，請稍候。';
  try {
    const summary = await callApi('refreshAll', {
      refreshPassword: refreshPassword.value.trim(),
      noteIds: selectedNoteIds.join(',')
    });
    refreshPassword.value = '';
    await loadDashboard();
    const text = `已勾選刷新完成：更新 ${summary.refreshed || 0}，略過 ${summary.skipped || 0}，錯誤 ${summary.errors || 0}。`;
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
  dashboardTracks = rows;
  const currentIds = new Set(rows.map((track) => String(track.note_id || '')));
  Array.from(selectedTrackIds).forEach((noteId) => {
    if (!currentIds.has(noteId)) selectedTrackIds.delete(noteId);
  });

  body.innerHTML = rows.length
    ? rows.map(renderTrack).join('')
    : '<tr class="empty-row"><td colspan="12">目前沒有追蹤中的筆記。</td></tr>';
  bindTrackSelection(rows);
}

function renderTrack(track) {
  const latest = track.latest || {};
  const noteId = String(track.note_id || '');
  const region = normalizeRegion(track.region || latest.region);
  const status = normalizeStatus(track.status);
  return `
    <tr>
      <td class="select-cell">
        <input class="track-select" type="checkbox" value="${escapeHtml(noteId)}" data-region="${escapeHtml(region)}" data-status="${escapeHtml(status)}" aria-label="選取 ${escapeHtml(noteId)}" ${selectedTrackIds.has(noteId) ? 'checked' : ''} />
      </td>
      <td>
        <strong>${escapeHtml(latest.title || track.note_id)}</strong>
        <span class="sub">${escapeHtml(track.note_id || '')}</span>
      </td>
      <td>${escapeHtml(region || '-')}</td>
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


function applyBulkSelection(selection, showMessage = true) {
  if (!selection) return;

  const checkboxes = Array.from(document.querySelectorAll('.track-select'));
  selectedTrackIds.clear();
  checkboxes.forEach((checkbox) => {
    const shouldSelect = matchesBulkSelection(checkbox, selection);
    checkbox.checked = shouldSelect;
    if (shouldSelect) selectedTrackIds.add(checkbox.value);
  });

  updateSelectAllState(document.querySelector('#select-all-tracks'), checkboxes);
  if (showMessage) {
    const selectedCount = selectedTrackIds.size;
    setMessage(`已根據「${bulkSelectTracks.options[bulkSelectTracks.selectedIndex].text}」選取 ${selectedCount} 筆。`);
  }
}

function matchesBulkSelection(checkbox, selection) {
  const region = normalizeRegion(checkbox.dataset.region);
  const status = normalizeStatus(checkbox.dataset.status);

  if (selection === 'hk') return region === 'HK';
  if (selection === 'sh') return region === 'SH';
  if (selection === 'queued-checking') return status === 'queued' || status === 'checking';
  if (selection === 'active') return status === 'active';
  if (selection === 'error') return status === 'error';
  return false;
}

function normalizeRegion(value) {
  const region = String(value || '').trim().toUpperCase();
  return region === 'SH' ? 'SH' : region === 'HK' ? 'HK' : '';
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  const statusAliases = {
    '等待刷新': 'queued',
    '讀取中': 'checking',
    '已更新': 'active',
    '錯誤': 'error'
  };
  return statusAliases[status] || status;
}

function resetBulkSelectionControl() {
  if (bulkSelectTracks.value) bulkSelectTracks.value = '';
}

function syncSelectionCheckboxes() {
  const selectAll = document.querySelector('#select-all-tracks');
  const checkboxes = Array.from(document.querySelectorAll('.track-select'));
  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectedTrackIds.has(checkbox.value);
  });
  updateSelectAllState(selectAll, checkboxes);
}

function bindTrackSelection(rows) {
  const selectAll = document.querySelector('#select-all-tracks');
  const checkboxes = Array.from(document.querySelectorAll('.track-select'));

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      resetBulkSelectionControl();
      if (checkbox.checked) {
        selectedTrackIds.add(checkbox.value);
      } else {
        selectedTrackIds.delete(checkbox.value);
      }
      updateSelectAllState(selectAll, checkboxes);
    });
  });

  if (!selectAll) return;
  selectAll.onchange = () => {
    resetBulkSelectionControl();
    checkboxes.forEach((checkbox) => {
      checkbox.checked = selectAll.checked;
      if (checkbox.checked) {
        selectedTrackIds.add(checkbox.value);
      } else {
        selectedTrackIds.delete(checkbox.value);
      }
    });
    updateSelectAllState(selectAll, checkboxes);
  };

  updateSelectAllState(selectAll, checkboxes);
}

function updateSelectAllState(selectAll, checkboxes) {
  if (!selectAll) return;
  const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
  selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
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
