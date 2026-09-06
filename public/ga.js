/* ============================================================================
 * ga.js — Google Analytics 4 の読み込み口（CORE 全サイト共通）
 *
 * 使い方（HTML の <head> に1行）:
 *   <script defer src="/ga.js" data-ga-site="corp"></script>
 *
 * 計測IDは下の GA_ID 1か所だけ。空文字のあいだは
 * 「gtag も googletagmanager も一切読み込まない」＝ 表示速度に影響を与えない。
 * GA4 の測定ID (G-XXXXXXXXXX) は秘密情報ではない（ページのソースに出るもの）ので
 * ここに直接書いてよい。Cookie を使うため、EU向け同意管理を足す場合はこのファイルを起点にする。
 *
 * 設計:
 *  - core-ai.jp とそのサブドメイン (studio.core-ai.jp / nexus.core-ai.jp = NERI LP) は
 *    cookie を親ドメインで共有し、同一の訪問者として数える。リンカーで橋渡しするのは
 *    cookie を共有できない本当に別のドメイン (NERI アプリ本体の vercel.app) だけ。
 *    2026-09-06: corp / Studio から NERI LP へのリンクを nexus.core-ai.jp へ揃えたので、
 *    LP へのリンクはもうリンカーを通らない (通すと `?_gl=1*...` が付く。下の linker を参照)。
 *  - localhost / vercel.app のプレビューでは送らない（実測を汚さないため）。
 *    [[env_production_tracking_probe_pollutes_real_numbers]] と同じ理由。
 *  - window.coreGA(name, params) を生やす。既存の計測（core:funnel）から
 *    同じ出来事を GA4 にも積むために使う。GA_ID 未設定でも呼び出しは安全に無視される。
 * ========================================================================== */
(function () {
  'use strict';

  var GA_ID = 'G-7GR12FWEY3'; // GA4 プロパティ「株式会社CORE」/ ストリーム「CORE全サイト（corp / Studio / NERI）」2026-09-06 作成

  var el = document.currentScript || document.querySelector('script[src$="/ga.js"]');
  var site = (el && el.getAttribute('data-ga-site')) || 'unknown';
  var host = location.hostname;

  // 送らない環境: 手元・プレビュー・ファイル直開き
  var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || /\.local$/.test(host);
  var isPreview = /-git-|-[a-z0-9]{9}\.vercel\.app$/.test(host);
  var enabled = /^G-[A-Z0-9]{6,}$/.test(GA_ID) && !isLocal && !isPreview;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  /** 出来事を1件送る。未設定なら何もしない（呼び出し側は分岐しなくてよい）。 */
  window.coreGA = function (name, params) {
    if (!enabled || !name) return;
    try { gtag('event', name, Object.assign({ core_site: site }, params || {})); } catch (e) { /* 計測で画面を壊さない */ }
  };

  if (!enabled) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
  document.head.appendChild(s);

  gtag('js', new Date());

  var cfg = {
    send_page_view: true,
    core_site: site,
    // 1訪問者を core-ai.jp 全体で串刺しにする
    cookie_domain: /(^|\.)core-ai\.jp$/.test(host) ? '.core-ai.jp' : 'auto',
    // 別ドメインをまたいでも同じセッションとして数える。
    // ★core-ai.jp とそのサブドメイン（www / studio / nexus / neri）は上の cookie_domain で
    //   既に同じ cookie を見ているので、ここに並べてはいけない。並べると GA4 のリンカーが
    //   corp → NERI LP のような同じ cookie 域のリンクにまで `?_gl=1*...` を付け、
    //   会社サイトから NERI を押した人の URL バーが 100 文字超の長い URL になる（2026-09-06 実測）。
    //   ここに書くのは cookie を共有できない「本当に別のドメイン」だけ。
    linker: {
      domains: ['core-nexus-kappa.vercel.app'],
      accept_incoming: true,
    },
  };
  gtag('config', GA_ID, cfg);

  // --------------------------------------------------------------------------
  // 既存の計測ビーコンを GA4 にも写す。
  //
  // corp / CORE Studio / NERI LP は、どれも {site, event, label} という同じ形の
  // JSON を /api/track/... へ sendBeacon で投げている（src/studio/track.ts・
  // src/corporate/roai/track.ts・lp/index.html の toCore）。
  // ここで sendBeacon を1枚かぶせて写すだけにしてあるので、
  // 3サイトのアプリ側コードには一切触らずに、同じ出来事が GA4 にも積まれる。
  //
  // 守っていること:
  //   ・元の sendBeacon は必ず先に呼ぶ（写しに失敗しても既存の計測を壊さない）
  //   ・GA4 が自分で数えている名前（page_view など）は写さない＝二重計上しない
  //   ・GA4 のイベント名の規則（英字始まり・英数字と _ のみ・40文字以内）へ寄せる
  // --------------------------------------------------------------------------
  var GA_RESERVED = { page_view: 1, session_start: 1, first_visit: 1, user_engagement: 1, scroll: 1, click: 1, form_start: 1, form_submit: 1, file_download: 1, video_start: 1 };

  if (enabled && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    var origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      var sent = origBeacon(url, data);          // 先に本来の送信
      try {
        if (String(url).indexOf('/api/track/') >= 0) readBody(data);
      } catch (e) { /* 計測の写しで画面を壊さない */ }
      return sent;
    };
  }

  function readBody(data) {
    if (typeof data === 'string') { mirror(data); return; }
    if (data && typeof data.text === 'function') data.text().then(mirror, function () {});
  }

  function mirror(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { return; }
    if (!o || !o.event) return;
    var name = String(o.event).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40);
    if (!/^[A-Za-z]/.test(name) || GA_RESERVED[name]) return;
    window.coreGA(name, {
      core_site: String(o.site || site).slice(0, 60),
      core_label: String(o.label == null ? '' : o.label).slice(0, 100),
    });
  }
})();
