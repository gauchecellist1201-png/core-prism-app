import type { DailyHealth } from '../types/health';

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  /** 0–100 進捗率（既達成は 100） */
  progress: number;
  unlocked: boolean;
  category: 'sleep' | 'recovery' | 'activity' | 'mind' | 'nutrition' | 'streak';
  unlockedAt?: string; // ISO date when first achieved
}

interface Predicate {
  (days: DailyHealth[]): { unlocked: boolean; progress: number; unlockedAt?: string };
}

// 進捗計算ヘルパー
const trailingHits = (days: DailyHealth[], pred: (d: DailyHealth) => boolean): number => {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (pred(days[i])) n++;
    else break;
  }
  return n;
};
const totalHits = (days: DailyHealth[], pred: (d: DailyHealth) => boolean): number =>
  days.filter(pred).length;

const list: Array<Omit<Achievement, 'progress' | 'unlocked' | 'unlockedAt'> & { check: Predicate }> = [
  {
    id: 'sleep-3d',
    emoji: '🛌',
    title: 'ナイトオーナー',
    detail: '3日連続で 7時間以上の睡眠',
    category: 'sleep',
    check: (d) => {
      const n = trailingHits(d, (x) => x.sleepHours >= 7);
      return { unlocked: n >= 3, progress: Math.min(100, (n / 3) * 100) };
    },
  },
  {
    id: 'sleep-7d',
    emoji: '👑',
    title: '睡眠の王',
    detail: '7日連続で 7時間以上',
    category: 'sleep',
    check: (d) => {
      const n = trailingHits(d, (x) => x.sleepHours >= 7);
      return { unlocked: n >= 7, progress: Math.min(100, (n / 7) * 100) };
    },
  },
  {
    id: 'deep-sleep-90',
    emoji: '🌌',
    title: 'ディープダイバー',
    detail: '深睡眠 90分超を達成した日',
    category: 'sleep',
    check: (d) => {
      const hits = totalHits(d, (x) => x.deepSleepMin >= 90);
      return { unlocked: hits >= 1, progress: Math.min(100, hits * 100) };
    },
  },
  {
    id: 'hrv-stable',
    emoji: '🪷',
    title: '自律神経マスター',
    detail: '5日連続で HRV 60ms 以上',
    category: 'recovery',
    check: (d) => {
      const n = trailingHits(d, (x) => x.hrv >= 60);
      return { unlocked: n >= 5, progress: Math.min(100, (n / 5) * 100) };
    },
  },
  {
    id: 'recovery-elite',
    emoji: '💎',
    title: 'リカバリーエリート',
    detail: 'リカバリースコア 80+ を3日連続',
    category: 'recovery',
    check: (d) => {
      const n = trailingHits(d, (x) => x.recoveryScore >= 80);
      return { unlocked: n >= 3, progress: Math.min(100, (n / 3) * 100) };
    },
  },
  {
    id: 'walk-10k',
    emoji: '🚶',
    title: '万歩クラブ',
    detail: '10,000歩 を1日達成',
    category: 'activity',
    check: (d) => {
      const hits = totalHits(d, (x) => x.steps >= 10000);
      return { unlocked: hits >= 1, progress: Math.min(100, hits * 100) };
    },
  },
  {
    id: 'walk-streak',
    emoji: '🔥',
    title: 'ステップストリーク',
    detail: '5日連続で 8,000歩+',
    category: 'streak',
    check: (d) => {
      const n = trailingHits(d, (x) => x.steps >= 8000);
      return { unlocked: n >= 5, progress: Math.min(100, (n / 5) * 100) };
    },
  },
  {
    id: 'active-60',
    emoji: '⚡',
    title: 'アクティブ60',
    detail: '運動 60分超を1日達成',
    category: 'activity',
    check: (d) => {
      const hits = totalHits(d, (x) => x.activeMinutes >= 60);
      return { unlocked: hits >= 1, progress: Math.min(100, hits * 100) };
    },
  },
  {
    id: 'mindful-streak',
    emoji: '🧘',
    title: '瞑想者',
    detail: '7日連続でマインドフル 5分+',
    category: 'mind',
    check: (d) => {
      const n = trailingHits(d, (x) => x.mindfulMinutes >= 5);
      return { unlocked: n >= 7, progress: Math.min(100, (n / 7) * 100) };
    },
  },
  {
    id: 'low-stress',
    emoji: '🕊',
    title: 'ローストレス',
    detail: 'ストレス指数 <50 を5日',
    category: 'mind',
    check: (d) => {
      const hits = totalHits(d, (x) => x.stressLevel < 50);
      return { unlocked: hits >= 5, progress: Math.min(100, (hits / 5) * 100) };
    },
  },
  {
    id: 'no-alcohol-3',
    emoji: '🚱',
    title: 'ドライ3デイ',
    detail: '3日連続でアルコール 0杯',
    category: 'nutrition',
    check: (d) => {
      const n = trailingHits(d, (x) => x.alcoholDrinks === 0);
      return { unlocked: n >= 3, progress: Math.min(100, (n / 3) * 100) };
    },
  },
  {
    id: 'water-2L',
    emoji: '💧',
    title: 'ハイドレーター',
    detail: '7日連続で水分 2L+',
    category: 'nutrition',
    check: (d) => {
      const n = trailingHits(d, (x) => x.hydrationL >= 2);
      return { unlocked: n >= 7, progress: Math.min(100, (n / 7) * 100) };
    },
  },
  {
    id: 'caffeine-low',
    emoji: '☕',
    title: 'カフェインコントロール',
    detail: 'カフェイン 200mg 以下を5日',
    category: 'nutrition',
    check: (d) => {
      const hits = totalHits(d, (x) => x.caffeineMg <= 200);
      return { unlocked: hits >= 5, progress: Math.min(100, (hits / 5) * 100) };
    },
  },
  {
    id: 'all-rounder',
    emoji: '🌈',
    title: 'オールラウンダー',
    detail: '1日に 睡眠7h+ HRV60+ 歩数8000+ を全達成',
    category: 'streak',
    check: (d) => {
      const hits = totalHits(d, (x) => x.sleepHours >= 7 && x.hrv >= 60 && x.steps >= 8000);
      return { unlocked: hits >= 1, progress: Math.min(100, hits * 100) };
    },
  },
];

export function evaluateAchievements(days: DailyHealth[]): Achievement[] {
  return list.map((a) => {
    const result = a.check(days);
    return {
      id: a.id,
      emoji: a.emoji,
      title: a.title,
      detail: a.detail,
      category: a.category,
      progress: result.progress,
      unlocked: result.unlocked,
      unlockedAt: result.unlockedAt,
    };
  });
}

/** トップレベルストリーク (健康的な日が連続したか) */
export function totalStreak(days: DailyHealth[]): number {
  // 「健康的な日」= 睡眠 6.5h+ かつ ストレス < 70 かつ 歩数 5000+
  return trailingHits(
    days,
    (d) => d.sleepHours >= 6.5 && d.stressLevel < 70 && d.steps >= 5000
  );
}
