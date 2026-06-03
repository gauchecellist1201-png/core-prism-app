#!/usr/bin/env node
/**
 * checkAtfFit.mjs — Above the Fold (ATF) スクリーンショット + チェックリスト生成
 *
 * 各 LP を iPhone 14 (390×844) の viewport で Chrome Headless で開き、
 * スクリーンショットを撮って ~/Desktop/atf_check/<date>/ に保存。
 * 同時にチェックリスト .md を出力するので、目視で「ヒーロー / 副コピー /
 * CTA ボタンが ATF 内に収まっているか」を判定できる。
 *
 * 使い方:
 *   node scripts/checkAtfFit.mjs                            # 本番デフォルト
 *   LH_BASE=http://localhost:5173 node scripts/checkAtfFit.mjs   # ローカル
 *
 * 必要: macOS の Google Chrome (バンドル済の Chromium ヘッドレス機能を使用)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// ─── 設定 ──────────────────────────────────────────────
const BASE = process.env.LH_BASE || 'https://core-prism-app.vercel.app';
const CHROME = process.env.CHROME_BIN
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// iPhone 14 viewport (390 × 844 / DPR=2 だが ATF 判定は CSS px で良い)
const VIEWPORT = { w: 390, h: 844 };

const LPS = [
  { name: 'top',                  path: '/' },
  { name: 'lp-sme',               path: '/lp/sme' },
  { name: 'lp-realestate-finance', path: '/lp/realestate-finance' },
  { name: 'lp-consulting',        path: '/lp/consulting' },
  { name: 'lp-solo',              path: '/lp/solo' },
  { name: 'lp-creator',           path: '/lp/creator' },
  { name: 'lp-freelance-pro',     path: '/lp/freelance-pro' },
];

const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'atf_check', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m' };

console.log(`${C.bold}ATF check (iPhone 14: ${VIEWPORT.w}×${VIEWPORT.h}) — ${BASE}${C.reset}\n`);

const results = [];

for (const lp of LPS) {
  const url = `${BASE}${lp.path}`;
  const out = join(outDir, `${lp.name}.png`);
  process.stdout.write(`${C.dim}→ ${lp.name.padEnd(28)}${C.reset} `);
  try {
    execFileSync(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      `--window-size=${VIEWPORT.w},${VIEWPORT.h}`,
      '--virtual-time-budget=4500',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${out}`,
      url,
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 });

    let size = 0;
    try { size = statSync(out).size; } catch { /* */ }
    if (size < 5_000) {
      console.log(`${C.red}✗ サイズ ${size}B (撮影失敗?)${C.reset}`);
      results.push({ ...lp, status: 'failed', sizeBytes: size, path: out });
    } else {
      console.log(`${C.green}✓ ${(size / 1024).toFixed(1)} KB${C.reset}`);
      results.push({ ...lp, status: 'ok', sizeBytes: size, path: out });
    }
  } catch (e) {
    console.log(`${C.red}✗ ${e.message.slice(0, 60)}${C.reset}`);
    results.push({ ...lp, status: 'error', sizeBytes: 0, path: out, error: e.message });
  }
}

// ─── チェックリスト .md ───────────────────────────────
const md = [];
md.push('# ATF 自動チェック レポート');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ベース URL: ${BASE}`);
md.push(`viewport: ${VIEWPORT.w} × ${VIEWPORT.h} (iPhone 14)`);
md.push(`スクリーンショット: ${outDir}`);
md.push('');
md.push('## 判定の見方');
md.push('');
md.push('Chrome Headless は実機 Safari と微妙に違うため、スクリーンショットを目視で');
md.push('チェックしてください。以下 3 つが ATF (1 画面目) に「全部入っている」事が合格条件:');
md.push('');
md.push('- [ ] **h1** (ヒーローキャッチ) が見切れずに見える');
md.push('- [ ] **サブコピー** (説明 1 行) が見える');
md.push('- [ ] **CTA ボタン** (「7 日間 無料で試す」など) が押せそうな位置にある');
md.push('');
md.push('## 結果一覧');
md.push('');
md.push('| LP | 状態 | ファイルサイズ | スクリーンショット |');
md.push('|---|---|---|---|');
for (const r of results) {
  const icon = r.status === 'ok' ? '✅' : r.status === 'failed' ? '⚠' : '❌';
  const size = r.sizeBytes ? `${(r.sizeBytes / 1024).toFixed(1)} KB` : '—';
  md.push(`| ${r.name} | ${icon} ${r.status} | ${size} | ![${r.name}](${r.name}.png) |`);
}
md.push('');
md.push('## 修正フロー (NG が出たら)');
md.push('');
md.push('1. 該当 LP の `Hero` セクション padding を縮める');
md.push('2. h1 の font-size を `clamp(...)` で下限を下げる');
md.push('3. 余計な装飾 (LaunchCountdownBanner など) を CTA より下に移動');
md.push('4. 再度 `node scripts/checkAtfFit.mjs` で確認');

const mdPath = join(outDir, 'README.md');
writeFileSync(mdPath, md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
console.log(`${C.bold}レポート${C.reset}: ${mdPath}`);

const ok = results.filter(r => r.status === 'ok').length;
const ng = results.length - ok;
console.log('');
console.log(`${C.green}✓ ${ok}${C.reset} / ${C.red}✗ ${ng}${C.reset} / 全 ${results.length} LP`);
process.exit(ng > 0 ? 1 : 0);
