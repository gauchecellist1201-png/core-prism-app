// ============================================================
// CancelFlowDialog — 解約前 引き止め + Exit Survey
//
// オーナー指示 (2026-06-04 第 14 波 EEE):
//   Stripe Cancel を叩く前に「停止理由を 1 つ選んでもらう」 Exit Survey。
//   料金が高い / 使い方が分からない / 他のツールに移る / その他 を
//   ワンタップ選択 → サーバ送信 → 解約実行。
//
// 2026-07-24 追加 (価値で価格を超える / テーマ⑤ 解約引き止め):
//   Exit Survey の前に「この7日間、AIがあなたのために動いた量」を1画面見せる。
//   実データ (computeWeeklyValue) の件数・外注換算のみを正直に出し、
//   有料プランなら「今週分で月額の元が取れています」を突き合わせる (honest-numbers)。
//   活動がゼロのユーザーには嘘の数字を出さず、この画面を丸ごとスキップして
//   いきなり Exit Survey へ進む (誇張しない)。
//   「このまま続ける」で解約せず離脱を止める＝最も効く引き止めレバー。
//
// 設計:
//   - step: 'value'(動いた量) → 'survey'(理由選択)。活動0なら初期stepは'survey'。
//   - スキップ可 (右上の × か「理由を選ばずに解約」)
//   - 1 つ選ぶと「もう少し詳しく? (任意)」テキストエリアが現れる
//   - 「解約する」を押すと /api/feedback (kind=exit) に reason + comment を送信
//     → 続いて onConfirmCancel() を呼んで実際の Stripe cancel に進む
//   - フィードバック送信失敗でも解約はブロックしない (fire-and-forget)
// ============================================================

import { useState, useEffect, type ComponentType } from 'react';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, ChevronRight, Heart, Coins, HelpCircle, Shuffle, Clock, Pencil, TrendingUp, Check, Sparkles, ArrowRight } from 'lucide-react';
import { computeWeeklyValue } from '../lib/weeklyValue';
import { getEffectivePlanPriceJpy, loadBillingUser } from '../lib/billing';

export type ExitReason = 'too_expensive' | 'too_hard' | 'switching' | 'not_useful' | 'other';

interface Props {
  open: boolean;
  brand?: 'prism' | 'iris';
  /** 停止確定 — Stripe cancel を呼ぶ。busy 中は disabled に */
  onConfirmCancel: () => void | Promise<void>;
  onClose: () => void;
  cancelBusy?: boolean;
}

// 絵文字は使わない (オーナー恒久ルール)。理由アイコンは Lucide ライン系で統一。
const REASONS: { id: ExitReason; Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; color: string; label: string; sub: string }[] = [
  { id: 'too_expensive', Icon: Coins,      color: '#E0A82E', label: '料金が高い',           sub: '想定より使っていない / 価値を感じない' },
  { id: 'too_hard',      Icon: HelpCircle,  color: '#8E5CFF', label: '使い方が分からない',   sub: '機能が多すぎる / どこから始めれば' },
  { id: 'switching',     Icon: Shuffle,     color: '#2E6FFF', label: '他のツールに移る',     sub: 'もっと合う製品が見つかった' },
  { id: 'not_useful',    Icon: Clock,       color: '#06A57A', label: 'いまの自分には不要',   sub: '使うタイミングではない' },
  { id: 'other',         Icon: Pencil,      color: '#888',    label: 'その他',               sub: '一言だけ伝えたい' },
];

async function postExitSurvey(brand: 'prism' | 'iris', reason: ExitReason, comment: string): Promise<void> {
  try {
    await fetchWithTimeout('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brand,
        kind: 'exit',
        exitReason: reason,
        comment,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        ts: Date.now(),
      }),
      keepalive: true,
    });
  } catch { /* fire and forget */ }
}

export default function CancelFlowDialog({ open, brand = 'prism', onConfirmCancel, onClose, cancelBusy = false }: Props) {
  const [selected, setSelected] = useState<ExitReason | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 「動いた量」を実データで集計 (honest-numbers)。open のたびに最新化。
  // 活動が全く無ければ嘘の数字を出さず value ステップを丸ごと飛ばす。
  const value = open ? computeWeeklyValue() : { total: 0, estimatedYen: 0, todayTotal: 0, metrics: [], dailySeries: [] };
  const hasValue = value.total > 0 || value.estimatedYen > 0;
  const monthlyPrice = open ? (() => { const p = getEffectivePlanPriceJpy(loadBillingUser()); return Number.isFinite(p) ? p : 0; })() : 0;
  // 有料プランで、今週分の外注換算が月額に届いていれば「もう元が取れている」と正直に言える。
  const paidBack = hasValue && monthlyPrice > 0 && value.estimatedYen >= monthlyPrice;
  const paybackPct = monthlyPrice > 0 ? Math.min(100, Math.round((value.estimatedYen / monthlyPrice) * 100)) : 0;

  // step: 動いた量を見せてから理由選択へ。活動0なら最初から survey。
  const [step, setStep] = useState<'value' | 'survey'>(hasValue ? 'value' : 'survey');

  // ダイアログを開くたびに内部状態をリセット (親は常時マウントのまま open を切替えるため)。
  useEffect(() => {
    if (open) {
      setStep(hasValue ? 'value' : 'survey');
      setSelected(null);
      setComment('');
    }
  // hasValue は open 遷移時にだけ評価したい。open のみを依存に。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    // フィードバック送信は並行 (失敗しても cancel は続行)
    if (selected) {
      postExitSurvey(brand, selected, comment.trim());
    }
    try {
      await onConfirmCancel();
    } finally {
      setSubmitting(false);
    }
  };

  const skipAndCancel = async () => {
    // 理由を選ばずに解約 (Survey 送信なし)
    setSubmitting(true);
    try { await onConfirmCancel(); } finally { setSubmitting(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 12px',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              maxHeight: 'calc(100vh - 48px)',
              background: '#fff',
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 10,
              borderBottom: '1px solid #f1f1f1',
            }}>
              <Heart size={18} color="#E84B97" />
              <div style={{ flex: 1, fontSize: '0.92rem', fontWeight: 800, color: '#1F1A2E' }}>
                {step === 'value' ? 'その前に、これだけ見てください' : '解約する前に、ひとこと聞いてもいいですか?'}
              </div>
              <button
                onClick={onClose}
                aria-label="閉じる"
                style={{
                  width: 30, height: 30, borderRadius: 15,
                  background: '#f4f4f7', border: 'none',
                  color: '#666', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {step === 'value' ? (
                <ValueStep
                  value={value}
                  monthlyPrice={monthlyPrice}
                  paidBack={paidBack}
                  paybackPct={paybackPct}
                />
              ) : (
              <>
              <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#444', lineHeight: 1.7 }}>
                停止する理由を 1 つ選んでもらえると、次のリリースで必ず改善に使います。
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REASONS.map(r => {
                  const active = selected === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: active ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' : '#FAFAF8',
                        border: `1.5px solid ${active ? '#FBBF24' : 'rgba(0,0,0,0.06)'}`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s, border 0.15s',
                      }}
                    >
                      <span style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: `${r.color}1a`, color: r.color,
                      }}>
                        <r.Icon size={17} color={r.color} strokeWidth={2.2} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F1A2E' }}>
                          {r.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 1 }}>
                          {r.sub}
                        </div>
                      </div>
                      {active && <ChevronRight size={16} color="#E84B97" />}
                    </button>
                  );
                })}
              </div>

              {selected && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: '0.78rem', color: '#666', fontWeight: 600 }}>
                    もう少し詳しく? <span style={{ color: '#999', fontWeight: 400 }}>(任意 / 1〜2 行)</span>
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="例: 月額は妥当だけど、特定の機能が使い切れていない"
                    rows={2}
                    style={{
                      marginTop: 4, width: '100%',
                      background: '#fff',
                      border: '1px solid #e5e5e5',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: '0.85rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div style={{
                marginTop: 16, padding: '10px 12px',
                background: '#F0F9FF',
                border: '1px solid #BAE6FD',
                borderRadius: 10,
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: '0.78rem', color: '#0C4A6E', lineHeight: 1.6,
              }}>
                <AlertCircle size={14} color="#0EA5E9" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  解約は <strong>期間末まで使えます</strong>。すぐに料金が止まる仕様ではないので、ご安心ください。
                </span>
              </div>
              </>
              )}
            </div>

            {step === 'value' ? (
              // 動いた量ステップの footer: 主導線は「このまま続ける」(引き止め)。
              // 解約は控えめな 2 次導線に置く (それでも解約したい人だけが進む)。
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid #f1f1f1',
                display: 'flex', flexDirection: 'column', gap: 8,
                background: '#FAFAF8',
              }}>
                <button
                  onClick={onClose}
                  disabled={submitting || cancelBusy}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 12,
                    background: 'linear-gradient(135deg, #8E5CFF, #2E6FFF)',
                    color: '#fff', border: 'none',
                    fontSize: '0.92rem', fontWeight: 800,
                    cursor: submitting || cancelBusy ? 'wait' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: '0 6px 18px rgba(142,92,255,0.35)',
                  }}
                >
                  <Sparkles size={16} strokeWidth={2.3} /> このまま続ける
                </button>
                <button
                  onClick={() => setStep('survey')}
                  disabled={submitting || cancelBusy}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 12,
                    background: 'transparent', color: '#888',
                    border: 'none', fontSize: '0.82rem', fontWeight: 600,
                    cursor: submitting || cancelBusy ? 'wait' : 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  それでも解約する <ArrowRight size={13} strokeWidth={2.2} />
                </button>
              </div>
            ) : (
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid #f1f1f1',
              display: 'flex', gap: 8,
              background: '#FAFAF8',
            }}>
              <button
                onClick={skipAndCancel}
                disabled={submitting || cancelBusy}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'transparent',
                  color: '#666',
                  border: '1px solid #e5e5e5',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: submitting || cancelBusy ? 'wait' : 'pointer',
                }}
              >
                理由なしで解約
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || cancelBusy || !selected}
                style={{
                  flex: 2,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: submitting || cancelBusy || !selected
                    ? '#E5E7EB'
                    : 'linear-gradient(135deg, #6B7280, #374151)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  cursor: submitting || cancelBusy || !selected ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting || cancelBusy ? '処理中…' : selected ? '送信して解約する' : '理由を選んでね'}
              </button>
            </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// ValueStep — 解約直前に「この7日間、AIがあなたのために動いた量」を正直に見せる。
// 表示するのは computeWeeklyValue の実データだけ (件数・外注換算・今日分)。
// honest-numbers: 推定/水増しなし。有料プランで今週分が月額に届いていれば
// 「もう元が取れています」と言い切る (控えめ換算なので誇張にならない)。
// ============================================================
function ValueStep({
  value,
  monthlyPrice,
  paidBack,
  paybackPct,
}: {
  value: { total: number; estimatedYen: number; todayTotal: number };
  monthlyPrice: number;
  paidBack: boolean;
  paybackPct: number;
}) {
  const { total, estimatedYen, todayTotal } = value;
  return (
    <div>
      <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#444', lineHeight: 1.7 }}>
        解約する前に、この7日間にAIがあなたの代わりに動いた量を見てください。<br />
        <span style={{ color: '#888', fontSize: '0.78rem' }}>数字はすべてアプリ内の実際の活動だけ。水増しはしていません。</span>
      </p>

      {/* 動いた件数 — 大きく1つ。今日分があればバッジで併記。 */}
      <div style={{
        padding: '16px 16px', borderRadius: 14, marginBottom: 10,
        background: 'linear-gradient(135deg, rgba(142,92,255,0.10), rgba(46,111,255,0.05))',
        border: '1px solid rgba(142,92,255,0.28)',
        display: 'flex', alignItems: 'center', gap: 13,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: 'linear-gradient(135deg,#8E5CFF,#2E6FFF)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(142,92,255,0.40)',
        }}><TrendingUp size={21} strokeWidth={2.3} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888', marginBottom: 2 }}>
            この7日間、AIが動いた回数
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 30, fontWeight: 900, color: '#1F1A2E', letterSpacing: '-0.02em', lineHeight: 1 }}>
              {total.toLocaleString('ja-JP')}
            </span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#555' }}>件</span>
            {todayTotal > 0 && (
              <span style={{
                fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                background: 'rgba(6,199,85,0.15)', color: '#06A57A', border: '1px solid rgba(6,199,85,0.32)',
              }}>今日 {todayTotal.toLocaleString('ja-JP')} 件</span>
            )}
          </div>
        </div>
      </div>

      {/* 外注換算 — 「同じ量を外注に出すと」控えめな相場下限。 */}
      {estimatedYen > 0 && (
        <div style={{
          padding: '13px 14px', borderRadius: 13, marginBottom: 10,
          background: 'linear-gradient(135deg, rgba(6,199,85,0.12), rgba(46,111,255,0.05))',
          border: '1px solid rgba(6,199,85,0.30)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#06C755,#2E6FFF)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Coins size={18} strokeWidth={2.3} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#888', marginBottom: 1 }}>
              同じ量を外注に出すと
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#1F1A2E', letterSpacing: '-0.02em', lineHeight: 1 }}>
                約 ¥{estimatedYen.toLocaleString('ja-JP')}
              </span>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#06A57A' }}>相当を代わりに</span>
            </div>
          </div>
        </div>
      )}

      {/* 元が取れたか — 有料プランのときだけ、今週分を月額と正直に突き合わせる。 */}
      {monthlyPrice > 0 && estimatedYen > 0 && (
        <div style={{
          padding: '11px 13px', borderRadius: 12, marginBottom: 4,
          background: paidBack ? 'rgba(6,199,85,0.08)' : 'rgba(142,92,255,0.06)',
          border: `1px solid ${paidBack ? 'rgba(6,199,85,0.30)' : 'rgba(142,92,255,0.24)'}`,
          display: 'flex', alignItems: 'center', gap: 9,
        }}>
          <span style={{
            width: 24, height: 24, borderRadius: 8, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: paidBack ? 'rgba(6,199,85,0.18)' : 'rgba(142,92,255,0.15)',
            color: paidBack ? '#06A57A' : '#8E5CFF',
          }}>
            {paidBack ? <Check size={14} strokeWidth={3} /> : <TrendingUp size={13} strokeWidth={2.4} />}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#333', lineHeight: 1.45 }}>
            {paidBack ? (
              <>今週分だけで、月額 ¥{monthlyPrice.toLocaleString('ja-JP')} の<span style={{ color: '#06A57A', fontWeight: 800 }}>元が取れています</span>。</>
            ) : (
              <>月額 ¥{monthlyPrice.toLocaleString('ja-JP')} のうち、今週分で<span style={{ color: '#8E5CFF', fontWeight: 800 }}> 約 {paybackPct}%</span> を回収しました。</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
