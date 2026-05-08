import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ─── マスターキー判定 (GAUCHE2026) → /api/ai に x-master-key ヘッダー自動付与 ───
// URL クエリ ?master=GAUCHE2026 で初回有効化、以降は localStorage に保存
const MASTER_KEY_STORAGE = 'core_master_key_v1';
(() => {
  const url = new URL(window.location.href);
  const queryMaster = url.searchParams.get('master');
  if (queryMaster) {
    localStorage.setItem(MASTER_KEY_STORAGE, queryMaster);
    url.searchParams.delete('master');
    window.history.replaceState({}, '', url.toString());
  }

  // ─── 紹介コード ?ref=XXX を sessionStorage に保留 (signup 時に適用) ───
  const ref = url.searchParams.get('ref');
  if (ref && ref.length >= 6) {
    try { sessionStorage.setItem('pending_ref', ref); } catch { /* */ }
    url.searchParams.delete('ref');
    window.history.replaceState({}, '', url.toString());
  }
})();

// グローバル fetch interceptor — /api/ai 宛のリクエストにマスター系ヘッダーを自動付与
const CLAUDE_KEY_STORAGE = 'core_claude_api_key_v1';
const originalFetch = window.fetch;
window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = '';
  try {
    url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  } catch { /* ignore */ }

  if (url.includes('/api/ai')) {
    const masterKey = localStorage.getItem(MASTER_KEY_STORAGE);
    const claudeKey = localStorage.getItem(CLAUDE_KEY_STORAGE);
    if (masterKey || claudeKey) {
      const headers = new Headers(init?.headers || {});
      if (masterKey) headers.set('x-master-key', masterKey);
      if (claudeKey) headers.set('x-claude-api-key', claudeKey);
      init = { ...init, headers };
    }
  }
  return originalFetch.call(window, input as any, init);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker 登録 (PWA)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* SW未対応環境では無視 */});
  });
}
