// ============================================================
// useTheme — React hook 版 (YYY 2026-06-04: themeManager に統合)
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import {
  currentTheme, detectTheme, initTheme,
  setTheme as setThemeGlobal,
  toggleTheme as toggleThemeGlobal,
  subscribeTheme, type Theme,
} from '../lib/themeManager';

export type { Theme };

export function useTheme() {
  const [theme, setLocal] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light';
    return currentTheme() || detectTheme();
  });

  useEffect(() => {
    initTheme();
    setLocal(currentTheme());
    const unsub = subscribeTheme((t) => setLocal(t));
    return unsub;
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeGlobal(t);
    setLocal(t);
  }, []);

  const toggle = useCallback(() => {
    const next = toggleThemeGlobal();
    setLocal(next);
  }, []);

  return { theme, setTheme, toggle };
}
