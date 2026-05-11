// ============================================================
// YouTube 字幕取得 Edge Function
// ブラウザから直接叩くと CORS で死ぬので、サーバ経由で字幕を取得して返す
// 戦略: ① youtube watch ページから captionTracks URL を抽出 → ② timedtext を取得
//       ③ いずれも失敗したら 404
// ============================================================
export const config = { runtime: 'edge' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string };
};

function extractVideoId(input: string): string | null {
  if (!input) return null;
  // すでに ID
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  // 各種 URL
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return null;
}

/** YouTube watch ページ HTML から captionTracks 配列を抽出 */
function extractCaptionTracks(html: string): CaptionTrack[] {
  // ytInitialPlayerResponse から captionTracks を取り出す
  const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!playerMatch) return [];
  try {
    const obj = JSON.parse(playerMatch[1]);
    const tracks = obj?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (Array.isArray(tracks)) return tracks;
  } catch {/* ignore */}
  return [];
}

/** timedtext XML → 連結プレーンテキスト */
function parseTimedTextXml(xml: string): string {
  const matches = xml.match(/<text[^>]*>([\s\S]*?)<\/text>/g);
  if (!matches || matches.length === 0) return '';
  return matches
    .map(m => m.replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, ' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** timedtext JSON (json3) → 連結プレーンテキスト */
function parseTimedTextJson3(json: string): string {
  try {
    const obj = JSON.parse(json);
    if (!obj?.events) return '';
    const parts: string[] = [];
    for (const ev of obj.events) {
      if (!ev.segs) continue;
      for (const seg of ev.segs) {
        if (seg.utf8) parts.push(seg.utf8);
      }
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch { return ''; }
}

async function fetchTranscriptForVideo(videoId: string): Promise<{
  ok: boolean;
  transcript?: string;
  language?: string;
  source?: string;
  error?: string;
}> {
  // 1. watch ページから captionTracks を取得
  let html: string;
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=ja`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
        'Accept-Language': 'ja,en;q=0.9',
      },
    });
    if (!res.ok) return { ok: false, error: `watch page status ${res.status}` };
    html = await res.text();
  } catch (e: any) {
    return { ok: false, error: `watch fetch failed: ${e.message}` };
  }

  const tracks = extractCaptionTracks(html);
  if (tracks.length === 0) {
    return { ok: false, error: 'この動画には字幕が用意されていません (公開字幕なし)' };
  }

  // 2. 言語の優先順位 (ja > en > その他先頭)
  const sorted = [...tracks].sort((a, b) => {
    const score = (t: CaptionTrack) =>
      t.languageCode === 'ja' ? 3 : t.languageCode === 'en' ? 2 : t.kind === 'asr' ? 0.5 : 1;
    return score(b) - score(a);
  });

  for (const track of sorted) {
    if (!track.baseUrl) continue;
    // json3 を優先 (より構造化)
    try {
      const url = track.baseUrl + '&fmt=json3';
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.text();
        const text = parseTimedTextJson3(body);
        if (text.length > 50) {
          return { ok: true, transcript: text, language: track.languageCode, source: 'youtube-timedtext-json3' };
        }
      }
    } catch {/* try next */}
    // XML フォールバック
    try {
      const res = await fetch(track.baseUrl);
      if (res.ok) {
        const xml = await res.text();
        const text = parseTimedTextXml(xml);
        if (text.length > 50) {
          return { ok: true, transcript: text, language: track.languageCode, source: 'youtube-timedtext-xml' };
        }
      }
    } catch {/* try next */}
  }
  return { ok: false, error: '字幕を取得できませんでした' };
}

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const input = url.searchParams.get('v') || url.searchParams.get('videoId') || url.searchParams.get('url') || '';
  const videoId = extractVideoId(input);
  if (!videoId) {
    return new Response(JSON.stringify({ ok: false, error: 'videoId / url パラメータが必要です' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  const result = await fetchTranscriptForVideo(videoId);
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 404,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      ...corsHeaders,
    },
  });
}
