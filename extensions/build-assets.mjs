#!/usr/bin/env node
/**
 * Chrome Web Store asset builder for CORE Prism / CORE Iris.
 *
 * Generates the following PNGs into
 *   - extensions/prism/store-assets/
 *   - extensions/iris/store-assets/
 *
 * | File                       | Size       | Use                          |
 * |----------------------------|------------|------------------------------|
 * | promo-1024x500.png         | 1024×500   | Small promo tile (required)  |
 * | promo-440x280.png          | 440×280    | Marquee tile (optional)      |
 * | screenshot-1.png … 5.png   | 1280×800   | Store screenshots (required) |
 *
 * Layout is rendered as inline SVG and rasterised by sharp.
 * Run with: npm run build:store-assets
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);

/* ---------------------------------------------------------------------- */
/* Shared primitives                                                      */
/* ---------------------------------------------------------------------- */

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Hiragino Kaku Gothic ProN", system-ui, sans-serif';

/** Escape XML reserved chars so user-supplied text can't break the SVG. */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Brand palettes — kept in sync with extensions/{prism,iris}/popup.css
 * and src/corporate/AgentTeamMonitor.tsx accent colours.
 */
const BRANDS = {
  prism: {
    name: 'CORE Prism',
    tagline: 'AI 経営参謀（13 CXO）',
    accent: '#A78BFA',
    accent2: '#7C3AED',
    accentSoft: 'rgba(167,139,250,0.22)',
    bg0: '#0A0A14',
    bg1: '#1A0E2E',
    bg2: '#11111A',
    storeDir: 'prism/store-assets',
  },
  iris: {
    name: 'CORE Iris',
    tagline: 'Instagram 専属 AI マネージャー',
    accent: '#E1306C',
    accent2: '#F472B6',
    accentSoft: 'rgba(225,48,108,0.24)',
    bg0: '#0A0A14',
    bg1: '#2A0F1F',
    bg2: '#11111A',
    storeDir: 'iris/store-assets',
  },
};

/**
 * CXO metadata, mirrors src/agents/CxoMeta.ts (truncated to 13).
 * `glyph` is a plain-text monogram instead of an emoji — librsvg's Pango stack
 * can't always reach an emoji font in headless renders, so the screenshots use
 * the role initial inside the bubble instead.
 */
const CXO_LIST = [
  { role: 'CEO', glyph: 'CE', label: 'イーロン',   color: '#FBBF24', desc: '戦略・最終判断' },
  { role: 'CTO', glyph: 'CT', label: 'テック',     color: '#60A5FA', desc: 'コード・実装' },
  { role: 'CPO', glyph: 'CP', label: 'プロダクト', color: '#A78BFA', desc: '仕様・優先順' },
  { role: 'CDO', glyph: 'CD', label: 'デザイン',   color: '#F472B6', desc: 'デザイン磨き' },
  { role: 'CMO', glyph: 'CM', label: 'マーケ',     color: '#FB923C', desc: 'コピー・拡散' },
  { role: 'CSO', glyph: 'CS', label: 'セールス',   color: '#34D399', desc: '案件探索' },
  { role: 'CFO', glyph: 'CF', label: '財務',       color: '#10B981', desc: '数字・経費' },
  { role: 'COO', glyph: 'CO', label: 'オペレ',     color: '#9CA3AF', desc: '運用・整理' },
  { role: 'CDS', glyph: 'DS', label: 'データ',     color: '#06B6D4', desc: '分析・洞察' },
  { role: 'CLO', glyph: 'CL', label: '法務',       color: '#6366F1', desc: '規約・遵守' },
  { role: 'UIE', glyph: 'UI', label: 'UI エンジニア', color: '#EC4899', desc: 'UI 細部' },
  { role: 'CRO', glyph: 'CR', label: 'カスタマー', color: '#F59E0B', desc: '顧客成功' },
  { role: 'CHO', glyph: 'CH', label: 'ピープル',   color: '#22D3EE', desc: 'チーム成長' },
];

/* ---------------------------------------------------------------------- */
/* SVG building blocks                                                    */
/* ---------------------------------------------------------------------- */

function gradientDefs(brand, idPrefix = 'g') {
  return `
    <defs>
      <linearGradient id="${idPrefix}-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${brand.bg0}" />
        <stop offset="55%" stop-color="${brand.bg1}" />
        <stop offset="100%" stop-color="${brand.bg2}" />
      </linearGradient>
      <linearGradient id="${idPrefix}-accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${brand.accent2}" />
        <stop offset="100%" stop-color="${brand.accent}" />
      </linearGradient>
      <radialGradient id="${idPrefix}-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${brand.accent}" stop-opacity="0.55" />
        <stop offset="100%" stop-color="${brand.accent}" stop-opacity="0" />
      </radialGradient>
      <filter id="${idPrefix}-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="14" />
      </filter>
    </defs>
  `;
}

/**
 * A logo block that pairs the brand name with the tagline. Placed at (x,y)
 * relative to the parent SVG.
 */
function logoBlock(brand, { x, y, size = 'lg' }) {
  const titlePx = size === 'lg' ? 64 : 40;
  const tagPx = size === 'lg' ? 22 : 16;
  const dotSize = titlePx * 0.55;
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="${-dotSize / 1.4}" width="${dotSize}" height="${dotSize}" rx="${dotSize * 0.22}"
        fill="url(#g-accent)" />
      <text x="${dotSize + 18}" y="0" font-family='${FONT_STACK}'
        font-size="${titlePx}" font-weight="800" fill="#ffffff" dominant-baseline="middle">${esc(brand.name)}</text>
      <text x="${dotSize + 18}" y="${titlePx * 0.7}" font-family='${FONT_STACK}'
        font-size="${tagPx}" font-weight="500" fill="rgba(255,255,255,0.7)" dominant-baseline="hanging">${esc(brand.tagline)}</text>
    </g>
  `;
}

/**
 * Wrap chrome around an inner illustration: drop shadow, rounded card,
 * traffic-light dots that mimic a browser window.
 */
function browserCard({ x, y, w, h, inner, url = 'core-prism-app.vercel.app' }) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="${w}" height="${h}" rx="20" fill="#0F0F18" stroke="rgba(255,255,255,0.08)" />
      <rect x="0" y="0" width="${w}" height="42" rx="20" fill="#181826" />
      <rect x="0" y="22" width="${w}" height="20" fill="#181826" />
      <circle cx="22" cy="21" r="6" fill="#FF5F57" />
      <circle cx="42" cy="21" r="6" fill="#FEBC2E" />
      <circle cx="62" cy="21" r="6" fill="#28C840" />
      <rect x="${w / 2 - 160}" y="11" width="320" height="22" rx="11" fill="#0A0A14" />
      <text x="${w / 2}" y="22" font-family='${FONT_STACK}' font-size="13" fill="rgba(255,255,255,0.55)"
        text-anchor="middle" dominant-baseline="middle">${esc(url)}</text>
      <g transform="translate(0, 50)">${inner}</g>
    </g>
  `;
}

/* ---------------------------------------------------------------------- */
/* Promo tiles                                                            */
/* ---------------------------------------------------------------------- */

function promoTileSvg(brand, { w, h, headline, sub }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${gradientDefs(brand)}
  <rect width="${w}" height="${h}" fill="url(#g-bg)" />
  <circle cx="${w * 0.82}" cy="${h * 0.35}" r="${h * 0.55}" fill="url(#g-glow)" />
  <circle cx="${w * 0.15}" cy="${h * 0.85}" r="${h * 0.5}" fill="url(#g-glow)" opacity="0.5" />
  <g opacity="0.18" stroke="${brand.accent}" stroke-width="1" fill="none">
    <circle cx="${w * 0.82}" cy="${h * 0.35}" r="${h * 0.22}" />
    <circle cx="${w * 0.82}" cy="${h * 0.35}" r="${h * 0.34}" />
    <circle cx="${w * 0.82}" cy="${h * 0.35}" r="${h * 0.46}" />
  </g>

  <text x="${w * 0.06}" y="${h * 0.42}" font-family='${FONT_STACK}'
    font-size="${Math.round(h * 0.16)}" font-weight="900" fill="#ffffff">${esc(brand.name)}</text>
  <text x="${w * 0.06}" y="${h * 0.6}" font-family='${FONT_STACK}'
    font-size="${Math.round(h * 0.085)}" font-weight="700" fill="url(#g-accent)">${esc(headline)}</text>
  <text x="${w * 0.06}" y="${h * 0.78}" font-family='${FONT_STACK}'
    font-size="${Math.round(h * 0.05)}" font-weight="500" fill="rgba(255,255,255,0.72)">${esc(sub)}</text>

  <rect x="${w - 40}" y="${h - 40}" width="20" height="20" fill="${brand.accent}" opacity="0.6" />
</svg>`;
}

/* ---------------------------------------------------------------------- */
/* Screenshot scenes — 1280 × 800                                         */
/* ---------------------------------------------------------------------- */

const SHOT_W = 1280;
const SHOT_H = 800;

/** Common scaffolding for every screenshot. */
function shotShell(brand, { title, subtitle, inner }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SHOT_W}" height="${SHOT_H}" viewBox="0 0 ${SHOT_W} ${SHOT_H}">
  ${gradientDefs(brand)}
  <rect width="${SHOT_W}" height="${SHOT_H}" fill="url(#g-bg)" />
  <circle cx="${SHOT_W * 0.95}" cy="${SHOT_H * 0.1}" r="${SHOT_H * 0.5}" fill="url(#g-glow)" />
  <circle cx="${SHOT_W * 0.05}" cy="${SHOT_H * 1.0}" r="${SHOT_H * 0.55}" fill="url(#g-glow)" opacity="0.5" />

  ${logoBlock(brand, { x: 64, y: 64, size: 'sm' })}

  <text x="64" y="200" font-family='${FONT_STACK}' font-size="56" font-weight="800" fill="#ffffff">${esc(title)}</text>
  <text x="64" y="252" font-family='${FONT_STACK}' font-size="24" font-weight="500" fill="rgba(255,255,255,0.72)">${esc(subtitle)}</text>

  ${inner}
</svg>`;
}

/** Avatar bubble for a CXO. */
function cxoBubble({ cx, cy, r, cxo, showName = true }) {
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="${cxo.color}" opacity="0.18" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${cxo.color}" opacity="0.25"
        stroke="${cxo.color}" stroke-width="2" />
      <text x="${cx}" y="${cy - r * 0.05}" font-family='${FONT_STACK}'
        font-size="${r * 0.5}" font-weight="800" fill="${cxo.color}"
        text-anchor="middle" dominant-baseline="middle">${esc(cxo.glyph)}</text>
      <text x="${cx}" y="${cy + r * 0.55}" font-family='${FONT_STACK}'
        font-size="${r * 0.34}" font-weight="800" text-anchor="middle" fill="#ffffff">${esc(cxo.role)}</text>
      ${showName
        ? `<text x="${cx}" y="${cy + r + 24}" font-family='${FONT_STACK}'
            font-size="16" font-weight="600" text-anchor="middle" fill="rgba(255,255,255,0.85)">${esc(cxo.label)}</text>`
        : ''}
    </g>
  `;
}

/* ---- shot 1: AI team monitor (Prism) / DM inbox (Iris) ---- */

function prismShot1(brand) {
  const cols = 5;
  const cellW = 200;
  const cellH = 140;
  const startX = (SHOT_W - cellW * cols) / 2;
  const startY = 340;
  const tiles = CXO_LIST.slice(0, 10).map((cxo, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * (cellH + 20);
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="${cellW - 16}" height="${cellH}" rx="14" fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.08)" />
        <circle cx="42" cy="42" r="26" fill="${cxo.color}" opacity="0.25" stroke="${cxo.color}" stroke-width="2" />
        <text x="42" y="42" font-family='${FONT_STACK}' font-size="16" font-weight="800" fill="${cxo.color}"
          text-anchor="middle" dominant-baseline="middle">${esc(cxo.glyph)}</text>
        <text x="80" y="36" font-family='${FONT_STACK}' font-size="16" font-weight="800" fill="#ffffff">${esc(cxo.role)} ${esc(cxo.label)}</text>
        <text x="80" y="58" font-family='${FONT_STACK}' font-size="12" fill="rgba(255,255,255,0.6)">${esc(cxo.desc)}</text>
        <rect x="20" y="90" width="${cellW - 56}" height="6" rx="3" fill="rgba(255,255,255,0.08)" />
        <rect x="20" y="90" width="${(cellW - 56) * (0.4 + 0.5 * Math.sin(i + 1))}" height="6" rx="3" fill="${cxo.color}" />
        <text x="20" y="120" font-family='${FONT_STACK}' font-size="11" fill="${cxo.color}">● 稼働中</text>
      </g>
    `;
  }).join('');

  return shotShell(brand, {
    title: '13 人の AI 役員が、同時に動きます',
    subtitle: '会議メモも契約書もページ内容も、CXO 全員でいっぺんに処理',
    inner: tiles,
  });
}

function irisShot1(brand) {
  const dms = [
    { name: '@cosme_brand_jp', preview: '弊社の新商品紹介、案件のご相談…', tag: 'PR案件', tagColor: brand.accent },
    { name: '@cafelatte_studio',  preview: '来月の撮影スケジュールいかが…', tag: 'コラボ', tagColor: '#34D399' },
    { name: '@onsen_resort_jp',   preview: '滞在型 PR にぜひお越しいただ…', tag: '新規', tagColor: '#FBBF24' },
    { name: '@beauty_pr_agency',  preview: '長期契約のご提案を…', tag: '高単価', tagColor: '#F472B6' },
  ];
  const rows = dms.map((dm, i) => `
    <g transform="translate(120, ${360 + i * 90})">
      <rect width="1040" height="76" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
      <circle cx="46" cy="38" r="24" fill="${brand.accent}" opacity="0.3" stroke="${brand.accent}" stroke-width="2" />
      <text x="46" y="38" font-family='${FONT_STACK}' font-size="14" font-weight="800" fill="${brand.accent}"
        text-anchor="middle" dominant-baseline="middle">DM</text>
      <text x="92" y="32" font-family='${FONT_STACK}' font-size="18" font-weight="800" fill="#ffffff">${esc(dm.name)}</text>
      <text x="92" y="58" font-family='${FONT_STACK}' font-size="14" fill="rgba(255,255,255,0.65)">${esc(dm.preview)}</text>
      <rect x="860" y="22" width="120" height="32" rx="16" fill="${dm.tagColor}" opacity="0.18" stroke="${dm.tagColor}" />
      <text x="920" y="38" font-family='${FONT_STACK}' font-size="13" font-weight="700" fill="${dm.tagColor}"
        text-anchor="middle" dominant-baseline="middle">${esc(dm.tag)}</text>
    </g>
  `).join('');

  return shotShell(brand, {
    title: 'Instagram DM をワンタップで案件化',
    subtitle: '営業 DM が来た瞬間、Iris が案件カードに自動整理',
    inner: rows,
  });
}

/* ---- shot 2: Proposal card / AI negotiation ---- */

function prismShot2(brand) {
  const inner = `
    <g transform="translate(140, 320)">
      <rect width="1000" height="420" rx="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
      <text x="40" y="56" font-family='${FONT_STACK}' font-size="14" font-weight="700" fill="${brand.accent}">CSO セールス + CMO マーケ からの提案</text>
      <text x="40" y="100" font-family='${FONT_STACK}' font-size="32" font-weight="800" fill="#ffffff">「年間契約で 2 ヶ月無料」プランを今月中にローンチ</text>
      <text x="40" y="148" font-family='${FONT_STACK}' font-size="18" fill="rgba(255,255,255,0.72)">キャッシュ前受け + Churn 低下のダブル効果。CFO 試算で粗利 +18%。</text>

      <g transform="translate(40, 190)">
        ${[
          { tag: '効果', val: '高', color: brand.accent },
          { tag: '工数', val: '低', color: '#34D399' },
          { tag: '期間', val: '2 週', color: '#FBBF24' },
        ].map((p, i) => `
          <g transform="translate(${i * 200}, 0)">
            <rect width="180" height="80" rx="14" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
            <text x="20" y="32" font-family='${FONT_STACK}' font-size="13" fill="rgba(255,255,255,0.55)">${esc(p.tag)}</text>
            <text x="20" y="62" font-family='${FONT_STACK}' font-size="24" font-weight="800" fill="${p.color}">${esc(p.val)}</text>
          </g>
        `).join('')}
      </g>

      <g transform="translate(40, 310)">
        <rect width="280" height="64" rx="32" fill="url(#g-accent)" />
        <text x="140" y="32" font-family='${FONT_STACK}' font-size="18" font-weight="800" fill="#ffffff"
          text-anchor="middle" dominant-baseline="middle">承認して走らせる →</text>

        <rect x="300" y="0" width="220" height="64" rx="32" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" />
        <text x="410" y="32" font-family='${FONT_STACK}' font-size="16" font-weight="600" fill="rgba(255,255,255,0.85)"
          text-anchor="middle" dominant-baseline="middle">あとで判断</text>
      </g>
    </g>
  `;
  return shotShell(brand, {
    title: 'AI が提案。あなたは承認するだけ',
    subtitle: '効果・工数・期間まで揃った状態で、ボタン 1 つで走り出します',
    inner,
  });
}

function irisShot2(brand) {
  const inner = `
    <g transform="translate(140, 320)">
      <rect width="1000" height="420" rx="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
      <text x="40" y="56" font-family='${FONT_STACK}' font-size="14" font-weight="700" fill="${brand.accent}">@cosme_brand_jp さん宛 / AI 生成下書き</text>
      <text x="40" y="92" font-family='${FONT_STACK}' font-size="22" font-weight="800" fill="#ffffff">ご提案ありがとうございます</text>

      <g transform="translate(40, 124)">
        <text font-family='${FONT_STACK}' font-size="16" fill="rgba(255,255,255,0.82)">
          <tspan x="0" dy="0">条件を拝見しました。下記でいかがでしょうか。</tspan>
          <tspan x="0" dy="32">・投稿本数：フィード 1 + ストーリー 3</tspan>
          <tspan x="0" dy="28">・期間：商品到着から 14 日以内</tspan>
          <tspan x="0" dy="28">・想定報酬：◯◯円 + 商品提供</tspan>
          <tspan x="0" dy="28">・二次利用：90 日まで応相談</tspan>
          <tspan x="0" dy="36" fill="rgba(255,255,255,0.55)">スケジュール詳細・撮影意図は別途お送りします。</tspan>
        </text>
      </g>

      <g transform="translate(40, 340)">
        <rect width="240" height="56" rx="28" fill="url(#g-accent)" />
        <text x="120" y="28" font-family='${FONT_STACK}' font-size="16" font-weight="800" fill="#ffffff"
          text-anchor="middle" dominant-baseline="middle">DM に送信 →</text>
        <rect x="260" y="0" width="200" height="56" rx="28" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" />
        <text x="360" y="28" font-family='${FONT_STACK}' font-size="14" fill="rgba(255,255,255,0.85)"
          text-anchor="middle" dominant-baseline="middle">トーン調整</text>
      </g>
    </g>
  `;
  return shotShell(brand, {
    title: 'AI が交渉文を書いてくれる',
    subtitle: 'ブランドの提案条件を読み取り、丁寧な日本語で返信文を提案',
    inner,
  });
}

/* ---- shot 3: extension popup ---- */

function popupSvg(brand, { url, title, badge }) {
  return `
    <g>
      <rect width="380" height="440" rx="22" fill="${brand.bg0}" stroke="rgba(255,255,255,0.12)" />
      <g transform="translate(20, 20)">
        <rect width="44" height="44" rx="11" fill="url(#g-accent)" />
        <text x="22" y="22" font-family='${FONT_STACK}' font-size="20" font-weight="900" fill="#ffffff"
          text-anchor="middle" dominant-baseline="middle">${esc(brand.name === 'CORE Prism' ? 'P' : 'I')}</text>
        <text x="60" y="20" font-family='${FONT_STACK}' font-size="16" font-weight="800" fill="#ffffff">${esc(brand.name)}</text>
        <text x="60" y="38" font-family='${FONT_STACK}' font-size="12" fill="rgba(255,255,255,0.6)">${esc(brand.tagline)}</text>
      </g>
      <line x1="20" y1="86" x2="360" y2="86" stroke="rgba(255,255,255,0.08)" />

      <g transform="translate(20, 110)">
        <text font-family='${FONT_STACK}' font-size="11" fill="rgba(255,255,255,0.5)">いま見ているページ</text>
        <text x="0" y="22" font-family='${FONT_STACK}' font-size="15" font-weight="700" fill="#ffffff">${esc(title)}</text>
        <text x="0" y="44" font-family='${FONT_STACK}' font-size="11" fill="rgba(255,255,255,0.45)">${esc(url)}</text>
      </g>

      <g transform="translate(20, 200)">
        <rect width="340" height="76" rx="14" fill="rgba(167,139,250,0.08)" stroke="${brand.accent}" stroke-opacity="0.5" />
        <text x="16" y="26" font-family='${FONT_STACK}' font-size="11" fill="${brand.accent}" font-weight="700">${esc(badge)}</text>
        <text x="16" y="50" font-family='${FONT_STACK}' font-size="13" fill="rgba(255,255,255,0.82)">選択中のテキストも一緒に保存します</text>
      </g>

      <g transform="translate(20, 300)">
        <rect width="340" height="52" rx="26" fill="url(#g-accent)" />
        <text x="170" y="26" font-family='${FONT_STACK}' font-size="15" font-weight="800" fill="#ffffff"
          text-anchor="middle" dominant-baseline="middle">${esc(brand.name === 'CORE Prism' ? 'Prism に取り込む' : 'Iris にキャプチャ')}</text>

        <rect y="64" width="340" height="44" rx="22" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.14)" />
        <text x="170" y="86" font-family='${FONT_STACK}' font-size="13" font-weight="600" fill="rgba(255,255,255,0.78)"
          text-anchor="middle" dominant-baseline="middle">${esc(brand.name === 'CORE Prism' ? '13 CXO に相談する →' : 'AI に交渉文を書かせる →')}</text>
      </g>

      <g transform="translate(20, 408)">
        <text font-family='${FONT_STACK}' font-size="11" fill="rgba(255,255,255,0.5)">
          Option + ${esc(brand.name === 'CORE Prism' ? 'P' : 'I')} でいつでも開きます
        </text>
      </g>
    </g>
  `;
}

function prismShot3(brand) {
  return shotShell(brand, {
    title: 'ワンクリックで Prism に取り込み',
    subtitle: '今見ているページを、AI 会社の議題に直接送れる',
    inner: `
      <g transform="translate(640, 320)">
        ${popupSvg(brand, { url: 'note.com/example/n/n12345', title: '値上げの伝え方 3 パターン', badge: '＋ 選択テキストあり' })}
      </g>
      <g transform="translate(140, 380)" font-family='${FONT_STACK}' fill="#ffffff">
        <text font-size="22" font-weight="800">Option + P</text>
        <text y="36" font-size="15" fill="rgba(255,255,255,0.7)">ショートカット 1 つで起動</text>

        <text y="100" font-size="22" font-weight="800">右クリック対応</text>
        <text y="136" font-size="15" fill="rgba(255,255,255,0.7)">選択テキストもまとめて取り込み</text>

        <text y="200" font-size="22" font-weight="800">アプリへ直行</text>
        <text y="236" font-size="15" fill="rgba(255,255,255,0.7)">保存と同時に 13 CXO に共有</text>
      </g>
    `,
  });
}

function irisShot3(brand) {
  return shotShell(brand, {
    title: 'Instagram のプロフィールも一発キャプチャ',
    subtitle: '気になるブランド・クリエイターを Iris に登録',
    inner: `
      <g transform="translate(640, 320)">
        ${popupSvg(brand, { url: 'instagram.com/cosme_brand_jp', title: 'cosme_brand_jp', badge: '＋ プロフィール解析' })}
      </g>
      <g transform="translate(140, 380)" font-family='${FONT_STACK}' fill="#ffffff">
        <text font-size="22" font-weight="800">Option + I</text>
        <text y="36" font-size="15" fill="rgba(255,255,255,0.7)">DM 画面からもワンタップ</text>

        <text y="100" font-size="22" font-weight="800">フォロワー帯を即判定</text>
        <text y="136" font-size="15" fill="rgba(255,255,255,0.7)">案件適合度を AI が自動分析</text>

        <text y="200" font-size="22" font-weight="800">そのまま交渉開始</text>
        <text y="236" font-size="15" fill="rgba(255,255,255,0.7)">プロフィール → 案件カードへ即連携</text>
      </g>
    `,
  });
}

/* ---- shot 4: context menu ---- */

function prismShot4(brand) {
  const inner = `
    <g transform="translate(160, 340)">
      <rect width="540" height="320" rx="18" fill="#1F1F2A" stroke="rgba(255,255,255,0.16)" />
      <text x="30" y="40" font-family='${FONT_STACK}' font-size="13" fill="rgba(255,255,255,0.5)">右クリックメニュー</text>

      ${[
        { l: '戻る', g: false },
        { l: '進む', g: false },
        { l: '再読み込み', g: false },
        { l: '別名で保存…', g: true },
        { l: '★ 選択を CORE Prism に送る', g: false, hi: true },
        { l: '★ ページ全体を 13 CXO に相談', g: false, hi: true },
        { l: 'ページのソースを表示', g: true },
        { l: '検証', g: true },
      ].map((item, i) => `
        <g transform="translate(0, ${64 + i * 30})">
          ${item.hi ? `<rect x="14" y="-2" width="512" height="26" rx="6" fill="${brand.accent}" opacity="0.18" />` : ''}
          <text x="30" y="14" font-family='${FONT_STACK}' font-size="15"
            fill="${item.hi ? brand.accent : item.g ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)'}"
            font-weight="${item.hi ? '700' : '500'}">${esc(item.l)}</text>
        </g>
      `).join('')}
    </g>

    <g transform="translate(770, 380)">
      <rect width="380" height="260" rx="18" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
      <text x="24" y="40" font-family='${FONT_STACK}' font-size="13" fill="${brand.accent}" font-weight="700">どこからでも、Prism。</text>
      <text x="24" y="80" font-family='${FONT_STACK}' font-size="20" font-weight="800" fill="#ffffff">記事 / メール / SNS /</text>
      <text x="24" y="108" font-family='${FONT_STACK}' font-size="20" font-weight="800" fill="#ffffff">議事録 / 契約書 PDF</text>

      <text x="24" y="156" font-family='${FONT_STACK}' font-size="14" fill="rgba(255,255,255,0.7)">
        <tspan x="24" dy="0">気になった文章を右クリック →</tspan>
        <tspan x="24" dy="24">そのまま AI 会社の議題に。</tspan>
        <tspan x="24" dy="24">あとでまとめて 13 人で議論。</tspan>
      </text>
    </g>
  `;
  return shotShell(brand, {
    title: '右クリックで、どこからでも Prism',
    subtitle: 'ブラウザのどんなページからでも、選択テキストを AI 役員会へ',
    inner,
  });
}

function irisShot4(brand) {
  // Iris shot 4 = profile analysis result instead of menu
  const inner = `
    <g transform="translate(140, 320)">
      <rect width="1000" height="420" rx="22" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />

      <g transform="translate(40, 40)">
        <circle cx="56" cy="56" r="48" fill="${brand.accent}" opacity="0.2" stroke="${brand.accent}" stroke-width="2" />
        <text x="56" y="58" font-family='${FONT_STACK}' font-size="28" font-weight="800" fill="${brand.accent}"
          text-anchor="middle" dominant-baseline="middle">IG</text>

        <text x="130" y="42" font-family='${FONT_STACK}' font-size="26" font-weight="800" fill="#ffffff">@beauty_creator_a</text>
        <text x="130" y="74" font-family='${FONT_STACK}' font-size="14" fill="rgba(255,255,255,0.6)">美容・コスメ / 投稿 1.2k / 反応率 4.8%</text>
        <text x="130" y="100" font-family='${FONT_STACK}' font-size="14" fill="${brand.accent}">● 案件適合度 92 / 100</text>
      </g>

      <g transform="translate(40, 200)">
        ${['オーディエンス', 'コンテンツ', '推奨単価'].map((t, i) => `
          <g transform="translate(${i * 310}, 0)">
            <rect width="290" height="170" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
            <text x="20" y="30" font-family='${FONT_STACK}' font-size="13" fill="rgba(255,255,255,0.55)">${esc(t)}</text>
            <text x="20" y="68" font-family='${FONT_STACK}' font-size="22" font-weight="800" fill="#ffffff">
              ${['女性 20-34 が 78%', '保存率 +高 / Reels 強', '¥120k – ¥180k'][i]}
            </text>
            <text x="20" y="108" font-family='${FONT_STACK}' font-size="13" fill="rgba(255,255,255,0.65)">
              ${['ターゲット完全一致', '商品レビュー型と相性◎', '同層クリエイター比較'][i]}
            </text>
            <rect x="20" y="130" width="${[210, 180, 240][i]}" height="6" rx="3" fill="${brand.accent}" opacity="0.7" />
          </g>
        `).join('')}
      </g>
    </g>
  `;
  return shotShell(brand, {
    title: 'プロフィールを AI が瞬時に解析',
    subtitle: 'オーディエンス・反応率・推奨単価を、案件判断の材料に',
    inner,
  });
}

/* ---- shot 5: full CXO grid / reel exporter ---- */

function prismShot5(brand) {
  const inner = `
    <g transform="translate(120, 330)">
      ${CXO_LIST.slice(0, 12).map((cxo, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        const x = col * 270;
        const y = row * 140;
        return `
          <g transform="translate(${x}, ${y})">
            <rect width="250" height="120" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
            <circle cx="40" cy="40" r="26" fill="${cxo.color}" opacity="0.22" stroke="${cxo.color}" stroke-width="2" />
            <text x="40" y="40" font-family='${FONT_STACK}' font-size="16" font-weight="800" fill="${cxo.color}"
              text-anchor="middle" dominant-baseline="middle">${esc(cxo.glyph)}</text>
            <text x="78" y="34" font-family='${FONT_STACK}' font-size="16" font-weight="800" fill="#ffffff">${esc(cxo.role)} ${esc(cxo.label)}</text>
            <text x="78" y="56" font-family='${FONT_STACK}' font-size="12" fill="rgba(255,255,255,0.6)">${esc(cxo.desc)}</text>
            <text x="20" y="98" font-family='${FONT_STACK}' font-size="11" fill="${cxo.color}">${esc(cxo.role)} が ${esc(cxo.desc.split('・')[0])} を担当</text>
          </g>
        `;
      }).join('')}
    </g>
  `;
  return shotShell(brand, {
    title: '13 人の専門 AI が、社員のように振る舞う',
    subtitle: 'それぞれが得意領域を持ち、議題ごとに最適な誰かが手を挙げる',
    inner,
  });
}

function irisShot5(brand) {
  const reels = [
    { title: '今月のベスト Reels', value: '12.4k views', delta: '+38%', color: brand.accent },
    { title: 'ストーリー 反応率',   value: '5.2%',       delta: '+0.8pt', color: '#34D399' },
    { title: '案件単価 平均',       value: '¥168,000',   delta: '+¥22k',  color: '#FBBF24' },
  ];
  const inner = `
    <g transform="translate(140, 320)">
      ${reels.map((r, i) => `
        <g transform="translate(0, ${i * 130})">
          <rect width="1000" height="110" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" />
          <text x="32" y="42" font-family='${FONT_STACK}' font-size="14" fill="rgba(255,255,255,0.6)">${esc(r.title)}</text>
          <text x="32" y="84" font-family='${FONT_STACK}' font-size="34" font-weight="800" fill="#ffffff">${esc(r.value)}</text>
          <text x="320" y="76" font-family='${FONT_STACK}' font-size="22" font-weight="800" fill="${r.color}">${esc(r.delta)}</text>
          <rect x="520" y="28" width="440" height="56" rx="14" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" />
          <text x="540" y="56" font-family='${FONT_STACK}' font-size="13" fill="rgba(255,255,255,0.7)" dominant-baseline="middle">AI 提案：このトーンの投稿を週 2 本</text>
        </g>
      `).join('')}
    </g>
  `;
  return shotShell(brand, {
    title: 'リールも数字も、Iris が全部書き出す',
    subtitle: '次に投稿するべき内容まで、AI マネージャーが日報レベルで報告',
    inner,
  });
}

/* ---------------------------------------------------------------------- */
/* Rasteriser                                                             */
/* ---------------------------------------------------------------------- */

async function rasterise(svgString, outPath, { w, h }) {
  await mkdir(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svgString), { density: 144 })
    .resize(w, h, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return { path: outPath, w, h };
}

async function buildBrand(key) {
  const brand = BRANDS[key];
  const outDir = join(ROOT, brand.storeDir);
  const results = [];

  // Promo tiles
  const headline =
    key === 'prism'
      ? 'AI 会社が、あなたの代わりに 13 人で働く'
      : 'Instagram 営業を、AI に任せる';
  const sub =
    key === 'prism'
      ? '今見ているページを 1 クリックで取り込み、CXO 全員でいっぺんに考える'
      : 'DM・プロフィール・案件管理・収益分析まで、ワンタップで完結';

  results.push(
    await rasterise(
      promoTileSvg(brand, { w: 1024, h: 500, headline, sub }),
      join(outDir, 'promo-1024x500.png'),
      { w: 1024, h: 500 }
    )
  );
  results.push(
    await rasterise(
      promoTileSvg(brand, { w: 440, h: 280, headline, sub }),
      join(outDir, 'promo-440x280.png'),
      { w: 440, h: 280 }
    )
  );

  // Screenshots
  const shots = key === 'prism'
    ? [prismShot1, prismShot2, prismShot3, prismShot4, prismShot5]
    : [irisShot1, irisShot2, irisShot3, irisShot4, irisShot5];

  for (let i = 0; i < shots.length; i += 1) {
    const svg = shots[i](brand);
    const out = join(outDir, `screenshot-${i + 1}-1280x800.png`);
    results.push(await rasterise(svg, out, { w: SHOT_W, h: SHOT_H }));
  }

  return results;
}

/* ---------------------------------------------------------------------- */
/* Entry point                                                            */
/* ---------------------------------------------------------------------- */

async function main() {
  const all = [];
  for (const key of Object.keys(BRANDS)) {
    const r = await buildBrand(key);
    all.push(...r);
  }
  // eslint-disable-next-line no-console
  console.log(`Generated ${all.length} PNG asset(s):`);
  for (const r of all) {
    // eslint-disable-next-line no-console
    console.log(`  ${r.w}x${r.h}  ${r.path}`);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
