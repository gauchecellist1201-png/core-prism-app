// ============================================================
// CORE Iris content script — Instagram に常駐するピル
//
// Instagram の右下に小さな「💗 Iris」ピルを表示。クリックすると
// 現在の URL とページ情報を持って Iris アプリを開く。
// 邪魔にならないよう、半透明 + 控えめサイズ。
// ============================================================
(function () {
  if (window.__coreIrisPillMounted) return;
  window.__coreIrisPillMounted = true;

  const APP_BASE = 'https://core-prism-app.vercel.app';
  const APP_IRIS = APP_BASE + '/iris';

  function mount() {
    if (document.getElementById('core-iris-pill')) return;
    const pill = document.createElement('button');
    pill.id = 'core-iris-pill';
    pill.type = 'button';
    pill.setAttribute('aria-label', 'CORE Iris を開く');
    pill.innerHTML = `
      <span class="core-iris-dot"></span>
      <span class="core-iris-label">Iris に保存</span>
    `;
    pill.addEventListener('click', async () => {
      const payload = {
        title: document.title || '',
        url: location.href,
        source: 'iris-content',
        kind: detectKind(),
      };
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      window.open(`${APP_IRIS}?capture=${encoded}`, '_blank', 'noopener');
    });
    document.body.appendChild(pill);
  }

  function detectKind() {
    const p = location.pathname;
    if (p.startsWith('/direct/')) return 'deal-capture';
    if (/^\/[^/]+\/?$/.test(p)) return 'profile-import';
    if (p.startsWith('/p/') || p.startsWith('/reel/') || p.startsWith('/reels/')) return 'post-snapshot';
    return 'note';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
