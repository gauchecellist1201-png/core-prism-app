// ============================================================
// Sales OS — データ層 (Upstash Redis)
//
// キー設計
//   sales:co:<id>        企業の全データ (JSON)
//   sales:idx            id -> CompanyRow(JSON) のハッシュ。一覧/集計はこれ1回で取る
//   sales:dom:<domain>   ドメイン -> id。同じ会社を二重登録しないための札
//   sales:act:<id>       企業ごとの活動履歴 (LPUSH / 直近 200 件)
//   sales:feed           全社横断の活動フィード (LPUSH / 直近 5000 件・週次レポート用)
//   sales:day:<YYYY-MM-DD>  その日のカウンタ (HINCRBY / 400日で失効)
// ============================================================
import type { Activity, ActivityKind, Company, CompanyRow } from '../../../src/sales/shared/types';
import { emptyScore } from '../../../src/sales/shared/score';
import { stageMeta } from '../../../src/sales/shared/catalog';
import * as kv from './kv';

export const K = {
  co: (id: string) => `sales:co:${id}`,
  idx: 'sales:idx',
  dom: (d: string) => `sales:dom:${d}`,
  act: (id: string) => `sales:act:${id}`,
  feed: 'sales:feed',
  day: (d: string) => `sales:day:${d}`,
};

const ACT_KEEP = 200;
const FEED_KEEP = 5000;
const DAY_TTL = 400 * 24 * 3600;

export const nowISO = () => new Date().toISOString();

/**
 * 営業の「今日」は日本時間の今日。
 * toISOString().slice(0,10) は UTC なので、JST 00:00〜08:59 の間ずっと
 * 前日を返す = その時間に入れた活動が昨日に付き、今日期限の追客が「まだ先」に見える。
 */
export const todayISO = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* noop */ }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---- URL / ドメイン正規化 ------------------------------------------------
export function normalizeUrl(input: string): string {
  const s = (input || '').trim();
  if (!s) return '';
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

export function domainOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ---- 企業 ----------------------------------------------------------------
/** 到達した最高段。古いデータ (maxStep 無し) は今の段で補う。 */
export function reachedStep(c: Pick<Company, 'stage' | 'maxStep'>): number {
  return Math.max(c.maxStep ?? 0, stageMeta(c.stage).step);
}

export function toRow(c: Company): CompanyRow {
  return {
    id: c.id,
    name: c.name,
    url: c.url,
    industry: c.industry,
    targetTier: c.targetTier,
    stage: c.stage,
    maxStep: reachedStep(c),
    score: c.score?.total ?? 0,
    touches: c.touches,
    nextActionAt: c.nextActionAt,
    nextActionLabel: c.nextActionLabel,
    dealYen: c.dealYen,
    updatedAt: c.updatedAt,
    hasPlans: !!(c.plans && c.plans.length),
    hasEmail: !!c.email1,
    hasCall: !!c.call,
  };
}

export function blankCompany(seed: Partial<Company>): Company {
  const t = nowISO();
  return {
    id: seed.id || newId(),
    name: seed.name || '',
    url: seed.url || '',
    domain: seed.domain || '',
    industry: seed.industry || '',
    targetTier: seed.targetTier || 'X',
    stage: seed.stage || 'NEW',
    maxStep: seed.maxStep ?? 0,
    phone: seed.phone || '',
    email: seed.email || '',
    sns: seed.sns || '',
    contactName: seed.contactName || '',
    memo: seed.memo || '',
    score: seed.score ?? emptyScore(),
    analysis: seed.analysis ?? null,
    plans: seed.plans ?? null,
    email1: seed.email1 ?? null,
    call: seed.call ?? null,
    touches: seed.touches ?? 0,
    lastTouchAt: seed.lastTouchAt ?? null,
    nextActionAt: seed.nextActionAt ?? null,
    nextActionLabel: seed.nextActionLabel || '企業分析をかける',
    dealYen: seed.dealYen ?? 0,
    lostReason: seed.lostReason || '',
    createdAt: seed.createdAt || t,
    updatedAt: t,
  };
}

export async function getCompany(id: string): Promise<Company | null> {
  if (!id) return null;
  return kv.getJSON<Company>(K.co(id));
}

/** 本体と一覧行を必ず同時に書く (片方だけ更新して一覧が嘘をつくのを防ぐ) */
export async function putCompany(c: Company): Promise<Company> {
  const next: Company = { ...c, updatedAt: nowISO() };
  await kv.pipeline([
    ['SET', K.co(next.id), JSON.stringify(next)],
    ['HSET', K.idx, next.id, JSON.stringify(toRow(next))],
  ]);
  return next;
}

export async function deleteCompany(id: string): Promise<void> {
  const c = await getCompany(id);
  const cmds: (string | number)[][] = [
    ['DEL', K.co(id)],
    ['HDEL', K.idx, id],
    ['DEL', K.act(id)],
  ];
  if (c?.domain) cmds.push(['DEL', K.dom(c.domain)]);
  await kv.pipeline(cmds);
}

export async function listRows(): Promise<CompanyRow[]> {
  const h = await kv.hgetall(K.idx);
  const out: CompanyRow[] = [];
  for (const v of Object.values(h)) {
    try {
      const r = JSON.parse(v) as CompanyRow;
      if (r && r.id) out.push(r);
    } catch { /* 壊れた行は黙って捨てる (1件で一覧全体を落とさない) */ }
  }
  return out;
}

/**
 * ドメインの札を取る。
 *   - 取れた           → { id: newId, created: true }
 *   - すでに他が持っている → { id: existingId, created: false }
 *   - 札はあるのに本体が無い (途中で落ちた) → 札を張り替えて created: true
 * 「札は取れたが本体が書かれていない」穴を必ず塞ぐ。
 */
export async function claimDomain(domain: string, candidateId: string): Promise<{ id: string; created: boolean }> {
  if (!domain) return { id: candidateId, created: true };
  const key = K.dom(domain);
  const got = await kv.setNX(key, candidateId);
  if (got) return { id: candidateId, created: true };

  const existing = await kv.get(key);
  if (!existing) {
    // 札が消えた直後。もう一度だけ取りに行く。
    const retry = await kv.setNX(key, candidateId);
    if (retry) return { id: candidateId, created: true };
    const again = await kv.get(key);
    return again ? { id: again, created: false } : { id: candidateId, created: true };
  }

  const body = await getCompany(existing);
  if (body) return { id: existing, created: false };

  // 札だけ残って本体が無い → 張り替える
  await kv.set(key, candidateId);
  return { id: candidateId, created: true };
}

/** 自分が持っている札だけを外す (他社の札を消さない) */
export async function releaseDomain(domain: string, ownerId: string): Promise<void> {
  if (!domain) return;
  const cur = await kv.get(K.dom(domain));
  if (cur === ownerId) await kv.del(K.dom(domain));
}

// ---- 活動 ----------------------------------------------------------------
export async function addActivity(a: Activity): Promise<void> {
  const raw = JSON.stringify(a);
  await kv.pipeline([
    ['LPUSH', K.act(a.companyId), raw],
    ['LTRIM', K.act(a.companyId), 0, ACT_KEEP - 1],
    ['LPUSH', K.feed, raw],
    ['LTRIM', K.feed, 0, FEED_KEEP - 1],
  ]);
}

export async function listActivities(companyId: string, limit = 50): Promise<Activity[]> {
  const raw = await kv.lrange(K.act(companyId), 0, Math.max(0, limit - 1));
  return parseActivities(raw);
}

export async function listFeed(limit = 2000): Promise<Activity[]> {
  const raw = await kv.lrange(K.feed, 0, Math.max(0, limit - 1));
  return parseActivities(raw);
}

function parseActivities(raw: string[]): Activity[] {
  const out: Activity[] = [];
  for (const s of raw) {
    try {
      const a = JSON.parse(s) as Activity;
      if (a && a.id && a.at) out.push(a);
    } catch { /* skip */ }
  }
  return out;
}

/**
 * 企業の更新・活動履歴・日次カウンタを 1 往復で書く。
 *
 * 別々に投げると、企業だけ保存できて履歴が落ちた時に 500 を返すことになる。
 * 呼び手がやり直すと段と接触回数が二重に進み、やり直さないと履歴だけ欠ける。
 * どちらも「入れたのに数字が合わない」に化けるので、まとめて 1 リクエストにする。
 */
export async function commitActivity(
  company: Company,
  activity: Activity,
  date = todayISO(),
): Promise<Company> {
  const next: Company = { ...company, updatedAt: nowISO() };
  const raw = JSON.stringify(activity);
  const dayKey = K.day(date);
  await kv.pipeline([
    ['SET', K.co(next.id), JSON.stringify(next)],
    ['HSET', K.idx, next.id, JSON.stringify(toRow(next))],
    ['LPUSH', K.act(next.id), raw],
    ['LTRIM', K.act(next.id), 0, ACT_KEEP - 1],
    ['LPUSH', K.feed, raw],
    ['LTRIM', K.feed, 0, FEED_KEEP - 1],
    ['HINCRBY', dayKey, activity.kind, 1],
    ['HINCRBY', dayKey, 'total', 1],
    ['EXPIRE', dayKey, DAY_TTL],
  ]);
  return next;
}

// ---- 日次カウンタ --------------------------------------------------------
export async function bumpDay(kind: ActivityKind, date = todayISO()): Promise<void> {
  const key = K.day(date);
  await kv.pipeline([
    ['HINCRBY', key, kind, 1],
    ['HINCRBY', key, 'total', 1],
    ['EXPIRE', key, DAY_TTL],
  ]);
}

export async function readDay(date = todayISO()): Promise<Record<string, number>> {
  const h = await kv.hgetall(K.day(date));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(h)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}
