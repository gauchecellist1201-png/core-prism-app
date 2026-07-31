// ============================================================
// CORE Iris — エントリーポイント (LP / Checkout / Dashboard 切替)
// ============================================================
import { useState, useEffect } from 'react';
import LpStickyCta from '../components/LpStickyCta';
import { AnimatePresence } from 'framer-motion';
import { useSettings } from '../hooks/useSettings';
import IrisLanding from './IrisLanding';
import GlobalVoiceInput from '../components/GlobalVoiceInput';
import OfflineNotice from '../components/OfflineNotice';
import ExtensionCaptureToast from '../components/ExtensionCaptureToast';
import StripeFailureBanner from '../components/StripeFailureBanner';
import InstallPwaBanner from '../components/InstallPwaBanner';
import IrisDashboard from './IrisDashboard';
import { CoreDock } from '../components/CoreDock';
import TutorialOverlay from '../components/TutorialOverlay';
import WowOnboarding from '../components/WowOnboarding';
import CheckoutModal from '../components/CheckoutModal';
import { useBillingUser, IRIS_PLANS, isAuthorized as isAuthorizedFn, isMasterAuth, isTrialExpired, syncSubscriptionState, type Plan } from '../lib/billing';
import TrialExpiredLock from '../components/TrialExpiredLock';
import IrisFirstRunTour, { shouldShowFirstRunTour } from './IrisFirstRunTour';
import SampleModeBanner from '../components/SampleModeBanner';
import { isDemoActive } from '../lib/onboarding';

const ENTERED_KEY = 'core_iris_entered_v1';

/**
 * Iris にアクセスできる状態か (master or 有効な signup)
 * 友人がリンクを踏んでも、未 signup ならアプリに入れない
 */
function hasEntered(): boolean {
  if (isMasterAuth()) return true;
  // 2026-07-27: 「サンプルで触ってみる (架空データで体験)」で入った人。
  //   これが無いと、LP で約束した体験の代わりに料金プランの画面が出ていた
  //   (＝押した人が約束と違うものを見る、いちばんやってはいけない壊れ方)。
  //   見えるのは架空データだけで、実データ・実連携・保存は従来どおり申し込みが要る。
  if (isDemoActive()) return true;
  return isAuthorizedFn();
}
function markEntered() {
  localStorage.setItem(ENTERED_KEY, 'true');
}

export default function IrisApp() {
  const { settings } = useSettings();
  const { user, signout } = useBillingUser();
  const trialExpired = !isMasterAuth() && isTrialExpired(user);
  const [entered, setEntered] = useState(() => {
    // ?lp=1（コーポレートサイト等から）の時は、再訪・マスターでも必ず LP を見せる
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lp') === '1') return false;
    return hasEntered();
  });
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  const [tutorialDoneTick, setTutorialDoneTick] = useState(0);
  // 初回 3 ステップの Wow ツアー（入室後に 1 回だけ）
  const [showFirstRunTour, setShowFirstRunTour] = useState(false);

  // タイトル + theme-color を Iris に
  useEffect(() => {
    document.title = 'CORE Iris — すべてのインフルエンサーに、エージェントAIを。';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#E1306C');
  }, []);

  // 下部固定要素 (AgentTeamMonitor / AI オーブ FAB / PWA バナー) を
  // モバイルの bottom-dock と重ねないため、ダッシュボード表示中だけ
  // body に印を付ける (CSS 側で ≤640px のときに dock の上へ逃がす)
  useEffect(() => {
    if (!entered) return;
    document.body.setAttribute('data-iris-dock', 'on');
    return () => { document.body.removeAttribute('data-iris-dock'); };
  }, [entered]);

  // 既存ユーザーがいる場合、自動でアプリへ
  useEffect(() => {
    if (user && !entered) {
      markEntered();
      setEntered(true);
    }
  }, [user, entered]);

  // 入室したら、初回 1 回だけ「3 ステップ Wow ツアー」を出す。
  // チュートリアル等の重なりを避けるため、少しだけ遅らせて表示。
  useEffect(() => {
    if (!entered) return;
    if (!shouldShowFirstRunTour()) return;
    // LPヒーロー「自分のDMでやってみる」経由(値'1'→取込モーダルが消費して'2')は、
    // 約束したDMスクショ取込の上にツアーを被せない。ツアーは次回訪問時に回す
    try { if (sessionStorage.getItem('iris_intent_dm_capture')) return; } catch { /* */ }
    const id = window.setTimeout(() => setShowFirstRunTour(true), 700);
    return () => window.clearTimeout(id);
  }, [entered]);

  // 起動時に Stripe / webhook と localStorage を同期 (subscriptionId があれば)
  useEffect(() => {
    if (!user?.subscriptionId) return;
    syncSubscriptionState().catch(() => { /* */ });
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        syncSubscriptionState().catch(() => { /* */ });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [user?.subscriptionId]);

  const handleEnter = () => {
    // ユーザーがすでにいるなら直接ダッシュボードへ
    if (user) {
      markEntered();
      setEntered(true);
      return;
    }
    // いなければ「はじめる」 → 14 日無料トライアルプランで Checkout 起動
    const trial = IRIS_PLANS.find(p => p.id === 'free');
    if (trial) setCheckoutPlan(trial);
  };

  const handleSelectPlan = (planId: string) => {
    const plan = IRIS_PLANS.find(p => p.id === planId);
    if (plan) setCheckoutPlan(plan);
  };

  // 機能ロックの「アップグレード」CTA から開く (例: 企画・台本スタジオ = Pro 限定)
  useEffect(() => {
    const onOpenPlan = (e: Event) => {
      const id = (e as CustomEvent).detail?.planId || 'pro';
      const plan = IRIS_PLANS.find(p => p.id === id) || IRIS_PLANS.find(p => p.id === 'pro');
      if (plan) setCheckoutPlan(plan);
    };
    window.addEventListener('iris:open-plan', onOpenPlan as EventListener);
    return () => window.removeEventListener('iris:open-plan', onOpenPlan as EventListener);
  }, []);

  if (!entered) {
    return (
      <>
        <OfflineNotice />
        <>
          <IrisLanding onEnter={handleEnter} onSelectPlan={handleSelectPlan} />
          <LpStickyCta title="Irisを3日間、完全無料で" sub="クレカ不要・解約は1タップ" cta="無料で始める →" onClick={handleEnter} accent1="#E1306C" accent2="#833AB4" ctaColor="#fff" />
        </>
        <AnimatePresence>
          {checkoutPlan && (
            <CheckoutModal
              brand="iris"
              plan={checkoutPlan}
              onClose={() => setCheckoutPlan(null)}
              onSuccess={() => { markEntered(); setEntered(true); }}
            />
          )}
        </AnimatePresence>
      </>
    );
  }
  return (
    <>
      <OfflineNotice />
      {/* サンプルで入った人に「これは架空データ」と常に見せる (数字を本物と誤解させない) */}
      <SampleModeBanner />
      {/* 課金失敗 (past_due / unpaid) 救済バナー — Iris ダッシュボード上部 */}
      <StripeFailureBanner brand="iris" />
      <IrisDashboard settings={settings} onLeave={() => setEntered(false)} />
      {/* CORE 共通ドック（current=iris）。アプリに入ったあとだけ出す。
          Iris は下部ナビ Dock(64px) + リールのチャット編集バー(≈56px) が最下段に並ぶため、
          オーブがそれらに乗り上げないよう下端から 150px 持ち上げてクランプする。
          zIndex=50: 全機能シート(z=60)などのモーダルの上に浮いてボタンを塞がないよう、
          シートより下・常駐FAB(z=40)より上に置く (2026-07-22 機械巡回で検出) */}
      <CoreDock current="iris" bottomClearance={150} zIndex={50} />
      {/* Chrome 拡張機能から ?capture= で届いた取り込みのお知らせ */}
      <ExtensionCaptureToast brand="iris" />
      {/* 旧: AgentTeamMonitor / CxoWelcomeCard は Prism の「13/14 CXO 役員会議室」を
          そのまま表示し、Iris (インフルエンサー向け・6 人の専属 AI) と内容が食い違って
          混乱を生んでいたため Iris からは撤去 (2026-06-15)。Iris のエージェントは
          IrisDashboard 上部の AgentsOrbit (6 人) で表示する。 */}
      {/* オンボ一本化: 体験型FirstRunTourが未消化の間は文字ガイドを出さない(二重ウィザード防止)。
          ツアー完了時に tutorial_seen も付くので、以後も自動では出ない(手動force起動は従来どおり) */}
      {!shouldShowFirstRunTour() && (
        <TutorialOverlay brand="iris" onClose={() => setTutorialDoneTick(t => t + 1)} />
      )}
      <WowOnboarding brand="iris" trigger={tutorialDoneTick} />
      {/* 初回 3 ステップ Wow ツアー（解析→作戦→リール台本）。1 回だけ・純フロント */}
      {showFirstRunTour && (
        <IrisFirstRunTour
          onClose={() => setShowFirstRunTour(false)}
          onGotoReel={(theme) => {
            setShowFirstRunTour(false);
            window.dispatchEvent(new CustomEvent('iris:goto-tab', { detail: { tab: 'reel', theme } }));
          }}
        />
      )}
      {/* どの入力欄でも音声入力できる */}
      <GlobalVoiceInput />
      {/* PWA インストール導線 — Android/Chrome prompt + iOS Safari ガイド */}
      <InstallPwaBanner brand="iris" />

      {/* 無料体験 終了 → 画面ロック（課金で続きから使える） */}
      {trialExpired && !checkoutPlan && (
        <TrialExpiredLock
          brand="iris"
          accent="#E1306C"
          onChoose={(p) => setCheckoutPlan(p)}
          onSignout={signout}
        />
      )}
      {checkoutPlan && (
        <CheckoutModal
          brand="iris"
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => { markEntered(); setEntered(true); }}
        />
      )}
    </>
  );
}
