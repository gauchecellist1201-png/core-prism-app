// ============================================================
// agentBrief — 「つなぐと、AIが勝手に働き出す」共通土台 (2026-07-26)
//
// なぜ要るか:
//  ・連携エージェント(カレンダー/メール/売上)は毎日1回だけ自分から動く。
//    費用ガードのため、同じ日に何度も AI を叩かない。
//  ・PC版とモバイル版で同じカードを2箇所に置くと、両方がマウントされて
//    AI呼び出しが二重になる。→ 日付キーで「1日1回・1インスタンス」に束ねる。
//
// 使い方: useAgentBrief('prism_mail_brief_v1', async () => ({...}))
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { fetchWithTimeout } from './fetchWithTimeout';

export type BriefTone = 'alert' | 'idea';

/** 連携エージェントが出す1行 */
export interface BriefRow {
  tone: BriefTone;
  title: string;
  detail: string;
  when?: string;
  /** 元データへの参照 (メールIDなど。アクション配線用) */
  refId?: string;
}

export interface BriefResult {
  rows: BriefRow[];
  /** カード見出しの右に出す一行 (「直近7日 12件の実予定から」など) */
  meta: string;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

type Stored = { day: string; result: BriefResult };

function loadDaily(key: string): BriefResult | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Stored;
    return p && p.day === todayKey() ? p.result : null;
  } catch { return null; }
}

function saveDaily(key: string, result: BriefResult) {
  try { localStorage.setItem(key, JSON.stringify({ day: todayKey(), result } as Stored)); } catch { /* noop */ }
}

/** 同一日・同一キーの実行を1本に束ねる (PC版/モバイル版の二重マウント対策) */
const inflight = new Map<string, { day: string; promise: Promise<BriefResult> }>();

export function runDaily(key: string, fn: () => Promise<BriefResult>, force: boolean): Promise<BriefResult> {
  const day = todayKey();
  if (!force) {
    const live = inflight.get(key);
    if (live && live.day === day) return live.promise;
    const cached = loadDaily(key);
    if (cached) return Promise.resolve(cached);
  }
  const promise = fn().then((r) => { saveDaily(key, r); return r; });
  // 失敗したら次回もう一度ためせるように束ねを解除する
  promise.catch(() => { if (inflight.get(key)?.promise === promise) inflight.delete(key); });
  inflight.set(key, { day, promise });
  return promise;
}

/**
 * 実データを渡して JSON 配列だけを返させる共通AI呼び出し。
 * 返答が壊れていたら空配列 = 「無理に何か出す」より「何も出さない」を選ぶ。
 */
export async function askAgentRows(system: string, user: string): Promise<BriefRow[]> {
  const res = await fetchWithTimeout('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 900,
      system: `${system}\n必ずJSON配列のみで返答: [{"title":"短い見出し","detail":"具体的な中身(80字以内)","when":"対象(あれば)","refId":"指定があれば該当ID"}]。渡されたデータに無いことを作らない。データが足りなければ空配列 [] を返す。`,
      messages: [{ role: 'user', content: `${user}\n\nJSONのみで返答してください。` }],
    }),
  }, 40000);
  if (!res.ok) return [];
  const data = await res.json();
  const text: string =
    (data?.content && Array.isArray(data.content) ? data.content[0]?.text : '') ||
    data?.text || data?.message || '';
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]) as Partial<BriefRow>[];
    return arr
      .filter((x) => x && typeof x.title === 'string' && typeof x.detail === 'string' && x.title && x.detail)
      .slice(0, 3)
      .map((x) => ({
        tone: 'idea' as const,
        title: String(x.title),
        detail: String(x.detail),
        when: x.when ? String(x.when) : undefined,
        refId: x.refId ? String(x.refId) : undefined,
      }));
  } catch { return []; }
}

export interface AgentBriefState {
  rows: BriefRow[];
  meta: string;
  loading: boolean;
  error: string;
  refresh: () => void;
}

/**
 * 連携エージェントの共通フック。
 * enabled=false (未連携) の間は一切ネットワークを叩かない。
 */
export function useAgentBrief(
  key: string,
  enabled: boolean,
  fn: () => Promise<BriefResult>,
): AgentBriefState {
  const [rows, setRows] = useState<BriefRow[]>([]);
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback((force: boolean) => {
    if (!enabled) return;
    let alive = true;
    setError('');
    setLoading(true);
    runDaily(key, fn, force)
      .then((r) => { if (!alive) return; setRows(r.rows); setMeta(r.meta); })
      .catch((e) => { if (!alive) return; setError(e instanceof Error ? e.message : '取得に失敗しました'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // fn は毎レンダー新しい参照になりうるので依存に入れない (キーで同一性を担保)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  useEffect(() => { run(false); }, [run]);

  return { rows, meta, loading, error, refresh: () => run(true) };
}
