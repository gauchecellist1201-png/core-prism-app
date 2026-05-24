import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import './index.css';

import { usePersonas } from './hooks/usePersonas';
import { useKnowledge } from './hooks/useKnowledge';
import { useSettings } from './hooks/useSettings';
import { useClaude, selectRelevantKnowledge } from './hooks/useClaude';
import { useHealth } from './hooks/useHealth';
import { detectAnomalies } from './data/healthAnomaly';
import { useMemo } from 'react';

import OnboardingFlow from './components/OnboardingFlow';
import IdentitySelection from './components/IdentitySelection';
import IdentityDashboard from './components/IdentityDashboard';
import PersonaCreator from './components/PersonaCreator';
import SettingsModal from './components/SettingsModal';
import LandingPage from './components/LandingPage';
import CheckoutModal from './components/CheckoutModal';
import LegalModal, { type LegalKind } from './components/LegalModal';
// 重い「別ルート専用」のページは React.lazy で main から切り出す。
// (Prism ダッシュボードを開く一般ユーザーには、これらを読み込ませない)
const MasterEntry = lazy(() => import('./components/MasterEntry'));
const AiStats = lazy(() => import('./master/AiStats'));
const StripeStatusPage = lazy(() => import('./components/StripeStatusPage'));
const PrivacyPolicy = lazy(() => import('./legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./legal/TermsOfService'));
const CoreSite = lazy(() => import('./corporate/CoreSite'));
const StrategyDashboard = lazy(() => import('./corporate/StrategyDashboard'));
const PricingPage = lazy(() => import('./corporate/PricingPage'));
const IrisApp = lazy(() => import('./iris/IrisApp'));
const BillingSuccess = lazy(() => import('./components/BillingSuccess'));
const KeynoteLanding = lazy(() => import('./keynote/KeynoteLanding'));
const SharedArtifactView = lazy(() => import('./components/SharedArtifactView'));
const ErrorLogViewer = lazy(() => import('./components/ErrorLogViewer'));
import { useBillingUser, PRISM_PLANS, isAuthorized as isAuthorizedFn, isMasterAuth, syncSubscriptionState, type Plan } from './lib/billing';
import { PrismBackground } from './components/PrismBackground';
import GlobalVoiceInput from './components/GlobalVoiceInput';
import { useTheme } from './hooks/useTheme';
import PrismTaskScheduler from './prism/PrismTaskScheduler';
import PrismSplash from './prism/PrismWelcome';
import TutorialOverlay from './components/TutorialOverlay';
import WowOnboarding from './components/WowOnboarding';
import OfflineNotice from './components/OfflineNotice';
import AgentTeamMonitor from './components/AgentTeamMonitor';
import ExtensionCaptureToast from './components/ExtensionCaptureToast';
import CxoWelcomeCard from './components/CxoWelcomeCard';
import StripeFailureBanner from './components/StripeFailureBanner';
import InstallPwaBanner from './components/InstallPwaBanner';
import { readSharedFromUrl } from './lib/shareLink';

// 別ルートを lazy 読み込みする際の共通フォールバック (シンプルな空白)
// 即座に切り替わるルートが多いので、派手な spinner より flash を防ぐ薄い背景の方が落ち着く
const RouteFallback = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }} aria-hidden>
    <span style={{ fontSize: 12, opacity: 0.6 }}>読み込み中…</span>
  </div>
);

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

function isErrorLogPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/error-log' || p === '/error-log';
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

function isPrivacyPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/privacy' || p === '/privacy/' || p === '/iris/privacy' || p === '/iris/privacy/';
}

function isTermsPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/terms' || p === '/terms/' || p === '/iris/terms' || p === '/iris/terms/';
}

export default function App() {
  // ?share=... — 友だちから届いた成果物プレビュー + 新規登録 CTA
  const sharedArtifact = readSharedFromUrl();
  if (sharedArtifact) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <SharedArtifactView
          artifact={sharedArtifact}
          onEnterApp={() => { window.location.href = '/'; }}
        />
      </Suspense>
    );
  }

  // /keynote — 講演会限定 先行案内 LP
  if (isKeynotePath()) {
    return <Suspense fallback={<RouteFallback />}><KeynoteLanding /></Suspense>;
  }

  // /privacy, /iris/privacy — プライバシーポリシー フルページ
  if (isPrivacyPath()) {
    return <Suspense fallback={<RouteFallback />}><PrivacyPolicy /></Suspense>;
  }

  // /terms, /iris/terms — 利用規約 フルページ
  if (isTermsPath()) {
    return <Suspense fallback={<RouteFallback />}><TermsOfService /></Suspense>;
  }

  // /strategy — オーナー専用 戦略ダッシュボード
  if (isStrategyPath()) {
    return <Suspense fallback={<RouteFallback />}><StrategyDashboard /></Suspense>;
  }

  // /pricing — 公開価格ページ + ROI 計算機
  if (isPricingPath()) {
    return <Suspense fallback={<RouteFallback />}><PricingPage /></Suspense>;
  }

  // /corp — 株式会社コア (CORE Inc.) 法人 LP
  if (isCorpPath()) {
    return <Suspense fallback={<RouteFallback />}><CoreSite /></Suspense>;
  }

  // /master/stripe-status — オーナー専用 Stripe 接続診断
  if (isStripeStatusPath()) {
    return <Suspense fallback={<RouteFallback />}><StripeStatusPage /></Suspense>;
  }

  // /master/ai-stats — オーナー専用 AI 使用量ダッシュボード
  if (isAiStatsPath()) {
    return <Suspense fallback={<RouteFallback />}><AiStats /></Suspense>;
  }

  // /master/error-log — エラーログ単独閲覧 (自端末のローカルログのみ)
  if (isErrorLogPath()) {
    return <ErrorLogViewer fullPage onClose={() => { window.location.href = '/'; }} />;
  }

  // /master — オーナー専用フル機能解放画面
  if (isMasterPath()) {
    return <Suspense fallback={<RouteFallback />}><MasterEntry /></Suspense>;
  }

  // /billing/success — Stripe 決済完了ページ
  if (isBillingSuccessPath()) {
    return <Suspense fallback={<RouteFallback />}><BillingSuccess /></Suspense>;
  }

  // CORE Iris (姉妹ブランド) ルート — /iris で別ブランドを起動
  if (isIrisPath()) {
    return <Suspense fallback={<RouteFallback />}><IrisApp /></Suspense>;
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

  const [view, setView] = useState<View>(() => {
    // 復元された activePersona があれば、dashboard で直行
    if (activePersona && hasEnteredApp()) return 'dashboard';
    return getInitialView(settings.onboardingComplete);
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showPersonaCreator, setShowPersonaCreator] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const [tutorialDoneTick, setTutorialDoneTick] = useState(0);
  const [showErrorLog, setShowErrorLog] = useState(false);

  // 設定モーダルや他コンポーネントから「不具合ログを開く」を発火できるよう、グローバル イベントを購読
  useEffect(() => {
    const open = () => setShowErrorLog(true);
    window.addEventListener('core:open-error-log', open as EventListener);
    return () => window.removeEventListener('core:open-error-log', open as EventListener);
  }, []);

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

    // Top-k 関連 item を選定 (タイトル + 要約 + タグでスコア)
    const relevantItems = selectRelevantKnowledge(message, personaKnowledge, 5);

    // チャンク単位の RAG (item で絞り込んだ後にチャンクを並べる → 精度↑)
    const candidatePool = relevantItems.length > 0 ? relevantItems : personaKnowledge;
    const queryWords = message.toLowerCase().split(/[\s　、。!?,.]+/).filter(w => w.length > 1);
    const relevantChunks = candidatePool.length > 0
      ? candidatePool
          .flatMap(item => item.chunks.map(chunk => ({
            ...chunk,
            score: queryWords.reduce((s, w) => s + (chunk.content.toLowerCase().includes(w) ? 1 : 0), 0),
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

    const reply = await sendMessage(activePersona, message, chatMessages, relevantChunks, relevantItems);
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
      {/* どの入力欄でも音声入力できる (フォーカス時にマイクが出現) */}
      <GlobalVoiceInput />
      {/* 通信が切れたときだけ画面上部に案内バー */}
      <OfflineNotice />
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
      <AnimatePresence>
        {showErrorLog && (
          <Suspense fallback={null}>
            <ErrorLogViewer key="error-log" onClose={() => setShowErrorLog(false)} />
          </Suspense>
        )}
      </AnimatePresence>
      {/* 課金失敗 (past_due / unpaid) 救済バナー — dashboard 上部に固定表示 */}
      {view === 'dashboard' && <StripeFailureBanner brand="prism" />}
      {/* AI 会社 作戦本部 — 常駐ウィジェット (承認したタスクの実行を可視化) */}
      {view === 'dashboard' && <AgentTeamMonitor brand="prism" />}
      {/* Chrome 拡張機能から ?capture= で届いた取り込みのお知らせ */}
      {view === 'dashboard' && <ExtensionCaptureToast brand="prism" />}
      {/* 初回 dashboard 訪問時の AI 会社ウェルカム (13 CXO の自己紹介 + サンプルタスク投入) */}
      {view === 'dashboard' && <CxoWelcomeCard brand="prism" />}
      {/* PWA インストール導線 — Android/Chrome prompt + iOS Safari ガイド */}
      {view === 'dashboard' && <InstallPwaBanner brand="prism" />}
    </>
  );
}
