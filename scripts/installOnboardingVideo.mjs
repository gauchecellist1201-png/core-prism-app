#!/usr/bin/env node
/**
 * installOnboardingVideo.mjs — 75 秒オンボ動画を public/ に取り込む
 *
 * オーナー指示 (2026-06-04 第 35 波 OOOOO):
 *   ~/Desktop/onboarding_video/<最新日付>/onboarding.mp4 を
 *   public/onboarding-video.mp4 に コピー + ポスター画像 を 1280×720 で抽出。
 *   これで NNNNN の埋め込み (業界 LP Hero 直下) が 本番で 見られるように。
 *
 * 使い方:
 *   node scripts/installOnboardingVideo.mjs
 *   SRC=~/Desktop/onboarding_video/2026-06-04/onboarding.mp4 node scripts/installOnboardingVideo.mjs
 *
 * 出力:
 *   public/onboarding-video.mp4
 *   public/onboarding-video.webm  (存在すれば)
 *   public/onboarding-poster.jpg  (ffmpeg ある場合のみ)
 */

import { execSync, execFileSync } from 'node:child_process';
import { existsSync, statSync, readdirSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'public');
mkdirSync(PUBLIC_DIR, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

// ─── 1) src 探索 ─────────────────────────
function pickLatestMp4() {
  if (process.env.SRC) return process.env.SRC;
  const base = join(homedir(), 'Desktop', 'onboarding_video');
  if (!existsSync(base)) return '';
  const subs = readdirSync(base)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const s of subs) {
    const p = join(base, s, 'onboarding.mp4');
    if (existsSync(p) && statSync(p).size > 1000) return p;
  }
  return '';
}

const SRC = pickLatestMp4();
if (!SRC || !existsSync(SRC)) {
  console.error(`${C.red}✗ ソース mp4 が見つかりません。${C.reset}`);
  console.error(`   先に: node scripts/generateOnboardingVideo.mjs を実行するか、 SRC=<path> で 指定してください。`);
  process.exit(1);
}

console.log(`${C.bold}オンボ動画 を public/ に取り込み${C.reset}`);
console.log(`ソース: ${SRC}\n`);

// ─── 2) mp4 + webm コピー ─────────────────────────
const dstMp4 = join(PUBLIC_DIR, 'onboarding-video.mp4');
const dstWebm = join(PUBLIC_DIR, 'onboarding-video.webm');
const srcDir = SRC.replace(/\/onboarding\.mp4$/, '');
const srcWebm = join(srcDir, 'onboarding.webm');

try {
  copyFileSync(SRC, dstMp4);
  console.log(`${C.green}✓ ${dstMp4}${C.reset} (${(statSync(dstMp4).size / 1024).toFixed(1)} KB)`);
} catch (e) {
  console.log(`${C.red}✗ mp4 コピー 失敗: ${e.message}${C.reset}`);
  process.exit(1);
}
if (existsSync(srcWebm) && statSync(srcWebm).size > 1000) {
  try {
    copyFileSync(srcWebm, dstWebm);
    console.log(`${C.green}✓ ${dstWebm}${C.reset} (${(statSync(dstWebm).size / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.log(`${C.yellow}⚠ webm コピー 失敗 (続行): ${e.message}${C.reset}`);
  }
} else {
  console.log(`${C.dim}→ webm なし (mp4 のみ)${C.reset}`);
}

// ─── 3) ポスター画像 抽出 (ffmpeg) ─────────────────────────
const hasFfmpeg = (() => {
  try { execSync('which ffmpeg', { stdio: ['ignore', 'pipe', 'ignore'] }); return true; } catch { return false; }
})();

if (!hasFfmpeg) {
  console.log(`${C.yellow}⚠ ffmpeg が見つかりません。ポスター画像はスキップ。${C.reset}`);
} else {
  const posterJpg = join(PUBLIC_DIR, 'onboarding-poster.jpg');
  const posterPng = join(PUBLIC_DIR, 'onboarding-poster.png');
  // 最終フレーム抽出 (sseof=-0.1) で 動画末尾 0.1 秒 のフレームを 取得
  // → 1280×720 にスケール (アスペクト維持で letterbox)
  try {
    // jpg を作る (軽量)
    execSync(`ffmpeg -y -sseof -0.5 -i "${dstMp4}" -vframes 1 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0c0c1c" -q:v 3 "${posterJpg}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
    if (existsSync(posterJpg) && statSync(posterJpg).size > 1000) {
      console.log(`${C.green}✓ ${posterJpg}${C.reset} (${(statSync(posterJpg).size / 1024).toFixed(1)} KB)`);
    } else {
      throw new Error('jpg 出力なし');
    }
  } catch (e) {
    console.log(`${C.yellow}⚠ 最終フレーム抽出 失敗 — 中間フレーム で 再挑戦${C.reset}`);
    // 動画長 が短い時の保険 — 動画 50% 地点を取る
    try {
      execSync(`ffmpeg -y -ss 30 -i "${dstMp4}" -vframes 1 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x0c0c1c" -q:v 3 "${posterJpg}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
      console.log(`${C.green}✓ ${posterJpg}${C.reset}`);
    } catch (e2) {
      console.log(`${C.red}✗ ポスター 抽出 失敗: ${e2.message?.slice(0, 80)}${C.reset}`);
    }
  }
  // png も同時に (HTMLVideoElement poster= に対応しやすい)
  try {
    if (existsSync(posterJpg)) {
      // jpg → png 変換は sips が macOS で速い
      execSync(`sips -s format png "${posterJpg}" --out "${posterPng}"`, { stdio: ['ignore', 'ignore', 'pipe'] });
      if (existsSync(posterPng) && statSync(posterPng).size > 1000) {
        console.log(`${C.green}✓ ${posterPng}${C.reset} (${(statSync(posterPng).size / 1024).toFixed(1)} KB)`);
      }
    }
  } catch { /* macOS 以外なら sips 無し、jpg のみで OK */ }
}

// ─── 4) サマリ ─────────────────────────
console.log('');
console.log(`${C.bold}インストール完了${C.reset}`);
console.log(`本番 URL:`);
console.log(`  https://core-prism-app.vercel.app/onboarding-video.mp4`);
console.log(`  https://core-prism-app.vercel.app/onboarding-poster.jpg`);
console.log('');
console.log(`次のステップ: 通常の git add public/ → commit → push で 本番反映`);
