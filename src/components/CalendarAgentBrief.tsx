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
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2 } from 'lucide-react';
import {
  isCalConnected, connectCalendar, syncCalConnectionFromServer,
  fetchUpcomingEvents, type CalEvent,
} from '../lib/googleCalendar';
import { fetchGoogleServerStatus, startGoogleServerConnect, translateGoogleCallbackError } from '../lib/googleServerAuth';
import { isLineConnected, notifyLine } from '../lib/lineNotify';
import { useAgentBrief, askAgentRows, type BriefRow, type BriefResult } from '../lib/agentBrief';
import { recallAgentLink, rememberAgentLink, notifyAgentLinkChanged, AGENT_LINK_EVENT } from '../lib/agentLink';
import AgentBriefShell, { ACCENT_INDIGO, type BriefAction } from './AgentBriefShell';
import AgentLinkLostCard from './AgentLinkLostCard';

const BRIEF_KEY = 'prism_cal_agent_brief_v2';

// ============================================================
// 接続状態の見極め (2026-07-29)
//
// メール側と違い、カレンダーには「つなぎ方」が2通りある:
//   server … サーバーが refresh_token を持つ＝つなぎっぱなし（正しい方式）
//   legacy … ブラウザだけの旧方式＝1時間で必ず切れる
//
// 端末の印 (localStorage) だけを見て「外れています」と出すと、
// サーバーでは実はつながっている人に嘘を見せることになる（バックログの警告）。
// なので端末に印が無いときは、必ずサーバーに聞いてから判断する。
//   ・サーバーがつながっている → 端末の印を取り直して「連携中」に戻す（何も出さない）
//   ・サーバーもつながっていない → はじめて「外れています」を出す
// 聞いている間 (checking) は何も描かない＝一瞬「外れています」が光る誤報を出さない。
// ============================================================
type LinkState =
  | { phase: 'checking' }
  /** 一度もつないでいない ＝ 何も出さない（偽の器を作らない） */
  | { phase: 'never' }
  | { phase: 'connected' }
  | { phase: 'lost'; at: number; mode: 'server' | 'legacy' };

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

/**
 * サーバー方式でのつなぎ直し。同意画面へ遷移する（＝成功なら戻ってこない）。
 * 開始できなかったときは日本語のまま throw して、カードにその理由を出す
 * （黙って何も起きない＝silent fail を作らない）。
 */
async function reconnectViaServer(): Promise<void> {
  const r = await startGoogleServerConnect();
  if (!r.ok) throw new Error(r.message || 'Google 連携を開始できませんでした。');
}

/**
 * 同意画面から戻ってきたときの失敗理由を URL から読む。
 * 読むだけで消さない（＝PC版/モバイル版の2枚が同時に居ても、先に動いた方が
 * 理由を持ち去って、見えている方が無言になる事故を防ぐ）。
 * 今まではこの理由を出す場所が連携センター（モーダル）だけで、
 * 遷移から戻った直後はモーダルが閉じているため誰も出していなかった。
 */
function calCallbackError(): string {
  try {
    const code = new URLSearchParams(window.location.search).get('gcal_error');
    return code ? translateGoogleCallbackError(code) : '';
  } catch { return ''; }
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
  const [link, setLink] = useState<LinkState>(() => {
    if (typeof window === 'undefined') return { phase: 'never' };
    if (isCalConnected()) return { phase: 'connected' };
    // 印が無い人にサーバーへ問い合わせる意味は無い（未連携なら何も出さないだけ）
    return recallAgentLink('gcal') ? { phase: 'checking' } : { phase: 'never' };
  });
  const [linkTick, setLinkTick] = useState(0);
  const connected = link.phase === 'connected';
  const [doneIdx, setDoneIdx] = useState<number | null>(null);

  // 端末の印が切れている人だけ、サーバーに本当の接続状態を聞く。
  // ここで嘘をつかないことが最優先（サーバーがつながっているなら「外れています」は誤報）。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isCalConnected()) {
      // 連携中である事実を毎回記録し直す（＝「最後につながっていた時刻」を最新に保つ）。
      // これが無いと、この機能より前からつないでいる人には印が無く、
      // 切れたときに黙って消える古い挙動のままになる。
      rememberAgentLink('gcal');
      setLink({ phase: 'connected' });
      return;
    }
    const memo = recallAgentLink('gcal');
    if (!memo) { setLink({ phase: 'never' }); return; }

    let alive = true;
    setLink({ phase: 'checking' });
    void (async () => {
      // サーバーが refresh_token を持っていれば、ここで取り直して「連携中」に戻る
      const revived = await syncCalConnectionFromServer().catch(() => false);
      if (!alive) return;
      if (revived) { rememberAgentLink('gcal'); setLink({ phase: 'connected' }); return; }
      // 本当に外れている。つなぎ直し方はサーバー方式が使えるかで変わる
      const st = await fetchGoogleServerStatus().catch(() => ({ configured: false, connected: false }));
      if (!alive) return;
      setLink({ phase: 'lost', at: memo.at, mode: st.configured ? 'server' : 'legacy' });
    })();
    return () => { alive = false; };
  }, [linkTick]);

  // 同じカードが PC 版/モバイル版の2箇所に居るので、片方での操作
  // （つなぎ直す・もう使わない・連携センターでの解除）を全部に伝える。
  useEffect(() => {
    const onChange = () => setLinkTick((t) => t + 1);
    window.addEventListener(AGENT_LINK_EVENT, onChange);
    return () => window.removeEventListener(AGENT_LINK_EVENT, onChange);
  }, []);

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

  if (!connected) {
    // 一度もつないでいない／サーバーに問い合わせ中は何も出さない（偽の器・誤報を見せない）
    if (link.phase !== 'lost') return null;
    // つないでいた人には、黙って消えずに「外れた理由」と「つなぎ直す」を出す
    return (
      <AgentLinkLostCard
        id="gcal"
        icon={<CalendarCheck2 size={16} strokeWidth={2.1} />}
        title="カレンダー連携エージェント"
        accent={ACCENT_INDIGO}
        lastLinkedAt={link.at}
        reason={
          link.mode === 'server'
            ? 'Google 側の許可が取り消されたか、期限が切れたようです（あなたの操作ミスではありません）。つなぎ直すと、以降はつなぎっぱなしになります。'
            : 'Googleの認証は一定時間でかならず切れます（あなたの操作ミスではありません）。つなぎ直すと、このAIはすぐにまた働き始めます。'
        }
        initialError={calCallbackError()}
        reconnect={link.mode === 'server' ? reconnectViaServer : connectCalendar}
        onChanged={notifyAgentLinkChanged}
      />
    );
  }

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
