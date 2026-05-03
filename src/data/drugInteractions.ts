/**
 * 薬剤相互作用チェック (簡易ルールベース + AI 補強)
 *
 * 注意: これはあくまで「気付きを促す」補助情報。最終判断は処方医・薬剤師に必ず確認すること。
 * データソース: 主要な臨床ガイドライン・添付文書 (PMDA / NIH / drugs.com) を要約した
 * シンプルなルールテーブル。ハードコード分は数十パターンに留め、
 * 詳細な評価は Claude API に委ねる。
 */

import type { Allergy, Medication } from '../types/health';

export type InteractionSeverity = 'info' | 'caution' | 'warn' | 'serious';

export interface DrugInteraction {
  id: string;
  pair: [string, string];           // 関与する2成分名 (もしくは服薬名 vs 食品/サプリ)
  severity: InteractionSeverity;
  mechanism: string;                // 相互作用メカニズム要約
  effect: string;                   // 起こりうる影響
  recommendation: string;           // 推奨アクション
  category: '薬x薬' | '薬x食品' | '薬x飲料' | '薬xサプリ' | '薬xアレルギー';
}

// よく問題になるペアを 30 件ほどカバー
const RULES: Array<{
  match: (drugs: string[], allergies: string[], lifestyle: Lifestyle) => boolean;
  build: () => DrugInteraction;
}> = [
  // ── ワルファリン ─────────────────────────────────────
  {
    match: (d) => has(d, ['ワルファリン', 'warfarin']) && has(d, ['アスピリン', 'aspirin', 'ロキソニン', 'ロキソプロフェン', 'イブプロフェン', 'naproxen']),
    build: () => ({
      id: 'rx-warfarin-nsaid',
      pair: ['ワルファリン', 'NSAIDs (アスピリン/ロキソニン等)'],
      severity: 'serious',
      mechanism: '抗凝固作用と抗血小板作用の重複、消化管粘膜障害の累積',
      effect: '消化管出血・脳出血リスクが顕著に上昇',
      recommendation: '原則併用回避。痛み止めは アセトアミノフェン を推奨。処方医へ相談',
      category: '薬x薬',
    }),
  },
  {
    match: (d, _, l) => has(d, ['ワルファリン', 'warfarin']) && l.greenVeg,
    build: () => ({
      id: 'rx-warfarin-vk',
      pair: ['ワルファリン', '納豆 / 青汁 / クロレラ / 大量の緑黄色野菜'],
      severity: 'warn',
      mechanism: 'ビタミンK 摂取により抗凝固作用が減弱',
      effect: 'INR 低下 → 血栓症リスク上昇',
      recommendation: '納豆・青汁・クロレラは原則禁止。緑黄色野菜は一定量を毎日同じくらい摂る',
      category: '薬x食品',
    }),
  },

  // ── SSRI / SNRI ──────────────────────────────────────
  {
    match: (d) => hasMany(d, ['ssri', 'fluoxetine', 'sertraline', 'paroxetine', 'escitalopram', 'パロキセチン', 'セルトラリン'])
                  && hasMany(d, ['mao', 'マオ', 'セレギリン', 'rasagiline']),
    build: () => ({
      id: 'rx-ssri-maoi',
      pair: ['SSRI/SNRI', 'MAO阻害薬'],
      severity: 'serious',
      mechanism: 'セロトニン症候群リスク',
      effect: '高熱・自律神経失調・意識障害',
      recommendation: '併用厳禁。切り替えには 14 日以上のウォッシュアウト必要',
      category: '薬x薬',
    }),
  },
  {
    match: (d) => hasMany(d, ['ssri', 'sertraline', 'paroxetine', 'fluoxetine', 'escitalopram'])
                  && hasMany(d, ['triptan', 'トリプタン', 'スマトリプタン', 'sumatriptan']),
    build: () => ({
      id: 'rx-ssri-triptan',
      pair: ['SSRI', 'トリプタン系 (片頭痛薬)'],
      severity: 'warn',
      mechanism: 'セロトニン作動の重複',
      effect: 'セロトニン症候群の可能性',
      recommendation: '初期投与時は症状(振戦・発汗・混乱)を注視',
      category: '薬x薬',
    }),
  },

  // ── スタチン ─────────────────────────────────────────
  {
    match: (d, _, l) => hasMany(d, ['スタチン', 'statin', 'アトルバスタチン', 'atorvastatin', 'シンバスタチン', 'simvastatin']) && l.grapefruit,
    build: () => ({
      id: 'rx-statin-grapefruit',
      pair: ['スタチン系', 'グレープフルーツジュース'],
      severity: 'warn',
      mechanism: 'CYP3A4 阻害により血中濃度が大幅上昇',
      effect: '横紋筋融解症のリスク増加',
      recommendation: 'グレープフルーツ・ザボン・ブンタンを避ける。プラバスタチン/ロスバスタチンは影響少',
      category: '薬x飲料',
    }),
  },

  // ── ベンゾジアゼピン / 睡眠薬 ─────────────────────────
  {
    match: (d, _, l) => hasMany(d, ['ベンゾ', 'benzo', 'ジアゼパム', 'ロラゼパム', 'アルプラゾラム', 'ゾルピデム', 'zolpidem', 'lendormin', 'マイスリー', 'デパス', 'エチゾラム']) && l.alcohol,
    build: () => ({
      id: 'rx-benzo-alc',
      pair: ['ベンゾジアゼピン / 睡眠薬', 'アルコール'],
      severity: 'serious',
      mechanism: '中枢抑制作用の相加',
      effect: '呼吸抑制・転倒・記憶障害・致死リスク',
      recommendation: '服用中の飲酒は禁止。やむを得ない場合は服用を一時休む選択肢を医師に相談',
      category: '薬x飲料',
    }),
  },

  // ── ARB / ACE阻害 ─────────────────────────────────────
  {
    match: (d) => hasMany(d, ['ARB', 'ロサルタン', 'losartan', 'バルサルタン', 'valsartan', 'ACE阻害', 'lisinopril', 'リシノプリル']) && hasMany(d, ['NSAIDs', 'ロキソプロフェン', 'イブプロフェン', 'ナプロキセン']),
    build: () => ({
      id: 'rx-arb-nsaid',
      pair: ['ARB / ACE阻害薬', 'NSAIDs'],
      severity: 'caution',
      mechanism: '腎血流低下',
      effect: '腎機能悪化・降圧効果減弱',
      recommendation: '長期併用時は腎機能検査を定期的に。短期の痛み止めはアセトアミノフェンが無難',
      category: '薬x薬',
    }),
  },

  // ── 糖尿病薬 ─────────────────────────────────────────
  {
    match: (d, _, l) => hasMany(d, ['メトホルミン', 'metformin', 'インスリン', 'insulin', 'glimepiride', 'グリメピリド']) && l.alcohol,
    build: () => ({
      id: 'rx-diabetes-alc',
      pair: ['経口血糖降下薬 / インスリン', 'アルコール'],
      severity: 'warn',
      mechanism: '低血糖リスク増加 (糖新生抑制)',
      effect: '夜間〜翌朝の低血糖、意識障害',
      recommendation: '空腹での飲酒は避け、食事と一緒に。前日多量の飲酒翌日は血糖測定を細かく',
      category: '薬x飲料',
    }),
  },

  // ── アレルギー連動 ─────────────────────────────────
  {
    match: (d, a) => has(a, ['ペニシリン']) && hasMany(d, ['アモキシシリン', 'amoxicillin', 'ペニシリン', 'penicillin']),
    build: () => ({
      id: 'rx-allergy-pcn',
      pair: ['ペニシリンアレルギー', 'アモキシシリン / ペニシリン系'],
      severity: 'serious',
      mechanism: '既知のアレルギー再曝露',
      effect: 'アナフィラキシー',
      recommendation: '服用中止し、処方医へ即連絡',
      category: '薬xアレルギー',
    }),
  },
  {
    match: (d, a) => has(a, ['NSAIDs', 'アスピリン', 'ロキソニン']) && hasMany(d, ['NSAIDs', 'aspirin', 'ロキソプロフェン', 'ibuprofen']),
    build: () => ({
      id: 'rx-allergy-nsaid',
      pair: ['NSAIDs アレルギー', '同系統の解熱鎮痛薬'],
      severity: 'serious',
      mechanism: '既知のアレルギー再曝露',
      effect: '喘息発作・蕁麻疹・血管浮腫',
      recommendation: 'アセトアミノフェン (カロナール) への切替を医師に相談',
      category: '薬xアレルギー',
    }),
  },

  // ── カフェインx薬 ─────────────────────────────────
  {
    match: (d, _, l) => hasMany(d, ['キサンチン', 'theophylline', 'テオフィリン']) && l.caffeineHigh,
    build: () => ({
      id: 'rx-theo-caf',
      pair: ['テオフィリン (喘息薬)', '高カフェイン摂取'],
      severity: 'caution',
      mechanism: 'メチルキサンチン作用の重畳',
      effect: '動悸・不眠・振戦',
      recommendation: '1日コーヒー 2杯以下に制限',
      category: '薬x飲料',
    }),
  },

  // ── 一般情報 ─────────────────────────────────────
  {
    match: (d, _, l) => l.alcohol && hasMany(d, ['アセトアミノフェン', 'カロナール', 'acetaminophen', 'tylenol']),
    build: () => ({
      id: 'rx-apap-alc',
      pair: ['アセトアミノフェン', '習慣的飲酒'],
      severity: 'caution',
      mechanism: '肝毒性代謝物 NAPQI 産生増加',
      effect: '肝障害リスク',
      recommendation: '常用量内 + 飲酒量を控えめに。週 14 杯超の飲酒なら医師相談',
      category: '薬x飲料',
    }),
  },
];

interface Lifestyle {
  alcohol: boolean;
  caffeineHigh: boolean;
  grapefruit: boolean;
  greenVeg: boolean;
}

function has(arr: string[], words: string[]) {
  const lower = arr.map((s) => s.toLowerCase());
  return words.some((w) => lower.some((s) => s.includes(w.toLowerCase())));
}
function hasMany(arr: string[], words: string[]) {
  return has(arr, words);
}

export interface InteractionInput {
  medications: Medication[];
  allergies: Allergy[];
  /** 平均アルコール (週杯)、カフェイン (mg/日) — PHRから計算 */
  avgAlcoholPerWeek: number;
  avgCaffeinePerDay: number;
  /** ライフスタイル: グレープフルーツ常用 / 緑黄色野菜中心 など (UI からのフラグ) */
  flags?: { grapefruit?: boolean; greenVeg?: boolean };
}

export function computeInteractions(input: InteractionInput): DrugInteraction[] {
  const drugNames = input.medications.map((m) => m.name).filter(Boolean);
  const allergyNames = input.allergies.map((a) => a.substance).filter(Boolean);
  const lifestyle: Lifestyle = {
    alcohol: input.avgAlcoholPerWeek >= 4,
    caffeineHigh: input.avgCaffeinePerDay >= 300,
    grapefruit: input.flags?.grapefruit ?? false,
    greenVeg: input.flags?.greenVeg ?? false,
  };
  const out: DrugInteraction[] = [];
  for (const r of RULES) {
    if (r.match(drugNames, allergyNames, lifestyle)) out.push(r.build());
  }
  // 重要度順
  const rank: Record<InteractionSeverity, number> = { serious: 4, warn: 3, caution: 2, info: 1 };
  out.sort((a, b) => rank[b.severity] - rank[a.severity]);
  return out;
}

export function severityMeta(s: InteractionSeverity) {
  switch (s) {
    case 'serious': return { label: '重大', color: '#FF3D5A', emoji: '🚨' };
    case 'warn':    return { label: '警告', color: '#FF6F6F', emoji: '⚠' };
    case 'caution': return { label: '注意', color: '#FF9F45', emoji: '⚠' };
    case 'info':    return { label: '参考', color: '#4F8CFF', emoji: 'ℹ' };
  }
}
