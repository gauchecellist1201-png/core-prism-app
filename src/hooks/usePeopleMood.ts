// ============================================================
// usePeopleMood — 1on1 後の感情ジャーナル (ポジティブ / 不安 / 期待)
//
// 1 タップで記録、月次トレンドで可視化。
// usePeople.ts は触らない (他 agent と型衝突回避) ため、別 hook + 別 storage に分離。
// 個人情報は一切送らず、ローカルにのみ保存する。
// ============================================================
import { useCallback, useEffect, useState } from 'react';

export type MoodKind = 'positive' | 'anxious' | 'hopeful';

export interface PersonMoodEntry {
  id: string;
  personId: string;
  /** YYYY-MM-DD */
  date: string;
  mood: MoodKind;
  /** 任意の一言メモ (個人特定情報を含まないこと) */
  note?: string;
}

const KEY = 'core_people_mood_v1';
const MAX = 500;

function load(): PersonMoodEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as PersonMoodEntry[]).slice(0, MAX);
  } catch { return []; }
}

function persist(arr: PersonMoodEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX))); } catch { /* quota */ }
}

function uid() { return 'm_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export const MOOD_LABEL: Record<MoodKind, string> = {
  positive: '😊 ポジティブ',
  anxious:  '😟 不安',
  hopeful:  '🌱 期待',
};

export const MOOD_COLOR: Record<MoodKind, string> = {
  positive: '#4ade80',
  anxious:  '#f87171',
  hopeful:  '#a78bfa',
};

export function usePeopleMood() {
  const [entries, setEntries] = useState<PersonMoodEntry[]>(load);

  useEffect(() => { persist(entries); }, [entries]);

  // 他タブの localStorage 変更で再読込
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setEntries(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addMood = useCallback((personId: string, mood: MoodKind, note?: string) => {
    const e: PersonMoodEntry = {
      id: uid(),
      personId,
      date: new Date().toISOString().slice(0, 10),
      mood,
      note,
    };
    setEntries(prev => [e, ...prev]);
    return e;
  }, []);

  const removeMood = useCallback((id: string) => {
    setEntries(prev => prev.filter(x => x.id !== id));
  }, []);

  const getMoodsForPerson = useCallback((personId: string) =>
    entries
      .filter(e => e.personId === personId)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  /** 月次トレンド: { 'YYYY-MM': { positive, anxious, hopeful } } */
  const getMonthlyTrend = useCallback((personId: string, monthsBack = 6) => {
    const list = entries.filter(e => e.personId === personId);
    const buckets: Record<string, Record<MoodKind, number>> = {};
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[k] = { positive: 0, anxious: 0, hopeful: 0 };
    }
    for (const e of list) {
      const k = e.date.slice(0, 7);
      if (buckets[k]) buckets[k][e.mood]++;
    }
    return Object.entries(buckets).map(([month, counts]) => ({
      month,
      label: month.slice(5) + '月',
      ...counts,
      total: counts.positive + counts.anxious + counts.hopeful,
    }));
  }, [entries]);

  return { entries, addMood, removeMood, getMoodsForPerson, getMonthlyTrend };
}
