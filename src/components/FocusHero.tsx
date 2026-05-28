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
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ArrowRight, Sparkles } from 'lucide-react';
import type { Persona, Proposal } from '../types/identity';
import { useStripeRevenue } from '../hooks/useStripeRevenue';

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
  /** 「やる」= 最初のアクションを承認 */
  onPrimaryAction?: (actionText: string) => void;
  /** 「次の一手を出す」= 提案を生成 */
  onGenerate?: () => void;
  /** 「もっと見る」トグル */
  expanded: boolean;
  onToggleExpanded: () => void;
  /** 折りたたまれている残りセクション数 (バッジ表示用) */
  hiddenCount?: number;
}

export default function FocusHero({
  persona, proposal, isGenerating, onPrimaryAction, onGenerate,
  expanded, onToggleExpanded, hiddenCount,
}: Props) {
  const stripe = useStripeRevenue();
  const [showDetail, setShowDetail] = useState(false);
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
        transition={{ duration: 0.4 }}
        style={{
          position: 'relative',
          padding: '1.4rem 1.3rem',
          borderRadius: 20,
          background: `linear-gradient(135deg, ${um.color}1c, ${accent}10 60%, transparent)`,
          border: `1.5px solid ${um.color}55`,
          overflow: 'hidden',
        }}
      >
        {/* 左端の緊急度バー */}
        <div aria-hidden style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
          background: um.color, boxShadow: `0 0 20px ${um.color}88`,
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

            {/* ボタン行 */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {firstAction && onPrimaryAction && (
                <button
                  type="button"
                  onClick={() => onPrimaryAction(firstAction)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 18px', borderRadius: 10,
                    background: `linear-gradient(135deg, ${um.color}, ${um.color}cc)`,
                    color: '#0a0a0f', border: 'none', fontSize: 13.5, fontWeight: 800,
                    cursor: 'pointer', boxShadow: `0 8px 20px ${um.color}44`,
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
                        onClick={() => onPrimaryAction?.(a)}
                        style={{
                          textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                          background: 'var(--surface-3)', border: '1px solid var(--border-2)',
                          color: 'var(--fg)', fontSize: 12.5, cursor: 'pointer',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
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

      {/* ── 数字 1 行帯 (今は大カード 3 連 → 圧縮) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 14px', borderRadius: 12,
        background: 'var(--surface-3)', border: '1px solid var(--border-2)',
        fontFamily: '"SF Mono", "JetBrains Mono", Menlo, monospace',
      }}>
        <NumChip label="今月" value={fmtJpy(thisRev)} color="#34D399" />
        {stripe.connected && total12 > 0 && (
          <NumChip label="累計(12ヶ月)" value={fmtJpy(total12)} color="#2E6FFF" muted />
        )}
        {!stripe.connected && (
          <span style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>
            Stripe をつなぐと売上が出ます
          </span>
        )}
      </div>

      {/* ── もっと見る トグル ── */}
      <button
        type="button"
        onClick={onToggleExpanded}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 14px', borderRadius: 10,
          background: expanded ? 'var(--surface-3)' : `${accent}12`,
          border: `1px solid ${expanded ? 'var(--border-2)' : accent + '33'}`,
          color: expanded ? 'var(--fg-muted)' : accent,
          fontSize: 12.5, fontWeight: 700, cursor: 'pointer', width: '100%',
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
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
      <span style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'inherit' }}>{label}</span>
      <span style={{ fontSize: muted ? 13 : 16, fontWeight: 700, color: muted ? `${color}cc` : color }}>{value}</span>
    </span>
  );
}
