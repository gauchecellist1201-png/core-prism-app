// ============================================================
// BillingDashboard — 請求情報モーダル
// 現在のプラン / 次回更新日 / 解約ボタン
// ============================================================
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useBillingUser, findPlan, getPlans,
  updateSubscriptionPlan, openBillingPortal,
  signOutAndExit, isTrialActive,
  type PlanId,
} from '../lib/billing';
import { sendEmail } from '../lib/emailNotify';
import { confirmAction } from '../lib/confirmDialog';
import CancelFlowDialog from './CancelFlowDialog';
import { whiteSafeFace, whiteSafeGradient, contrast, hexToHsl, hslToHex } from '../lib/accentFace';
import { X, AlarmClock, AlertTriangle, Gift, LogOut } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function BillingDashboard({ onClose }: Props) {
  const { user, changePlan } = useBillingUser();
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showPlanSwitcher, setShowPlanSwitcher] = useState(false);
  const [switchBusy, setSwitchBusy] = useState<PlanId | null>(null);
  const [switchMsg, setSwitchMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState<null | 'soft' | 'reset'>(null);
  // EEE (2026-06-04): Exit Survey ダイアログ
  const [showExitSurvey, setShowExitSurvey] = useState(false);

  if (!user) return null;

  // ─── ログアウト ───
  const handleLogout = (fullReset: boolean) => {
    signOutAndExit({ fullReset });
    // LP へ戻すために強制リロード (同タブ即時反映)
    setTimeout(() => { window.location.href = '/'; }, 80);
  };

  // ─── トライアル残り日数 ───
  const trialDaysLeft = (() => {
    if (user.plan !== 'free' || !user.trialEndsAt) return null;
    const ms = new Date(user.trialEndsAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / 86400000);
  })();
  const trialExpired = user.plan === 'free' && !isTrialActive(user);

  const handleSwitchPlan = async (newPlan: PlanId) => {
    setSwitchMsg(null);
    if (newPlan === user.plan) return;
    if (!user.subscriptionId) {
      // テスト/ローカルモード: その場でプランだけ書き換え
      changePlan(newPlan);
      setSwitchMsg({ kind: 'ok', text: `${newPlan} に切り替えました (テスト)` });
      return;
    }
    if (!(await confirmAction({ title: `プランを「${newPlan}」に変更しますか?`, body: '次回の請求から新しい料金で反映されます。', okLabel: '変更する' }))) return;
    setSwitchBusy(newPlan);
    const r = await updateSubscriptionPlan({
      subscriptionId: user.subscriptionId,
      brand: user.brand,
      plan: newPlan,
    });
    setSwitchBusy(null);
    setSwitchMsg({ kind: r.ok ? 'ok' : 'err', text: r.message });
    if (r.ok) {
      changePlan(newPlan);
      setShowPlanSwitcher(false);
    }
  };

  const handleOpenPortal = async () => {
    if (!user.stripeCustomerId) {
      setSwitchMsg({ kind: 'err', text: 'カスタマー ID 未連携 — まず一度サブスクを開始してください' });
      return;
    }
    setPortalBusy(true);
    const r = await openBillingPortal(user.stripeCustomerId);
    setPortalBusy(false);
    if (r.ok && r.url) {
      window.location.href = r.url;
    } else {
      setSwitchMsg({ kind: 'err', text: r.message || 'ポータルを開けません' });
    }
  };

  const plan = findPlan(user.brand, user.plan);
  const accent = user.brand === 'iris' ? '#E1306C' : '#0033A0';
  // Iris の桃 #E1306C は白文字でも白地の文字でも 4.34 で落第する（2026-08-08 実測）。
  // 色みは変えずに明るさだけ落として 4.6 を確保した「読める側の accent」。
  // ここは解約とプラン変更の画面なので、読めないと解約できない＝いちばん壊してはいけない。
  const accentInk = whiteSafeFace(accent);
  // プランカードの地は `${accent}0d` ＝ accent を 5% だけ白に重ねた膜。
  // 純白より少し暗いので、白地で 4.61 の accentInk でもこの上では 4.31 に落ちる（実測）。
  // その膜の実際の色を出してから、そこで 4.6 を通る濃さまで落とす。
  const tintFace = (() => {
    try {
      const n = parseInt(accent.slice(1), 16);
      const a = 0x0d / 255;
      const mix = (c: number) => Math.round(c * a + 255 * (1 - a));
      return `#${[mix(n >> 16 & 255), mix(n >> 8 & 255), mix(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
    } catch { return '#FFFFFF'; }
  })();
  const accentInkOnTint = (() => {
    try {
      if (contrast(accentInk, tintFace) >= 4.6) return accentInk;
      const [h, s, l] = hexToHsl(accent);
      for (let i = l; i >= 0; i -= 0.005) {
        const c = hslToHex(h, s, i);
        if (contrast(c, tintFace) >= 4.6) return c;
      }
      return '#1F1A2E';
    } catch { return accentInk; }
  })();
  const grad = user.brand === 'iris'
    // 3 色グラデ（紫→桃→橙）は橙の側で白が 2 台まで落ちる。面の側で白を保証する
    ? whiteSafeGradient(['#833AB4', '#E1306C', '#F77737'])
    : 'linear-gradient(135deg, #0033A0, #1A4FC4)';

  // 次回更新日。currentPeriodEnd は「Unix 秒の数値」の約束だが、
  // /api/stripe/* の戻り(line 959 / 1147)は型を検査せずそのまま入れているので、
  // 文字列や ISO 日付が入り込むと `x * 1000` が NaN になり、お金を払っている人の
  // 請求画面に「Invalid Date」と出る。日付が確かめられない時は、嘘を出さずに黙る。
  const periodEnd = (() => {
    const v = user.currentPeriodEnd as unknown;
    if (v == null) return null;
    let d: Date | null = null;
    if (typeof v === 'number' && Number.isFinite(v)) d = new Date(v * 1000);
    else if (typeof v === 'string') {
      const n = Number(v);
      d = Number.isFinite(n) && v.trim() !== '' ? new Date(n * 1000) : new Date(v);
    }
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  })();

  const handleCancel = async () => {
    if (!user.subscriptionId) {
      // テストモード: ローカルでプランをフリーに戻す
      changePlan('free');
      sendEmail(user.email, 'cancel_save', { name: user.email.split('@')[0], code: 'COMEBACK50' });
      setCancelDone(true);
      return;
    }

    setCancelBusy(true);
    setCancelError(null);
    try {
      const resp = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: user.subscriptionId }),
      });
      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error || '解約処理に失敗しました');
      }
      // キャンセルセーブメール (非同期)
      sendEmail(user.email, 'cancel_save', { name: user.email.split('@')[0], code: 'COMEBACK50' });
      setCancelDone(true);
    } catch (e: any) {
      setCancelError(e.message);
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <>
    {/* EEE (2026-06-04): 解約 Exit Survey ダイアログ — 「解約する」押下時に表示 */}
    <CancelFlowDialog
      open={showExitSurvey}
      brand="prism"
      cancelBusy={cancelBusy}
      onConfirmCancel={async () => {
        setShowExitSurvey(false);
        await handleCancel();
      }}
      onClose={() => setShowExitSurvey(false)}
    />
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(15,10,25,0.7)', backdropFilter: 'blur(16px)',
        // 375x812 の実測で中身は 976px あり、中央寄せだと上下がはみ出して
        // ✕ が -45px の画面外へ行き、どこもスクロールしないので**閉じられなかった**
        // (お金を払っている人が解約画面に閉じ込められる / 2026-08-08 実測・根治)。
        // 上寄せ + 自分がスクロールする、に変える。
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain',
        padding: 'max(1rem, env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 24, padding: '2rem',
          maxWidth: 480, width: '100%',
          flexShrink: 0, margin: 'auto 0',
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#1F1A2E',
          boxShadow: '0 30px 80px rgba(15,10,25,0.4)',
        }}
      >
        {/* ヘッダ — 縦に長いので、閉じる(✕)はスクロールしても必ず手が届く位置に貼り付ける */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem',
          position: 'sticky', top: '-2rem', zIndex: 2,
          background: '#FFFFFF', padding: '2rem 0 0.75rem', margin: '-2rem 0 1.25rem',
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.3em', color: accentInk, fontWeight: 700, textTransform: 'uppercase' }}>
              {user.brand === 'iris' ? 'CORE Iris' : 'CORE Prism'} · 請求情報
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0.2rem 0 0' }}>プラン管理</h2>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%',
            width: 44, height: 44, cursor: 'pointer', fontSize: '1rem',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
          }} aria-label="閉じる"><X size={18} strokeWidth={2.4} color="#1F1A2E" /></button>
        </div>

        {/* 現在のプラン */}
        <div style={{
          padding: '1.25rem', borderRadius: 16,
          background: `${accent}0d`,
          border: `1px solid ${accent}33`,
          marginBottom: '1.25rem',
        }}>
          {/* プラン名は「3 日間 無料トライアル」のように長いものがある。375px で折り返すと
              右の「有効」バッジの下に潜って重なっていた（2026-08-08 本番実測）。
              左に minWidth:0 を、バッジに flexShrink:0 を入れて、必ず横に並べる */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.6rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.78rem', color: '#6E6979', marginBottom: '0.25rem' }}>現在のプラン</p>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: accent, overflowWrap: 'anywhere' }}>
                {plan?.name || user.plan}
              </div>
              {plan && plan.priceJpy > 0 && (
                <div style={{ fontSize: '0.88rem', color: '#5A5562', marginTop: '0.2rem' }}>
                  ¥{plan.priceJpy.toLocaleString()} / 月
                </div>
              )}
            </div>
            <span style={{
              background: grad, color: '#fff',
              padding: '0.25rem 0.7rem', borderRadius: 999,
              fontSize: '0.7rem', fontWeight: 700,
              flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              {cancelDone ? '解約予約済' : '有効'}
            </span>
          </div>

          {periodEnd && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p style={{ fontSize: '0.78rem', color: '#6E6979', marginBottom: '0.15rem' }}>
                {cancelDone ? '利用終了日' : '次回更新日'}
              </p>
              <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{periodEnd}</p>
            </div>
          )}

          {/* プランに含まれる主な機能 (やさしい日本語で 4 つだけ) */}
          {plan?.features && plan.features.length > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <p style={{ fontSize: '0.72rem', letterSpacing: '0.15em', color: '#6E6979', fontWeight: 700, marginBottom: '0.5rem' }}>
                このプランで できること
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.3rem' }}>
                {plan.features.slice(0, 4).map((f, i) => (
                  <li key={i} style={{
                    fontSize: '0.82rem', color: '#1F1A2E', display: 'flex',
                    alignItems: 'flex-start', gap: '0.45rem', lineHeight: 1.5,
                  }}>
                    <span style={{ color: accentInkOnTint, fontWeight: 800, flexShrink: 0 }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* トライアル残り日数 / 期限切れ表示 */}
        {trialDaysLeft !== null && !cancelDone && (
          <div style={{
            padding: '0.85rem 1rem', borderRadius: 12, marginBottom: '1.25rem',
            background: trialExpired
              ? 'linear-gradient(135deg, #FEF2F2, #FFE4E6)'
              : trialDaysLeft <= 2
                ? 'linear-gradient(135deg, #FFFBEB, #FEF3C7)'
                : 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
            border: `1px solid ${trialExpired ? '#FCA5A5' : trialDaysLeft <= 2 ? '#FCD34D' : '#86EFAC'}`,
            display: 'flex', alignItems: 'center', gap: '0.7rem',
          }}>
            {/* OS のカラー絵文字は使わない（端末ごとに絵が変わり、字の色も揃わない）。線画で統一 */}
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {(() => {
                const c = trialExpired ? '#9B1B30' : trialDaysLeft <= 2 ? '#92400E' : '#166534';
                const Ico = trialExpired ? AlarmClock : trialDaysLeft <= 2 ? AlertTriangle : Gift;
                return <Ico size={22} strokeWidth={2.2} color={c} />;
              })()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: '0.85rem', fontWeight: 700,
                color: trialExpired ? '#9B1B30' : trialDaysLeft <= 2 ? '#92400E' : '#166534',
              }}>
                {trialExpired
                  ? '無料お試しの期間がおわりました'
                  : trialDaysLeft === 0
                    ? '今日 無料お試しがおわります'
                    : `無料お試し あと ${trialDaysLeft} 日`}
              </p>
              <p style={{
                margin: '0.1rem 0 0', fontSize: '0.72rem',
                color: trialExpired ? '#9B1B30' : trialDaysLeft <= 2 ? '#92400E' : '#166534',
                opacity: 0.85, lineHeight: 1.45,
              }}>
                {trialExpired
                  ? 'プランを選ぶと続けて使えます。カード登録は今までしていません。'
                  : 'カード登録は不要。プラン選択で課金が始まります。'}
              </p>
            </div>
          </div>
        )}

        {/* アカウント情報 */}
        <div style={{
          padding: '1rem 1.25rem', borderRadius: 12,
          background: '#F8F7FA', border: '1px solid rgba(0,0,0,0.06)',
          marginBottom: '1.25rem',
        }}>
          <p style={{ fontSize: '0.78rem', color: '#6E6979', marginBottom: '0.3rem' }}>登録メールアドレス</p>
          <p style={{ fontFamily: 'monospace', fontSize: '0.92rem', fontWeight: 600 }}>{user.email}</p>
        </div>

        {/* プラン切替 / Stripe ポータル */}
        {!cancelDone && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
              <button
                onClick={() => { setShowPlanSwitcher(s => !s); setSwitchMsg(null); }}
                style={{
                  flex: 1, background: showPlanSwitcher ? '#1F1A2E' : accentInk, color: '#fff',
                  border: 'none', borderRadius: 999, padding: '0.7rem',
                  fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {showPlanSwitcher ? '閉じる' : 'プランを変更'}
              </button>
              <button
                onClick={handleOpenPortal}
                disabled={portalBusy || !user.stripeCustomerId}
                title={!user.stripeCustomerId ? 'サブスク開始後に利用可能' : 'Stripe で詳細管理'}
                style={{
                  flex: 1, background: '#fff', color: accentInk,
                  border: `1px solid ${accentInk}`, borderRadius: 999, padding: '0.7rem',
                  fontSize: '0.88rem', fontWeight: 700,
                  cursor: portalBusy ? 'wait' : 'pointer',
                  opacity: !user.stripeCustomerId ? 0.5 : 1,
                }}
              >
                {portalBusy ? '読み込み中…' : 'Stripe ポータル'}
              </button>
            </div>

            <AnimatePresence>
              {switchMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    padding: '0.65rem 0.9rem', borderRadius: 10, marginBottom: '0.6rem',
                    fontSize: '0.83rem',
                    background: switchMsg.kind === 'ok' ? '#F0FDF4' : '#FEF2F2',
                    border: switchMsg.kind === 'ok' ? '1px solid #86EFAC' : '1px solid #FCA5A5',
                    color: switchMsg.kind === 'ok' ? '#166534' : '#9B1B30',
                  }}
                >
                  {switchMsg.text}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showPlanSwitcher && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.3rem' }}>
                    {getPlans(user.brand)
                      .filter(p => p.id !== 'free')
                      .map(p => {
                        const isCurrent = p.id === user.plan;
                        const busy = switchBusy === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => handleSwitchPlan(p.id)}
                            disabled={isCurrent || busy}
                            style={{
                              textAlign: 'left', padding: '0.7rem 0.95rem', borderRadius: 12,
                              background: isCurrent ? `${accent}1a` : '#F8F7FA',
                              border: isCurrent ? `1px solid ${accent}` : '1px solid rgba(0,0,0,0.08)',
                              cursor: isCurrent || busy ? 'default' : 'pointer',
                              opacity: busy ? 0.6 : 1,
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isCurrent ? accent : '#1F1A2E' }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#6E6979' }}>{p.tagline}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: isCurrent ? accent : '#1F1A2E' }}>
                                ¥{p.priceJpy.toLocaleString()}
                                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#6E6979' }}>/月</span>
                              </div>
                              {isCurrent && (
                                <div style={{ fontSize: '0.65rem', color: accentInk, fontWeight: 700, letterSpacing: '0.1em' }}>現在</div>
                              )}
                              {busy && <div style={{ fontSize: '0.7rem', color: '#6E6979' }}>変更中…</div>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* 解約フロー */}
        <AnimatePresence mode="wait">
          {cancelDone ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '1rem', borderRadius: 12,
                background: '#F0FDF4', border: '1px solid #86EFAC',
                fontSize: '0.88rem', color: '#166534', lineHeight: 1.7,
              }}
            >
              ✅ 解約のお手続きが完了しました。<br />
              ご利用期間終了まで引き続きご利用いただけます。<br />
              <strong>復帰クーポン (COMEBACK50)</strong> をメールでお送りしました。
            </motion.div>
          ) : confirmCancel ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '1rem', borderRadius: 12,
                background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.2)',
                marginBottom: '0.75rem',
              }}
            >
              <p style={{ fontSize: '0.88rem', color: '#7C2D12', marginBottom: '1rem', lineHeight: 1.7 }}>
                ⚠ 本当に解約しますか？<br />
                現在の請求期間が終了するまでご利用いただけます。
              </p>
              {cancelError && (
                <p style={{ fontSize: '0.83rem', color: '#9B1B30', marginBottom: '0.75rem' }}>
                  エラー: {cancelError}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setConfirmCancel(false)}
                  style={{
                    flex: 1, background: 'rgba(0,0,0,0.05)', color: '#5A5562',
                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: 999,
                    padding: '0.65rem', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={() => setShowExitSurvey(true)}
                  disabled={cancelBusy}
                  style={{
                    flex: 1, background: '#DC2626', color: '#fff',
                    border: 'none', borderRadius: 999,
                    padding: '0.65rem', fontSize: '0.88rem', fontWeight: 700,
                    cursor: cancelBusy ? 'wait' : 'pointer',
                    opacity: cancelBusy ? 0.6 : 1,
                  }}
                >
                  {cancelBusy ? '処理中…' : '解約する'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {user.plan !== 'free' && (
                <button
                  onClick={() => setConfirmCancel(true)}
                  style={{
                    width: '100%', background: 'transparent', color: '#6E6979',
                    border: '1px solid rgba(0,0,0,0.12)', borderRadius: 999,
                    padding: '0.75rem', fontSize: '0.88rem', cursor: 'pointer',
                    transition: 'border-color 0.2s, color 0.2s',
                  }}
                >
                  サブスクリプションを解約する
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── アカウント / ログアウト ──────────────── */}
        <div style={{
          marginTop: '1.25rem', paddingTop: '1.25rem',
          borderTop: '1px solid rgba(0,0,0,0.08)',
        }}>
          <p style={{
            fontSize: '0.7rem', letterSpacing: '0.2em', color: '#6E6979',
            fontWeight: 700, marginBottom: '0.6rem', textTransform: 'uppercase',
          }}>
            アカウント
          </p>

          {confirmLogout === null ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button
                onClick={() => setConfirmLogout('soft')}
                style={{
                  width: '100%', background: '#F8F7FA', color: '#1F1A2E',
                  border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12,
                  padding: '0.75rem', fontSize: '0.88rem', fontWeight: 600,
                  cursor: 'pointer', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                aria-label="ログアウト"
              >
                <LogOut size={16} strokeWidth={2.2} /> ログアウト
              </button>
              <button
                onClick={() => setConfirmLogout('reset')}
                style={{
                  width: '100%', background: 'transparent', color: '#6E6979',
                  border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 12,
                  padding: '0.6rem', fontSize: '0.78rem', cursor: 'pointer',
                }}
                aria-label="このブラウザの全データをリセットして最初から"
              >
                このブラウザのデータをぜんぶ消して最初から
              </button>
              <p style={{
                // ここは「ログアウトしても課金は止まらない」＝お金の話。実測 2.46 で
                // いちばん読めない文字だった（読み落とすと請求が続く）ので、本文と同じ濃さに
                margin: '0.2rem 0 0', fontSize: '0.7rem', color: '#6E6979',
                lineHeight: 1.6, textAlign: 'center',
              }}>
                ※ ログアウトしてもプランや課金は止まりません。<br />
                「データをぜんぶ消す」はナレッジや人格などローカル保存もすべて消えます。
              </p>
            </div>
          ) : (
            <motion.div
              key={confirmLogout}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '1rem', borderRadius: 12,
                background: confirmLogout === 'reset' ? '#FEF2F2' : '#F8F7FA',
                border: `1px solid ${confirmLogout === 'reset' ? '#FCA5A5' : 'rgba(0,0,0,0.1)'}`,
              }}
            >
              <p style={{
                margin: 0, fontSize: '0.85rem',
                color: confirmLogout === 'reset' ? '#7C2D12' : '#1F1A2E',
                lineHeight: 1.65, marginBottom: '0.8rem',
              }}>
                {confirmLogout === 'soft'
                  ? <>ログアウトします。<br />同じメールアドレスでログインすればまた使えます。</>
                  : <><strong>⚠ このブラウザの全データを消します</strong><br />
                      ナレッジ・人格・履歴も含めて全部リセット。<br />
                      クラウドに保存されていないデータは復元できません。</>
                }
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setConfirmLogout(null)}
                  style={{
                    flex: 1, background: 'rgba(0,0,0,0.05)', color: '#5A5562',
                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: 999,
                    padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  やめる
                </button>
                <button
                  onClick={() => handleLogout(confirmLogout === 'reset')}
                  style={{
                    flex: 1,
                    background: confirmLogout === 'reset' ? '#DC2626' : '#1F1A2E',
                    color: '#fff', border: 'none', borderRadius: 999,
                    padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {confirmLogout === 'soft' ? 'ログアウトする' : 'すべて消す'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
    </>
  );
}
