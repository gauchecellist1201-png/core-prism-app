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
 *  - core-ai.jp とそのサブドメイン (studio.core-ai.jp) は cookie を親ドメインで共有し、
 *    同一の訪問者として数える。別ドメイン (NERI LP) はリンカーで橋渡しする。
 *  - localhost / vercel.app のプレビューでは送らない（実測を汚さないため）。
 *    [[env_production_tracking_probe_pollutes_real_numbers]] と同じ理由。
 *  - window.coreGA(name, params) を生やす。既存の計測（core:funnel）から
 *    同じ出来事を GA4 にも積むために使う。GA_ID 未設定でも呼び出しは安全に無視される。
 * ========================================================================== */
(function () {
  'use strict';

  var GA_ID = ''; // ← ここに GA4 の測定ID（G-から始まる文字列）を入れると計測が始まる

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
    // 別ドメインをまたいでも同じセッションとして数える（NERI LP → 本体 など）
    linker: {
      domains: ['core-ai.jp', 'www.core-ai.jp', 'studio.core-ai.jp', 'neri.core-ai.jp', 'core-nexus-kappa.vercel.app'],
      accept_incoming: true,
    },
  };
  gtag('config', GA_ID, cfg);
})();
