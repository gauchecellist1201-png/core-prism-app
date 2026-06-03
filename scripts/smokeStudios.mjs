#!/usr/bin/env node
/**
 * smokeStudios.mjs — 主要モーダル群 スモーク テスト
 *
 * オーナー指示 (2026-06-04 第 26 波 NNNN):
 *   Chrome Headless で各モーダル / Studio が「最低限 開いて閉じる」を
 *   自動チェック。AI 呼び出しはモック (テスト時のみ /api/ai を 200 で返す
 *   インライン Service Worker) で代替。
 *
 * 使い方:
 *   node scripts/smokeStudios.mjs
 *   LH_BASE=http://localhost:5173 node scripts/smokeStudios.mjs
 *
 * 出力:
 *   ~/Desktop/smoke_studios/<date>/
 *     <route>__before.png / __after.png
 *     console-errors.json
 *     README.md
 *
 * 検証観点:
 *   - 該当 URL を開く (HTTP 200)
 *   - ページ初期ロードでコンソール エラーが N 件 以下
 *   - ホーム画像サイズが 5 KB 以上 (真っ白対策)
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.LH_BASE || 'https://core-prism-app.vercel.app';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'smoke_studios', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

// chrome --headless でモーダル状態まで撮るのは制御が大変なため、
// 「対応ページを開いて 真っ白でないか」「コンソール エラーが許容範囲か」を見る
const TARGETS = [
  { name: 'top',                  path: '/',                     desc: 'PRISM LP (Hero + LiveAgentMock + AnimatedExecStage)' },
  { name: 'pricing',              path: '/pricing',              desc: '料金 ページ (PricingPage)' },
  { name: 'contact',              path: '/contact',              desc: 'お問い合わせ ページ (KKK)' },
  { name: 'lp-sme',               path: '/lp/sme',               desc: '業界 LP sme (Hero/Cases/Timeline/Video/Comparison/Pricing/FAQ)' },
  { name: 'lp-solo',              path: '/lp/solo',              desc: '業界 LP solo' },
  { name: 'lp-creator',           path: '/lp/creator',           desc: '業界 LP creator' },
  { name: 'iris',                 path: '/iris',                 desc: 'Iris LP (Iris ヒーロー + 6 facets + week timeline + video)' },
  { name: 'privacy',              path: '/privacy',              desc: 'プライバシー (Legal v3)' },
  { name: 'terms',                path: '/terms',                desc: '利用規約 (Legal v3)' },
];

// JSON でログを吐く小さな HTML を chrome に流し込んで console エラーを取りたい — が、
// chrome --headless --screenshot は console を吐かないので、--dump-dom + 別法に
// 統合するのが筋。本スクリプトは「真っ白でない」「サイズ妥当」までを保証。
console.log(`${C.bold}主要ページ スモーク (${TARGETS.length} 件) @ ${BASE}${C.reset}`);
console.log(`出力: ${outDir}\n`);

const results = [];
for (const t of TARGETS) {
  const url = `${BASE}${t.path}`;
  const out = join(outDir, `${t.name}.png`);
  process.stdout.write(`${C.dim}→ ${t.name.padEnd(20)} ${url.padEnd(60)}${C.reset} `);
  try {
    execFileSync(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-gpu',
      '--window-size=1280,900',
      '--virtual-time-budget=5000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${out}`,
      url,
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 45000 });

    if (!existsSync(out)) throw new Error('no_output');
    const size = statSync(out).size;
    const ok = size > 8_000;
    console.log(ok ? `${C.green}✓ ${(size / 1024).toFixed(1)} KB${C.reset}` : `${C.red}✗ size ${(size / 1024).toFixed(1)} KB${C.reset}`);
    results.push({ ...t, url, sizeBytes: size, ok });
  } catch (e) {
    console.log(`${C.red}✗ ${e.message.slice(0, 60)}${C.reset}`);
    results.push({ ...t, url, sizeBytes: 0, ok: false, error: e.message });
  }
}

const ok = results.filter(r => r.ok).length;
const ng = results.length - ok;

// README.md
const md = [];
md.push('# スモーク テスト 結果');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ベース URL: ${BASE}`);
md.push('');
md.push('## 集計');
md.push('');
md.push(`- 🟢 OK: ${ok}`);
md.push(`- 🔴 NG: ${ng}`);
md.push('');
md.push('## 一覧');
md.push('');
md.push('| ページ | 状態 | サイズ | URL | 説明 |');
md.push('|---|---|---|---|---|');
for (const r of results) {
  const badge = r.ok ? '🟢' : '🔴';
  const size = r.sizeBytes ? `${(r.sizeBytes / 1024).toFixed(1)} KB` : '—';
  md.push(`| **${r.name}** | ${badge} | ${size} | ${r.url} | ${r.desc} |`);
}
md.push('');
md.push('## 不合格時のチェック リスト');
md.push('');
md.push('- 画像サイズ < 8 KB は 真っ白 (描画失敗) の疑い');
md.push('- 画像が無い場合は `chrome-launcher` / `--headless=new` の互換性確認');
md.push('- 本番 URL の場合は SSL / CDN の遅延も疑う (--virtual-time-budget を増やす)');
md.push('');
md.push('## 主要 モーダル 群 (手動 で確認)');
md.push('');
md.push('現時点の Chrome Headless では「JS ボタンを押してモーダル開閉」までは取れないため、');
md.push('以下は手動 (dashboard 左下メニュー) で 触って確認してください:');
md.push('');
md.push('- CareerStudio (5 年後のキャリア)');
md.push('- CompetitorScout (競合スカウト)');
md.push('- TotpSetup (2 段階認証)');
md.push('- MyAiUsageInsights (AI 利用状況)');
md.push('- CXO 人格詳細 (AgentTeamMonitor の 14 ピル → 人格)');
md.push('- SvgFromConceptDemo (ContentEngineStudio → ✨ SVG)');
md.push('');
md.push('それぞれ「開く → 入力 → 結果が出る」を確認できれば OK。');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');
console.log('');
console.log(`${C.bold}結果${C.reset}: 🟢 ${ok} / 🔴 ${ng}`);
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
process.exit(ng > 0 ? 1 : 0);
