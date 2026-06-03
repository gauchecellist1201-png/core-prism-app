// ============================================================
// CORE Prism — i18n entry point
// localStorage.lang で切替 (デフォルト ja)
// ============================================================
import { useCallback, useEffect, useState } from 'react';
import { ja } from './ja';
import { en } from './en';
import type { Dictionary } from './ja';

export type Lang = 'ja' | 'en';
export const DEFAULT_LANG: Lang = 'ja';
export const STORAGE_KEY = 'lang';

const DICTIONARIES: Record<Lang, Dictionary> = { ja, en };

export function detectLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  // URL クエリ ?lang=en|ja が最優先 (シェアリンクからの強制切替)
  try {
    const url = new URL(window.location.href);
    const qp = url.searchParams.get('lang');
    if (qp === 'ja' || qp === 'en') {
      // 次回以降のためにも保存
      localStorage.setItem(STORAGE_KEY, qp);
      localStorage.setItem('core_locale_v1', qp);
      return qp;
    }
  } catch { /* */ }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ja' || stored === 'en') return stored;
  // 旧 useLocale との互換 (core_locale_v1 を見る)
  const legacy = localStorage.getItem('core_locale_v1');
  if (legacy === 'en') return 'en';
  if (legacy === 'ja') return 'ja';
  // ブラウザ言語から推測
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('en')) return 'en';
  return DEFAULT_LANG;
}

export function saveLang(lang: Lang): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, lang);
  // 旧キーも同期 (IrisLanding 等が core_locale_v1 を参照)
  localStorage.setItem('core_locale_v1', lang);
}

export function getDict(lang: Lang): Dictionary {
  return DICTIONARIES[lang] ?? ja;
}

/**
 * useT — 言語切替 React フック
 * @returns lang / setLang / t (Dictionary を直接返す。t.hero.cta のように使う)
 */
export function useT() {
  const [lang, setLangState] = useState<Lang>(detectLang);

  const setLang = useCallback((next: Lang) => {
    saveLang(next);
    setLangState(next);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'ja' || e.newValue === 'en')) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = getDict(lang);
  return { lang, setLang, t };
}

export type { Dictionary } from './ja';
