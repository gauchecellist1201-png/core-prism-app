// ============================================================
// MilestoneRadar — 「節目と、抜けているもの」(2026-08-01)
//
// 競合3社(Notion AI / freee / マネーフォワード)から連続で指摘された穴の埋め:
//   Prism は「開いた時に1日1回」提案を作るだけで、月末・締切・支払日・請求日という
//   **暦の節目に反応しなかった**。8月1日（7月が締まった日）に開いても「おはよう」だけだった。
//
// このカードの約束:
//   ・月の節目は**連携ゼロでも必ず出る**（暦だけで確定するから、待たせない・失敗しない）
//   ・カレンダー/メール/売上をつないでいる人には、そこから「抜けているもの」も足す
//   ・**出す物が1つも無い日は、カードごと消える**（空の器を置かない）
//   ・AIを使わない。ありもしない締切を作らないため
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  buildRadar, monthMilestoneRows, monthParts,
  type RadarRow, type RadarCalEvent, type RadarMonthlyPoint, type StalledThread,
} from '../lib/milestoneRadar';
import { isCalConnected, fetchUpcomingEvents } from '../lib/googleCalendar';
import { isGmailConnected, fetchStalledThreads } from '../lib/gmail';
import { isRevenueConnectedCached, fetchRevenueSnapshot, fmtJpy } from '../lib/revenue';
import { isLineConnected, notifyLine } from '../lib/lineNotify';
import AgentBriefShell, { ACCENT_GOLD, type BriefAction } from './AgentBriefShell';

const CACHE_KEY = 'prism_milestone_radar_v1';

/** 連携先から集めた材料。暦(月の節目)はここに入れない＝取得を待たずに出す */
interface RadarSources {
  events: RadarCalEvent[];
  monthly: RadarMonthlyPoint[] | null;
  stalled: StalledThread[];
  /** 見出しの下に出す根拠の断片 */
  notes: string[];
}

const EMPTY_SOURCES: RadarSources = { events: [], monthly: null, stalled: [], notes: [] };

function dayKey(now: Date): string {
  const p = monthParts(now);
  return `${p.key}-${p.day}`;
}

function loadCache(now: Date): RadarSources | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { day: string; sources: RadarSources };
    return p && p.day === dayKey(now) ? p.sources : null;
  } catch { return null; }
}

function saveCache(now: Date, sources: RadarSources) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ day: dayKey(now), sources }));
  } catch { /* noop */ }
}

/**
 * 連携先の取得が固まってもカードが永久に読み込み中にならないようにする。
 * 失敗も遅延も「その材料は無かった」として扱い、暦ぶんは必ず出す。
 */
function softly<T>(p: Promise<T>, fallback: T, ms = 12000): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    p.then((v) => { if (!done) { done = true; clearTimeout(timer); resolve(v); } })
      .catch(() => { if (!done) { done = true; clearTimeout(timer); resolve(fallback); } });
  });
}

async function collectSources(): Promise<RadarSources> {
  const notes: string[] = [];
  const calOn = isCalConnected();
  const mailOn = isGmailConnected();
  const revOn = isRevenueConnectedCached();

  const eventsP: Promise<RadarCalEvent[]> = calOn
    ? softly(
        fetchUpcomingEvents(7).then((list) =>
          list.map((e) => ({ id: e.id, summary: e.summary, start: e.start })),
        ),
        [],
      )
    : Promise.resolve([]);
  const stalledP: Promise<StalledThread[]> = mailOn
    ? softly(fetchStalledThreads(3, 8), [])
    : Promise.resolve([]);
  const monthlyP: Promise<RadarMonthlyPoint[] | null> = revOn
    ? softly<RadarMonthlyPoint[] | null>(
        fetchRevenueSnapshot().then((s) => s.monthly || []),
        null,
      )
    : Promise.resolve(null);

  const [events, stalled, monthly] = await Promise.all([eventsP, stalledP, monthlyP]);

  if (calOn) notes.push(`カレンダーの予定${events.length}件`);
  if (mailOn) notes.push('メールのやりとり');
  if (revOn && monthly && monthly.length > 0) notes.push('売上の月次');

  return { events, monthly, stalled, notes };
}

// PC版とモバイル版の2箇所に同じカードが置かれる（画面幅でどちらかが隠れる）。
// 素直に書くと両方が起きてカレンダー/メールを二重に取りに行くので、
// 同じ日の取得は1本に束ねる（既存の useAgentBrief と同じ考え方）。
let inflight: { day: string; p: Promise<RadarSources> } | null = null;

function collectOnce(day: string, force: boolean): Promise<RadarSources> {
  if (!force && inflight && inflight.day === day) return inflight.p;
  const p = collectSources();
  inflight = { day, p };
  // 失敗したら次に押したときもう一度ためせるように、束ねを解除する
  p.catch(() => { if (inflight?.p === p) inflight = null; });
  return p;
}

export default function MilestoneRadar({
  onAddTask,
}: {
  onAddTask?: (text: string) => void;
}) {
  const [sources, setSources] = useState<RadarSources>(EMPTY_SOURCES);
  const [loading, setLoading] = useState(false);
  const [doneIdx, setDoneIdx] = useState<number | null>(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const run = useCallback((force: boolean) => {
    const now = new Date();
    if (!force) {
      const cached = loadCache(now);
      if (cached) { setSources(cached); return; }
    }
    // つないでいる物が1つも無ければ、ネットワークは一切叩かない
    if (!isCalConnected() && !isGmailConnected() && !isRevenueConnectedCached()) {
      setSources(EMPTY_SOURCES);
      return;
    }
    setLoading(true);
    void collectOnce(dayKey(now), force)
      .then((s) => {
        if (!alive.current) return;
        setSources(s);
        saveCache(now, s);
      })
      .finally(() => { if (alive.current) setLoading(false); });
  }, []);

  useEffect(() => { run(false); }, [run]);

  // 暦の節目は取得を待たない（毎レンダーで今日の日付から作り直す）
  const now = new Date();
  const rows: RadarRow[] = loading
    ? monthMilestoneRows(now)
    : buildRadar({
        now,
        events: sources.events,
        monthly: sources.monthly,
        stalled: sources.stalled,
        fmtJpy,
      });

  // 今日は言うことが無い日 → カードごと出さない（空の器を置かない）
  if (rows.length === 0 && !loading) return null;

  const p = monthParts(now);
  const meta = [`${p.month}月${p.day}日の暦`, ...sources.notes].join('・') + 'から';
  const hasLine = typeof window !== 'undefined' && isLineConnected();

  // AgentBriefShell へ渡す都合で引数は BriefRow。実体は同じ位置の RadarRow を使う
  function actionsFor(_row: unknown, i: number): BriefAction[] {
    const row = rows[i];
    const out: BriefAction[] = [];
    if (!row) return out;
    if (onAddTask) {
      out.push({ label: 'タスクに入れる', run: () => onAddTask(row.task) });
    }
    if (hasLine) {
      const id = i * 100 + out.length;
      out.push({
        label: 'LINEに送る',
        doneLabel: 'LINEに送りました',
        run: async () => {
          const r = await notifyLine(`【Prism 節目のお知らせ】\n${row.title}\n${row.detail}`, undefined, true);
          if (r.ok) { setDoneIdx(id); setTimeout(() => setDoneIdx(null), 2000); }
        },
      });
    }
    return out;
  }

  return (
    <AgentBriefShell
      explainId="milestone-radar"
      icon={<CalendarClock size={16} strokeWidth={2.1} />}
      title="節目と、抜けているもの"
      meta={meta}
      accent={ACCENT_GOLD}
      loading={loading && rows.length === 0}
      error=""
      emptyText="今日は、急いで見る節目はありません。"
      rows={rows}
      actionsFor={actionsFor}
      doneIdx={doneIdx}
      onRefresh={() => run(true)}
    />
  );
}
