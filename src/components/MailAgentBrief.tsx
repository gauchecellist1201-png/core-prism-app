// ============================================================
// MailAgentBrief — 「Gmailをつなぐと、AIが勝手に働き出す」(2026-07-26)
//
// カレンダー連携エージェントと同型。連携しただけで終わらせず、
// Prism が受信箱を読んで自分から動く:
//  1. 直近14日の実メールを読む
//  2. コード確定で「48時間以上ほったらかしの未読」を検知(AI不使用＝誤検知しない)
//  3. AI が「今日返すべきメール」と返信方針を出す
//  4. ワンタップで返信の下書きを Gmail に作る(送信はしない＝押した人が確認して送る)
//
// 費用ガード: 1日1回だけ自動実行。更新ボタンで明示的に作り直せる。
// 未連携なら何も出さない(偽の器を見せない)。
// ============================================================
import { useCallback, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { isGmailConnected, fetchInbox, createGmailDraft } from '../lib/gmail';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { isLineConnected, notifyLine } from '../lib/lineNotify';
import { useAgentBrief, askAgentRows, todayKey, type BriefRow, type BriefResult } from '../lib/agentBrief';
import AgentBriefShell, { ACCENT_EMERALD, type BriefAction } from './AgentBriefShell';

const BRIEF_KEY = 'prism_mail_agent_brief_v1';
const CTX_KEY = 'prism_mail_agent_ctx_v1';

/** 下書き作成に必要な最小情報 (ブリーフがキャッシュから復元されても使えるよう別途保存) */
type MailCtx = { id: string; threadId: string; from: string; subject: string; excerpt: string };

function saveCtx(items: MailCtx[]) {
  try { localStorage.setItem(CTX_KEY, JSON.stringify({ day: todayKey(), items })); } catch { /* noop */ }
}
function loadCtx(): MailCtx[] {
  try {
    const raw = localStorage.getItem(CTX_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as { day: string; items: MailCtx[] };
    return p && p.day === todayKey() && Array.isArray(p.items) ? p.items : [];
  } catch { return []; }
}

/** 差出人ヘッダ ("表示名 <a@b.c>") から表示名だけ取り出す */
function displayName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : from).trim() || from;
}

/** 差出人ヘッダからメールアドレスだけ取り出す */
function addressOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}

function hoursSince(dateStr: string): number {
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / 3600000;
}

export default function MailAgentBrief({
  personaName,
  personaRole,
  onAddTask,
}: {
  personaName: string;
  personaRole?: string;
  onAddTask?: (text: string) => void;
}) {
  const connected = typeof window !== 'undefined' && isGmailConnected();
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [doneIdx, setDoneIdx] = useState<number | null>(null);
  const personaRef = useRef({ personaName, personaRole });
  personaRef.current = { personaName, personaRole };

  const runner = useCallback(async (): Promise<BriefResult> => {
    const messages = await fetchInbox(10);
    saveCtx(messages.slice(0, 10).map((m) => ({
      id: m.id,
      threadId: m.threadId,
      from: m.from,
      subject: m.subject,
      excerpt: (m.body || m.snippet || '').slice(0, 800),
    })));

    // ① コード確定: 48時間以上ほったらかしの未読 (AIに判定させない＝嘘ゼロ)
    const stale = messages.filter((m) => m.isUnread && hoursSince(m.date) >= 48);
    const rows: BriefRow[] = [];
    if (stale.length > 0) {
      rows.push({
        tone: 'alert',
        title: `2日以上返せていないメールが ${stale.length}件`,
        detail: stale.slice(0, 2)
          .map((m) => `${displayName(m.from)}「${m.subject || '(件名なし)'}」`)
          .join(' / '),
      });
    }

    // ② AI: 今日返すべきメールと返信方針
    let aiRows: BriefRow[] = [];
    if (messages.length > 0) {
      const { personaName: pn, personaRole: pr } = personaRef.current;
      const list = messages.slice(0, 10).map((m) =>
        `id:${m.id} / 差出人:${displayName(m.from)} / 件名:${m.subject || '(件名なし)'} / ${m.isUnread ? '未読' : '既読'} / 経過:${Math.round(hoursSince(m.date))}時間\n本文冒頭:${(m.body || m.snippet).slice(0, 300).replace(/\s+/g, ' ')}`,
      ).join('\n---\n');
      aiRows = await askAgentRows(
        `あなたは${pn}${pr ? `（${pr}）` : ''}の専属秘書AIです。実際の受信メールを読み、今日中に返すべきメールを最大2件えらび、それぞれ「どう返すか」の方針を書きます。広告・通知メールは選ばない。refId には対象メールの id をそのまま入れる。`,
        `受信箱(直近14日・最大10件):\n${list}`,
      );
      aiRows = aiRows.filter((r) => r.refId && messages.some((m) => m.id === r.refId)).slice(0, 2);
    }

    const unread = messages.filter((m) => m.isUnread).length;
    return {
      rows: [...rows, ...aiRows],
      meta: messages.length > 0 ? `受信箱の実メール ${messages.length}件（未読 ${unread}）から` : '直近14日の受信メールはありません',
    };
  }, []);

  const { rows, meta, loading, error, refresh } = useAgentBrief(BRIEF_KEY, connected, runner);

  if (!connected) return null;

  const hasLine = typeof window !== 'undefined' && isLineConnected();

  /** AIに返信文を書かせて Gmail の下書きに入れる（送信はしない） */
  async function makeDraft(row: BriefRow, actionId: number) {
    const ctx = loadCtx().find((c) => c.id === row.refId);
    if (!ctx) return;
    setBusyIdx(actionId);
    try {
      const res = await fetchWithTimeout('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 700,
          system: `あなたは${personaName}${personaRole ? `（${personaRole}）` : ''}本人として日本語のビジネスメール返信を書きます。署名は書かない。前置きや解説を書かず、本文だけを出力する。事実が分からない箇所は断定せず、確認する言い方にする。`,
          messages: [{
            role: 'user',
            content: `以下のメールへの返信本文を書いてください。\n方針: ${row.detail}\n\n差出人: ${ctx.from}\n件名: ${ctx.subject}\n本文:\n${ctx.excerpt}`,
          }],
        }),
      }, 40000);
      if (!res.ok) throw new Error('返信の作成に失敗しました');
      const data = await res.json();
      const body: string =
        (data?.content && Array.isArray(data.content) ? data.content[0]?.text : '') ||
        data?.text || data?.message || '';
      if (!body.trim()) throw new Error('返信の作成に失敗しました');
      await createGmailDraft({
        threadId: ctx.threadId,
        to: addressOf(ctx.from),
        subject: /^re:/i.test(ctx.subject) ? ctx.subject : `Re: ${ctx.subject}`,
        body: body.trim(),
        inReplyTo: `<${ctx.id}@mail.gmail.com>`,
        references: `<${ctx.id}@mail.gmail.com>`,
      });
      setDoneIdx(actionId);
      setTimeout(() => setDoneIdx(null), 4000);
    } catch { /* 失敗しても画面は壊さない (ボタンは元に戻る) */ }
    finally { setBusyIdx(null); }
  }

  function actionsFor(row: BriefRow, i: number): BriefAction[] {
    const out: BriefAction[] = [];
    if (row.refId && loadCtx().some((c) => c.id === row.refId)) {
      const id = i * 100 + out.length; // push 前に確定させる (後から評価すると別ボタンのIDになる)
      out.push({
        label: '返信の下書きをGmailに作る',
        doneLabel: 'Gmailに下書きを作りました',
        run: () => makeDraft(row, id),
      });
    }
    if (onAddTask) {
      out.push({ label: 'タスクに入れる', run: () => onAddTask(`${row.title} — ${row.detail}`) });
    }
    if (hasLine) {
      const id = i * 100 + out.length;
      out.push({
        label: 'LINEに送る',
        doneLabel: 'LINEに送りました',
        run: async () => {
          const r = await notifyLine(`【Prism メールブリーフ】\n${row.title}\n${row.detail}`, undefined, true);
          if (r.ok) { setDoneIdx(id); setTimeout(() => setDoneIdx(null), 2000); }
        },
      });
    }
    return out;
  }

  return (
    <AgentBriefShell
      explainId="mail-agent-brief"
      icon={<Mail size={16} strokeWidth={2.1} />}
      title="メール連携エージェント"
      meta={meta}
      accent={ACCENT_EMERALD}
      loading={loading}
      error={error}
      emptyText="いま急いで返すべきメールはありません。"
      rows={rows}
      actionsFor={actionsFor}
      busyIdx={busyIdx}
      doneIdx={doneIdx}
      onRefresh={refresh}
    />
  );
}
