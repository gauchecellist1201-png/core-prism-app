import { useState, useCallback } from 'react';
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
import LegalModal, { type LegalKind } from './components/LegalModal';
import { PrismBackground } from './components/PrismBackground';
import { useTheme } from './hooks/useTheme';
import IrisApp from './iris/IrisApp';

import type { AppSettings, ChatMessage } from './types/identity';

type View = 'landing' | 'onboarding' | 'selection' | 'dashboard';

const APP_ENTERED_KEY = 'core_app_entered_v1';

function hasEnteredApp(): boolean {
  // URL ?app=1 か、過去にアプリを開いたことがあれば常にアプリ
  if (typeof window !== 'undefined') {
    if (window.location.search.includes('app=1')) return true;
    if (window.location.pathname.startsWith('/app')) return true;
  }
  return localStorage.getItem(APP_ENTERED_KEY) === 'true';
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

export default function App() {
  // CORE Iris (姉妹ブランド) ルート — /iris で別ブランドを起動
  if (isIrisPath()) {
    return <IrisApp />;
  }

  // Theme初期化 (ライト既定)
  useTheme();
  const { settings, updateSettings, updateUsageStats, resetStats } = useSettings();
  const { personas, activePersona, createPersona, selectPersona, toggleTask, addTask, updateCashflow } = usePersonas();
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
  const [showSettings, setShowSettings] = useState(false);
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null);

  const handleEnterApp = useCallback(() => {
    markAppEntered();
    setView(settings.onboardingComplete ? 'selection' : 'onboarding');
  }, [settings.onboardingComplete]);

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
    createPersona(name, subtitle, icon, description, accentColor, accentColorLight);
    setShowPersonaCreator(false);
  }, [createPersona]);

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
      <PrismBackground intensity="low" />
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <LandingPage
            key="landing"
            onEnterApp={handleEnterApp}
            onOpenLegal={(k) => setLegalKind(k)}
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
            onSave={handleCreatePersona}
            onCancel={() => setShowPersonaCreator(false)}
          />
        )}
        {showSettings && (
          <SettingsModal
            key="settings"
            settings={settings}
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
    </>
  );
}
