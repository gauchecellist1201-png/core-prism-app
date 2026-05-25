import { useState, useCallback, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, ChatMessage, AppSettings, KnowledgeItem, Proposal } from '../types/identity';
import { isOnboarded, isDemoActive, clearDemoData } from '../lib/onboarding';
import OnboardingWizard from './OnboardingWizard';
import DemoBanner from './DemoBanner';
import SampleDataCTA from './SampleDataCTA';
import ModeSwitcher from './ModeSwitcher';
import CognitiveDashboard from './CognitiveDashboard';
import AISidebar from './AISidebar';
import SupportChat from './SupportChat';
import ShortcutHelpModal from './ShortcutHelpModal';
import PwaInstallPrompt from './PwaInstallPrompt';
import FeedbackWidget from './FeedbackWidget';
import KnowledgeBase from './KnowledgeBase';
const MeetingHub = lazy(() => import('./MeetingHub'));
const HealthHub = lazy(() => import('./health/HealthHub'));
import { ThemeToggle } from './ThemeToggle';
import TodayBrief from './TodayBrief';
import PrismProposalCard from './ProposalCard';
import type { CxoRole as PrismCxoRole } from '../hooks/useAgentTaskQueue';
import InsightsStream from './InsightsStream';
import PrismFlow from './PrismFlow';
import MomentPulse from './MomentPulse';
import QuickActions from './QuickActions';
import ActivityTimeline from './ActivityTimeline';
import HealthSnapshot from './HealthSnapshot';
import { useStripeRevenue } from '../hooks/useStripeRevenue';
import { useInvoices } from '../hooks/useInvoices';
import type { BusinessSnapshot } from '../lib/coachScheduler';
import TodaysBodyCard from '../prism/TodaysBodyCard';
import { loadBillingUser } from '../lib/billing';
// CoreRevenueCard はマスター専用経営画面へ移設予定 (ペルソナ画面からは撤去)
const MeetingMinutesModal = lazy(() => import('./MeetingMinutes'));
const SlideGeneratorModal = lazy(() => import('./SlideGenerator'));
const NegotiationCoachModal = lazy(() => import('./NegotiationCoach'));
const DecisionMemoModal = lazy(() => import('./DecisionMemo'));
const EmailTriageModal = lazy(() => import('./EmailTriage'));
const PremiumHubModal = lazy(() => import('./PremiumHub'));
const FinanceEditor = lazy(() => import('./FinanceEditor'));
const AutoPostStudio = lazy(() => import('./AutoPostStudio'));
const ContentEngineStudio = lazy(() => import('./ContentEngineStudio'));
const InvoiceStudio = lazy(() => import('./InvoiceStudio'));
const ImageStudio = lazy(() => import('./ImageStudio'));
const SalesLedger = lazy(() => import('./SalesLedger'));
const ExpenseStudio = lazy(() => import('./ExpenseStudio'));
const CRMStudio = lazy(() => import('./CRMStudio'));
const TaskHub = lazy(() => import('./TaskHub'));
const VoiceCaptureStudio = lazy(() => import('./VoiceCaptureStudio'));
const SalesAgentStudio = lazy(() => import('./SalesAgentStudio'));
const SaasAgentStudio = lazy(() => import('./SaasAgentStudio'));
const YouTubeImportStudio = lazy(() => import('./YouTubeImportStudio'));
import ShadowSecretaryPanel from './ShadowSecretaryPanel';
import { useShadowSecretary } from '../hooks/useShadowSecretary';
import { PrismLogo } from './Logo';
import AnimatedAvatar from './AnimatedAvatar';
import CommandPalette, { useCommandPaletteHotkey, type ModalKey } from './CommandPalette';
const PnLStudio = lazy(() => import('./PnLStudio'));
const FinancialConsultant = lazy(() => import('./FinancialConsultant'));
const BenchmarkStudio = lazy(() => import('./BenchmarkStudio'));
const DocumentStudio = lazy(() => import('./DocumentStudio'));
const PeopleStudio = lazy(() => import('./PeopleStudio'));
const TeamHub = lazy(() => import('./TeamHub'));
import AcceptInviteModal from './AcceptInviteModal';
import InviteShareCard from './InviteShareCard';
import { REFERRAL_BONUS_DAYS } from '../lib/referral';
import { Gift } from 'lucide-react';
import { useProactiveAgent } from '../hooks/useProactiveAgent';
import { useDailyCoach } from '../hooks/useDailyCoach';
import { useDailyStreak } from '../hooks/useDailyStreak';
import { useReengagement } from '../hooks/useReengagement';
import IncomingBriefBanner from './IncomingBriefBanner';
import type { CoachBrief } from '../lib/coachScheduler';
import { speakNatural } from '../lib/tts';
import { loadBenchmarkResult } from '../lib/benchmarkAnalyst';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
// AutoAgentHero は 2026-05-16 にオーナー指示で削除 (恒常的な JSON parse エラー)
import AgentsOrbit from './AgentsOrbit';
import { PRISM_SPECS, PRISM_ORDER, PRISM_CONVERSATIONS } from '../lib/agentSpecs';
import WellnessTracker from './WellnessTracker';
import IntegrationCenter from './IntegrationCenter';
import StripeConnectHero from './StripeConnectHero';

interface Props {
  persona: Persona;
  allPersonas: Persona[];
  isTransitioning: boolean;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatError: string | null;
  settings: AppSettings;
  knowledgeItems: KnowledgeItem[];
  onSwitch: (id: string) => void;
  onSendMessage: (msg: string) => Promise<void>;
  onBackToSelection: () => void;
  onOpenSettings: () => void;
  onCreatePersona: () => void;
  onAddKnowledgeFile: (file: File) => Promise<KnowledgeItem>;
  onAddKnowledgeNote: (title: string, content: string) => KnowledgeItem;
  onDeleteKnowledge: (id: string) => void;
  onReanalyzeKnowledge: (id: string) => Promise<void>;
  onToggleTask: (personaId: string, taskId: string) => void;
  onAcceptProactiveAction: (action: string) => void;
  onUpdateCashflow: (personaId: string, income: number, expense: number, label: string) => void;
  onRecomputeCashflow: (personaId: string, personaName: string) => Promise<{
    success: boolean;
    totalIncome: number;
    totalExpense: number;
    period?: string;
    sources: number;
    failed: number;
    error?: string;
  }>;
  knowledgeForAgent: KnowledgeItem[];
  healthCtx: { today: DailyHealth | null; week: DailyHealth[]; anomalies: HealthAnomaly[] };
}

function PriorityDot({ priority }: { priority: string }) {
  const colors = { high: '#f87171', mid: '#c9a96e', low: '#4a4a6a' };
  return <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: colors[priority as keyof typeof colors] }} />;
}

function FileIcon({ type }: { type: string }) {
  return <span className="text-sm flex-shrink-0">{{ file: '📄', note: '🗒', url: '🔗', auto: '🤖' }[type] ?? '📄'}</span>;
}

export default function IdentityDashboard({
  persona,
  allPersonas,
  isTransitioning,
  chatMessages,
  isChatLoading,
  chatError,
  settings,
  knowledgeItems,
  onSwitch,
  onSendMessage,
  onBackToSelection,
  onOpenSettings,
  onCreatePersona,
  onAddKnowledgeFile,
  onAddKnowledgeNote,
  onDeleteKnowledge,
  onReanalyzeKnowledge,
  onToggleTask,
  onAcceptProactiveAction,
  onUpdateCashflow,
  onRecomputeCashflow,
  knowledgeForAgent,
  healthCtx,
}: Props) {
  const proactive = useProactiveAgent(settings, persona, knowledgeForAgent, healthCtx);
  const shadow = useShadowSecretary(settings, persona);

  // ── Stripe + Invoices を集めて useDailyCoach のブリーフ に「業務スナップショット」を渡す ──
  // オーナー指示 (2026-05-25): ブリーフは体調話ばかりではなく、Stripe 実売上 / 未払請求書 /
  // 進行中案件 等の実数字 + 課題ベースで提案する。
  const _stripeForBrief = useStripeRevenue();
  const _invoicesHook = useInvoices();
  const _personaInvoices = _invoicesHook.getForPersona(persona.id);
  const _today = new Date();
  const _unpaid = _personaInvoices.filter(i => i.status === 'issued');
  const _overdue = _unpaid.filter(i => i.dueDate && new Date(i.dueDate) < _today);
  const _unpaidAmountJpy = _unpaid.reduce(
    (sum, i) => sum + i.lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0),
    0,
  );
  const _last3m = _stripeForBrief.sumMonths(3);
  const briefBusiness: BusinessSnapshot = {
    stripe: {
      connected: _stripeForBrief.connected,
      thisMonthRevenueJpy: _stripeForBrief.thisMonth.revenueJpy,
      thisMonthExpenseJpy: _stripeForBrief.thisMonth.expenseJpy,
      thisMonthProfitJpy: _stripeForBrief.thisMonth.profitJpy,
      thisMonthTxnCount: _stripeForBrief.thisMonth.txnCount,
      momGrowth: _stripeForBrief.momGrowth,
      last3mRevenueJpy: _last3m.revenueJpy,
    },
    invoices: {
      unpaidCount: _unpaid.length,
      unpaidAmountJpy: _unpaidAmountJpy,
      overdueCount: _overdue.length,
    },
  };

  const coach = useDailyCoach(settings, persona, knowledgeForAgent, healthCtx, briefBusiness);
  const dailyStreak = useDailyStreak();
  useReengagement(dailyStreak, { brand: 'prism' });
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboarded());
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [activeTab, setActiveTab] = useState<'files' | 'tasks'>('files');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileAI, setShowMobileAI] = useState(false);
  const [showMinutes, setShowMinutes] = useState(false);
  const [showSlides, setShowSlides] = useState(false);
  const [showNego, setShowNego] = useState(false);
  const [showDecision, setShowDecision] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [showContentEngine, setShowContentEngine] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showCRM, setShowCRM] = useState(false);
  const [showTaskHub, setShowTaskHub] = useState(false);
  const [showPnL, setShowPnL] = useState(false);
  const [showFinConsult, setShowFinConsult] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(false);
  const lastBenchmark = useMemo(() => loadBenchmarkResult(persona.id), [persona.id, showBenchmark]);
  const [showVoice, setShowVoice] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  // 連携センターを開いた瞬間にフォーカスしたいツール ID (Stripe Hero 経由など)
  const [integrationsFocusId, setIntegrationsFocusId] = useState<string | undefined>(undefined);
  const [showSalesAgent, setShowSalesAgent] = useState(false);
  const [showSaasAgent, setShowSaasAgent] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [showShadow, setShowShadow] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [pendingInviteCode] = useState<string | null>(() => {
    try { return sessionStorage.getItem('pending_invite'); } catch { return null; }
  });
  const [showCmdK, setShowCmdK] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [financeEditFor, setFinanceEditFor] = useState<Persona | null>(null);
  const [briefOverride, setBriefOverride] = useState<Proposal | null>(null);

  const coachBriefToProposal = useCallback((b: CoachBrief): Proposal => ({
    id: b.id,
    personaId: b.personaId,
    title: b.title,
    message: b.message,
    actions: b.actions,
    context: b.context,
    generatedAt: b.generatedAt,
  }), []);

  const handleReadBrief = useCallback(() => {
    if (coach.incoming) {
      setBriefOverride(coachBriefToProposal(coach.incoming));
    }
    coach.read();
  }, [coach, coachBriefToProposal]);

  const handleSpeakBriefText = useCallback((text: string) => {
    speakNatural(text, {
      lang: settings.voiceLang || 'ja-JP',
      rate: 1.0,
      pitch: 1.0,
    });
  }, [settings.voiceLang]);

  useCommandPaletteHotkey(() => setShowCmdK(true));

  const handleCmdKOpen = useCallback((m: ModalKey) => {
    switch (m) {
      case 'knowledge': setShowKnowledge(true); break;
      case 'meeting':   setShowMeeting(true); break;
      case 'health':    setShowHealth(true); break;
      case 'minutes':   setShowMinutes(true); break;
      case 'slides':    setShowSlides(true); break;
      case 'nego':      setShowNego(true); break;
      case 'decision':  setShowDecision(true); break;
      case 'email':     setShowEmail(true); break;
      case 'premium':   setShowPremium(true); break;
      case 'post':      setShowPost(true); break;
      case 'image':     setShowImage(true); break;
      case 'invoice':   setShowInvoice(true); break;
      case 'sales':     setShowSales(true); break;
      case 'expense':   setShowExpense(true); break;
      case 'crm':       setShowCRM(true); break;
      case 'tasks':     setShowTaskHub(true); break;
      case 'pnl':       setShowPnL(true); break;
      case 'finConsult': setShowFinConsult(true); break;
      case 'salesAgent': setShowSalesAgent(true); break;
      case 'saasAgent':  setShowSaasAgent(true); break;
      case 'settings':  onOpenSettings(); break;
      case 'voice': setShowVoice(true); break;
      case 'youtube':    setShowYouTube(true); break;
      case 'documents':  setShowDocument(true); break;
      case 'people':     setShowPeople(true); break;
    }
  }, [onOpenSettings]);
  const [globalDrag, setGlobalDrag] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  const personaKnowledge = knowledgeItems.filter(i => i.personaId === persona.id);

  // 上で取得済の Stripe 実売上を「今月の収支」表示にも使う
  const stripe = _stripeForBrief;
  const stripeActive = stripe.connected && stripe.thisMonth.revenueJpy > 0;
  const displayIncome = stripeActive ? stripe.thisMonth.revenueJpy : persona.cashflow.income;
  const displayExpense = stripeActive ? -stripe.thisMonth.expenseJpy : persona.cashflow.expense;
  const displayLabel = stripeActive
    ? `Stripe 実売上 (${new Date().getMonth() + 1}月)${stripe.thisMonth.txnCount ? ` ・ ${stripe.thisMonth.txnCount} 件` : ''}`
    : persona.cashflow.label;
  const net = displayIncome + displayExpense;

  const SUPPORTED_EXT = new Set([
    'pdf','docx','pptx','xlsx','xls','csv','txt','md','markdown','json','html','htm',
    'xml','yaml','yml','log','tsv','png','jpg','jpeg','gif','webp','svg',
  ]);
  const isSupported = (name: string) => {
    const e = name.toLowerCase().split('.').pop() || '';
    return SUPPORTED_EXT.has(e);
  };
  const walkEntry = async (entry: any): Promise<File[]> => {
    if (entry.isFile) {
      return await new Promise<File[]>((resolve) => {
        entry.file((file: File) => resolve([file]), () => resolve([]));
      });
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const all: any[] = [];
      const readBatch = (): Promise<void> => new Promise((resolve) => {
        reader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) resolve();
          else { all.push(...entries); readBatch().then(resolve); }
        }, () => resolve());
      });
      await readBatch();
      const files: File[] = [];
      for (const e of all) files.push(...await walkEntry(e));
      return files;
    }
    return [];
  };
  const handleGlobalDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setGlobalDrag(false);
    const items = e.dataTransfer.items;
    const allFiles: File[] = [];
    if (items && items.length > 0 && (items[0] as any).webkitGetAsEntry) {
      const entryPromises: Promise<File[]>[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = (items[i] as any).webkitGetAsEntry();
        if (entry) entryPromises.push(walkEntry(entry));
      }
      const results = await Promise.all(entryPromises);
      results.forEach(r => allFiles.push(...r));
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        allFiles.push(e.dataTransfer.files[i]);
      }
    }
    const supported = allFiles.filter(f => isSupported(f.name));
    if (supported.length === 0) return;
    setBulkProgress({ done: 0, total: supported.length, current: supported[0].name });
    for (let i = 0; i < supported.length; i++) {
      const f = supported[i];
      setBulkProgress({ done: i, total: supported.length, current: f.name });
      try { await onAddKnowledgeFile(f); } catch { /* skip */ }
    }
    setBulkProgress({ done: supported.length, total: supported.length, current: '' });
    setTimeout(() => setBulkProgress(null), 2000);
  }, [onAddKnowledgeFile]);

  return (
    <motion.div
      className="flex h-screen overflow-hidden relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onDragEnter={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) setGlobalDrag(true);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          setGlobalDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setGlobalDrag(false);
      }}
      onDrop={handleGlobalDrop}
    >
      <AnimatePresence>
        {coach.incoming && (
          <IncomingBriefBanner
            key="coach-brief-banner"
            brief={coach.incoming}
            persona={persona}
            onRead={handleReadBrief}
            onDismiss={coach.dismiss}
            voiceEnabled={settings.voiceEnabled !== false}
            onSpeak={handleSpeakBriefText}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: '#0a0a0f' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <motion.p
              className="text-neutral-700 text-sm tracking-widest font-light"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              人格を切り替えています…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMobileSidebar && (
          <motion.div
            className="fixed inset-0 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobileSidebar(false)}
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
          />
        )}
      </AnimatePresence>

      {/* Left Sidebar */}
      <div
        className={`${showMobileSidebar ? 'flex' : 'hidden'} md:flex fixed md:static z-50 md:z-auto top-0 left-0 h-full w-56 md:w-52 flex-col py-3 px-2 flex-shrink-0`}
        style={{
          borderRight: '1px solid rgba(255,255,255,0.06)',
          background: 'var(--bg, #0a0a0a)',
        }}
      >
        <div className="px-2 mb-3">
          <button onClick={onBackToSelection} className="group text-left flex items-center transition-opacity group-hover:opacity-70">
            <PrismLogo size={32} withWordmark />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-fg-muted text-xs tracking-widest uppercase px-2 mb-1.5">人格</p>
          <ModeSwitcher activeId={persona.id} onSwitch={onSwitch} isTransitioning={isTransitioning} />

          <motion.button
            onClick={onCreatePersona}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mt-1.5 transition-colors hover:bg-surface-3 group"
            whileTap={{ scale: 0.97 }}
          >
            <span className="text-fg-muted group-hover:text-fg text-base">＋</span>
            <span className="text-fg-muted group-hover:text-fg text-sm">人格を追加</span>
          </motion.button>
        </div>

        <div className="space-y-0.5">
          <button
            onClick={() => setShowInvite(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors"
            style={{
              background: `${persona.accentColor}1a`,
              border: `1px solid ${persona.accentColor}44`,
            }}
          >
            <Gift size={14} style={{ color: persona.accentColor }} strokeWidth={2.4} />
            <span className="text-sm font-semibold" style={{ color: persona.accentColor }}>友達招待 +{REFERRAL_BONUS_DAYS}日</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-surface-3 group transition-colors"
          >
            <span className="text-fg-muted group-hover:text-fg text-sm">⚙</span>
            <span className="text-fg-muted group-hover:text-fg text-sm">環境設定</span>
          </button>
          <div className="px-2 py-1.5 flex items-center justify-between gap-2">
            <span className="text-fg-muted text-xs tracking-widest uppercase">表示</span>
            <ThemeToggle />
          </div>
          <div className="px-2 py-1 flex items-baseline justify-between">
            <span className="text-fg text-sm">¥{Math.round(settings.usageStats.estimatedCostUsd * 150)}</span>
            <span className="text-fg-subtle text-[10px]">今月のAPI</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={persona.id}
          className="flex-1 flex flex-col overflow-hidden"
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Topbar */}
          <div className="flex items-center justify-between gap-2 px-3 md:px-4 py-2.5 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => setShowMobileSidebar(true)}
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                aria-label="メニュー"
              >
                ☰
              </button>
              <motion.div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: persona.accentColorLight, color: persona.accentColor }}
                layoutId="activeIcon"
              >
                {persona.icon}
              </motion.div>
              <div className="min-w-0">
                <p className="text-fg text-base font-medium truncate leading-tight">{persona.name}</p>
                <p className="text-fg-muted text-xs truncate">{persona.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              <motion.button
                onClick={() => setShowHealth(true)}
                className="text-xs px-2 md:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                style={{
                  background: 'rgba(255,111,181,0.08)',
                  border: '1px solid rgba(255,111,181,0.25)',
                  color: '#FF6FB5',
                }}
                whileHover={{ background: 'rgba(255,111,181,0.15)' }}
                aria-label="ヘルス"
              >
                🩺 <span className="hidden md:inline">ヘルス</span>
              </motion.button>
              <motion.button
                onClick={() => setShowMeeting(true)}
                className="hidden md:flex text-xs px-3 py-1.5 rounded-lg items-center gap-1.5 transition-all"
                style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                whileHover={{ borderColor: persona.accentColor + '40', color: persona.accentColor }}
              >
                📅 ミーティングリンク
              </motion.button>
              <motion.button
                onClick={() => setShowKnowledge(true)}
                className="text-xs px-2 md:px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all"
                style={{
                  background: personaKnowledge.length > 0 ? persona.accentColorLight : 'var(--surface-3)',
                  border: `1px solid ${personaKnowledge.length > 0 ? persona.accentColor + '40' : 'var(--border)'}`,
                  color: personaKnowledge.length > 0 ? persona.accentColor : 'var(--fg-muted)',
                }}
                aria-label="ナレッジ"
              >
                📚 <span className="hidden md:inline">ナレッジ</span>{personaKnowledge.length > 0 && ` (${personaKnowledge.length})`}
              </motion.button>
              <button
                onClick={() => setShowMobileAI(true)}
                className="md:hidden text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                style={{
                  background: persona.accentColorLight,
                  border: `1px solid ${persona.accentColor}40`,
                  color: persona.accentColor,
                }}
                aria-label="AIチャット"
              >
                💬 AI
              </button>
              {coach.brief && !coach.incoming && (
                <motion.button
                  onClick={() => { if (coach.brief) setBriefOverride(coachBriefToProposal(coach.brief)); }}
                  className="hidden md:flex text-xs px-2 py-1 rounded-full items-center gap-1 transition-all"
                  style={{ background: `${persona.accentColor}18`, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  title="コーチブリーフを表示"
                >
                  🧠 ブリーフ
                </motion.button>
              )}
              <div
                className="hidden md:block text-xs px-2 py-1 rounded-full"
                style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}30` }}
              >
                起動中
              </div>
              {/* Mini AI avatar — クリックで SupportChat を開く */}
              <button
                onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', ctrlKey: true, bubbles: true }))}
                className="hidden md:flex items-center justify-center rounded-full flex-shrink-0 overflow-hidden"
                style={{ width: 40, height: 40, border: `1.5px solid ${persona.accentColor}50`, background: 'transparent', cursor: 'pointer', padding: 0 }}
                title="AIアシスタントに話しかける (Ctrl+/)"
                aria-label="AIアシスタントを開く"
              >
                <AnimatedAvatar
                  brand="prism"
                  accentColor={persona.accentColor}
                  isSpeaking={false}
                  mood="neutral"
                  size={40}
                />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isDemoActive() && (
              <DemoBanner
                key="demo-banner"
                onClearDemo={() => { clearDemoData(); window.location.reload(); }}
              />
            )}
          </AnimatePresence>

          <div className="absolute top-0 left-0 right-0 md:left-48 md:right-64 h-40 pointer-events-none opacity-10"
            style={{ background: `radial-gradient(ellipse at top center, ${persona.accentColor} 0%, transparent 70%)` }}
          />

          <div className="flex-1 overflow-auto p-3 md:p-4 relative">
            <div className="max-w-5xl space-y-3">

              {/* 7 つのエージェントが、それぞれ動いている可視化 (LP の 7 本柱と対応) */}
              <AgentsOrbit
                specs={PRISM_SPECS}
                order={PRISM_ORDER}
                conversations={PRISM_CONVERSATIONS}
                footerLabel="あなたの 7 人の参謀が、いま動いています"
                agents={[
                  {
                    key: 'ceo',
                    count: proactive.proposals.length,
                    status: proactive.proposals.length
                      ? `提案${proactive.proposals.length}件`
                      : '一手を考案中',
                    advice: proactive.proposals.length
                      ? `この提案を選ぶと、あなたの 1 週間が動き始めます`
                      : `今日の最初の一手を、あなたの資料を見ながら準備中です`,
                    onClick: () => proactive.generate(settings.voiceEnabled !== false),
                  },
                  {
                    key: 'sales',
                    count: shadow.drafts.length,
                    status: shadow.drafts.length
                      ? `下書き${shadow.drafts.length}通`
                      : '商談を準備',
                    advice: shadow.drafts.length
                      ? `${shadow.drafts.length} 通の返信文が待機中。あなたは送り先を選ぶだけです`
                      : `最初のお客さんを 1 件登録すると、私が下書きをはじめます`,
                    onClick: () => setShowSalesAgent(true),
                  },
                  {
                    key: 'cfo',
                    count: 0,
                    status: '強い月 / 弱い月を分析中',
                    advice: `月別の売上を読み解いて、繁忙期・閑散期と来月の一手を助言します`,
                    onClick: () => setShowFinConsult(true),
                  },
                  {
                    key: 'creative',
                    count: 0,
                    status: '原稿を考案中',
                    advice: `note や X に出す原稿を、あなたの資料から自動で書き起こせます`,
                    onClick: () => setShowContentEngine(true),
                  },
                  {
                    key: 'knowledge',
                    count: personaKnowledge.length,
                    status: personaKnowledge.length
                      ? `資料${personaKnowledge.length}件 読了`
                      : '資料を待機中',
                    advice: personaKnowledge.length
                      ? `あなたの ${personaKnowledge.length} 件の資料を読み込み済み。次の提案に必ず反映します`
                      : `最初の 1 件を入れると、私の精度が一気に上がります`,
                    onClick: () => setShowKnowledge(true),
                  },
                  {
                    key: 'people',
                    count: persona.tasks.filter(t => !t.done).length,
                    status: persona.tasks.filter(t => !t.done).length
                      ? `タスク${persona.tasks.filter(t => !t.done).length}件`
                      : 'チームを観察',
                    advice: persona.tasks.filter(t => !t.done).length
                      ? `今日のうちに片付けたい ${persona.tasks.filter(t => !t.done).length} 件、順番を整えました`
                      : `チームメンバーを 1 人登録すると、1on1 の準備をはじめます`,
                    onClick: () => setShowPeople(true),
                  },
                  {
                    key: 'life',
                    count: healthCtx.today ? 1 : 0,
                    status: healthCtx.today
                      ? `睡眠${healthCtx.today.sleepHours?.toFixed(1) ?? '?'}h`
                      : 'カラダを見守り中',
                    advice: healthCtx.today
                      ? `睡眠 ${healthCtx.today.sleepHours?.toFixed(1) ?? '?'} 時間、いいリズム。午後の集中時間は 14〜15 時がおすすめ`
                      : `iPhone のショートカットを入れると、毎朝あなたのカラダを見守れます`,
                    onClick: () => setShowHealth(true),
                  },
                ]}
              />

              {/*
                AutoAgentHero (今日のひと言) はオーナー指示で削除 (2026-05-16)。
                JSON parse エラーが恒常的に出ていたため。
                その美しい紫紺グラデの世界観だけを TodayBrief のラッパーに引き継ぐ。
              */}
              <div style={{
                position: 'relative',
                padding: '1.4rem 1.2rem 1.2rem',
                borderRadius: 22,
                background: 'linear-gradient(135deg, rgba(46,111,255,0.10), rgba(142,92,255,0.10) 50%, rgba(232,75,151,0.08))',
                border: '1px solid rgba(142,92,255,0.25)',
                overflow: 'hidden',
              }}>
                {/* 装飾オーブ (右上) */}
                <div aria-hidden style={{
                  position: 'absolute', top: -60, right: -60,
                  width: 220, height: 220, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(232,75,151,0.35) 0%, transparent 70%)',
                  filter: 'blur(40px)', pointerEvents: 'none',
                }} />
                {/* 装飾オーブ (左下) */}
                <div aria-hidden style={{
                  position: 'absolute', bottom: -50, left: -50,
                  width: 180, height: 180, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(46,111,255,0.30) 0%, transparent 70%)',
                  filter: 'blur(40px)', pointerEvents: 'none',
                }} />

                {/* ヘッダ — 旧 AutoAgentHero の見た目を踏襲 */}
                <div style={{ position: 'relative', zIndex: 1, marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <span style={{ color: '#E84B97', fontSize: 14, lineHeight: 1 }}>✦</span>
                    <span style={{
                      fontSize: 10, letterSpacing: '0.3em', fontWeight: 800,
                      color: '#E84B97', textTransform: 'uppercase',
                    }}>
                      PRISM からの今日のひと言
                    </span>
                  </div>
                  <h2 style={{
                    margin: 0,
                    fontFamily: '"Cinzel", "Noto Serif JP", serif', fontStyle: 'italic',
                    fontSize: 'clamp(1.5rem, 4.5vw, 2rem)',
                    fontWeight: 500, lineHeight: 1.2,
                    background: 'linear-gradient(135deg, #2E6FFF 0%, #8E5CFF 50%, #E84B97 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    letterSpacing: '-0.01em',
                  }}>
                    今日、何からはじめる?
                  </h2>
                  <p style={{
                    margin: '0.3rem 0 0',
                    fontSize: 12.5, color: 'var(--fg-muted)',
                    lineHeight: 1.6,
                  }}>
                    いまのあなたを見て、AI が次の一手を準備しました。
                  </p>
                </div>

                {/* 中身は TodayBrief。背景は親の紫紺グラデで美しく */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <TodayBrief
                    persona={persona}
                    proposal={briefOverride ?? proactive.latestProposal}
                    isGenerating={proactive.isGenerating || coach.isGenerating}
                    isSpeaking={proactive.isSpeaking}
                    voiceEnabled={settings.voiceEnabled !== false}
                    onGenerate={(v) => { setBriefOverride(null); proactive.generate(v); }}
                    onSpeak={proactive.speakProposal}
                    onStopSpeak={proactive.stopSpeak}
                    onAcceptAction={onAcceptProactiveAction}
                    shadowDraftCount={shadow.drafts.length}
                    onOpenShadow={() => setShowShadow(true)}
                  />
                </div>

                {/* AI 会社フロー — 「承認して実行」で 13 CXO のうち関係者が動く */}
                {(briefOverride ?? proactive.latestProposal) && (() => {
                  const p = briefOverride ?? proactive.latestProposal;
                  if (!p) return null;
                  const text = (p.title + ' ' + (p.message || '')).toLowerCase();
                  const steps: Array<{ cxo: PrismCxoRole; label: string }> = [];
                  if (/提案|営業|商談|顧客|アプローチ/i.test(text)) {
                    steps.push({ cxo: 'CDS', label: 'ナレッジから関連情報を抽出' });
                    steps.push({ cxo: 'CSO', label: '提案先と切り口を選定' });
                    steps.push({ cxo: 'CMO', label: '提案文を AI 生成' });
                    steps.push({ cxo: 'CTO', label: '送信準備を整える' });
                  } else if (/議事録|会議|meeting/i.test(text)) {
                    steps.push({ cxo: 'CDS', label: '音声/メモから論点を抽出' });
                    steps.push({ cxo: 'CPO', label: 'アクション項目を構造化' });
                    steps.push({ cxo: 'CMO', label: '議事録ドラフトを書く' });
                    steps.push({ cxo: 'COO', label: 'ナレッジに保存' });
                  } else if (/財務|経費|売上|p&l|予算/i.test(text)) {
                    steps.push({ cxo: 'CFO', label: '数字を集計' });
                    steps.push({ cxo: 'CDS', label: '異常値を検出' });
                    steps.push({ cxo: 'CPO', label: '対策案を 3 つ整理' });
                  } else if (/契約|nda|規約|法務/i.test(text)) {
                    steps.push({ cxo: 'CLO', label: '条文をレビュー' });
                    steps.push({ cxo: 'CPO', label: '修正点を整理' });
                    steps.push({ cxo: 'CMO', label: '相手側への返信を生成' });
                  } else {
                    steps.push({ cxo: 'CPO', label: '実行計画を組み立て' });
                    steps.push({ cxo: 'CMO', label: '必要な文章を生成' });
                    steps.push({ cxo: 'CDS', label: '効果を測定' });
                  }
                  return (
                    <div style={{ position: 'relative', zIndex: 1, marginTop: 12 }}>
                      <PrismProposalCard
                        brand="prism"
                        dedupeKey={`prism_${(p as { id?: string }).id || p.title.slice(0, 12)}`}
                        proposal={{
                          title: p.title,
                          summary: p.message || '',
                          why: (p as { context?: string }).context || undefined,
                          dueDays: 7,
                          steps,
                        }}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Stripe 未連携時のみ表示: 「30 秒で売上が見える」CTA */}
              <StripeConnectHero
                onOpenIntegrations={() => {
                  setIntegrationsFocusId('stripe');
                  setShowIntegrations(true);
                }}
              />

              <QuickActions
                persona={persona}
                actions={[
                  { id: 'brief', emoji: '💡', label: '次の一手を出す', desc: 'AI が今やる事を提案', primary: true, onClick: () => proactive.generate(settings.voiceEnabled !== false) },
                  { id: 'voice', emoji: '🎙', label: '話してメモ', desc: '声を録ると要点を整理', onClick: () => setShowVoice(true) },
                  { id: 'youtube', emoji: '🎦', label: '動画を学びに', desc: 'YouTube を要約して保存', onClick: () => setShowYouTube(true) },
                  { id: 'shadow', emoji: '📬', label: '返信下書きを見る', desc: `AI が先に書いた返信案${shadow.drafts.length > 0 ? ` (${shadow.drafts.length})` : ''}`, onClick: () => setShowShadow(true) },
                  { id: 'kb', emoji: '📚', label: '資料を読ませる', desc: 'PDF・PPT・画像を取込', onClick: () => setShowKnowledge(true) },
                  { id: 'note', emoji: '📝', label: 'ノートを書く', desc: '思いつき・議事録をメモ', onClick: () => setShowKnowledge(true) },
                  { id: 'minutes', emoji: '🎩', label: '会議を文字に', desc: '録音から議事録を作成', onClick: () => setShowMinutes(true) },
                  { id: 'slides', emoji: '🎨', label: 'スライドを作る', desc: '資料から PowerPoint 生成', onClick: () => setShowSlides(true) },
                  { id: 'nego', emoji: '🤝', label: '交渉を練習', desc: 'AI 相手に本番前リハ', onClick: () => setShowNego(true) },
                  { id: 'decision', emoji: '💭', label: '迷いを整理', desc: '選択肢を比べて決める', onClick: () => setShowDecision(true) },
                  { id: 'email', emoji: '📬', label: 'メールを片付け', desc: 'まとめて仕分け・返信案', onClick: () => setShowEmail(true) },
                  { id: 'post', emoji: '📢', label: 'SNS投稿を書く', desc: 'note・X の文章を生成', onClick: () => setShowPost(true) },
                  { id: 'image', emoji: '🎨', label: '画像を作る', desc: 'AI で写真・図を生成', onClick: () => setShowImage(true) },
                  { id: 'engine', emoji: '📡', label: '記事を一気に', desc: 'note と X を同時に生成', onClick: () => setShowContentEngine(true) },
                  { id: 'invoice', emoji: '🧾', label: '請求書を作る', desc: 'インボイス対応で発行', onClick: () => setShowInvoice(true) },
                  { id: 'sales', emoji: '📒', label: '売上を記録', desc: '請求書と自動で連動', onClick: () => setShowSales(true) },
                  { id: 'pnl', emoji: '📊', label: '利益を確認', desc: '損益計算書 (P&L) を表示', onClick: () => setShowPnL(true) },
                  { id: 'fin-consult', emoji: '🧮', label: '財務コンサルに相談', desc: '強い月・弱い月を AI が分析', primary: true, onClick: () => setShowFinConsult(true) },
                  { id: 'expense', emoji: '📷', label: '経費を登録', desc: 'レシート撮影で自動入力', onClick: () => setShowExpense(true) },
                  { id: 'benchmark', emoji: '📊', label: '同業と比べる', desc: '業界平均と数字を比較', onClick: () => setShowBenchmark(true) },
                  { id: 'crm', emoji: '🤝', label: '案件を管理', desc: '商談の進み具合を一覧', onClick: () => setShowCRM(true) },
                  { id: 'documents', emoji: '📄', label: '取引書類を作る', desc: '見積→発注→納品→請求', onClick: () => setShowDocument(true) },
                  { id: 'people', emoji: '👥', label: '人を気づかう', desc: '1on1 履歴を AI が分析', onClick: () => setShowPeople(true) },
                  { id: 'team', emoji: '🤺', label: 'メンバーを招く', desc: '仲間と画面を共有', onClick: () => setShowTeam(true) },
                  { id: 'sales-agent', emoji: '🎯', label: '今日の商談準備', desc: 'AI が攻める 5 社を提案', primary: true, onClick: () => setShowSalesAgent(true) },
                  { id: 'saas-agent', emoji: '🤖', label: 'アプリ操作を任す', desc: 'Notion・Gmail を代理操作', primary: true, onClick: () => setShowSaasAgent(true) },
                  { id: 'integrations', emoji: '🔗', label: '連携センター', desc: 'Gmail・Watch を 3 ステップで', primary: true, onClick: () => setShowIntegrations(true) },
                  { id: 'tasks-hub', emoji: '✅', label: 'やる事を一覧', desc: '全タスクをここに集約', onClick: () => setShowTaskHub(true) },
                  { id: 'premium', emoji: '👑', label: '専門 AI に相談', desc: '戦略・法務・財務のプロ', primary: true, onClick: () => setShowPremium(true) },
                  { id: 'meet', emoji: '📅', label: '会議を予約', desc: 'カレンダーにリンク発行', onClick: () => setShowMeeting(true) },
                  { id: 'health', emoji: '🩺', label: '体調を確認', desc: '睡眠・活動をまとめて表示', onClick: () => setShowHealth(true) },
                ]}
              />

              {/* 健康が積み上がっている実感を見せる (オーナー指示 2026-05-17) */}
              <WellnessTracker
                today={healthCtx.today}
                accent="#8E5CFF"
                accentSoft="rgba(142,92,255,0.10)"
                onConnectHealth={() => setShowHealth(true)}
              />

              <TodaysBodyCard email={loadBillingUser()?.email ?? ''} />

              <HealthSnapshot
                today={healthCtx.today}
                week={healthCtx.week}
                anomalies={healthCtx.anomalies}
                onOpen={() => setShowHealth(true)}
              />

              {/* 認知プロファイルと回復スコアを横並びに (右の余白解消・高さ揃え) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
                <div className="h-full [&>*]:h-full">
                  <PrismFlow
                    persona={persona}
                    knowledgeCount={personaKnowledge.length}
                    taskCount={{
                      open: persona.tasks.filter(t => !t.done).length,
                      done: persona.tasks.filter(t => t.done).length,
                    }}
                    proposalCount={proactive.proposals.length}
                  />
                </div>
                <div className="h-full [&>*]:h-full">
                  <MomentPulse
                    persona={persona}
                    today={healthCtx.today}
                    week={healthCtx.week}
                    taskOpen={persona.tasks.filter(t => !t.done).length}
                    taskDone={persona.tasks.filter(t => t.done).length}
                  />
                </div>
              </div>
              <InsightsStream
                persona={persona}
                items={personaKnowledge}
                onAcceptAction={onAcceptProactiveAction}
                onOpenKnowledge={() => setShowKnowledge(true)}
              />

              <div className="flex gap-1.5">
                {[['files', `📄 資料 (${personaKnowledge.length})`], ['tasks', `✓ タスク (${persona.tasks.filter(t => !t.done).length})`]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as 'files' | 'tasks')}
                    className={`text-sm px-3.5 py-2 rounded-lg transition-all font-medium ${activeTab === id ? '' : 'bg-surface-3 border-edge text-fg-muted'}`}
                    style={activeTab === id ? {
                      background: persona.accentColorLight,
                      color: persona.accentColor,
                      border: `1px solid ${persona.accentColor}50`,
                    } : { border: '1px solid var(--border)' }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === 'files' && (
                  <motion.div
                    key="files"
                    className="p-3 rounded-xl bg-surface-3 border-edge border"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {personaKnowledge.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-fg-muted text-sm mb-2">まだ資料がありません</p>
                        <button
                          onClick={() => setShowKnowledge(true)}
                          className="text-sm px-4 py-2 rounded-lg transition-all"
                          style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
                        >
                          ＋ 最初の資料を追加
                        </button>
                        {!isDemoActive() && (
                          <div className="mt-3">
                            <SampleDataCTA
                              accent={persona.accentColor}
                              hint="本物そっくりのサンプルで、今すぐ全機能を試せます（あとで消せます）"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {personaKnowledge.slice(0, 5).map((item, i) => (
                          <motion.div
                            key={item.id}
                            className="flex items-start gap-2 group cursor-pointer p-1.5 rounded-lg hover:bg-white/5"
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => setShowKnowledge(true)}
                          >
                            <FileIcon type={item.sourceType} />
                            <div className="flex-1 min-w-0">
                              <p className="text-fg text-sm truncate transition-colors">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {item.tags.slice(0, 3).map(tag => (
                                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded" style={{ background: persona.accentColorLight, color: persona.accentColor }}>{tag}</span>
                                ))}
                                {(item.analysisStatus === 'pending' ||
                                  item.analysisStatus === 'parsing' ||
                                  item.analysisStatus === 'tagging' ||
                                  item.analysisStatus === 'summarizing' ||
                                  item.analysisStatus === 'extracting') && (
                                  <span className="text-xs" style={{ color: persona.accentColor }}>
                                    🧠 {item.analysisStatus === 'parsing' ? 'ファイル解析中'
                                      : item.analysisStatus === 'tagging' ? 'タグ生成中'
                                      : item.analysisStatus === 'summarizing' ? 'AI 要約中'
                                      : item.analysisStatus === 'extracting' ? '数字を抽出中'
                                      : '分析中'}
                                  </span>
                                )}
                                {item.analysis?.actions && item.analysis.actions.length > 0 && (
                                  <span className="text-xs text-fg-muted">{item.analysis.actions.length}件のアクション</span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        {personaKnowledge.length > 5 && (
                          <button onClick={() => setShowKnowledge(true)} className="text-sm text-fg-muted hover:text-fg transition-colors">
                            他 {personaKnowledge.length - 5} 件を見る →
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'tasks' && (
                  <motion.div
                    key="tasks"
                    className="p-3 rounded-xl bg-surface-3 border-edge border"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    {persona.tasks.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-fg-muted text-sm mb-2">やる事はまだありません</p>
                        <button
                          onClick={() => setShowTaskHub(true)}
                          className="text-sm px-4 py-2 rounded-lg transition-all"
                          style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}40` }}
                        >
                          ＋ 最初のやる事を足す
                        </button>
                        {!isDemoActive() && (
                          <div className="mt-3">
                            <SampleDataCTA
                              accent={persona.accentColor}
                              hint="サンプルのやる事 (営業フォロー・請求書発行など) が入り、優先順位の付け方をすぐ体験できます"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {persona.tasks.map((task, i) => (
                          <motion.button
                            key={task.id}
                            className="w-full flex items-start gap-2 text-left p-1.5 rounded-lg hover:bg-white/5 transition-all"
                            onClick={() => onToggleTask(persona.id, task.id)}
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.04 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="mt-1.5">
                              <PriorityDot priority={task.priority} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm transition-all ${task.done ? 'text-fg-subtle line-through' : 'text-fg'}`}>
                                {task.title}
                              </p>
                              <p className="text-fg-muted text-xs">{task.due}</p>
                            </div>
                            <div className="w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-all mt-0.5"
                              style={{
                                borderColor: task.done ? persona.accentColor : 'var(--border)',
                                background: task.done ? persona.accentColorLight : 'transparent',
                              }}>
                              {task.done && <span style={{ color: persona.accentColor, fontSize: '12px' }}>✓</span>}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cashflow */}
              <motion.button
                onClick={() => setFinanceEditFor(persona)}
                className="p-3 rounded-xl text-left w-full transition-all hover:brightness-110"
                style={{ background: `linear-gradient(135deg, ${persona.accentColor}15, var(--surface-3))`, border: `1px solid ${persona.accentColor}40` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.005 }}
                whileTap={{ scale: 0.995 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-fg-muted text-xs tracking-widest uppercase" style={{ color: stripeActive ? '#635BFF' : undefined }}>
                    {stripeActive && '⚡ '}
                    {displayLabel}
                  </p>
                  <span className="text-[10px] text-fg-muted">{stripeActive ? '自動連動' : '編集 ✎'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    {displayIncome > 0 && (
                      <span className="text-xl font-light" style={{ color: '#34d399' }}>
                        +¥{(displayIncome / 10000).toFixed(0)}万
                      </span>
                    )}
                    {displayExpense < 0 && (
                      <span className="text-base font-light text-fg-muted">
                        -¥{(Math.abs(displayExpense) / 10000).toFixed(0)}万
                      </span>
                    )}
                    {displayIncome === 0 && displayExpense === 0 && (
                      <span className="text-fg-muted text-sm">
                        {stripe.connected
                          ? '今月の Stripe 取引はまだ 0 件です'
                          : 'クリックして資料から自動抜出 / 手入力 / Stripe をつなぐ'}
                      </span>
                    )}
                  </div>
                  <div className="text-right px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: persona.accentColorLight }}>
                    <p className="text-[10px] text-fg-muted">純収支</p>
                    <p className="text-base font-medium" style={{ color: net >= 0 ? '#34d399' : '#f87171' }}>
                      {net >= 0 ? '+' : ''}¥{(net / 10000).toFixed(0)}万
                    </p>
                  </div>
                </div>
              </motion.button>

              <ActivityTimeline
                persona={persona}
                knowledge={personaKnowledge}
                proposals={proactive.proposals}
              />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Right Panel (desktop) */}
      <div className="hidden md:flex w-64 flex-col flex-shrink-0" style={{ borderLeft: '1px solid rgba(255,255,255,0.04)' }}>
        {lastBenchmark && (
          <motion.button
            onClick={() => setShowBenchmark(true)}
            className="mx-3 mt-3 p-2.5 rounded-xl text-left transition-all"
            style={{ background: `${persona.accentColor}12`, border: `1px solid ${persona.accentColor}35` }}
            whileHover={{ scale: 1.02 }}
            title="業界ベンチマークを開く"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-fg-muted">{lastBenchmark.industryLabel}業界</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                上位 {100 - lastBenchmark.overallPercentile}%
              </span>
            </div>
            <p className="text-fg-muted text-[10px] mt-0.5 truncate">{lastBenchmark.rankings.length} KPI 分析済み ・ タップで詳細</p>
          </motion.button>
        )}
        <div className="overflow-y-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', maxHeight: '42%' }}>
          <div className="p-3">
            {/*
              CORE 事業の売上カードはここから撤去 (オーナー指摘 2026-05-18):
              ペルソナの経営ダッシュボードに「CORE という商品の売上」が混ざるのは
              文脈がズレている。マスター専用の経営画面へ移設予定。
            */}
            <CognitiveDashboard activeId={persona.id} personas={allPersonas} onEditFinance={setFinanceEditFor} onOpenIntegrations={() => setShowIntegrations(true)} />
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <AISidebar
            persona={persona}
            messages={chatMessages}
            settings={settings}
            onSend={onSendMessage}
            isLoading={isChatLoading}
            error={chatError}
            knowledgeCount={personaKnowledge.length}
            knowledgeItems={personaKnowledge}
            onOpenKnowledge={() => setShowKnowledge(true)}
            onOpenSettings={onOpenSettings}
          />
        </div>
      </div>

      {/* Mobile AI sheet */}
      <AnimatePresence>
        {showMobileAI && (
          <>
            <motion.div
              className="fixed inset-0 z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileAI(false)}
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            />
            <motion.div
              className="fixed inset-x-0 bottom-0 z-50 md:hidden flex flex-col rounded-t-2xl overflow-hidden"
              style={{
                height: '92dvh',
                background: 'var(--bg, #0a0a0a)',
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-fg text-sm">💬 AIチャット</span>
                </div>
                <button
                  onClick={() => setShowMobileAI(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-fg-muted hover:text-fg text-lg leading-none"
                  aria-label="閉じる"
                >
                  ×
                </button>
              </div>
              <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: '30%', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="p-3">
                  <CognitiveDashboard activeId={persona.id} personas={allPersonas} onEditFinance={setFinanceEditFor} onOpenIntegrations={() => setShowIntegrations(true)} />
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <AISidebar
                  persona={persona}
                  messages={chatMessages}
                  settings={settings}
                  onSend={onSendMessage}
                  isLoading={isChatLoading}
                  error={chatError}
                  knowledgeCount={personaKnowledge.length}
                  knowledgeItems={personaKnowledge}
                  onOpenKnowledge={() => setShowKnowledge(true)}
                  onOpenSettings={onOpenSettings}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Overlays — 重い Studio は React.lazy で必要な時だけ読み込む */}
      <AnimatePresence>
        <Suspense fallback={null}>
        {showKnowledge && (
          <KnowledgeBase
            key="kb"
            persona={persona}
            settings={settings}
            items={personaKnowledge}
            onAddFile={onAddKnowledgeFile}
            onAddNote={onAddKnowledgeNote}
            onDelete={onDeleteKnowledge}
            onReanalyze={onReanalyzeKnowledge}
            onClose={() => setShowKnowledge(false)}
          />
        )}
        {showMeeting && (
          <MeetingHub key="meet" persona={persona} onClose={() => setShowMeeting(false)} />
        )}
        {showHealth && (
          <HealthHub
            key="health"
            persona={persona}
            settings={settings}
            onClose={() => setShowHealth(false)}
          />
        )}
        {showMinutes && (
          <MeetingMinutesModal
            key="minutes"
            persona={persona}
            settings={settings}
            onClose={() => setShowMinutes(false)}
            onSaveAsKnowledge={(t, c) => onAddKnowledgeNote(t, c)}
            onAcceptAction={onAcceptProactiveAction}
          />
        )}
        {showSlides && (
          <SlideGeneratorModal
            key="slides"
            persona={persona}
            settings={settings}
            knowledge={knowledgeForAgent}
            onClose={() => setShowSlides(false)}
          />
        )}
        {showNego && (
          <NegotiationCoachModal
            key="nego"
            persona={persona}
            settings={settings}
            onClose={() => setShowNego(false)}
          />
        )}
        {showDecision && (
          <DecisionMemoModal
            key="decision"
            persona={persona}
            settings={settings}
            knowledge={knowledgeForAgent}
            onClose={() => setShowDecision(false)}
            onSaveAsKnowledge={(t, c) => onAddKnowledgeNote(t, c)}
          />
        )}
        {showEmail && (
          <EmailTriageModal
            key="email"
            persona={persona}
            settings={settings}
            onClose={() => setShowEmail(false)}
            onAcceptAction={onAcceptProactiveAction}
          />
        )}
        {showPremium && (
          <PremiumHubModal
            key="premium"
            persona={persona}
            settings={settings}
            knowledge={knowledgeForAgent}
            onClose={() => setShowPremium(false)}
            onSaveAsKnowledge={(t, c) => onAddKnowledgeNote(t, c)}
          />
        )}
        {showPost && (
          <AutoPostStudio
            key="post"
            persona={persona}
            settings={settings}
            knowledge={knowledgeForAgent}
            onClose={() => setShowPost(false)}
            onSaveAsKnowledge={(t, c) => onAddKnowledgeNote(t, c)}
          />
        )}
        {showContentEngine && (
          <ContentEngineStudio
            key="content-engine"
            persona={persona}
            settings={settings}
            knowledge={knowledgeForAgent}
            onClose={() => setShowContentEngine(false)}
          />
        )}
        {showInvoice && (
          <InvoiceStudio
            key="invoice"
            persona={persona}
            settings={settings}
            onClose={() => setShowInvoice(false)}
          />
        )}
        {showImage && (
          <ImageStudio
            key="image"
            persona={persona}
            settings={settings}
            onClose={() => setShowImage(false)}
            onSaveAsKnowledge={(t, c) => onAddKnowledgeNote(t, c)}
          />
        )}
        {showSales && (
          <SalesLedger
            key="sales"
            persona={persona}
            onClose={() => setShowSales(false)}
          />
        )}
        {showExpense && (
          <ExpenseStudio
            key="expense"
            persona={persona}
            settings={settings}
            onClose={() => setShowExpense(false)}
          />
        )}
        {showCRM && (
          <CRMStudio
            key="crm"
            persona={persona}
            onClose={() => setShowCRM(false)}
          />
        )}
        {showTaskHub && (
          <TaskHub
            key="taskhub"
            persona={persona}
            knowledge={knowledgeForAgent}
            onToggleTask={onToggleTask}
            onAcceptAction={onAcceptProactiveAction}
            onClose={() => setShowTaskHub(false)}
          />
        )}
        {showPnL && (
          <PnLStudio
            key="pnl"
            persona={persona}
            onClose={() => setShowPnL(false)}
          />
        )}
        {showFinConsult && (
          <FinancialConsultant
            key="fin-consult"
            persona={persona}
            settings={settings}
            onClose={() => setShowFinConsult(false)}
          />
        )}
        {showBenchmark && (
          <BenchmarkStudio
            key="benchmark"
            persona={persona}
            settings={settings}
            onClose={() => setShowBenchmark(false)}
          />
        )}
        {showVoice && (
          <VoiceCaptureStudio
            key="voice"
            persona={persona}
            settings={settings}
            onClose={() => setShowVoice(false)}
            onAddKnowledgeNote={onAddKnowledgeNote}
          />
        )}
        {showSalesAgent && (
          <SalesAgentStudio
            key="sales-agent"
            persona={persona}
            settings={settings}
            onClose={() => setShowSalesAgent(false)}
          />
        )}
        {showIntegrations && (
          <IntegrationCenter
            key="integration-center"
            accent={persona.accentColor}
            focusToolId={integrationsFocusId}
            onClose={() => { setShowIntegrations(false); setIntegrationsFocusId(undefined); }}
          />
        )}
        {showSaasAgent && (
          <SaasAgentStudio
            key="saas-agent"
            persona={persona}
            settings={settings}
            onClose={() => setShowSaasAgent(false)}
          />
        )}
        {showYouTube && (
          <YouTubeImportStudio
            key="youtube"
            persona={persona}
            settings={settings}
            onClose={() => setShowYouTube(false)}
            onSaveAsKnowledge={(t, c) => onAddKnowledgeNote(t, c)}
          />
        )}
        {showDocument && (
          <DocumentStudio
            key="document"
            persona={persona}
            settings={settings}
            onClose={() => setShowDocument(false)}
          />
        )}
        {showPeople && (
          <PeopleStudio
            key="people"
            persona={persona}
            settings={settings}
            onClose={() => setShowPeople(false)}
          />
        )}
        {showShadow && (
          <ShadowSecretaryPanel
            key="shadow"
            persona={persona}
            drafts={shadow.drafts}
            isPolling={shadow.isPolling}
            lastPolledAt={shadow.lastPolledAt}
            onRefresh={shadow.refresh}
            onDismiss={shadow.dismissDraft}
            onSend={shadow.sendDraft}
            onClose={() => setShowShadow(false)}
          />
        )}
        {showTeam && (
          <TeamHub
            key="team"
            accentColor={persona.accentColor}
            onClose={() => setShowTeam(false)}
          />
        )}
        {pendingInviteCode && !showTeam && (
          <AcceptInviteModal
            key="accept-invite"
            code={pendingInviteCode}
            onClose={() => {
              try { sessionStorage.removeItem('pending_invite'); } catch { /* */ }
              window.history.replaceState({}, '', window.location.pathname);
            }}
          />
        )}
        {financeEditFor && (
          <FinanceEditor
            key="finance-editor"
            persona={financeEditFor}
            hasFinancialKnowledge={knowledgeItems.some(i => i.personaId === financeEditFor.id)}
            onSave={(income, expense, label) => onUpdateCashflow(financeEditFor.id, income, expense, label)}
            onRecompute={() => onRecomputeCashflow(financeEditFor.id, financeEditFor.name)}
            onClose={() => setFinanceEditFor(null)}
          />
        )}
        </Suspense>
      </AnimatePresence>

      <AnimatePresence>
        {globalDrag && (
          <motion.div
            className="fixed inset-0 z-[60] pointer-events-none flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              background: `${persona.accentColor}22`,
              backdropFilter: 'blur(8px)',
              outline: `3px dashed ${persona.accentColor}`,
              outlineOffset: '-16px',
            }}
          >
            <div className="text-center">
              <p className="text-6xl mb-4">📥</p>
              <p className="text-white text-2xl font-semibold">どこにでもドロップOK</p>
              <p className="text-white/80 text-sm mt-2">フォルダごと・複数ファイル一括取り込み</p>
              <p className="text-white/60 text-xs mt-1">PDF · Word · Excel · PowerPoint · CSV · 画像 · テキスト</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkProgress && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55] px-5 py-3 rounded-xl shadow-2xl"
            style={{
              background: 'rgba(15,15,25,0.95)',
              border: `1px solid ${persona.accentColor}50`,
              minWidth: '320px',
            }}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{bulkProgress.done === bulkProgress.total ? '✅' : '🧠'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">
                  {bulkProgress.done === bulkProgress.total
                    ? `${bulkProgress.total}ファイル取り込み完了`
                    : `${bulkProgress.done} / ${bulkProgress.total} 取り込み中…`}
                </p>
                {bulkProgress.current && (
                  <p className="text-white/60 text-xs truncate">{bulkProgress.current}</p>
                )}
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <motion.div
                className="h-full"
                style={{ background: persona.accentColor }}
                initial={{ width: 0 }}
                animate={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {settings.proactiveEnabled !== false && proactive.error && (
        <div className="fixed bottom-4 right-4 z-30 max-w-sm w-[calc(100vw-2rem)] md:w-80">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <p className="text-red-300 text-xs">{proactive.error}</p>
          </div>
        </div>
      )}

      <CommandPalette
        open={showCmdK}
        onClose={() => setShowCmdK(false)}
        personas={allPersonas}
        knowledge={knowledgeItems}
        activePersonaId={persona.id}
        onSwitchPersona={onSwitch}
        onOpenModal={handleCmdKOpen}
      />

      <button
        onClick={() => setShowCmdK(true)}
        className="hidden md:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-20 items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
        style={{
          background: 'rgba(20, 20, 30, 0.7)',
          backdropFilter: 'blur(20px)',
          color: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
        title="横断検索 (Cmd+K)"
      >
        <span>🔮</span>
        <span>横断検索</span>
        <span className="cp-pill" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>⌘K</span>
      </button>

      <SupportChat
        brand="prism"
        accentColor={persona.accentColor}
        context={{
          page: 'ダッシュボード',
          personaName: persona.name,
          knowledgeCount: personaKnowledge.length,
        }}
      />

      <ShortcutHelpModal />
      <PwaInstallPrompt accentColor={persona.accentColor} />
      <FeedbackWidget brand="prism" />

      <AnimatePresence>
        {showOnboarding && (
          <OnboardingWizard
            key="onboarding-wizard"
            accentColor={persona.accentColor}
            onComplete={() => setShowOnboarding(false)}
          />
        )}
        {showInvite && (
          <motion.div
            key="invite-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowInvite(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              background: 'rgba(8, 5, 15, 0.72)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}>
            <motion.div
              initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 480 }}>
              <InviteShareCard
                brand="prism"
                palette={{
                  accent: persona.accentColor,
                  ink: '#F4ECFF',
                  inkSoft: 'rgba(244,236,255,0.65)',
                  card: '#1A1426',
                  border: 'rgba(255,255,255,0.10)',
                }}
              />
              <button onClick={() => setShowInvite(false)}
                style={{
                  marginTop: '0.75rem', width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(244,236,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12, padding: '0.7rem',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                }}>
                閉じる
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
