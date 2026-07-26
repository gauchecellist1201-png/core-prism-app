// ============================================================
// AgentBriefShell — 連携エージェントカードの共通の器 (2026-07-26)
//
// カレンダー/メール/売上の3枚が同じ見た目・同じ振る舞いになるように、
// 器だけをここに集約。中身(何を読んで何を提案するか)は各カードが持つ。
// 未連携のときは各カード側で null を返す＝偽の器を絶対に見せない。
// ============================================================
import type { ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import type { BriefRow } from '../lib/agentBrief';

export interface BriefAction {
  label: string;
  doneLabel?: string;
  run: () => void | Promise<void>;
}

export interface AgentBriefAccent {
  /** カード背景のグラデーション */
  bg: string;
  /** カード枠線 */
  border: string;
  /** 見出しアイコン色 / リンク色 */
  ink: string;
}

export const ACCENT_INDIGO: AgentBriefAccent = {
  bg: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(167,139,250,0.06))',
  border: '1px solid rgba(129,140,248,0.28)',
  ink: '#A5B4FC',
};
export const ACCENT_EMERALD: AgentBriefAccent = {
  bg: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(45,212,191,0.06))',
  border: '1px solid rgba(52,211,153,0.28)',
  ink: '#6EE7B7',
};
export const ACCENT_ROSE: AgentBriefAccent = {
  bg: 'linear-gradient(135deg, rgba(232,75,151,0.10), rgba(244,114,182,0.06))',
  border: '1px solid rgba(244,114,182,0.28)',
  ink: '#F9A8D4',
};
export const ACCENT_GOLD: AgentBriefAccent = {
  bg: 'linear-gradient(135deg, rgba(201,162,75,0.12), rgba(234,179,8,0.06))',
  border: '1px solid rgba(201,162,75,0.32)',
  ink: '#E3C77E',
};

export default function AgentBriefShell({
  explainId,
  icon,
  title,
  meta,
  accent,
  loading,
  error,
  emptyText,
  rows,
  actionsFor,
  busyIdx,
  doneIdx,
  onRefresh,
}: {
  explainId: string;
  icon: ReactNode;
  title: string;
  meta: string;
  accent: AgentBriefAccent;
  loading: boolean;
  error: string;
  /** 読めたけど提案が0件のときの文言 (「今週は衝突なし」など) */
  emptyText: string;
  rows: BriefRow[];
  actionsFor: (row: BriefRow, index: number) => BriefAction[];
  /** 実行中のアクション (row index * 100 + action index) */
  busyIdx?: number | null;
  doneIdx?: number | null;
  onRefresh: () => void;
}) {
  return (
    <div
      data-explain-id={explainId}
      style={{
        borderRadius: 16, padding: '14px 16px', marginBottom: 12,
        background: accent.bg,
        border: accent.border,
      }}
    >
      {/* 見出しは1行目に固定し、根拠(meta)は2行目へ。
          375px でタイトルが折り返して meta が見切れるのを避ける */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: accent.ink, display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg, #E5E7EB)', minWidth: 0, flex: 1 }}>{title}</span>
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label="いま作り直す"
          title="いま作り直す"
          style={{
            marginLeft: 'auto', width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.14)', background: 'transparent',
            color: 'var(--fg-muted, #9CA3AF)', cursor: loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <RefreshCw size={14} strokeWidth={2.2} className={loading ? 'animate-spin' : undefined} />
        </button>
      </div>
      {meta && (
        <p style={{ fontSize: 11.5, color: 'var(--fg-muted, #9CA3AF)', margin: '4px 0 0', lineHeight: 1.5 }}>{meta}</p>
      )}

      {loading && rows.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #9CA3AF)', margin: '10px 0 2px' }}>
          読み込んで、次の一手を考えています…
        </p>
      )}
      {error && !loading && (
        <p style={{ fontSize: 12.5, color: '#FCA5A5', margin: '10px 0 2px' }}>
          {error} — 右上の更新でもう一度ためせます。
        </p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #9CA3AF)', margin: '10px 0 2px' }}>{emptyText}</p>
      )}

      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          {rows.map((it, i) => {
            const actions = actionsFor(it, i);
            return (
              <div
                key={i}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 12,
                  background: 'rgba(0,0,0,0.18)',
                  border: `1px solid ${it.tone === 'alert' ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.10)'}`,
                }}
              >
                {it.tone === 'alert'
                  ? <AlertTriangle size={15} strokeWidth={2.2} style={{ color: '#F87171', flexShrink: 0, marginTop: 2 }} />
                  : <Sparkles size={15} strokeWidth={2.2} style={{ color: accent.ink, flexShrink: 0, marginTop: 2 }} />}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg, #E5E7EB)', margin: 0 }}>
                    {it.title}
                    {it.when && (
                      <span style={{ fontWeight: 500, fontSize: 11.5, color: 'var(--fg-muted, #9CA3AF)', marginLeft: 6 }}>
                        {it.when}
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: 12.5, color: 'var(--fg-muted, #B4B8C2)', margin: '3px 0 0', lineHeight: 1.6 }}>
                    {it.detail}
                  </p>
                  {actions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
                      {actions.map((a, ai) => {
                        const id = i * 100 + ai;
                        const busy = busyIdx === id;
                        const done = doneIdx === id;
                        return (
                          <button
                            key={ai}
                            onClick={() => { void a.run(); }}
                            disabled={busy}
                            style={{
                              fontSize: 12, fontWeight: 700, minHeight: 32,
                              color: done ? '#34D399' : accent.ink,
                              background: 'none', border: 'none', padding: 0,
                              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                            }}
                          >
                            {busy ? '実行中…' : done ? (a.doneLabel || '完了しました') : a.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
