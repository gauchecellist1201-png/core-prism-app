#!/usr/bin/env node
/**
 * generateIndustryOg.mjs — 業界別 LP の OG 画像 (1200×630) を Chrome Headless で自動生成
 *
 * オーナー指示 (2026-06-04 第 24 波 IIII):
 *   業種ロゴ (絵文字) + 数字 + キャッチ + CORE ロゴ を含む PNG。
 *
 * 使い方:
 *   node scripts/generateIndustryOg.mjs
 *
 * 出力:
 *   public/og/industry-<slug>.png
 *   (既存 OG と同名衝突を避けて industry- prefix で保存)
 *
 * 前提:
 *   macOS の Google Chrome (/Applications/Google Chrome.app)
 *   Chrome Headless で SVG → PNG レンダリング
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const PROJECT_ROOT = process.cwd();
const OUT_DIR = resolve(PROJECT_ROOT, 'public', 'og');
const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m' };

// 業種別 設定 (slug は IndustryLanding と一致)
const INDUSTRIES = [
  {
    slug: 'sme',
    emoji: '💼',
    title: 'AI 役員 14 名で\n会社が動き続ける',
    metric: '事務時間\n月 28h → 6h',
    bgFrom: '#A78BFA', bgTo: '#F472B6', textFg: '#fff',
  },
  {
    slug: 'realestate-finance',
    emoji: '🏠',
    title: '物件分析 + 顧客対応\nを AI に丸投げ',
    metric: '提案速度\n3 倍',
    bgFrom: '#10B981', bgTo: '#06B6D4', textFg: '#fff',
  },
  {
    slug: 'consulting',
    emoji: '🧠',
    title: '提案書 + リサーチ\nを 5 分で',
    metric: '提案準備\n8h → 30分',
    bgFrom: '#3B82F6', bgTo: '#8B5CF6', textFg: '#fff',
  },
  {
    slug: 'solo',
    emoji: '👤',
    title: '事務・営業・経理\nぜんぶ AI に任せる',
    metric: '本業時間\n+ 20h / 週',
    bgFrom: '#FBBF24', bgTo: '#F97316', textFg: '#1a1a2e',
  },
  {
    slug: 'creator',
    emoji: '🎨',
    title: '案件 + 投稿 + 交渉\nが 1 画面で完結',
    metric: '案件単価\n+ 35%',
    bgFrom: '#EC4899', bgTo: '#FB923C', textFg: '#fff',
  },
  {
    slug: 'freelance-pro',
    emoji: '⚡',
    title: '高単価フリーランスの\n右腕 AI',
    metric: '単価\n+ 50%',
    bgFrom: '#6366F1', bgTo: '#EC4899', textFg: '#fff',
  },
  {
    slug: 'saas-startup',
    emoji: '🚀',
    title: '1 人 CEO に、\n13 人の AI 役員',
    metric: '創業期 雑務\n▲ 75%',
    bgFrom: '#00D4FF', bgTo: '#3B82F6', textFg: '#fff',
  },
];

function buildHtml(it) {
  // 1200×630 を CSS で固定 (Chrome の window-size と一致させ、--screenshot は viewport を撮る)
  const esc = (s) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c));
  const titleHtml = esc(it.title).replace(/\n/g, '<br />');
  const metricHtml = esc(it.metric).replace(/\n/g, '<br />');
  return `<!DOCTYPE html>
<html lang="ja"><head>
<meta charset="UTF-8" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body {
    font-family: 'Inter', '-apple-system', BlinkMacSystemFont, 'Hiragino Sans', 'Yu Gothic', sans-serif;
    background: linear-gradient(135deg, ${it.bgFrom} 0%, ${it.bgTo} 100%);
    color: ${it.textFg};
    display: flex;
    position: relative;
  }
  .glow {
    position: absolute; top: -120px; right: -120px;
    width: 480px; height: 480px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 70%);
    filter: blur(60px);
    pointer-events: none;
  }
  .glow2 {
    position: absolute; bottom: -100px; left: -80px;
    width: 360px; height: 360px; border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
    filter: blur(50px);
    pointer-events: none;
  }
  .left {
    flex: 1.6;
    padding: 60px 60px 50px 80px;
    display: flex; flex-direction: column;
    justify-content: space-between;
    position: relative; z-index: 1;
  }
  .top-bar {
    display: flex; align-items: center; gap: 12px;
    font-size: 18px; letter-spacing: 0.4em; font-weight: 800;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .top-bar .dot { width: 10px; height: 10px; border-radius: 5px; background: ${it.textFg}; }
  .emoji { font-size: 120px; line-height: 1; margin-bottom: 12px; }
  .title { font-size: 60px; font-weight: 900; line-height: 1.18; letter-spacing: -0.01em; }
  .urlbar {
    display: flex; align-items: center; gap: 14px;
    font-family: 'Menlo', monospace; font-size: 18px; opacity: 0.85;
  }
  .urlbar .core {
    font-family: inherit; font-weight: 900; letter-spacing: 0.04em;
    padding: 8px 18px; border-radius: 999px;
    background: ${it.textFg}; color: ${it.bgFrom};
  }
  .right {
    flex: 1;
    padding: 80px 80px 80px 0;
    display: flex; flex-direction: column;
    justify-content: center; align-items: flex-end;
    position: relative; z-index: 1;
  }
  .metric-card {
    background: rgba(255,255,255,0.18);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 32px;
    padding: 36px 44px;
    text-align: center;
    box-shadow: 0 24px 60px rgba(0,0,0,0.18);
  }
  .metric-label {
    font-size: 16px; letter-spacing: 0.3em; font-weight: 800;
    text-transform: uppercase; opacity: 0.85; margin-bottom: 10px;
  }
  .metric-value {
    font-size: 52px; font-weight: 900; line-height: 1.2;
  }
</style>
</head>
<body>
  <div class="glow" aria-hidden></div>
  <div class="glow2" aria-hidden></div>
  <div class="left">
    <div>
      <div class="top-bar"><span class="dot"></span> CORE · /lp/${it.slug}</div>
    </div>
    <div>
      <div class="emoji">${esc(it.emoji)}</div>
      <div class="title">${titleHtml}</div>
    </div>
    <div class="urlbar">
      <span class="core">CORE</span> Prism — 7 日間 無料
    </div>
  </div>
  <div class="right">
    <div class="metric-card">
      <div class="metric-label">期待効果</div>
      <div class="metric-value">${metricHtml}</div>
    </div>
  </div>
</body></html>`;
}

console.log(`${C.bold}業界別 OG 画像 生成 — ${INDUSTRIES.length} 枚${C.reset}`);
console.log(`出力: ${OUT_DIR}\n`);

let okCount = 0;
let ngCount = 0;

for (const it of INDUSTRIES) {
  const tmpHtml = join(tmpdir(), `industry-og-${it.slug}.html`);
  const out = join(OUT_DIR, `industry-${it.slug}.png`);
  writeFileSync(tmpHtml, buildHtml(it), 'utf-8');
  process.stdout.write(`${C.dim}→ industry-${it.slug.padEnd(24)}${C.reset} `);
  try {
    execFileSync(CHROME, [
      '--headless=new',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-gpu',
      '--window-size=1200,630',
      '--virtual-time-budget=2500',
      '--default-background-color=00000000',
      `--screenshot=${out}`,
      `file://${tmpHtml}`,
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 30000 });
    console.log(`${C.green}✓${C.reset} ${out}`);
    okCount++;
  } catch (e) {
    console.log(`${C.red}✗ ${e.message.slice(0, 60)}${C.reset}`);
    ngCount++;
  } finally {
    try { unlinkSync(tmpHtml); } catch { /* */ }
  }
}

console.log('');
console.log(`${C.bold}結果${C.reset}: ${C.green}✓ ${okCount}${C.reset} / ${C.red}✗ ${ngCount}${C.reset}`);
console.log('');
console.log('次の作業:');
console.log('  各 industry-<slug>.html (LP テンプレ) の og:image を /og/industry-<slug>.png に差し替え');
console.log('  または industries.ts に metaOgImage を追加 → IndustryLanding 内で <meta> 出力');
process.exit(ngCount > 0 ? 1 : 0);
