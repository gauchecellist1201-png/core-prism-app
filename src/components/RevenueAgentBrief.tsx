// ============================================================
// RevenueAgentBrief — 「Stripeをつなぐと、AIが勝手に働き出す」(2026-07-26)
//
// カレンダー/メール連携エージェントと同型。売上を眺めるだけで終わらせず、
// Prism が実数字を読んで自分から次の一手を出す:
//  1. Stripe の実売上スナップショット(月次)を読む
//  2. コード確定で前月比の落ち込み・解約の気配を検知(AI不使用＝誤検知しない)
//  3. AI が「今月の売上を上げる具体策」を最大2件出す
//  4. ワンタップでタスク予約 / LINE通知へ
//
// 表示ゲートは同期判定(直近キャッシュがStripe接続済みを示す時だけ)。
// 未接続の人に一瞬でもカードを見せない＝偽の器を作らない。
// ============================================================
import { useCallback, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  fetchRevenueSnapshot, isRevenueConnectedCached, fmtJpy, fmtJpyShort,
  type RevenueSnapshot,
} from '../lib/revenue';
import { isLineConnected, notifyLine } from '../lib/lineNotify';
import { useAgentBrief, askAgentRows, type BriefRow, type BriefResult } from '../lib/agentBrief';
import AgentBriefShell, { ACCENT_GOLD, type BriefAction } from './AgentBriefShell';

const BRIEF_KEY = 'prism_revenue_agent_brief_v1';

/** 直近2ヶ月を比べる（コード確定・AIに数字を触らせない） */
function momRows(snap: RevenueSnapshot): BriefRow[] {
  const m = snap.monthly || [];
  if (m.length < 2) return [];
  const cur = m[m.length - 1];
  const prev = m[m.length - 2];
  if (prev.mrrJpy <= 0) return [];
  const diff = cur.mrrJpy - prev.mrrJpy;
  if (diff >= 0) return [];
  const pct = Math.round((Math.abs(diff) / prev.mrrJpy) * 100);
  return [{
    tone: 'alert',
    title: `先月より ${fmtJpyShort(Math.abs(diff))} 減っています（${pct}%減）`,
    detail: `${prev.month} は ${fmtJpy(prev.mrrJpy)}、${cur.month} は ${fmtJpy(cur.mrrJpy)}。解約か、新規が止まっているかのどちらかです。`,
  }];
}

export default function RevenueAgentBrief({
  personaName,
  personaRole,
  onAddTask,
}: {
  personaName: string;
  personaRole?: string;
  onAddTask?: (text: string) => void;
}) {
  const connected = typeof window !== 'undefined' && isRevenueConnectedCached();
  const [doneIdx, setDoneIdx] = useState<number | null>(null);

  const runner = useCallback(async (): Promise<BriefResult> => {
    const snap = await fetchRevenueSnapshot();
    const rows = momRows(snap);

    const monthly = (snap.monthly || []).slice(-6)
      .map((p) => `${p.month}: MRR ${fmtJpy(p.mrrJpy)}（Prism ${fmtJpy(p.prismJpy)} / Iris ${fmtJpy(p.irisJpy)} / その他 ${fmtJpy(p.otherJpy)}）`)
      .join('\n');
    const aiRows = await askAgentRows(
      `あなたは${personaName}${personaRole ? `（${personaRole}）` : ''}の専属のCFO兼グロース担当AIです。実際のStripe売上を読み、今月の売上を上げるために今週やる具体策を最大2件出します。「頑張る」「見直す」のような抽象論は書かず、誰に何をするかまで書く。数字は渡されたものだけを使い、勝手な予測値を作らない。`,
      `今のMRR: ${fmtJpy(snap.totals.mrrJpy)}（有料 ${snap.totals.paidCount}件 / 年換算 ${fmtJpy(snap.totals.arrJpy)}）\n直近6ヶ月:\n${monthly}`,
    );

    return {
      rows: [...rows, ...aiRows],
      meta: `Stripeの実売上 MRR ${fmtJpyShort(snap.totals.mrrJpy)}・有料${snap.totals.paidCount}件から`,
    };
  }, [personaName, personaRole]);

  const { rows, meta, loading, error, refresh } = useAgentBrief(BRIEF_KEY, connected, runner);

  if (!connected) return null;

  const hasLine = typeof window !== 'undefined' && isLineConnected();

  function actionsFor(row: BriefRow, i: number): BriefAction[] {
    const out: BriefAction[] = [];
    if (onAddTask) {
      out.push({ label: 'タスクに入れる', run: () => onAddTask(`${row.title} — ${row.detail}`) });
    }
    if (hasLine) {
      const id = i * 100 + out.length;
      out.push({
        label: 'LINEに送る',
        doneLabel: 'LINEに送りました',
        run: async () => {
          const r = await notifyLine(`【Prism 売上ブリーフ】\n${row.title}\n${row.detail}`, undefined, true);
          if (r.ok) { setDoneIdx(id); setTimeout(() => setDoneIdx(null), 2000); }
        },
      });
    }
    return out;
  }

  return (
    <AgentBriefShell
      explainId="revenue-agent-brief"
      icon={<TrendingUp size={16} strokeWidth={2.1} />}
      title="売上連携エージェント"
      meta={meta}
      accent={ACCENT_GOLD}
      loading={loading}
      error={error}
      emptyText="今の数字から急いで直すところはありません。"
      rows={rows}
      actionsFor={actionsFor}
      doneIdx={doneIdx}
      onRefresh={refresh}
    />
  );
}
