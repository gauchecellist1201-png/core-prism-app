// ============================================================
// IRIS — Instagram プロフィール解析 (URL/ID 貼って戦略を作る)
// ※公式 Graph API は OAuth が必要。LP 段階では「貼り付けた情報を AI が読み解く」
//    + 公開ページの oEmbed/サイト側 fetch (CORS 制限あり) を試す。
// ============================================================
import type { AppSettings } from '../types/identity';
import type { MediaKit } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

/** URL → @handle 抽出 */
export function extractInstagramHandle(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  // @handle 形式
  if (t.startsWith('@')) return t.slice(1).split(/[\s/?]/)[0];
  // URL: https://instagram.com/handle/ or https://www.instagram.com/handle/
  const m = t.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  if (m) return m[1];
  // それ以外で英数字+.+_ のみ → handle として扱う
  if (/^[A-Za-z0-9._]+$/.test(t)) return t;
  return null;
}

export interface InstagramProfileSnapshot {
  handle: string;
  /** ユーザーが貼ったテキスト (プロフィール全文 / 投稿リスト / 数字メモ) */
  pasted?: string;
  /** 公開推定情報 */
  oembed?: {
    title?: string;
    authorName?: string;
    thumbnailUrl?: string;
  };
}

/** Instagram の公開 oEmbed (post URL から) — プロフィール URL は対応外 */
export async function fetchInstagramOembed(postUrl: string): Promise<{ title?: string; authorName?: string; thumbnailUrl?: string } | null> {
  try {
    const r = await fetch(`https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`);
    if (!r.ok) return null;
    const data = await r.json();
    return {
      title: data.title,
      authorName: data.author_name,
      thumbnailUrl: data.thumbnail_url,
    };
  } catch {
    return null;
  }
}

// ─── AI でプロフィール解析 + 戦略提案 ─────
export interface IGAnalysisResult {
  /** 強み 3-5 */
  strengths: string[];
  /** 弱み・改善点 3-5 */
  weaknesses: string[];
  /** ブランド観のサマリ */
  brandIdentity: string;
  /** 推定オーディエンス */
  estimatedAudience: string;
  /** ターゲットにできるブランド業界 */
  targetableBrands: string[];
  /** 想定報酬レンジ (フィード1本) */
  estimatedFee?: { min: number; max: number; note: string };
  /** 直近 30 日でやるべきアクション 3-5 */
  next30Days: string[];
  /** 注意点・気をつけたいこと */
  cautions: string[];
}

export async function analyzeInstagramProfile(opts: {
  settings: AppSettings;
  handle: string;
  pasted: string; // ユーザーがコピペしたプロフィール文字列・投稿一覧・数字
  selfNote?: string;
}): Promise<IGAnalysisResult> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const sys = `あなたは「インフルエンサーマーケティングのアナリスト」。
Instagram プロフィール (本人がコピペしたテキスト + ハンドル) を読んで、強み/弱み/ブランド観/推定オーディエンス/受けられる業界/想定報酬/30 日アクションを判定します。

返答は JSON のみ:
{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "brandIdentity": "ブランド観のサマリ (3-5 行)",
  "estimatedAudience": "推定オーディエンス層",
  "targetableBrands": ["コスメ", "ライフスタイル"],
  "estimatedFee": { "min": 50000, "max": 100000, "note": "根拠" },
  "next30Days": ["具体的アクション"],
  "cautions": ["気をつけたいこと"]
}

## 評価軸
- バイオの伝わりやすさ
- 投稿のテーマ統一感
- 投稿頻度 / 時間帯
- ハッシュタグ戦略
- フォロワー数とER (推定)
- 商業的の可能性

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## ハンドル
@${opts.handle}

## プロフィール / 投稿サンプル (本人がコピペ)
${opts.pasted}

${opts.selfNote ? `## 本人メモ\n${opts.selfNote}` : ''}

このアカウントを分析して、JSON で返してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.settings.preferredModel,
        max_tokens: 2500,
        system: sys,
        messages: [{ role: 'user', content: userText }],
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
    return JSON.parse(m ? m[0] : text);
  } catch {
    return {
      strengths: [], weaknesses: [], brandIdentity: text.slice(0, 200),
      estimatedAudience: '', targetableBrands: [],
      next30Days: [], cautions: [],
    };
  }
}

/** 解析結果を MediaKit に取り込むヘルパー */
export function snapshotToMediaKit(handle: string, analysis: IGAnalysisResult, base?: MediaKit): MediaKit {
  return {
    personaId: base?.personaId || '',
    handleName: '@' + handle,
    audienceProfile: analysis.estimatedAudience || base?.audienceProfile,
    brandValues: analysis.brandIdentity || base?.brandValues,
    rateCard: analysis.estimatedFee ? `フィード 1 本 ¥${analysis.estimatedFee.min.toLocaleString()} 〜 ¥${analysis.estimatedFee.max.toLocaleString()} (${analysis.estimatedFee.note})` : base?.rateCard,
    followers: base?.followers,
    avgEngagementRate: base?.avgEngagementRate,
    monthlyReach: base?.monthlyReach,
    caseHistory: base?.caseHistory,
    entity: base?.entity,
    legalName: base?.legalName,
  };
}
