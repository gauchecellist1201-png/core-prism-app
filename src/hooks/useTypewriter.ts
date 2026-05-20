// ============================================================
// useTypewriter — 文字列を 1 文字ずつ表示する擬似ストリーミング
// API がストリーミング非対応でも体感を改善できる
// ============================================================
import { useEffect, useState } from 'react';

interface Options {
  /** 1 文字ごとの間隔 (ms)。長い本文ほど自動で速くする */
  speedMs?: number;
  /** これを超える長さは即座に全表示する (上限保険) */
  maxLength?: number;
  /** 既に表示済みのチャットメッセージなど、最初から全部出したいときは true */
  skip?: boolean;
}

/**
 * full の本文を、レンダリングのたびに 1 文字ずつ伸ばして返す。
 * full が変わったときに先頭から再生する。
 */
export function useTypewriter(full: string, opts: Options = {}): { text: string; done: boolean } {
  const { speedMs = 12, maxLength = 4000, skip = false } = opts;
  const [shown, setShown] = useState(skip ? full : '');

  useEffect(() => {
    if (skip || !full) {
      setShown(full || '');
      return;
    }
    if (full.length > maxLength) {
      // 長すぎるときは即時表示にフォールバック (端末負荷を避ける)
      setShown(full);
      return;
    }
    setShown('');
    let i = 0;
    // 長文は速度を上げる: 500 文字超で 6ms、1500 文字超で 3ms
    const step = full.length > 1500 ? 1 : full.length > 500 ? 2 : 1;
    const interval = full.length > 1500 ? 3 : full.length > 500 ? 6 : speedMs;
    const id = window.setInterval(() => {
      i = Math.min(i + step, full.length);
      setShown(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, interval);
    return () => window.clearInterval(id);
  }, [full, skip, speedMs, maxLength]);

  return { text: shown, done: shown.length >= (full?.length || 0) };
}
