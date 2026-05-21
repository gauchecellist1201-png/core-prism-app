// ============================================================
// CORE Prism Chrome Extension — popup script
//
// 「いま見ているページ」を Prism に渡す。ユーザーは
//  1. 右上アイコン → ポップアップ
//  2. 「Prism に取り込む」ボタン
//  3. 自動でアプリが開いて、AI 会社が分析開始
// この 3 ステップで完結する。
// ============================================================

const APP_BASE = 'https://core-prism-app.vercel.app';
const CAPTURE_PARAM = 'capture';

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const titleEl = document.getElementById('pageTitle');
  const urlEl = document.getElementById('pageUrl');
  const selRow = document.getElementById('selRow');
  const selEl = document.getElementById('selText');
  const openLink = document.getElementById('openApp');

  openLink.href = APP_BASE + '/';

  if (!tab || !tab.id) {
    titleEl.textContent = 'ページを取得できませんでした';
    return;
  }

  titleEl.textContent = tab.title || '(無題)';
  urlEl.textContent = tab.url || '';

  // selection 取得 (失敗しても致命傷ではない)
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const sel = (window.getSelection && window.getSelection().toString()) || '';
        return sel.trim().slice(0, 2000);
      },
    });
    if (result) {
      selRow.hidden = false;
      selEl.textContent = result;
    }
  } catch {
    // chrome:// 等は executeScript できないので静かに無視
  }

  document.getElementById('saveBtn').addEventListener('click', async () => {
    await sendToPrism({
      title: tab.title || '',
      url: tab.url || '',
      selection: selEl.textContent || '',
      source: 'extension',
      kind: 'page',
    });
  });

  document.getElementById('cxoBtn').addEventListener('click', async () => {
    await sendToPrism({
      title: tab.title || '',
      url: tab.url || '',
      selection: selEl.textContent || '',
      source: 'extension',
      kind: 'consult',
    });
  });
})();

async function sendToPrism(payload) {
  const status = document.getElementById('status');
  status.hidden = false;
  status.classList.remove('err');
  status.textContent = '保存中…';

  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const targetUrl = `${APP_BASE}/?${CAPTURE_PARAM}=${encoded}`;
    // 永続化: アプリが開く前に chrome.storage にも置く
    await chrome.storage.local.set({
      core_prism_pending_capture: { ...payload, at: Date.now() },
    });
    await chrome.tabs.create({ url: targetUrl });
    status.textContent = '✓ Prism を開きました';
    setTimeout(() => window.close(), 500);
  } catch (err) {
    status.classList.add('err');
    status.textContent = '保存に失敗: ' + (err?.message || 'unknown');
  }
}
