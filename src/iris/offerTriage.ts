// ============================================================
// IRIS — Offer Triage (案件精査 AI / 詐欺見抜き + 魅力度判定)
// 「毎日くる案件メールを丸投げ → 安全度・魅力度・推奨アクション」
// ============================================================
import type { AppSettings } from '../types/identity';
import type { MediaKit } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

export interface OfferTriageResult {
  /** 安全度 0-100 (高いほど安全、低いほど怪しい) */
  safetyScore: number;
  /** 魅力度 0-100 (高いほど受ける価値あり) */
  attractScore: number;
  /** 総合判断 */
  verdict: 'accept' | 'consider' | 'negotiate' | 'decline' | 'block';
  /** 一行サマリー */
  summary: string;
  /** 検出された警告 (詐欺・マルチ・違法・無償依頼など) */
  redFlags: { kind: string; description: string; severity: 'high' | 'medium' | 'low' }[];
  /** ポジティブ要素 */
  positives: string[];
  /** 推奨アクション (具体的に何をすべきか) */
  recommendedActions: string[];
  /** 推定報酬の妥当性 */
  feeAssessment?: {
    estimatedFair: { min: number; max: number };
    detected?: number;       // 文中に見つかった金額
    verdict: 'fair' | 'low' | 'high' | 'unknown';
    note: string;
  };
  /** 案件のメタ情報 (自動抽出) */
  extracted: {
    brandName?: string;
    agencyName?: string;
    productName?: string;
    contactName?: string;
    contactEmail?: string;
    deadline?: string;
    deliverables?: string;
    fee?: number;
  };
}

export async function triageOffer(opts: {
  settings: AppSettings;
  emailText: string;
  mediaKit?: MediaKit;
}): Promise<OfferTriageResult> {

  const sys = `あなたは「インフルエンサー専属のマネージャー兼弁護士」です。
受信した案件メールを精査して、安全度・魅力度・推奨アクションを判定します。

返答は JSON のみ:
{
  "safetyScore": 0-100,
  "attractScore": 0-100,
  "verdict": "accept" | "consider" | "negotiate" | "decline" | "block",
  "summary": "1行サマリー",
  "redFlags": [
    { "kind": "詐欺・マルチ・違法等のカテゴリ", "description": "具体的な懸念", "severity": "high"|"medium"|"low" }
  ],
  "positives": ["良い点1", "良い点2"],
  "recommendedActions": ["具体的なアクション1"],
  "feeAssessment": {
    "estimatedFair": { "min": 数字, "max": 数字 },
    "detected": 案件文中の金額 (見つかれば),
    "verdict": "fair"|"low"|"high"|"unknown",
    "note": "コメント"
  },
  "extracted": {
    "brandName": "...",
    "agencyName": "...",
    "productName": "...",
    "contactName": "...",
    "contactEmail": "...",
    "deadline": "...",
    "deliverables": "...",
    "fee": 数字
  }
}

## 詐欺・問題案件の検知ポイント
- 「無償・サンプル提供のみ」を「PR」と称する依頼 → safetyScore 落とす + redFlag
- 連絡先が個人 Gmail/Yahoo (法人ドメインなし)
- 振込先が個人口座 / 海外口座
- 急かす表現 (「今日中に」「24時間以内に」)
- 暗号資産 / FX / オンラインカジノ / ネットワークビジネス系の依頼
- 過度に高額な提示 (相場の 3 倍以上) は逆に詐欺の可能性
- 「契約書なし」「検収なし」「請求書を要求してこない」
- 質問するとはぐらかす表現
- 「審査の上、後日選考」など実質的な無償労働強要
- 出会い系・大人向けサービスの誘導 (場合により block)

## ベルディクトの目安
- safetyScore < 30 → "block" (関わらない)
- 30-60 → "decline" (やんわり辞退)
- 60-80 → "negotiate" (条件詰めれば検討) or "consider"
- 80+ かつ attractScore 70+ → "accept"

## 報酬の相場 (日本市場・参考)
- Instagram フィード1本: フォロワー単価 1〜4 円
- リール: フィードの 1.2〜1.5 倍
- TikTok: 0.5〜2 円/フォロワー
- ストーリー追加: 本投稿の 10〜20%

${toneInstruction(opts.settings.aiTone)}`;

  const kitContext = opts.mediaKit ? `
## 私のメディアキット
- フォロワー: ${JSON.stringify(opts.mediaKit.followers || {})}
- 平均ER: ${JSON.stringify(opts.mediaKit.avgEngagementRate || {})}
- オーディエンス: ${opts.mediaKit.audienceProfile || ''}
- ブランド観/NG: ${opts.mediaKit.brandValues || ''}
` : '';

  const userText = `${kitContext}

## 受信した案件メール
${opts.emailText}

このメールを精査して、JSON で判定結果を返してください。`;

  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      throw new Error(err.error?.message ?? `案件精査APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      safetyScore: typeof parsed.safetyScore === 'number' ? parsed.safetyScore : 50,
      attractScore: typeof parsed.attractScore === 'number' ? parsed.attractScore : 50,
      verdict: parsed.verdict ?? 'consider',
      summary: parsed.summary ?? '',
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      positives: Array.isArray(parsed.positives) ? parsed.positives : [],
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
      feeAssessment: parsed.feeAssessment,
      extracted: parsed.extracted || {},
    };
  } catch {
    return {
      safetyScore: 50, attractScore: 50, verdict: 'consider',
      summary: text.slice(0, 100),
      redFlags: [], positives: [], recommendedActions: [],
      extracted: {},
    };
  }
}
