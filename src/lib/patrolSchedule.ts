// ============================================================
// patrolSchedule — 「朝のブリーフ / 夜のレビュー」を今日もう出したかを覚えておく係
//
// ★2026-08-05 深夜に見つかった不具合 (silent fail):
//   1) 出す前に「出した」と記録していた。
//      アプリを朝ひらくと、人格の切替効果が先に走って通常の提案を作り始める。
//      その 5 秒後に朝の巡回が動くが、`isGenerating` で弾かれて **何も作らない**。
//      それなのに「今日の朝のぶんは出した」という印だけが残るので、
//      その日の「朝のブリーフ」は二度と出ない。毎朝いちばんの価値が黙って消えていた。
//   2) 日付を UTC (`toISOString()`) で持っていた。
//      日本時間の朝 6〜10 時は UTC の日付の変わり目 (9:00 JST = 0:00 UTC) をまたぐので、
//      6:30 に出したあと 9:30 に開くと「別の日」と誤認して **同じ朝に 2 回**出る。
//
// ここでは日付を端末のローカル日で持ち、「作れた時だけ」印を付ける。
// 作れなかった日は次の見回り (1 分後) でやり直すが、API が落ちている時に
// 一日中叩き続けないよう、1 日あたりの試行回数に上限を置く。
// ============================================================

export type PatrolKind = 'morning' | 'evening';

/** その日にやり直す上限。これを超えたら今日はあきらめて通常の巡回に戻る。 */
export const MAX_PATROL_TRIES = 3;

export interface PatrolRecord {
  /** 実際に提案を作れた日 (ローカル日付 YYYY-MM-DD) */
  morning?: string;
  evening?: string;
  /** その日の試行回数 'YYYY-MM-DD:2' */
  morningTries?: string;
  eveningTries?: string;
}

/** 端末のローカル日付 (YYYY-MM-DD)。UTC 換算しないのがこの関数の要点。 */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 朝 = 6:00〜9:59 / 夜 = 20:00〜23:59。それ以外は null。 */
export function windowKind(d: Date = new Date()): PatrolKind | null {
  const h = d.getHours();
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 20) return 'evening';
  return null;
}

function triesToday(rec: PatrolRecord, kind: PatrolKind, day: string): number {
  const raw = kind === 'morning' ? rec.morningTries : rec.eveningTries;
  if (!raw) return 0;
  const [d, n] = raw.split(':');
  if (d !== day) return 0;
  const parsed = Number(n);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 「いま巡回を走らせるべきか」を返す。走らせるべきでなければ null。
 * まだ今日の分を出せていない かつ 試行上限に達していない 時だけ kind を返す。
 */
export function duePatrol(rec: PatrolRecord, now: Date = new Date()): PatrolKind | null {
  const kind = windowKind(now);
  if (!kind) return null;
  const day = localDay(now);
  if (rec[kind] === day) return null;                          // もう出せている
  if (triesToday(rec, kind, day) >= MAX_PATROL_TRIES) return null; // 今日はあきらめた
  return kind;
}

/** 試行を 1 回ぶん数える (作る前に呼ぶ)。 */
export function bumpTries(rec: PatrolRecord, kind: PatrolKind, now: Date = new Date()): PatrolRecord {
  const day = localDay(now);
  const next = triesToday(rec, kind, day) + 1;
  return kind === 'morning'
    ? { ...rec, morningTries: `${day}:${next}` }
    : { ...rec, eveningTries: `${day}:${next}` };
}

/** 実際に提案を作れた時だけ呼ぶ。ここではじめて「今日は出した」になる。 */
export function markPatrolDone(rec: PatrolRecord, kind: PatrolKind, now: Date = new Date()): PatrolRecord {
  return { ...rec, [kind]: localDay(now) };
}

/** localStorage から読む (壊れていても落とさない)。 */
export function readPatrol(key: string): PatrolRecord {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as PatrolRecord : {};
  } catch { return {}; }
}

/** localStorage へ書く (容量超過などで失敗しても落とさない)。 */
export function writePatrol(key: string, rec: PatrolRecord): void {
  try { localStorage.setItem(key, JSON.stringify(rec)); } catch { /* quota / private mode */ }
}
