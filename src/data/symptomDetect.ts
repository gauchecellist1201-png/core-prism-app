import type { BodyRegion, SymptomSeverity, SymptomDuration } from '../types/health';

export interface SymptomSeed {
  region: BodyRegion;
  description: string;
  severity: SymptomSeverity;
  duration: SymptomDuration;
  matchedKeywords: string[];
}

// 部位ごとのキーワード辞書
const REGION_PATTERNS: Array<{ region: BodyRegion; words: string[] }> = [
  { region: '頭部',     words: ['頭痛', '頭が痛', 'こめかみ', '偏頭痛', '片頭痛', '後頭部'] },
  { region: '目',       words: ['目がかすむ', '目の奥', '視界', '眼精', 'まぶた'] },
  { region: '耳',       words: ['耳鳴り', '耳が痛', '聞こえに'] },
  { region: '鼻',       words: ['鼻水', '鼻づまり', '花粉', 'くしゃみ'] },
  { region: '口・喉',   words: ['喉が痛', 'のどの', '咽頭', '飲み込', '声が'] },
  { region: '首・肩',   words: ['肩こり', '首が痛', '寝違え'] },
  { region: '胸部',     words: ['胸が痛', '胸痛', '動悸', '息切れ', '息苦', '胸焼け', '逆流'] },
  { region: '腹部',     words: ['腹痛', 'お腹', '胃が', '胃痛', '吐き気', 'むかつき', '下痢', '便秘', '膨満'] },
  { region: '背中・腰', words: ['腰痛', '腰が痛', '背中が痛', 'ぎっくり'] },
  { region: '四肢',     words: ['膝が痛', '足が痛', '腕が痛', 'しびれ', '関節', '筋肉痛'] },
  { region: '皮膚',     words: ['かゆ', '発疹', '湿疹', 'じんま', '蕁麻', 'ニキビ', '腫れ'] },
  { region: '全身',     words: ['発熱', '熱が', '微熱', '寒気', '悪寒', '倦怠', 'だるい', '疲労', '咳', '痰'] },
  { region: '精神',     words: ['不安', '眠れな', '気分が落', '集中でき', '憂鬱', 'うつ', 'パニック', 'やる気'] },
];

// 強度を示す副詞・形容詞
const SEVERITY_HIGH = ['激し', '耐えられ', 'ひどく', 'すごく', '強烈', '我慢でき', '止まらな'];
const SEVERITY_MID  = ['とても', 'かなり', 'けっこう', '結構', '気になる', 'よく'];
const SEVERITY_LOW  = ['少し', 'ちょっと', '軽く', '時々', 'たまに'];

const DURATION_PATTERNS: Array<{ d: SymptomDuration; words: string[] }> = [
  { d: 'minutes', words: ['さっき', '今急に', '直前', '数分前'] },
  { d: 'hours',   words: ['今朝から', '昼から', '夕方から', '今日'] },
  { d: '1-3days', words: ['昨日', '一昨日', '2日前', '3日前', '数日'] },
  { d: 'week',    words: ['1週間', '7日', '先週'] },
  { d: 'month',   words: ['1ヶ月', '一ヶ月', '先月', '数週間'] },
  { d: 'longer',  words: ['ずっと', '長年', '何年も'] },
];

/**
 * メッセージから症状の手がかりを抽出。
 * 該当しない場合は null を返す。
 */
export function detectSymptom(message: string): SymptomSeed | null {
  const text = message.replace(/\s/g, '');
  const matched: string[] = [];

  // 部位検出（最初にマッチした region を採用）
  let region: BodyRegion | null = null;
  for (const p of REGION_PATTERNS) {
    for (const w of p.words) {
      if (text.includes(w)) {
        if (!region) region = p.region;
        matched.push(w);
        break;
      }
    }
    if (region) break;
  }
  if (!region) return null;

  // 強度
  let severity: SymptomSeverity = 'moderate';
  if (SEVERITY_HIGH.some((w) => text.includes(w))) severity = 'severe';
  else if (SEVERITY_LOW.some((w) => text.includes(w))) severity = 'mild';
  else if (SEVERITY_MID.some((w) => text.includes(w))) severity = 'moderate';

  // 持続期間
  let duration: SymptomDuration = '1-3days';
  for (const dp of DURATION_PATTERNS) {
    if (dp.words.some((w) => text.includes(w))) {
      duration = dp.d;
      break;
    }
  }

  return {
    region,
    description: message.trim(),
    severity,
    duration,
    matchedKeywords: matched,
  };
}

/** 症状検出が「強い受診示唆」を含むかどうか */
export function hasRedFlag(message: string): boolean {
  const t = message.replace(/\s/g, '');
  const FLAGS = [
    '激しい胸痛', '突然の頭痛', 'ろれつ', '麻痺', '意識', '吐血', '血便',
    '呼吸困難', '高熱が', '40度', '40℃', '冷や汗', '失神', 'けいれん',
  ];
  return FLAGS.some((f) => t.includes(f));
}
