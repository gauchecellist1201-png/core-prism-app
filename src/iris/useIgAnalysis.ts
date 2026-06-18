// ============================================================
// useIgAnalysis — 連携後にプロフィール分析を「自動実行＆永続化」
//
// オーナー指示 (2026-06-18): 分析の自動化。連携したら Iris が勝手に分析し、
//   その結果を戦略・リール・案件など全段へ供給できるよう localStorage に保持する。
//
// analyzeInstagramProfile(IGAnalysisResult) を IgProfile から自動で叩き、
//   handle ごとに 7 日キャッシュ。結果は他段（リール構成の文脈など）でも読める。
// 失敗してもアプリは止めない（error を返すだけ。呼び出し側で再試行導線を出す）。
// ============================================================
import { useEffect, useState } from 'react';
import type { AppSettings } from '../types/identity';
import type { IgProfile } from './instagramConnect';
import { analyzeInstagramProfile, type IGAnalysisResult } from './instagramAnalyzer';

const CACHE_KEY = 'core_iris_ig_analysis_v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 日

interface Cached { handle: string; generatedAt: string; result: IGAnalysisResult }

function loadCache(handle: string): IGAnalysisResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Cached;
    if (!data || data.handle !== handle || !data.result) return null;
    const t = new Date(data.generatedAt).getTime();
    if (!isFinite(t) || Date.now() - t > CACHE_TTL) return null;
    return data.result;
  } catch { return null; }
}

function saveCache(handle: string, result: IGAnalysisResult) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ handle, generatedAt: new Date().toISOString(), result } as Cached));
  } catch { /* 容量超過などは黙って諦める（分析自体は state に残る） */ }
}

/** 直近キャッシュ（他モジュールから同期的に読みたい時用） */
export function peekIgAnalysis(handle?: string): IGAnalysisResult | null {
  if (!handle) {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as Cached).result ?? null : null;
    } catch { return null; }
  }
  return loadCache(handle);
}

export function useIgAnalysis(profile: IgProfile | null, settings: AppSettings): {
  data: IGAnalysisResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [data, setData] = useState<IGAnalysisResult | null>(() =>
    profile?.handle ? loadCache(profile.handle) : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!profile?.handle) { setData(null); return; }

    const cached = loadCache(profile.handle);
    if (cached && tick === 0) { setData(cached); return; }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const niche = (profile.topPostCategories || []).join('・');
    const pasted = [
      `Instagram ハンドル: @${profile.handle}`,
      profile.followers ? `フォロワー数: ${profile.followers}` : '',
      niche ? `主な投稿ジャンル: ${niche}` : '',
      profile.bestPostTime ? `よく伸びる時間帯: ${profile.bestPostTime}` : '',
      profile.source === 'self' ? '（自己申告ベース。実数値が一部不明なため、相場と一般傾向で推定してよい）' : '',
    ].filter(Boolean).join('\n');

    analyzeInstagramProfile({
      settings,
      handle: profile.handle,
      pasted,
      niche: niche || undefined,
      goal: '案件獲得とフォロワー成長',
      knownMetrics: {
        followers: profile.followers || undefined,
        avgER: profile.engagementRate || undefined,
        avgLikes: profile.avgLikes || undefined,
        avgComments: profile.avgComments || undefined,
      },
    })
      .then((r) => {
        if (cancelled) return;
        setData(r);
        saveCache(profile.handle, r);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || '分析に失敗しました');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [profile?.handle, settings, tick]);

  return { data, loading, error, refresh: () => setTick((t) => t + 1) };
}
