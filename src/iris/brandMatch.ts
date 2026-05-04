// ============================================================
// CORE Iris ↔ CORE Prism — ブランドマッチ
// Prism 側で集めた企業リスト (core_sales_companies_v1) を Iris から読んで、
// 相互発注 (タイアップ打診) ができるようにする。
// ============================================================
import type { CompanyResearch } from '../types/salesAgent';
import type { AppSettings } from '../types/identity';
import type { MediaKit, Platform, ContentType } from '../types/influencerDeal';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';
import { PLATFORM_META } from '../types/influencerDeal';

const PRISM_COMPANIES_KEY = 'core_sales_companies_v1';

export function loadPrismCompanies(): CompanyResearch[] {
  try {
    const r = localStorage.getItem(PRISM_COMPANIES_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

function getApiKey(s: AppSettings): string {
  return import.meta.env.VITE_CLAUDE_API_KEY || s.claudeApiKey || '';
}

/** 企業 → インフルエンサーから「タイアップ打診」初回メールを生成 */
export async function generateTieupPitch(opts: {
  settings: AppSettings;
  company: CompanyResearch;
  mediaKit?: MediaKit;
  platform: Platform;
  contentType: ContentType;
  proposedFee?: number;
  customNote?: string;
}): Promise<{ subject: string; body: string; matchReason: string }> {
  const apiKey = getApiKey(opts.settings);
  if (!apiKey) throw new Error('Claude APIキーが設定されていません');

  const sys = `あなたは「インフルエンサーの代わりにブランドへタイアップを打診するエージェント」です。
返答は JSON のみ:
{
  "subject": "件名",
  "body": "本文 (宛名・自己紹介・提案・締め)",
  "matchReason": "なぜこのインフルエンサーがこのブランドに合うか (社内向けメモ、3-5行)"
}

## ルール
- まず相手 (ブランド) の事業を深掘りして関心を示す
- 次に「私のオーディエンスがあなたの顧客とどう重なるか」を具体的に語る
- 提案フォーマット: プラットフォーム / コンテンツ形式 / 想定リーチ / 想定 ER / 報酬目安
- 押し売りにならない。「もしご興味あれば」のスタンス
- 1 通で完結。長すぎない。
- 数字は誇張しない。

${toneInstruction(opts.settings.aiTone)}`;

  const kitLines: string[] = [];
  if (opts.mediaKit?.handleName) kitLines.push(`- 表示名: ${opts.mediaKit.handleName}`);
  if (opts.mediaKit?.followers) {
    const s = Object.entries(opts.mediaKit.followers).filter(([, v]) => v).map(([p, v]) => `${PLATFORM_META[p as Platform].label} ${v?.toLocaleString()}`).join(' / ');
    if (s) kitLines.push(`- フォロワー: ${s}`);
  }
  if (opts.mediaKit?.avgEngagementRate) {
    const s = Object.entries(opts.mediaKit.avgEngagementRate).filter(([, v]) => v !== undefined).map(([p, v]) => `${PLATFORM_META[p as Platform].label} ${v}%`).join(' / ');
    if (s) kitLines.push(`- 平均ER: ${s}`);
  }
  if (opts.mediaKit?.audienceProfile) kitLines.push(`- オーディエンス: ${opts.mediaKit.audienceProfile}`);
  if (opts.mediaKit?.caseHistory) kitLines.push(`- 過去案件: ${opts.mediaKit.caseHistory}`);

  const userText = `## ブランド情報 (Prism リサーチ)
- 会社名: ${opts.company.companyName}
- 業界: ${opts.company.industry || '不明'}
- 概要: ${opts.company.overview || '(なし)'}
- 推定課題: ${opts.company.predictedChallenges?.join(' / ') || '(なし)'}
- 売り込み角度: ${opts.company.pitchAngle || '(なし)'}

## 私のメディアキット
${kitLines.length ? kitLines.join('\n') : '(未設定)'}

## 提案する形式
- プラットフォーム: ${PLATFORM_META[opts.platform].label}
- コンテンツ: ${opts.contentType}
${opts.proposedFee ? `- 想定報酬: ¥${opts.proposedFee.toLocaleString()}` : ''}

## 追加指示
${opts.customNote || '(なし)'}

このブランドに、上記のフォーマットでタイアップを打診するメールを書いてください。`;

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
        max_tokens: 2200,
        system: sys,
        messages: [{ role: 'user', content: userText }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `タイアップ打診APIエラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      subject: parsed.subject || '',
      body: parsed.body || '',
      matchReason: parsed.matchReason || '',
    };
  } catch {
    return { subject: '', body: text, matchReason: '' };
  }
}
