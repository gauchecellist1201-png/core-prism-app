// ============================================================
// CalendarAgentBrief — 「つなぐと、AIが勝手に働き出す」の第1弾 (2026-07-26)
//
// なぜ作るか（オーナー指示）: Google連携しても「つながった」だけで
// AI性が薄かった。連携後は Prism がそのデータを読んで自分から動く。
//
// 何をするか（すべて実データ・嘘ゼロ）:
//  1. Googleカレンダーの直近7日の予定を読む
//  2. コード確定でダブルブッキングを検知（AI不使用＝誤検知しない）
//  3. AI が「会議ごとの準備ブリーフ」「空き時間に何を差し込むべきか」を
//     人格（ペルソナ）の文脈で提案する
//  4. 提案はワンタップで「タスク予約」へ、LINE連携済みならLINEにも届く
//
// 2026-07-26 第2波: メール/売上の連携エージェントを足すにあたり、器と
//  「1日1回だけ動く」土台を AgentBriefShell / useAgentBrief に共通化。
// ============================================================
import { useCallback, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import { isCalConnected, fetchUpcomingEvents, type CalEvent } from '../lib/googleCalendar';
import { isLineConnected, notifyLine } from '../lib/lineNotify';
import { useAgentBrief, askAgentRows, type BriefRow, type BriefResult } from '../lib/agentBrief';
import AgentBriefShell, { ACCENT_INDIGO, type BriefAction } from './AgentBriefShell';

const BRIEF_KEY = 'prism_cal_agent_brief_v2';

/** コード確定のダブルブッキング検知（AIに任せない＝嘘ゼロ） */
function detectConflicts(events: CalEvent[]): BriefRow[] {
  const timed = events
    .filter((e) => e.start && e.end)
    .map((e) => ({ e, s: new Date(e.start).getTime(), t: new Date(e.end).getTime() }))
    .sort((a, b) => a.s - b.s);
  const out: BriefRow[] = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i], b = timed[i + 1];
    if (b.s < a.t) {
      out.push({
        tone: 'alert',
        title: 'ダブルブッキングの可能性',
        detail: `「${a.e.summary || '無題'}」と「${b.e.summary || '無題'}」の時間が重なっています`,
        when: new Date(b.s).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      });
    }
  }
  return out;
}

function fmtEventLine(e: CalEvent): string {
  const s = e.start ? new Date(e.start) : null;
  const when = s ? s.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '終日';
  return `- ${when} ${e.summary || '無題'}`;
}

export default function CalendarAgentBrief({
  personaName,
  personaRole,
  onAddTask,
}: {
  personaName: string;
  personaRole?: string;
  /** 「タスク予約」へ橋渡し（既存のPrismTaskSchedulerキューに乗せる） */
  onAddTask?: (text: string) => void;
}) {
  const connected = typeof window !== 'undefined' && isCalConnected();
  const [doneIdx, setDoneIdx] = useState<number | null>(null);

  const runner = useCallback(async (): Promise<BriefResult> => {
    const events = await fetchUpcomingEvents(7);
    const conflicts = detectConflicts(events);
    let aiRows: BriefRow[] = [];
    if (events.length > 0) {
      // AIには予定の中身をそのまま渡す（要約だけ渡すと的外れになる）
      const list = events.slice(0, 25).map(fmtEventLine).join('\n');
      aiRows = await askAgentRows(
        `あなたは${personaName}${personaRole ? `（${personaRole}）` : ''}の専属秘書AIです。カレンダーの実予定を読み、(1)準備が要る予定の準備ブリーフ(最大2件) (2)空き時間の使い方提案(最大1件) を出します。`,
        `今日: ${new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}\n直近7日の実予定:\n${list}`,
      );
    }
    return {
      rows: [...conflicts, ...aiRows],
      meta: events.length > 0 ? `直近7日 ${events.length}件の実予定から` : '直近7日の予定はありません',
    };
  }, [personaName, personaRole]);

  const { rows, meta, loading, error, refresh } = useAgentBrief(BRIEF_KEY, connected, runner);

  if (!connected) return null; // 未連携なら何も出さない（偽の器を見せない）

  const hasLine = typeof window !== 'undefined' && isLineConnected();

  function actionsFor(row: BriefRow, i: number): BriefAction[] {
    const out: BriefAction[] = [];
    if (onAddTask && row.tone !== 'alert') {
      out.push({ label: 'タスクに入れる', run: () => onAddTask(`${row.title} — ${row.detail}`) });
    }
    if (hasLine) {
      const id = i * 100 + out.length;
      out.push({
        label: 'LINEに送る',
        doneLabel: 'LINEに送りました',
        run: async () => {
          const r = await notifyLine(
            `【Prism 予定ブリーフ】\n${row.title}${row.when ? `（${row.when}）` : ''}\n${row.detail}`,
            undefined,
            true,
          );
          if (r.ok) { setDoneIdx(id); setTimeout(() => setDoneIdx(null), 2000); }
        },
      });
    }
    return out;
  }

  return (
    <AgentBriefShell
      explainId="cal-agent-brief"
      icon={<CalendarCheck2 size={16} strokeWidth={2.1} />}
      title="カレンダー連携エージェント"
      meta={meta}
      accent={ACCENT_INDIGO}
      loading={loading}
      error={error}
      emptyText="今週は準備が要る予定・時間の衝突はありません。"
      rows={rows}
      actionsFor={actionsFor}
      doneIdx={doneIdx}
      onRefresh={refresh}
    />
  );
}
