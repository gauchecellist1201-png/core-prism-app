// ============================================================
// CORE Iris — AI 交渉文 (初回 DM 下書き) 生成ヘルパー
//
// 案件カテゴリカードから呼ばれて /api/iris/draft-dm を叩き、
// 失敗時は recovery テキスト付きでフォールバック下書きを返す。
// ============================================================
import type { IgProfile } from './instagramConnect';

export type DmTone = 'professional' | 'casual' | 'friendly';

export interface DmDealInput {
  brandName: string;
  category: string;
  fee?: number;
  requirements?: string;
  contactHandle?: string;
}

export interface DmDraft {
  subject?: string;
  body: string;
  tone: DmTone;
  callToAction: string;
}

export interface DmDraftResult {
  ok: true;
  draft: DmDraft;
  alternatives: { body: string; tone: DmTone }[];
  warnings?: string[];
  source: 'ai' | 'fallback';
  /** 失敗時のリカバリ案内 (UI でやさしく表示するため) */
  recovery?: string;
}

// ── トーンラベル (UI 表示用) ─────────────────────────────────
export const DM_TONE_META: Record<DmTone, { label: string; emoji: string; color: string }> = {
  professional: { label: 'きちんと', emoji: '🤝', color: '#3B82F6' },
  casual:       { label: '自然体',   emoji: '✨', color: '#A78BFA' },
  friendly:     { label: '親しみ',   emoji: '☺️', color: '#F77737' },
};

// ── ローカルフォールバック (ネットワーク全断時にも返す) ──
function localFallback(profile: IgProfile, deal: DmDealInput, customNote?: string): DmDraftResult {
  const handle = profile.handle || 'creator';
  const followers = profile.followers ? profile.followers.toLocaleString() : '?';
  const cat = deal.category || '案件';
  const customLine = customNote?.trim() ? `\n\n${customNote.trim()}` : '';

  const body =
`${deal.brandName} ご担当者様

はじめまして。Instagram で @${handle} として活動しております。
フォロワーは ${followers} 名で、${cat}に関心のあるフォロワーが中心です。

${deal.brandName} さんの世界観が好きで、いつも投稿を拝見しております。
もし PR や商品レビューなどでご一緒できる機会がございましたら、ぜひ詳しくお伺いできますと幸いです。${customLine}

ご返信お待ちしております。
@${handle}`;

  const altCasual =
`${deal.brandName} さん

突然のご連絡失礼します。@${handle} で発信している ${handle} です ✨
フォロワー ${followers} 名、${cat}カテゴリのフォロワーが中心です。

${deal.brandName} さんの商品が本当に好きで、ご一緒できたらと思いずっとフォローしていました。
もし PR や商品レビューの機会がありましたら、ぜひお話を伺いたいです。

よろしくお願いします!
@${handle}`;

  const altFriendly =
`${deal.brandName} 様

こんにちは!Instagram でクリエイター活動をしている @${handle} です ☺️
いつも素敵な投稿を楽しみにしています。

私のアカウントは ${cat}に関心のあるフォロワーが ${followers} 名います。
タイアップや PR の機会がございましたら、ぜひ一度お話を聞かせてください。

お時間ある時にお返事いただけたら嬉しいです。
@${handle}`;

  const warnings: string[] = [];
  if (!deal.fee) warnings.push('報酬条件が未確定です。最初の返信で具体的な条件・進め方を必ず確認してください。');
  warnings.push('送信前に必ず本文を自分の言葉で見直してください。');

  return {
    ok: true,
    draft: { body, tone: 'professional', callToAction: '案件の進め方・条件についてお伺いできますか?' },
    alternatives: [
      { body: altCasual, tone: 'casual' },
      { body: altFriendly, tone: 'friendly' },
    ],
    warnings,
    source: 'fallback',
    recovery: 'AI 通信ができなかったため、テンプレ下書きを表示しています。電波の良いところでもう一度試すと、より自分らしい文に再生成できます。',
  };
}

// ── メイン関数 ───────────────────────────────────────────────
export async function generateDmDraft(
  profile: IgProfile,
  deal: DmDealInput,
  customNote?: string,
): Promise<DmDraftResult> {
  try {
    const res = await fetch('/api/iris/draft-dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ igProfile: profile, deal, customNote }),
    });
    if (!res.ok) {
      // 400/500 系 — ローカルフォールバック
      const fb = localFallback(profile, deal, customNote);
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
      _meta?: { source: 'ai' | 'fallback' };
    };
    if (!data.draft || !data.draft.body) {
      // サーバー応答が壊れている — ローカルフォールバック
      return localFallback(profile, deal, customNote);
    }
    return {
      ok: true,
      draft: data.draft,
      alternatives: data.alternatives || [],
      warnings: data.warnings,
      source: data._meta?.source || 'ai',
    };
  } catch {
    // ネットワーク完全断 — ローカルフォールバック
    return localFallback(profile, deal, customNote);
  }
}

// ── Instagram DM を開く (アプリ起動 → Web フォールバック) ──
export function openInstagramDm(contactHandle?: string): { method: 'app' | 'web'; url: string } {
  // instagram://user?username=xxx は iOS でプロフィールを開ける
  // DM 専用スキームは公開されていないため、プロフィール経由で DM ボタンを押してもらう
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
  // ハンドル不明 → Instagram トップ
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
