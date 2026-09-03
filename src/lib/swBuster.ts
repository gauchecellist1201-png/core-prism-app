// ============================================================
// swBuster — 旧 Service Worker（lucide-react@1.x キャッシュで真っ白）を 1 回だけ強制解除する救済。
// main.tsx（Prism）と corpMain.tsx（法人サイト）の両方の入口で呼ぶ。SW は origin 単位なので、
// どの入口から入った人でも一度は解除しておく必要がある。
// ============================================================
export function bustLegacyServiceWorker(): void {
  const KEY = 'core_sw_buster_v3';
  if (typeof window === 'undefined') return;
  try {
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
  } catch { /* localStorage 不可（プライベートモード等）は何もしない */ }
}
