// ============================================================
// useIgStrategy — IG プロフィールから AI 戦略 3 案を取得
// /api/iris/strategy-from-ig をコール、結果を localStorage に 24h キャッシュ
// ============================================================
import { useEffect, useState } from 'react';
import type { IgProfile } from './instagramConnect';

export interface StrategyItem {
  title: string;
  why: string;
  action: string;
  kpi: string;
  dueDays: number;
}

export interface IgStrategyData {
  strategies: StrategyItem[];
  audienceInsight: string;
  contentTheme: string;
  bestSlot: string;
  matchedCategories: string[];
  _meta?: { source?: 'fallback' | 'ai'; reason?: string };
  generatedAt: string;
}

const CACHE_KEY = 'core_iris_ig_strategy_v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function loadCache(handle: string): IgStrategyData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // スキーマ ガード: 古い 壊れた cache で クラッシュ しない
    if (!data || typeof data !== 'object' || !data.handle || !data.generatedAt) return null;
    if (data.handle !== handle) return null;
    const t = new Date(data.generatedAt).getTime();
    if (!isFinite(t) || Date.now() - t > CACHE_TTL) return null;
    return data as IgStrategyData;
  } catch { return null; }
}

function saveCache(handle: string, data: IgStrategyData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, handle }));
  } catch { /* */ }
}

export function useIgStrategy(profile: IgProfile | null): {
  data: IgStrategyData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<IgStrategyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!profile?.handle) { setData(null); return; }

    // キャッシュを先に返す
    const cached = loadCache(profile.handle);
    if (cached && tick === 0) { setData(cached); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/iris/strategy-from-ig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, focus: '案件獲得 + フォロワー成長' }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`戦略の取得に失敗 (${r.status})`);
        return r.json() as Promise<IgStrategyData>;
      })
      .then((d) => {
        if (cancelled) return;
        const enriched: IgStrategyData = { ...d, generatedAt: new Date().toISOString() };
        setData(enriched);
        saveCache(profile.handle, enriched);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [profile?.handle, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps

  return {
    data, loading, error,
    refresh: () => { setTick(t => t + 1); },
  };
}
