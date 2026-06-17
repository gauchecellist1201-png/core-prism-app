// ============================================================
// 能動提案フック: 自動生成 + 音声再生 + 履歴保存
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { AppSettings, Persona, KnowledgeItem, Proposal } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { generateProposal } from '../lib/proactiveAgent';
import { getCrossServiceSummary } from '../lib/crossServiceData';
import { speakNatural, stopSpeakingNatural, loadVoices } from '../lib/tts';

const STORAGE_KEY = 'core_proposals';
const MAX_HISTORY = 20;

function load(): Proposal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(proposals: Proposal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals.slice(0, MAX_HISTORY)));
}

interface HealthCtx {
  today: DailyHealth | null;
  week: DailyHealth[];
  anomalies: HealthAnomaly[];
}

export function useProactiveAgent(
  settings: AppSettings,
  persona: Persona | null,
  knowledge: KnowledgeItem[],
  health?: HealthCtx,
) {
  const [proposals, setProposals] = useState<Proposal[]>(load);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastGenAtRef = useRef<number>(0);

  useEffect(() => { save(proposals); }, [proposals]);

  const personaProposals = persona
    ? proposals.filter(p => p.personaId === persona.id && !p.dismissed)
    : [];
  const latestProposal = personaProposals[0] ?? null;

  const generate = useCallback(async (forceVoice = false, patrolMode: 'morning' | 'evening' | null = null) => {
    if (!persona) return null;
    if (isGenerating) return null;
    setIsGenerating(true);
    setError(null);
    try {
      // Iris(Instagram実データ)/Resonance(LINE配信) を提案の根拠に織り込む (司令塔)
      const extraContext = await getCrossServiceSummary({ includeResonance: true }).catch(() => '');
      const proposal = await generateProposal(settings, {
        persona,
        knowledge: knowledge.filter(k => k.personaId === persona.id),
        recentProposals: proposals.filter(p => p.personaId === persona.id).slice(0, 5),
        health,
        patrolMode,
        extraContext,
      });
      setProposals(prev => [proposal, ...prev].slice(0, MAX_HISTORY));
      lastGenAtRef.current = Date.now();
      // 自動読み上げは行わない (ユーザーが 🔊 ボタンを押した時のみ再生)
      void forceVoice;
      return proposal;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [persona, knowledge, proposals, settings, isGenerating, health]);

  const speakProposal = useCallback((p: Proposal) => {
    setIsSpeaking(true);
    const text = `${p.title}。${p.message}`;
    const userOpenaiVoice = (settings as any).openaiVoice;
    speakNatural(text, {
      lang: settings.voiceLang || 'ja-JP',
      rate: 1.0,
      pitch: 1.0,
      openaiVoice: userOpenaiVoice,
      openaiInstructions: 'Speak in a warm, calm Japanese voice as a personal secretary giving a morning briefing to their employer. Natural prosody, gentle pace with subtle emphasis on key numbers and dates. Sound encouraging and composed.',
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
    setProposals(prev => prev.map(x => x.id === p.id ? { ...x, spoken: true } : x));
  }, [settings.voiceLang, (settings as any).openaiVoice]);

  const stopSpeak = useCallback(() => {
    stopSpeakingNatural();
    setIsSpeaking(false);
  }, []);

  const dismiss = useCallback((id: string) => {
    stopSpeakingNatural();
    setIsSpeaking(false);
    setProposals(prev => prev.map(p => p.id === id ? { ...p, dismissed: true } : p));
  }, []);

  const clearAll = useCallback(() => {
    setProposals([]);
  }, []);

  // 自動生成タイマー (定期巡回 + 朝/晩のスケジュール)
  useEffect(() => {
    if (!persona || settings.proactiveEnabled === false) return;
    const intervalMin = settings.proactiveIntervalMin ?? 30;
    const intervalMs = intervalMin * 60 * 1000;

    const PATROL_KEY = `core_patrol_${persona.id}`;
    const lastPatrol = (): { morning?: string; evening?: string } => {
      try { return JSON.parse(localStorage.getItem(PATROL_KEY) || '{}'); } catch { return {}; }
    };
    const setPatrol = (kind: 'morning' | 'evening') => {
      const cur = lastPatrol();
      cur[kind] = new Date().toISOString().slice(0, 10);
      localStorage.setItem(PATROL_KEY, JSON.stringify(cur));
    };

    const tick = () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const last = lastPatrol();

      // 朝のブリーフ: 6時〜9時の間で当日初回
      if (now.getHours() >= 6 && now.getHours() < 10 && last.morning !== today) {
        setPatrol('morning');
        generate(true, 'morning');
        return;
      }
      // 夜のレビュー: 20時〜23時の間で当日初回
      if (now.getHours() >= 20 && now.getHours() < 24 && last.evening !== today) {
        setPatrol('evening');
        generate(true, 'evening');
        return;
      }
      // 通常の定期巡回
      const since = Date.now() - lastGenAtRef.current;
      if (since >= intervalMs) generate(false);
    };

    const timer = window.setInterval(tick, 60_000);
    // 起動直後にも一度チェック (アプリを開いた時刻が朝/夜なら即発火)
    setTimeout(tick, 5000);
    return () => clearInterval(timer);
  }, [persona, settings.proactiveEnabled, settings.proactiveIntervalMin, generate]);

  // 人格切替時に初回生成 (前回から5分以上経過時)
  useEffect(() => {
    if (!persona || settings.proactiveEnabled === false) return;
    const last = personaProposals[0];
    const since = last ? Date.now() - new Date(last.generatedAt).getTime() : Infinity;
    if (since > 5 * 60 * 1000) {
      generate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.id]);

  // 起動時に音声をプリロード (末尾に配置 — Rules of Hooks 準拠)
  useEffect(() => {
    loadVoices();
  }, []);

  return {
    proposals: personaProposals,
    latestProposal,
    isGenerating,
    isSpeaking,
    error,
    generate,
    speakProposal,
    stopSpeak,
    dismiss,
    clearAll,
  };
}
