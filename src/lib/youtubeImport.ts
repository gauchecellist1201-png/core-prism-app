// ============================================================
// YouTube → AI 要約・ナレッジ化ユーティリティ
// ============================================================
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from './apiQueue';
import { aiFetch } from './aiFetch';

export interface VideoMeta {
  videoId: string;
  url: string;
  title: string;
  author: string;
  /** チャンネル URL (oEmbed の author_url, あれば) — シリーズ束ねに使う */
  authorUrl?: string;
  thumbnailUrl: string;
}

export interface YouTubeSummary {
  summary: string;
  chapters: Array<{ title: string; content: string }>;
  quotes: string[];
  actions: string[];
}

/** ─── シリーズビュー (同チャンネル動画の蓄積) ────────── */

const SERIES_KEY = 'core_youtube_series_v1';
const MAX_SERIES_ITEMS = 200;

export interface SeriesEntry {
  videoId: string;
  url: string;
  title: string;
  author: string;
  authorUrl?: string;
  thumbnailUrl: string;
  importedAt: string;
  /** AI 要約 1 行 (シリーズ一覧で読みやすくするため) */
  summaryLine?: string;
}

export function loadSeriesArchive(): SeriesEntry[] {
  try {
    const raw = localStorage.getItem(SERIES_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SeriesEntry[]).slice(0, MAX_SERIES_ITEMS);
  } catch { return []; }
}

export function recordSeriesEntry(entry: SeriesEntry) {
  try {
    const arr = loadSeriesArchive().filter(e => e.videoId !== entry.videoId);
    arr.unshift(entry);
    localStorage.setItem(SERIES_KEY, JSON.stringify(arr.slice(0, MAX_SERIES_ITEMS)));
  } catch { /* quota */ }
}

/** 同じ著者でグルーピング (件数 desc) */
export function groupSeriesByAuthor(): Array<{ author: string; authorUrl?: string; videos: SeriesEntry[] }> {
  const arr = loadSeriesArchive();
  const map = new Map<string, { author: string; authorUrl?: string; videos: SeriesEntry[] }>();
  for (const e of arr) {
    const key = e.authorUrl || e.author;
    if (!map.has(key)) map.set(key, { author: e.author, authorUrl: e.authorUrl, videos: [] });
    map.get(key)!.videos.push(e);
  }
  return [...map.values()].sort((a, b) => b.videos.length - a.videos.length);
}

/** YouTube URL から videoId を抽出 */
export function parseYouTubeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    // youtu.be 短縮
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('?')[0];
      return id.length === 11 ? id : null;
    }
    // youtube.com/watch?v=
    const v = u.searchParams.get('v');
    if (v && v.length === 11) return v;
    // youtube.com/embed/ or /shorts/
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    // 正規表現フォールバック
    const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

/** 複数行に貼られた URL を全部抽出 (1 行 1 URL でも、改行混在でも OK) */
export function extractUrlList(input: string): string[] {
  const tokens = input.split(/\s+/g).map(s => s.trim()).filter(Boolean);
  const ids = new Set<string>();
  const result: string[] = [];
  for (const t of tokens) {
    const id = parseYouTubeUrl(t);
    if (id && !ids.has(id)) {
      ids.add(id);
      result.push(t);
    }
  }
  return result;
}

/** oEmbed API でタイトル・投稿者・サムネを取得 (CORS OK) */
export async function fetchOEmbed(url: string): Promise<VideoMeta> {
  const videoId = parseYouTubeUrl(url);
  if (!videoId) throw new Error('YouTube URLを正しく入力してください');

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error(`oEmbed取得失敗: ${res.status}`);
  const data = await res.json();

  return {
    videoId,
    url,
    title: data.title ?? 'YouTube動画',
    author: data.author_name ?? '',
    authorUrl: data.author_url ?? undefined,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/**
 * 字幕テキストの取得を試みる。
 * ブラウザからは CORS 制約のため多くのエンドポイントが失敗するので null 返却して
 * 呼び出し側で手動入力 UI にフォールバックする。
 */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  // Vercel Edge Function 経由で字幕を取得 (CORS 回避)
  try {
    const res = await fetch(`/api/youtube/transcript?v=${encodeURIComponent(videoId)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !data.transcript) return null;
    return typeof data.transcript === 'string' && data.transcript.length > 50 ? data.transcript : null;
  } catch {
    return null;
  }
}

/**
 * 字幕が無い動画用のフォールバック: 動画ページから description を取得。
 * Edge Function (/api/youtube/transcript) は description も返すように拡張済み (なくても
 * keywords / shortDescription のような meta tag からの抽出で代替)。
 * 失敗時は null。
 */
export async function fetchDescriptionFallback(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/youtube/transcript?v=${encodeURIComponent(videoId)}&mode=description`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.description && typeof data.description === 'string' && data.description.length > 30) {
      return data.description;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 字幕 → ダメなら description → それでもダメなら oEmbed のタイトル + 著者だけ。
 * AI 要約は最低限の情報量があれば動かす方針。
 */
export async function fetchTranscriptOrFallback(meta: VideoMeta): Promise<{
  text: string;
  source: 'transcript' | 'description' | 'meta-only';
}> {
  const t = await fetchTranscript(meta.videoId);
  if (t) return { text: t, source: 'transcript' };
  const d = await fetchDescriptionFallback(meta.videoId);
  if (d) return { text: d, source: 'description' };
  // 最低限のフォールバック: タイトル + 著者だけで要約させる (極端に短い結果になるが諦めない)
  return {
    text: `タイトル: ${meta.title}\nチャンネル: ${meta.author}\n(字幕も説明文も取得できなかったため、タイトルとチャンネル名のみから推測してください)`,
    source: 'meta-only',
  };
}

/** Claude に要約・章立て・引用・アクションを依頼 */
export async function summarizeWithClaude(
  settings: AppSettings,
  transcript: string,
  meta: VideoMeta,
): Promise<YouTubeSummary> {
  // API キーは main.tsx の interceptor が自動付与。Anthropic 直叩きから /api/ai 経由に統一
  const SYSTEM = `あなたは動画コンテンツを構造化してナレッジ化する専門家です。
提供された字幕・テキストを分析し、以下の JSON を返してください。

{
  "summary": "3〜5行の要約",
  "chapters": [
    { "title": "章タイトル", "content": "その章の要点 (2〜3行)" }
  ],
  "quotes": ["印象的な引用や重要フレーズ (最大5件)"],
  "actions": ["視聴者が取れる具体的なアクション (最大5件)"]
}

- chaptersは内容に応じて3〜7章
- 日本語で回答
- JSONのみ返す (前後のコードブロック記号不要)
- 情報が乏しい (タイトルだけ等) 場合は、無理に章立てを増やさず簡潔に。`;

  const userPrompt = `## 動画タイトル\n${meta.title}\n## チャンネル\n${meta.author}\n## URL\n${meta.url}\n\n## 字幕 / テキスト\n${transcript.slice(0, 15000)}`;

  return enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.preferredModel || 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `API エラー: ${res.status}`);
    }

    const data = await res.json();
    const raw = data.content?.[0]?.text ?? '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI の応答を解析できませんでした');
    return JSON.parse(jsonMatch[0]) as YouTubeSummary;
  });
}
