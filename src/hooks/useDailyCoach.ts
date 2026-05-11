// ============================================================
// useDailyCoach — デイリー 3 回ブリーフ自動生成フック
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import type { AppSettings, Persona, KnowledgeItem } from '../types/identity';
import type { DailyHealth } from '../types/health';
import type { HealthAnomaly } from '../data/healthAnomaly';
import {
  type CoachBrief,
  type CoachSlot,
  getCurrentSlot,
  shouldRefresh,
  getTodayBrief,
  generateBrief,
  markBriefRead,
} from '../lib/coachScheduler';
import { showLocalNotification } from '../lib/pushNotify';

interface HealthCtx {
  today: DailyHealth | null;
  week: DailyHealth[];
  anomalies: HealthAnomaly[];
}

export function useDailyCoach(
  settings: AppSettings,
  persona: Persona | null,
  knowledge: KnowledgeItem[],
  health?: HealthCtx,
) {
  const [brief, setBrief] = useState<CoachBrief | null>(null);
  const [incoming, setIncoming] = useState<CoachBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false);

  const tryGenerate = useCallback(async (slot: CoachSlot) => {
    if (!persona || generatingRef.current) return;
    if (settings.proactiveEnabled === false) return;

    generatingRef.current = true;
    setIsGenerating(true);
    try {
      const result = await generateBrief(settings, {
        persona,
        slot,
        knowledge: knowledge.filter(k => k.personaId === persona.id),
        health,
      });
      setBrief(result);
      setIncoming(result);
      // PWA 通知: ブリーフ生成完了をシステム通知でも届ける (権限が許可済みのとき)
      showLocalNotification({
        title: result.title || (slot === 'morning' ? '朝のブリーフ' : slot === 'noon' ? '昼のブリーフ' : '夜のブリーフ'),
        body: result.message.slice(0, 140),
        url: window.location.pathname.startsWith('/iris') ? '/iris?app=1' : '/?app=1',
        tag: `coach-${slot}`,
        dedupeKey: `coach-${result.date}-${slot}-${persona.id}`,
      });
    } catch {
      // 自動生成のエラーは UI をクラッシュさせない
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  }, [persona, knowledge, settings, health]);

  const checkAndGenerate = useCallback(async () => {
    if (!persona) return;
    const slot = getCurrentSlot();
    if (!slot) return;

    if (!shouldRefresh(slot, persona.id)) {
      // すでに当日スロット生成済み — ロードして表示
      const existing = getTodayBrief(slot, persona.id);
      if (existing && !existing.dismissed) {
        setBrief(existing);
      }
      return;
    }

    await tryGenerate(slot);
  }, [persona, tryGenerate]);

  // 起動時 + 人格切替時に即チェック
  useEffect(() => {
    checkAndGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona?.id]);

  // 30 分ポーリング
  useEffect(() => {
    const timer = setInterval(checkAndGenerate, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [checkAndGenerate]);

  const dismiss = useCallback(() => {
    setIncoming(null);
  }, []);

  const read = useCallback(() => {
    if (incoming) markBriefRead(incoming.id);
    setIncoming(null);
  }, [incoming]);

  const regenerate = useCallback(async () => {
    if (!persona) return;
    const slot = getCurrentSlot();
    if (!slot) return;
    await tryGenerate(slot);
  }, [persona, tryGenerate]);

  return { brief, incoming, isGenerating, dismiss, read, regenerate };
}
