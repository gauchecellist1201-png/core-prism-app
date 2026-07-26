// ============================================================
// CalendarAgentBrief — 「つなぐと、AIが勝手に働き出す」の実体 (2026-07-26)
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
// 費用ガード: AI分析は1日1回だけ自動実行（結果はlocalStorageに保存）。
//  「いま作り直す」で明示的に再実行できる。
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, RefreshCw, AlertTriangle, Sparkles, Send } from 'lucide-react';
import { isCalConnected, fetchUpcomingEvents, type CalEvent } from '../lib/googleCalendar';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { isLineConnected, notifyLine } from '../lib/lineNotify';

type BriefItem = {
  kind: 'prep' | 'slot' | 'conflict';
  title: string;
  detail: string;
  when?: string;
};

type StoredBrief = { day: string; items: BriefItem[]; eventCount: number };

const STORE_KEY = 'prism_cal_agent_brief_v1';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadStored(): StoredBrief | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredBrief;
    return p.day === todayKey() ? p : null;
  } catch { return null; }
}

function saveStored(b: StoredBrief) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(b)); } catch { /* noop */ }
}

/** コード確定のダブルブッキング検知（AIに任せない＝嘘ゼロ） */
function detectConflicts(events: CalEvent[]): BriefItem[] {
  const timed = events
    .filter((e) => e.start && e.end)
    .map((e) => ({ e, s: new Date(e.start).getTime(), t: new Date(e.end).getTime() }))
    .sort((a, b) => a.s - b.s);
  const out: BriefItem[] = [];
  for (let i = 0; i < timed.length - 1; i++) {
    const a = timed[i], b = timed[i + 1];
    if (b.s < a.t) {
      out.push({
        kind: 'conflict',
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
  const [connected, setConnected] = useState(false);
  const [items, setItems] = useState<BriefItem[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sentIdx, setSentIdx] = useState<number | null>(null);

  const run = useCallback(async (force: boolean) => {
    if (!isCalConnected()) { setConnected(false); return; }
    setConnected(true);
    if (!force) {
      const cached = loadStored();
      if (cached) { setItems(cached.items); setEventCount(cached.eventCount); return; }
    }
    setLoading(true);
    setError('');
    try {
      const events = await fetchUpcomingEvents(7);
      const conflicts = detectConflicts(events);
      let aiItems: BriefItem[] = [];
      if (events.length > 0) {
        // AIには予定の中身をそのまま渡す（要約だけ渡すと的外れになる）
        const list = events.slice(0, 25).map(fmtEventLine).join('\n');
        const res = await fetchWithTimeout('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 900,
            system: `あなたは${personaName}${personaRole ? `（${personaRole}）` : ''}の専属秘書AIです。カレンダーの実予定を読み、(1)準備が要る予定の準備ブリーフ(最大2件) (2)空き時間の使い方提案(最大1件) を出します。必ずJSON配列のみで返答: [{"kind":"prep"|"slot","title":"短い見出し","detail":"具体的な中身(80字以内)","when":"対象の日時(あれば)"}]。予定に無いことを作らない。`,
            messages: [{ role: 'user', content: `今日: ${new Date().toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}\n直近7日の実予定:\n${list}\n\nJSONのみで返答してください。` }],
          }),
        }, 40000);
        if (res.ok) {
          const data = await res.json();
          const text: string =
            (data?.content && Array.isArray(data.content) ? data.content[0]?.text : '') ||
            data?.text || data?.message || '';
          const m = text.match(/\[[\s\S]*\]/);
          if (m) {
            const arr = JSON.parse(m[0]) as BriefItem[];
            aiItems = arr
              .filter((x) => x && (x.kind === 'prep' || x.kind === 'slot') && x.title && x.detail)
              .slice(0, 3);
          }
        }
      }
      const all = [...conflicts, ...aiItems];
      setItems(all);
      setEventCount(events.length);
      saveStored({ day: todayKey(), items: all, eventCount: events.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : '予定の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [personaName, personaRole]);

  useEffect(() => { void run(false); }, [run]);

  // LINE連携済みならブリーフをLINEにも送れる（既存 notifyLine を利用・force=明示操作なのでON/OFF設定より優先）
  async function sendToLine(item: BriefItem, idx: number) {
    const r = await notifyLine(
      `【Prism 予定ブリーフ】\n${item.title}${item.when ? `（${item.when}）` : ''}\n${item.detail}`,
      undefined,
      true,
    );
    if (r.ok) {
      setSentIdx(idx);
      setTimeout(() => setSentIdx(null), 2000);
    }
  }

  if (!connected) return null; // 未連携なら何も出さない（偽の器を見せない）

  const hasLine = typeof window !== 'undefined' && isLineConnected();

  return (
    <div
      data-explain-id="cal-agent-brief"
      style={{
        borderRadius: 16, padding: '14px 16px', marginBottom: 12,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(167,139,250,0.06))',
        border: '1px solid rgba(129,140,248,0.28)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CalendarCheck2 size={16} strokeWidth={2.1} style={{ color: '#A5B4FC', flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg, #E5E7EB)' }}>
          カレンダー連携エージェント
        </span>
        <span style={{ fontSize: 11, color: 'var(--fg-muted, #9CA3AF)' }}>
          {eventCount > 0 ? `直近7日 ${eventCount}件の実予定から` : '直近7日の予定はありません'}
        </span>
        <button
          onClick={() => void run(true)}
          disabled={loading}
          aria-label="いま作り直す"
          title="いま作り直す"
          style={{ marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'transparent', color: 'var(--fg-muted, #9CA3AF)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RefreshCw size={14} strokeWidth={2.2} className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>

      {loading && items.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #9CA3AF)', margin: '10px 0 2px' }}>
          予定を読んで、次の一手を考えています…
        </p>
      )}
      {error && !loading && (
        <p style={{ fontSize: 12.5, color: '#FCA5A5', margin: '10px 0 2px' }}>
          {error} — 右上の更新でもう一度ためせます。
        </p>
      )}
      {!loading && !error && items.length === 0 && eventCount > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #9CA3AF)', margin: '10px 0 2px' }}>
          今週は準備が要る予定・時間の衝突はありません。
        </p>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {items.map((it, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: 12,
                background: 'rgba(0,0,0,0.18)',
                border: `1px solid ${it.kind === 'conflict' ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.10)'}`,
              }}
            >
              {it.kind === 'conflict'
                ? <AlertTriangle size={15} strokeWidth={2.2} style={{ color: '#F87171', flexShrink: 0, marginTop: 2 }} />
                : <Sparkles size={15} strokeWidth={2.2} style={{ color: '#C4B5FD', flexShrink: 0, marginTop: 2 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg, #E5E7EB)', margin: 0 }}>
                  {it.title}
                  {it.when && <span style={{ fontWeight: 500, fontSize: 11.5, color: 'var(--fg-muted, #9CA3AF)', marginLeft: 6 }}>{it.when}</span>}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #B4B8C2)', margin: '3px 0 0', lineHeight: 1.6 }}>{it.detail}</p>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {onAddTask && it.kind !== 'conflict' && (
                    <button
                      onClick={() => onAddTask(`${it.title} — ${it.detail}`)}
                      style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      タスクに入れる
                    </button>
                  )}
                  {hasLine && (
                    <button
                      onClick={() => void sendToLine(it, i)}
                      style={{ fontSize: 12, fontWeight: 700, color: sentIdx === i ? '#34D399' : '#A5B4FC', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Send size={12} strokeWidth={2.2} /> {sentIdx === i ? 'LINEに送りました' : 'LINEに送る'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
