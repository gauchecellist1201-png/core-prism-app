// ============================================================
// /api/stripe/webhook — Stripe Webhook 受信 (堅牢版)
// ・署名検証 → 失敗時に構造化 JSON ログ
// ・event.id でメモリ idempotency (24h)
// ・customer.subscription.updated / invoice.payment_failed / customer.subscription.deleted
//   をハンドリングし、後段 /api/stripe/sync が読み取れる状態キャッシュへ反映
// ・Stripe 側のリトライに任せるため、success=200 / processing-error=500 を返す
// ============================================================

export const config = { runtime: 'edge' };

// ─── 構造化ログ (1 行 JSON、Vercel ログから grep しやすく) ─────
type LogLevel = 'info' | 'warn' | 'error';
function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  const line = {
    ts: new Date().toISOString(),
    svc: 'stripe-webhook',
    level,
    event,
    ...fields,
  };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

// ─── Idempotency: 処理済み event.id を 24h メモリ保持 ─────
// edge instance 単位なので完全ではないが、同一インスタンスへの重複配送は防げる
// 完全な排他は Stripe 側の "exactly-once" には期待せず、下流 API も冪等に設計する
const TTL_MS = 24 * 60 * 60 * 1000;
const processedEvents = new Map<string, number>();
function markProcessed(eventId: string): boolean {
  const now = Date.now();
  // 期限切れの掃除
  for (const [id, ts] of processedEvents) {
    if (now - ts > TTL_MS) processedEvents.delete(id);
  }
  if (processedEvents.has(eventId)) return false;
  processedEvents.set(eventId, now);
  return true;
}

// ─── サブスク状態キャッシュ (sync API が参照) ─────
// key = subscription_id、value = { status, plan, brand, current_period_end, updated_at }
export interface SubState {
  status: string;
  plan: string | null;
  brand: string | null;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
  customer: string | null;
  updated_at: number;
  /** 課金停止系イベントを最後に受け取った時刻 (frontend が即時 free 降格判定に使う) */
  delinquent_at?: number;
}
const subStates = new Map<string, SubState>();

// 外部 (sync.ts) から読むためのアクセサ
export function readSubState(subscriptionId: string): SubState | null {
  const s = subStates.get(subscriptionId);
  if (!s) return null;
  // 1 週間以上古ければ捨てる
  if (Date.now() - s.updated_at > 7 * 24 * 60 * 60 * 1000) {
    subStates.delete(subscriptionId);
    return null;
  }
  return s;
}

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  const parts = sigHeader.split(',');
  const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
  const v1 = parts.find(p => p.startsWith('v1='))?.slice(3);
  if (!timestamp || !v1) return false;

  const ts = parseInt(timestamp, 10);
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // タイミング攻撃に強い比較
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

// ─── Stripe イベント型 (必要な部分のみ) ─────
interface StripeSubscription {
  id: string;
  status: string;
  customer?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  metadata?: { plan?: string; brand?: string };
  items?: { data?: Array<{ price?: { id?: string; metadata?: { plan?: string; brand?: string } } }> };
}
interface StripeInvoice {
  id: string;
  subscription?: string;
  customer?: string;
  attempt_count?: number;
  next_payment_attempt?: number | null;
}
interface StripeEvent {
  id?: string;
  type?: string;
  created?: number;
  data?: { object?: any };
}

function extractPlanBrand(sub: StripeSubscription): { plan: string | null; brand: string | null } {
  // 1. subscription.metadata
  if (sub.metadata?.plan && sub.metadata?.brand) {
    return { plan: sub.metadata.plan, brand: sub.metadata.brand };
  }
  // 2. price.metadata
  const priceMeta = sub.items?.data?.[0]?.price?.metadata;
  if (priceMeta?.plan && priceMeta?.brand) {
    return { plan: priceMeta.plan, brand: priceMeta.brand };
  }
  return { plan: sub.metadata?.plan ?? null, brand: sub.metadata?.brand ?? null };
}

function upsertSubState(sub: StripeSubscription, delinquent: boolean) {
  const { plan, brand } = extractPlanBrand(sub);
  const prev = subStates.get(sub.id);
  const next: SubState = {
    status: sub.status,
    plan,
    brand,
    current_period_end: sub.current_period_end ?? prev?.current_period_end ?? null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    customer: sub.customer ?? prev?.customer ?? null,
    updated_at: Date.now(),
    delinquent_at: delinquent ? Date.now() : prev?.delinquent_at,
  };
  subStates.set(sub.id, next);
  return next;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    log('warn', 'env_missing', { field: 'STRIPE_WEBHOOK_SECRET' });
    // env 未設定でも 200 (本番前テスト用)
    return new Response(JSON.stringify({ received: true, warning: 'STRIPE_WEBHOOK_SECRET not set' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sigHeader = req.headers.get('stripe-signature') || '';
  const rawBody = await req.text();

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) {
    log('error', 'signature_invalid', {
      sig_present: !!sigHeader,
      body_bytes: rawBody.length,
      ip: req.headers.get('x-forwarded-for') || null,
    });
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody);
  } catch (e: any) {
    log('error', 'parse_error', { msg: e?.message });
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const eventId = event.id || '';
  const type = event.type || 'unknown';

  if (!eventId) {
    log('warn', 'event_no_id', { type });
  } else if (!markProcessed(eventId)) {
    log('info', 'duplicate_skipped', { event_id: eventId, type });
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ─── ハンドリング本体 ─────
  try {
    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data?.object as StripeSubscription;
        if (sub?.id) {
          const delinquent = sub.status === 'past_due' || sub.status === 'unpaid';
          const st = upsertSubState(sub, delinquent);
          log('info', 'sub_upserted', {
            event_id: eventId, type,
            sub_id: sub.id, status: st.status, plan: st.plan, brand: st.brand,
            cpe: st.current_period_end, cancel_at_period_end: st.cancel_at_period_end,
          });
        } else {
          log('warn', 'sub_missing_id', { event_id: eventId, type });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data?.object as StripeSubscription;
        if (sub?.id) {
          const st = upsertSubState({ ...sub, status: 'canceled' }, true);
          log('info', 'sub_canceled', {
            event_id: eventId, sub_id: sub.id, customer: st.customer, cpe: st.current_period_end,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const inv = event.data?.object as StripeInvoice;
        const subId = inv?.subscription;
        if (subId) {
          // 既存 state があれば delinquent_at を打って past_due 扱いに
          const prev = subStates.get(subId);
          const next: SubState = {
            status: 'past_due',
            plan: prev?.plan ?? null,
            brand: prev?.brand ?? null,
            current_period_end: prev?.current_period_end ?? null,
            cancel_at_period_end: prev?.cancel_at_period_end ?? false,
            customer: inv.customer ?? prev?.customer ?? null,
            updated_at: Date.now(),
            delinquent_at: Date.now(),
          };
          subStates.set(subId, next);
        }
        log('warn', 'payment_failed', {
          event_id: eventId, sub_id: subId ?? null, invoice: inv?.id,
          attempt: inv?.attempt_count ?? null, next_attempt: inv?.next_payment_attempt ?? null,
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const inv = event.data?.object as StripeInvoice;
        const subId = inv?.subscription;
        if (subId) {
          const prev = subStates.get(subId);
          if (prev) {
            prev.status = 'active';
            prev.delinquent_at = undefined;
            prev.updated_at = Date.now();
          }
        }
        log('info', 'payment_succeeded', { event_id: eventId, sub_id: subId ?? null, invoice: inv?.id });
        break;
      }

      case 'checkout.session.completed': {
        // 初回 checkout — クライアントは success_url + session_id で確定する経路なので
        // ここではログのみ
        const sess = event.data?.object as { id?: string; subscription?: string; customer?: string };
        log('info', 'checkout_completed', {
          event_id: eventId, session_id: sess?.id, sub_id: sess?.subscription ?? null,
        });
        break;
      }

      default:
        log('info', 'unhandled', { event_id: eventId, type });
    }
  } catch (e: any) {
    log('error', 'handler_error', { event_id: eventId, type, msg: e?.message, stack: e?.stack });
    // Stripe にリトライしてもらうため 500
    return new Response(JSON.stringify({ error: 'handler error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
