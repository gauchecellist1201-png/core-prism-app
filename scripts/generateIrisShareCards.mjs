#!/usr/bin/env node
/**
 * generateIrisShareCards.mjs — CORE Iris シェア カード 8 種
 *
 * オーナー指示 (2026-06-04 第 47 波 YYYYYY):
 *   Iris 用 OG カード を 1200×630 で 8 種 生成。
 *   - 4 枚: cat-front 系 (ピンク/オレンジ) — クリエイター 寄り添い
 *   - 4 枚: sparkle 系 (紫/ラベンダー)    — 魔法 / インスピレーション
 *
 * 使い方:
 *   node scripts/generateIrisShareCards.mjs
 *   REF=ABCD1234 node scripts/generateIrisShareCards.mjs  # 招待コード 埋込
 *
 * 出力:
 *   ~/Desktop/iris_share_cards/<date>/
 *     iris-cat-creator.png / cat-instagram.png / cat-newbie.png / cat-veteran.png
 *     iris-sparkle-deal.png / sparkle-content.png / sparkle-monetize.png / sparkle-burnout.png
 *     README.md
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REF = process.env.REF || '';
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'iris_share_cards', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m' };

const INVITE_URL = REF
  ? `https://core-prism-app.vercel.app/iris?ref=${REF}`
  : 'https://core-prism-app.vercel.app/iris';

// ─── 8 種 ─────────────────────────
const CARDS = [
  // cat-front 系 (ピンク/オレンジ)
  { slug: 'cat-creator',  variant: 'cat',     emoji: '🐱', title: 'クリエイター の 24 時間 を 倍に', sub: '案件 + 投稿 + 交渉 を 6 つの AI で', bgFrom: '#F472B6', bgTo: '#FB923C', fg: '#fff' },
  { slug: 'cat-instagram',variant: 'cat',     emoji: '📸', title: 'Instagram も AI が 全部', sub: '投稿 / コメント返信 / 分析 で +35% フォロワー', bgFrom: '#EC4899', bgTo: '#F472B6', fg: '#fff' },
  { slug: 'cat-newbie',   variant: 'cat',     emoji: '🌸', title: '初心者 でも 単価 +35%', sub: 'はじめての 案件交渉 を AI が お手伝い', bgFrom: '#FB923C', bgTo: '#FBBF24', fg: '#1a0a1a' },
  { slug: 'cat-veteran',  variant: 'cat',     emoji: '✨', title: '中堅 → トップ への 押し上げ', sub: '月 +50% 単価 へ AI 戦略 を 1 タップ', bgFrom: '#F472B6', bgTo: '#A855F7', fg: '#fff' },
  // sparkle 系 (紫/ラベンダー)
  { slug: 'sparkle-deal', variant: 'sparkle', emoji: '🪄', title: '案件 交渉 が 5 分 で 終わる',  sub: '見積 / 契約書 / 反論対応 を AI で',     bgFrom: '#A855F7', bgTo: '#6366F1', fg: '#fff' },
  { slug: 'sparkle-content', variant: 'sparkle', emoji: '🎨', title: 'コンテンツ アイデア が 涸れない', sub: '1 タップで SNS 投稿 3 本',          bgFrom: '#8B5CF6', bgTo: '#EC4899', fg: '#fff' },
  { slug: 'sparkle-monetize', variant: 'sparkle', emoji: '💎', title: '副業 → 本業 化 を AI で',     sub: '月 +30 万 円 の 案件 単価 設計',       bgFrom: '#A855F7', bgTo: '#3B82F6', fg: '#fff' },
  { slug: 'sparkle-burnout',  variant: 'sparkle', emoji: '🌙', title: '燃え尽き 撲滅 — 寝る時間 を 取り戻す', sub: '雑務 を AI 6 名 に 全部 丸投げ',      bgFrom: '#6366F1', bgTo: '#A855F7', fg: '#fff' },
];

function esc(s) { return String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

function buildHtml(c) {
  // variant ごと の 装飾 差分 (cat = ふんわり / sparkle = キラキラ)
  const decoration = c.variant === 'cat'
    ? `<div class="glow"></div><div class="glow2"></div>`
    : `<div class="glow"></div><div class="glow2"></div>
       <div class="star" style="top:80px;left:140px;font-size:42px">✨</div>
       <div class="star" style="top:380px;right:120px;font-size:54px">💫</div>
       <div class="star" style="bottom:80px;left:60px;font-size:36px">⭐</div>`;
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif;
    background: linear-gradient(135deg, ${c.bgFrom} 0%, ${c.bgTo} 100%);
    color: ${c.fg};
    display: flex; flex-direction: column; justify-content: space-between;
    padding: 56px 64px; position: relative;
  }
  .glow {
    position: absolute; top: -160px; right: -160px;
    width: 480px; height: 480px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.34) 0%, transparent 70%);
    filter: blur(60px); pointer-events: none;
  }
  .glow2 {
    position: absolute; bottom: -120px; left: -100px;
    width: 360px; height: 360px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    filter: blur(50px); pointer-events: none;
  }
  .star {
    position: absolute;
    opacity: 0.55;
    pointer-events: none;
    filter: drop-shadow(0 0 12px rgba(255,255,255,0.6));
  }
  .top { display: flex; align-items: center; gap: 14px; }
  .top .badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 22px; border-radius: 999px;
    background: rgba(255,255,255,0.22); color: ${c.fg};
    font-size: 18px; font-weight: 800; letter-spacing: 0.04em;
    border: 1px solid rgba(255,255,255,0.4);
  }
  .top .em { font-size: 56px; line-height: 1; }
  .main { margin-top: 28px; }
  .title {
    font-size: 64px; font-weight: 900; line-height: 1.15;
    letter-spacing: -0.02em;
    text-shadow: 0 4px 18px rgba(0,0,0,0.18);
  }
  .sub {
    font-size: 28px; font-weight: 700; margin-top: 18px;
    color: ${c.fg === '#fff' ? 'rgba(255,255,255,0.92)' : 'rgba(26,10,26,0.82)'};
  }
  .bottom {
    display: flex; align-items: flex-end; justify-content: space-between;
  }
  .cta {
    background: rgba(0,0,0,0.18);
    padding: 14px 26px; border-radius: 14px;
    font-size: 22px; font-weight: 800;
    border: 1px solid rgba(255,255,255,0.3);
    color: ${c.fg};
  }
  .cta strong { font-size: 26px; }
  .brand {
    font-size: 14px; font-weight: 800; letter-spacing: 0.2em;
    opacity: 0.85;
  }
</style>
</head><body>
${decoration}
<div class="top">
  <span class="em">${esc(c.emoji)}</span>
  <span class="badge">✨ CORE Iris — クリエイター 専用 AI</span>
</div>
<div class="main">
  <div class="title">${esc(c.title)}</div>
  <div class="sub">${esc(c.sub)}</div>
</div>
<div class="bottom">
  <div class="cta">7 日 無料 → <strong>${esc(INVITE_URL.replace('https://', ''))}</strong></div>
  <div class="brand">✨ CORE Iris</div>
</div>
</body></html>`;
}

function captureToPng(html, outPng) {
  const tmpHtml = join(tmpdir(), `iris-share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
  writeFileSync(tmpHtml, html, 'utf-8');
  try {
    execFileSync(CHROME, [
      '--headless=new', '--no-sandbox', '--hide-scrollbars', '--disable-gpu',
      '--window-size=1200,630',
      '--virtual-time-budget=2000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${outPng}`,
      `file://${tmpHtml}`,
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 });
  } finally {
    try { unlinkSync(tmpHtml); } catch { /* */ }
  }
}

console.log(`${C.bold}CORE Iris シェア カード 8 種 (cat-front × 4 / sparkle × 4)${C.reset}`);
console.log(`viewport: 1200×630 / 招待 URL: ${INVITE_URL}\n`);

const results = [];
for (const c of CARDS) {
  const fname = `iris-${c.slug}.png`;
  const out = join(outDir, fname);
  process.stdout.write(`${C.dim}→ ${fname.padEnd(28)}${C.reset} `);
  try {
    const html = buildHtml(c);
    captureToPng(html, out);
    if (!existsSync(out) || statSync(out).size < 5_000) throw new Error('small');
    const size = statSync(out).size;
    console.log(`${C.green}✓ ${(size / 1024).toFixed(1)} KB${C.reset}`);
    results.push({ ...c, file: fname, ok: true, size });
  } catch (e) {
    console.log(`${C.red}✗ ${e.message}${C.reset}`);
    results.push({ ...c, ok: false, error: e.message });
  }
}

const md = [];
md.push('# CORE Iris シェア カード 8 種');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`招待 URL: ${INVITE_URL}`);
md.push('');
md.push('## cat-front 系 (ピンク / オレンジ — クリエイター 寄り添い)');
md.push('');
md.push('| ファイル | タイトル | サイズ |');
md.push('|---|---|---|');
for (const r of results.filter((x) => x.variant === 'cat')) {
  md.push(`| \`${r.file}\` | ${r.title} | ${r.ok ? `${(r.size / 1024).toFixed(1)} KB` : `失敗: ${r.error}`} |`);
}
md.push('');
md.push('## sparkle 系 (紫 / ラベンダー — 魔法 / インスピレーション)');
md.push('');
md.push('| ファイル | タイトル | サイズ |');
md.push('|---|---|---|');
for (const r of results.filter((x) => x.variant === 'sparkle')) {
  md.push(`| \`${r.file}\` | ${r.title} | ${r.ok ? `${(r.size / 1024).toFixed(1)} KB` : `失敗: ${r.error}`} |`);
}
md.push('');
md.push('## 使い分け');
md.push('');
md.push('- **cat-front 系** = 親しみやすさ / 初心者 / インスタ系 → X / Instagram Story');
md.push('- **sparkle 系**   = プロ / 副業 / 案件交渉 / 経済性 → LinkedIn / note / Threads');
md.push('');
md.push('## 再実行 (招待コード 埋込)');
md.push('');
md.push('```');
md.push('REF=ABCD1234 node scripts/generateIrisShareCards.mjs');
md.push('```');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

const okCount = results.filter(r => r.ok).length;
console.log('');
console.log(`${C.bold}結果${C.reset}: ${C.green}${okCount}${C.reset} / ${CARDS.length}`);
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
