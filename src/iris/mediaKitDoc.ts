// ============================================================
// CORE Iris — メディアキット（自動生成）
// 「私のプロフィール」に入れた数字や一言から、ブランドにそのまま
// 送れる "美しいメディアキット" の文章を AI が書き起こす。
// 手入力ゼロで、企業に刺さる自己紹介・強み・コラボ提案を用意する。
// ============================================================
import type { AppSettings } from '../types/identity';
import type { MediaKit, Platform } from '../types/influencerDeal';
import { PLATFORM_META } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

export interface MediaKitDoc {
  /** 一言キャッチ（肩書き的なフレーズ） */
  tagline: string;
  /** プロのプロフィール紹介文（2〜3文・敬体） */
  intro: string;
  /** 強み 3 点 */
  strengths: { title: string; detail: string }[];
  /** オーディエンス像（整えた説明文） */
  audience: string;
  /** ブランドが一緒にやる価値（提案の核） */
  whyCollab: string;
  /** コラボの形（提案フォーマット） */
  collabFormats: { title: string; detail: string }[];
  /** 締めの一言（問い合わせを促す） */
  closing: string;
}

/** 数字サマリ（フォロワー/ER）を読みやすい行に */
export function mediaKitStats(kit?: MediaKit): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (!kit) return out;
  const platforms: Platform[] = ['instagram', 'tiktok', 'youtube', 'x'];
  for (const p of platforms) {
    const f = kit.followers?.[p];
    if (f && f > 0) {
      const er = kit.avgEngagementRate?.[p];
      out.push({
        label: PLATFORM_META[p].label,
        value: `${f.toLocaleString()}人${er ? ` ・ 反応率${er}%` : ''}`,
      });
    }
  }
  if (kit.monthlyReach && kit.monthlyReach > 0) {
    out.push({ label: '月間リーチ', value: `${kit.monthlyReach.toLocaleString()}` });
  }
  return out;
}

function kitFacts(kit?: MediaKit): string {
  const lines: string[] = [];
  if (kit?.handleName) lines.push(`- 表示名: ${kit.handleName}`);
  const stats = mediaKitStats(kit);
  if (stats.length) lines.push(`- 数字: ${stats.map(s => `${s.label} ${s.value}`).join(' / ')}`);
  if (kit?.audienceProfile) lines.push(`- よく見てくれる人: ${kit.audienceProfile}`);
  if (kit?.caseHistory) lines.push(`- 過去案件: ${kit.caseHistory}`);
  if (kit?.rateCard) lines.push(`- 希望金額の目安: ${kit.rateCard}`);
  if (kit?.brandValues) lines.push(`- 大切にしたいこと・NG: ${kit.brandValues}`);
  if (kit?.entity) lines.push(`- 形態: ${kit.entity === 'corporate' ? '法人' : '個人'}`);
  if (kit?.legalName) lines.push(`- 屋号/会社名: ${kit.legalName}`);
  return lines.length ? lines.join('\n') : '(ほとんど未入力。一般的なクリエイターとして、無理に数字を作らず書いてください)';
}

/** メディアキットの文章を生成 */
export async function generateMediaKitDoc(opts: {
  settings: AppSettings;
  mediaKit?: MediaKit;
}): Promise<MediaKitDoc> {
  const sys = `あなたは、インフルエンサーが企業に送る「メディアキット（自己紹介資料）」をプロのコピーライターとして書き起こす担当です。
出力は JSON のみ:
{
  "tagline": "一言キャッチ（肩書き的に。15文字前後）",
  "intro": "プロフィール紹介文。敬体で2〜3文。企業の担当者が読んで安心・期待できるトーン",
  "strengths": [{"title": "強みの見出し（短く）", "detail": "1〜2文の説明"}],
  "audience": "よく見てくれる人の像を、企業がイメージしやすい言葉で1〜2文",
  "whyCollab": "このクリエイターと組むと企業に何が起きるか。提案の核を2〜3文",
  "collabFormats": [{"title": "コラボの形（例: フィード投稿 / リール / ストーリーズ連投 / 商品レビュー）", "detail": "中身と狙いを1文"}],
  "closing": "締めの一言。問い合わせを優しく促す1文"
}

## ルール
- strengths は 3 点、collabFormats は 3〜4 点。
- 与えられた数字（フォロワー・反応率）は誇張しない。無い数字は作らない。数字が無ければ「数」ではなく「らしさ・世界観・関係性の濃さ」で価値を語る。
- 押し売りにならない。「一緒に良いものを作りたい」という対等で誠実なトーン。
- 専門用語・横文字を避け、やさしい日本語で。読み手は企業のSNS担当者。
- 絵文字は使わない。
- 全体で「この人にお願いしたい」と思わせる、温度のある文章に。

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## 私の情報（メディアキットの素材）
${kitFacts(opts.mediaKit)}

この情報から、企業にそのまま送れるメディアキットの文章を書いてください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2200,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `メディアキット生成APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  const m = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(m ? m[0] : text);
  return {
    tagline: parsed.tagline || '',
    intro: parsed.intro || '',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4) : [],
    audience: parsed.audience || '',
    whyCollab: parsed.whyCollab || '',
    collabFormats: Array.isArray(parsed.collabFormats) ? parsed.collabFormats.slice(0, 4) : [],
    closing: parsed.closing || '',
  };
}

/** メディアキットを、企業に送れる Markdown に整形 */
export function mediaKitDocToMarkdown(doc: MediaKitDoc, kit?: MediaKit): string {
  const stats = mediaKitStats(kit);
  const lines: string[] = [];
  lines.push(`# ${kit?.handleName || 'メディアキット'}`);
  if (doc.tagline) lines.push(`*${doc.tagline}*`);
  lines.push('');
  if (doc.intro) { lines.push(doc.intro); lines.push(''); }
  if (stats.length) {
    lines.push('## 数字');
    for (const s of stats) lines.push(`- ${s.label}: ${s.value}`);
    lines.push('');
  }
  if (doc.strengths.length) {
    lines.push('## 強み');
    for (const s of doc.strengths) lines.push(`- **${s.title}** — ${s.detail}`);
    lines.push('');
  }
  if (doc.audience) { lines.push('## よく見てくれる人'); lines.push(doc.audience); lines.push(''); }
  if (doc.whyCollab) { lines.push('## 一緒にできること'); lines.push(doc.whyCollab); lines.push(''); }
  if (doc.collabFormats.length) {
    lines.push('## コラボの形');
    for (const c of doc.collabFormats) lines.push(`- **${c.title}** — ${c.detail}`);
    lines.push('');
  }
  if (kit?.rateCard) { lines.push('## 金額の目安'); lines.push(kit.rateCard); lines.push(''); }
  if (doc.closing) lines.push(doc.closing);
  return lines.join('\n').trim();
}

/** HTML エスケープ（標準的な5文字） */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * メディアキットを、企業にそのまま見せられる「美しい1枚もの」HTML に整形する。
 * - 単体で完結（外部依存は Google Fonts のみ）。新規タブで開いてそのまま印刷→PDF保存できる。
 * - 印刷時は1ページに収まるよう @media print を最適化。
 * - 数字は与えられたものだけ。無い数字は作らない（honest-numbers）。
 */
export function mediaKitDocToHtml(doc: MediaKitDoc, kit?: MediaKit): string {
  const accent = '#E1306C';
  const accent2 = '#F77737';
  const name = kit?.handleName?.trim() || 'Media Kit';
  const stats = mediaKitStats(kit);

  const statCards = stats
    .map(
      (s) => `<div class="stat">
        <div class="stat-label">${esc(s.label)}</div>
        <div class="stat-value">${esc(s.value)}</div>
      </div>`,
    )
    .join('');

  const strengthItems = doc.strengths
    .map(
      (s) => `<div class="item">
        <div class="item-title">${esc(s.title)}</div>
        <div class="item-detail">${esc(s.detail)}</div>
      </div>`,
    )
    .join('');

  const collabItems = doc.collabFormats
    .map(
      (c) => `<div class="item">
        <div class="item-title">${esc(c.title)}</div>
        <div class="item-detail">${esc(c.detail)}</div>
      </div>`,
    )
    .join('');

  const section = (label: string, body: string) =>
    body
      ? `<section class="block">
          <div class="block-label">${esc(label)}</div>
          ${body}
        </section>`
      : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} — メディアキット</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Playfair+Display:ital,wght@0,600;1,500;1,600&display=swap" rel="stylesheet">
<style>
  :root { --accent: ${accent}; --accent2: ${accent2}; --ink: #1c1b1f; --soft: #6b6a72; --line: #ece9ef; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--ink);
    background: #f4f1f6;
    line-height: 1.75;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    max-width: 760px;
    margin: 32px auto;
    background: #fff;
    border-radius: 22px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(28,27,31,0.12);
  }
  .hero {
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    color: #fff;
    padding: 48px 44px 40px;
  }
  .hero .eyebrow { font-size: 11px; letter-spacing: 0.34em; font-weight: 700; opacity: 0.9; margin: 0; }
  .hero h1 { font-size: 34px; font-weight: 700; margin: 10px 0 0; letter-spacing: 0.01em; }
  .hero .tagline {
    font-family: 'Playfair Display', serif; font-style: italic; font-weight: 500;
    font-size: 21px; margin: 12px 0 0; opacity: 0.96;
  }
  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
  .stat {
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.28);
    border-radius: 14px; padding: 12px 16px; min-width: 120px;
  }
  .stat-label { font-size: 11px; letter-spacing: 0.06em; opacity: 0.9; }
  .stat-value { font-size: 17px; font-weight: 700; margin-top: 3px; }
  .body { padding: 36px 44px 12px; }
  .lead { font-size: 15.5px; color: var(--ink); margin: 0 0 8px; }
  .block { padding: 22px 0; border-top: 1px solid var(--line); }
  .block:first-of-type { border-top: none; }
  .block-label {
    font-size: 11px; letter-spacing: 0.22em; font-weight: 700;
    color: var(--accent); margin-bottom: 14px;
  }
  .block p { margin: 0; color: var(--ink); }
  .item { margin-bottom: 14px; padding-left: 16px; border-left: 2px solid var(--accent2); }
  .item:last-child { margin-bottom: 0; }
  .item-title { font-weight: 700; color: var(--ink); font-size: 15px; }
  .item-detail { color: var(--soft); font-size: 14px; margin-top: 2px; }
  .closing { font-family: 'Playfair Display', serif; font-style: italic; color: var(--soft); font-size: 16px; }
  .footer {
    padding: 22px 44px 34px; color: var(--soft); font-size: 11px;
    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
  }
  .footer .brand { font-weight: 700; letter-spacing: 0.18em; color: var(--accent); }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; justify-content: center; gap: 10px;
    padding: 12px; background: rgba(244,241,246,0.86); backdrop-filter: blur(8px);
  }
  .toolbar button {
    font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
    border: none; border-radius: 999px; padding: 11px 22px; color: #fff;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    box-shadow: 0 6px 18px rgba(225,48,108,0.32);
  }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .page { box-shadow: none; margin: 0; max-width: none; border-radius: 0; }
    .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .stat { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media (max-width: 540px) {
    .page { margin: 0; border-radius: 0; }
    .hero { padding: 36px 24px 32px; }
    .hero h1 { font-size: 27px; }
    .body { padding: 28px 24px 8px; }
    .footer { padding: 20px 24px 30px; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">PDFで保存 / 印刷</button>
  </div>
  <div class="page">
    <header class="hero">
      <p class="eyebrow">MEDIA KIT</p>
      <h1>${esc(name)}</h1>
      ${doc.tagline ? `<p class="tagline">${esc(doc.tagline)}</p>` : ''}
      ${statCards ? `<div class="stats">${statCards}</div>` : ''}
    </header>
    <div class="body">
      ${doc.intro ? `<p class="lead">${esc(doc.intro)}</p>` : ''}
      ${section('強み', strengthItems)}
      ${section('よく見てくれる人', doc.audience ? `<p>${esc(doc.audience)}</p>` : '')}
      ${section('一緒にできること', doc.whyCollab ? `<p>${esc(doc.whyCollab)}</p>` : '')}
      ${section('コラボの形', collabItems)}
      ${section('金額の目安', kit?.rateCard ? `<p>${esc(kit.rateCard)}</p>` : '')}
      ${doc.closing ? `<section class="block"><p class="closing">${esc(doc.closing)}</p></section>` : ''}
    </div>
    <div class="footer">
      <span>${kit?.handleName ? esc(kit.handleName) : ''}</span>
      <span class="brand">CORE Iris</span>
    </div>
  </div>
</body>
</html>`;
}
