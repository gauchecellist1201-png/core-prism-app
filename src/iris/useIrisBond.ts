// ============================================================
// CORE Iris ▸ Bond — 親密度システム
//
// ユーザーが少しずつ質問に答えていくと「Iris との絆」が深まり、
// AI の口調・提案・カスタマイズがより個人最適化される。
//
// 設計思想:
// ・1 度に 1 質問だけ。圧迫感なし
// ・任意でスキップ可
// ・回答するごとに親密度 +1
// ・親密度 = AI の生成プロンプトに含まれ、ユーザー固有の文脈に
// ・夜職 / クリエイター層に刺さる質問群
//   (四柱推命、性格、好み、悩み、野望)
// ============================================================
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'iris_bond_v1';

export type BondLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface BondProfile {
  /** 親密度 0-5 */
  level: BondLevel;
  /** 親密度ポイント (10pt で次のレベル) */
  points: number;
  /** 答え済み回答 (questionId → 回答) */
  answers: Record<string, string | string[] | number>;
  /** AI が見るユーザー要約 (自動生成 or 手動編集) */
  aiContextSummary?: string;
  /** 最後にプロンプトを出した時刻 (連投回避) */
  lastPromptAt?: string;
  /** スキップしたqid: 一定期間再提示しない */
  skipped: Record<string, string>;
}

const EMPTY: BondProfile = {
  level: 0,
  points: 0,
  answers: {},
  skipped: {},
};

function load(): BondProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch { return EMPTY; }
}

function persist(p: BondProfile) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {/* */}
}

// ─── 質問定義 (夜職・クリエイター女性に刺さるトーン) ─────
export type BondQuestion = {
  id: string;
  category: 'birth' | 'personality' | 'lifestyle' | 'desire' | 'shadow' | 'taste';
  /** 親密度どのレベルから出すか (0 = 最初から、3 = 仲良くなってから) */
  minLevel: number;
  prompt: string;
  hint?: string;
  /** 入力形式 */
  kind: 'date' | 'time' | 'select' | 'multi' | 'text' | 'number';
  options?: { value: string; label: string; emoji?: string }[];
  placeholder?: string;
  /** 答えるとポイント加算 */
  points: number;
};

export const BOND_QUESTIONS: BondQuestion[] = [
  // ─── Level 0: 軽い入り口 ─────
  {
    id: 'name_to_call',
    category: 'lifestyle', minLevel: 0,
    prompt: 'なんて呼ばれたい?',
    hint: 'Iris があなたを呼ぶ呼び方。本名・ニックネーム・別名、なんでも',
    kind: 'text', placeholder: '例: ミナ / Lily / りこ',
    points: 3,
  },
  {
    id: 'birthday',
    category: 'birth', minLevel: 0,
    prompt: '誕生日を教えて',
    hint: '四柱推命と西洋占星術で、あなただけの傾向を見るよ',
    kind: 'date', points: 5,
  },
  {
    id: 'birth_time',
    category: 'birth', minLevel: 1,
    prompt: '生まれた時間、わかる?',
    hint: '時柱までわかると四柱推命の精度が跳ね上がる (不明でも OK)',
    kind: 'time', points: 4,
  },

  // ─── Level 1: 性格・好み ─────
  {
    id: 'energy_type',
    category: 'personality', minLevel: 1,
    prompt: 'あなたのエネルギーは?',
    hint: '今日の自分の感覚で',
    kind: 'select', points: 3,
    options: [
      { value: 'fire',   label: '燃える炎', emoji: '🔥' },
      { value: 'water',  label: '深い水',  emoji: '💧' },
      { value: 'wind',   label: '自由な風', emoji: '🌬' },
      { value: 'earth',  label: '安定の大地', emoji: '🌿' },
      { value: 'metal',  label: '研ぎ澄ました金属', emoji: '✦' },
    ],
  },
  {
    id: 'fav_color',
    category: 'taste', minLevel: 1,
    prompt: '今いちばん惹かれる色',
    kind: 'select', points: 2,
    options: [
      { value: 'pink',     label: 'ピンク',     emoji: '🌸' },
      { value: 'red',      label: '赤',        emoji: '❤️' },
      { value: 'black',    label: '黒',        emoji: '🖤' },
      { value: 'white',    label: '白',        emoji: '🤍' },
      { value: 'gold',     label: 'ゴールド',  emoji: '🌟' },
      { value: 'silver',   label: 'シルバー',  emoji: '🌙' },
      { value: 'purple',   label: '紫',        emoji: '💜' },
      { value: 'blue',     label: '青',        emoji: '💙' },
    ],
  },

  // ─── Level 2: ライフスタイル ─────
  {
    id: 'work_style',
    category: 'lifestyle', minLevel: 2,
    prompt: '今の働き方を 1 つ選ぶなら?',
    hint: 'Iris は端末内にだけ保存。他人には見られない',
    kind: 'select', points: 4,
    options: [
      { value: 'influencer',    label: '専業インフルエンサー' },
      { value: 'creator',       label: 'クリエイター / アーティスト' },
      { value: 'freelance',     label: 'フリーランス (デザイン/ライティング等)' },
      { value: 'entrepreneur',  label: '自分の事業 / 経営者' },
      { value: 'corporate',     label: '会社員 + 副業 SNS' },
      { value: 'professional',  label: '士業 / 専門職 / 医療系' },
      { value: 'nightwork',     label: '夜の仕事 (キャバ / クラブ / ラウンジ)' },
      { value: 'hybrid',        label: '色々やってる (複業 / 二足以上)' },
      { value: 'other',         label: 'その他' },
    ],
  },
  {
    id: 'follower_range',
    category: 'lifestyle', minLevel: 2,
    prompt: 'フォロワーは今だいたい',
    kind: 'select', points: 3,
    options: [
      { value: '0-1k',     label: '〜1,000' },
      { value: '1k-10k',   label: '1k 〜 10k' },
      { value: '10k-50k',  label: '10k 〜 50k' },
      { value: '50k-100k', label: '50k 〜 100k' },
      { value: '100k+',    label: '100k+' },
    ],
  },

  // ─── Level 3: 内面 (仲良くなってから) ─────
  {
    id: 'biggest_desire',
    category: 'desire', minLevel: 3,
    prompt: '今いちばん欲しいもの、何?',
    hint: 'お金、愛、自由、認められたい、変わりたい — 何でもいい',
    kind: 'multi', points: 5,
    options: [
      { value: 'money',       label: '経済的自由' },
      { value: 'love',        label: '愛されたい / 愛したい' },
      { value: 'recognition', label: '本気で認められたい' },
      { value: 'freedom',     label: '時間の自由' },
      { value: 'change',      label: '今の自分を変えたい' },
      { value: 'security',    label: '安心できる場所' },
      { value: 'fame',        label: '影響力 / 有名になる' },
      { value: 'growth',      label: '自分を磨き続けたい' },
    ],
  },
  {
    id: 'shadow',
    category: 'shadow', minLevel: 3,
    prompt: '誰にも言えない、最近の不安は?',
    hint: 'Iris は端末内のみ。誰にも見られない。書くと整理される',
    kind: 'text', placeholder: '思いつくまま、断片で OK',
    points: 6,
  },

  // ─── Level 4: 深層 ─────
  {
    id: 'self_image',
    category: 'personality', minLevel: 4,
    prompt: 'なりたい自分を 1 行で',
    hint: '5 年後でも、来週でも',
    kind: 'text', placeholder: '例: 自分の事業で月7桁、夜の時間は自分のために',
    points: 6,
  },
  {
    id: 'why_iris',
    category: 'desire', minLevel: 4,
    prompt: 'Iris に何を期待してる?',
    hint: '正直なフィードバックは Iris の進化になる',
    kind: 'text', placeholder: '例: 1人で全部やってる、整理してほしい',
    points: 5,
  },
];

// ─── 四柱推命: 生年月日 → 干支 / 五行 ─────
const HEAVENLY_STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'] as const;
const EARTHLY_BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'] as const;
const STEM_TO_ELEMENT: Record<string, '木'|'火'|'土'|'金'|'水'> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const STEM_YIN_YANG: Record<string, '陽'|'陰'> = {
  甲: '陽', 乙: '陰', 丙: '陽', 丁: '陰', 戊: '陽',
  己: '陰', 庚: '陽', 辛: '陰', 壬: '陽', 癸: '陰',
};

/** 簡易四柱推命: 日干 (Day Stem) と Day Branch を求める */
export function shichuSuimei(birthIso: string): {
  dayStem: string;
  dayBranch: string;
  element: string;
  yinYang: string;
  oneLineFortune: string;
} | null {
  try {
    const d = new Date(birthIso);
    if (isNaN(d.getTime())) return null;
    // 60甲子のサイクル計算 (1900-01-01 = 庚子 だが、簡易化のため基準日からの日数で)
    // 基準: 2000-01-01 (土星: 戊午)
    const base = new Date('2000-01-01T00:00:00Z').getTime();
    const daysFromBase = Math.floor((d.getTime() - base) / 86400000);
    const stemIdx = ((daysFromBase % 10) + 10 + 4) % 10;  // +4 オフセットで 2000-01-01 を 戊 に
    const branchIdx = ((daysFromBase % 12) + 12 + 6) % 12; // +6 オフセットで 2000-01-01 を 午 に
    const stem = HEAVENLY_STEMS[stemIdx];
    const branch = EARTHLY_BRANCHES[branchIdx];
    const element = STEM_TO_ELEMENT[stem];
    const yy = STEM_YIN_YANG[stem];
    const fortuneMap: Record<string, string> = {
      木: '伸びる時期。新しい縁を恐れずに',
      火: '感情と直感が冴える。発信が当たる',
      土: '土台を整える時期。地味だけど効く',
      金: '研ぎ澄ます時。捨てると残る人が見える',
      水: '内省と流れ。無理に動かなくていい',
    };
    return {
      dayStem: stem,
      dayBranch: branch,
      element,
      yinYang: yy,
      oneLineFortune: fortuneMap[element] || '',
    };
  } catch { return null; }
}

// ─── 親密度メーター: ポイント → レベル ─────
function pointsToLevel(points: number): BondLevel {
  if (points >= 30) return 5;
  if (points >= 22) return 4;
  if (points >= 14) return 3;
  if (points >= 8)  return 2;
  if (points >= 3)  return 1;
  return 0;
}

// レベル別の口調 / 距離感
export const LEVEL_VIBE: Record<BondLevel, { title: string; tone: string; emoji: string }> = {
  0: { title: 'はじめまして',  tone: '丁寧で控えめ、距離感を大事に',                   emoji: '✦' },
  1: { title: '出会って間もない', tone: '親しみを少しずつ。敬語と砕けの混在',           emoji: '◌' },
  2: { title: '顔なじみ',       tone: 'タメ口混じり、たまに冗談を挟む',                 emoji: '◐' },
  3: { title: '仲良し',         tone: '友達口調、相談に寄り添う',                       emoji: '◑' },
  4: { title: '親友',           tone: '本音で話す、感情にも触れる',                     emoji: '◕' },
  5: { title: '相棒',           tone: '何でも言える、深い直感的アドバイスも',           emoji: '⊙' },
};

// ─── 次に出す質問を選ぶ ─────
export function pickNextQuestion(profile: BondProfile): BondQuestion | null {
  const skippedRecent = (qid: string) => {
    const ts = profile.skipped[qid];
    if (!ts) return false;
    return Date.now() - new Date(ts).getTime() < 24 * 3_600_000;
  };
  // 未回答 + 親密度を満たす + 最近スキップしてない
  const candidates = BOND_QUESTIONS.filter(q =>
    !(q.id in profile.answers) &&
    q.minLevel <= profile.level &&
    !skippedRecent(q.id)
  );
  if (!candidates.length) return null;
  // カテゴリの多様性を意識: 直近回答のカテゴリと違うもの優先
  // 簡易: 配列の最初を返す (BOND_QUESTIONS の順序に従う)
  return candidates[0];
}

// ─── AI コンテキスト サマリー生成 ─────
export function buildAiContext(profile: BondProfile): string {
  const a = profile.answers;
  const name = (a.name_to_call as string) || '';
  const lines: string[] = [];
  if (name) lines.push(`呼び方: ${name}`);
  if (a.birthday) {
    const s = shichuSuimei(a.birthday as string);
    if (s) lines.push(`四柱推命: 日干 ${s.dayStem} (${s.element} の ${s.yinYang}) / 干支 ${s.dayStem}${s.dayBranch} → ${s.oneLineFortune}`);
  }
  if (a.energy_type) {
    const map: Record<string, string> = {
      fire: '燃える炎エネルギー', water: '深い水のエネルギー',
      wind: '自由な風エネルギー', earth: '安定の大地エネルギー',
      metal: '研ぎ澄ました金属エネルギー',
    };
    lines.push(`今日のエネルギー: ${map[a.energy_type as string] || a.energy_type}`);
  }
  if (a.fav_color) lines.push(`今惹かれる色: ${a.fav_color}`);
  if (a.work_style) {
    const map: Record<string, string> = {
      influencer: '専業インフルエンサー',
      creator: 'クリエイター / アーティスト',
      freelance: 'フリーランス',
      entrepreneur: '自分の事業 / 経営者',
      corporate: '会社員 + 副業 SNS',
      professional: '士業 / 専門職',
      nightwork: '夜の仕事 (高単価指向)',
      hybrid: '複数の顔を持つマルチワーカー',
      other: 'その他',
    };
    lines.push(`働き方: ${map[a.work_style as string] || a.work_style}`);
  }
  if (a.follower_range) lines.push(`フォロワー帯: ${a.follower_range}`);
  if (a.biggest_desire) lines.push(`今の渇望: ${Array.isArray(a.biggest_desire) ? a.biggest_desire.join(', ') : a.biggest_desire}`);
  if (a.shadow) lines.push(`不安 (Iris にだけ): ${a.shadow}`);
  if (a.self_image) lines.push(`なりたい自分: ${a.self_image}`);
  if (a.why_iris) lines.push(`Iris に期待: ${a.why_iris}`);
  lines.push(`親密度レベル: ${profile.level}/5 (${LEVEL_VIBE[profile.level].title}) — トーン: ${LEVEL_VIBE[profile.level].tone}`);
  return lines.join('\n');
}

// ─── React Hook ─────
export function useIrisBond() {
  const [profile, setProfile] = useState<BondProfile>(() => load());

  // 他タブ更新
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setProfile(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const answer = useCallback((q: BondQuestion, value: string | string[] | number) => {
    setProfile(prev => {
      const newPoints = prev.points + q.points;
      const newLevel = pointsToLevel(newPoints);
      const next: BondProfile = {
        ...prev,
        points: newPoints,
        level: newLevel,
        answers: { ...prev.answers, [q.id]: value },
        lastPromptAt: new Date().toISOString(),
      };
      next.aiContextSummary = buildAiContext(next);
      persist(next);
      return next;
    });
  }, []);

  const skip = useCallback((qid: string) => {
    setProfile(prev => {
      const next = { ...prev, skipped: { ...prev.skipped, [qid]: new Date().toISOString() } };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setProfile(EMPTY);
    persist(EMPTY);
  }, []);

  return {
    profile,
    level: profile.level,
    vibe: LEVEL_VIBE[profile.level],
    nextQuestion: pickNextQuestion(profile),
    aiContext: profile.aiContextSummary || buildAiContext(profile),
    fortune: profile.answers.birthday ? shichuSuimei(profile.answers.birthday as string) : null,
    answer,
    skip,
    reset,
    /** プロンプト連投回避: 最後の質問から少なくとも 30 秒経過してるか */
    canPrompt: !profile.lastPromptAt || Date.now() - new Date(profile.lastPromptAt).getTime() > 30_000,
  };
}
