#!/usr/bin/env node
/**
 * generateOnboardingCaptions.mjs — オンボ動画用 WebVTT 字幕を生成
 *
 * オーナー指示 (2026-06-04 第 44 波 PPPPPP):
 *   既存の onboarding.srt (TTTT で生成) を WebVTT に変換 → public/onboarding-video.vtt
 *   見つからない場合は シーン構成 をハードコードで再生成。
 *
 * 使い方:
 *   node scripts/generateOnboardingCaptions.mjs
 *   SRC=~/Desktop/onboarding_video/2026-06-04/onboarding.srt node scripts/generateOnboardingCaptions.mjs
 *
 * 出力:
 *   public/onboarding-video.vtt
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
mkdirSync(PUBLIC_DIR, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

// ─── 1) SRC 探索 ─────────────────────────
function pickLatestSrt() {
  if (process.env.SRC) return process.env.SRC;
  const base = join(homedir(), 'Desktop', 'onboarding_video');
  if (!existsSync(base)) return '';
  const subs = readdirSync(base)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const s of subs) {
    const p = join(base, s, 'onboarding.srt');
    if (existsSync(p) && statSync(p).size > 100) return p;
  }
  return '';
}

const SRC = pickLatestSrt();

// ─── 2) SRT → VTT 変換 ─────────────────────────
function srtToVtt(srt) {
  // SRT timecode: 00:00:00,000 → VTT: 00:00:00.000
  // 番号行 (1, 2, 3...) は VTT では任意 (cue identifier) → 残してもよい
  const body = srt
    .replace(/\r/g, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body.trim()}\n`;
}

// ─── 3) フォールバック (SRT が無い場合の シーン構成) ─────────────
// generateOnboardingVideo.mjs (TTTT) と 同じ 5 シーン × 15 秒
const FALLBACK_SCENES = [
  { name: '1-lp',          seconds: 15, caption: 'CORE Prism — 中小企業 向け AI 役員 14 名' },
  { name: '2-pricing',     seconds: 15, caption: '7 日 無料体験 — BtoC ¥3,000 / BtoB ¥20,000 〜' },
  { name: '3-dashboard',   seconds: 15, caption: 'ダッシュボード — 14 役員 が並列に動く' },
  { name: '4-cxo-chat',    seconds: 15, caption: 'AI CEO に質問 — 1 ターンで提案が返る' },
  { name: '5-iris',        seconds: 15, caption: 'Iris — クリエイター 専用 AI マネージャー (兄弟製品)' },
];
function formatTcVtt(sec) {
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return `${h}:${m}:${s}.000`;
}
function buildFallbackVtt() {
  const lines = ['WEBVTT', ''];
  let acc = 0;
  FALLBACK_SCENES.forEach((s, i) => {
    const start = acc;
    const end = acc + s.seconds;
    lines.push(String(i + 1));
    lines.push(`${formatTcVtt(start)} --> ${formatTcVtt(end)}`);
    lines.push(s.caption);
    lines.push('');
    acc = end;
  });
  return lines.join('\n');
}

// ─── 4) 実行 ─────────────────────────
let vtt;
if (SRC && existsSync(SRC)) {
  const srt = readFileSync(SRC, 'utf-8');
  vtt = srtToVtt(srt);
  console.log(`${C.bold}WebVTT 生成${C.reset} (SRT 変換)`);
  console.log(`ソース: ${SRC} (${(srt.length / 1024).toFixed(1)} KB)`);
} else {
  vtt = buildFallbackVtt();
  console.log(`${C.bold}WebVTT 生成${C.reset} (SRT 無し → フォールバック 5 シーン)`);
  console.log(`${C.yellow}⚠ SRT が見つかりません — generateOnboardingVideo.mjs を先に実行 推奨${C.reset}`);
}

const outPath = join(PUBLIC_DIR, 'onboarding-video.vtt');
writeFileSync(outPath, vtt, 'utf-8');

console.log('');
console.log(`${C.green}✓ ${outPath}${C.reset} (${(vtt.length / 1024).toFixed(1)} KB)`);
console.log(`${C.dim}行数: ${vtt.split('\n').length}${C.reset}`);

// ─── 5) プレビュー ─────────────────────────
console.log('');
console.log(`${C.bold}プレビュー (上 12 行)${C.reset}:`);
vtt.split('\n').slice(0, 12).forEach((l) => console.log(`  ${l}`));
