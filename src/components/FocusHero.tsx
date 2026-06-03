// ============================================================
// FocusHero — 「焦点モード」ダッシュボード最上部
//
// オーナー指示 (2026-05-28):
//   「パッと見の文字量が多すぎる / 優先順位が分からない / バーッと出てくる」
//   → 開いた瞬間「今日の最優先 1 つ + 数字 1 行」だけを大きく見せ、
//     残りは「もっと見る」で畳む。
//
// 優先順位の視覚言語:
//   🔴 今すぐ (24h 以内)  /  🟡 今週  /  🟢 いつでも
// ============================================================
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, Sparkles } from 'lucide-react';
import type { Persona, Proposal, AppSettings } from '../types/identity';
import { useStripeRevenue } from '../hooks/useStripeRevenue';
import InlineActionExecutor from './InlineActionExecutor';

type Urgency = 'now' | 'week' | 'anytime';

const URGENCY_META: Record<Urgency, { label: string; color: string; emoji: string }> = {
  now:     { label: '今すぐ', color: '#F87171', emoji: '🔴' },
  week:    { label: '今週',   color: '#FBBF24', emoji: '🟡' },
  anytime: { label: 'いつでも', color: '#34D399', emoji: '🟢' },
};

function fmtJpy(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  return '¥' + Math.round(n).toLocaleString('ja-JP');
}

/** proposal の文面から緊急度を推定 */
function inferUrgency(p: Proposal | null): Urgency {
  if (!p) return 'week';
  const t = (p.title + ' ' + (p.message || '')).toLowerCase();
  if (/今すぐ|今日中|今夜|締切|期限|あと\s*\d+\s*(時間|h)|本日|至急|今このタイミング/.test(t)) return 'now';
  if (/今週|明日|あさって|\d+\s*日後|来週まで/.test(t)) return 'week';
  return 'anytime';
}

interface Props {
  persona: Persona;
  /** 今日の最優先提案 (coach brief or proactive proposal) */
  proposal: Proposal | null;
  isGenerating?: boolean;
  /** 「やる」= 最初のアクションを承認 (タスクへの追加用 fallback) */
  onPrimaryAction?: (actionText: string) => void;
  /** 「次の一手を出す」= 提案を生成 */
  onGenerate?: () => void;
  /** 「もっと見る」トグル */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** 折りたたまれている残りセクション数 (バッジ表示用) */
  hiddenCount?: number;
  /** AI 実行に必要 (オーナー指示 2026-06-03: タップ→ 実際に実行) */
  settings?: AppSettings;
}

export default function FocusHero({
  persona, proposal, isGenerating, onPrimaryAction, onGenerate,
  expanded, onToggleExpanded, hiddenCount, settings,
}: Props) {
  const stripe = useStripeRevenue();
  const [showDetail, setShowDetail] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const accent = persona.accentColor;

  const urgency = useMemo(() => inferUrgency(proposal), [proposal]);
  const um = URGENCY_META[urgency];
  const firstAction = proposal?.actions?.[0] || null;

  const thisRev = stripe.connected ? stripe.thisMonth.revenueJpy : 0;
  const total12 = stripe.connected ? stripe.sumMonths(12).revenueJpy : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── 主役: 今日の最優先 1 つ ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'relative',
          padding: '1.6rem 1.5rem 1.5rem',
          borderRadius: 24,
          background: `
            radial-gradient(120% 140% at 0% 0%, ${um.color}1f 0%, transparent 45%),
            radial-gradient(120% 160% at 100% 100%, ${accent}18 0%, transparent 50%),
            linear-gradient(160deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))
          `,
          border: `1px solid ${um.color}3a`,
          boxShadow: `0 20px 50px -24px ${um.color}55, inset 0 1px 0 rgba(255,255,255,0.06)`,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          overflow: 'hidden',
        }}
      >
        {/* 装飾オーブ (右上、緊急度カラー) */}
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: -70, right: -60,
            width: 200, height: 200, borderRadius: '50%',
            background: `radial-gradient(circle, ${um.color}40 0%, transparent 70%)`,
            filter: 'blur(36px)', pointerEvents: 'none',
          }}
        />
        {/* 左端の緊急度バー (グロー) */}
        <div aria-hidden style={{
          position: 'absolute', left: 0, top: 14, bottom: 14, width: 4,
          borderRadius: 4,
          background: `linear-gradient(180deg, ${um.color}, ${um.color}55)`,
          boxShadow: `0 0 22px ${um.color}aa`,
        }} />

        {/* ラベル行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 999,
            background: `${um.color}22`, border: `1px solid ${um.color}66`,
            fontSize: 11, fontWeight: 800, color: um.color, letterSpacing: '0.04em',
          }}>
            {um.emoji} {um.label}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
            今日の最優先
          </span>
        </div>

        {isGenerating ? (
          <div style={{ padding: '0.6rem 0', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fg-muted)' }}>
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-flex' }}>
              <Sparkles size={16} color={accent} />
            </motion.span>
            <span style={{ fontSize: 14 }}>あなたの状況を読んで、次の一手を考えています…</span>
          </div>
        ) : proposal ? (
          <>
            <h2 style={{
              margin: 0, fontSize: 'clamp(1.25rem, 4vw, 1.7rem)', fontWeight: 800,
              lineHeight: 1.3, color: 'var(--fg-strong)', letterSpacing: '-0.01em',
            }}>
              {proposal.title}
            </h2>

            {/* 1 行だけ要約 (詳細はタップで) */}
            {proposal.message && (
              <p style={{
                margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.6,
                color: 'var(--fg-muted)',
                display: '-webkit-box',
                WebkitLineClamp: showDetail ? 99 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {proposal.message}
              </p>
            )}

            {/* ボタン行 — タップで AI が即実行 (オーナー指示 2026-06-03) */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {firstAction && (
                <button
                  type="button"
                  onClick={() => setExecutingAction(firstAction)}
                  disabled={executingAction !== null}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', borderRadius: 10,
                    background: `linear-gradient(135deg, ${um.color}, ${um.color}cc)`,
                    color: '#0a0a0f', border: 'none', fontSize: 13.5, fontWeight: 800,
                    cursor: executingAction ? 'wait' : 'pointer', boxShadow: `0 8px 20px ${um.color}44`,
                    opacity: executingAction ? 0.7 : 1,
                  }}
                >
                  ▶ {firstAction.length > 22 ? firstAction.slice(0, 22) + '…' : firstAction}
                </button>
              )}
              {proposal.message && (
                <button
                  type="button"
                  onClick={() => setShowDetail(v => !v)}
                  style={{
                    padding: '10px 14px', borderRadius: 10,
                    background: 'var(--surface-3)', color: 'var(--fg-muted)',
                    border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {showDetail ? '閉じる' : '詳しく'}
                </button>
              )}
            </div>

            {/* 詳細展開時: 残りのアクション + 根拠 */}
            {showDetail && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                style={{ overflow: 'hidden', marginTop: 12 }}
              >
                {proposal.actions && proposal.actions.length > 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {proposal.actions.slice(1).map((a, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setExecutingAction(a)}
                        disabled={executingAction !== null}
                        style={{
                          textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                          background: 'var(--surface-3)', border: '1px solid var(--border-2)',
                          color: 'var(--fg)', fontSize: 12.5, cursor: executingAction ? 'wait' : 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
                          opacity: executingAction ? 0.5 : 1,
                        }}
                      >
                        <span>{a}</span>
                        <ArrowRight size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
                      </button>
                    ))}
                  </div>
                )}
                {(proposal as { context?: string }).context && (
                  <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--fg-subtle)', lineHeight: 1.6 }}>
                    なぜ: {(proposal as { context?: string }).context}
                  </p>
                )}
              </motion.div>
            )}

            {/* AI 実行 ペイン (オーナー指示 2026-06-03: 動かないボタンを撲滅) */}
            <AnimatePresence>
              {executingAction && settings && (
                <InlineActionExecutor
                  key={`exec-${executingAction}`}
                  action={executingAction}
                  persona={persona}
                  settings={settings}
                  contextText={(proposal as { context?: string })?.context}
                  onAddAsTask={(act) => { onPrimaryAction?.(act); }}
                  onClose={() => setExecutingAction(null)}
                />
              )}
            </AnimatePresence>
          </>
        ) : (
          <>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--fg-strong)', lineHeight: 1.3 }}>
              今日、何からはじめる?
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              ボタンを押すと、いまのあなたを見て AI が一番効く一手を 1 つ出します。
            </p>
            {onGenerate && (
              <button
                type="button"
                onClick={onGenerate}
                style={{
                  marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', borderRadius: 10,
                  background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                  color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 800,
                  cursor: 'pointer', boxShadow: `0 8px 20px ${accent}44`,
                }}
              >
                <Sparkles size={15} /> 次の一手を出す
              </button>
            )}
          </>
        )}
      </motion.div>

      {/* ── 数字 1 行帯 (今は大カード 3 連 → 圧縮、ガラス質感) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: 16,
        background: 'linear-gradient(160deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012))',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        fontFamily: '"SF Mono", "JetBrains Mono", Menlo, monospace',
      }}>
        <NumChip label="今月" value={fmtJpy(thisRev)} color="#34D399" />
        {stripe.connected && total12 > 0 && (
          <>
            <span aria-hidden style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.1)', margin: '0 16px' }} />
            <NumChip label="累計 (12ヶ月)" value={fmtJpy(total12)} color="#2E6FFF" muted />
          </>
        )}
        {!stripe.connected && (
          <span style={{ fontSize: 11.5, color: 'var(--fg-muted)', marginLeft: 12, fontFamily: 'system-ui' }}>
            Stripe をつなぐと売上が出ます
          </span>
        )}
      </div>

      {/* ── もっと見る トグル (洗練) ── */}
      <button
        type="button"
        onClick={onToggleExpanded}
        className="cp-pill-tap"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '11px 14px', borderRadius: 12,
          background: expanded ? 'rgba(255,255,255,0.03)' : `linear-gradient(135deg, ${accent}16, ${accent}06)`,
          border: `1px solid ${expanded ? 'rgba(255,255,255,0.08)' : accent + '33'}`,
          color: expanded ? 'var(--fg-muted)' : accent,
          fontSize: 12.5, fontWeight: 800, letterSpacing: '0.02em', cursor: 'pointer', width: '100%',
          transition: 'all 0.2s ease',
        }}
      >
        {expanded
          ? <>閉じてシンプルに <ChevronUp size={15} /></>
          : <>すべての機能を見る{hiddenCount ? ` (${hiddenCount}+)` : ''} <ChevronDown size={15} /></>}
      </button>
    </div>
  );
}

function NumChip({ label, value, color, muted }: { label: string; value: string; color: string; muted?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
      <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'system-ui', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{
        fontSize: muted ? 14 : 18, fontWeight: 700,
        color: muted ? `${color}cc` : color,
        textShadow: muted ? 'none' : `0 0 18px ${color}44`,
        letterSpacing: '-0.01em',
      }}>{value}</span>
    </span>
  );
}
