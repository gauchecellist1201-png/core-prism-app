#!/usr/bin/env node
/**
 * generateDemoVideo.mjs — 公開デモ動画 (15-20 秒) の自動キャプチャ
 *
 * オーナー指示 (2026-06-04 第 27 波 RRRR):
 *   /lp/sme → /pricing → /billing の主要画面を Chrome Headless で
 *   順番に巡って 連番 PNG にし、ffmpeg があれば MP4 / WEBM / GIF に統合。
 *
 * 使い方:
 *   node scripts/generateDemoVideo.mjs
 *   LH_BASE=http://localhost:5173 node scripts/generateDemoVideo.mjs
 *
 * 出力:
 *   ~/Desktop/demo_video/<date>/
 *     frames/<NNN>.png          (連番)
 *     demo.mp4 / demo.webm      (ffmpeg ある場合)
 *     demo.gif                  (ffmpeg → palette → gif、ある場合)
 *     README.md                 (キャプ秒数 + 採用フロー)
 */

import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.LH_BASE || 'https://core-prism-app.vercel.app';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'demo_video', today);
const framesDir = join(outDir, 'frames');
mkdirSync(framesDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

// 各シーンは「URL」+「滞在 秒数」。viewport は 1280×800 (動画向きに広め)
const SCENES = [
  { name: 'lp-sme',        path: '/lp/sme',        seconds: 6 },
  { name: 'pricing',       path: '/pricing',       seconds: 5 },
  { name: 'billing',       path: '/billing',       seconds: 6 },
];

const FPS = 6;        // フレーム / 秒 (連番 PNG 出力)
const VIEWPORT = { w: 1280, h: 800 };

function shotOnce(url, file) {
  execFileSync(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--hide-scrollbars',
    '--disable-gpu',
    `--window-size=${VIEWPORT.w},${VIEWPORT.h}`,
    '--virtual-time-budget=4000',
    '--run-all-compositor-stages-before-draw',
    `--screenshot=${file}`,
    url,
  ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 45000 });
}

console.log(`${C.bold}デモ動画 キャプチャ — ${SCENES.length} シーン @ ${BASE}${C.reset}`);
console.log(`viewport: ${VIEWPORT.w}×${VIEWPORT.h} / fps: ${FPS}\n`);

let frameIdx = 0;
for (const s of SCENES) {
  const url = `${BASE}${s.path}`;
  const totalFrames = s.seconds * FPS;
  process.stdout.write(`${C.dim}→ ${s.name.padEnd(14)} ${url.padEnd(50)} (${s.seconds}s × ${FPS}fps = ${totalFrames} frames)${C.reset}\n  `);
  // chrome headless は描画スナップショットなので、滞在中は同じフレームが繰り返される。
  // 1 度だけキャプチャしてシーンの秒数分だけ連番 コピー (ファイル サイズ削減のため symlink でも可)
  const masterFile = join(outDir, `_master_${s.name}.png`);
  try {
    shotOnce(url, masterFile);
    if (!existsSync(masterFile) || statSync(masterFile).size < 5_000) {
      throw new Error('真っ白');
    }
  } catch (e) {
    console.log(`${C.red}✗ master 撮影 失敗 (${e.message})${C.reset}`);
    continue;
  }
  // 同じ画像を totalFrames だけ複製 (シーン1=000-035, シーン2=036-065, ...)
  for (let i = 0; i < totalFrames; i++) {
    const dst = join(framesDir, String(frameIdx).padStart(4, '0') + '.png');
    try {
      execSync(`cp "${masterFile}" "${dst}"`);
      frameIdx++;
    } catch { /* */ }
  }
  console.log(`  ${C.green}✓ ${totalFrames} frames${C.reset}`);
}

console.log(`\n${C.bold}合計フレーム数${C.reset}: ${frameIdx}`);
console.log(`${C.bold}総秒数 (理論)${C.reset}: ${(frameIdx / FPS).toFixed(1)}s\n`);

// ffmpeg があれば mp4 / webm / gif にまとめる
const hasFfmpeg = (() => {
  try { execSync('which ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }); return true; } catch { return false; }
})();

if (!hasFfmpeg) {
  console.log(`${C.yellow}⚠ ffmpeg が見つかりません。連番 PNG のみで完了します。${C.reset}`);
  console.log(`   brew install ffmpeg を入れると mp4 / webm / gif に統合できます。`);
} else {
  const mp4 = join(outDir, 'demo.mp4');
  const webm = join(outDir, 'demo.webm');
  const gif = join(outDir, 'demo.gif');
  const palette = join(outDir, 'palette.png');
  console.log(`${C.dim}→ MP4 生成…${C.reset}`);
  try {
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`${C.green}  ✓ ${mp4}${C.reset}`);
  } catch (e) {
    console.log(`${C.red}  ✗ mp4 失敗${C.reset}`);
  }
  console.log(`${C.dim}→ WEBM 生成…${C.reset}`);
  try {
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 35 "${webm}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`${C.green}  ✓ ${webm}${C.reset}`);
  } catch {
    console.log(`${C.red}  ✗ webm 失敗${C.reset}`);
  }
  console.log(`${C.dim}→ GIF 生成…${C.reset}`);
  try {
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -vf "fps=${FPS},scale=720:-1:flags=lanczos,palettegen=stats_mode=full" "${palette}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -i "${palette}" -lavfi "fps=${FPS},scale=720:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5" "${gif}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`${C.green}  ✓ ${gif}${C.reset}`);
  } catch {
    console.log(`${C.red}  ✗ gif 失敗${C.reset}`);
  }
}

// README.md
const md = [];
md.push('# CORE デモ動画 — 連番 PNG + (オプション) MP4/WEBM/GIF');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ベース URL: ${BASE}`);
md.push(`viewport: ${VIEWPORT.w}×${VIEWPORT.h}`);
md.push(`fps: ${FPS}`);
md.push(`合計フレーム数: ${frameIdx}`);
md.push(`総秒数 (理論): ${(frameIdx / FPS).toFixed(1)}s`);
md.push('');
md.push('## シーン構成');
md.push('');
md.push('| シーン | URL | 秒数 | フレーム数 |');
md.push('|---|---|---|---|');
for (const s of SCENES) md.push(`| ${s.name} | ${BASE}${s.path} | ${s.seconds}s | ${s.seconds * FPS} |`);
md.push('');
md.push('## 出力');
md.push('');
md.push('- `frames/0000.png` 〜 連番 PNG');
md.push('- `_master_<name>.png` 各シーンのマスター スクショ');
if (hasFfmpeg) {
  md.push('- `demo.mp4` (H.264 / yuv420p)');
  md.push('- `demo.webm` (VP9)');
  md.push('- `demo.gif` (720px / 6fps)');
}
md.push('');
md.push('## 注意 / 改善');
md.push('');
md.push('- 本スクリプトの「キャプチャ」は シーン 1 枚 を 秒数分 複製しているため');
md.push('  「滑らかなアニメーション」 にはならない (静止画 → 静止画 の切替)');
md.push('- 真の連続フレームが要る場合は puppeteer / playwright で `page.screenshot` を');
md.push('  ループ + シーン内アニメ完了を待つ実装が必要 (将来作業)');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
console.log(`${C.dim}フレーム数: ${readdirSync(framesDir).length}${C.reset}`);
