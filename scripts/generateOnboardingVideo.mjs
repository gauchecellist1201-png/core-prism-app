#!/usr/bin/env node
/**
 * generateOnboardingVideo.mjs — オンボ チュートリアル動画 (60-90 秒)
 *
 * オーナー指示 (2026-06-04 第 28 波 TTTT):
 *   新規ユーザーが 60-90 秒で「CORE Prism って何ができるの」を理解できる
 *   公式チュートリアル動画を自動キャプチャ。
 *
 * 5 シーン (UTC 順):
 *   1. LP top (/lp/sme)          — 業界 LP のヒーロー (PRISM とは)
 *   2. 料金 (/pricing)            — 価格と 7 日 無料 (登録の理由)
 *   3. ダッシュボード (/?demo=1)   — 14 役員 が動く本体
 *   4. AI 役員 チャット (/?demo=1&chat=ceo) — 1 ターン 質問例
 *   5. Iris (/iris)               — クリエイター 向け も同居 (完了 / 引き寄せ)
 *
 * 使い方:
 *   node scripts/generateOnboardingVideo.mjs
 *   LH_BASE=http://localhost:5173 node scripts/generateOnboardingVideo.mjs
 *
 * 出力:
 *   ~/Desktop/onboarding_video/<date>/
 *     frames/0000.png 〜
 *     _master_<scene>.png
 *     onboarding.mp4 / .webm / .gif (ffmpeg ある場合)
 *     README.md
 */

import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const BASE = process.env.LH_BASE || 'https://core-prism-app.vercel.app';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'onboarding_video', today);
const framesDir = join(outDir, 'frames');
mkdirSync(framesDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

// 5 シーン (15 秒 × 5 = 75 秒 — 規定の 60-90 秒帯)
const SCENES = [
  { name: '1-lp',          path: '/lp/sme',             seconds: 15, caption: 'CORE Prism — 中小企業 向け AI 役員 14 名' },
  { name: '2-pricing',     path: '/pricing',            seconds: 15, caption: '7 日 無料体験 — BtoC ¥3,000 / BtoB ¥20,000 〜' },
  { name: '3-dashboard',   path: '/?demo=1',            seconds: 15, caption: 'ダッシュボード — 14 役員 が並列に動く' },
  { name: '4-cxo-chat',    path: '/?demo=1&chat=ceo',   seconds: 15, caption: 'AI CEO に質問 — 1 ターンで提案が返る' },
  { name: '5-iris',        path: '/iris',               seconds: 15, caption: 'Iris — クリエイター 専用 AI マネージャー (兄弟製品)' },
];

const FPS = 6;
const VIEWPORT = { w: 1280, h: 800 };

function shotOnce(url, file) {
  execFileSync(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--hide-scrollbars',
    '--disable-gpu',
    `--window-size=${VIEWPORT.w},${VIEWPORT.h}`,
    '--virtual-time-budget=5000',
    '--run-all-compositor-stages-before-draw',
    `--screenshot=${file}`,
    url,
  ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 60000 });
}

console.log(`${C.bold}オンボ チュートリアル動画 — ${SCENES.length} シーン @ ${BASE}${C.reset}`);
console.log(`viewport: ${VIEWPORT.w}×${VIEWPORT.h} / fps: ${FPS} / 目標 ${SCENES.reduce((a, s) => a + s.seconds, 0)} 秒\n`);

let frameIdx = 0;
const sceneStats = [];
for (const s of SCENES) {
  const url = `${BASE}${s.path}`;
  const totalFrames = s.seconds * FPS;
  process.stdout.write(`${C.dim}→ ${s.name.padEnd(14)} ${url.padEnd(56)} (${s.seconds}s × ${FPS}fps)${C.reset}\n  `);
  const masterFile = join(outDir, `_master_${s.name}.png`);
  let ok = true;
  try {
    shotOnce(url, masterFile);
    if (!existsSync(masterFile) || statSync(masterFile).size < 5_000) throw new Error('真っ白');
  } catch (e) {
    console.log(`${C.red}✗ master 撮影失敗 (${e.message})${C.reset}`);
    ok = false;
  }
  if (!ok) {
    sceneStats.push({ ...s, frames: 0, ok: false });
    continue;
  }
  for (let i = 0; i < totalFrames; i++) {
    const dst = join(framesDir, String(frameIdx).padStart(4, '0') + '.png');
    try { execSync(`cp "${masterFile}" "${dst}"`); frameIdx++; } catch { /* */ }
  }
  console.log(`  ${C.green}✓ ${totalFrames} frames${C.reset}`);
  sceneStats.push({ ...s, frames: totalFrames, ok: true });
}

console.log(`\n${C.bold}合計フレーム数${C.reset}: ${frameIdx}`);
console.log(`${C.bold}総秒数 (理論)${C.reset}: ${(frameIdx / FPS).toFixed(1)}s\n`);

const hasFfmpeg = (() => {
  try { execSync('which ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }); return true; } catch { return false; }
})();

if (!hasFfmpeg) {
  console.log(`${C.yellow}⚠ ffmpeg なし — 連番 PNG のみ${C.reset}`);
} else {
  const mp4 = join(outDir, 'onboarding.mp4');
  const webm = join(outDir, 'onboarding.webm');
  const gif = join(outDir, 'onboarding.gif');
  const palette = join(outDir, 'palette.png');
  console.log(`${C.dim}→ MP4 生成…${C.reset}`);
  try {
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`${C.green}  ✓ ${mp4}${C.reset}`);
  } catch { console.log(`${C.red}  ✗ mp4 失敗${C.reset}`); }
  console.log(`${C.dim}→ WEBM 生成…${C.reset}`);
  try {
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 35 "${webm}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`${C.green}  ✓ ${webm}${C.reset}`);
  } catch { console.log(`${C.red}  ✗ webm 失敗${C.reset}`); }
  console.log(`${C.dim}→ GIF 生成…${C.reset}`);
  try {
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -vf "fps=${FPS},scale=720:-1:flags=lanczos,palettegen=stats_mode=full" "${palette}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    execSync(`ffmpeg -y -framerate ${FPS} -i "${framesDir}/%04d.png" -i "${palette}" -lavfi "fps=${FPS},scale=720:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5" "${gif}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`${C.green}  ✓ ${gif}${C.reset}`);
  } catch { console.log(`${C.red}  ✗ gif 失敗${C.reset}`); }
}

// 字幕 / シナリオ 同梱 (.srt 形式で SNS 編集ツールにそのまま投入)
const srt = [];
let acc = 0;
sceneStats.forEach((s, i) => {
  const start = acc;
  const end = acc + s.seconds;
  srt.push(String(i + 1));
  srt.push(`${formatTC(start)} --> ${formatTC(end)}`);
  srt.push(s.caption);
  srt.push('');
  acc = end;
});
writeFileSync(join(outDir, 'onboarding.srt'), srt.join('\n'), 'utf-8');

const md = [];
md.push('# CORE Prism オンボ チュートリアル動画 (60-90 秒)');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`ベース URL: ${BASE}`);
md.push(`viewport: ${VIEWPORT.w}×${VIEWPORT.h}`);
md.push(`fps: ${FPS} / 合計フレーム数: ${frameIdx} / 総秒数: ${(frameIdx / FPS).toFixed(1)}s`);
md.push('');
md.push('## シーン構成 (15s × 5 = 75s)');
md.push('');
md.push('| # | シーン | URL | 秒数 | キャプション |');
md.push('|---|---|---|---|---|');
sceneStats.forEach((s, i) => md.push(`| ${i + 1} | ${s.name} | ${BASE}${s.path} | ${s.seconds}s | ${s.caption} |`));
md.push('');
md.push('## 出力');
md.push('');
md.push('- `frames/0000.png` 〜 連番 PNG');
md.push('- `_master_<scene>.png` 各シーンの master');
md.push('- `onboarding.srt` SubRip 字幕 (TikTok/YouTube 直貼り可)');
if (hasFfmpeg) {
  md.push('- `onboarding.mp4` (H.264)');
  md.push('- `onboarding.webm` (VP9)');
  md.push('- `onboarding.gif` (720px / 6fps)');
}
md.push('');
md.push('## 使い方');
md.push('');
md.push('1. **オンボ動画として** — ダッシュボード初回ログイン時の Welcome ツアー に埋込 (NNN ツアー の補強)');
md.push('2. **LP 用に** — `/lp/sme` IndustryVideoSection (DDDD) の `videoUrl` に 差し替え');
md.push('3. **SNS 投稿** — 縦/横 でリサイズ後、X / Instagram Reels / TikTok に。`onboarding.srt` で字幕焼き込み');
md.push('');
md.push('## 改善メモ');
md.push('');
md.push('- シーン内アニメ (LiveAgentMock 等) は 1 フレームしか取れないため、滑らかな');
md.push('  アニメは別途 puppeteer + `page.screenshot` を 6fps ループで実装する必要あり');
md.push('- 動画に「ナレーション」を載せたい場合は ElevenLabs (英) / VoiceText (日) で生成 →');
md.push('  `ffmpeg -i onboarding.mp4 -i narr.mp3 -c copy -shortest narrated.mp4`');
md.push('- BGM が要る場合: `ffmpeg -i onboarding.mp4 -i bgm.mp3 -c:v copy -filter_complex "[1:a]volume=0.15[a]" -map 0:v -map "[a]" -shortest final.mp4`');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
console.log(`${C.dim}フレーム数: ${readdirSync(framesDir).length}${C.reset}`);

function formatTC(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${h}:${m}:${s},000`;
}
