#!/usr/bin/env node
/**
 * generateIrisMascot.mjs — CORE Iris 公式マスコット (ピンク系) SVG 3 案
 *
 * オーナー指示 (2026-06-04 第 30 波 ZZZZ):
 *   PPPP (generateMascot.mjs) の Iris 版。
 *   Iris ブランドの ピンク (#F472B6) / オレンジ (#FB923C) / 紫 (#A855F7) を主軸に、
 *   クリエイター 向けの 親しみやすい 3 つの ポーズ。
 *
 * 使い方:
 *   node scripts/generateIrisMascot.mjs
 *   API_BASE=http://localhost:3000 node scripts/generateIrisMascot.mjs
 *
 * 出力:
 *   ~/Desktop/iris_mascot/<date>/
 *     iris-cat-front.svg
 *     iris-sparkle-side.svg
 *     iris-paint-flying.svg
 *     preview.html
 *     README.md
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const API_BASE = process.env.API_BASE || 'https://core-prism-app.vercel.app';
const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', 'iris_mascot', today);
mkdirSync(outDir, { recursive: true });

const C = { reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m' };

const VARIANTS = [
  {
    name: 'cat-front',
    style: 'flat',
    color: '#F472B6',
    concept: '正面を向いた「Iris (アイリス) ちゃん」 — ピンク色のふわふわした子猫風キャラ。' +
             '頭には花 (アイリスの花) を 1 つ。目はキラキラ。手にはスマートフォンを持って ' +
             'インスタの投稿を確認しているような、クリエイター 寄り添い マスコット。' +
             '配色は ピンク (#F472B6) を主軸 + オレンジ (#FB923C) + 紫 (#A855F7) の差し色。',
    desc: 'フラット 正面 子猫 — マスコットの基本形 / アバター用',
  },
  {
    name: 'sparkle-side',
    style: 'line',
    color: '#FB923C',
    concept: '横向きで キラキラを振りまく「Iris ちゃん」を線画で。' +
             '左手に魔法のステッキ、右手で 投稿スケジュール の カレンダー を 指差し。' +
             '頭の上で星 (sparkle) が瞬く。線色は オレンジ #FB923C で、塗りは最小限。' +
             'クリエイターの 投稿アイデア に魔法をかけている雰囲気。',
    desc: 'ライン 横向き 魔法 — Web アクセント / ローディング 用',
  },
  {
    name: 'paint-flying',
    style: 'soft',
    color: '#A855F7',
    concept: '空を飛んでいる「Iris ちゃん」を soft なグラデで。' +
             '背中に絵筆を背負い、虹色のペイントトレイルを たなびかせている。' +
             '画面全体が ピンク → オレンジ → 紫 の グラデで、雲の上を 楽しそうに 舞っている。' +
             'クリエイティブのインスピレーションが降りてきている瞬間を 象徴。',
    desc: 'ソフト 飛行 ペイント — ヒーロー / OG 用',
  },
];

const SYSTEM = `あなたは SVG アーティストです。ユーザーが概念を伝えてきたら、
1 ファイルに収まる <svg>...</svg> を返してください。

厳守ルール:
1. 出力は <svg ...> から始まり </svg> で終わる **単一の SVG 要素のみ** を返す
2. SVG 内に <script> や onload など実行可能なコードは含めない (静的画像のみ)
3. 不要な装飾コメント・説明文は SVG タグ外に書かない (タグの外には何も書かない)
4. viewBox / width / height を必ず指定
5. linearGradient / radialGradient を活用して可愛いマスコットらしい彩度の高い色を使う
6. アクセシビリティのため <title> 要素を 1 つ含める

スタイルの目安:
- flat: 単色塗りで構成 (シャドウ無し)
- line: 主に stroke で表現 (塗りつぶし最小)
- soft: 淡いグラデーション + 角丸 + ふんわり`;

function extractSvg(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:svg|xml|html)?\s*\n?([\s\S]*?)\n?```/i);
  const candidate = fenced ? fenced[1] : text;
  const m = candidate.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0].trim() : null;
}

function sanitizeSvg(svg) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

async function callOnce(v) {
  const userPrompt = [
    `概念: ${v.concept}`,
    `スタイル: ${v.style}`,
    `viewBox: 0 0 600 600`,
    `メインカラー: ${v.color}`,
    `背景: 透過`,
    '',
    '上記の指示に従い、SVG コード本体のみを返してください。',
  ].join('\n');
  const res = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.retryAfterSec = retryAfter;
    throw err;
  }
  const j = await res.json();
  const raw = j.content?.[0]?.text || '';
  const svg = extractSvg(raw);
  if (!svg) throw new Error('SVG を抽出できませんでした');
  return sanitizeSvg(svg);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function generateOne(v) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await callOnce(v);
    } catch (e) {
      lastErr = e;
      if (e.status === 429) {
        const wait = Math.max(8, e.retryAfterSec || 0) + attempt * 4;
        console.log(`  ${C.yellow}↻ 429 を受信 — ${wait}s 待機 + 再試行${C.reset}`);
        await sleep(wait * 1000);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

console.log(`${C.bold}CORE Iris 公式 マスコット 3 案 を AI に頼みます…${C.reset}\n`);

const results = [];
for (const v of VARIANTS) {
  process.stdout.write(`${C.dim}→ ${v.name.padEnd(18)} (${v.style})${C.reset} `);
  try {
    const svg = await generateOne(v);
    const fname = `iris-${v.name}.svg`;
    writeFileSync(join(outDir, fname), svg, 'utf-8');
    console.log(`${C.green}✓ ${fname} (${(svg.length / 1024).toFixed(1)} KB)${C.reset}`);
    results.push({ ...v, file: fname, ok: true, size: svg.length });
  } catch (e) {
    console.log(`${C.red}✗ ${e.message}${C.reset}`);
    results.push({ ...v, ok: false, error: e.message });
  }
}

// プレビュー HTML
const previewHtml = `<!doctype html>
<html lang="ja"><head>
<meta charset="UTF-8">
<title>CORE Iris マスコット 3 案 プレビュー</title>
<style>
  body { font-family: -apple-system, 'Hiragino Sans', sans-serif; background: linear-gradient(180deg, #1a0a1a 0%, #28122c 100%); color: #fff; margin: 0; padding: 32px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 18px; margin-top: 24px; }
  .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(244,114,182,0.3); border-radius: 14px; padding: 16px; }
  .card h3 { margin: 0 0 6px; font-size: 14px; color: #F472B6; }
  .card .desc { font-size: 12px; color: rgba(255,255,255,0.65); margin-bottom: 10px; }
  .preview { background: repeating-conic-gradient(rgba(244,114,182,0.06) 0% 25%, transparent 0% 50%) 50% / 20px 20px; padding: 18px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
  .preview svg { max-width: 100%; max-height: 240px; height: auto; }
</style>
</head><body>
<h1>✨ CORE Iris 公式マスコット 3 案 プレビュー</h1>
<p style="opacity:.7;font-size:12px">生成日時: ${new Date().toISOString()}</p>
<div class="grid">
${results.filter(r => r.ok).map(r => {
  const svgRaw = '__SVG_PLACEHOLDER__' + r.file + '__';
  return `<div class="card">
    <h3>${r.name}</h3>
    <div class="desc">${r.desc}</div>
    <div class="preview">${svgRaw}</div>
  </div>`;
}).join('\n')}
</div>
</body></html>`;

let html = previewHtml;
for (const r of results.filter(r => r.ok)) {
  try {
    const fs = await import('node:fs/promises');
    const txt = await fs.readFile(join(outDir, r.file), 'utf-8');
    html = html.replace(`__SVG_PLACEHOLDER__${r.file}__`, txt);
  } catch { /* */ }
}
writeFileSync(join(outDir, 'preview.html'), html, 'utf-8');

// README.md
const md = [];
md.push('# CORE Iris 公式マスコット 3 案');
md.push('');
md.push(`生成日時: ${new Date().toISOString()}`);
md.push('');
md.push('## 3 案');
md.push('');
for (const r of results) {
  md.push(`### ${r.name}`);
  md.push(`- ${r.desc}`);
  md.push(`- ファイル: ${r.ok ? `\`${r.file}\` (${(r.size / 1024).toFixed(1)} KB)` : `失敗: ${r.error}`}`);
  md.push('');
}
md.push('## プレビュー');
md.push('');
md.push(`ブラウザで \`preview.html\` を開いてください: file://${join(outDir, 'preview.html')}`);
md.push('');
md.push('## 採用フロー');
md.push('');
md.push('1. preview.html で 3 案を比較');
md.push('2. 気に入った 1 案を `iris-mascot.svg` にリネーム');
md.push('3. `public/og/` に配置 → IrisLanding / iris-OG カードに埋め込み');
md.push('');
md.push('## カラーパレット (Iris)');
md.push('');
md.push('- メイン  ピンク #F472B6');
md.push('- 差し色  オレンジ #FB923C / 紫 #A855F7');
md.push('- 背景 グラデ #1a0a1a → #28122c');

writeFileSync(join(outDir, 'README.md'), md.join('\n'), 'utf-8');

const okCount = results.filter(r => r.ok).length;
console.log('');
console.log(`${C.bold}結果${C.reset}: ${C.green}✓ ${okCount}${C.reset} / 全 ${results.length}`);
console.log(`${C.bold}保存先${C.reset}: ${outDir}`);
console.log(`${C.bold}プレビュー${C.reset}: open ${join(outDir, 'preview.html')}`);
