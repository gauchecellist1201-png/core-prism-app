import { useCallback, useEffect, useState } from 'react';

export interface QuickLogEntry {
  id: string;
  type: 'water' | 'meds' | 'mood' | 'symptom';
  value?: number;     // 水分 (mL) / 気分 (1-10)
  label?: string;     // 服薬名 / メモ
  at: string;         // ISO datetime
}

const KEY = 'core_phr_quicklog_v1';

function load(): QuickLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function save(entries: QuickLogEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {}
}

export function useQuickLog() {
  const [entries, setEntries] = useState<QuickLogEntry[]>(load);

  useEffect(() => {
    save(entries);
  }, [entries]);

  const add = useCallback(
    (type: QuickLogEntry['type'], value?: number, label?: string) => {
      const entry: QuickLogEntry = {
        id: crypto.randomUUID(),
        type,
        value,
        label,
        at: new Date().toISOString(),
      };
      setEntries((p) => [...p, entry]);
      return entry;
    },
    []
  );

  const remove = useCallback((id: string) => {
    setEntries((p) => p.filter((e) => e.id !== id));
  }, []);

  const todayEntries = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    return entries.filter((e) => e.at.startsWith(today));
  }, [entries]);

  const todayWaterMl = useCallback(() => {
    return todayEntries()
      .filter((e) => e.type === 'water')
      .reduce((s, e) => s + (e.value ?? 0), 0);
  }, [todayEntries]);

  const todayMedsCount = useCallback(() => {
    return todayEntries().filter((e) => e.type === 'meds').length;
  }, [todayEntries]);

  const todayMoodAvg = useCallback(() => {
    const moods = todayEntries().filter((e) => e.type === 'mood').map((e) => e.value ?? 0);
    if (moods.length === 0) return null;
    return moods.reduce((a, b) => a + b, 0) / moods.length;
  }, [todayEntries]);

  return {
    entries,
    add,
    remove,
    todayEntries,
    todayWaterMl,
    todayMedsCount,
    todayMoodAvg,
  };
}
