// ============================================================
// インフルエンサーデスク — localStorage (offline cache) + Supabase 同期
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { InfluencerDeal, NegotiationDraft, MediaKit } from '../types/influencerDeal';
import { useCloudSync } from './useCloudSync';

const KEY_DEALS  = 'core_inf_deals_v1';
const KEY_NEGOS  = 'core_inf_negos_v1';
const KEY_KIT    = 'core_inf_kit_'; // suffix: personaId

function load<T>(k: string, fb: T): T {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; }
}
function save<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ }
}

export function useInfluencerDesk() {
  const [deals, setDeals]   = useState<InfluencerDeal[]>(() => load(KEY_DEALS, []));
  const [negos, setNegos]   = useState<NegotiationDraft[]>(() => load(KEY_NEGOS, []));

  useEffect(() => save(KEY_DEALS, deals), [deals]);
  useEffect(() => save(KEY_NEGOS, negos), [negos]);

  // Supabase 同期 (未認証 / env 未設定なら no-op)
  useCloudSync({ key: KEY_DEALS, value: deals, setValue: setDeals, isEmpty: v => v.length === 0 });
  useCloudSync({ key: KEY_NEGOS, value: negos, setValue: setNegos, isEmpty: v => v.length === 0 });

  // 案件
  const addDeal = useCallback((personaId: string, data: Omit<InfluencerDeal, 'id' | 'personaId' | 'createdAt' | 'updatedAt'>): InfluencerDeal => {
    const d: InfluencerDeal = {
      ...data,
      id: uuidv4(),
      personaId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setDeals(prev => [d, ...prev]);
    return d;
  }, []);
  const updateDeal = useCallback((id: string, patch: Partial<InfluencerDeal>) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));
  }, []);
  const removeDeal = useCallback((id: string) => {
    setDeals(prev => prev.filter(d => d.id !== id));
    setNegos(prev => prev.filter(n => n.dealId !== id));
  }, []);

  // 交渉メッセージ
  const addNego = useCallback((data: Omit<NegotiationDraft, 'id'>): NegotiationDraft => {
    const n: NegotiationDraft = { ...data, id: uuidv4() };
    setNegos(prev => [n, ...prev]);
    return n;
  }, []);
  const updateNego = useCallback((id: string, patch: Partial<NegotiationDraft>) => {
    setNegos(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  }, []);
  const removeNego = useCallback((id: string) => {
    setNegos(prev => prev.filter(n => n.id !== id));
  }, []);

  // メディアキット (人格別)
  const getMediaKit = useCallback((personaId: string): MediaKit | undefined => {
    try { const r = localStorage.getItem(KEY_KIT + personaId); return r ? JSON.parse(r) : undefined; } catch { return undefined; }
  }, []);
  const setMediaKit = useCallback((personaId: string, kit: MediaKit) => {
    localStorage.setItem(KEY_KIT + personaId, JSON.stringify({ ...kit, personaId }));
  }, []);

  // フィルター
  const getDealsForPersona = useCallback((personaId: string) => deals.filter(d => d.personaId === personaId), [deals]);
  const getNegosForDeal    = useCallback((dealId: string) => negos.filter(n => n.dealId === dealId), [negos]);

  return {
    deals, negos,
    addDeal, updateDeal, removeDeal,
    addNego, updateNego, removeNego,
    getMediaKit, setMediaKit,
    getDealsForPersona, getNegosForDeal,
  };
}
