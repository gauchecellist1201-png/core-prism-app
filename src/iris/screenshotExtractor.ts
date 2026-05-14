// ============================================================
// IRIS — Screenshot Extractor
// Instagram インサイトのスクショ → AI Vision で投稿メタデータ抽出
// 「手入力ゼロ」を実現する戦略タブの心臓部
// ============================================================
import type { AppSettings } from '../types/identity';
import type { Platform, ContentType, PlatformMetrics } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

export interface ExtractedPost {
  title: string;
  caption?: string;
  tags?: string[];
  topic?: string;
  platform: Platform;
  contentType: ContentType;
  postedAt?: string;
  metrics: PlatformMetrics;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

/** File → base64 (mediaType と分離して返す) */
export async function fileToBase64Pair(file: File): Promise<{ data: string; mediaType: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { data: btoa(binary), mediaType: file.type || 'image/jpeg' };
}

/** インサイトのスクショ 1〜複数枚から、検出された投稿を配列で返す */
export async function extractPostsFromScreenshots(opts: {
  settings: AppSettings;
  images: { data: string; mediaType: string }[];
}): Promise<ExtractedPost[]> {
  const apiKey = getApiKey(opts.settings);
  if (opts.images.length === 0) return [];

  const sys = `あなたは Instagram インサイト画面のスクリーンショットを読み取って、投稿の生データを構造化する OCR + ビジョン解析エキスパートです。

## タスク
渡された画像から、検出できる投稿をすべて抽出してください。
- 1 枚に複数投稿が写っていれば、それぞれ別オブジェクトで返す
- 同じ投稿が複数画像に跨っていれば 1 つに統合
- 数値は必ず数値 (型 number) で返す。"7.5K" は 7500、"1,234" は 1234 に変換
- ER (engagementRate) はパーセント数値 (4.2 など。% は付けない)
- 投稿日時は ISO 8601 (例: 2025-11-08T20:00:00+09:00)、不明なら省略
- ハッシュタグは "#" 付きで配列に
- キャプションは見えている範囲で省略せずそのまま (50 字以内に切り詰めなくて良い)

## 出力フォーマット (JSON のみ、説明文・コードブロック・前置き禁止)
{
  "posts": [
    {
      "title": "投稿を一言で (キャプション冒頭 or 内容要約 20 字以内)",
      "caption": "見えるキャプション本文",
      "tags": ["#tag1", "#tag2"],
      "topic": "コスメ / 旅 / 食 / ライフ等 (推測で可)",
      "platform": "instagram",
      "contentType": "reel" | "post" | "story",
      "postedAt": "YYYY-MM-DDTHH:mm:ss+09:00",
      "metrics": {
        "reach": 0,
        "impressions": 0,
        "engagementRate": 0,
        "likes": 0,
        "comments": 0,
        "saves": 0,
        "shares": 0,
        "views": 0
      },
      "confidence": "high" | "medium" | "low",
      "notes": "読み取りの注意点 (一部数値が見切れている等)"
    }
  ]
}

## ルール
- metrics 内のキーは「読み取れた値だけ」入れる。読めなければそのキーは省略
- 投稿が 1 件も検出できなければ "posts": []
- 必ず posts は配列。空でも配列で返す
- "K", "M" 表記の数値は実数に展開 ("1.2K" → 1200、"3M" → 3000000)
- 確信度: 数値が鮮明=high / 一部曖昧=medium / かなり推測=low

最後にもう一度: JSON のみを返す。前置きも後置きも一切なし。`;

  const content: any[] = [
    { type: 'text', text: `画像 ${opts.images.length} 枚を解析して、検出された投稿の JSON 配列を返してください。` },
    ...opts.images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.data },
    })),
    { type: 'text', text: '上の画像から検出した投稿を、上述の JSON フォーマットで返してください。' },
  ];

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 4000,
        system: sys,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `スクショ解析エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    const posts: ExtractedPost[] = Array.isArray(parsed.posts) ? parsed.posts : [];
    return posts.map(p => ({
      title: p.title || '無題',
      caption: p.caption,
      tags: Array.isArray(p.tags) ? p.tags : undefined,
      topic: p.topic,
      platform: (p.platform as Platform) || 'instagram',
      contentType: normalizeContentType(p.contentType),
      postedAt: p.postedAt,
      metrics: sanitizeMetrics((p.metrics || {}) as Record<string, unknown>),
      confidence: (p.confidence as 'high' | 'medium' | 'low') || 'medium',
      notes: p.notes,
    }));
  } catch {
    return [];
  }
}

function normalizeContentType(v: unknown): ContentType {
  if (typeof v !== 'string') return 'post';
  const s = v.toLowerCase();
  if (s.includes('reel')) return 'reel';
  if (s.includes('story')) return 'story';
  if (s.includes('short')) return 'short';
  if (s.includes('live')) return 'live';
  if (s.includes('article') || s.includes('note')) return 'article';
  if (s.includes('tweet')) return 'tweet';
  if (s.includes('longform') || s.includes('long')) return 'longform';
  return 'post';
}

function sanitizeMetrics(m: Record<string, unknown>): PlatformMetrics {
  const out: PlatformMetrics = {};
  const keys: (keyof PlatformMetrics)[] = ['reach', 'impressions', 'engagementRate', 'likes', 'comments', 'saves', 'shares', 'views'];
  for (const k of keys) {
    const v = m[k as string];
    if (typeof v === 'number' && isFinite(v) && v >= 0) {
      out[k] = v;
    } else if (typeof v === 'string') {
      const n = parseNumberWithUnit(v);
      if (n !== null) out[k] = n;
    }
  }
  return out;
}

function parseNumberWithUnit(s: string): number | null {
  const cleaned = s.replace(/[,\s]/g, '').toLowerCase();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([kmb]?)$/);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2];
  if (unit === 'k') return Math.round(num * 1000);
  if (unit === 'm') return Math.round(num * 1_000_000);
  if (unit === 'b') return Math.round(num * 1_000_000_000);
  return num;
}

// ─── ダッシュボード用集計 (パターン抽出) ──
export interface PostStats {
  total: number;
  avgER: number;
  avgReach: number;
  avgLikes: number;
  avgSaves: number;
  topByER: { id: string; title: string; er: number }[];
  topBySaves: { id: string; title: string; saves: number }[];
  topByShares: { id: string; title: string; shares: number }[];
  /** 0=Sun .. 6=Sat × 0-23時 のヒートマップ (平均ER) */
  heatmap: number[][];
  /** ヒートマップの最大値 (色スケール用) */
  heatmapMax: number;
  /** ベストスロット (top 3) */
  bestSlots: { day: number; hour: number; er: number }[];
  /** フォーマット別パフォーマンス */
  byFormat: { format: ContentType; count: number; avgER: number; avgReach: number }[];
  /** 直近 30 日の時系列 (リーチ + ER) */
  timeline: { date: string; reach: number; er: number; count: number }[];
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

export function computeStats(posts: {
  id: string; title: string; postedAt: string; contentType: ContentType; metrics: PlatformMetrics;
}[]): PostStats {
  if (posts.length === 0) {
    return {
      total: 0, avgER: 0, avgReach: 0, avgLikes: 0, avgSaves: 0,
      topByER: [], topBySaves: [], topByShares: [],
      heatmap: Array.from({ length: 7 }, () => new Array(24).fill(0)),
      heatmapMax: 0,
      bestSlots: [],
      byFormat: [],
      timeline: [],
    };
  }

  const avg = (sel: (p: typeof posts[number]) => number | undefined) => {
    const vals = posts.map(sel).filter((v): v is number => typeof v === 'number');
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const avgER = avg(p => p.metrics.engagementRate);
  const avgReach = avg(p => p.metrics.reach);
  const avgLikes = avg(p => p.metrics.likes);
  const avgSaves = avg(p => p.metrics.saves);

  const topByER = [...posts]
    .filter(p => typeof p.metrics.engagementRate === 'number')
    .sort((a, b) => (b.metrics.engagementRate || 0) - (a.metrics.engagementRate || 0))
    .slice(0, 3)
    .map(p => ({ id: p.id, title: p.title, er: p.metrics.engagementRate || 0 }));

  const topBySaves = [...posts]
    .filter(p => typeof p.metrics.saves === 'number')
    .sort((a, b) => (b.metrics.saves || 0) - (a.metrics.saves || 0))
    .slice(0, 3)
    .map(p => ({ id: p.id, title: p.title, saves: p.metrics.saves || 0 }));

  const topByShares = [...posts]
    .filter(p => typeof p.metrics.shares === 'number')
    .sort((a, b) => (b.metrics.shares || 0) - (a.metrics.shares || 0))
    .slice(0, 3)
    .map(p => ({ id: p.id, title: p.title, shares: p.metrics.shares || 0 }));

  // heatmap: avg ER per (day, hour) bucket
  const buckets: { sum: number; n: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
  );
  for (const p of posts) {
    const er = p.metrics.engagementRate;
    if (typeof er !== 'number') continue;
    const d = new Date(p.postedAt);
    if (isNaN(d.getTime())) continue;
    const day = d.getDay();
    const hour = d.getHours();
    buckets[day][hour].sum += er;
    buckets[day][hour].n += 1;
  }
  const heatmap = buckets.map(row => row.map(b => b.n ? b.sum / b.n : 0));
  const heatmapMax = Math.max(0, ...heatmap.flat());

  const bestSlots: { day: number; hour: number; er: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (heatmap[d][h] > 0) bestSlots.push({ day: d, hour: h, er: heatmap[d][h] });
    }
  }
  bestSlots.sort((a, b) => b.er - a.er);

  // byFormat
  const fmtMap = new Map<ContentType, { er: number[]; reach: number[] }>();
  for (const p of posts) {
    if (!fmtMap.has(p.contentType)) fmtMap.set(p.contentType, { er: [], reach: [] });
    const entry = fmtMap.get(p.contentType)!;
    if (typeof p.metrics.engagementRate === 'number') entry.er.push(p.metrics.engagementRate);
    if (typeof p.metrics.reach === 'number') entry.reach.push(p.metrics.reach);
  }
  const byFormat = [...fmtMap.entries()].map(([format, v]) => {
    const aER = v.er.length ? v.er.reduce((a, b) => a + b, 0) / v.er.length : 0;
    const aR = v.reach.length ? v.reach.reduce((a, b) => a + b, 0) / v.reach.length : 0;
    return { format, count: posts.filter(p => p.contentType === format).length, avgER: aER, avgReach: aR };
  }).sort((a, b) => b.avgER - a.avgER);

  // timeline (last 30 days, daily aggregate)
  const now = Date.now();
  const tlMap = new Map<string, { reach: number; erSum: number; erN: number; count: number }>();
  for (const p of posts) {
    const t = new Date(p.postedAt).getTime();
    if (isNaN(t) || now - t > 30 * 86400_000) continue;
    const key = new Date(p.postedAt).toISOString().slice(0, 10);
    if (!tlMap.has(key)) tlMap.set(key, { reach: 0, erSum: 0, erN: 0, count: 0 });
    const e = tlMap.get(key)!;
    if (typeof p.metrics.reach === 'number') e.reach += p.metrics.reach;
    if (typeof p.metrics.engagementRate === 'number') { e.erSum += p.metrics.engagementRate; e.erN += 1; }
    e.count += 1;
  }
  const timeline = [...tlMap.entries()]
    .map(([date, v]) => ({ date, reach: v.reach, er: v.erN ? v.erSum / v.erN : 0, count: v.count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    total: posts.length, avgER, avgReach, avgLikes, avgSaves,
    topByER, topBySaves, topByShares,
    heatmap, heatmapMax,
    bestSlots: bestSlots.slice(0, 3),
    byFormat,
    timeline,
  };
}

export function dayLabel(d: number): string {
  return DAY_NAMES[d] || '?';
}

// ─── AI 戦略インサイト ──
export interface StrategyInsights {
  /** 次に伸びそうな投稿パターン 3 つ */
  nextWinningPatterns: { headline: string; reason: string; example: string }[];
  /** リーチを倍にするには */
  doubleReachAdvice: { mainAction: string; rationale: string; subActions: string[] };
  /** 最適な曜日 × 時間帯 */
  bestPostingTimes: { day: string; time: string; reason: string }[];
  /** ベストフォーマット (1 行) */
  bestFormatSummary: string;
  /** 1 行の総括コメント */
  oneLiner: string;
}

export async function generateStrategyInsights(opts: {
  settings: AppSettings;
  stats: PostStats;
  recentTitles: string[];
}): Promise<StrategyInsights> {
  const apiKey = getApiKey(opts.settings);

  const sys = `あなたは Instagram グロースを 5 年間追ってきた敏腕ストラテジスト。
データを見て、ぱっと「次のアクション」を 3 つ言い切ります。

返答は JSON のみ:
{
  "nextWinningPatterns": [
    { "headline": "投稿パターン名 (15字)", "reason": "なぜ伸びそうか (30字)", "example": "具体例 (40字)" }
  ],
  "doubleReachAdvice": {
    "mainAction": "一番のレバー (20字)",
    "rationale": "なぜ効くのか (50字)",
    "subActions": ["補助アクション 3 つ"]
  },
  "bestPostingTimes": [
    { "day": "火曜", "time": "21:00", "reason": "理由" }
  ],
  "bestFormatSummary": "リール/写真/カルーセル どれが効いてるか + 戦略 (40字)",
  "oneLiner": "全体総括を 1 行 (40字)"
}

JSON のみ。前置きも後置きもなし。`;

  const userText = `## 直近の数字
- 投稿数: ${opts.stats.total}
- 平均ER: ${opts.stats.avgER.toFixed(2)}%
- 平均リーチ: ${Math.round(opts.stats.avgReach).toLocaleString()}
- 平均いいね: ${Math.round(opts.stats.avgLikes).toLocaleString()}
- 平均保存: ${Math.round(opts.stats.avgSaves).toLocaleString()}

## ER 上位 3
${opts.stats.topByER.map(p => `- "${p.title}" ER ${p.er.toFixed(1)}%`).join('\n') || '(データ不足)'}

## 保存数 上位 3
${opts.stats.topBySaves.map(p => `- "${p.title}" 保存 ${p.saves}`).join('\n') || '(データ不足)'}

## フォーマット別平均ER
${opts.stats.byFormat.map(f => `- ${f.format}: ${f.avgER.toFixed(2)}% (${f.count}本)`).join('\n') || '(データ不足)'}

## ベストスロット
${opts.stats.bestSlots.map(s => `- ${dayLabel(s.day)}曜 ${s.hour}時: ER ${s.er.toFixed(2)}%`).join('\n') || '(データ不足)'}

## 最近のタイトル
${opts.recentTitles.slice(0, 10).map(t => `- ${t}`).join('\n')}

このデータを見て、戦略インサイトを返してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2200,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `インサイト生成エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      nextWinningPatterns: parsed.nextWinningPatterns || [],
      doubleReachAdvice: parsed.doubleReachAdvice || { mainAction: '', rationale: '', subActions: [] },
      bestPostingTimes: parsed.bestPostingTimes || [],
      bestFormatSummary: parsed.bestFormatSummary || '',
      oneLiner: parsed.oneLiner || '',
    };
  } catch {
    return {
      nextWinningPatterns: [],
      doubleReachAdvice: { mainAction: '', rationale: '', subActions: [] },
      bestPostingTimes: [],
      bestFormatSummary: '',
      oneLiner: text.slice(0, 80),
    };
  }
}

// ─── Instagram CSV インポート ──
// Instagram の「アカウント情報をダウンロード」CSV を雑にパース
export function parseInstagramCSV(csv: string): ExtractedPost[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));

  const iTitle = idx(['title', 'caption']);
  const iDate = idx(['posted', 'date', 'time']);
  const iType = idx(['type', 'format']);
  const iReach = idx(['reach']);
  const iImpr = idx(['impression']);
  const iLikes = idx(['like']);
  const iComm = idx(['comment']);
  const iSaves = idx(['save']);
  const iShares = idx(['share']);
  const iViews = idx(['view', 'play']);
  const iER = idx(['engagement', 'er']);

  const out: ExtractedPost[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 2) continue;
    const caption = iTitle >= 0 ? cols[iTitle] : '';
    const date = iDate >= 0 ? cols[iDate] : '';
    const typeRaw = iType >= 0 ? cols[iType].toLowerCase() : '';
    const ct: ContentType = typeRaw.includes('reel') ? 'reel' : typeRaw.includes('story') ? 'story' : typeRaw.includes('carousel') ? 'post' : 'post';

    const metrics: PlatformMetrics = {};
    const setNum = (k: keyof PlatformMetrics, idxN: number) => {
      if (idxN < 0) return;
      const n = parseNumberWithUnit(cols[idxN]?.replace(/[^\d.km]/gi, '') || '');
      if (n !== null) metrics[k] = n;
    };
    setNum('reach', iReach);
    setNum('impressions', iImpr);
    setNum('likes', iLikes);
    setNum('comments', iComm);
    setNum('saves', iSaves);
    setNum('shares', iShares);
    setNum('views', iViews);
    setNum('engagementRate', iER);

    if (!caption && Object.keys(metrics).length === 0) continue;

    out.push({
      title: (caption || '無題').slice(0, 40),
      caption: caption || undefined,
      platform: 'instagram',
      contentType: ct,
      postedAt: parseLooseDate(date),
      metrics,
      confidence: 'high',
    });
  }
  return out;
}

function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parseLooseDate(s: string): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return undefined;
}
