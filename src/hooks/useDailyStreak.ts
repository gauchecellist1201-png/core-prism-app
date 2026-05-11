// ============================================================
// useDailyStreak — 起動時に streak を更新し UI に値を提供
// ============================================================
import { useEffect, useState } from 'react';
import { touchStreak, type TouchResult } from '../lib/dailyStreak';

export function useDailyStreak(): TouchResult {
  const [state, setState] = useState<TouchResult>(() => touchStreak());

  // タブが背景から復帰したときも 1 回叩く (日付を跨いだ場合に再評価)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setState(touchStreak());
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return state;
}
