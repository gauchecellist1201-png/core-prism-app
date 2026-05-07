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
    // クエリパラメータを履歴から削除 (URL から master 文字列を消す)
    url.searchParams.delete('master');
    window.history.replaceState({}, '', url.toString());
  }
})();

// グローバル fetch interceptor — /api/ai 宛のリクエストに master key を自動付与
const originalFetch = window.fetch;
window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = '';
  try {
    url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  } catch { /* ignore */ }

  if (url.includes('/api/ai')) {
    const masterKey = localStorage.getItem(MASTER_KEY_STORAGE);
    if (masterKey) {
      const headers = new Headers(init?.headers || {});
      headers.set('x-master-key', masterKey);
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
