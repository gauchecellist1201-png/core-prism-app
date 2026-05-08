// ============================================================
// CORE Iris — エントリーポイント (LP / Checkout / Dashboard 切替)
// ============================================================
import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useSettings } from '../hooks/useSettings';
import IrisLanding from './IrisLanding';
import IrisDashboard from './IrisDashboard';
import CheckoutModal from '../components/CheckoutModal';
import { useBillingUser, IRIS_PLANS, isAuthorized as isAuthorizedFn, isMasterAuth, type Plan } from '../lib/billing';

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
  const { user } = useBillingUser();
  const [entered, setEntered] = useState(() => hasEntered());
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  // タイトル + theme-color を Iris に
  useEffect(() => {
    document.title = 'CORE Iris — すべてのインフルエンサーに、エージェントAIを。';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#E1306C');
  }, []);

  // 既存ユーザーがいる場合、自動でアプリへ
  useEffect(() => {
    if (user && !entered) {
      markEntered();
      setEntered(true);
    }
  }, [user, entered]);

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

  if (!entered) {
    return (
      <>
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
  return <IrisDashboard settings={settings} onLeave={() => setEntered(false)} />;
}
