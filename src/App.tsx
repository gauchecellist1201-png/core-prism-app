import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import QuickAskFab from './components/QuickAskFab';
import SuggestionFab from './components/SuggestionFab';
import ExplainOnTouch from './components/ExplainOnTouch';
import EveningFeed from './components/EveningFeed';
import MorningCoach from './components/MorningCoach';
import QuickKpiSparkline from './components/QuickKpiSparkline';
import { initWebVitals } from './lib/initWebVitals';

// AAAAAA (2026-06-04): モジュール 評価時 に 1 度だけ Web Vitals 観測 開始
if (typeof window !== 'undefined') initWebVitals({ sampleRate: 1 });
import PersonaPresetSuggestion from './components/PersonaPresetSuggestion';
import SitemapPalette from './components/SitemapPalette';
import AiSuggestionHistory from './components/AiSuggestionHistory';
import AiThrottleToast from './components/AiThrottleToast';
import PublicThemeToggle from './components/PublicThemeToggle';
import LegalModal, { type LegalKind } from './components/LegalModal';
import StudioOpeningSheet from './components/StudioOpeningSheet';
// 重い「別ルート専用」のページは React.lazy で main から切り出す。
// (Prism ダッシュボードを開く一般ユーザーには、これらを読み込ませない)
const MasterEntry = lazy(() => import('./components/MasterEntry'));
const AiStats = lazy(() => import('./master/AiStats'));
const AiCostDashboard = lazy(() => import('./master/AiCostDashboard'));
const SecretsHealth = lazy(() => import('./master/SecretsHealth'));
const OnboardFunnel = lazy(() => import('./master/OnboardFunnel'));
const RevenueDashboard = lazy(() => import('./master/RevenueDashboard'));
const RoadmapVotes = lazy(() => import('./master/RoadmapVotes'));
const WebVitals = lazy(() => import('./master/WebVitals'));
const AuditLog = lazy(() => import('./master/AuditLog'));
const CashflowForecast = lazy(() => import('./master/CashflowForecast'));
const SocialShares = lazy(() => import('./master/SocialShares'));
const ContactPage = lazy(() => import('./components/ContactPage'));
const TrustPage = lazy(() => import('./components/TrustPage'));
const StatusPage = lazy(() => import('./components/StatusPage'));
const RoadmapPage = lazy(() => import('./components/RoadmapPage'));
const ExecutiveBriefingsTab = lazy(() => import('./components/ExecutiveBriefingsTab'));
const GuidedTourSpotlight = lazy(() => import('./components/GuidedTourSpotlight'));
const CommandCenter = lazy(() => import('./components/CommandCenter'));
import { PRISM_TOUR, IRIS_TOUR } from './lib/guidedTourSteps';
const ChangelogPage = lazy(() => import('./components/ChangelogPage'));
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
const BookingPage = lazy(() => import('./pages/BookingPage'));
const ErrorLogViewer = lazy(() => import('./components/ErrorLogViewer'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const TokushohoPage = lazy(() => import('./pages/TokushohoPage'));
const MusicSchoolLanding = lazy(() => import('./components/MusicSchoolLanding'));
const IndustryLanding = lazy(() => import('./components/IndustryLanding'));
import { useBillingUser, PRISM_PLANS, isAuthorized as isAuthorizedFn, isMasterAuth, isTrialExpired, syncSubscriptionState, type Plan } from './lib/billing';
import TrialExpiredLock from './components/TrialExpiredLock';
import { PrismBackground } from './components/PrismBackground';
import GlobalVoiceInput from './components/GlobalVoiceInput';
import { useTheme } from './hooks/useTheme';
import PrismTaskScheduler from './prism/PrismTaskScheduler';
import PrismSplash from './prism/PrismWelcome';
const KnowledgeBrainView = lazy(() => import('./prism/KnowledgeBrainView'));
const PrismArtifactStudio = lazy(() => import('./components/PrismArtifactStudio'));
import TutorialOverlay from './components/TutorialOverlay';
import WowOnboarding from './components/WowOnboarding';
import OfflineNotice from './components/OfflineNotice';
import AgentTeamMonitor from './components/AgentTeamMonitor';
import BottomChatDock from './components/BottomChatDock';
import ExtensionCaptureToast from './components/ExtensionCaptureToast';
import CxoWelcomeCard from './components/CxoWelcomeCard';
import StripeFailureBanner from './components/StripeFailureBanner';
import InstallPwaBanner from './components/InstallPwaBanner';
import { readSharedFromUrl } from './lib/shareLink';
import { parseBookingFromUrl } from './lib/scheduling';
import { CoreDock } from './components/CoreDock';
import { readCoreHandoff } from './components/coreLink';

// CORE 共通ハンドオフを起動時に1度だけ取り込む（?core= を localStorage へ。文脈の持ち越し）。
// App は URL ごとにフル remount するルート構成（早期 return が多い）なので、
// hook ではなくモジュール評価時に1回呼ぶことで /iris を含む全ルートで確実に走らせる。
if (typeof window !== 'undefined') readCoreHandoff();

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

function isAiCostPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/ai-cost' || p === '/ai-cost';
}

function isSecretsHealthPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/secrets-health' || p === '/secrets-health';
}

function isOnboardFunnelPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/onboard-funnel' || p === '/onboard-funnel';
}

function isRevenueDashboardPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/revenue-dashboard' || p === '/revenue-dashboard';
}

function isRoadmapVotesPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/roadmap-votes' || p === '/roadmap-votes';
}

function isWebVitalsPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/web-vitals' || p === '/web-vitals';
}

function isAuditLogPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/audit-log' || p === '/audit-log';
}

function isCashflowPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/cashflow-forecast' || p === '/cashflow-forecast';
}

function isSocialSharesPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/master/social-shares' || p === '/social-shares';
}

function isContactPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/contact' || p === '/contact/';
}

function isTrustPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/trust' || p === '/trust/';
}

function isStatusPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/status' || p === '/status/';
}

function isRoadmapPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/roadmap' || p === '/roadmap/';
}

function isChangelogPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/changelog' || p === '/changelog/';
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

function isFaqPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/faq' || p === '/faq/' || p === '/iris/faq' || p === '/iris/faq/';
}

function isTokushohoPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/tokushoho' || p === '/tokushoho/' || p === '/iris/tokushoho' || p === '/iris/tokushoho/';
}

function isTermsPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/terms' || p === '/terms/' || p === '/iris/terms' || p === '/iris/terms/';
}

function isMusicSchoolLpPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname;
  return p === '/lp/music-school' || p === '/lp/music-school/';
}

/** /lp/<slug> 業界別 LP のパス判定 (music-school は別途専用) */
function getIndustryLpSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const p = window.location.pathname.replace(/\/$/, '');
  const m = p.match(/^\/lp\/([\w-]+)$/);
  if (!m) return null;
  if (m[1] === 'music-school') return null; // 専用 LP に任せる
  return m[1];
}

export default function App() {
  // ?book=... — ゲストが受け取った日程調整リンクの受信ページ
  const booking = parseBookingFromUrl();
  if (booking) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <BookingPage cfg={booking} />
      </Suspense>
    );
  }

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

  // /faq, /iris/faq — よくある質問 (15 問)
  if (isFaqPath()) {
    return <Suspense fallback={<RouteFallback />}><FAQPage /></Suspense>;
  }

  // /tokushoho, /iris/tokushoho — 特定商取引法に基づく表記
  if (isTokushohoPath()) {
    return <Suspense fallback={<RouteFallback />}><TokushohoPage /></Suspense>;
  }

  // /lp/music-school — 音楽スクール 業界特化 LP (1 業界垂直立ち上げ第 1 弾)
  if (isMusicSchoolLpPath()) {
    return <Suspense fallback={<RouteFallback />}><MusicSchoolLanding /></Suspense>;
  }

  // /lp/<slug> — 業界別 LP (sme / realestate-finance / consulting / solo / creator / freelance-pro)
  {
    const industrySlug = getIndustryLpSlug();
    if (industrySlug) {
      return <Suspense fallback={<RouteFallback />}><IndustryLanding slug={industrySlug} /></Suspense>;
    }
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

  // /master/ai-cost — オーナー専用 AI モデル別 コスト試算 (NN)
  if (isAiCostPath()) {
    return <Suspense fallback={<RouteFallback />}><AiCostDashboard /></Suspense>;
  }

  // /master/secrets-health — オーナー専用 API キー疎通診断 (FFF)
  if (isSecretsHealthPath()) {
    return <Suspense fallback={<RouteFallback />}><SecretsHealth /></Suspense>;
  }

  // /master/onboard-funnel — オーナー専用 オンボ ファネル (YYYY 2026-06-04)
  if (isOnboardFunnelPath()) {
    return <Suspense fallback={<RouteFallback />}><OnboardFunnel /></Suspense>;
  }

  // /master/revenue-dashboard — Stripe 12 ヶ月 売上 + MRR + 解約率 (JJJJJ 2026-06-04)
  if (isRevenueDashboardPath()) {
    return <Suspense fallback={<RouteFallback />}><RevenueDashboard /></Suspense>;
  }

  // /master/roadmap-votes — 投票結果 ダッシュ (RRRRR 2026-06-04)
  if (isRoadmapVotesPath()) {
    return <Suspense fallback={<RouteFallback />}><RoadmapVotes /></Suspense>;
  }

  // /master/web-vitals — Core Web Vitals (AAAAAA 2026-06-04)
  if (isWebVitalsPath()) {
    return <Suspense fallback={<RouteFallback />}><WebVitals /></Suspense>;
  }

  // /master/audit-log — 認証履歴 (DDDDDD 2026-06-04)
  if (isAuditLogPath()) {
    return <Suspense fallback={<RouteFallback />}><AuditLog /></Suspense>;
  }

  // /master/cashflow-forecast — 資金繰り 60 日 (EEEEEE 2026-06-04)
  if (isCashflowPath()) {
    return <Suspense fallback={<RouteFallback />}><CashflowForecast /></Suspense>;
  }

  // /master/social-shares — シェア 計測 (XXXXXX 2026-06-04)
  if (isSocialSharesPath()) {
    return <Suspense fallback={<RouteFallback />}><SocialShares /></Suspense>;
  }

  // /contact — 公開窓口 (KKK 2026-06-04)
  if (isContactPath()) {
    return <Suspense fallback={<RouteFallback />}><ContactPage /></Suspense>;
  }

  // /trust — 公開トラストページ (VVVV 2026-06-04)
  if (isTrustPath()) {
    return <Suspense fallback={<RouteFallback />}><TrustPage /></Suspense>;
  }

  // /status — 公開ステータスページ (WWWW 2026-06-04)
  if (isStatusPath()) {
    return <Suspense fallback={<RouteFallback />}><StatusPage /></Suspense>;
  }

  // /roadmap — 公開ロードマップ (LLLLL 2026-06-04)
  if (isRoadmapPath()) {
    return <Suspense fallback={<RouteFallback />}><RoadmapPage /></Suspense>;
  }

  // /changelog — 公開変更履歴 (VVVVV 2026-06-04)
  if (isChangelogPath()) {
    return <Suspense fallback={<RouteFallback />}><ChangelogPage /></Suspense>;
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
    return (
      <Suspense fallback={<RouteFallback />}>
        <IrisApp />
        {/* CORE 共通ドック（下部中央・current=iris） */}
        <CoreDock current="iris" />
      </Suspense>
    );
  }

  // Theme初期化 (ライト既定)
  useTheme();
  const { settings, updateSettings, updateUsageStats, resetStats } = useSettings();
  const { personas, activePersona, createPersona, updatePersona, selectPersona, toggleTask, addTask, updateCashflow } = usePersonas();
  const { items: knowledgeItems, getForPersona, addFromFile, addFilesBulk, addNote, deleteItem, reanalyze, recomputeCashflow } = useKnowledge(
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
  // 送信失敗した直近メッセージ — ワンタップ再送のために保持
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  const [view, setView] = useState<View>(() => {
    // コーポレートサイト等から ?lp=1 で来たら、再訪・マスターでも必ず LP を見せる
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lp') === '1') return 'landing';
    // 復元された activePersona があれば、dashboard で直行
    if (activePersona && hasEnteredApp()) return 'dashboard';
    return getInitialView(settings.onboardingComplete);
  });
  const [isTransitioning, setIsTransitioning] = useState(false);
  // コマンド センター (2026-06-05 オーナー指示: Claude Code 風 右パネル)
  const [commandCenterOpen, setCommandCenterOpen] = useState<boolean>(false);
  // 役員 日報 タブ オーバーレイ (2026-06-05 オーナー指示)
  const [briefingsOpen, setBriefingsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname === '/briefings' || window.location.pathname === '/briefings/';
  });
  // 🧠 統合ナレッジ脳 (最上位 Studio 限定) の開閉
  const [brainOpen, setBrainOpen] = useState(false);
  const [artifactOpen, setArtifactOpen] = useState(false);
  // ガイド ツアー (2026-06-05 オーナー指示) — HubSpot 風 「ここを タップ」 案内
  // ガイド ツアー (オーナー指示 2026-06-05: 16 ステップ ツアー は うざい から 自動 起動 廃止。
  //   freshUserDemo の フラグ も 消費 する だけ。 触れる の は window event の 明示 呼び出し のみ。)
  const [tourBrand, setTourBrand] = useState<'prism' | 'iris' | null>(null);
  useEffect(() => {
    // 旧 自動 起動 フラグ を 消費 (蓄積 した 状態 を リセット)
    (async () => {
      try {
        const { consumeTourFlag } = await import('./lib/freshUserDemo');
        consumeTourFlag();
      } catch { /* */ }
    })();
    // 明示 開始 イベント (master の ボタン / Cmd+K 等 から)
    const onStart = (e: Event) => {
      const detail = (e as CustomEvent).detail as { brand?: 'prism' | 'iris' } | undefined;
      setTourBrand(detail?.brand || 'prism');
    };
    window.addEventListener('core:start-guided-tour', onStart as EventListener);
    return () => window.removeEventListener('core:start-guided-tour', onStart as EventListener);
  }, []);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showPersonaCreator, setShowPersonaCreator] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'basic' | 'ai' | 'integrations' | 'privacy' | 'other'>('basic');
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);
  const [tutorialDoneTick, setTutorialDoneTick] = useState(0);
  const [showErrorLog, setShowErrorLog] = useState(false);

  // 設定モーダルや他コンポーネントから「不具合ログを開く」を発火できるよう、グローバル イベントを購読
  useEffect(() => {
    const open = () => setShowErrorLog(true);
    window.addEventListener('core:open-error-log', open as EventListener);
    return () => window.removeEventListener('core:open-error-log', open as EventListener);
  }, []);

  // RR (2026-06-03): リテンション ping — 1 日 1 回 DAU カウント
  useEffect(() => {
    import('./lib/retentionTracker').then(m => m.pingRetention()).catch(() => { /* */ });
  }, []);

  // エラーカード等から「設定を開く」を発火できるよう購読。detail.tab があればそのタブに直行 (例: 'ai' で AI キー登録欄へ)
  useEffect(() => {
    const open = (e: Event) => {
      const tab = (e as CustomEvent)?.detail?.tab;
      if (tab === 'ai' || tab === 'basic' || tab === 'integrations' || tab === 'privacy' || tab === 'other') {
        setSettingsInitialTab(tab);
      }
      setShowSettings(true);
    };
    window.addEventListener('core:open-settings', open as EventListener);
    return () => window.removeEventListener('core:open-settings', open as EventListener);
  }, []);

  // 課金フロー: 未 signup なら Checkout モーダルで signup → 入場
  const { user: billingUser, signout } = useBillingUser();
  const [checkoutPlan, setCheckoutPlan] = useState<Plan | null>(null);
  // 無料体験が終了したら画面をロックして課金へ誘導（master は対象外）
  const trialExpired = !isMasterAuth() && isTrialExpired(billingUser);

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

  // 送信の本体。append=true なら新規送信 (ユーザー吹き出しを追加)、
  // append=false なら再送 (吹き出しは既にあるので追加しない)。
  const runSend = useCallback(async (message: string, append: boolean) => {
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

    // 履歴: 新規送信は現在の chatMessages、再送は末尾の失敗ユーザー吹き出しを
    // 除いた履歴を渡す (API 側で message が二重に積まれるのを防ぐ)。
    const baseHistory = append
      ? chatMessages
      : (chatMessages[chatMessages.length - 1]?.role === 'user'
          ? chatMessages.slice(0, -1)
          : chatMessages);

    if (append) {
      const userMsg: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages(prev => [...prev, userMsg]);
    }
    setRetryMessage(null);

    const reply = await sendMessage(activePersona, message, baseHistory, relevantChunks, relevantItems);
    if (reply) {
      setChatMessages(prev => [...prev, reply]);
    } else {
      // 失敗 — 同じ内容をワンタップで再送できるよう保持
      setRetryMessage(message);
    }
  }, [activePersona, chatMessages, sendMessage, getForPersona]);

  const handleSendMessage = useCallback((message: string) => runSend(message, true), [runSend]);
  const handleRetryMessage = useCallback(() => {
    if (retryMessage) runSend(retryMessage, false);
  }, [retryMessage, runSend]);

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

        {/* 無料体験 終了 → 画面ロック（課金で続きから使える）。CheckoutModal が開いている間は二重表示しない */}
        {trialExpired && !checkoutPlan && (
          <TrialExpiredLock
            brand="prism"
            accent="#A78BFA"
            onChoose={(p) => setCheckoutPlan(p)}
            onSignout={signout}
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
            canRetry={!!retryMessage}
            settings={settings}
            knowledgeItems={knowledgeItems}
            onSwitch={handleSwitchPersona}
            onSendMessage={handleSendMessage}
            onRetryMessage={handleRetryMessage}
            onBackToSelection={() => { setView('selection'); setChatMessages([]); }}
            onOpenSettings={() => { setSettingsInitialTab('basic'); setShowSettings(true); }}
            onCreatePersona={() => setShowPersonaCreator(true)}
            onRenamePersona={(id, updates) => updatePersona(id, updates)}
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
            initialTab={settingsInitialTab}
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
          <Suspense fallback={<StudioOpeningSheet brand="prism" />}>
            <ErrorLogViewer key="error-log" onClose={() => setShowErrorLog(false)} />
          </Suspense>
        )}
      </AnimatePresence>
      {/* 課金失敗 (past_due / unpaid) 救済バナー — dashboard 上部に固定表示 */}
      {view === 'dashboard' && <StripeFailureBanner brand="prism" />}
      {/* Claude Code 風 下部チャットドック — 右サイドとは別の分かりやすい入口。
          チャット状態(messages/onSend/isLoading)を共有。コマンドセンター展開中は隠す。 */}
      {view === 'dashboard' && !commandCenterOpen && activePersona && (
        <BottomChatDock
          accent={activePersona.accentColor}
          name={activePersona.name}
          messages={chatMessages}
          onSend={handleSendMessage}
          isLoading={isChatLoading}
        />
      )}
      {/* AI 会社 作戦本部 — 常駐ウィジェット (承認したタスクの実行を可視化)
          2026-06-05 オーナー指示: コマンドセンター 開いて いる 間 は 非表示 */}
      {view === 'dashboard' && !commandCenterOpen && <AgentTeamMonitor brand="prism" />}

      {/* 🔮 プリズム コマンド センター 起動 ボタン (右端 中央 固定) */}
      {view === 'dashboard' && !commandCenterOpen && activePersona && (
        <button
          onClick={() => setCommandCenterOpen(true)}
          aria-label="プリズム コマンド センター を 開く"
          data-explain-id="prism-mark"
          title="プリズム コマンド センター"
          style={{
            position: 'fixed',
            top: '50%', right: 0,
            transform: 'translateY(-50%)',
            zIndex: 38,
            width: 44, height: 64,
            background: 'linear-gradient(135deg, #A78BFA, #6366F1)',
            color: '#fff',
            border: 'none',
            borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4,
            boxShadow: '-6px 0 22px rgba(99,102,241,0.45)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>🔮</span>
          <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.04em', writingMode: 'vertical-rl', textOrientation: 'mixed' }}>COMMAND</span>
        </button>
      )}

      {/* 🔮 コマンド センター 本体 */}
      {activePersona && (
        <Suspense fallback={null}>
          <CommandCenter
            persona={activePersona}
            open={commandCenterOpen}
            onClose={() => setCommandCenterOpen(false)}
            brand="prism"
          />
        </Suspense>
      )}
      {/* 役員 日報 タブ ボタン — 13 名 役員 が 作った 成果物 を 全部 見られる (2026-06-05) */}
      {view === 'dashboard' && activePersona && (
        <button
          onClick={() => setBriefingsOpen(true)}
          aria-label="役員 日報 を 見る"
          data-tour-id="briefings-button"
          className="cp-fab-iconize"
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
            right: 'max(14px, env(safe-area-inset-right, 0px))',
            zIndex: 35,
            padding: '10px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg, #A78BFA, #6366F1)',
            color: '#fff', fontWeight: 800, fontSize: 13,
            border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
            boxShadow: '0 8px 22px rgba(99,102,241,0.45)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        ><span style={{ fontSize: 17, lineHeight: 1 }}>📋</span><span className="cp-fab-label">役員 日報</span></button>
      )}
      {/* 🧠 統合ナレッジ脳 ボタン (最上位 Studio 限定の中核機能) — 役員日報の上に積む */}
      {view === 'dashboard' && activePersona && (
        <button
          onClick={() => setBrainOpen(true)}
          aria-label="統合ナレッジ脳 を 開く"
          className="cp-fab-iconize"
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 134px)',
            right: 'max(14px, env(safe-area-inset-right, 0px))',
            zIndex: 35,
            padding: '10px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg, #8B5CF6, #4F46E5)',
            color: '#fff', fontWeight: 800, fontSize: 13,
            border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
            boxShadow: '0 8px 22px rgba(99,102,241,0.45)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}><path d="M9.5 3.5A2.5 2.5 0 0 0 7 6a2.5 2.5 0 0 0-1.5 4.5A2.5 2.5 0 0 0 7 15a2.5 2.5 0 0 0 2.5 2.5V3.5Z" /><path d="M14.5 3.5A2.5 2.5 0 0 1 17 6a2.5 2.5 0 0 1 1.5 4.5A2.5 2.5 0 0 1 17 15a2.5 2.5 0 0 1-2.5 2.5V3.5Z" /><path d="M12 3.5v14" /></svg><span className="cp-fab-label">統合脳</span></button>
      )}
      {/* ✨ 成果物スタジオ ボタン — 統合脳の上に積む（エージェント提案→美しい一枚成果物） */}
      {view === 'dashboard' && activePersona && (
        <button
          onClick={() => setArtifactOpen(true)}
          aria-label="成果物スタジオ を 開く"
          className="cp-fab-iconize"
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 188px)',
            right: 'max(14px, env(safe-area-inset-right, 0px))',
            zIndex: 35,
            padding: '10px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg, #A78BFA, #6366F1)',
            color: '#fff', fontWeight: 800, fontSize: 13,
            border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
            boxShadow: '0 8px 22px rgba(99,102,241,0.45)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
        ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></svg><span className="cp-fab-label">成果物</span></button>
      )}
      {/* ✨ 成果物スタジオ オーバーレイ */}
      {artifactOpen && activePersona && (
        <Suspense fallback={null}>
          <PrismArtifactStudio onClose={() => setArtifactOpen(false)} settings={settings} persona={activePersona} />
        </Suspense>
      )}
      {/* 🧠 統合ナレッジ脳 オーバーレイ */}
      {brainOpen && activePersona && (
        <Suspense fallback={null}>
          <KnowledgeBrainView
            persona={activePersona}
            plan={isMasterAuth() ? 'studio' : (billingUser?.plan ?? 'free')}
            knowledgeItems={knowledgeItems}
            settings={settings}
            addFilesBulk={addFilesBulk}
            onClose={() => setBrainOpen(false)}
            onUpgrade={() => { setBrainOpen(false); const studio = PRISM_PLANS.find(p => p.id === 'studio'); if (studio) setCheckoutPlan(studio); }}
          />
        </Suspense>
      )}
      {/* ガイド ツアー (HubSpot 風) — 「ここを タップ」 で 全機能 を 案内 */}
      {tourBrand && (
        <Suspense fallback={null}>
          <GuidedTourSpotlight
            steps={tourBrand === 'iris' ? IRIS_TOUR : PRISM_TOUR}
            brand={tourBrand}
            onClose={() => setTourBrand(null)}
            onComplete={() => setTourBrand(null)}
          />
        </Suspense>
      )}
      {/* 役員 日報 オーバーレイ — 全画面 モーダル として 表示 */}
      <AnimatePresence>
        {briefingsOpen && activePersona && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 65,
              background: 'rgba(7,7,18,0.97)', backdropFilter: 'blur(12px)',
              overflow: 'auto',
            }}
          >
            <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
              <button
                onClick={() => setBriefingsOpen(false)}
                aria-label="閉じる"
                style={{
                  position: 'fixed', top: 'max(env(safe-area-inset-top, 0px) + 12px, 12px)', right: 14,
                  width: 36, height: 36, borderRadius: 999,
                  background: 'rgba(255,255,255,0.1)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
                  fontSize: 20, lineHeight: 1, zIndex: 5,
                }}
              >×</button>
              <Suspense fallback={<RouteFallback />}>
                <ExecutiveBriefingsTab
                  persona={activePersona}
                  onSaveAsKnowledge={(title, content) => handleAddKnowledgeNote(title, content)}
                />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Chrome 拡張機能から ?capture= で届いた取り込みのお知らせ */}
      {view === 'dashboard' && <ExtensionCaptureToast brand="prism" />}
      {/* 初回 dashboard 訪問時の AI 会社ウェルカム (13 CXO の自己紹介 + サンプルタスク投入) */}
      {view === 'dashboard' && <CxoWelcomeCard brand="prism" />}
      {/* PWA インストール導線 — Android/Chrome prompt + iOS Safari ガイド */}
      {view === 'dashboard' && <InstallPwaBanner brand="prism" />}
      {/* 2026-06-05 オーナー指示: ホーム 内 で 触った 場所 に 説明 が 浮かぶ 学習 モード */}
      {view === 'dashboard' && <ExplainOnTouch brand="prism" />}
      {/* VVV (2026-06-04): 夜のフィード — 18 時以降 1 日 1 回 */}
      {view === 'dashboard' && <EveningFeed />}
      {/* UUUUU (2026-06-04): ダッシュ 上端に 3 KPI sparkline */}
      {view === 'dashboard' && <div data-tour-id="kpi-sparkline" style={{ position: 'sticky', top: 0, zIndex: 30, background: 'rgba(7,7,18,0.78)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}><QuickKpiSparkline /></div>}
      {/* KKKKK (2026-06-04): 朝の「今日のひとこと」 (4-12 時 JST 1 日 1 回) */}
      {view === 'dashboard' && <MorningCoach personaName={activePersona?.name} />}
      {/* GGGG (2026-06-04): 業種別 AI ペルソナ プリセット 4 名 提案 */}
      {view === 'dashboard' && <PersonaPresetSuggestion />}
      {/* ZZ (2026-06-03): 全画面常駐 FAB — LP / Pricing / Billing / Dashboard */}
      <QuickAskFab />
      {/* DDD (2026-06-04): 左下「💡 改善提案」(QuickAskFab と被らない位置) */}
      <SuggestionFab />
      {/* OOO (2026-06-04): Cmd+Shift+/ で「全機能マップ」 */}
      <SitemapPalette />
      {/* DDDDD (2026-06-04): 7 日 AI 提案 履歴 — window.dispatchEvent('core:open-ai-suggestions') で開く */}
      <AiSuggestionHistoryGlobalMount />
      {/* PPP (2026-06-04): AI throttle 表示 */}
      <AiThrottleToast />
      {/* YYY (2026-06-04): LP / Pricing / Billing / Contact 用 ライト ⇄ ダーク 切替 */}
      <PublicThemeToggle />
      {/* サンプル表示は ダッシュボード内の DemoBanner に一本化 (ロゴと被る固定帯は廃止) */}
      {/* CORE 共通ドック（下部中央・current=prism）。Prism ルート(/)でのみ表示し、
          中央のBottomChatドック入力バーより1段上に浮かせて操作を塞がない。 */}
      {isPrismRootPath() && <CoreDock current="prism" />}
    </>
  );
}

/** Prism 本体ルート(/)の判定 — 早期 return される /corp /pricing /iris 等は対象外 */
function isPrismRootPath(): boolean {
  if (typeof window === 'undefined') return false;
  const p = window.location.pathname.replace(/\/+$/, '');
  return p === '' || p === '/briefings';
}

function AiSuggestionHistoryGlobalMount() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      // Cmd+Shift+H (履歴) — Cmd+Shift+/ (sitemap), Cmd+K (palette) と被らない
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('core:open-ai-suggestions', onOpen as EventListener);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('core:open-ai-suggestions', onOpen as EventListener);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
  return <AiSuggestionHistory open={open} onClose={() => setOpen(false)} />;
}
