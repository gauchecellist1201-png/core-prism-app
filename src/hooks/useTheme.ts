import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'core_theme';

function load(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem(KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light'; // 既定: ライトモード
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(load);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((cur) => (cur === 'light' ? 'dark' : 'light')),
    []
  );

  return { theme, setTheme, toggle };
}
