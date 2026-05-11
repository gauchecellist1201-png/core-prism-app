import { useCallback, useEffect, useState } from 'react';
import { type Locale, detectLocale, saveLocale, t as translate } from '../lib/i18n';

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((l: Locale) => {
    saveLocale(l);
    setLocaleState(l);
  }, []);

  // タブ間同期
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'core_locale_v1' && (e.newValue === 'ja' || e.newValue === 'en' || e.newValue === 'zh')) {
        setLocaleState(e.newValue as Locale);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => translate(key, locale, params),
    [locale],
  );

  return { locale, setLocale, t };
}
