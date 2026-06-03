#!/usr/bin/env node
/**
 * checkA11y.mjs — Lighthouse の accessibility カテゴリだけを 8 ページで実行
 *
 * オーナー指示 (2026-06-04 第 19 波 SSS):
 *   7 LP + dashboard で accessibility を一括チェック。
 *   スコア + 失敗監査項目を ~/Desktop/a11y_check/<date>/ に保存。
 *
 * 使い方:
 *   node scripts/checkA11y.mjs
 *   LH_BASE=http://localhost:5173 node scripts/checkA11y.mjs
 *
 * 必要: macOS の Google Chrome (npx lighthouse 経由で chrome-launcher が使う)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.LH_BASE || 'https://core-prism-app.vercel.app';
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'a11y_check', today);
mkdirSync(outDir, { recursive: true });

const PAGES = [
  { name: 'top',                   path: '/' },
  { name: 'dashboard',             path: '/' /* SPA: index.html ハーフ計測 */ },
  { name: 'lp-sme',                path: '/lp/sme' },
  { name: 'lp-realestate-finance', path: '/lp/realestate-finance' },
  { name: 'lp-consulting',         path: '/lp/consulting' },
  { name: 'lp-solo',               path: '/lp/solo' },
  { name: 'lp-creator',            path: '/lp/creator' },
  { name: 'lp-freelance-pro',      path: '/lp/freelance-pro' },
];

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m' };

console.log(`${C.bold}a11y 一括チェック — ${PAGES.length} ページ @ ${BASE}${C.reset}\n出力: ${outDir}\n`);

const results = [];

for (const p of PAGES) {
  const url = `${BASE}${p.path}`;
  const jsonOut = join(outDir, `${p.name}.json`);
  process.stdout.write(`${C.dim}→ ${p.name.padEnd(30)}${C.reset} `);
  try {
    execFileSync('npx', [
      '--yes',
      'lighthouse',
      url,
      `--output=json`,
      `--output-path=${jsonOut}`,
      '--only-categories=accessibility',
      '--quiet',
      '--chrome-flags=--headless=new --no-sandbox --hide-scrollbars --disable-gpu',
      '--form-factor=mobile',
      '--throttling-method=provided',
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 90000 });

    if (!existsSync(jsonOut)) throw new Error('no output');
    const j = JSON.parse(readFileSync(jsonOut, 'utf-8'));
    const score = Math.round((j.categories?.accessibility?.score ?? 0) * 100);
    const failed = Object.values(j.audits || {}).filter(a => a?.score !== null && a?.score < 1 && (a?.scoreDisplayMode === 'binary' || a?.scoreDisplayMode === 'numeric'));
    const color = score >= 95 ? C.green : score >= 85 ? C.yellow : C.red;
    console.log(`${color}${score}${C.reset} / 失敗 ${failed.length} 件`);
    results.push({ name: p.name, url, score, failed });
  } catch (e) {
    console.log(`${C.red}✗ ${e.message.slice(0, 60)}${C.reset}`);
    results.push({ name: p.name, url, score: 0, failed: [], error: e.message });
  }
}

// ─── サマリ md 出力 ─────────────────────────
const md = [];
md.push('# a11y チェック レポート');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ベース URL: ${BASE}`);
md.push('');
md.push('## スコア 一覧');
md.push('');
md.push('| ページ | スコア | 失敗監査 | URL |');
md.push('|---|---|---|---|');
for (const r of results) {
  const badge = r.score >= 95 ? '🟢' : r.score >= 85 ? '🟡' : '🔴';
  md.push(`| **${r.name}** | ${badge} ${r.score} | ${r.failed.length} | ${r.url} |`);
}
md.push('');
md.push('## 失敗監査 (上位 8 件 / ページ)');
md.push('');
for (const r of results) {
  md.push(`### ${r.name} (score ${r.score})`);
  if (r.error) { md.push(`> 実行エラー: ${r.error}`); md.push(''); continue; }
  if (r.failed.length === 0) { md.push('_(失敗なし — 100% パス)_'); md.push(''); continue; }
  // 重要度の順序 (Lighthouse の audit weight が高いものを優先)
  const sorted = [...r.failed].sort((a, b) => (b.weight || 0) - (a.weight || 0)).slice(0, 8);
  for (const a of sorted) {
    md.push(`- **${a.title || a.id}** (score ${Math.round((a.score || 0) * 100)})`);
    if (a.description) md.push(`  - ${a.description.replace(/\n/g, ' ').slice(0, 240)}`);
  }
  md.push('');
}

const ok = results.filter(r => r.score >= 95).length;
const warn = results.filter(r => r.score >= 85 && r.score < 95).length;
const bad = results.filter(r => r.score < 85).length;

md.push('## 集計');
md.push('');
md.push(`- 🟢 95+ : ${ok}`);
md.push(`- 🟡 85-94: ${warn}`);
md.push(`- 🔴 <85 : ${bad}`);
md.push('');
md.push('## 改善のヒント');
md.push('');
md.push('- 画像には `alt` を付ける (装飾画像は `alt=""` で明示)');
md.push('- ボタン / リンクには `aria-label` を付ける (アイコンのみの場合は必須)');
md.push('- カラー コントラスト比は 4.5:1 以上 (本文)');
md.push('- フォーカス可能要素には focus ring が必要');
md.push('- 見出しは `<h1>` → `<h2>` → `<h3>` 等、階層を飛ばさない');

const mdPath = join(outDir, 'README.md');
writeFileSync(mdPath, md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}集計${C.reset}: 🟢 ${ok} / 🟡 ${warn} / 🔴 ${bad}`);
console.log(`${C.bold}レポート${C.reset}: ${mdPath}`);
process.exit(bad > 0 ? 1 : 0);
