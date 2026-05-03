import type { DailyHealth } from '../types/health';
import type { Persona } from '../types/identity';

export interface PersonaGoal {
  id: string;
  /** 表示ラベル */
  label: string;
  /** どの DailyHealth フィールドを評価するか */
  metric: keyof DailyHealth;
  target: number;
  comparator: 'gte' | 'lte';
  unit: string;
  rationale: string;
  /** 重要度（並び順 / バッジサイズ） */
  weight: 1 | 2 | 3;
}

/**
 * ペルソナ名/サブタイトルからキーワードマッチで目標セットを返す。
 * 該当しない場合はデフォルト目標を返す。
 */
export function goalsForPersona(persona: Persona): PersonaGoal[] {
  const text = `${persona.name} ${persona.subtitle} ${persona.description}`.toLowerCase();

  if (matchesAny(text, ['ceo', '経営', '社長', 'founder', '代表', 'リーダー'])) {
    return [
      g('exec-sleep',     '判断力を保つ睡眠',   'sleepHours',     7,    'gte', 'h',   '睡眠不足は重要判断の正答率を 30%下げる', 3),
      g('exec-stress',    '交感神経の暴走防止', 'stressLevel',    55,   'lte', '',    '長期高ストレスは戦略的思考を蝕む',           3),
      g('exec-hrv',       '回復力',             'hrv',            55,   'gte', 'ms',  'HRV はリーダーの精神的余裕の指標',           2),
      g('exec-walk',      '基礎代謝のための歩数','steps',         8000, 'gte', '歩',  '座りすぎは認知機能と寿命を縮める',           2),
      g('exec-alcohol',   '翌朝の判断を守る',   'alcoholDrinks',  1,    'lte', '杯',  'アルコールは翌日の HRV を 15%下げる',        2),
    ];
  }

  if (matchesAny(text, ['creator', 'creative', 'クリエイ', '作家', 'artist', 'writer', 'designer'])) {
    return [
      g('cre-mind',     '創造性のためのマインドフル', 'mindfulMinutes', 15,   'gte', '分',  '副交感神経優位で創造性が +22% 向上',     3),
      g('cre-deep',     '深い睡眠でアイデア定着',     'deepSleepMin',   90,   'gte', '分',  '深睡眠は記憶整理とインサイト形成の鍵',  3),
      g('cre-flow',     'フロー時間（活動分）',       'activeMinutes',  45,   'gte', '分',  '身体運動は前頭前野を活性化',            2),
      g('cre-caffeine', 'カフェインを抑える',         'caffeineMg',     250,  'lte', 'mg',  '過剰カフェインは創造的発散を妨げる',     2),
      g('cre-sleep',    '十分な睡眠時間',             'sleepHours',     7.5,  'gte', 'h',   '6h 未満は創造性スコアを 40%低下',       1),
    ];
  }

  if (matchesAny(text, ['アスリート', 'athlete', 'コーチ', 'trainer', 'スポーツ'])) {
    return [
      g('ath-recovery', 'リカバリー優先',     'recoveryScore', 75,   'gte', '',    'パフォーマンス維持の核',                 3),
      g('ath-active',   '活動時間',           'activeMinutes', 60,   'gte', '分',  '日常活動 + トレーニング',                2),
      g('ath-water',    '水分摂取',           'hydrationL',    3,    'gte', 'L',   '脱水は出力を 20%以上下げる',             2),
      g('ath-sleep',    '睡眠',               'sleepHours',    8,    'gte', 'h',   '筋修復と神経回復の時間',                 3),
      g('ath-rhr',      '安静時心拍',         'restingHR',     58,   'lte', 'bpm', '心血管フィットネスの指標',               2),
    ];
  }

  // 専門家（医師・弁護士・コンサル等）
  if (matchesAny(text, ['医師', '医者', 'doctor', '弁護士', 'lawyer', 'コンサル', 'advisor', '専門'])) {
    return [
      g('pro-sleep',    '集中持続のための睡眠', 'sleepHours',     6.5,  'gte', 'h',   '専門判断には最低限必要', 3),
      g('pro-mind',     '思考整理の時間',       'mindfulMinutes', 10,   'gte', '分',  '判断疲れの回復',          2),
      g('pro-active',   'エネルギー維持',       'activeMinutes',  30,   'gte', '分',  '長時間労働の中の運動',    2),
      g('pro-stress',   'バーンアウト予防',     'stressLevel',    65,   'lte', '',    '専門職に頻発',            3),
    ];
  }

  // デフォルト（万人向け基準）
  return defaultGoals();
}

export function defaultGoals(): PersonaGoal[] {
  return [
    g('def-sleep',  '睡眠 7h+',         'sleepHours',     7,    'gte', 'h',  'WHO 推奨', 3),
    g('def-steps',  '歩数 8,000+',     'steps',          8000, 'gte', '歩', '基礎代謝',  2),
    g('def-stress', 'ストレス指数 ≤60', 'stressLevel',    60,   'lte', '',   '健全範囲',  2),
    g('def-mind',   'マインドフル 10分','mindfulMinutes', 10,   'gte', '分', '心の余白',  1),
    g('def-water',  '水分 2L+',        'hydrationL',     2,    'gte', 'L',  '脱水予防',  1),
  ];
}

function g(
  id: string,
  label: string,
  metric: keyof DailyHealth,
  target: number,
  comparator: 'gte' | 'lte',
  unit: string,
  rationale: string,
  weight: 1 | 2 | 3
): PersonaGoal {
  return { id, label, metric, target, comparator, unit, rationale, weight };
}

function matchesAny(text: string, words: string[]) {
  return words.some((w) => text.toLowerCase().includes(w.toLowerCase()));
}

/** 1日のメトリクス値が目標達成か判定 */
export function isHit(value: number, goal: PersonaGoal): boolean {
  return goal.comparator === 'gte' ? value >= goal.target : value <= goal.target;
}

/** 直近N日中の達成日数 */
export function streakOf(days: DailyHealth[], goal: PersonaGoal): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const v = Number(days[i][goal.metric] ?? 0);
    if (isHit(v, goal)) n++;
    else break;
  }
  return n;
}

export function hitRate(days: DailyHealth[], goal: PersonaGoal, lookbackDays = 7): number {
  const slice = days.slice(-lookbackDays);
  if (slice.length === 0) return 0;
  const hits = slice.filter((d) => isHit(Number(d[goal.metric] ?? 0), goal)).length;
  return Math.round((hits / slice.length) * 100);
}
