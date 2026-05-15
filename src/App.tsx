import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import './index.css';

import { usePersonas } from './hooks/usePersonas';
import { useKnowledge } from './hooks/useKnowledge';
import { useSettings } from './hooks/useSettings';
import { useClaude } from './hooks/useClaude';
import { useHealth } from './hooks/useHealth';
import { detectAnomalies } from './data/healthAnomaly';
import { useMemo } from 'react';

import OnboardingFlow from './components/OnboardingFlow';
import IdentitySelection from './components/IdentitySelection';
import IdentityDashboard from './components/IdentityDashboard';
import PersonaCreator from './components/PersonaCreator';
import SettingsModal from './components/SettingsModal';
import LandingPage from './components/LandingPage';
import MasterEntry from './components/MasterEntry';
import AiStats from './master/AiStats';
import StripeStatusPage from './components/StripeStatusPage';
import CheckoutModal from './components/CheckoutModal';
import LegalModal, { type LegalKind } from './components/LegalModal';
import CoreSite from './corporate/CoreSite';
import StrategyDashboard from './corporate/StrategyDashboard';
import PricingPage from './corporate/PricingPage';
import { useBillingUser, PRISM_PLANS, isAuthorized as isAuthorizedFn, isMasterAuth, syncSubscriptionState, type Plan } from './lib/billing';
import { PrismBackground } from './components/PrismBackground';
import { useTheme } from './hooks/useTheme';
import IrisApp from './iris/IrisApp';
import BillingSuccess from './components/BillingSuccess';
import KeynoteLanding from './keynote/KeynoteLanding';
import PrismTaskScheduler from './prism/PrismTaskScheduler';
import PrismSplash from './prism/PrismWelcome';
import TutorialOverlay from './components/TutorialOverlay';
import WowOnboarding from './components/WowOnboarding';

import type { AppSettings, ChatMessage } from './types/identity';

type View = 'landing' | 'onboarding' | 'selection' | 'dashboard';

const APP_ENTERED_KEY = 'core_app_entered_v1';

/**
 * アプリへ入る権限チェック (ゲート)
 * - マスターモード (GAUCHE2026) → OK
 * - signup 済み + (有料プラン or トライアル有効) → OK
 * - それ以外 → LP のみ
 */
function hasEnteredApp(): boolean {
  if (typeof window === 'undefined') return false;
  // /master 経由のオーナー (Claude API キー有り) は無制限
  if (isMasterAuth()) return true;
  // billing user の有無 + プラン有効性をチェック
  return isAuthorizedFn();
}

function markAppEntered() {
  localStorage.setItem(APP_ENTERED_KEY, 'true');
}

function getInitialView(onboardingComplete: boolean): View {
  if (!hasEnteredApp()) return 'landing';
  return onboardingComplete ? 'selection' : 'onboarding';
}

function isIrisPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  if (p.startsWith('/iris')) return true;
  if (window.location.search.includes('brand=iris')) return true;
  return false;
}

function isMasterPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master' || p.startsWith('/master/');
}

function isStripeStatusPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/stripe-status' || p === '/stripe-status';
}

function isAiStatsPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/ai-stats' || p === '/ai-stats';
}

function isCorpPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/corp' || p.startsWith('/corp/') || p === '/company' || p.startsWith('/company/');
}

function isStrategyPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p.startsWith('/strategy') || p.startsWith('/master/strategy');
}

function isPricingPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith('/pricing');
}

function isBillingSuccessPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/billing/success';
}

function isKeynotePath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/keynote' || p.startsWith('/keynote/');
}

export default function App() {
  // /keynote — 講演会限定 先行案内 LP
  if (isKeynotePath()) {
    return <KeynoteLanding />;
  }

  // /strategy — オーナー専用 戦略ダッシュボード
  if (isStrategyPath()) {
    return <StrategyDashboard />;
  }

  // /pricing — 公開価格ページ + ROI 計算機
  if (isPricingPath()) {
    return <PricingPage />;
  }

  // /corp — 株式会社コア (CORE Inc.) 法人 LP
  if (isCorpPath()) {
    return <CoreSite />;
  }

  // /master/stripe-status — オーナー専用 Stripe 接続診断
  if (isStripeStatusPath()) {
    return <StripeStatusPage />;
  }

  // /master/ai-stats — オーナー専用 AI 使用量ダッシュボード
  if (isAiStatsPath()) {
    return <AiStats />;
  }

  // /master — オーナー専用フル機能解放画面
  if (isMasterPath()) {
    return <MasterEntry />;
  }

  // /billing/success — Stripe 決済完了ページ
  if (isBillingSuccessPath()) {
    return <BillingSuccess />;
  }

  // CORE Iris (姉妹ブランド) ルート — /iris で別ブランドを起動
  if (isIrisPath()) {
    return <IrisApp />;
  }

  // Theme初期化 (ライト既定)
  useTheme();
  const { settings, updateSettings, updateUsageStats, resetStats } = useSettings();
  const { personas, activePersona, createPersona, updatePersona, selectPersona, toggleTask, addTask, updateCashflow } = usePersonas();
  const { items: knowledgeItems, getForPersona, addFromFile, addNote, deleteItem, reanalyze, recomputeCashflow } = useKnowledge(
    settings,
    useCallback(() => activePersona, [activePersona]),
    updateCashflow,
  );
  const health = useHealth();
  const healthAnomalies = useMemo(() => detectAnomalies(health.days), [health.days]);
  const healthCtx = useMemo(() => ({
    today: health.today ?? null,
    week: health.week,
    anomalies: healthAnomalies,
  }), [health.today, health.week, healthAnomalies]);

  const handleAcceptAction = useCallback((action: string) => {
    if (!activePersona) return;
    addTask(activePersona.id, {
      title: action,
      priority: 'mid',
      due: '今日',
      done: false,
    });
  }, [activePersona, addTask]);
  const { sendMessage, isLoading: isChatLoading, error: chatError } = useClaude(settings, updateUsageStats);

  const [view, setView] = useState<View>(() => getInitialView(settings.onboardingComplete));
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showPersonaCreator, setShowPersonaCreator] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const [tutorialDoneTick, setTutorialDoneTick] = useState(0);

  // 課金フロー: 未 signup なら Checkout モーダルで signup → 入場
  const { user: billingUser } = useBillingUser();
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);

  // 起動時に Stripe / webhook と localStorage を同期 (subscriptionId がある場合のみ)
  useEffect(() => {
    if (!billingUser?.subscriptionId) return;
    syncSubscriptionState().catch(() => { /* silent */ });
    // 別タブから戻ってきたとき (visibilitychange) も同期
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        syncSubscriptionState().catch(() => { /* */ });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [billingUser?.subscriptionId]);

  const handleEnterApp = useCallback(() => {
    if (hasEnteredApp()) {
      markAppEntered();
      setView(settings.onboardingComplete ? 'selection' : 'onboarding');
    } else {
      // 未認証: 14 日無料トライアルプランで Checkout を起動
      const trial = PRISM_PLANS.find(p => p.id === 'free') || PRISM_PLANS[0];
      setCheckoutPlan(trial);
    }
  }, [settings.onboardingComplete]);

  const handleCheckoutSuccess = useCallback(() => {
    markAppEntered();
    setCheckoutPlan(null);
    setView(settings.onboardingComplete ? 'selection' : 'onboarding');
  }, [settings.onboardingComplete]);

  // 既存ユーザーが signup 完了でアプリ表示状態に同期
  useMemo(() => {
    if (billingUser && view === 'landing') {
      markAppEntered();
      setView(settings.onboardingComplete ? 'selection' : 'onboarding');
    }
  }, [billingUser, view, settings.onboardingComplete]);

  const handleOnboardingComplete = useCallback((s: Partial<AppSettings>) => {
    updateSettings(s);
    setView('selection');
  }, [updateSettings]);

  const handleSelectPersona = useCallback(async (id: string) => {
    setIsTransitioning(true);
    await new Promise(r => setTimeout(r, 600));
    selectPersona(id);
    setChatMessages([]);
    setView('dashboard');
    await new Promise(r => setTimeout(r, 200));
    setIsTransitioning(false);
  }, [selectPersona]);

  const handleSwitchPersona = useCallback(async (id: string) => {
    if (id === activePersona?.id) return;
    setIsTransitioning(true);
    await new Promise(r => setTimeout(r, 500));
    selectPersona(id);
    setChatMessages([]);
    await new Promise(r => setTimeout(r, 150));
    setIsTransitioning(false);
  }, [selectPersona, activePersona]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!activePersona) return;

    const personaKnowledge = getForPersona(activePersona.id);
    // RAG検索
    const relevantChunks = personaKnowledge.length > 0
      ? personaKnowledge
          .flatMap(item => item.chunks.map(chunk => ({
            ...chunk,
            score: message.toLowerCase().split(/\s+/).filter(w => w.length > 1)
              .reduce((s, w) => s + (chunk.content.toLowerCase().includes(w) ? 1 : 0), 0),
          })))
          .filter(c => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
      : [];

    const userMsg: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages(prev => [...prev, userMsg]);

    const reply = await sendMessage(activePersona, message, chatMessages, relevantChunks);
    if (reply) {
      setChatMessages(prev => [...prev, reply]);
    }
  }, [activePersona, chatMessages, sendMessage, getForPersona]);

  const handleCreatePersona = useCallback((
    name: string, subtitle: string, icon: string,
    description: string, accentColor: string, accentColorLight: string
  ) => {
    if (editingPersonaId) {
      updatePersona(editingPersonaId, { name, subtitle, icon, description, accentColor, accentColorLight });
      setEditingPersonaId(null);
    } else {
      createPersona(name, subtitle, icon, description, accentColor, accentColorLight);
    }
    setShowPersonaCreator(false);
  }, [createPersona, updatePersona, editingPersonaId]);

  const handleAddKnowledgeFile = useCallback(async (file: File) => {
    if (!activePersona) throw new Error('No active persona');
    return addFromFile(activePersona.id, file);
  }, [activePersona, addFromFile]);

  const handleAddKnowledgeNote = useCallback((title: string, content: string) => {
    if (!activePersona) throw new Error('No active persona');
    return addNote(activePersona.id, title, content);
  }, [activePersona, addNote]);

  return (
    <>
      {/* LP では背景アニメを描画しない (iPhone Safari でスクロール固まる対策) */}
      {view !== 'landing' && <PrismBackground intensity="low" />}
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <LandingPage
            key="landing"
            onEnterApp={handleEnterApp}
            onOpenLegal={(k) => setLegalKind(k)}
          />
        )}

        {checkoutPlan && (
          <CheckoutModal
            key="prism-checkout"
            brand="prism"
            plan={checkoutPlan}
            onClose={() => setCheckoutPlan(null)}
            onSuccess={handleCheckoutSuccess}
          />
        )}

        {view === 'onboarding' && (
          <OnboardingFlow key="onboarding" onComplete={handleOnboardingComplete} />
        )}

        {view === 'selection' && (
          <IdentitySelection
            key="selection"
            personas={personas}
            userName={settings.userName}
            onSelect={handleSelectPersona}
            onCreatePersona={() => setShowPersonaCreator(true)}
          />
        )}

        {view === 'dashboard' && activePersona && (
          <IdentityDashboard
            key="dashboard"
            persona={activePersona}
            allPersonas={personas}
            isTransitioning={isTransitioning}
            chatMessages={chatMessages}
            isChatLoading={isChatLoading}
            chatError={chatError}
            settings={settings}
            knowledgeItems={knowledgeItems}
            onSwitch={handleSwitchPersona}
            onSendMessage={handleSendMessage}
            onBackToSelection={() => { setView('selection'); setChatMessages([]); }}
            onOpenSettings={() => setShowSettings(true)}
            onCreatePersona={() => setShowPersonaCreator(true)}
            onAddKnowledgeFile={handleAddKnowledgeFile}
            onAddKnowledgeNote={handleAddKnowledgeNote}
            onDeleteKnowledge={deleteItem}
            onReanalyzeKnowledge={reanalyze}
            onToggleTask={toggleTask}
            onAcceptProactiveAction={handleAcceptAction}
            onUpdateCashflow={updateCashflow}
            onRecomputeCashflow={recomputeCashflow}
            knowledgeForAgent={knowledgeItems}
            healthCtx={healthCtx}
          />
        )}
      </AnimatePresence>

      {/* Global overlays */}
      <AnimatePresence>
        {showPersonaCreator && (
          <PersonaCreator
            key="creator"
            existingPersonas={personas}
            editing={editingPersonaId ? personas.find(p => p.id === editingPersonaId) : undefined}
            onSave={handleCreatePersona}
            onCancel={() => { setShowPersonaCreator(false); setEditingPersonaId(null); }}
          />
        )}
        {showSettings && (
          <SettingsModal
            key="settings"
            settings={settings}
            personas={personas}
            onEditPersona={(id) => { setEditingPersonaId(id); setShowPersonaCreator(true); setShowSettings(false); }}
            onSave={updateSettings}
            onClose={() => setShowSettings(false)}
            onResetStats={resetStats}
          />
        )}
        {legalKind && (
          <LegalModal
            key={`legal-${legalKind}`}
            kind={legalKind}
            onClose={() => setLegalKind(null)}
          />
        )}
      </AnimatePresence>
      {/* Prism: 音声タスク予約 (FAB + モーダル + バックグラウンド自動実行) */}
      <PrismTaskScheduler />
      {/* Prism: シネマティック スプラッシュ (初回セッションのみ) */}
      <PrismSplash personaName={activePersona?.name} />
      {/* Prism: チュートリアル (初回起動のみ表示、スキップ可) */}
      <TutorialOverlay brand="prism" onClose={() => setTutorialDoneTick(t => t + 1)} />
      {/* Prism: 3 分で「Wow」体験 (初回チュートリアル後のみ表示) */}
      <WowOnboarding brand="prism" trigger={tutorialDoneTick} />
    </>
  );
}
