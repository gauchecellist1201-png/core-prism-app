#!/usr/bin/env node
/**
 * checkEnLpScreenshots.mjs — 全 LP を ja / en で 2 枚並列スクショ
 *
 * オーナー指示 (2026-06-04 第 13 波 CCC):
 *   ?lang=en で英語版 LP を Chrome Headless で撮影し、日本語版と並べて確認できるよう
 *   ~/Desktop/lp_lang_check/<日付>/ に保存する。
 *
 * 使い方:
 *   node scripts/checkEnLpScreenshots.mjs
 *   LH_BASE=http://localhost:5173 node scripts/checkEnLpScreenshots.mjs
 *
 * 出力:
 *   ~/Desktop/lp_lang_check/2026-06-04/
 *     top__ja.png
 *     top__en.png
 *     lp-sme__ja.png
 *     lp-sme__en.png
 *     ... (各 LP × ja/en)
 *     README.md  ← 並びチェックリスト
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.LH_BASE || 'https://core-prism-app.vercel.app';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VIEWPORT = { w: 1280, h: 900 }; // デスクトップ視口で広く

const LPS = [
  { name: 'top',                    path: '/' },
  { name: 'lp-sme',                 path: '/lp/sme' },
  { name: 'lp-realestate-finance',  path: '/lp/realestate-finance' },
  { name: 'lp-consulting',          path: '/lp/consulting' },
  { name: 'lp-solo',                path: '/lp/solo' },
  { name: 'lp-creator',             path: '/lp/creator' },
  { name: 'lp-freelance-pro',       path: '/lp/freelance-pro' },
];

const LANGS = ['ja', 'en'];

const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'lp_lang_check', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', cyan: '\x1b[36m' };

console.log(`${C.bold}多言語 LP 撮影 — ${VIEWPORT.w}×${VIEWPORT.h} @ ${BASE}${C.reset}`);
console.log(`出力先: ${outDir}\n`);

const results = [];

for (const lp of LPS) {
  for (const lang of LANGS) {
    const url = `${BASE}${lp.path}${lp.path.includes('?') ? '&' : '?'}lang=${lang}`;
    const out = join(outDir, `${lp.name}__${lang}.png`);
    process.stdout.write(`${C.dim}→ ${lp.name.padEnd(26)} [${lang}]${C.reset} `);
    try {
      execFileSync(CHROME, [
        '--headless=new',
        '--no-sandbox',
        '--hide-scrollbars',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--window-size=${VIEWPORT.w},${VIEWPORT.h}`,
        '--virtual-time-budget=5000',
        '--run-all-compositor-stages-before-draw',
        `--screenshot=${out}`,
        url,
      ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 });
      const size = statSync(out).size;
      if (size < 5_000) {
        console.log(`${C.red}✗ ${size}B (撮影失敗?)${C.reset}`);
        results.push({ ...lp, lang, status: 'failed', sizeBytes: size, path: out });
      } else {
        console.log(`${C.green}✓ ${(size / 1024).toFixed(1)} KB${C.reset}`);
        results.push({ ...lp, lang, status: 'ok', sizeBytes: size, path: out });
      }
    } catch (e) {
      console.log(`${C.red}✗ ${e.message.slice(0, 60)}${C.reset}`);
      results.push({ ...lp, lang, status: 'error', sizeBytes: 0, path: out, error: e.message });
    }
  }
}

// ─── 並びチェックリスト .md ────────────────────────────
const md = [];
md.push('# 多言語 LP スクリーンショット (CCC)');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ベース URL: ${BASE}`);
md.push(`viewport: ${VIEWPORT.w} × ${VIEWPORT.h}`);
md.push('');
md.push('## チェック観点');
md.push('');
md.push('- [ ] 英語版が「Google 翻訳された日本語」になっていない (= 正規の英語 dict が当たっている)');
md.push('- [ ] hero h1 / sub / CTA / 価格表 が両言語で同じ位置・同じ要素数');
md.push('- [ ] 比較表の見出し / セルが英訳済み');
md.push('- [ ] FAQ の Q&A が英訳済み');
md.push('- [ ] Footer / Privacy / Terms のリンクラベルが英訳済み');
md.push('');
md.push('## ja ↔ en 並列ビュー');
md.push('');
md.push('| LP | 日本語 (ja) | 英語 (en) |');
md.push('|---|---|---|');
for (const lp of LPS) {
  const ja = results.find(r => r.name === lp.name && r.lang === 'ja');
  const en = results.find(r => r.name === lp.name && r.lang === 'en');
  const jaCell = ja?.status === 'ok' ? `![${lp.name} ja](${lp.name}__ja.png)` : `(${ja?.status || 'no'})`;
  const enCell = en?.status === 'ok' ? `![${lp.name} en](${lp.name}__en.png)` : `(${en?.status || 'no'})`;
  md.push(`| **${lp.name}** | ${jaCell} | ${enCell} |`);
}

md.push('');
md.push('## NG が出たら');
md.push('');
md.push('1. 当該 LP のコンポーネントを開く (例: src/components/LandingPage.tsx)');
md.push('2. 日本語ハードコードを `t.xxx` 経由に置換');
md.push('3. `src/i18n/ja.ts` と `src/i18n/en.ts` 両方に値を追加');
md.push('4. `npm run dev` で `?lang=en` を確認 → 再度本スクリプト実行');

const mdPath = join(outDir, 'README.md');
writeFileSync(mdPath, md.join('\n'), 'utf-8');

const ok = results.filter(r => r.status === 'ok').length;
const ng = results.length - ok;
console.log('');
console.log(`${C.bold}結果${C.reset}: ${C.green}✓ ${ok}${C.reset} / ${C.red}✗ ${ng}${C.reset} / 全 ${results.length} 枚`);
console.log(`${C.bold}レポート${C.reset}: ${mdPath}`);
process.exit(ng > 0 ? 1 : 0);
