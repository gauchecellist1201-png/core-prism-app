// ============================================================
// corpMain — 法人サイト（/corp・/roai-score・/return-on-ai・/company）専用の入口。
//
// 2026-09-03 Lighthouse（mobile）実測: /corp 36〜40点・FCP 10.6s・LCP 12〜14s。
// 原因は corp.html が Prism アプリの main.tsx → App.tsx を読み、
// file-vendor(480KB) / main(308KB) / chart / markdown / CoreDock を全部落としてから
// やっと CoreSite を lazy 読込していたこと。法人サイトの訪問者に Prism 本体は要らない。
//
// ここでは CoreSite と追従CTAだけを直接マウントする。App.tsx の経路判定は通らない
// （vercel.json の rewrite で corp.html に来るパスはすべて CoreSite が受ける）。
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import CoreSite from './corporate/CoreSite';
import CorpStickyCta from './corporate/CorpStickyCta';
import { initTheme } from './lib/themeManager';
import { bustLegacyServiceWorker } from './lib/swBuster';

initTheme();
bustLegacyServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <CoreSite />
      <CorpStickyCta />
    </ErrorBoundary>
  </StrictMode>,
);
