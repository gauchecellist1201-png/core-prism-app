// ============================================================
// api/_lib/coreFunnel — サーバー側（Stripe webhook）から全社ファネルへ積む
//
// ブラウザからの計測は /api/track/roai が受けている。そこには purchase / renewal が
// 一度も入っていなかった（決済の確定はブラウザではなく Stripe が知っているため）ので、
// 「料金を見た → 決済へ出た」までしか繋がらず、最後の一段が空だった。
//
// ここは webhook から呼ばれ、core:funnel:<date> の
//   billing:purchase / all:purchase（＋商品ごとの内訳 billing:purchase:<brand>）
// を増やす。金額は入れない（このハッシュは「件数」だけを持つ。実額は Stripe が正本）。
//
// 二重計上について: Stripe は同じイベントを再送する。webhook 側のメモリ idempotency は
// インスタンス単位なので、ここでは Upstash に event.id の印を 7 日置き、
// 先に印が付いていたら積まない（インスタンスをまたいで一度だけ）。
// ============================================================
import { coreFunnelCommands, sanitizeLabel } from '../track/_taxonomy';

const UP_URL = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_URL) || '';
const UP_TOK = (typeof process !== 'undefined' && process.env?.UPSTASH_REDIS_REST_TOKEN) || '';
const DEDUPE_TTL_SEC = 7 * 86400;

export type BillingEvent = 'purchase' | 'renewal' | 'upgrade';
export interface FunnelHit {
  event: BillingEvent;
  /** 商品の内訳ラベル。分からなければ空文字（分からないものを埋めない）。 */
  label: string;
}

/** 決済側の brand 表記を、内訳ラベルの表記へ寄せる。 */
const BRAND_ALIAS: Record<string, string> = {
  nexus: 'neri',   // 商標の都合で NEXUS → NERI に改名（env / metadata は nexus のまま）
  neri: 'neri',
  iris: 'iris',
  prism: 'prism',
  film: 'studio_film',
  studio: 'studio_film',
};

export function brandLabel(raw: unknown): string {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return '';
  return sanitizeLabel(BRAND_ALIAS[key] ?? key);
}

/** Stripe の invoice から読む最小限（型は必要な分だけ） */
export interface InvoiceLike {
  billing_reason?: string;
  amount_paid?: number;
  metadata?: Record<string, string> | null;
  subscription_details?: { metadata?: Record<string, string> | null } | null;
  lines?: { data?: Array<{ price?: { metadata?: Record<string, string> | null } | null }> } | null;
}

/**
 * 請求の成功 → 全社ファネルの1件。
 * ・¥0 の請求（無料お試しの開始など）は「買われた」ではないので積まない
 * ・subscription_cycle だけが renewal。初回は purchase、途中のプラン変更は upgrade
 * ・知らない billing_reason は積まない（無理に寄せると母数が嘘になる）
 */
export function funnelFromInvoice(inv: InvoiceLike | null | undefined): FunnelHit | null {
  if (!inv) return null;
  if (!(Number(inv.amount_paid) > 0)) return null;
  const reason = String(inv.billing_reason || '');
  const event: BillingEvent | null =
    reason === 'subscription_create' || reason === 'manual' ? 'purchase'
    : reason === 'subscription_cycle' ? 'renewal'
    : reason === 'subscription_update' ? 'upgrade'
    : null;
  if (!event) return null;
  const brand =
    inv.metadata?.brand
    ?? inv.subscription_details?.metadata?.brand
    ?? inv.lines?.data?.[0]?.price?.metadata?.brand
    ?? '';
  return { event, label: brandLabel(brand) };
}

export interface CheckoutSessionLike {
  mode?: string;
  payment_status?: string;
  amount_total?: number;
  metadata?: Record<string, string> | null;
}

/**
 * 単発決済（CORE Studio の映像など）の完了 → purchase。
 * サブスクの初回はここでも completed が飛ぶが、invoice 側で数えるので積まない（二重計上を避ける）。
 */
export function funnelFromCheckoutSession(sess: CheckoutSessionLike | null | undefined): FunnelHit | null {
  if (!sess) return null;
  if (sess.mode !== 'payment') return null;
  if (sess.payment_status !== 'paid') return null;
  if (!(Number(sess.amount_total) > 0)) return null;
  return { event: 'purchase', label: brandLabel(sess.metadata?.brand) };
}

async function upPipeline(cmds: (string | number)[][]): Promise<void> {
  const res = await fetch(`${UP_URL.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
}

/** dedupeKey の印を立てる。すでに立っていれば false（＝もう積んである）。 */
async function claim(dedupeKey: string): Promise<boolean> {
  const res = await fetch(`${UP_URL.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${UP_TOK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([['SET', `core:funnel:evt:${dedupeKey}`, '1', 'NX', 'EX', DEDUPE_TTL_SEC]]),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const arr = (await res.json()) as Array<{ result?: unknown }>;
  return arr?.[0]?.result != null; // NX で既存なら null が返る
}

export interface RecordResult {
  recorded: boolean;
  reason?: 'not_configured' | 'duplicate' | 'error';
  error?: string;
}

/**
 * 全社ファネルへ1件積む。呼び出し側の処理は止めない（計測で決済処理を落とさない）。
 * dedupeKey には Stripe の event.id を渡すこと。
 */
export async function recordBillingFunnel(hit: FunnelHit, dedupeKey: string): Promise<RecordResult> {
  if (!UP_URL || !UP_TOK) {
    console.log(`[core-funnel] (not configured) billing ${hit.event}${hit.label ? `:${hit.label}` : ''}`);
    return { recorded: false, reason: 'not_configured' };
  }
  try {
    if (dedupeKey && !(await claim(dedupeKey))) {
      return { recorded: false, reason: 'duplicate' };
    }
    const cmds = coreFunnelCommands('billing', hit.event, hit.label);
    if (cmds.length === 0) return { recorded: false, reason: 'error', error: 'unmapped_event' };
    await upPipeline(cmds);
    return { recorded: true };
  } catch (e) {
    console.error('[core-funnel] billing write failed', (e as Error).message);
    return { recorded: false, reason: 'error', error: (e as Error).message };
  }
}
