#!/usr/bin/env node
/**
 * optimizeImages.mjs — public/og/*.png を WebP + AVIF に自動変換
 *
 * オーナー指示 (2026-06-04 第 21 波 AAAA):
 *   LP 用 OG / Hero 画像を WebP / AVIF に変換し、 <picture> タグで
 *   ブラウザに合わせて配信できるようにする。
 *
 * 使い方:
 *   node scripts/optimizeImages.mjs
 *
 * 出力:
 *   public/og/<name>.webp
 *   public/og/<name>.avif (cavif-cli が npx で取れる場合のみ)
 *   ~/Desktop/image_opt/<日付>/picture-snippets.html  ← HTML 雛形
 *
 * 前提:
 *   - macOS の sips を WebP 変換に使用 (macOS Sonoma+ で WebP 出力対応)
 *   - AVIF は npx --yes cavif-cli が取れる環境で生成
 *     失敗時は WebP のみで完了 (HTML 雛形に AVIF 行は出さない)
 */

import { execFileSync, execSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import { homedir } from 'node:os';

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', cyan: '\x1b[36m' };

const PROJECT_ROOT = process.cwd();
const SRC_DIR = resolve(PROJECT_ROOT, 'public', 'og');
const today = new Date().toISOString().slice(0, 10);
const reportDir = join(homedir(), 'Desktop', 'image_opt', today);
mkdirSync(reportDir, { recursive: true });

if (!existsSync(SRC_DIR)) {
  console.error(`${C.red}入力 ディレクトリが見つかりません: ${SRC_DIR}${C.reset}`);
  process.exit(2);
}

const pngs = readdirSync(SRC_DIR).filter(f => f.toLowerCase().endsWith('.png'));
if (pngs.length === 0) {
  console.log(`${C.yellow}public/og/ に .png ファイルが見当たりません。${C.reset}`);
  process.exit(0);
}

console.log(`${C.bold}画像最適化 — ${pngs.length} 個の .png${C.reset}`);
console.log(`入力: ${SRC_DIR}`);
console.log('');

// AVIF が使えるか判定 — cavif-cli を取得可能か (1 回だけ試す)
let avifAvailable = true;
let avifWarnPrinted = false;

const results = [];

for (const filename of pngs) {
  const srcPath = join(SRC_DIR, filename);
  const stem = basename(filename, extname(filename));
  const webpPath = join(SRC_DIR, `${stem}.webp`);
  const avifPath = join(SRC_DIR, `${stem}.avif`);

  const srcSize = statSync(srcPath).size;

  process.stdout.write(`${C.dim}→ ${filename.padEnd(34)}${C.reset} `);

  // ─── WebP via sips ─────────────────────────
  let webpOk = false;
  try {
    execFileSync('sips', [
      '-s', 'format', 'webp',
      srcPath, '--out', webpPath,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    webpOk = existsSync(webpPath) && statSync(webpPath).size > 100;
  } catch (e) {
    /* */
  }

  // ─── AVIF via cavif-cli (npx) ──────────────
  let avifOk = false;
  if (avifAvailable) {
    try {
      execSync(`npx --yes cavif-cli --quality 60 --output "${avifPath}" "${srcPath}"`, {
        stdio: ['ignore', 'ignore', 'pipe'],
        timeout: 60_000,
      });
      avifOk = existsSync(avifPath) && statSync(avifPath).size > 100;
    } catch (e) {
      if (!avifWarnPrinted) {
        avifAvailable = false;
        avifWarnPrinted = true;
      }
    }
  }

  const webpSize = webpOk ? statSync(webpPath).size : 0;
  const avifSize = avifOk ? statSync(avifPath).size : 0;
  const webpRatio = webpOk ? Math.round((1 - webpSize / srcSize) * 100) : 0;
  const avifRatio = avifOk ? Math.round((1 - avifSize / srcSize) * 100) : 0;

  let line = '';
  line += webpOk ? `${C.green}WebP -${webpRatio}%${C.reset}` : `${C.red}WebP ✗${C.reset}`;
  line += '  ';
  line += avifOk ? `${C.green}AVIF -${avifRatio}%${C.reset}` : (avifAvailable ? `${C.red}AVIF ✗${C.reset}` : `${C.yellow}AVIF skip${C.reset}`);
  console.log(line);

  results.push({ stem, filename, srcSize, webpOk, webpSize, webpRatio, avifOk, avifSize, avifRatio });
}

if (avifWarnPrinted) {
  console.log('');
  console.log(`${C.yellow}⚠  AVIF 生成は cavif-cli の取得に失敗したためスキップしました。${C.reset}`);
  console.log(`   有効化するには: npm install -D cavif-cli   を一度実行してください。`);
}

// ─── HTML <picture> 雛形 ─────────────────────
const html = [
  '<!-- AAAA (2026-06-04): WebP / AVIF 自動切替 picture タグの雛形 -->',
  '<!-- 各 OG / Hero 画像に対応 — alt は要更新 -->',
  '',
  ...results.flatMap(r => {
    const lines = [];
    lines.push(`<picture>`);
    if (r.avifOk) lines.push(`  <source srcset="/og/${r.stem}.avif" type="image/avif" />`);
    if (r.webpOk) lines.push(`  <source srcset="/og/${r.stem}.webp" type="image/webp" />`);
    lines.push(`  <img src="/og/${r.filename}" alt="${r.stem}" loading="lazy" decoding="async" />`);
    lines.push(`</picture>`);
    lines.push('');
    return lines;
  }),
];

const htmlPath = join(reportDir, 'picture-snippets.html');
writeFileSync(htmlPath, html.join('\n'), 'utf-8');

// ─── 集計 サマリ md ─────────────────────────
const md = [];
md.push('# 画像最適化 レポート');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`入力 ディレクトリ: ${SRC_DIR}`);
md.push('');
md.push('## 結果 一覧');
md.push('');
md.push('| ファイル | 元サイズ | WebP | AVIF | 削減率 (WebP) | 削減率 (AVIF) |');
md.push('|---|---|---|---|---|---|');
let totalSrc = 0, totalWebp = 0, totalAvif = 0;
for (const r of results) {
  totalSrc += r.srcSize;
  totalWebp += r.webpSize;
  totalAvif += r.avifSize;
  md.push(`| ${r.filename} | ${(r.srcSize / 1024).toFixed(1)} KB | ${r.webpOk ? (r.webpSize / 1024).toFixed(1) + ' KB' : '—'} | ${r.avifOk ? (r.avifSize / 1024).toFixed(1) + ' KB' : '—'} | ${r.webpOk ? '-' + r.webpRatio + '%' : '—'} | ${r.avifOk ? '-' + r.avifRatio + '%' : '—'} |`);
}
md.push('');
md.push(`**合計**: PNG ${(totalSrc / 1024).toFixed(1)} KB → WebP ${(totalWebp / 1024).toFixed(1)} KB (${Math.round((1 - totalWebp / totalSrc) * 100)}% 削減) / AVIF ${(totalAvif / 1024).toFixed(1)} KB (${Math.round((1 - totalAvif / totalSrc) * 100)}% 削減)`);
md.push('');
md.push('## `<picture>` 雛形');
md.push('');
md.push('LP / index.html に貼り付けて使ってください:');
md.push('');
md.push(`📄 ${htmlPath}`);

const mdPath = join(reportDir, 'README.md');
writeFileSync(mdPath, md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}合計${C.reset}: PNG ${(totalSrc / 1024).toFixed(1)} KB → WebP ${(totalWebp / 1024).toFixed(1)} KB${totalAvif > 0 ? ` / AVIF ${(totalAvif / 1024).toFixed(1)} KB` : ''}`);
console.log(`${C.bold}HTML 雛形${C.reset}: ${htmlPath}`);
console.log(`${C.bold}レポート${C.reset}: ${mdPath}`);
