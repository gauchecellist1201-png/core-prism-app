#!/usr/bin/env node
// ============================================================
// lighthouseAll.mjs — 6 業界 LP + 主要ページの Lighthouse 計測
//
// オーナー指示 (2026-06-03 自律実行): R. Lighthouse npm script
//
// 使い方:
//   npm run lighthouse
//   # または
//   node scripts/lighthouseAll.mjs
//
// 計測内容:
//   - Performance / Accessibility / Best Practices / SEO の 4 スコア
//   - 主要 LCP / CLS / TTI / TBT
//   - 結果サマリを ~/Desktop/lighthouse_check/lighthouse_<日付>.md に
//
// 前提:
//   - chrome がインストール済 (macOS 標準ありなら問題なし)
//   - lighthouse npm パッケージは on-demand で npx 経由実行
// ============================================================
import { execFileSync, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.LH_BASE || 'https://core-prism-app.vercel.app';

const PAGES = [
  { name: 'top',            path: '/' },
  { name: 'pricing',        path: '/pricing' },
  { name: 'lp/sme',         path: '/lp/sme' },
  { name: 'lp/solo',        path: '/lp/solo' },
  { name: 'lp/creator',     path: '/lp/creator' },
  { name: 'lp/freelance-pro', path: '/lp/freelance-pro' },
  { name: 'lp/realestate',  path: '/lp/realestate-finance' },
  { name: 'lp/consulting',  path: '/lp/consulting' },
];

const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outDir = resolve(homedir(), 'Desktop', 'lighthouse_check');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const summaryPath = resolve(outDir, `lighthouse_${dateStr}.md`);
const jsonDir = resolve(outDir, `runs_${dateStr}`);
if (!existsSync(jsonDir)) mkdirSync(jsonDir, { recursive: true });

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Lighthouse 計測: ${PAGES.length} ページ`);
console.log(`  base: ${BASE}`);
console.log(`  out:  ${summaryPath}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const results = [];
for (const p of PAGES) {
  const url = `${BASE}${p.path}`;
  const jsonOut = resolve(jsonDir, `${p.name.replace(/\//g, '_')}.json`);
  console.log(`▶ ${p.name}  ${url}`);
  try {
    execFileSync('npx', [
      '--yes', 'lighthouse', url,
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox',
      '--preset=desktop',
      '--only-categories=performance,accessibility,best-practices,seo',
      `--output=json`,
      `--output-path=${jsonOut}`,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 90_000,
    });
    // JSON から数値を抜き出し
    const data = JSON.parse(execSync(`cat "${jsonOut}"`).toString());
    const cat = data.categories || {};
    const aud = data.audits || {};
    const r = {
      name: p.name,
      perf: pct(cat.performance?.score),
      a11y: pct(cat.accessibility?.score),
      bp:   pct(cat['best-practices']?.score),
      seo:  pct(cat.seo?.score),
      lcp:  aud['largest-contentful-paint']?.numericValue || 0,
      cls:  aud['cumulative-layout-shift']?.numericValue || 0,
      tti:  aud['interactive']?.numericValue || 0,
      tbt:  aud['total-blocking-time']?.numericValue || 0,
    };
    results.push(r);
    console.log(`  ✔ Perf ${r.perf} / A11y ${r.a11y} / BP ${r.bp} / SEO ${r.seo}`);
  } catch (e) {
    console.error(`  ✗ エラー: ${(e?.message || e).toString().slice(0, 150)}`);
    results.push({ name: p.name, error: true });
  }
}

// ── サマリ Markdown 出力 ────────────────────
const lines = [
  `# Lighthouse 計測サマリ — ${new Date().toLocaleString('ja-JP')}`,
  '',
  `base: ${BASE}`,
  '',
  '## スコア (デスクトップ)',
  '',
  '| ページ | Perf | A11y | BP | SEO | LCP | CLS | TBT |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...results.map(r => {
    if (r.error) return `| ${r.name} | ❌ | | | | | | |`;
    return `| ${r.name} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${(r.lcp/1000).toFixed(1)}s | ${r.cls.toFixed(2)} | ${(r.tbt/1000).toFixed(1)}s |`;
  }),
  '',
  '## ベンチマーク',
  '- ✅ 90+ : 良好',
  '- 🟡 50-89 : 改善余地',
  '- 🔴 0-49 : 要修正',
  '',
  '## 個別 JSON',
  `\`runs_${dateStr}/\` に各ページの完全レポート`,
  '',
];
writeFileSync(summaryPath, lines.join('\n'), 'utf8');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ 完了: ${summaryPath}`);

function pct(v) {
  if (typeof v !== 'number') return '—';
  return Math.round(v * 100);
}
