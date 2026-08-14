// ============================================================
// CreditModal — プラン変更 + クレジット買い足しの単一モーダル
//
// オーナー指示 (2026-05-28): 上限超え → 買い足し、プラン切替もここから。
//
// ★2026-08-14 修正: ここには「お金を払わずに有料プランになれる」経路が 2 つ開いていた。
//   ① handleSwitchPlan が setPlanId() だけでプランを切り替えていた (Stripe を通らない)
//   ② handleTopUp が applyTopUp() で無料でクレジットを付与し、
//      「✓ 1,000 クレジット追加しました (¥2,000)」と金額つきで成功を出していた
//      → お客様は課金されたと思う。実際には 1 円も請求していない。
//   どちらも「決済を通ってから権利が付く」形に直した。値段は実際に請求する
//   billing.ts (PRISM_PLANS / IRIS_PLANS) を正本として表示する。
//   クレジット買い足しは Stripe に単発商品がまだ無いため、買えるふりをやめた。
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, ArrowRight, Zap, Mail } from 'lucide-react';
import {
  PLANS, getCredits,
  type CreditView, type PlanId,
} from '../lib/credits';
import {
  getPlans, useBillingUser, updateSubscriptionPlan,
  IRIS_PLANS, PRISM_PLANS,
  type Brand, type PlanId as BillingPlanId,
} from '../lib/billing';

/** クレジット体系のプラン → 実際に請求する billing.ts のプラン */
const BILLING_PLAN_OF: Record<Exclude<PlanId, 'master'>, BillingPlanId> = {
  light: 'lite',
  standard: 'standard',
  pro: 'pro',
  team: 'studio',
};

const SUPPORT_MAIL = 'core.inc.guild@gmail.com';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 初期タブ: 'topup' (上限超え時) or 'plan' (普段) */
  initialTab?: 'topup' | 'plan';
  /** 請求に使うブランド (既定: prism) */
  brand?: Brand;
}

export default function CreditModal({ open, onClose, initialTab = 'topup', brand = 'prism' }: Props) {
  const [tab, setTab] = useState<'topup' | 'plan'>(initialTab);
  const [view, setView] = useState<CreditView>(() => getCredits());
  const [thanks, setThanks] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  /** 契約中のお客様に、日割り請求が発生することを伝えて確認を取る対象 */
  const [confirmPlan, setConfirmPlan] = useState<PlanId | null>(null);
  const { user } = useBillingUser();

  // v2 が有効だと getPlans() は v2-btoC-* 等の別 ID を返し、v1 の ID (lite/standard/...) では
  // 1 件も引けない。そのまま「値段が引けないプランは出さない」に通すと、プラン変更タブが
  // 丸ごと空になり、クレジットが足りないお客様が上のプランに移れなくなる (2026-08-14 Codex 指摘)。
  // → v1 の一覧も必ず併せて見る。
  const v1Plans = brand === 'iris' ? IRIS_PLANS : PRISM_PLANS;
  const billingPlans = [...getPlans(brand), ...v1Plans];
  /** 実際に請求する金額 (画面の値段と請求額をずらさないため billing.ts を正本にする) */
  const priceOf = (id: Exclude<PlanId, 'master'>): number | null =>
    billingPlans.find(p => p.id === BILLING_PLAN_OF[id])?.priceJpy ?? null;

  const handleSwitchPlan = async (id: Exclude<PlanId, 'master'>) => {
    setError(null);
    setThanks(null);

    // ★契約中のお客様は、押した瞬間に Stripe のサブスクが書き換わり、
    //   差額が日割りで即時請求される (api/stripe/update.ts が create_prorations)。
    //   画面に出ているのは月額だけで、いま引かれる額とは違う。
    //   金額が動く操作を確認なしで走らせない。
    if (user?.subscriptionId && confirmPlan !== id) {
      setConfirmPlan(id);
      return;
    }
    setConfirmPlan(null);

    setBusyPlan(id);
    const billingPlan = BILLING_PLAN_OF[id];
    try {
      // すでに支払い中のお客様 → 既存サブスクの price を差し替える
      if (user?.subscriptionId) {
        const r = await updateSubscriptionPlan({ subscriptionId: user.subscriptionId, brand, plan: billingPlan });
        if (!r.ok) { setError(r.message); return; }
        setView(getCredits());
        setThanks(`✓ ${PLANS[id].name} プランに変更しました`);
        setTimeout(() => setThanks(null), 2400);
        return;
      }

      // まだ支払っていないお客様 → Stripe の決済画面へ。戻ってきた /billing/success が
      // session_id を照会して、実際に支払われたプランだけを有効にする。
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billingPlan, brand, cycle: 'monthly', email: user?.email }),
      });
      if (resp.status === 503) {
        setError(`いまオンラインでのお手続きができません。${SUPPORT_MAIL} までご連絡ください。`);
        return;
      }
      const data = await resp.json().catch(() => ({})) as { url?: string; error?: string };
      if (!resp.ok || !data.url) {
        setError(data.error || 'お手続きの画面を開けませんでした。時間をおいてお試しください。');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('通信できませんでした。電波の良いところで、もう一度お試しください。');
    } finally {
      setBusyPlan(null);
    }
  };

  const currentPlan = view.planId !== 'master' ? PLANS[view.planId as Exclude<PlanId, 'master'>] : null;
  /** 実際にお金を払っている状態か (契約の正本は billing.ts 側の user.plan) */
  const isPaying = !!user && user.plan !== 'free' && !user.isTestCheckout;

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
                  毎月のクレジットでアプリが動きます。足りなくなったら、プランを変更すると増えます。
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
                  {/* お金を払っていない人に有料プラン名を出さない。
                      クレジット枠 (credits.ts) の既定値は 'standard' だが、それは「使える量」であって
                      「契約しているプラン」ではない。契約の正本は billing.ts の user.plan。 */}
                  {isPaying
                    ? <>いま <strong style={{ color: 'var(--fg)' }}>{currentPlan.emoji} {currentPlan.name}</strong> プラン</>
                    : <>いま <strong style={{ color: 'var(--fg)' }}>無料でお試し中</strong></>}
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

            {/* 買い足しタブ — 単発購入の商品が Stripe にまだ無いので「買えるふり」をしない */}
            {tab === 'topup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  padding: '16px', borderRadius: 12,
                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                    クレジットだけの買い足しは準備中です
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--fg-muted)', lineHeight: 1.8, margin: 0 }}>
                    いますぐ増やしたいときは、ひとつ上のプランに変更してください。
                    毎月のクレジットがその場で増えます。
                  </p>
                </div>
                <button
                  onClick={() => setTab('plan')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minHeight: 44, padding: '12px 16px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #8E5CFF, #6D3BFF)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    fontSize: 13.5, fontWeight: 800, fontFamily: 'inherit',
                  }}
                >
                  プランを見る <ArrowRight size={15} />
                </button>
                <a
                  href={`mailto:${SUPPORT_MAIL}?subject=${encodeURIComponent('クレジットの買い足しについて')}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    minHeight: 44, padding: '12px 16px', borderRadius: 12,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--fg-muted)', textDecoration: 'none',
                    fontSize: 12.5, fontWeight: 700,
                  }}
                >
                  <Mail size={14} /> 買い足しについて相談する
                </a>
              </div>
            )}

            {/* プラン切替タブ */}
            {tab === 'plan' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(Object.values(PLANS) as Array<typeof PLANS[Exclude<PlanId, 'master'>]>).map(p => {
                  // 「現在のプラン」は払っている人にだけ付ける。credits.ts の既定値 'standard' で
                  // 判定すると、1 円も払っていない人にスタンダードが「契約中」に見え、そのうえ
                  // 押せなくなる (= 一番売れるプランを買えなくする) ので、契約の正本で見る。
                  const isCurrent = isPaying && user?.plan === BILLING_PLAN_OF[p.id as Exclude<PlanId, 'master'>];
                  const jpy = priceOf(p.id as Exclude<PlanId, 'master'>);
                  const isBusy = busyPlan === p.id;
                  // 請求できる値段が引けないプランはボタンを出さない (押しても買えない選択肢を見せない)
                  if (jpy === null) return null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !isCurrent && !busyPlan && handleSwitchPlan(p.id as Exclude<PlanId, 'master'>)}
                      disabled={isCurrent || busyPlan !== null}
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
                          ¥{jpy.toLocaleString()}<span style={{ fontSize: 11, opacity: 0.6 }}>/月</span>
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
                      {isBusy && (
                        <div style={{ fontSize: 10.5, color: 'var(--fg-muted)', fontWeight: 700, marginTop: 2 }}>
                          {isPaying ? 'プランを変更しています…' : 'お支払いの画面をひらいています…'}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* 契約中のお客様への確認 — お金が動くことを先に伝える */}
                {confirmPlan && (
                  <div style={{
                    padding: '14px 16px', borderRadius: 12,
                    background: '#FFFBEB', border: '1px solid #FCD34D', color: '#78350F',
                  }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>
                      {PLANS[confirmPlan as Exclude<PlanId, 'master'>].name} プランに変更します
                    </div>
                    <p style={{ fontSize: 12, lineHeight: 1.8, margin: '0 0 10px' }}>
                      次回から毎月 ¥{(priceOf(confirmPlan as Exclude<PlanId, 'master'>) ?? 0).toLocaleString()} になります。
                      いま契約している分との<strong>差額は日割りで計算され、今回の請求に加わります</strong>。
                      そのため、いますぐ引き落とされる金額はこの月額とは異なります。
                      正確な金額は Stripe からの領収書でご確認ください。
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleSwitchPlan(confirmPlan as Exclude<PlanId, 'master'>)}
                        disabled={busyPlan !== null}
                        style={{
                          flex: 1, minWidth: 140, minHeight: 44, borderRadius: 10, border: 'none',
                          background: '#78350F', color: '#fff', fontWeight: 800, fontSize: 13,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        了解しました。変更する
                      </button>
                      <button
                        onClick={() => setConfirmPlan(null)}
                        style={{
                          minWidth: 100, minHeight: 44, borderRadius: 10,
                          background: 'transparent', border: '1px solid #D6A756', color: '#78350F',
                          fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        やめる
                      </button>
                    </div>
                  </div>
                )}

                <p style={{ fontSize: 10.5, color: 'var(--fg-muted)', textAlign: 'center', marginTop: 4, lineHeight: 1.7 }}>
                  {isPaying
                    ? '変更するとその場で切り替わり、差額は日割りで請求されます。'
                    : '選ぶと、お支払いの画面（Stripe）へ進みます。お支払いが終わってからプランが切り替わります。'}
                </p>
              </div>
            )}

            {/* 失敗の説明 — 自分で面と文字色を持つ (親の明暗に左右されない) */}
            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 14, padding: '10px 14px', borderRadius: 10,
                  background: '#FEF2F2', border: '1px solid #FCA5A5',
                  color: '#991B1B', fontSize: 12.5, fontWeight: 700, lineHeight: 1.7,
                }}
              >
                {error}
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
