// ============================================================
// CORE Prism Chrome Extension — background service worker
//
// 右クリックメニューから「Prism に保存」を生やす。
// 選択テキスト・リンク・画像どれでも対象にする。
// ============================================================

const APP_BASE = 'https://core-prism-app.vercel.app';
const CAPTURE_PARAM = 'capture';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'prism-save-selection',
    title: '🪐 CORE Prism に保存',
    contexts: ['selection', 'link', 'image', 'page'],
  });
  chrome.contextMenus.create({
    id: 'prism-consult-cxo',
    title: '🪐 CORE Prism — 13 CXO に相談',
    contexts: ['selection', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.menuItemId.startsWith('prism-')) return;
  const kind = info.menuItemId === 'prism-consult-cxo' ? 'consult' : 'page';

  const payload = {
    title: tab?.title || '',
    url: info.linkUrl || info.srcUrl || tab?.url || '',
    selection: info.selectionText || '',
    source: 'extension-context',
    kind,
  };

  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const targetUrl = `${APP_BASE}/?${CAPTURE_PARAM}=${encoded}`;
    await chrome.storage.local.set({
      core_prism_pending_capture: { ...payload, at: Date.now() },
    });
    await chrome.tabs.create({ url: targetUrl });
  } catch (err) {
    // service worker のログだけ
    console.warn('[CORE Prism] context save failed', err);
  }
});
