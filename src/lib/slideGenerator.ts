// ============================================================
// 資料 → スライドデッキ自動生成
// テキスト/ナレッジ → Claude が構造化スライド設計 → PPTX 出力
// ============================================================
import pptxgen from 'pptxgenjs';
import type { AppSettings, Persona } from '../types/identity';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

export interface SlideSpec {
  layout:
    | 'cover'        // 表紙
    | 'agenda'       // 目次
    | 'section'      // セクション扉
    | 'twoColumn'    // 左右2カラム
    | 'bullets'      // 箇条書き
    | 'three'        // 3カラム
    | 'quote'        // 引用/メッセージ
    | 'closing';     // クロージング
  title: string;
  subtitle?: string;
  bullets?: string[];
  body?: string;
  columns?: { heading: string; body: string }[];
  emoji?: string;
  notes?: string;
}

export interface DeckSpec {
  title: string;
  subtitle: string;
  author: string;
  accentColor: string;       // hex like "4A9EFF" (no #)
  slides: SlideSpec[];
}

const SYS = `あなたはプロのプレゼン資料デザイナーです。
入力された素材から、説得力ある構造化スライドデッキの設計を行います。

返答は**JSONのみ**(コードブロック・説明文なし)。スキーマ:
{
  "title": "デッキ全体タイトル (10-30文字)",
  "subtitle": "サブタイトル/タグライン (15-50文字)",
  "slides": [
    {
      "layout": "cover" | "agenda" | "section" | "twoColumn" | "bullets" | "three" | "quote" | "closing",
      "title": "スライドタイトル",
      "subtitle": "(任意) 補足見出し",
      "bullets": ["箇条書き1", ...] // bullets レイアウトで使用、3-6項目
      "body": "本文 (任意)",
      "columns": [{ "heading": "見出し", "body": "本文" }] // twoColumn / three で使用
      "emoji": "アイコン代わりの絵文字 (任意)",
      "notes": "話者ノート (任意)"
    }
  ]
}

ルール:
- 8-12 枚で構成 (表紙 + 目次 + 本編 + クロージング)
- レイアウトは内容に応じて変化させる(同じ layout を3連続させない)
- スライドタイトルは短く、強い (10-25文字)
- 箇条書きは一行25文字以内、命令調や体言止めで力強く
- 推測ではなく入力素材に基づいた内容
- "cover" は最初、"closing" は最後に必ず配置`;

interface GenInput {
  source: string;
  audience?: string;
  goal?: string;
  slideCount?: number;
}

export async function generateDeckSpec(
  settings: AppSettings,
  persona: Persona,
  input: GenInput,
): Promise<DeckSpec> {
  const apiKey = getApiKey(settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const userPrompt = `## 人格コンテキスト (発表者)
${persona.name} (${persona.subtitle})
${persona.description || ''}

## 想定オーディエンス
${input.audience || '(未指定 — 一般のビジネス相手)'}

## ゴール
${input.goal || '(未指定 — 内容を分かりやすく伝える)'}

## 希望スライド数
${input.slideCount || '8-10'}

## ソース素材
${input.source.slice(0, 30000)}${input.source.length > 30000 ? '\n[...省略]' : ''}

上記素材から、力強く伝わるスライドデッキの設計を JSON で出力してください。`;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.preferredModel,
      max_tokens: 4096,
      system: SYS,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `スライド設計 APIエラー: ${res.status}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  let parsed: any = {};
  try {
    const m = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(m ? m[0] : text);
  } catch {
    parsed = { title: persona.name + ' スライド', subtitle: '', slides: [] };
  }

  return {
    title: parsed.title || 'プレゼンテーション',
    subtitle: parsed.subtitle || '',
    author: persona.name,
    accentColor: persona.accentColor.replace(/^#/, ''),
    slides: Array.isArray(parsed.slides) ? parsed.slides : [],
  };
}

// ── PPTX レンダリング ─────────────────────────────────
export async function renderDeck(spec: DeckSpec, opts?: { fileName?: string }): Promise<void> {
  const C = {
    bg:      '0A0F1F',
    bg2:     '121A2F',
    card:    '1A2440',
    border:  '2A3656',
    primary: spec.accentColor,
    primary2: lightenHex(spec.accentColor, 0.2),
    fg:      'FFFFFF',
    fg2:     'C4CFE5',
    muted:   '8B97B5',
    subtle:  '5C6883',
  };
  const FH = 'Hiragino Sans';
  const FB = 'Hiragino Sans';

  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = spec.author;
  pres.title = spec.title;

  spec.slides.forEach((sl, idx) => {
    const slide = pres.addSlide();
    slide.background = { color: C.bg };
    if (sl.notes) slide.addNotes(sl.notes);

    switch (sl.layout) {
      case 'cover':       renderCover(slide, sl, C, FH, FB, spec, pres); break;
      case 'agenda':      renderAgenda(slide, sl, C, FH, FB, idx, spec.slides.length); break;
      case 'section':     renderSection(slide, sl, C, FH, FB); break;
      case 'twoColumn':   renderTwoColumn(slide, sl, C, FH, FB, idx, spec.slides.length, pres); break;
      case 'three':       renderThree(slide, sl, C, FH, FB, idx, spec.slides.length, pres); break;
      case 'bullets':     renderBullets(slide, sl, C, FH, FB, idx, spec.slides.length, pres); break;
      case 'quote':       renderQuote(slide, sl, C, FH, FB); break;
      case 'closing':     renderClosing(slide, sl, C, FH, FB, spec, pres); break;
      default:            renderBullets(slide, sl, C, FH, FB, idx, spec.slides.length, pres); break;
    }
  });

  const fileName = opts?.fileName || `${spec.title.replace(/[\\/:*?"<>|]/g, '_')}.pptx`;
  await pres.writeFile({ fileName });
}

// ── レイアウトレンダリング ─────────────────────────────
function pageNumber(slide: any, idx: number, total: number, C: any, FB: string) {
  slide.addShape('line', {
    x: 0.5, y: 7.0, w: 12.3, h: 0,
    line: { color: C.border, width: 0.75 },
  });
  slide.addText(`${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, {
    x: 12.0, y: 7.05, w: 1.2, h: 0.3,
    fontFace: FB, fontSize: 9, color: C.subtle, align: 'right', margin: 0,
  });
}

function sectionHeader(slide: any, num: number, sl: SlideSpec, C: any, FH: string, FB: string) {
  slide.addShape('rect', {
    x: 0.6, y: 0.55, w: 0.55, h: 0.55,
    fill: { color: C.primary }, line: { type: 'none' },
  });
  slide.addText(String(num).padStart(2, '0'), {
    x: 0.6, y: 0.55, w: 0.55, h: 0.55,
    fontFace: FH, fontSize: 18, bold: true, color: C.bg,
    align: 'center', valign: 'middle', margin: 0,
  });
  if (sl.subtitle) {
    slide.addText(sl.subtitle, {
      x: 1.35, y: 0.55, w: 8, h: 0.3,
      fontFace: FB, fontSize: 11, color: C.primary2, charSpacing: 6, margin: 0,
    });
  }
  slide.addText(sl.title, {
    x: 1.35, y: 0.82, w: 11.4, h: 0.7,
    fontFace: FH, fontSize: 32, bold: true, color: C.fg, margin: 0,
  });
}

function renderCover(slide: any, sl: SlideSpec, C: any, FH: string, FB: string, spec: DeckSpec, _pres: any) {
  // ambient orb
  slide.addShape('ellipse', {
    x: -2, y: -2, w: 6, h: 6,
    fill: { color: C.primary, transparency: 80 }, line: { type: 'none' },
  });
  slide.addShape('ellipse', {
    x: 9, y: 4, w: 5.5, h: 5.5,
    fill: { color: C.primary2, transparency: 88 }, line: { type: 'none' },
  });
  // brand
  slide.addText(spec.author.toUpperCase(), {
    x: 0.8, y: 0.9, w: 10, h: 0.4,
    fontFace: FB, fontSize: 12, color: C.primary, charSpacing: 12, bold: true, margin: 0,
  });
  // main title
  slide.addText(sl.title, {
    x: 0.8, y: 2.5, w: 12, h: 1.6,
    fontFace: FH, fontSize: 56, bold: true, color: C.fg, margin: 0,
  });
  if (sl.subtitle) {
    slide.addText(sl.subtitle, {
      x: 0.8, y: 4.3, w: 12, h: 0.8,
      fontFace: FH, fontSize: 22, color: C.primary2, margin: 0,
    });
  }
  if (sl.body) {
    slide.addText(sl.body, {
      x: 0.8, y: 5.3, w: 12, h: 1.0,
      fontFace: FB, fontSize: 14, color: C.muted, margin: 0,
    });
  }
}

function renderSection(slide: any, sl: SlideSpec, C: any, FH: string, FB: string) {
  // Big section divider
  slide.addShape('rect', {
    x: 0, y: 0, w: 13.3, h: 7.5,
    fill: { color: C.bg2 }, line: { type: 'none' },
  });
  if (sl.emoji) {
    slide.addText(sl.emoji, {
      x: 0.8, y: 2.0, w: 2, h: 2,
      fontSize: 96, color: C.primary, margin: 0,
    });
  }
  slide.addShape('rect', {
    x: 0.8, y: 4.0, w: 1.5, h: 0.06,
    fill: { color: C.primary }, line: { type: 'none' },
  });
  slide.addText(sl.subtitle || 'SECTION', {
    x: 0.8, y: 4.15, w: 11, h: 0.4,
    fontFace: FB, fontSize: 13, color: C.primary, charSpacing: 8, bold: true, margin: 0,
  });
  slide.addText(sl.title, {
    x: 0.8, y: 4.6, w: 11, h: 1.5,
    fontFace: FH, fontSize: 48, bold: true, color: C.fg, margin: 0,
  });
  if (sl.body) {
    slide.addText(sl.body, {
      x: 0.8, y: 6.0, w: 11, h: 1.0,
      fontFace: FB, fontSize: 16, color: C.fg2, margin: 0,
    });
  }
}

function renderAgenda(slide: any, sl: SlideSpec, C: any, FH: string, FB: string, idx: number, total: number) {
  sectionHeader(slide, idx + 1, sl, C, FH, FB);
  const items = sl.bullets ?? [];
  items.forEach((it, i) => {
    const y = 2.0 + i * 0.65;
    slide.addText(String(i + 1).padStart(2, '0'), {
      x: 0.6, y, w: 0.7, h: 0.55,
      fontFace: FH, fontSize: 22, bold: true, color: C.primary, margin: 0,
    });
    slide.addText(it, {
      x: 1.4, y, w: 11.5, h: 0.55,
      fontFace: FH, fontSize: 18, color: C.fg, valign: 'middle', margin: 0,
    });
  });
  pageNumber(slide, idx, total, C, FB);
}

function renderBullets(slide: any, sl: SlideSpec, C: any, FH: string, FB: string, idx: number, total: number, _pres: any) {
  sectionHeader(slide, idx + 1, sl, C, FH, FB);
  if (sl.body) {
    slide.addText(sl.body, {
      x: 0.6, y: 1.85, w: 12.2, h: 0.5,
      fontFace: FB, fontSize: 14, color: C.fg2, margin: 0,
    });
  }
  const yStart = sl.body ? 2.55 : 2.0;
  const items = sl.bullets ?? [];
  items.forEach((it, i) => {
    const y = yStart + i * 0.7;
    slide.addShape('rect', {
      x: 0.6, y: y + 0.15, w: 0.06, h: 0.4,
      fill: { color: C.primary }, line: { type: 'none' },
    });
    slide.addText(it, {
      x: 0.85, y, w: 12.2, h: 0.6,
      fontFace: FB, fontSize: 17, color: C.fg, valign: 'middle', margin: 0,
    });
  });
  pageNumber(slide, idx, total, C, FB);
}

function renderTwoColumn(slide: any, sl: SlideSpec, C: any, FH: string, FB: string, idx: number, total: number, _pres: any) {
  sectionHeader(slide, idx + 1, sl, C, FH, FB);
  if (sl.body) {
    slide.addText(sl.body, {
      x: 0.6, y: 1.85, w: 12.2, h: 0.5,
      fontFace: FB, fontSize: 14, color: C.fg2, margin: 0,
    });
  }
  const cols = sl.columns ?? [];
  const yStart = sl.body ? 2.55 : 2.0;
  cols.slice(0, 2).forEach((c, i) => {
    const x = 0.6 + i * 6.18;
    slide.addShape('rect', {
      x, y: yStart, w: 6.0, h: 4.2,
      fill: { color: C.card }, line: { color: C.border, width: 1 },
    });
    slide.addShape('rect', {
      x, y: yStart, w: 0.1, h: 4.2,
      fill: { color: C.primary }, line: { type: 'none' },
    });
    slide.addText(c.heading, {
      x: x + 0.3, y: yStart + 0.3, w: 5.5, h: 0.6,
      fontFace: FH, fontSize: 22, bold: true, color: C.fg, margin: 0,
    });
    slide.addText(c.body, {
      x: x + 0.3, y: yStart + 1.0, w: 5.5, h: 3.0,
      fontFace: FB, fontSize: 14, color: C.fg2, margin: 0,
    });
  });
  pageNumber(slide, idx, total, C, FB);
}

function renderThree(slide: any, sl: SlideSpec, C: any, FH: string, FB: string, idx: number, total: number, _pres: any) {
  sectionHeader(slide, idx + 1, sl, C, FH, FB);
  if (sl.body) {
    slide.addText(sl.body, {
      x: 0.6, y: 1.85, w: 12.2, h: 0.5,
      fontFace: FB, fontSize: 14, color: C.fg2, margin: 0,
    });
  }
  const cols = sl.columns ?? [];
  const yStart = sl.body ? 2.55 : 2.0;
  cols.slice(0, 3).forEach((c, i) => {
    const x = 0.6 + i * 4.18;
    slide.addShape('rect', {
      x, y: yStart, w: 4.0, h: 4.2,
      fill: { color: C.card }, line: { color: C.border, width: 1 },
    });
    slide.addShape('rect', {
      x, y: yStart, w: 4.0, h: 0.08,
      fill: { color: C.primary }, line: { type: 'none' },
    });
    slide.addText(c.heading, {
      x: x + 0.3, y: yStart + 0.4, w: 3.5, h: 0.6,
      fontFace: FH, fontSize: 18, bold: true, color: C.fg, margin: 0,
    });
    slide.addText(c.body, {
      x: x + 0.3, y: yStart + 1.1, w: 3.5, h: 3.0,
      fontFace: FB, fontSize: 13, color: C.fg2, margin: 0,
    });
  });
  pageNumber(slide, idx, total, C, FB);
}

function renderQuote(slide: any, sl: SlideSpec, C: any, FH: string, FB: string) {
  slide.addText('"', {
    x: 0.8, y: 1.5, w: 1, h: 1.5,
    fontFace: 'Georgia', fontSize: 120, color: C.primary, margin: 0,
  });
  slide.addText(sl.title, {
    x: 1.5, y: 2.2, w: 11.0, h: 2.5,
    fontFace: FH, fontSize: 32, italic: true, color: C.fg, margin: 0,
  });
  if (sl.subtitle) {
    slide.addText(`— ${sl.subtitle}`, {
      x: 1.5, y: 5.0, w: 11.0, h: 0.5,
      fontFace: FB, fontSize: 14, color: C.muted, margin: 0,
    });
  }
}

function renderClosing(slide: any, sl: SlideSpec, C: any, FH: string, FB: string, spec: DeckSpec, _pres: any) {
  slide.addShape('ellipse', {
    x: 9, y: -2, w: 6, h: 6,
    fill: { color: C.primary, transparency: 78 }, line: { type: 'none' },
  });
  slide.addText(sl.subtitle || 'THANK YOU', {
    x: 0.8, y: 2.5, w: 12, h: 0.5,
    fontFace: FB, fontSize: 14, color: C.primary, charSpacing: 12, bold: true, margin: 0,
  });
  slide.addText(sl.title, {
    x: 0.8, y: 3.0, w: 12, h: 2.0,
    fontFace: FH, fontSize: 56, bold: true, color: C.fg, margin: 0,
  });
  if (sl.body) {
    slide.addText(sl.body, {
      x: 0.8, y: 5.2, w: 12, h: 1.0,
      fontFace: FB, fontSize: 16, color: C.fg2, margin: 0,
    });
  }
  slide.addText(spec.author, {
    x: 0.8, y: 6.6, w: 12, h: 0.4,
    fontFace: FB, fontSize: 11, color: C.subtle, charSpacing: 4, margin: 0,
  });
}

// ── ヘルパー ──────────────────────────────────────────
function lightenHex(hex: string, amount: number): string {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return hex;
  const num = parseInt(h, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.round(r + (255 - r) * amount));
  g = Math.min(255, Math.round(g + (255 - g) * amount));
  b = Math.min(255, Math.round(b + (255 - b) * amount));
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}
