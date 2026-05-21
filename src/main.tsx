import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import InAppNotificationToast from './components/InAppNotificationToast'
import ConfirmDialog from './components/ConfirmDialog'
import { migrateLegacyKeysOnce } from './lib/tenant'
import { installErrorCapture } from './lib/errorCapture'

// Phase A: tenant prefix への 1 回限りの自動マイグレーション
migrateLegacyKeysOnce();

// ベータ初日: console.error / window.onerror を 1 度だけインストール
// (オプトインしたユーザーのみ /api/log/error に送られる)
installErrorCapture();

// ─── 救済: 旧 Service Worker (lucide-react@1.x キャッシュで真っ白) を 1 回だけ強制更新 ───
// SW_BUSTER_KEY を localStorage に置いて、未消化のブラウザだけ SW を unregister + reload
(() => {
  const KEY = 'core_sw_buster_v3';
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(KEY) === '1') return;
  if (!('serviceWorker' in navigator)) { localStorage.setItem(KEY, '1'); return; }
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length === 0) { localStorage.setItem(KEY, '1'); return; }
    Promise.all(regs.map((r) => r.unregister()))
      .then(() => caches?.keys?.().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
      .then(() => {
        localStorage.setItem(KEY, '1');
        // 強制ハードリロード (Service Worker キャッシュも無視)
        if (!sessionStorage.getItem('core_sw_reloaded_v3')) {
          sessionStorage.setItem('core_sw_reloaded_v3', '1');
          window.location.reload();
        }
      })
      .catch(() => { localStorage.setItem(KEY, '1'); });
  }).catch(() => { localStorage.setItem(KEY, '1'); });
})();

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

  // ─── 招待コード ?invite=CODE を sessionStorage に保留 (AcceptInviteModal がトリガー) ───
  const invite = url.searchParams.get('invite');
  if (invite && invite.length >= 6) {
    try { sessionStorage.setItem('pending_invite', invite); } catch { /* */ }
    url.searchParams.delete('invite');
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
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <InAppNotificationToast />
    <ConfirmDialog />
  </StrictMode>,
)

// Service Worker 登録 (PWA)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* SW未対応環境では無視 */});
  });
}
