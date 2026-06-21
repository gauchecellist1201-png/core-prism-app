// ============================================================
// CORE Iris — エントリーポイント (LP / Checkout / Dashboard 切替)
// ============================================================
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSettings } from '../hooks/useSettings';
import IrisLanding from './IrisLanding';
import GlobalVoiceInput from '../components/GlobalVoiceInput';
import OfflineNotice from '../components/OfflineNotice';
import ExtensionCaptureToast from '../components/ExtensionCaptureToast';
import StripeFailureBanner from '../components/StripeFailureBanner';
import InstallPwaBanner from '../components/InstallPwaBanner';
import IrisDashboard from './IrisDashboard';
import TutorialOverlay from '../components/TutorialOverlay';
import WowOnboarding from '../components/WowOnboarding';
import CheckoutModal from '../components/CheckoutModal';
import { useBillingUser, IRIS_PLANS, isAuthorized as isAuthorizedFn, isMasterAuth, isTrialExpired, syncSubscriptionState, type Plan } from '../lib/billing';
import TrialExpiredLock from '../components/TrialExpiredLock';
import IrisFirstRunTour, { shouldShowFirstRunTour } from './IrisFirstRunTour';

const ENTERED_KEY = 'core_iris_entered_v1';

/**
 * Iris にアクセスできる状態か (master or 有効な signup)
 * 友人がリンクを踏んでも、未 signup ならアプリに入れない
 */
function hasEntered(): boolean {
  if (isMasterAuth()) return true;
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
        <IrisLanding onEnter={handleEnter} onSelectPlan={handleSelectPlan} />
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
      {/* 課金失敗 (past_due / unpaid) 救済バナー — Iris ダッシュボード上部 */}
      <StripeFailureBanner brand="iris" />
      <IrisDashboard settings={settings} onLeave={() => setEntered(false)} />
      {/* Chrome 拡張機能から ?capture= で届いた取り込みのお知らせ */}
      <ExtensionCaptureToast brand="iris" />
      {/* 旧: AgentTeamMonitor / CxoWelcomeCard は Prism の「13/14 CXO 役員会議室」を
          そのまま表示し、Iris (インフルエンサー向け・6 人の専属 AI) と内容が食い違って
          混乱を生んでいたため Iris からは撤去 (2026-06-15)。Iris のエージェントは
          IrisDashboard 上部の AgentsOrbit (6 人) で表示する。 */}
      <TutorialOverlay brand="iris" onClose={() => setTutorialDoneTick(t => t + 1)} />
      <WowOnboarding brand="iris" trigger={tutorialDoneTick} />
      {/* 初回 3 ステップ Wow ツアー（解析→作戦→リール台本）。1 回だけ・純フロント */}
      {showFirstRunTour && (
        <IrisFirstRunTour
          onClose={() => setShowFirstRunTour(false)}
          onGotoReel={() => {
            setShowFirstRunTour(false);
            window.dispatchEvent(new CustomEvent('iris:goto-tab', { detail: { tab: 'reel' } }));
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
