// ============================================================
// IRIS — Instagram プロフィール解析 (本気の精度版)
// 画像 (スクショ) アップロード + Vision API + 詳細スコアリング
// ============================================================
import type { AppSettings } from '../types/identity';
import type { MediaKit } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';
import { aiFetch } from '../lib/aiFetch';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

/** URL → @handle 抽出 */
export function extractInstagramHandle(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith('@')) return t.slice(1).split(/[\s/?]/)[0];
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) return m[1];
  if (/^[A-Za-z0-9._]+$/.test(t)) return t;
  return null;
}

/** ファイル → base64 (Claude Vision の input image 形式) */
export async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  // ブラウザの File.type は image/jpeg / image/png / image/webp など
  const mediaType = file.type || 'image/jpeg';
  return { data: base64, mediaType };
}

// ─── 詳細スコアリング 5 軸 ───
export interface IGScores {
  /** バイオ・プロフィールの強さ */
  bio: number;            // 0-100
  /** ビジュアル統一感 */
  visualConsistency: number;
  /** コンテンツの独自性 */
  contentUniqueness: number;
  /** エンゲージメント効率 */
  engagement: number;
  /** 商業性 (案件を受けやすいか) */
  commercialFit: number;
}

export interface IGAnalysisResult {
  /** 総合スコア (5 軸の加重平均) 0-100 */
  totalScore: number;
  /** 5 軸スコア + 各根拠 */
  scores: {
    [K in keyof IGScores]: { value: number; reason: string; toLevelUp: string }
  };
  /** 1 行の総評 (キャッチー) */
  oneLiner: string;
  /** ブランド・ペルソナのサマリ */
  brandIdentity: string;
  /** 推定オーディエンス */
  estimatedAudience: {
    primary: string;          // 主要層 (例: 25-34歳女性、東京圏、コスメ感度高)
    secondary?: string;
    estimatedSize?: string;   // フォロワー数からの推定リーチ
  };
  /** 強み (具体的に箇条書き) */
  strengths: string[];
  /** 弱み・改善点 (具体的に箇条書き) */
  weaknesses: string[];
  /** 競合 / 参考にすべきインフルエンサーアカウント (3-5 名) */
  competitors: { handle: string; whyRefer: string; learnFrom: string }[];
  /** 受けられそうなブランド業界 */
  targetableBrands: string[];
  /** 想定報酬 */
  estimatedFee: {
    feedPost: { min: number; max: number };
    reel: { min: number; max: number };
    story: { min: number; max: number };
    note: string;
  };
  /** 30 日アクションプラン (週ごとにテーマ + 具体タスク) */
  next30Days: {
    week1: { theme: string; tasks: string[] };
    week2: { theme: string; tasks: string[] };
    week3: { theme: string; tasks: string[] };
    week4: { theme: string; tasks: string[] };
  };
  /** 「すぐ撮れる」具体的な投稿アイデア 5 つ */
  quickPostIdeas: { title: string; hook: string; format: string; expectedReachLevel: 'high' | 'medium' | 'low' }[];
  /** バイオ書き直し提案 */
  bioSuggestion: string;
  /** ハッシュタグ戦略 */
  hashtagStrategy: { mainSet: string[]; nicheSet: string[]; advice: string };
  /** 投稿時間帯の推奨 (曜日 + 時間) */
  postingSchedule: { day: string; time: string; reason: string }[];
  /** 注意点 */
  cautions: string[];
}

interface ContentBlock {
  type: 'text';
  text: string;
}
interface ImageBlock {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
}

export async function analyzeInstagramProfile(opts: {
  settings: AppSettings;
  handle: string;
  pasted: string;
  selfNote?: string;
  /** スクショ画像 (プロフィール / フィード / インサイト) */
  images?: { data: string; mediaType: string }[];
  /** 投稿サンプル (URL / キャプション) を個別に */
  postSamples?: { url?: string; caption?: string; metrics?: string }[];
  /** 既知の数値 (フォロワー、ER 等) */
  knownMetrics?: {
    followers?: number;
    following?: number;
    avgER?: number;
    monthlyReach?: number;
    avgLikes?: number;
    avgComments?: number;
  };
  /** ジャンル */
  niche?: string;
  /** 直近のゴール */
  goal?: string;
}): Promise<IGAnalysisResult> {

  const sys = `あなたは「世界トップクラスのインフルエンサーマーケティングストラテジスト」。
日本市場の Instagram 文化・相場・PR 案件慣行に精通し、過去に 1,000 アカウント以上を分析してきた経験を持つ。
ユーザーの Instagram プロフィールを以下の手順で精緻に分析する。

## 分析プロセス (内省してから書く)
1. まずユーザーが提供した情報源 (画像・テキスト・数値) をすべて統合し、客観的な像を作る
2. 同じ業界の上位 5% アカウントとの差分を考える
3. 「3 ヶ月で次のステージに行くために何が一番重要か」を 1 つに絞り込む
4. それを 5 軸スコアとして数値化
5. 個別具体的な改善提案 (テンプレでなく、このアカウント独自の文脈で)

## 5 軸スコアリング (各 0-100)
- bio: バイオが「何屋か」「なぜ特別か」「次の行動」を明示できているか
- visualConsistency: 9 マスのビジュアル統一感、トーン、色、構図
- contentUniqueness: 量産系コンテンツとの差別化、本人の声・視点
- engagement: ER (フォロワー比) と保存・シェアの効率
- commercialFit: 案件への相性 (オーディエンスが商業転換可能か)

## 出力 — JSON のみ (説明文/コードブロック禁止)
{
  "totalScore": 0-100,
  "scores": {
    "bio":               { "value": 0-100, "reason": "...", "toLevelUp": "1 つだけ具体提案" },
    "visualConsistency": { "value": 0-100, "reason": "...", "toLevelUp": "..." },
    "contentUniqueness": { "value": 0-100, "reason": "...", "toLevelUp": "..." },
    "engagement":        { "value": 0-100, "reason": "...", "toLevelUp": "..." },
    "commercialFit":     { "value": 0-100, "reason": "...", "toLevelUp": "..." }
  },
  "oneLiner": "総評を 30-60 字で",
  "brandIdentity": "ブランド観 / ペルソナ (5-7 行)",
  "estimatedAudience": {
    "primary": "主要層",
    "secondary": "二次層",
    "estimatedSize": "推定月間リーチ"
  },
  "strengths": ["強み (具体的に)"],
  "weaknesses": ["弱み (具体的に)"],
  "competitors": [
    { "handle": "@example_account", "whyRefer": "なぜ参考になる", "learnFrom": "何を真似るべき" }
  ],
  "targetableBrands": ["コスメ", "ライフスタイル"],
  "estimatedFee": {
    "feedPost": { "min": 50000, "max": 100000 },
    "reel":     { "min": 80000, "max": 150000 },
    "story":    { "min": 10000, "max": 25000 },
    "note": "根拠 (フォロワー単価 X 円 + ER 補正)"
  },
  "next30Days": {
    "week1": { "theme": "...", "tasks": ["..."] },
    "week2": { "theme": "...", "tasks": ["..."] },
    "week3": { "theme": "...", "tasks": ["..."] },
    "week4": { "theme": "...", "tasks": ["..."] }
  },
  "quickPostIdeas": [
    { "title": "...", "hook": "...", "format": "Reel|Post|Story|Carousel", "expectedReachLevel": "high|medium|low" }
  ],
  "bioSuggestion": "改善版バイオ (絵文字込みで Instagram のバイオ枠 (150 字以内) に収まる)",
  "hashtagStrategy": {
    "mainSet": ["#tag1", "#tag2"],
    "nicheSet": ["#niche1"],
    "advice": "戦略コメント"
  },
  "postingSchedule": [
    { "day": "Tue", "time": "21:00", "reason": "オーディエンスが帰宅してフィードを見る時間" }
  ],
  "cautions": ["気をつけたいこと"]
}

## ルール
- 競合インフルエンサーは「@actual_handle」のように具体的に挙げる (実在するもの、もしくは実在しそうな架空でも構わない、ただし日本市場のインフルエンサー文化に合致するもの)
- 想定報酬は日本市場の 2025 年相場で:
  - フィード 1 本: フォロワー単価 1〜4 円 (ER 高で上振れ)
  - Reel: フィードの 1.2〜1.5 倍
  - Story: 本投稿の 10〜20%
- バイオ提案は実際にコピペできる形式で
- 30 日プランは「やる日」と「やる内容」が紐づくレベルの具体性で
- quickPostIdeas は本人がすぐ撮影できる、現場感のあるアイデア

${toneInstruction(opts.settings.aiTone)}`;

  const content: (ContentBlock | ImageBlock)[] = [];

  // 1. 画像をすべて image block で先に
  if (opts.images && opts.images.length > 0) {
    content.push({ type: 'text', text: `## 画像資料 (${opts.images.length} 枚)\n以下はユーザーの Instagram のスクリーンショット (プロフィール / フィード / インサイト等) です。順番に分析してください:` });
    for (const img of opts.images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.data },
      });
    }
  }

  // 2. テキスト情報
  const textParts: string[] = [];
  textParts.push(`## ハンドル\n@${opts.handle}`);
  if (opts.niche) textParts.push(`## ジャンル\n${opts.niche}`);
  if (opts.goal) textParts.push(`## ゴール (3 ヶ月)\n${opts.goal}`);
  if (opts.knownMetrics) {
    const m = opts.knownMetrics;
    const metrics: string[] = [];
    if (m.followers !== undefined) metrics.push(`フォロワー: ${m.followers.toLocaleString()}`);
    if (m.following !== undefined) metrics.push(`フォロー中: ${m.following.toLocaleString()}`);
    if (m.avgER !== undefined) metrics.push(`平均ER: ${m.avgER}%`);
    if (m.monthlyReach !== undefined) metrics.push(`月間リーチ: ${m.monthlyReach.toLocaleString()}`);
    if (m.avgLikes !== undefined) metrics.push(`平均いいね: ${m.avgLikes.toLocaleString()}`);
    if (m.avgComments !== undefined) metrics.push(`平均コメント: ${m.avgComments.toLocaleString()}`);
    if (metrics.length > 0) textParts.push(`## 既知の数値\n${metrics.join('\n')}`);
  }
  if (opts.pasted?.trim()) textParts.push(`## プロフィール文 / 投稿キャプション (本人がコピペ)\n${opts.pasted}`);
  if (opts.postSamples && opts.postSamples.length > 0) {
    const samples = opts.postSamples.map((s, i) => {
      const lines = [`### Post ${i + 1}`];
      if (s.url) lines.push(`URL: ${s.url}`);
      if (s.caption) lines.push(`キャプション: ${s.caption}`);
      if (s.metrics) lines.push(`数字: ${s.metrics}`);
      return lines.join('\n');
    }).join('\n\n');
    textParts.push(`## 投稿サンプル\n${samples}`);
  }
  if (opts.selfNote) textParts.push(`## 本人メモ\n${opts.selfNote}`);
  textParts.push(`\n上記すべてを統合して、JSON で詳細分析を返してください。`);

  content.push({ type: 'text', text: textParts.join('\n\n') });

  const data = await enqueueClaudeCall(async () => {
    const res = await aiFetch({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Vision 対応モデルを優先 (claude-sonnet-4-5 は vision 対応)
        model: opts.settings.preferredModel,
        max_tokens: 6000,
        system: sys,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `IG解析APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    // 必須プロパティのフォールバック
    return {
      totalScore: parsed.totalScore ?? 50,
      scores: {
        bio: parsed.scores?.bio ?? { value: 50, reason: '', toLevelUp: '' },
        visualConsistency: parsed.scores?.visualConsistency ?? { value: 50, reason: '', toLevelUp: '' },
        contentUniqueness: parsed.scores?.contentUniqueness ?? { value: 50, reason: '', toLevelUp: '' },
        engagement: parsed.scores?.engagement ?? { value: 50, reason: '', toLevelUp: '' },
        commercialFit: parsed.scores?.commercialFit ?? { value: 50, reason: '', toLevelUp: '' },
      },
      oneLiner: parsed.oneLiner ?? '',
      brandIdentity: parsed.brandIdentity ?? '',
      estimatedAudience: parsed.estimatedAudience ?? { primary: '', estimatedSize: '' },
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      competitors: parsed.competitors ?? [],
      targetableBrands: parsed.targetableBrands ?? [],
      estimatedFee: parsed.estimatedFee ?? {
        feedPost: { min: 0, max: 0 }, reel: { min: 0, max: 0 }, story: { min: 0, max: 0 }, note: ''
      },
      next30Days: parsed.next30Days ?? {
        week1: { theme: '', tasks: [] },
        week2: { theme: '', tasks: [] },
        week3: { theme: '', tasks: [] },
        week4: { theme: '', tasks: [] },
      },
      quickPostIdeas: parsed.quickPostIdeas ?? [],
      bioSuggestion: parsed.bioSuggestion ?? '',
      hashtagStrategy: parsed.hashtagStrategy ?? { mainSet: [], nicheSet: [], advice: '' },
      postingSchedule: parsed.postingSchedule ?? [],
      cautions: parsed.cautions ?? [],
    };
  } catch (e) {
    throw new Error('AI の応答が JSON として解析できませんでした。再実行してください。');
  }
}

/** 解析結果を MediaKit に取り込むヘルパー */
export function snapshotToMediaKit(handle: string, analysis: IGAnalysisResult, base?: MediaKit): MediaKit {
  return {
    personaId: base?.personaId || '',
    handleName: '@' + handle,
    audienceProfile: analysis.estimatedAudience.primary || base?.audienceProfile,
    brandValues: analysis.brandIdentity || base?.brandValues,
    rateCard: analysis.estimatedFee.feedPost.min > 0
      ? `フィード 1 本 ¥${analysis.estimatedFee.feedPost.min.toLocaleString()} 〜 ¥${analysis.estimatedFee.feedPost.max.toLocaleString()} / Reel ¥${analysis.estimatedFee.reel.min.toLocaleString()} 〜 ¥${analysis.estimatedFee.reel.max.toLocaleString()}`
      : base?.rateCard,
    followers: base?.followers,
    avgEngagementRate: base?.avgEngagementRate,
    monthlyReach: base?.monthlyReach,
    caseHistory: base?.caseHistory,
    entity: base?.entity,
    legalName: base?.legalName,
  };
}
