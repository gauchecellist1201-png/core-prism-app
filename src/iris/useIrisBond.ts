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
      { value: 'fire',   label: '燃える炎', emoji: '' },
      { value: 'water',  label: '深い水',  emoji: '' },
      { value: 'wind',   label: '自由な風', emoji: '' },
      { value: 'earth',  label: '安定の大地', emoji: '' },
      { value: 'metal',  label: '研ぎ澄ました金属', emoji: '' },
    ],
  },
  {
    id: 'fav_color',
    category: 'taste', minLevel: 1,
    prompt: '今いちばん惹かれる色',
    kind: 'select', points: 2,
    options: [
      { value: 'pink',     label: 'ピンク',     emoji: '' },
      { value: 'red',      label: '赤',        emoji: '' },
      { value: 'black',    label: '黒',        emoji: '' },
      { value: 'white',    label: '白',        emoji: '' },
      { value: 'gold',     label: 'ゴールド',  emoji: '' },
      { value: 'silver',   label: 'シルバー',  emoji: '' },
      { value: 'purple',   label: '紫',        emoji: '' },
      { value: 'blue',     label: '青',        emoji: '' },
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

// ─── Iris キャラクター (Persona) ─────
// ユーザーが Iris の人格を選ぶ。デフォルトは pink (共感型)
export type IrisPersonaId = 'pink' | 'mystery' | 'kira' | 'night' | 'elegant' | 'stoic';

export type IrisPersonaIconId = 'flower' | 'eye' | 'sparkles' | 'moon' | 'gem' | 'zap';

export interface IrisPersona {
  id: IrisPersonaId;
  /** Lucide アイコン識別子。レンダリングは IrisPersonaPicker 側で行う */
  iconId: IrisPersonaIconId;
  name: string;         // 短い名前
  title: string;        // 一行紹介
  toneInstruction: string;  // システムプロンプトに差し込む口調指示
  accentColor: string;  // テーマアクセント
}

export const IRIS_PERSONAS: IrisPersona[] = [
  {
    id: 'pink',
    iconId: 'flower',
    name: 'ピンクのお姉さん',
    title: '共感型・やさしく寄り添う',
    accentColor: '#F472B6',
    toneInstruction:
      '口調: 共感型のお姉さん。まず「わかる」「それ大事」と受け止めてから提案する。' +
      '柔らかい言葉、絵文字なし、デコレーションなし。距離感は近すぎず遠すぎず。' +
      '例: 「うん、それ整理しよっか」「私だったら〜、どう思う?」',
  },
  {
    id: 'mystery',
    iconId: 'eye',
    name: 'ミステリアスな先輩',
    title: 'クール・本質を突く',
    accentColor: '#6B7280',
    toneInstruction:
      '口調: 静かで本質を突く先輩。短く、断定的に。共感は最小限。' +
      '相手の言葉の中の「本当の欲」を見抜いて返す。' +
      '例: 「それ、本当に欲しいのは数字じゃないでしょ」「答えはもう持ってる」',
  },
  {
    id: 'kira',
    iconId: 'sparkles',
    name: 'きらきら系の親友',
    title: 'ハイテンション・ポジティブ',
    accentColor: '#FBBF24',
    toneInstruction:
      '口調: 明るい親友。テンション高め、でも軽薄じゃない。' +
      '「いいじゃん!」「やろやろ!」と一緒にワクワクするスタンス。' +
      '具体行動を 1 つに絞って提案。',
  },
  {
    id: 'night',
    iconId: 'moon',
    name: '夜の知性派',
    title: '哲学的・深い洞察',
    accentColor: '#7C3AED',
    toneInstruction:
      '口調: 落ち着いた知性派。比喩と問いを混ぜる。深夜に話したくなる相手。' +
      '答えを与えるより問いを返すことで気づきを引き出す。' +
      '例: 「その不安、輪郭を言語化してみよう」「焦りは方位を見失ったサイン」',
  },
  {
    id: 'elegant',
    iconId: 'gem',
    name: 'エレガントな先輩',
    title: '上品・ハイクラス志向',
    accentColor: '#0EA5E9',
    toneInstruction:
      '口調: 丁寧で品のある先輩。敬語と砕けた言葉を上品に混ぜる。' +
      '「〜ですわ」のような誇張は NG。自然なエレガンス。' +
      '相手の格を上げる視点で提案する。',
  },
  {
    id: 'stoic',
    iconId: 'zap',
    name: 'ストイックなコーチ',
    title: '厳しめ・成長を促す',
    accentColor: '#DC2626',
    toneInstruction:
      '口調: 厳しめのコーチ。甘やかさず、でも見捨てない。' +
      '事実を直視させ、次の 1 手を要求する。' +
      '例: 「言い訳より、次の手は?」「やる気じゃなく行動の話をしよう」',
  },
];

const PERSONA_KEY = 'iris_persona_v1';

export function loadPersona(): IrisPersonaId {
  try {
    const v = localStorage.getItem(PERSONA_KEY);
    if (v && IRIS_PERSONAS.find(p => p.id === v)) return v as IrisPersonaId;
  } catch { /* */ }
  return 'pink';
}
const PERSONA_CHANGE_EVENT = 'iris-persona-change';
export function savePersona(id: IrisPersonaId) {
  try {
    localStorage.setItem(PERSONA_KEY, id);
    window.dispatchEvent(new CustomEvent(PERSONA_CHANGE_EVENT, { detail: id }));
  } catch { /* */ }
}
export function getPersona(id: IrisPersonaId): IrisPersona {
  return IRIS_PERSONAS.find(p => p.id === id) || IRIS_PERSONAS[0];
}

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

// ─── 数秘術: ライフパスナンバー ─────
export function lifePathNumber(birthIso: string): {
  number: number;          // 1-9 or 11/22/33
  isMaster: boolean;
  traits: string;
  career: string;
} | null {
  try {
    const d = new Date(birthIso);
    if (isNaN(d.getTime())) return null;
    const digits = (d.getUTCFullYear().toString() +
                    String(d.getUTCMonth() + 1).padStart(2, '0') +
                    String(d.getUTCDate()).padStart(2, '0'))
      .split('').map(Number);
    let sum = digits.reduce((a, b) => a + b, 0);
    while (sum > 9 && sum !== 11 && sum !== 22 && sum !== 33) {
      sum = String(sum).split('').map(Number).reduce((a, b) => a + b, 0);
    }
    const isMaster = sum === 11 || sum === 22 || sum === 33;
    const traits: Record<number, string> = {
      1: 'リーダー / 開拓者。0→1 が向いてる',
      2: '調和 / 共感の人。チームの潤滑油',
      3: '表現者。クリエイティブと発信が武器',
      4: '堅実・職人型。仕組み化に強い',
      5: '自由人 / 変化を好む。多動が才能',
      6: '世話役 / 教育者。コミュニティを育てる',
      7: '研究者 / 内省。深さで勝負',
      8: '実業家 / お金を動かす力。スケール思考',
      9: '完成 / 奉仕。共感と影響力で人を動かす',
      11: '直感の天才。スピリチュアル感度が高い',
      22: 'マスタービルダー。大きな現実を具現化',
      33: 'マスター愛。世界規模の影響力',
    };
    const career: Record<number, string> = {
      1: '創業 / 個人ブランド / 一番手ポジション',
      2: 'パートナーシップ / 二人三脚事業 / 仲介',
      3: 'クリエイター / SNS / エンタメ / 講演',
      4: '士業 / 経理 / オペレーション設計',
      5: '旅 / マルチワーカー / 新規開拓営業',
      6: 'コミュニティ運営 / 教育 / カウンセラー',
      7: '専門家 / 研究 / ライター / コンサル',
      8: '経営 / 投資 / 高単価サービス',
      9: 'ブランド構築 / NPO / メンター',
      11: 'ヒーラー / 占い師 / 直感型コーチ',
      22: '大企業創業 / グローバル事業',
      33: '思想家 / 教祖型インフルエンサー',
    };
    return {
      number: sum,
      isMaster,
      traits: traits[sum] || '',
      career: career[sum] || '',
    };
  } catch { return null; }
}

// ─── パーソナルカラー (簡易判定: 好み色 + 五行から推定) ─────
export type PersonalColorSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export interface PersonalColorResult {
  season: PersonalColorSeason;
  label: string;
  palette: string[];
  recommend: string;
}

export function deducePersonalColor(favColor?: string, element?: string): PersonalColorResult | null {
  if (!favColor && !element) return null;
  // ざっくり推定。あとで対面診断アップグレード余地
  const summerColors = ['white', 'silver', 'blue'];
  const autumnColors = ['red'];
  const winterColors = ['black', 'purple'];
  let season: PersonalColorSeason = 'spring';
  if (favColor) {
    if (summerColors.includes(favColor)) season = 'summer';
    else if (autumnColors.includes(favColor)) season = 'autumn';
    else if (winterColors.includes(favColor)) season = 'winter';
  } else if (element) {
    const map: Record<string, PersonalColorSeason> = {
      木: 'spring', 火: 'autumn', 土: 'autumn', 金: 'winter', 水: 'summer',
    };
    season = map[element] || 'spring';
  }
  const presets: Record<PersonalColorSeason, PersonalColorResult> = {
    spring: {
      season: 'spring',
      label: 'スプリング (ライト・ブライト)',
      palette: ['#FFE5EC', '#FBBF24', '#FCD34D', '#A7F3D0', '#FBCFE8'],
      recommend: '黄み寄りの明るい色。コーラル / ピーチ / アイボリーが映える',
    },
    summer: {
      season: 'summer',
      label: 'サマー (ライト・ソフト)',
      palette: ['#E0E7FF', '#FBCFE8', '#C7D2FE', '#F5D0FE', '#FECDD3'],
      recommend: '青み寄りのソフトな色。くすみピンク / ラベンダー / グレージュ',
    },
    autumn: {
      season: 'autumn',
      label: 'オータム (ディープ・ウォーム)',
      palette: ['#92400E', '#C2410C', '#A16207', '#7C2D12', '#854D0E'],
      recommend: '深みのある黄み寄り。テラコッタ / カーキ / マスタード',
    },
    winter: {
      season: 'winter',
      label: 'ウィンター (ディープ・ビビッド)',
      palette: ['#0F172A', '#7C3AED', '#BE123C', '#1E40AF', '#000000'],
      recommend: '青み寄りの鮮やかな色 or 真っ黒。ロイヤルブルー / ワインレッド',
    },
  };
  return presets[season];
}

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
  0: { title: 'はじめまして',  tone: '丁寧で控えめ、距離感を大事に',                   emoji: '' },
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
  // 数秘術
  if (a.birthday) {
    const n = lifePathNumber(a.birthday as string);
    if (n) lines.push(`数秘術: ライフパス ${n.number}${n.isMaster ? ' (マスター)' : ''} — ${n.traits} / 向く仕事: ${n.career}`);
  }
  // パーソナルカラー (簡易)
  {
    const s = a.birthday ? shichuSuimei(a.birthday as string) : null;
    const pc = deducePersonalColor(a.fav_color as string | undefined, s?.element);
    if (pc) lines.push(`パーソナルカラー(推定): ${pc.label} — ${pc.recommend}`);
  }
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
  // Persona
  const persona = getPersona(loadPersona());
  lines.push(`選択された Iris キャラクター: ${persona.name} (${persona.title})`);
  lines.push(`キャラクター口調指示: ${persona.toneInstruction}`);
  // work_style 別の追加コンテキスト
  if (a.work_style) {
    const ws = a.work_style as string;
    const focusMap: Record<string, string> = {
      influencer: '投稿スケジュール / ファンエンゲージメント / 案件報酬の妥当性を優先トピックに',
      creator: '作品の発信戦略 / ポートフォリオ / 単価上げを優先トピックに',
      freelance: 'クライアント案件のスコープ / 工数 / 請求文面を優先トピックに',
      entrepreneur: 'KPI / 投資家 / メンタル管理 (孤独な経営者向け) を優先トピックに',
      corporate: '本業と副業のバランス / 時間設計 / 副業の伸ばし方を優先トピックに',
      professional: '専門性ブランディング / 高単価サービス設計を優先トピックに',
      nightwork: '同伴投稿 / お店バレ防止 / 表アカウント運用 (任意機能) を理解しているが、相手から触れない限り提案しない。倫理的に違法/誘引行為は提案しない',
      hybrid: '複数の顔の使い分け / アカウント切替 / 時間配分を優先トピックに',
    };
    if (focusMap[ws]) lines.push(`働き方コンテキスト: ${focusMap[ws]}`);
  }
  return lines.join('\n');
}

// ─── React Hook ─────
export function useIrisBond() {
  const [profile, setProfile] = useState<BondProfile>(() => load());
  const [personaId, setPersonaIdState] = useState<IrisPersonaId>(() => loadPersona());
  const [levelUpTo, setLevelUpTo] = useState<BondLevel | null>(null);

  // 他タブ + 同一タブの persona/profile 変更を同期
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setProfile(load());
      if (e.key === PERSONA_KEY) setPersonaIdState(loadPersona());
    };
    const onPersonaChange = () => setPersonaIdState(loadPersona());
    window.addEventListener('storage', onStorage);
    window.addEventListener(PERSONA_CHANGE_EVENT, onPersonaChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PERSONA_CHANGE_EVENT, onPersonaChange);
    };
  }, []);

  const answer = useCallback((q: BondQuestion, value: string | string[] | number) => {
    setProfile(prev => {
      const newPoints = prev.points + q.points;
      const newLevel = pointsToLevel(newPoints);
      if (newLevel > prev.level) setLevelUpTo(newLevel);
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

  const setPersona = useCallback((id: IrisPersonaId) => {
    savePersona(id);
    setPersonaIdState(id);
    setProfile(prev => {
      const next = { ...prev };
      next.aiContextSummary = buildAiContext(next);
      persist(next);
      return next;
    });
  }, []);

  const clearLevelUp = useCallback(() => setLevelUpTo(null), []);

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

  const numerology = profile.answers.birthday ? lifePathNumber(profile.answers.birthday as string) : null;
  const fortune = profile.answers.birthday ? shichuSuimei(profile.answers.birthday as string) : null;
  const personalColor = deducePersonalColor(profile.answers.fav_color as string | undefined, fortune?.element);

  return {
    profile,
    level: profile.level,
    vibe: LEVEL_VIBE[profile.level],
    nextQuestion: pickNextQuestion(profile),
    // 毎回 fresh に組み立てる (persona 切替や数秘術アップグレードを即反映)
    aiContext: buildAiContext(profile),
    fortune,
    numerology,
    personalColor,
    persona: getPersona(personaId),
    personaId,
    setPersona,
    answer,
    skip,
    reset,
    levelUpTo,
    clearLevelUp,
    /** プロンプト連投回避: 最後の質問から少なくとも 30 秒経過してるか */
    canPrompt: !profile.lastPromptAt || Date.now() - new Date(profile.lastPromptAt).getTime() > 30_000,
  };
}
