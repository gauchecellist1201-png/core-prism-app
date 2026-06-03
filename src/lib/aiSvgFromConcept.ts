// ============================================================
// aiSvgFromConcept.ts — Claude にコンセプトを渡して SVG コードを返してもらう
//
// オーナー指示 (2026-06-04 第 19 波 TTT):
//   Gemini Imagen / DALL-E を使わず、Claude に「コンセプトを聞き取り → SVG」
//   を返してもらう土台。クリエイティブ系 Studio で「概念から SVG 自動生成」。
//
// 使い方:
//   const { svg, raw } = await aiSvgFromConcept({
//     concept: '夜明けの海',
//     style: 'flat',
//     viewBox: '0 0 600 400',
//   });
// ============================================================

import { callAiWithFallback } from './aiFallbackChain';

export interface SvgFromConceptInput {
  /** 描いてほしい概念 (1〜2 行) */
  concept: string;
  /** 雰囲気: flat / line / soft / bold (任意) */
  style?: 'flat' | 'line' | 'soft' | 'bold' | string;
  /** SVG の viewBox (省略時 '0 0 600 400') */
  viewBox?: string;
  /** メインカラー (任意。HEX) */
  primaryColor?: string;
  /** 背景透過 (省略時 false) */
  transparent?: boolean;
  /** 中断シグナル (任意) */
  signal?: AbortSignal;
}

export interface SvgFromConceptResult {
  /** 抽出した <svg ...>…</svg> 単体 (sanitize 済) */
  svg: string;
  /** Claude の生レスポンス (デバッグ用) */
  raw: string;
  /** どのモデルで生成されたか */
  resolvedModel: string;
}

const SYSTEM_PROMPT = `あなたは SVG アーティストです。ユーザーが概念を伝えてきたら、
1 ファイルに収まる <svg>...</svg> を返してください。

厳守ルール:
1. 出力は <svg ...> から始まり </svg> で終わる **単一の SVG 要素のみ** を返す
2. SVG 内に <script> や onload など実行可能なコードは含めない (静的画像のみ)
3. 不要な装飾コメント・説明文は SVG タグ外に書かない (タグの外には何も書かない)
4. viewBox / width / height を必ず指定
5. 16 色 以内、stroke / fill / linearGradient / radialGradient を活用
6. アクセシビリティのため <title> 要素を 1 つ含める

スタイルの目安:
- flat: 単色塗りで構成 (シャドウ無し)
- line: 主に stroke で表現 (塗りつぶし最小)
- soft: 淡いグラデーション + 角丸
- bold: コントラスト高い太線 + 大きな図形

JSON ではなく **SVG コード本体だけ** を返してください。`;

/** Claude の応答から最初の <svg>...</svg> を抜き出す (codefence / 文章混在に対応) */
function extractSvg(text: string): string | null {
  if (!text) return null;
  // ```svg ... ``` ブロックを優先
  const fenced = text.match(/```(?:svg|xml|html)?\s*\n?([\s\S]*?)\n?```/i);
  const candidate = fenced ? fenced[1] : text;
  const m = candidate.match(/<svg[\s\S]*?<\/svg>/i);
  return m ? m[0].trim() : null;
}

/** SVG から script / on* 属性 / javascript: URL を取り除く (簡易 sanitize) */
function sanitizeSvg(svg: string): string {
  let out = svg;
  out = out.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/javascript:/gi, '');
  out = out.replace(/data:text\/html/gi, '');
  return out.trim();
}

export async function aiSvgFromConcept(input: SvgFromConceptInput): Promise<SvgFromConceptResult> {
  const viewBox = input.viewBox || '0 0 600 400';
  const userPrompt = [
    `概念: ${input.concept}`,
    input.style ? `スタイル: ${input.style}` : '',
    `viewBox: ${viewBox}`,
    input.primaryColor ? `メインカラー: ${input.primaryColor}` : '',
    input.transparent ? '背景は透過にしてください' : '背景も SVG 内で塗ってください',
    '',
    '上記の指示に従い、SVG コード本体のみを返してください。',
  ].filter(Boolean).join('\n');

  const resp = await callAiWithFallback(
    {
      model: 'claude-haiku-4-5',
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    },
    {
      signal: input.signal,
      timeoutMs: 60_000,
    },
  );

  const raw = resp.content?.[0]?.text || '';
  const svg = extractSvg(raw);
  if (!svg) {
    throw new Error('SVG を抽出できませんでした。raw レスポンス: ' + raw.slice(0, 200));
  }
  return {
    svg: sanitizeSvg(svg),
    raw,
    resolvedModel: resp.resolvedModel || 'claude-haiku-4-5',
  };
}

/** dataURL に変換 (img src 等に直接 inject 可能) */
export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}
