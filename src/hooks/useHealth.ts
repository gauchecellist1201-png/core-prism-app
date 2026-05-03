import { useCallback, useEffect, useState } from 'react';
import type { DailyHealth, HealthSource } from '../types/health';
import { generateMockHealth, defaultSources } from '../data/mockHealth';

const KEY_DAYS = 'core_phr_daily_v1';
const KEY_SOURCES = 'core_phr_sources_v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota etc — ignore */
  }
}

export function useHealth() {
  const [days, setDays] = useState<DailyHealth[]>(() => load(KEY_DAYS, [] as DailyHealth[]));
  const [sources, setSources] = useState<HealthSource[]>(() =>
    load(KEY_SOURCES, [] as HealthSource[])
  );

  // Bootstrap on first run
  useEffect(() => {
    if (days.length === 0) {
      const seed = generateMockHealth(30);
      setDays(seed);
      save(KEY_DAYS, seed);
    }
    if (sources.length === 0) {
      const s = defaultSources();
      setSources(s);
      save(KEY_SOURCES, s);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const today = days[days.length - 1];
  const week = days.slice(-7);

  const triggerSync = useCallback(
    async (sourceId: HealthSource['id']) => {
      // Mark syncing
      setSources((prev) => {
        const next = prev.map((s) =>
          s.id === sourceId ? { ...s, status: 'syncing' as const } : s
        );
        save(KEY_SOURCES, next);
        return next;
      });

      // Simulate latency
      await new Promise((r) => setTimeout(r, 1800));

      setSources((prev) => {
        const next = prev.map((s) =>
          s.id === sourceId
            ? {
                ...s,
                status: 'connected' as const,
                lastSync: new Date().toISOString(),
                recordsImported: s.recordsImported + Math.round(Math.random() * 80 + 20),
              }
            : s
        );
        save(KEY_SOURCES, next);
        return next;
      });
    },
    []
  );

  const toggleConnection = useCallback(async (sourceId: HealthSource['id']) => {
    setSources((prev) => {
      const next = prev.map((s) => {
        if (s.id !== sourceId) return s;
        if (s.status === 'connected') return { ...s, status: 'disconnected' as const };
        return { ...s, status: 'syncing' as const };
      });
      save(KEY_SOURCES, next);
      return next;
    });
  }, []);

  const reseed = useCallback(() => {
    const seed = generateMockHealth(30);
    setDays(seed);
    save(KEY_DAYS, seed);
  }, []);

  /** 既存データに新しいDailyHealthをマージ（同じ日付は新しいデータで上書き） */
  const mergeDays = useCallback((incoming: DailyHealth[]) => {
    setDays((prev) => {
      const map = new Map<string, DailyHealth>();
      for (const d of prev) map.set(d.date, d);
      for (const d of incoming) map.set(d.date, d);
      const merged = [...map.values()].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      // 直近 60 日に制限
      const trimmed = merged.slice(-60);
      save(KEY_DAYS, trimmed);
      return trimmed;
    });
  }, []);

  /** Apple Health 同期完了マーク */
  const markAppleHealthImported = useCallback((records: number) => {
    setSources((prev) => {
      const next = prev.map((s) =>
        s.id === 'apple-health'
          ? {
              ...s,
              status: 'connected' as const,
              lastSync: new Date().toISOString(),
              recordsImported: records,
            }
          : s
      );
      save(KEY_SOURCES, next);
      return next;
    });
  }, []);

  return {
    days,
    today,
    week,
    sources,
    triggerSync,
    toggleConnection,
    reseed,
    mergeDays,
    markAppleHealthImported,
  };
}
