/* ============================================================
 * Crystal — 設置用ローダー (この1行で設置)
 *
 *   <script src="https://core-prism-app.vercel.app/crystal.js"
 *           data-config="<設定文字列>" async></script>
 *
 * やること:
 *   1. 右下 fixed の透明 iframe を注入 (閉=バブルだけの 96px 角)
 *   2. iframe 内のウィジェットが開閉を postMessage で知らせてくる
 *      → iframe サイズを伸縮 (開=最大 420x720 / スマホは全画面)
 * 設置先のスタイルには一切干渉しない。zIndex は最前面級。
 * ============================================================ */
(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if ((all[i].src || '').indexOf('crystal.js') !== -1) { script = all[i]; break; }
    }
  }
  if (!script) return;

  // 二重設置ガード
  if (window.__prismConciergeLoaded) return;
  window.__prismConciergeLoaded = true;

  var origin;
  try {
    origin = new URL(script.src, window.location.href).origin;
  } catch (e) {
    origin = 'https://core-prism-app.vercel.app';
  }

  var cfg = script.getAttribute('data-config') || '';
  var url = origin + '/crystal?embed=1' + (cfg ? '&c=' + encodeURIComponent(cfg) : '');

  // 閉じているとき: バブル (56px) + 余白 + 影 が収まる箱
  var CLOSED_W = 96, CLOSED_H = 96;

  function openSize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    if (vw < 480) return { w: vw, h: vh }; // スマホは全画面 (パネル側が safe-area を確保)
    return { w: Math.min(vw - 8, 420), h: Math.min(vh - 8, 720) };
  }

  var iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.title = 'コンシェルジュ チャット';
  iframe.setAttribute('allowtransparency', 'true');
  iframe.setAttribute('frameborder', '0');
  iframe.style.cssText = [
    'position:fixed',
    'right:0',
    'bottom:0',
    'width:' + CLOSED_W + 'px',
    'height:' + CLOSED_H + 'px',
    'border:0',
    'background:transparent',
    'color-scheme:normal',
    'z-index:2147483000',
    'max-width:100vw',
    'max-height:100vh',
  ].join(';');

  function mount() {
    if (document.body) document.body.appendChild(iframe);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  var isOpen = false;
  var isPeek = false; // 「先に話しかける」吹き出し表示中 (バブルより少し広い箱にする)
  var PEEK_W = 340, PEEK_H = 220;

  function apply() {
    if (isOpen) {
      var s = openSize();
      iframe.style.width = s.w + 'px';
      iframe.style.height = s.h + 'px';
    } else if (isPeek) {
      iframe.style.width = Math.min(window.innerWidth, PEEK_W) + 'px';
      iframe.style.height = PEEK_H + 'px';
    } else {
      iframe.style.width = CLOSED_W + 'px';
      iframe.style.height = CLOSED_H + 'px';
    }
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== origin) return; // ウィジェット以外からのメッセージは無視
    var d = e.data;
    if (d && d.type === 'prism-concierge:resize') {
      isOpen = !!d.open;
      apply();
    } else if (d && d.type === 'prism-concierge:peek') {
      isPeek = !!d.peek;
      apply();
    }
  });

  window.addEventListener('resize', function () {
    if (isOpen) apply();
  });
})();
