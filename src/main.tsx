import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import InAppNotificationToast from './components/InAppNotificationToast'
import ConfirmDialog from './components/ConfirmDialog'
import { migrateLegacyKeysOnce } from './lib/tenant'
import { installErrorCapture } from './lib/errorCapture'
import { initTheme } from './lib/themeManager'

// YYY (2026-06-04): グローバル テーマを最優先で適用 (FOUC 防止)
initTheme();

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

  // ─── Stripe Connect OAuth コールバックを受け取る ───
  // /api/stripe/connect-callback が #stripe_connect=1&token=sk_xxx&stripe_user_id=acct_xxx&livemode=1
  // のフラグメントを付けて redirect してくる。token を localStorage に保存して即連動。
  if (window.location.hash.includes('stripe_connect=1')) {
    try {
      const frag = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const token = frag.get('token');
      if (token && /^(rk|sk)_(live|test)_/.test(token)) {
        localStorage.setItem('core_integration_stripe', token);
        const sid = frag.get('stripe_user_id');
        if (sid) {
          try { localStorage.setItem('core_integration_stripe_account_id', sid); } catch { /* */ }
        }
        // クライアントの useStripeRevenue 等に「つながった」を即時通知
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('core:stripe-connected', {
            detail: { stripeUserId: sid, livemode: frag.get('livemode') === '1' },
          }));
        }, 100);
      }
    } catch (e) {
      console.warn('[CORE] Stripe Connect fragment parse failed', e);
    }
    // フラグメントを削除 (URL バーから token を消す)
    history.replaceState({}, '', window.location.pathname + window.location.search);
  }

  // ─── 業界特化 LP からの ?demo=music-school で音楽スクール デモを起動 ───
  // (汎用 LP では刺さらないので 1 業界に絞った垂直立ち上げ — オーナー戦略 2026-06-02)
  const demoParam = url.searchParams.get('demo');
  if (demoParam === 'music-school' || demoParam === 'cafe' || demoParam === 'creator') {
    // 動的 import で本体バンドルを汚さない
    import('./lib/onboarding').then(({ seedDemoData, setDemoActive, markOnboarded }) => {
      try {
        const profile = demoParam === 'music-school' ? 'music-school'
                       : demoParam === 'creator' ? 'creator' : 'cafe';
        seedDemoData({ profile });
        setDemoActive(true);
        markOnboarded();
        // 入場ゲート解除 — アプリ本体に直行できるようにする
        try { localStorage.setItem('core_app_entered_v1', 'true'); } catch { /* */ }
        url.searchParams.delete('demo');
        window.history.replaceState({}, '', url.toString());
        // localStorage の反映を待ってからリロード (ストア再構築)
        setTimeout(() => { window.location.href = '/'; }, 50);
      } catch (e) {
        console.warn('[CORE] demo seed failed', e);
      }
    });
  }

  // ─── Chrome 拡張機能から ?capture=BASE64 で取り込み ───
  // 拡張機能の popup/context メニューが投げてくる。payload は
  // { title, url, selection?, source, kind } の JSON を base64 化したもの。
  // localStorage に保存 + custom event を fire してダッシュボードが拾えるように。
  const captureRaw = url.searchParams.get('capture');
  if (captureRaw) {
    try {
      const decoded = decodeURIComponent(escape(atob(captureRaw)));
      const payload = JSON.parse(decoded);
      const record = { ...payload, receivedAt: Date.now() };
      localStorage.setItem('core_extension_capture_v1', JSON.stringify(record));
      // 別タブから dashboard が listen するために少し遅延して fire
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('core:extension-capture', { detail: record }));
      }, 200);
    } catch (e) {
      console.warn('[CORE] ?capture= decode failed', e);
    }
    url.searchParams.delete('capture');
    window.history.replaceState({}, '', url.toString());
  }
})();

// グローバル fetch interceptor — /api/ai と /api/iris/* 宛のリクエストに鍵ヘッダーを自動付与
const CLAUDE_KEY_STORAGE = 'core_claude_api_key_v1';
const GEMINI_KEY_STORAGE = 'core_gemini_api_key_v1';
const originalFetch = window.fetch;
window.fetch = function patched(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let url = '';
  try {
    url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
  } catch { /* ignore */ }

  // AI 呼出し系すべてに鍵を自動付与 (/api/ai, /api/iris/*, /api/instagram/*)
  if (url.includes('/api/ai') || url.includes('/api/iris/') || url.includes('/api/instagram/profile')) {
    const masterKey = localStorage.getItem(MASTER_KEY_STORAGE);
    const claudeKey = localStorage.getItem(CLAUDE_KEY_STORAGE);
    const geminiKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (masterKey || claudeKey || geminiKey) {
      const headers = new Headers(init?.headers || {});
      if (masterKey) headers.set('x-master-key', masterKey);
      if (claudeKey) headers.set('x-claude-api-key', claudeKey);
      if (geminiKey) headers.set('x-gemini-api-key', geminiKey);
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
