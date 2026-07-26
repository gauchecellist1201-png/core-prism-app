// ============================================================
// AgentBriefLane — 連携エージェントの並び (2026-07-26)
//
// 「つなぐと、AIが勝手に働き出す」をカレンダー/メール/売上で横展開。
// つないだものだけが出る。何もつないでいない人には1枚も出ない。
//
// PC版とモバイル版の2箇所に置いても、useAgentBrief 側で
// 「1日1回・実行は1本」に束ねてあるのでAI呼び出しは二重にならない。
// ============================================================
import CalendarAgentBrief from './CalendarAgentBrief';
import MailAgentBrief from './MailAgentBrief';
import RevenueAgentBrief from './RevenueAgentBrief';

export default function AgentBriefLane({
  personaName,
  personaRole,
}: {
  personaName: string;
  personaRole?: string;
}) {
  // 既存のタスク予約キューへ橋渡し (PrismTaskScheduler が拾う)
  const onAddTask = (text: string) => {
    try { window.dispatchEvent(new CustomEvent('prism-task-quick-add', { detail: { text } })); } catch { /* noop */ }
  };
  const p = { personaName, personaRole, onAddTask };

  return (
    <>
      <CalendarAgentBrief {...p} />
      <MailAgentBrief {...p} />
      <RevenueAgentBrief {...p} />
    </>
  );
}
