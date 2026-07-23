// ============================================================
// 画像生成 — Pollinations (無料・即時) + DALL-E 3 (高品質オプション)
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { aiFetch } from './aiFetch';

export type ImageProvider = 'pollinations' | 'dalle3';
export type ImageAspect =
  | 'note-hero' | 'x-post' | 'square' | 'portrait' | 'landscape'
  | 'ig-square' | 'ig-story' | 'youtube-thumb' | 'banner-wide' | 'a4-portrait' | 'a4-landscape';

export interface ImageDimensions { width: number; height: number; }
export const ASPECTS: Record<ImageAspect, ImageDimensions & { label: string; group: 'social' | 'doc' | 'free' }> = {
  'note-hero':     { width: 1280, height: 720,  label: 'note 見出し画像 (16:9)',          group: 'social' },
  'x-post':        { width: 1200, height: 675,  label: 'X 投稿画像 (16:9)',                group: 'social' },
  'ig-square':     { width: 1080, height: 1080, label: 'Instagram フィード (1:1)',         group: 'social' },
  'ig-story':      { width: 1080, height: 1920, label: 'Instagram ストーリー (9:16)',      group: 'social' },
  'youtube-thumb': { width: 1280, height: 720,  label: 'YouTube サムネ (16:9)',            group: 'social' },
  'banner-wide':   { width: 1500, height: 500,  label: 'バナー (3:1)',                     group: 'social' },
  'square':        { width: 1024, height: 1024, label: '正方形 (1:1)',                     group: 'free' },
  'landscape':     { width: 1536, height: 1024, label: '横長 (3:2)',                       group: 'free' },
  'portrait':      { width: 1024, height: 1536, label: '縦長 (2:3)',                       group: 'free' },
  'a4-portrait':   { width: 1240, height: 1754, label: 'A4 縦 (印刷用)',                   group: 'doc' },
  'a4-landscape':  { width: 1754, height: 1240, label: 'A4 横 (印刷用)',                   group: 'doc' },
};

export type VisualStyle = 'editorial' | 'minimal' | 'cinematic' | 'pop' | 'watercolor' | 'photo';
export const STYLE_OPTIONS: { value: VisualStyle; label: string; emoji: string; modifier: string }[] = [
  { value: 'editorial',  label: 'エディトリアル', emoji: '📰', modifier: 'editorial illustration, magazine cover style, clean composition, sophisticated color palette, professional' },
  { value: 'minimal',    label: 'ミニマル',     emoji: '◯',  modifier: 'minimalist illustration, lots of whitespace, simple geometric shapes, muted colors, elegant' },
  { value: 'cinematic',  label: 'シネマティック', emoji: '🎬', modifier: 'cinematic photograph, dramatic lighting, shallow depth of field, film grain, atmospheric, moody' },
  { value: 'pop',        label: 'ポップ',       emoji: '🎨', modifier: 'pop art illustration, bold vibrant colors, playful, modern flat design' },
  { value: 'watercolor', label: '水彩',         emoji: '🖌', modifier: 'soft watercolor illustration, delicate brush strokes, gentle pastel tones, hand-painted feel' },
  { value: 'photo',      label: 'フォト写実',   emoji: '📷', modifier: 'high-quality professional photograph, natural lighting, realistic, sharp details' },
];

export function isOpenAIConfigured(): boolean {
  return !!(import.meta.env.VITE_OPENAI_API_KEY as string | undefined);
}

// ─── AI で「投稿テキスト → 画像プロンプト」変換 ───────────────
const PROMPT_SYS = `あなたは AI 画像生成のためのプロンプトエンジニアです。
日本語の記事テキスト・SNS投稿から、視覚的に魅力的な画像生成プロンプト (英語) を作ります。

返答は **JSONのみ** (コードブロック・説明文なし):
{
  "visual_prompt": "英語で書かれた具体的な画像描写 (主題・雰囲気・構図・色・光・スタイル)。文字を含む画像は要求しない。"
}

ルール:
- 必ず英語で、具体的・視覚的な単語のみ
- 文字 (text/letters/words) は要求しない (生成 AI は文字が苦手)
- 主題1つに絞る (詰め込みすぎない)
- 80-150 単語程度`;

export async function generateImagePrompt(opts: {
  settings: AppSettings;
  topic: string;
  context?: string;
}): Promise<string> {
  // 英訳プロンプト生成は軽量タスクなので Gemini で十分。
  // Master でも Claude を浪費しないように x-ai-weight: light を指定。
  // (audit r2 で imageGen が Master Claude を浪費していると flagged)
  // 失敗時はテンプレ英訳プロンプトに fallback (画像生成は止めない)
  const fallback = `An evocative editorial illustration capturing the essence of: ${opts.topic}. ${opts.context || ''}`;
  const userPrompt = `## テキスト\n${opts.topic}\n\n${opts.context ? `## 文脈\n${opts.context}\n` : ''}\n上記の本質を視覚化する画像プロンプトを作ってください。`;
  try {
    const data = await enqueueClaudeCall(async () => {
      const res = await aiFetch({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-weight': 'light',
        },
        body: JSON.stringify({
          model: opts.settings.preferredModel,
          max_tokens: 600,
          system: PROMPT_SYS,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `画像プロンプト生成エラー: ${res.status}`);
      }
      return res.json();
    });
    const text = data.content?.[0]?.text ?? '';
    if (!text) return fallback;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : text);
      return parsed.visual_prompt || text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch (e) {
    console.warn('[imageGen] prompt 生成失敗、テンプレに fallback', e);
    return fallback;
  }
}

// ─── 画像生成 ─────────────────────────────────
export interface GenerateImageResult {
  url: string;
  dataUrl?: string; // 直接 data: URL に変換した結果 (将来用)
  provider: ImageProvider;
  prompt: string;
  width: number;
  height: number;
  generatedAt: string;
}

/** Pollinations.ai (無料・無認証・Flux モデル) */
async function genWithPollinations(prompt: string, dim: ImageDimensions, seed?: number): Promise<string> {
  // safe URL: encode prompt
  const seedNum = seed ?? Math.floor(Math.random() * 1_000_000);
  const params = new URLSearchParams({
    width: String(dim.width),
    height: String(dim.height),
    seed: String(seedNum),
    model: 'flux',
    nologo: 'true',
    enhance: 'true',
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
  // 画像が利用可能になるまで待機 (HEAD リクエストで確認)
  // Pollinations は同期的に画像を返すため、画像 URL をそのまま返してOK
  return url;
}

/** OpenAI DALL-E 3 (高品質、要 API キー) */
async function genWithDalle3(prompt: string, dim: ImageDimensions): Promise<string> {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) || '';
  if (!apiKey) throw new Error('VITE_OPENAI_API_KEY が未設定です');

  // DALL-E 3 のサポートサイズ: 1024x1024 / 1792x1024 / 1024x1792
  let size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024';
  const ratio = dim.width / dim.height;
  if (ratio > 1.3) size = '1792x1024';
  else if (ratio < 0.77) size = '1024x1792';

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 4000),
      n: 1,
      size,
      quality: 'standard',
      response_format: 'url',
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`DALL-E 3 エラー: ${res.status} ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const url = data?.data?.[0]?.url;
  if (!url) throw new Error('DALL-E 3 から画像が返りませんでした');
  return url;
}

export async function generateImage(opts: {
  prompt: string;
  aspect: ImageAspect;
  style: VisualStyle;
  provider?: ImageProvider;
  seed?: number;
}): Promise<GenerateImageResult> {
  const dim = ASPECTS[opts.aspect];
  const styleMod = STYLE_OPTIONS.find(s => s.value === opts.style)?.modifier || '';
  const fullPrompt = `${opts.prompt}. ${styleMod}. high quality, no text, no letters`;

  const provider: ImageProvider = opts.provider || (isOpenAIConfigured() ? 'dalle3' : 'pollinations');

  let url: string;
  try {
    if (provider === 'dalle3') {
      url = await genWithDalle3(fullPrompt, dim);
    } else {
      url = await genWithPollinations(fullPrompt, dim, opts.seed);
    }
  } catch (e) {
    // DALL-E 失敗時は Pollinations にフォールバック
    if (provider === 'dalle3') {
      url = await genWithPollinations(fullPrompt, dim, opts.seed);
      return {
        url, provider: 'pollinations', prompt: fullPrompt,
        width: dim.width, height: dim.height,
        generatedAt: new Date().toISOString(),
      };
    }
    throw e;
  }

  return {
    url, provider, prompt: fullPrompt,
    width: dim.width, height: dim.height,
    generatedAt: new Date().toISOString(),
  };
}

/** 画像 URL を data URL に変換 (note 埋め込み等用) */
export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`画像取得失敗: ${res.status}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/** 画像をファイルとしてダウンロード */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // CORS で取得失敗時は新タブで開く
    window.open(url, '_blank', 'noopener');
  }
}
