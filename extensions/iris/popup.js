// ============================================================
// CORE Iris Chrome Extension — popup script
//
// Instagram にいる時は専用 UI (DM スクショ / プロフィール取り込み) を強調。
// それ以外のサイトでは「メモ」だけ。
// ============================================================

const APP_BASE = 'https://core-prism-app.vercel.app';
const APP_IRIS = APP_BASE + '/iris';
const CAPTURE_PARAM = 'capture';

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const titleEl = document.getElementById('pageTitle');
  const urlEl = document.getElementById('pageUrl');
  const ctxBadge = document.getElementById('ctxBadge');
  const ctxLabel = document.getElementById('ctxLabel');
  const openLink = document.getElementById('openApp');

  openLink.href = APP_IRIS;

  if (!tab || !tab.id) {
    titleEl.textContent = 'ページを取得できませんでした';
    return;
  }
  titleEl.textContent = tab.title || '(無題)';
  urlEl.textContent = tab.url || '';

  const onIg = /(^|\.)instagram\.com$/.test(new URL(tab.url || 'about:blank').hostname || '');
  if (onIg) {
    ctxBadge.classList.add('on');
    ctxLabel.textContent = 'Instagram を検出';
  } else {
    ctxLabel.textContent = 'Instagram 以外のページ';
  }

  document.getElementById('dmBtn').addEventListener('click', async () => {
    await sendToIris({
      title: tab.title || '',
      url: tab.url || '',
      source: 'extension-dm',
      kind: 'deal-capture',
    });
  });

  document.getElementById('profileBtn').addEventListener('click', async () => {
    await sendToIris({
      title: tab.title || '',
      url: tab.url || '',
      source: 'extension-profile',
      kind: 'profile-import',
    });
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    await sendToIris({
      title: tab.title || '',
      url: tab.url || '',
      source: 'extension',
      kind: 'note',
    });
  });
})();

async function sendToIris(payload) {
  const status = document.getElementById('status');
  status.hidden = false;
  status.classList.remove('err');
  status.textContent = 'Iris を開いています…';

  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const targetUrl = `${APP_IRIS}?${CAPTURE_PARAM}=${encoded}`;
    await chrome.storage.local.set({
      core_iris_pending_capture: { ...payload, at: Date.now() },
    });
    await chrome.tabs.create({ url: targetUrl });
    status.textContent = '✓ Iris を開きました';
    setTimeout(() => window.close(), 500);
  } catch (err) {
    status.classList.add('err');
    status.textContent = '失敗: ' + (err?.message || 'unknown');
  }
}
