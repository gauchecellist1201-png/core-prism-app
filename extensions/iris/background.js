// ============================================================
// CORE Iris Chrome Extension — background service worker
//
// 右クリックメニュー:
//  - 選択テキストを Iris メモに
//  - リンク・画像を「案件メモ」として保存
// ============================================================

const APP_BASE = 'https://core-prism-app.vercel.app';
const APP_IRIS = APP_BASE + '/iris';
const CAPTURE_PARAM = 'capture';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'iris-save-selection',
    title: '💗 CORE Iris にメモする',
    contexts: ['selection', 'link', 'image', 'page'],
  });
  chrome.contextMenus.create({
    id: 'iris-as-deal',
    title: '💗 CORE Iris — 案件メモにする',
    contexts: ['selection', 'page'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.menuItemId.startsWith('iris-')) return;
  const kind = info.menuItemId === 'iris-as-deal' ? 'deal-note' : 'note';

  const payload = {
    title: tab?.title || '',
    url: info.linkUrl || info.srcUrl || tab?.url || '',
    selection: info.selectionText || '',
    source: 'extension-context',
    kind,
  };

  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const targetUrl = `${APP_IRIS}?${CAPTURE_PARAM}=${encoded}`;
    await chrome.storage.local.set({
      core_iris_pending_capture: { ...payload, at: Date.now() },
    });
    await chrome.tabs.create({ url: targetUrl });
  } catch (err) {
    console.warn('[CORE Iris] context save failed', err);
  }
});
