// ============================================================
// 能動提案フック: 自動生成 + 音声再生 + 履歴保存
// ============================================================
import { useState, useCallback, useEffect, useRef } from 'react';
import type { AppSettings, Persona, KnowledgeItem, Proposal } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import { generateProposal } from '../lib/proactiveAgent';
import { getCrossServiceContext } from '../lib/crossServiceData';
import { speakNatural, stopSpeakingNatural, loadVoices } from '../lib/tts';
import { humanizeAiError } from '../lib/aiErrorMessage';
import { duePatrol, bumpTries, markPatrolDone, readPatrol, writePatrol } from '../lib/patrolSchedule';

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
  // isGenerating(state) は同じ描画サイクル内では古い値のまま見えるので、
  // 「起動直後に人格切替と朝の巡回が同時に走る」ような重なりを止められない。
  // 誰が先に取ったかをその場で決めるために ref で持つ。
  const generatingRef = useRef(false);

  useEffect(() => { save(proposals); }, [proposals]);

  const personaProposals = persona
    ? proposals.filter(p => p.personaId === persona.id && !p.dismissed)
    : [];
  const latestProposal = personaProposals[0] ?? null;

  const generate = useCallback(async (forceVoice = false, patrolMode: 'morning' | 'evening' | null = null) => {
    if (!persona) return null;
    if (generatingRef.current) return null;
    generatingRef.current = true;
    setIsGenerating(true);
    setError(null);
    try {
      // Iris(Instagram実データ)/Resonance(LINE配信)/Gmail/カレンダー/Stripe を提案の根拠に織り込む (司令塔)。
      // sources は「実際にデータが返った」連携だけ → UI の根拠チップにそのまま渡す (嘘なし)。
      const cross = await getCrossServiceContext({ includeResonance: true }).catch(() => ({ text: '', sources: [] as string[] }));
      const proposal = await generateProposal(settings, {
        persona,
        knowledge: knowledge.filter(k => k.personaId === persona.id),
        recentProposals: proposals.filter(p => p.personaId === persona.id).slice(0, 5),
        health,
        patrolMode,
        extraContext: cross.text,
        dataSources: cross.sources,
      });
      setProposals(prev => [proposal, ...prev].slice(0, MAX_HISTORY));
      lastGenAtRef.current = Date.now();
      // 自動読み上げは行わない (ユーザーが 🔊 ボタンを押した時のみ再生)
      void forceVoice;
      return proposal;
    } catch (err) {
      // 英語の原文やステータス番号を画面に出さない（次にどうすればいいかまで書いた一文にする）
      setError(humanizeAiError(err));
      return null;
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [persona, knowledge, proposals, settings, health]);

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

    const tick = async () => {
      const now = new Date();
      const kind = duePatrol(readPatrol(PATROL_KEY), now);

      if (kind) {
        // 「作る前に印を付ける」のをやめた。作れなかった日に朝のブリーフが
        // 二度と出なくなっていた (silent fail)。試行だけ数え、成功した時に印を付ける。
        writePatrol(PATROL_KEY, bumpTries(readPatrol(PATROL_KEY), kind, now));
        const made = await generate(true, kind);
        if (made) writePatrol(PATROL_KEY, markPatrolDone(readPatrol(PATROL_KEY), kind, now));
        return;
      }
      // 通常の定期巡回
      const since = Date.now() - lastGenAtRef.current;
      if (since >= intervalMs) void generate(false);
    };

    const timer = window.setInterval(() => { void tick(); }, 60_000);
    // 起動直後にも一度チェック (アプリを開いた時刻が朝/夜なら即発火)。
    // ここを片付けないと、依存が変わるたびに古いタイマーが残って多重に走る。
    const kick = window.setTimeout(() => { void tick(); }, 5000);
    return () => { clearInterval(timer); clearTimeout(kick); };
  }, [persona, settings.proactiveEnabled, settings.proactiveIntervalMin, generate]);

  // 人格切替時に初回生成 (前回から5分以上経過時)
  useEffect(() => {
    if (!persona || settings.proactiveEnabled === false) return;
    const last = personaProposals[0];
    const since = last ? Date.now() - new Date(last.generatedAt).getTime() : Infinity;
    if (since <= 5 * 60 * 1000) return;

    // 朝/夜の時間帯にアプリを開いた時は、ここで先に普通の提案を作ってしまうと
    // 5 秒後の巡回が弾かれ、その日の「朝のブリーフ」が出ないまま終わっていた。
    // 出すのは 1 本だけ。その 1 本を「朝のブリーフ」にする。
    const PATROL_KEY = `core_patrol_${persona.id}`;
    const kind = duePatrol(readPatrol(PATROL_KEY));
    if (kind) {
      const now = new Date();
      writePatrol(PATROL_KEY, bumpTries(readPatrol(PATROL_KEY), kind, now));
      void generate(true, kind).then((made) => {
        if (made) writePatrol(PATROL_KEY, markPatrolDone(readPatrol(PATROL_KEY), kind, now));
      });
      return;
    }
    void generate(false);
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
