// ============================================================
// CORE Iris — AI 交渉文 (初回 DM 下書き) 生成ヘルパー
//
// 案件カテゴリカードから呼ばれて /api/iris/draft-dm を叩き、
// 失敗時は recovery テキスト付きでフォールバック下書きを返す。
// ============================================================
import type { IgProfile } from './instagramConnect';
import { logIrisActivity } from './irisActivity';

// ── トーンプリセット (4 種) ─────────────────────────────────
export type DmTone = 'polite' | 'friendly' | 'pro' | 'passionate';

export interface DmDealInput {
  brandName: string;
  category: string;
  fee?: number;
  requirements?: string;
  contactHandle?: string;
}

export interface DmMediaKitSummary {
  followers?: number | string;
  audience?: string;
  category?: string;
  engagement?: number | string;
}

export interface DmDraft {
  subject?: string;
  body: string;
  tone: DmTone;
  callToAction: string;
}

export interface DmReplyPrediction {
  label: string;
  example: string;
}

export interface DmDraftResult {
  ok: true;
  draft: DmDraft;
  alternatives: { body: string; tone: DmTone }[];
  warnings?: string[];
  /** NG ワード本文ヒット (赤バナー表示用) */
  ngHits?: string[];
  /** 返信パターン予測 (準備用、ブランド側がどう返してきそうか) */
  replyPredictions?: DmReplyPrediction[];
  source: 'ai' | 'fallback';
  /** 失敗時のリカバリ案内 (UI でやさしく表示するため) */
  recovery?: string;
}

export interface DmGenerateOptions {
  customNote?: string;
  tone?: DmTone;
  mediaKit?: DmMediaKitSummary;
  mentionMediaKit?: boolean;
  ngWords?: string[];
}

// ── トーンラベル (UI 表示用) ─────────────────────────────────
export const DM_TONE_META: Record<DmTone, { label: string; subtitle: string; emoji: string; color: string }> = {
  polite:     { label: '丁寧',           subtitle: '大人 / 敬語',       emoji: '🤝', color: '#3B82F6' },
  friendly:   { label: 'フレンドリー',   subtitle: '親近感 / 温かい',   emoji: '☺️', color: '#F77737' },
  pro:        { label: 'プロ',           subtitle: '簡潔 / 数字で実績', emoji: '💼', color: '#10B981' },
  passionate: { label: '熱量高め',       subtitle: '情熱 / コラボ愛',   emoji: '💛', color: '#E1306C' },
};

export const DM_TONES: DmTone[] = ['polite', 'friendly', 'pro', 'passionate'];

// ── NG ワード検出 (ローカル / API 結果と整合) ────────────────
export function detectNgWords(text: string, ngWords?: string[]): string[] {
  if (!text || !ngWords || ngWords.length === 0) return [];
  const hits: string[] = [];
  for (const w of ngWords) {
    const t = (w || '').trim();
    if (!t) continue;
    if (text.includes(t) && !hits.includes(t)) hits.push(t);
  }
  return hits;
}

// ── 履歴保存 (localStorage、最大 5 件) ──────────────────────
export interface DmDraftHistoryEntry {
  id: string;
  ts: number;
  brandName: string;
  category: string;
  tone: DmTone;
  body: string;
  source: 'ai' | 'fallback';
}

const HISTORY_KEY = 'core_iris_dm_history_v1';
const HISTORY_MAX = 5;

export function loadDmHistory(): DmDraftHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.slice(0, HISTORY_MAX);
  } catch { /* */ }
  return [];
}

export function pushDmHistory(entry: Omit<DmDraftHistoryEntry, 'id' | 'ts'>): DmDraftHistoryEntry[] {
  const all = loadDmHistory();
  const next: DmDraftHistoryEntry = {
    ...entry,
    id: 'dm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
  };
  const list = [next, ...all].slice(0, HISTORY_MAX);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* */ }
  logIrisActivity('dm'); // 営業DM下書きが実生成・保存できた時のみ記録 (honest)
  return list;
}

export function clearDmHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* */ }
}

// ── ローカルフォールバック (ネットワーク全断時にも返す) ──
function localFallback(profile: IgProfile, deal: DmDealInput, opts?: DmGenerateOptions): DmDraftResult {
  const handle = profile.handle || 'creator';
  const followers = profile.followers ? profile.followers.toLocaleString() : '?';
  const cat = deal.category || '案件';
  const customLine = opts?.customNote?.trim() ? `\n\n${opts.customNote.trim()}` : '';
  const tone: DmTone = opts?.tone || 'polite';

  const kitInline = (() => {
    if (!opts?.mentionMediaKit || !opts.mediaKit) return '';
    const k = opts.mediaKit;
    const bits: string[] = [];
    if (k.followers) bits.push(`フォロワー${k.followers}`);
    if (k.audience) bits.push(`主要層${k.audience}`);
    if (k.category) bits.push(`${k.category}発信`);
    if (k.engagement) bits.push(`平均ER${k.engagement}${typeof k.engagement === 'number' ? '%' : ''}`);
    if (bits.length === 0) return '';
    return `\n私の特徴は ${bits.join(' / ')} です。`;
  })();

  const bodies: Record<DmTone, string> = {
    polite:
`${deal.brandName} ご担当者様

はじめまして。Instagram で @${handle} として活動しております。
フォロワーは ${followers} 名で、${cat}に関心のあるフォロワーが中心です。${kitInline}

${deal.brandName} さんの世界観が好きで、いつも投稿を拝見しております。
もし PR や商品レビューなどでご一緒できる機会がございましたら、ぜひ詳しくお伺いできますと幸いです。${customLine}

ご返信お待ちしております。
@${handle}`,
    friendly:
`${deal.brandName} さん

こんにちは!Instagram でクリエイター活動をしている @${handle} です ☺️
いつも素敵な投稿を楽しみにしています。${kitInline}

私のアカウントは ${cat}に関心のあるフォロワーが ${followers} 名います。
タイアップや PR の機会がございましたら、ぜひ一度お話を聞かせてください。${customLine}

お時間ある時にお返事いただけたら嬉しいです。
@${handle}`,
    pro:
`${deal.brandName} ご担当者様

@${handle} です。フォロワー ${followers} 名、${cat}領域で活動しています。${kitInline}

${deal.brandName} さんのブランドコンセプトに親和性を感じております。
タイアップ案件のご相談が可能でしたら、条件・進行スケジュールについて伺えますと幸いです。${customLine}

ご検討よろしくお願いいたします。
@${handle}`,
    passionate:
`${deal.brandName} さん

突然のご連絡失礼します!@${handle} で発信している ${handle} です ✨
${deal.brandName} さんのことが本当に大好きで、いつもチェックさせていただいてます💛${kitInline}

フォロワーは ${followers} 名規模、${cat}カテゴリです。
もしご一緒できる機会があるなら、心を込めて発信したいです🤝${customLine}

ぜひ一度お話だけでも伺えませんか?
@${handle}`,
  };

  const main = bodies[tone];
  const others = DM_TONES.filter(t => t !== tone).slice(0, 2);
  const alternatives = others.map(t => ({ body: bodies[t], tone: t }));

  const warnings: string[] = [];
  if (!deal.fee) warnings.push('報酬条件が未確定です。最初の返信で具体的な条件・進め方を必ず確認してください。');
  warnings.push('送信前に必ず本文を自分の言葉で見直してください。');

  const ngHits = detectNgWords(main, opts?.ngWords);

  const replyPredictions: DmReplyPrediction[] = [
    {
      label: '前向きに条件確認',
      example: `ご連絡ありがとうございます。${deal.brandName}でございます。タイアップのご提案について、MediaKit を拝見させてください。`,
    },
    {
      label: '丁寧にお断り',
      example: '現在、新規のタイアップは募集を停止しております。ご提案いただきありがとうございました。',
    },
    {
      label: '具体的な条件提示',
      example: `${deal.brandName}です。ご興味ありがとうございます。フィード1本+ストーリーズ2本のセット案件で、報酬は${deal.fee ? '¥' + deal.fee.toLocaleString() : 'ご相談'}を想定しています。`,
    },
  ];

  return {
    ok: true,
    draft: { body: main, tone, callToAction: '案件の進め方・条件についてお伺いできますか?' },
    alternatives,
    warnings,
    ngHits: ngHits.length > 0 ? ngHits : undefined,
    replyPredictions,
    source: 'fallback',
    recovery: 'AI 通信ができなかったため、テンプレ下書きを表示しています。電波の良いところでもう一度試すと、より自分らしい文に再生成できます。',
  };
}

// ── メイン関数 ───────────────────────────────────────────────
export async function generateDmDraft(
  profile: IgProfile,
  deal: DmDealInput,
  optsOrCustomNote?: DmGenerateOptions | string,
): Promise<DmDraftResult> {
  // 後方互換: 第3引数に string が来たら customNote 単独として扱う
  const opts: DmGenerateOptions = typeof optsOrCustomNote === 'string'
    ? { customNote: optsOrCustomNote }
    : (optsOrCustomNote || {});

  try {
    const res = await fetch('/api/iris/draft-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        igProfile: profile,
        deal,
        customNote: opts.customNote,
        tone: opts.tone,
        mediaKit: opts.mediaKit,
        mentionMediaKit: opts.mentionMediaKit,
        ngWords: opts.ngWords,
      }),
    });
    if (!res.ok) {
      const fb = localFallback(profile, deal, opts);
      const err = await res.json().catch(() => ({}));
      return {
        ...fb,
        recovery: err?.message
          ? `${err.message}。とりあえずテンプレ下書きを表示しています。`
          : fb.recovery,
      };
    }
    const data = await res.json() as {
      ok: true;
      draft: DmDraft;
      alternatives?: { body: string; tone: DmTone }[];
      warnings?: string[];
      ngHits?: string[];
      replyPredictions?: DmReplyPrediction[];
      _meta?: { source: 'ai' | 'fallback' };
    };
    if (!data.draft || !data.draft.body) {
      return localFallback(profile, deal, opts);
    }
    // クライアント側でも NG ヒット再確認 (サーバー結果と OR を取る)
    const localHits = detectNgWords(data.draft.body, opts.ngWords);
    const mergedHits = Array.from(new Set([...(data.ngHits || []), ...localHits]));
    return {
      ok: true,
      draft: data.draft,
      alternatives: data.alternatives || [],
      warnings: data.warnings,
      ngHits: mergedHits.length > 0 ? mergedHits : undefined,
      replyPredictions: data.replyPredictions,
      source: data._meta?.source || 'ai',
    };
  } catch {
    return localFallback(profile, deal, opts);
  }
}

// ── Instagram DM を開く (アプリ起動 → Web フォールバック) ──
export function openInstagramDm(contactHandle?: string): { method: 'app' | 'web'; url: string } {
  if (contactHandle) {
    const clean = contactHandle.replace(/^@/, '');
    const appUrl = `instagram://user?username=${encodeURIComponent(clean)}`;
    const webUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/`;
    const fallbackTimer = setTimeout(() => { window.open(webUrl, '_blank'); }, 1500);
    const onHide = () => { clearTimeout(fallbackTimer); document.removeEventListener('visibilitychange', onHide); };
    document.addEventListener('visibilitychange', onHide);
    try { window.location.href = appUrl; } catch { window.open(webUrl, '_blank'); }
    return { method: 'app', url: appUrl };
  }
  const webUrl = 'https://www.instagram.com/direct/inbox/';
  const appUrl = 'instagram://direct/inbox';
  const fallbackTimer = setTimeout(() => { window.open(webUrl, '_blank'); }, 1500);
  const onHide = () => { clearTimeout(fallbackTimer); document.removeEventListener('visibilitychange', onHide); };
  document.addEventListener('visibilitychange', onHide);
  try { window.location.href = appUrl; } catch { window.open(webUrl, '_blank'); }
  return { method: 'app', url: appUrl };
}

// ── クリップボードコピー ────────────────────────────────────
export async function copyDmToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
