#!/usr/bin/env node
/**
 * generateInviteShareCards.mjs — 招待リンク シェア用 OG カード 8 種 自動生成
 *
 * オーナー指示 (2026-06-04 第 42 波 JJJJJJ):
 *   Chrome Headless で 1200×630 PNG を 業界別 7 + Iris ピンク 1 = 8 種 生成。
 *   コピー: 「招待リンクで +7 日 無料」 + 業界の トーン。
 *
 * 使い方:
 *   node scripts/generateInviteShareCards.mjs
 *   REF=ABCD1234 node scripts/generateInviteShareCards.mjs   # 招待コード 埋込
 *
 * 出力:
 *   ~/Desktop/invite_cards/<date>/
 *     invite-<slug>.png    (8 枚)
 *     README.md
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, statSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const REF = process.env.REF || ''; // 招待コード (例: ABCD1234)
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'invite_cards', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m' };

// 8 種 (業界 7 + Iris)
const CARDS = [
  { slug: 'sme',                emoji: '💼', title: '中小企業 経営者 へ', sub: 'AI 役員 14 名 で 経営判断', bgFrom: '#A78BFA', bgTo: '#F472B6', fg: '#fff' },
  { slug: 'realestate-finance', emoji: '🏠', title: '不動産 / 金融 営業 へ', sub: '物件分析 + 顧客対応 を AI に', bgFrom: '#10B981', bgTo: '#06B6D4', fg: '#fff' },
  { slug: 'consulting',         emoji: '🧠', title: 'コンサル 提案 を 5 分で', sub: '提案書 + リサーチ を AI で', bgFrom: '#3B82F6', bgTo: '#8B5CF6', fg: '#fff' },
  { slug: 'solo',               emoji: '👤', title: '個人事業主 の 24 時間 を 24 倍に', sub: '事務 / 営業 / 経理 ぜんぶ AI', bgFrom: '#FBBF24', bgTo: '#F97316', fg: '#1a1a2e' },
  { slug: 'creator',            emoji: '🎨', title: 'クリエイター の 案件管理 を 1 画面で', sub: '案件 + 投稿 + 交渉 を AI', bgFrom: '#EC4899', bgTo: '#FB923C', fg: '#fff' },
  { slug: 'freelance-pro',      emoji: '⚡', title: '高単価 フリーランス の 右腕 AI', sub: '単価 +50% / 工数 ▲50%', bgFrom: '#6366F1', bgTo: '#EC4899', fg: '#fff' },
  { slug: 'saas-startup',       emoji: '🚀', title: '1 人 CEO に、13 人の AI 役員', sub: 'シリーズ A まで 1 人で 走る', bgFrom: '#00D4FF', bgTo: '#3B82F6', fg: '#fff' },
  { slug: 'iris',               emoji: '✨', title: 'クリエイター 向け Iris', sub: 'インスタ × 案件 × 創作 を 6 つの AI で', bgFrom: '#F472B6', bgTo: '#A855F7', fg: '#fff' },
];

const INVITE_URL = REF
  ? `https://core-prism-app.vercel.app/?ref=${REF}`
  : 'https://core-prism-app.vercel.app/';

function esc(s) { return String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

function buildHtml(c) {
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
    background: radial-gradient(circle, rgba(255,255,255,0.32) 0%, transparent 70%);
    filter: blur(60px); pointer-events: none;
  }
  .glow2 {
    position: absolute; bottom: -120px; left: -100px;
    width: 360px; height: 360px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 70%);
    filter: blur(50px); pointer-events: none;
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
    color: ${c.fg === '#fff' ? 'rgba(255,255,255,0.92)' : 'rgba(26,26,46,0.78)'};
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
  .cta strong { font-size: 28px; }
  .brand {
    font-size: 14px; font-weight: 800; letter-spacing: 0.2em;
    opacity: 0.85;
  }
</style>
</head><body>
<div class="glow"></div>
<div class="glow2"></div>
<div class="top">
  <span class="em">${esc(c.emoji)}</span>
  <span class="badge">🎁 招待リンク で +7 日 無料</span>
</div>
<div class="main">
  <div class="title">${esc(c.title)}</div>
  <div class="sub">${esc(c.sub)}</div>
</div>
<div class="bottom">
  <div class="cta">7 日 無料 → <strong>${esc(INVITE_URL.replace('https://', ''))}</strong></div>
  <div class="brand">${c.slug === 'iris' ? '✨ CORE Iris' : '✨ CORE Prism'}</div>
</div>
</body></html>`;
}

function captureToPng(html, outPng) {
  const tmpHtml = join(tmpdir(), `invite-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.html`);
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

console.log(`${C.bold}招待リンク シェア OG カード 8 種 生成${C.reset}`);
console.log(`viewport: 1200×630 / 招待 URL: ${INVITE_URL}\n`);

const results = [];
for (const c of CARDS) {
  const fname = `invite-${c.slug}.png`;
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
md.push('# 招待リンク シェア用 OG カード 8 種');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`招待 URL: ${INVITE_URL}`);
md.push('');
md.push('## 一覧');
md.push('');
md.push('| 業界 | ファイル | サイズ |');
md.push('|---|---|---|');
for (const r of results) {
  md.push(`| ${r.emoji} ${r.title} | \`${r.file || '—'}\` | ${r.ok ? `${(r.size / 1024).toFixed(1)} KB` : `失敗: ${r.error}`} |`);
}
md.push('');
md.push('## 使い方');
md.push('');
md.push('1. AirDrop / Drag&Drop で 端末に 転送');
md.push('2. X (Twitter) / Facebook / LinkedIn に投稿時 添付');
md.push('3. 招待リンク (?ref=) を 自分のコードに 差し替えると 紹介者紐付け');
md.push('');
md.push('## 再実行 (招待コード 埋込)');
md.push('');
md.push('```');
md.push('REF=ABCD1234 node scripts/generateInviteShareCards.mjs');
md.push('```');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

const okCount = results.filter(r => r.ok).length;
console.log('');
console.log(`${C.bold}結果${C.reset}: ${C.green}${okCount}${C.reset} / ${CARDS.length}`);
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
