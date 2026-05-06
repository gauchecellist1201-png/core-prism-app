import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Persona, ChatMessage, AppSettings, KnowledgeItem } from '../types/identity';
import ModeSwitcher from './ModeSwitcher';
import CognitiveDashboard from './CognitiveDashboard';
import AISidebar from './AISidebar';
import KnowledgeBase from './KnowledgeBase';
import MeetingHub from './MeetingHub';
import HealthHub from './health/HealthHub';
import { ThemeToggle } from './ThemeToggle';
import TodayBrief from './TodayBrief';
import InsightsStream from './InsightsStream';
import PrismFlow from './PrismFlow';
import MomentPulse from './MomentPulse';
import QuickActions from './QuickActions';
import ActivityTimeline from './ActivityTimeline';
import HealthSnapshot from './HealthSnapshot';
import MeetingMinutesModal from './MeetingMinutes';
import SlideGeneratorModal from './SlideGenerator';
import NegotiationCoachModal from './NegotiationCoach';
import DecisionMemoModal from './DecisionMemo';
import EmailTriageModal from './EmailTriage';
import PremiumHubModal from './PremiumHub';
import FinanceEditor from './FinanceEditor';
import AutoPostStudio from './AutoPostStudio';
import InvoiceStudio from './InvoiceStudio';
import ImageStudio from './ImageStudio';
import SalesLedger from './SalesLedger';
import ExpenseStudio from './ExpenseStudio';
import CRMStudio from './CRMStudio';
import TaskHub from './TaskHub';
import VoiceCaptureStudio from './VoiceCaptureStudio';
import SalesAgentStudio from './SalesAgentStudio';
import YouTubeImportStudio from './YouTubeImportStudio';
import ShadowSecretaryPanel from './ShadowSecretaryPanel';
import { useShadowSecretary } from '../hooks/useShadowSecretary';
import { PrismLogo } from './Logo';
import CommandPalette, { useCommandPaletteHotkey, type ModalKey } from './CommandPalette';
import PnLStudio from './PnLStudio';
import { useProactiveAgent } from '../hooks/useProactiveAgent';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';

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
  const [showInvoice, setShowInvoice] = useState(false);
  const [showImage, setShowImage] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showCRM, setShowCRM] = useState(false);
  const [showTaskHub, setShowTaskHub] = useState(false);
  const [showPnL, setShowPnL] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showSalesAgent, setShowSalesAgent] = useState(false);
  const [showYouTube, setShowYouTube] = useState(false);
  const [showShadow, setShowShadow] = useState(false);
  const [showCmdK, setShowCmdK] = useState(false);
  const [financeEditFor, setFinanceEditFor] = useState<Persona | null>(null);

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
      case 'salesAgent': setShowSalesAgent(true); break;
      case 'settings':  onOpenSettings(); break;
      case 'voice': setShowVoice(true); break;
      case 'youtube': setShowYouTube(true); break;
    }
  }, [onOpenSettings]);
  const [globalDrag, setGlobalDrag] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  const personaKnowledge = knowledgeItems.filter(i => i.personaId === persona.id);
  const net = persona.cashflow.income + persona.cashflow.expense;

  // ダッシュボード全体ドロップ -> 一括取り込み
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
      {/* Persona transition overlay */}
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

      {/* Mobile sidebar drawer */}
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
              <div
                className="hidden md:block text-xs px-2 py-1 rounded-full"
                style={{ background: persona.accentColorLight, color: persona.accentColor, border: `1px solid ${persona.accentColor}30` }}
              >
                起動中
              </div>
            </div>
          </div>

          {/* Ambient glow */}
          <div className="absolute top-0 left-0 right-0 md:left-48 md:right-64 h-40 pointer-events-none opacity-10"
            style={{ background: `radial-gradient(ellipse at top center, ${persona.accentColor} 0%, transparent 70%)` }}
          />

          {/* Content */}
          <div className="flex-1 overflow-auto p-3 md:p-4 relative">
            <div className="max-w-5xl space-y-3">

              {/* 今日のブリーフ - ヒーローカード */}
              <TodayBrief
                persona={persona}
                proposal={proactive.latestProposal}
                isGenerating={proactive.isGenerating}
                isSpeaking={proactive.isSpeaking}
                voiceEnabled={settings.voiceEnabled !== false}
                onGenerate={proactive.generate}
                onSpeak={proactive.speakProposal}
                onStopSpeak={proactive.stopSpeak}
                onAcceptAction={onAcceptProactiveAction}
                shadowDraftCount={shadow.drafts.length}
                onOpenShadow={() => setShowShadow(true)}
              />

              {/* クイックアクション */}
              <QuickActions
                persona={persona}
                actions={[
                  { id: 'brief', emoji: '💡', label: '提案を生成', desc: 'AI が次の一手', primary: true, onClick: () => proactive.generate(settings.voiceEnabled !== false) },
                  { id: 'voice', emoji: '🎤', label: '音声メモ', desc: 'AI が自動振り分け', onClick: () => setShowVoice(true) },
                  { id: 'youtube', emoji: '🎬', label: 'YouTube取込', desc: 'AI要約→ナレッジ化', onClick: () => setShowYouTube(true) },
                  { id: 'shadow', emoji: '📬', label: '下書き済み', desc: `AI 事前下書き${shadow.drafts.length > 0 ? ` (${shadow.drafts.length})` : ''}`, onClick: () => setShowShadow(true) },
                  { id: 'kb', emoji: '📚', label: '資料を追加', desc: 'PDF / PPT / 画像', onClick: () => setShowKnowledge(true) },
                  { id: 'note', emoji: '📝', label: 'ノート作成', desc: 'メモ・議事録', onClick: () => setShowKnowledge(true) },
                  { id: 'minutes', emoji: '🎙', label: '議事録 AI', desc: '録音→構造化', onClick: () => setShowMinutes(true) },
                  { id: 'slides', emoji: '🎨', label: 'スライド生成', desc: '資料→PPTX', onClick: () => setShowSlides(true) },
                  { id: 'nego', emoji: '🤝', label: '交渉コーチ', desc: 'AIと練習', onClick: () => setShowNego(true) },
                  { id: 'decision', emoji: '💭', label: '意思決定', desc: '構造化判断', onClick: () => setShowDecision(true) },
                  { id: 'email', emoji: '📬', label: 'メール処理', desc: '一括トリアージ', onClick: () => setShowEmail(true) },
                  { id: 'post', emoji: '📢', label: '投稿生成', desc: 'note / X', onClick: () => setShowPost(true) },
                  { id: 'image', emoji: '🎨', label: '画像生成', desc: 'AI ビジュアル', onClick: () => setShowImage(true) },
                  { id: 'invoice', emoji: '🧾', label: '請求書', desc: 'インボイス対応', onClick: () => setShowInvoice(true) },
                  { id: 'sales', emoji: '📒', label: '売上台帳', desc: '請求書と連動', onClick: () => setShowSales(true) },
                  { id: 'pnl', emoji: '📊', label: 'P&L', desc: '損益計算書', onClick: () => setShowPnL(true) },
                  { id: 'expense', emoji: '📷', label: '経費 / OCR', desc: 'レシート読取', onClick: () => setShowExpense(true) },
                  { id: 'crm', emoji: '🤝', label: 'CRM', desc: '案件パイプライン', onClick: () => setShowCRM(true) },
                  { id: 'sales-agent', emoji: '🎯', label: '商談 AI', desc: 'リサーチ→アプローチ自動化', primary: true, onClick: () => setShowSalesAgent(true) },
                  { id: 'tasks-hub', emoji: '✅', label: 'タスクハブ', desc: '全タスク統合', onClick: () => setShowTaskHub(true) },
                  { id: 'premium', emoji: '👑', label: 'プレミアム', desc: '戦略 / 法務 / 財務', primary: true, onClick: () => setShowPremium(true) },
                  { id: 'meet', emoji: '📅', label: '会議リンク', desc: 'Calendar', onClick: () => setShowMeeting(true) },
                  { id: 'health', emoji: '🩺', label: 'ヘルス', desc: '健康ダッシュボード', onClick: () => setShowHealth(true) },
                ]}
              />

              {/* ヘルススナップショット */}
              <HealthSnapshot
                today={healthCtx.today}
                week={healthCtx.week}
                anomalies={healthCtx.anomalies}
                onOpen={() => setShowHealth(true)}
              />

              {/* 2列レイアウト: 認知プロファイル + インサイト (デスクトップ) */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2 space-y-3">
                  <PrismFlow
                    persona={persona}
                    knowledgeCount={personaKnowledge.length}
                    taskCount={{
                      open: persona.tasks.filter(t => !t.done).length,
                      done: persona.tasks.filter(t => t.done).length,
                    }}
                    proposalCount={proactive.proposals.length}
                  />
                  <MomentPulse
                    persona={persona}
                    today={healthCtx.today}
                    week={healthCtx.week}
                    taskOpen={persona.tasks.filter(t => !t.done).length}
                    taskDone={persona.tasks.filter(t => t.done).length}
                  />
                </div>
                <div className="lg:col-span-3">
                  <InsightsStream
                    persona={persona}
                    items={personaKnowledge}
                    onAcceptAction={onAcceptProactiveAction}
                    onOpenKnowledge={() => setShowKnowledge(true)}
                  />
                </div>
              </div>

              {/* Tabs: Files / Tasks */}
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
                                {item.analysisStatus === 'pending' && (
                                  <span className="text-xs" style={{ color: persona.accentColor }}>🧠 分析中</span>
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
                      <p className="text-fg-muted text-sm text-center py-6">タスクなし</p>
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
                  <p className="text-fg-muted text-xs tracking-widest uppercase">{persona.cashflow.label}</p>
                  <span className="text-[10px] text-fg-muted">編集 ✎</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    {persona.cashflow.income > 0 && (
                      <span className="text-xl font-light" style={{ color: '#34d399' }}>
                        +¥{(persona.cashflow.income / 10000).toFixed(0)}万
                      </span>
                    )}
                    {persona.cashflow.expense < 0 && (
                      <span className="text-base font-light text-fg-muted">
                        -¥{(Math.abs(persona.cashflow.expense) / 10000).toFixed(0)}万
                      </span>
                    )}
                    {persona.cashflow.income === 0 && persona.cashflow.expense === 0 && (
                      <span className="text-fg-muted text-sm">クリックして資料から自動抽出 / 手入力</span>
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

              {/* 最近の動き */}
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
        <div className="overflow-y-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', maxHeight: '42%' }}>
          <div className="p-3">
            <CognitiveDashboard activeId={persona.id} personas={allPersonas} onEditFinance={setFinanceEditFor} />
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
                  <CognitiveDashboard activeId={persona.id} personas={allPersonas} onEditFinance={setFinanceEditFor} />
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
                  onOpenKnowledge={() => setShowKnowledge(true)}
                  onOpenSettings={onOpenSettings}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <AnimatePresence>
        {showKnowledge && (
          <KnowledgeBase
            key="kb"
            persona={persona}
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
        {showYouTube && (
          <YouTubeImportStudio
            key="youtube"
            persona={persona}
            settings={settings}
            onClose={() => setShowYouTube(false)}
            onSaveAsKnowledge={(t, c) => onAddKnowledgeNote(t, c)}
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
      </AnimatePresence>

      {/* グローバル ドラッグオーバーレイ */}
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

      {/* 一括取り込み進捗トースト */}
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

      {/* 履歴・エラー専用の小型パネル (履歴ボタン用) */}
      {settings.proactiveEnabled !== false && proactive.error && (
        <div className="fixed bottom-4 right-4 z-30 max-w-sm w-[calc(100vw-2rem)] md:w-80">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <p className="text-red-300 text-xs">{proactive.error}</p>
          </div>
        </div>
      )}

      {/* 横断検索 Cmd+K */}
      <CommandPalette
        open={showCmdK}
        onClose={() => setShowCmdK(false)}
        personas={allPersonas}
        knowledge={knowledgeItems}
        activePersonaId={persona.id}
        onSwitchPersona={onSwitch}
        onOpenModal={handleCmdKOpen}
      />

      {/* Cmd+K ヒントボタン */}
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
    </motion.div>
  );
}
