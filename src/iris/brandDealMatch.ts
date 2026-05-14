// ============================================================
// CORE Iris — ブランド案件マッチ計算 + 応募メール生成 + 履歴管理
// ============================================================
import type { BrandDeal } from './brandDeals';
import type { MediaKit, Platform } from '../types/influencerDeal';
import type { AppSettings } from '../types/identity';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { toneInstruction } from '../lib/aiTone';

// ─── マッチスコア ───────────────────────────────────────────
export interface MatchScore {
  total: number;              // 0-100
  level: 'best' | 'good' | 'challenge' | 'low';
  label: string;
  color: string;
  reasons: string[];          // ポジティブ要因
  cautions: string[];         // 注意点 (例: フォロワー不足)
  applicable: boolean;        // 応募できるか (低スコアでも挑戦可能 / 完全 NG)
}

const LEVEL_META = {
  best:      { label: 'あなたに最適', color: '#10B981' },
  good:      { label: '良いマッチ',   color: '#F77737' },
  challenge: { label: '挑戦できる',   color: '#A78BFA' },
  low:       { label: '応募条件未満', color: '#9CA3AF' },
} as const;

export function computeMatchScore(deal: BrandDeal, mediaKit?: MediaKit): MatchScore {
  let total = 0;
  const reasons: string[] = [];
  const cautions: string[] = [];

  // 1) フォロワー数 (max 40 点)
  const followers = mediaKit?.followers?.[deal.platform] ?? 0;
  if (followers >= deal.minFollowers) {
    if (deal.maxFollowers && followers > deal.maxFollowers) {
      // 上限超え (ニッチ案件) — 40% 減点
      total += 24;
      cautions.push(`フォロワーが推奨 (${deal.maxFollowers.toLocaleString()}) より多めです`);
    } else {
      total += 40;
      reasons.push(`${deal.platform} ${followers.toLocaleString()} フォロワーで条件をクリア`);
    }
  } else {
    const ratio = followers / deal.minFollowers;
    total += Math.max(0, Math.round(ratio * 25));
    if (ratio < 0.5) {
      cautions.push(`必要フォロワー数 ${deal.minFollowers.toLocaleString()} に届いていません (現 ${followers.toLocaleString()})`);
    } else {
      cautions.push(`もう少しでフォロワー要件 ${deal.minFollowers.toLocaleString()} です`);
    }
  }

  // 2) プラットフォーム適合性 (max 20 点)
  const hasPlatform = mediaKit?.followers?.[deal.platform] !== undefined && (mediaKit?.followers?.[deal.platform] ?? 0) > 0;
  if (hasPlatform) {
    total += 20;
    reasons.push(`メインの ${deal.platform} で活動中`);
  } else if (mediaKit?.followers && Object.values(mediaKit.followers).some(v => v && v > 0)) {
    total += 8;
    cautions.push(`案件は ${deal.platform} 指定 (あなたは別 SNS が中心)`);
  }

  // 3) エンゲージメント率 (max 15 点)
  const er = mediaKit?.avgEngagementRate?.[deal.platform];
  if (er !== undefined) {
    if (er >= 5) { total += 15; reasons.push(`平均ER ${er}% は高水準`); }
    else if (er >= 3) { total += 12; reasons.push(`平均ER ${er}% は健全`); }
    else if (er >= 1.5) { total += 8; }
    else { total += 4; }
  }

  // 4) オーディエンス一致 (max 25 点) — audienceTags と audienceProfile / brandValues を簡易マッチ
  const audienceText = `${mediaKit?.audienceProfile ?? ''} ${mediaKit?.brandValues ?? ''} ${mediaKit?.caseHistory ?? ''}`.toLowerCase();
  if (audienceText.trim()) {
    const hits = deal.audienceTags.filter(tag => audienceText.includes(tag.toLowerCase()));
    if (hits.length >= 3)      { total += 25; reasons.push(`オーディエンスが ${hits.slice(0,3).join('・')} と一致`); }
    else if (hits.length === 2) { total += 18; reasons.push(`「${hits.join('・')}」のオーディエンスと相性◎`); }
    else if (hits.length === 1) { total += 12; reasons.push(`「${hits[0]}」と一部マッチ`); }
    else                        { total += 4; }
  } else {
    // メディアキット未設定の場合は中立スコア
    total += 10;
    cautions.push('メディアキットを書くと、もっと正確にマッチ判定できます');
  }

  total = Math.min(100, Math.max(0, total));

  let level: MatchScore['level'];
  if (total >= 80)      level = 'best';
  else if (total >= 60) level = 'good';
  else if (total >= 40) level = 'challenge';
  else                  level = 'low';

  return {
    total,
    level,
    label: LEVEL_META[level].label,
    color: LEVEL_META[level].color,
    reasons,
    cautions,
    applicable: level !== 'low',
  };
}

// ─── 応募メール生成 (AI) ──────────────────────────────────
export interface ApplicationDraft {
  subject: string;
  body: string;
  reason: string;     // なぜ自分が合うか (内部用メモ)
}

export async function generateApplicationDraft(opts: {
  settings: AppSettings;
  deal: BrandDeal;
  mediaKit?: MediaKit;
  customNote?: string;
}): Promise<ApplicationDraft> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY || opts.settings.claudeApiKey || '';

  const kit = opts.mediaKit;
  const kitText: string[] = [];
  if (kit?.handleName) kitText.push(`- 表示名: ${kit.handleName}`);
  if (kit?.followers) {
    const s = Object.entries(kit.followers).filter(([, v]) => v).map(([p, v]) => `${p}: ${v?.toLocaleString()}`).join(' / ');
    if (s) kitText.push(`- フォロワー: ${s}`);
  }
  if (kit?.avgEngagementRate) {
    const s = Object.entries(kit.avgEngagementRate).filter(([, v]) => v !== undefined).map(([p, v]) => `${p}: ${v}%`).join(' / ');
    if (s) kitText.push(`- 平均ER: ${s}`);
  }
  if (kit?.audienceProfile) kitText.push(`- オーディエンス: ${kit.audienceProfile}`);
  if (kit?.caseHistory) kitText.push(`- 過去案件: ${kit.caseHistory}`);

  const sys = `あなたは「インフルエンサー本人の代わりに、ブランド案件の募集に対して応募メールを書くエージェント」です。
返答は JSON のみ:
{
  "subject": "件名 (40 字程度)",
  "body": "本文 (宛名 → 自己紹介 → なぜ自分がこの案件に合うか → 提案できること → 締め)",
  "reason": "自分用メモ (なぜ合うか 3 行)"
}

## ルール
- 押し売りせず「ぜひ応募させてください」の応募スタンス
- 数字は誇張しない (メディアキットの数字をそのまま使う)
- ブランドの世界観への共感を 1-2 文で
- 「投稿できる形式」を具体的に (リール / フィードなど)
- 200〜400 字程度の読みやすい本文
- 末尾に「お返事お待ちしております」+ 名前

${toneInstruction(opts.settings.aiTone)}`;

  const userText = `## 募集案件
- ブランド: ${opts.deal.brandName}
- 商品: ${opts.deal.productName}
- 概要: ${opts.deal.summary}
- 詳しい説明: ${opts.deal.description}
- 報酬: ¥${opts.deal.fee.toLocaleString()}${opts.deal.feeNote ? ` (${opts.deal.feeNote})` : ''}
- 形式: ${opts.deal.platform} / ${opts.deal.contentType}
- 締切: ${opts.deal.deadline}
- 必須ハッシュタグ: ${opts.deal.requiredHashtags?.join(' ') ?? '(なし)'}
- ターゲット: ${opts.deal.audienceTags.join(' / ')}
${opts.deal.contactPerson ? `- 担当者: ${opts.deal.contactPerson}` : ''}

## 私のメディアキット
${kitText.length ? kitText.join('\n') : '(未設定)'}

## 追加で伝えたいこと
${opts.customNote || '(なし)'}

この案件に応募するメールを書いてください。`;

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
      throw new Error(err.error?.message ?? `応募メール生成エラー: ${res.status}`);
    }
    return res.json();
  });

  const text = data.content?.[0]?.text ?? '';
  try {
    const m = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    return {
      subject: parsed.subject || `${opts.deal.brandName} 様 — ${opts.deal.productName} 案件応募の件`,
      body: parsed.body || text,
      reason: parsed.reason || '',
    };
  } catch {
    return {
      subject: `${opts.deal.brandName} 様 — ${opts.deal.productName} 案件応募の件`,
      body: text,
      reason: '',
    };
  }
}

// ─── 応募履歴 (localStorage) ───────────────────────────────
const APPLY_HISTORY_KEY = 'iris_brand_apply_history_v1';

export interface ApplicationRecord {
  id: string;                 // uuid
  dealId: string;
  dealBrand: string;
  dealProduct: string;
  fee: number;
  platform: Platform;
  appliedAt: string;          // ISO
  channel: 'email' | 'form' | 'copy';
  status: 'sent' | 'replied' | 'declined' | 'won';
  draft?: ApplicationDraft;
  note?: string;
}

export function loadApplyHistory(): ApplicationRecord[] {
  try {
    const r = localStorage.getItem(APPLY_HISTORY_KEY);
    return r ? JSON.parse(r) : [];
  } catch { return []; }
}

export function saveApplyHistory(records: ApplicationRecord[]) {
  localStorage.setItem(APPLY_HISTORY_KEY, JSON.stringify(records));
}

export function addApplyRecord(rec: Omit<ApplicationRecord, 'id' | 'appliedAt'>): ApplicationRecord {
  const newRec: ApplicationRecord = {
    ...rec,
    id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `app-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    appliedAt: new Date().toISOString(),
  };
  const all = loadApplyHistory();
  all.unshift(newRec);
  saveApplyHistory(all);
  return newRec;
}

export function updateApplyStatus(id: string, status: ApplicationRecord['status']) {
  const all = loadApplyHistory();
  const idx = all.findIndex(r => r.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], status };
    saveApplyHistory(all);
  }
}

export interface ApplyKpi {
  total: number;
  pending: number;
  replied: number;
  won: number;
  totalFeeApplied: number;
  totalFeeWon: number;
  responseRate: number;       // 0-1
  winRate: number;            // 0-1
}

export function computeApplyKpi(): ApplyKpi {
  const all = loadApplyHistory();
  const total = all.length;
  const pending = all.filter(r => r.status === 'sent').length;
  const replied = all.filter(r => r.status === 'replied' || r.status === 'won' || r.status === 'declined').length;
  const won = all.filter(r => r.status === 'won').length;
  const totalFeeApplied = all.reduce((s, r) => s + (r.fee || 0), 0);
  const totalFeeWon = all.filter(r => r.status === 'won').reduce((s, r) => s + (r.fee || 0), 0);
  return {
    total, pending, replied, won, totalFeeApplied, totalFeeWon,
    responseRate: total > 0 ? replied / total : 0,
    winRate: total > 0 ? won / total : 0,
  };
}
