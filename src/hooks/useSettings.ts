import { useState, useCallback } from 'react';
import type { AppSettings } from '../types/identity';

const STORAGE_KEY = 'core_settings';

const DEFAULT_SETTINGS: AppSettings = {
  claudeApiKey: '',
  preferredModel: 'claude-haiku-4-5',
  googleCalendarConnected: false,
  userName: '',
  onboardingComplete: false,
  usageStats: {
    totalTokensUsed: 0,
    totalMessages: 0,
    estimatedCostUsd: 0,
    lastReset: new Date().toISOString(),
  },
  proactiveEnabled: true,
  voiceEnabled: true,
  voiceLang: 'ja-JP',
  proactiveIntervalMin: 30,
  aiTone: 'gentle',
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const updateUsageStats = useCallback((tokensUsed: number, costUsd: number) => {
    setSettings(prev => {
      const next = {
        ...prev,
        usageStats: {
          ...prev.usageStats,
          totalTokensUsed: prev.usageStats.totalTokensUsed + tokensUsed,
          totalMessages: prev.usageStats.totalMessages + 1,
          estimatedCostUsd: prev.usageStats.estimatedCostUsd + costUsd,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetStats = useCallback(() => {
    updateSettings({
      usageStats: {
        totalTokensUsed: 0,
        totalMessages: 0,
        estimatedCostUsd: 0,
        lastReset: new Date().toISOString(),
      },
    });
  }, [updateSettings]);

  return { settings, updateSettings, updateUsageStats, resetStats };
}
