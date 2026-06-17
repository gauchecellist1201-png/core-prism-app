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

/** Prism のエージェント提案に渡す「連携サービス実データ」要約。何も無ければ '' */
export async function getCrossServiceSummary(opts?: { includeResonance?: boolean }): Promise<string> {
  if (typeof window === 'undefined') return '';
  const parts: string[] = [];
  const iris = getIrisSummary();
  if (iris) parts.push(iris);
  if (opts?.includeResonance) {
    const reso = await getResonanceSummary();
    if (reso) parts.push(reso);
  }
  return parts.join('\n\n');
}
