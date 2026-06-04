#!/usr/bin/env node
/**
 * generateLockScreenWidget.mjs — iPhone Widget 風 PNG 3 枚 自動生成
 *
 * オーナー指示 (2026-06-04 第 32 波 HHHHH):
 *   今日の主要 KPI を 縦長 396×484 (iPhone Medium Widget 風) PNG にして
 *   AirDrop で共有しやすい形で ~/Desktop/widgets/<date>/ に保存。
 *
 *   3 枚:
 *     1. 売上          (今月)
 *     2. AI 採用率      (7 日)
 *     3. オンボ完了率   (7 日)
 *
 * データソース:
 *   - API_BASE (既定 https://core-prism-app.vercel.app) の API を叩いて取得
 *     - /api/cron/daily-stripe-slack (master key 経由は重いので、まずは Upstash の月次集計を読む API があれば使う)
 *     - /api/track/onboarding-step?days=14
 *     - 採用率 は localStorage のため API には無い → ダッシュ表示 用の「ダミー」として 「—」を出すか、
 *       --adopted=N --total=N で 引数指定 する
 *
 * 使い方:
 *   node scripts/generateLockScreenWidget.mjs
 *   ADOPTED=15 TOTAL=20 REVENUE=152000 ONBOARD=63 node scripts/generateLockScreenWidget.mjs
 *
 * 出力:
 *   ~/Desktop/widgets/<date>/
 *     widget-revenue.png     (396×484)
 *     widget-adoption.png    (396×484)
 *     widget-onboarding.png  (396×484)
 *     README.md
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'widgets', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

const W = 396, H = 484;

// ─── 1) データ取得 ─────────────────────────
async function fetchOnboardCompletionRate() {
  try {
    const res = await fetch(`${API_BASE}/api/track/onboarding-step?days=7`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    if (!j.configured) return null;
    const days = j.days || [];
    let w = 0, c = 0;
    for (const d of days) {
      w += (d.data?.welcome || 0);
      c += (d.data?.completed || 0);
    }
    return w > 0 ? Math.round((c / w) * 1000) / 10 : 0;
  } catch (e) {
    return null;
  }
}
async function fetchStatus() {
  // public /api/status から最新 ok 状況 (オーバーオールだけ)
  try {
    const res = await fetch(`${API_BASE}/api/status`);
    if (!res.ok) return null;
    const j = await res.json();
    return j;
  } catch { return null; }
}

const revenue = process.env.REVENUE ? Number(process.env.REVENUE) : null;
const adopted = process.env.ADOPTED ? Number(process.env.ADOPTED) : null;
const total = process.env.TOTAL ? Number(process.env.TOTAL) : null;
const adoptionRate = (adopted !== null && total !== null && total > 0) ? Math.round((adopted / total) * 1000) / 10 : null;

const envOnboard = process.env.ONBOARD ? Number(process.env.ONBOARD) : null;

console.log(`${C.bold}iPhone Widget 風 PNG 3 枚 生成${C.reset}`);
console.log(`viewport: ${W}×${H} / 出力: ${outDir}\n`);

const onboardRate = envOnboard !== null ? envOnboard : await fetchOnboardCompletionRate();
const status = await fetchStatus();
const overall = status?.overall || 'operational';
const overallText = overall === 'operational' ? 'All systems OK' : overall === 'degraded' ? '一部 劣化' : '主要障害';

// ─── 2) HTML テンプレ ─────────────────────────
function buildHtml({ emoji, label, valueBig, valueSub, accentFrom, accentTo, footer }) {
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif;
    background: linear-gradient(155deg, ${accentFrom} 0%, ${accentTo} 100%);
    color: #fff;
    padding: 28px 24px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .glow {
    position: absolute; top: -100px; right: -100px;
    width: 320px; height: 320px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.32) 0%, transparent 70%);
    filter: blur(40px); pointer-events: none;
  }
  .glow2 {
    position: absolute; bottom: -80px; left: -60px;
    width: 240px; height: 240px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    filter: blur(40px); pointer-events: none;
  }
  .top {
    display: flex; align-items: center; gap: 10px;
    font-size: 11px; letter-spacing: 0.18em;
    text-transform: uppercase; font-weight: 800;
    color: rgba(255,255,255,0.9);
  }
  .top .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #34D399;
    box-shadow: 0 0 8px #34D399;
  }
  .emoji {
    font-size: 54px; line-height: 1; margin-top: 8px;
    text-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .label {
    font-size: 14px; font-weight: 700;
    color: rgba(255,255,255,0.78);
    margin-top: 4px; letter-spacing: 0.02em;
  }
  .big {
    font-size: 64px; font-weight: 900;
    line-height: 1.05; margin-top: 8px;
    letter-spacing: -0.02em;
    text-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }
  .sub {
    font-size: 16px; font-weight: 700;
    color: rgba(255,255,255,0.78);
    margin-top: 4px;
  }
  .footer {
    display: flex; align-items: center; justify-content: space-between;
    font-size: 11px; font-weight: 700;
    color: rgba(255,255,255,0.55);
    letter-spacing: 0.04em;
  }
  .brand {
    display: inline-flex; align-items: center; gap: 4px;
    color: rgba(255,255,255,0.8);
    font-weight: 800;
  }
</style>
</head><body>
<div class="glow"></div>
<div class="glow2"></div>
<div>
  <div class="top"><span class="dot"></span> CORE · ${today}</div>
  <div class="emoji">${emoji}</div>
  <div class="label">${label}</div>
  <div class="big">${valueBig}</div>
  <div class="sub">${valueSub}</div>
</div>
<div class="footer">
  <span>${footer}</span>
  <span class="brand">✨ CORE Prism</span>
</div>
</body></html>`;
}

// ─── 3) 3 枚 構成 ─────────────────────────
const widgets = [
  {
    name: 'widget-revenue',
    emoji: '💴',
    label: '今月の売上',
    valueBig: revenue !== null ? `¥${revenue.toLocaleString('ja-JP')}` : '—',
    valueSub: revenue !== null ? 'Stripe 集計 (live, jpy)' : 'REVENUE env で指定',
    accentFrom: '#34D399',
    accentTo: '#0F766E',
    footer: revenue !== null ? '集計: Stripe Charges' : '値は env REVENUE を指定',
  },
  {
    name: 'widget-adoption',
    emoji: '🧠',
    label: 'AI 提案 採用率 (7 日)',
    valueBig: adoptionRate !== null ? `${adoptionRate}%` : '—',
    valueSub: (adopted !== null && total !== null) ? `${adopted} / ${total} 件 採用` : 'ADOPTED / TOTAL env で指定',
    accentFrom: '#6366F1',
    accentTo: '#A855F7',
    footer: '集計: localStorage 由来 (端末)',
  },
  {
    name: 'widget-onboarding',
    emoji: '🌱',
    label: 'オンボ 完了率 (7 日)',
    valueBig: onboardRate !== null ? `${onboardRate}%` : '—',
    valueSub: onboardRate !== null ? 'welcome → completed' : '/api/track/onboarding-step',
    accentFrom: '#F472B6',
    accentTo: '#FB923C',
    footer: onboardRate !== null ? 'Upstash 集計' : 'Upstash 未設定',
  },
];

// ─── 4) Chrome Headless で キャプチャ ─────────────────────────
function captureToPng(html, outPng) {
  const tmpHtml = join(tmpdir(), `widget-${Date.now()}.html`);
  writeFileSync(tmpHtml, html, 'utf-8');
  try {
    execFileSync(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-gpu',
      `--window-size=${W},${H}`,
      '--virtual-time-budget=2000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${outPng}`,
      `file://${tmpHtml}`,
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 });
  } finally {
    try { unlinkSync(tmpHtml); } catch { /* */ }
  }
}

const results = [];
for (const w of widgets) {
  const out = join(outDir, `${w.name}.png`);
  process.stdout.write(`${C.dim}→ ${w.name.padEnd(22)}${C.reset} `);
  try {
    const html = buildHtml(w);
    captureToPng(html, out);
    if (!existsSync(out) || statSync(out).size < 4_000) throw new Error('小さすぎ');
    const size = statSync(out).size;
    console.log(`${C.green}✓ ${(size / 1024).toFixed(1)} KB${C.reset}`);
    results.push({ ...w, out, ok: true, size });
  } catch (e) {
    console.log(`${C.red}✗ ${e.message}${C.reset}`);
    results.push({ ...w, ok: false, error: e.message });
  }
}

// ─── 5) README ─────────────────────────
const md = [];
md.push('# CORE Widget 風 PNG 3 枚');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push(`viewport: ${W}×${H}`);
md.push(`全体ステータス: ${overall} (${overallText})`);
md.push('');
md.push('## 3 枚');
md.push('');
md.push('| 枚 | ファイル | 値 | サイズ |');
md.push('|---|---|---|---|');
for (const r of results) {
  md.push(`| ${r.emoji} ${r.label} | \`${r.name}.png\` | ${r.valueBig} | ${r.ok ? `${(r.size / 1024).toFixed(1)} KB` : `失敗: ${r.error}`} |`);
}
md.push('');
md.push('## AirDrop の手順');
md.push('');
md.push('1. Finder で 出力フォルダを開く: `open ' + outDir + '`');
md.push('2. PNG を選択 → 共有 (右クリック) → AirDrop → iPhone');
md.push('3. 受信した iPhone の写真アプリ → 「ロック画面 の壁紙にする」 (任意)');
md.push('');
md.push('## env で値を指定');
md.push('');
md.push('AI 採用率 / 売上 は API 経由で取得できないので env で渡す:');
md.push('');
md.push('```bash');
md.push('REVENUE=152000 ADOPTED=15 TOTAL=20 ONBOARD=63 node scripts/generateLockScreenWidget.mjs');
md.push('```');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

console.log('');
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
const okCount = results.filter(r => r.ok).length;
console.log(`${C.bold}結果${C.reset}: ${C.green}${okCount}${C.reset} / ${widgets.length}`);
process.exit(okCount === widgets.length ? 0 : 1);
