// ============================================================
// crossServiceData — Prism の司令塔が Iris / Resonance のデータを
// 横断で読み取り、エージェントの提案根拠に使うための要約を作る。
//
// Iris は Prism と同一オリジン (同じ core-prism-app) なので localStorage を
// 直接読める。Resonance は別オリジン (resonancebot) のため、ライブデータの
// 取り込みには API 連携が必要 → 現状はリンク導線のみ (嘘の数字は出さない)。
// ============================================================

interface IgProfileLite {
  handle?: string;
  followers?: number;
  engagementRate?: number;
  mediaCount?: number;
  avgLikes?: number;
  source?: string;
  updatedAt?: string;
}

interface PostLite {
  title?: string;
  postedAt?: string;
  metrics?: { reach?: number; saves?: number; engagementRate?: number; likes?: number };
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Iris (Instagram 連携) の実データ要約。未連携なら null */
export function getIrisSummary(): string | null {
  const p = readJSON<IgProfileLite>('core_iris_ig_profile_v1');
  if (!p || !p.followers || p.source === 'self') {
    // 手入力(self)は「連携実データ」ではないので対象外
    if (!p || p.source === 'self') return null;
  }
  if (!p || !p.followers) return null;

  const lines: string[] = [];
  lines.push(`【Iris / Instagram${p.handle ? ` @${p.handle}` : ''}】`);
  lines.push(`- フォロワー ${p.followers.toLocaleString()} 人${p.mediaCount ? ` / 投稿 ${p.mediaCount.toLocaleString()} 件` : ''}${p.engagementRate ? ` / 平均ER ${p.engagementRate}%` : ''}`);

  const posts = readJSON<PostLite[]>('core_iris_posthistory_v1') || [];
  const withReach = posts.filter(x => x?.metrics?.reach != null);
  if (withReach.length) {
    const avgReach = Math.round(withReach.reduce((s, x) => s + (x.metrics!.reach || 0), 0) / withReach.length);
    const top = [...withReach].sort((a, b) => (b.metrics!.reach || 0) - (a.metrics!.reach || 0))[0];
    lines.push(`- 直近 ${withReach.length} 投稿の平均リーチ ${avgReach.toLocaleString()}`);
    if (top?.title) lines.push(`- 一番伸びた投稿: 「${top.title}」(リーチ ${(top.metrics!.reach || 0).toLocaleString()})`);
  }
  return lines.join('\n');
}

// ── 連携実データ (Gmail / カレンダー / Stripe) ───────────────
// すべて「接続済みのときだけ」呼ぶ。OAuth の同意画面(popup)は絶対に起こさない。
// ネットワークは各 8 秒でタイムアウトし、失敗しても提案生成をブロックしない。
import { isGmailConnected, fetchInboxLite } from './gmail';
import { isCalConnected, fetchUpcomingEvents } from './googleCalendar';

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>(res => setTimeout(() => res(null), ms)),
  ]);
}

// 差出人 "Name <mail@x>" → 表示名 (無ければアドレス)
function cleanFrom(raw: string): string {
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>/);
  return ((m ? m[1] : raw) || raw).trim().slice(0, 40);
}

/** Gmail 受信トレイの実データ要約 (未読数 + 上位件名)。未接続/失敗なら null */
export async function getGmailSummary(): Promise<string | null> {
  if (typeof window === 'undefined' || !isGmailConnected()) return null;
  const inbox = await withTimeout(fetchInboxLite(6), 8000);
  if (!inbox || (inbox.unreadCount === 0 && inbox.top.length === 0)) return null;
  const lines: string[] = ['【Gmail / 受信トレイ (直近7日)】'];
  lines.push(`- 未読メール ${inbox.unreadCount.toLocaleString()} 件`);
  for (const m of inbox.top.slice(0, 3)) {
    lines.push(`- ${cleanFrom(m.from)}: 「${(m.subject || '(件名なし)').slice(0, 40)}」`);
  }
  return lines.join('\n');
}

/** Google カレンダーの今日の予定要約。未接続/予定なしなら null */
export async function getCalendarSummary(): Promise<string | null> {
  if (typeof window === 'undefined' || !isCalConnected()) return null;
  const events = await withTimeout(fetchUpcomingEvents(2), 8000);
  if (!events) return null;
  const now = new Date();
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999);
  const today = events
    .filter(e => { const s = new Date(e.start); return s >= now && s <= endToday; })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  if (today.length === 0) return null;
  const lines: string[] = ['【Google カレンダー / 今日これからの予定】'];
  for (const e of today.slice(0, 4)) {
    const s = new Date(e.start);
    const hm = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
    lines.push(`- ${hm} ${(e.summary || '(無題)').slice(0, 50)}`);
  }
  return lines.join('\n');
}

/** Stripe の今月売上要約 (キャッシュ済み実データのみ・ネットワークなし)。無ければ null */
export function getStripeRevenueSummary(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('core_stripe_revenue_cache_v1');
    if (!raw) return null;
    const c = JSON.parse(raw);
    const tm = c?.data?.thisMonth;
    if (!tm || typeof tm.revenueJpy !== 'number' || tm.revenueJpy <= 0) return null;
    const lines: string[] = ['【Stripe / 今月の売上 (連携実データ)】'];
    lines.push(`- 今月の売上 ¥${Math.round(tm.revenueJpy).toLocaleString()}${tm.txnCount ? ` / 取引 ${tm.txnCount} 件` : ''}`);
    if (typeof tm.profitJpy === 'number') {
      lines.push(`- 今月の利益 ¥${Math.round(tm.profitJpy).toLocaleString()}`);
    }
    return lines.join('\n');
  } catch { return null; }
}

interface ResonanceAccount { accountName?: string; basicId?: string; followers?: number; replied?: number; recentSends?: { kind?: string; summary?: string }[] }
interface ResonanceSummary { ok?: boolean; accounts?: ResonanceAccount[]; totals?: { accounts?: number; followers?: number } }

/** Resonance(LINE配信)の実データ要約。Prism のサーバー経由で取得。失敗なら null */
export async function getResonanceSummary(): Promise<string | null> {
  try {
    const r = await fetch('/api/resonance/summary', { cache: 'no-store' });
    if (!r.ok) return null;
    const d = (await r.json()) as ResonanceSummary;
    if (!d.ok || !d.accounts?.length) return null;
    const lines: string[] = ['【Resonance / LINE配信】'];
    const t = d.totals || {};
    lines.push(`- 公式LINE ${t.accounts || d.accounts.length} アカウント / 友だち合計 ${(t.followers || 0).toLocaleString()} 人`);
    for (const a of d.accounts.slice(0, 3)) {
      lines.push(`- ${a.accountName || a.basicId}: 友だち ${(a.followers || 0).toLocaleString()} / 返信 ${a.replied || 0}${a.recentSends?.length ? ` / 直近配信「${a.recentSends[0]?.summary || ''}」` : ''}`);
    }
    return lines.join('\n');
  } catch { return null; }
}

// 提案の根拠に「実際に使えた」連携サービスの短いラベル。UI の根拠チップ用。
// 嘘を出さないため、その回で実データが返った(=null でない)ものだけを積む。
export type DataSourceLabel = 'Gmail' | 'カレンダー' | 'Stripe' | 'Instagram' | 'LINE配信';

/** Prism のエージェント提案に渡す「連携サービス実データ」要約。何も無ければ '' */
export async function getCrossServiceSummary(opts?: { includeResonance?: boolean }): Promise<string> {
  return (await getCrossServiceContext(opts)).text;
}

/**
 * 提案生成に渡す連携実データの要約テキストと、実際に寄与したソースのラベル一覧。
 * text はプロンプトに織り込み、sources は UI の根拠チップに使う（両者は同じ実データから作る＝嘘なし）。
 */
export async function getCrossServiceContext(
  opts?: { includeResonance?: boolean },
): Promise<{ text: string; sources: DataSourceLabel[] }> {
  if (typeof window === 'undefined') return { text: '', sources: [] };
  const parts: string[] = [];
  const sources: DataSourceLabel[] = [];

  const iris = getIrisSummary();
  if (iris) { parts.push(iris); sources.push('Instagram'); }

  // 連携実データ (Gmail 未読 / 今日の予定 / Stripe 売上) — 接続済みのみ・並列取得
  const [gmail, cal] = await Promise.all([getGmailSummary(), getCalendarSummary()]);
  const stripe = getStripeRevenueSummary();
  if (gmail) { parts.push(gmail); sources.push('Gmail'); }
  if (cal) { parts.push(cal); sources.push('カレンダー'); }
  if (stripe) { parts.push(stripe); sources.push('Stripe'); }

  if (opts?.includeResonance) {
    const reso = await getResonanceSummary();
    if (reso) { parts.push(reso); sources.push('LINE配信'); }
  }
  return { text: parts.join('\n\n'), sources };
}
