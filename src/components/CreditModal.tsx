// ============================================================
// CreditModal — プラン切替 + Top-up 購入の単一モーダル
//
// オーナー指示 (2026-05-28): 上限超え → 買い足し、プラン切替もここから。
// Stripe Checkout 連動は将来 (今は applyTopUp で localStorage に反映 = ベータ価格)。
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, ArrowRight, Zap } from 'lucide-react';
import {
  PLANS, TOP_UPS, getCredits, setPlanId, applyTopUp,
  type CreditView, type PlanId,
} from '../lib/credits';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 初期タブ: 'topup' (上限超え時) or 'plan' (普段) */
  initialTab?: 'topup' | 'plan';
}

export default function CreditModal({ open, onClose, initialTab = 'topup' }: Props) {
  const [tab, setTab] = useState<'topup' | 'plan'>(initialTab);
  const [view, setView] = useState<CreditView>(() => getCredits());
  const [thanks, setThanks] = useState<string | null>(null);

  const handleTopUp = (credits: number, jpy: number) => {
    // TODO: Stripe Checkout を呼ぶ。今はベータとして即時付与 (オーナー指示
    // 「無人モードでも動く」の方向性に合わせ、まずは UI と数字の整合性を確保)
    applyTopUp(credits);
    setView(getCredits());
    setThanks(`✓ ${credits.toLocaleString()} クレジット追加しました (¥${jpy.toLocaleString()})`);
    setTimeout(() => setThanks(null), 2400);
  };

  const handleSwitchPlan = (id: Exclude<PlanId, 'master'>) => {
    setPlanId(id);
    setView(getCredits());
    setThanks(`✓ ${PLANS[id].name} プランに切り替えました`);
    setTimeout(() => setThanks(null), 2400);
  };

  const currentPlan = view.planId !== 'master' ? PLANS[view.planId as Exclude<PlanId, 'master'>] : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(8,8,18,0.78)', backdropFilter: 'blur(14px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 30 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg, #12121E)', borderRadius: 22, padding: '1.5rem',
              maxWidth: 560, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
              color: 'var(--fg)', border: '1px solid var(--border)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
            }}
          >
            {/* ヘッダ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.8rem' }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.28em', fontWeight: 800, color: '#8E5CFF' }}>
                  CREDITS
                </div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0.25rem 0 0' }}>
                  使う量を選ぶ
                </h2>
                <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '4px 0 0' }}>
                  毎月のクレジットでアプリが動きます。足りなければいつでも買い足せます。
                </p>
              </div>
              <button onClick={onClose} aria-label="閉じる" style={{
                background: 'var(--surface-3)', border: 'none', borderRadius: '50%',
                width: 34, height: 34, cursor: 'pointer', color: 'var(--fg)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}><X size={16} /></button>
            </div>

            {/* 現状サマリ */}
            {currentPlan && (
              <div style={{
                marginBottom: 16, padding: '10px 14px', borderRadius: 12,
                background: 'var(--surface-3)', border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--fg-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                flexWrap: 'wrap',
              }}>
                <span>
                  いま <strong style={{ color: 'var(--fg)' }}>{currentPlan.emoji} {currentPlan.name}</strong> プラン
                  ・今月 <strong style={{ color: 'var(--fg)' }}>{view.used.toLocaleString()} / {(view.limit + view.addon).toLocaleString()}</strong> 使用
                </span>
                <span style={{ fontSize: 11, color: view.warning === 'soft' || view.warning === 'hard' ? '#FBBF24' : '#34D399', fontWeight: 700 }}>
                  あと {view.available.toLocaleString()} クレジット
                </span>
              </div>
            )}

            {/* タブ切替 */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 14,
              background: 'var(--surface-3)', padding: 4, borderRadius: 10,
            }}>
              <button onClick={() => setTab('topup')} style={tabBtn(tab === 'topup')}>
                <Zap size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                買い足す
              </button>
              <button onClick={() => setTab('plan')} style={tabBtn(tab === 'plan')}>
                <Sparkles size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                プラン変更
              </button>
            </div>

            {/* Top-up タブ */}
            {tab === 'topup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TOP_UPS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTopUp(t.credits, t.jpy)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 12, padding: '14px 16px', borderRadius: 12,
                      background: t.saving ? `linear-gradient(135deg, rgba(52,211,153,0.10), rgba(52,211,153,0.03))` : 'var(--surface-3)',
                      border: `1px solid ${t.saving ? 'rgba(52,211,153,0.35)' : 'var(--border)'}`,
                      color: 'var(--fg)', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>
                        +{t.credits.toLocaleString()} クレジット
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 3 }}>
                        1 クレジットあたり ¥{t.perCredit.toFixed(1)}
                        {t.saving && <span style={{ color: '#34D399', marginLeft: 6, fontWeight: 700 }}>{t.saving}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, fontFamily: '"SF Mono", monospace' }}>
                        ¥{t.jpy.toLocaleString()}
                      </span>
                      <ArrowRight size={16} style={{ opacity: 0.4 }} />
                    </div>
                  </button>
                ))}
                <p style={{ fontSize: 10.5, color: 'var(--fg-muted)', textAlign: 'center', marginTop: 4 }}>
                  今月のクレジットに追加されます。翌月への繰越あり。
                </p>
              </div>
            )}

            {/* プラン切替タブ */}
            {tab === 'plan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(Object.values(PLANS) as Array<typeof PLANS[Exclude<PlanId, 'master'>]>).map(p => {
                  const isCurrent = p.id === view.planId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !isCurrent && handleSwitchPlan(p.id as Exclude<PlanId, 'master'>)}
                      disabled={isCurrent}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 6,
                        padding: '14px 16px', borderRadius: 12,
                        background: isCurrent ? 'rgba(142,92,255,0.10)' : 'var(--surface-3)',
                        border: `1px solid ${isCurrent ? 'rgba(142,92,255,0.4)' : 'var(--border)'}`,
                        color: 'var(--fg)', cursor: isCurrent ? 'default' : 'pointer',
                        textAlign: 'left', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                        <div>
                          <span style={{ fontSize: 18, marginRight: 6 }}>{p.emoji}</span>
                          <strong style={{ fontSize: 15, fontWeight: 800 }}>{p.name}</strong>
                          <span style={{ fontSize: 11, color: 'var(--fg-muted)', marginLeft: 8 }}>{p.tagline}</span>
                        </div>
                        <span style={{ fontSize: 17, fontWeight: 800, fontFamily: '"SF Mono", monospace' }}>
                          ¥{p.jpy.toLocaleString()}<span style={{ fontSize: 11, opacity: 0.6 }}>/月</span>
                        </span>
                      </div>
                      <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {p.perks.map((perk, i) => (
                          <li key={i} style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Check size={11} color={isCurrent ? '#8E5CFF' : 'var(--fg-muted)'} /> {perk}
                          </li>
                        ))}
                      </ul>
                      {isCurrent && (
                        <div style={{ fontSize: 10.5, color: '#8E5CFF', fontWeight: 700, marginTop: 2 }}>
                          ✓ 現在のプラン
                        </div>
                      )}
                    </button>
                  );
                })}
                <p style={{ fontSize: 10.5, color: 'var(--fg-muted)', textAlign: 'center', marginTop: 4 }}>
                  6/1 リリース記念: 先着 100 名 ¥4,980/月 × 3 ヶ月のベータ価格あり
                </p>
              </div>
            )}

            {/* 完了トースト */}
            <AnimatePresence>
              {thanks && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    marginTop: 14, padding: '10px 14px', borderRadius: 10,
                    background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.4)',
                    color: '#34D399', fontSize: 12.5, fontWeight: 700, textAlign: 'center',
                  }}
                >
                  {thanks}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 10px', borderRadius: 8,
    background: active ? 'var(--bg, #12121E)' : 'transparent',
    color: active ? 'var(--fg)' : 'var(--fg-muted)',
    border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
  };
}
