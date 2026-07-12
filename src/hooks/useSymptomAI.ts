import { useCallback, useState } from 'react';
import type {
  AppSettings,
  ChatMessage,
} from '../types/identity';
import type {
import { aiFetch } from '../lib/aiFetch';
  DailyHealth,
  MedicalProfile,
  SymptomEntry,
  SymptomAnalysis,
  DifferentialSuggestion,
  Urgency,
} from '../types/health';

// API キーは main.tsx の fetch interceptor が localStorage から自動付与

function summarizePhr(days: DailyHealth[]) {
  const last = days[days.length - 1];
  const week = days.slice(-7);
  if (!last) return '直近のPHRデータなし';
  const avg = (k: keyof DailyHealth) =>
    week.reduce((s, d) => s + Number(d[k] ?? 0), 0) / week.length;
  return [
    `本日 (${last.date}):`,
    `  睡眠 ${last.sleepHours}h / 深睡眠 ${last.deepSleepMin}分 / 睡眠スコア ${last.sleepScore}`,
    `  HRV ${last.hrv}ms / 安静時心拍 ${last.restingHR}bpm / リカバリー ${last.recoveryScore}`,
    `  歩数 ${last.steps} / 活動 ${last.activeMinutes}分 / 運動消費 ${last.exerciseKcal}kcal`,
    `  ストレス ${last.stressLevel} / マインドフル ${last.mindfulMinutes}分`,
    `  水分 ${last.hydrationL}L / カフェイン ${last.caffeineMg}mg / アルコール ${last.alcoholDrinks}杯`,
    `  ${last.weightKg ? `体重 ${last.weightKg}kg / ` : ''}${last.bp ? `血圧 ${last.bp.sys}/${last.bp.dia} / ` : ''}`,
    '',
    `7日平均: 睡眠 ${avg('sleepHours').toFixed(1)}h / HRV ${Math.round(avg('hrv'))}ms / 歩数 ${Math.round(avg('steps'))}`,
  ].join('\n');
}

function summarizeHistory(profile: MedicalProfile) {
  const lines: string[] = [];
  if (profile.bloodType) lines.push(`血液型 ${profile.bloodType}${profile.rhFactor ?? ''}`);
  if (profile.birthYear) lines.push(`生年 ${profile.birthYear}年`);
  if (profile.sex) lines.push(`性別 ${profile.sex}`);
  if (profile.heightCm) lines.push(`身長 ${profile.heightCm}cm`);

  if (profile.conditions.length)
    lines.push(`既往歴: ${profile.conditions.map((c) => `${c.name}${c.diagnosedYear ? `(${c.diagnosedYear})` : ''}/${c.status}`).join(', ')}`);
  else lines.push('既往歴: なし');

  if (profile.medications.length)
    lines.push(`服用中: ${profile.medications.map((m) => `${m.name} ${m.dose} ${m.frequency}`).join(', ')}`);
  else lines.push('服用中: なし');

  if (profile.allergies.length)
    lines.push(`アレルギー: ${profile.allergies.map((a) => `${a.substance}(${a.reaction}/${a.severity})`).join(', ')}`);
  else lines.push('アレルギー: なし');

  if (profile.familyHistory.length)
    lines.push(`家族歴: ${profile.familyHistory.map((f) => `${f.relation}-${f.condition}${f.ageOfOnset ? `(${f.ageOfOnset}歳発症)` : ''}`).join(', ')}`);
  else lines.push('家族歴: 未登録');

  return lines.join('\n');
}

function symptomToText(s: SymptomEntry) {
  const sevLabel = { mild: '軽度', moderate: '中等度', severe: '強い' }[s.severity];
  const durLabel = {
    minutes: '数分',
    hours: '数時間',
    '1-3days': '1〜3日',
    week: '1週間',
    month: '1ヶ月以上',
    longer: 'それ以上',
  }[s.duration];
  return `[${s.region}] ${s.description} — ${sevLabel} / 持続 ${durLabel}`;
}

const ANALYSIS_SYSTEM = `あなたは経験豊富な総合診療医のサポートAIです。
ユーザーの自覚症状・PHR（睡眠/HRV/活動/ストレス）・既往歴・服用薬・アレルギー・家族歴 を統合して、
鑑別すべき疾患（differentials）と緊急度、自宅で出来るケア、必要な受診タイミングを
できる限り客観的・冷静に提示してください。

【厳守】
- 確定診断はしない。鑑別仮説（differential）として複数候補を確率（0-100の主観確率）で提示する
- 重篤な兆候があれば urgency を er/urgent-care にする
- 各候補に「なぜそう考えたか」(matchedSignals) を必ず2-5個書く
- 一般的なセルフケアと、医師受診の目安（whenToSeeDoctor）を簡潔に書く
- 日本の医療制度を前提にする（科の名前は日本語で）
- 「医学的助言ではなく、医療従事者の診察を代替するものではない」旨をdisclaimerに含める
- 必ず JSON 1個だけを返す（前後にテキストや \`\`\` を付けない）

【出力スキーマ】
{
  "contextSummary": "ユーザー状況の1-2文要約",
  "topUrgency": "self-care|monitor|gp-soon|gp-today|urgent-care|er",
  "differentials": [
    {
      "conditionName": "日本語病名",
      "conditionNameEn": "English name",
      "likelihood": 0-100,
      "matchedSignals": ["...","..."],
      "urgency": "self-care|monitor|gp-soon|gp-today|urgent-care|er",
      "selfCare": ["..."],
      "whenToSeeDoctor": "...",
      "category": "内科|消化器|循環器|呼吸器|皮膚|整形外科|精神|耳鼻咽喉|婦人科|その他"
    }
  ],
  "habits": ["生活習慣の提案 1", "提案 2", "提案 3"],
  "redFlags": ["即受診すべき症状 1", "..."],
  "disclaimer": "..."
}
`;

const DEFAULT_DISCLAIMER =
  '本機能はAIによる参考情報の提示であり、医学的診断ではありません。症状が強い・続く・悪化する場合は速やかに医療機関を受診してください。';

const MOCK_DIFFERENTIALS: Record<string, DifferentialSuggestion[]> = {
  '頭部': [
    {
      id: 'd1', conditionName: '緊張型頭痛', conditionNameEn: 'Tension-type headache',
      likelihood: 64, matchedSignals: ['睡眠不足', '高ストレス', '長時間のデスクワーク'],
      urgency: 'self-care', selfCare: ['10分の温罨法', '肩首ストレッチ', '水分補給'],
      whenToSeeDoctor: '週3回以上または市販鎮痛薬で改善しない場合は神経内科へ',
      category: '内科',
    },
    {
      id: 'd2', conditionName: '片頭痛', conditionNameEn: 'Migraine',
      likelihood: 28, matchedSignals: ['一側性の拍動痛', '光・音過敏の傾向'],
      urgency: 'monitor', selfCare: ['暗く静かな環境で休息'],
      whenToSeeDoctor: '月2回以上で日常に支障があれば頭痛外来へ',
      category: '内科',
    },
  ],
  '胸部': [
    {
      id: 'd1', conditionName: '逆流性食道炎 (疑い)', conditionNameEn: 'GERD (suspected)',
      likelihood: 52, matchedSignals: ['胸焼け', '夜間悪化', '高カフェイン記録'],
      urgency: 'gp-soon', selfCare: ['就寝3時間前の食事を避ける', '上半身を高くして就寝', 'カフェイン削減'],
      whenToSeeDoctor: '2週間以上続く・体重減少を伴うなら消化器内科へ',
      category: '消化器',
    },
    {
      id: 'd2', conditionName: '不安発作', conditionNameEn: 'Anxiety / panic',
      likelihood: 22, matchedSignals: ['HRV低下', 'ストレス値高', '動悸の自覚'],
      urgency: 'gp-soon', selfCare: ['呼吸法 4-7-8', 'カフェイン削減'],
      whenToSeeDoctor: '生活に支障があれば心療内科へ',
      category: '精神',
    },
    {
      id: 'd3', conditionName: '虚血性心疾患 (要除外)', conditionNameEn: 'Ischemic heart disease',
      likelihood: 6, matchedSignals: ['念のための鑑別'],
      urgency: 'er',
      selfCare: ['冷や汗・左肩への放散・呼吸困難があれば救急要請'],
      whenToSeeDoctor: '安静で消えない胸痛や呼吸困難は即119',
      category: '循環器',
    },
  ],
  '腹部': [
    {
      id: 'd1', conditionName: '機能性ディスペプシア', conditionNameEn: 'Functional dyspepsia',
      likelihood: 48, matchedSignals: ['食後膨満', 'ストレス', '不規則な食事'],
      urgency: 'gp-soon', selfCare: ['1回量を減らし回数を増やす', 'ゆっくり咀嚼'],
      whenToSeeDoctor: '体重減少・吐血があれば内視鏡検査へ',
      category: '消化器',
    },
  ],
  '皮膚': [
    {
      id: 'd1', conditionName: '接触皮膚炎', conditionNameEn: 'Contact dermatitis',
      likelihood: 55, matchedSignals: ['発症部位', '近接の新製品使用'],
      urgency: 'self-care', selfCare: ['原因物質を避ける', '保湿', '抗ヒスタミン外用'],
      whenToSeeDoctor: '広範囲・水疱・発熱があれば皮膚科へ',
      category: '皮膚',
    },
  ],
  '全身': [
    {
      id: 'd1', conditionName: '上気道感染症', conditionNameEn: 'URI',
      likelihood: 62, matchedSignals: ['倦怠感', '咽頭違和感', '寒気'],
      urgency: 'monitor', selfCare: ['加湿', '十分な睡眠', '水分'],
      whenToSeeDoctor: '38.5℃以上3日続く・呼吸苦は内科へ',
      category: '内科',
    },
    {
      id: 'd2', conditionName: '慢性疲労', conditionNameEn: 'Chronic fatigue',
      likelihood: 24, matchedSignals: ['睡眠負債', 'HRV低下', 'ストレス連続'],
      urgency: 'gp-soon', selfCare: ['睡眠時間+1h', 'カフェイン削減'],
      whenToSeeDoctor: '1ヶ月以上続けば内科へ',
      category: '内科',
    },
  ],
  '精神': [
    {
      id: 'd1', conditionName: '適応障害 (疑い)', conditionNameEn: 'Adjustment disorder',
      likelihood: 42, matchedSignals: ['ストレス源の存在', '睡眠の質低下', '気分の落ち込み'],
      urgency: 'gp-soon', selfCare: ['ストレス源との距離', '運動を再開'],
      whenToSeeDoctor: '2週間以上続けば心療内科へ',
      category: '精神',
    },
  ],
};

function deterministicAnalysis(symptoms: SymptomEntry[]): SymptomAnalysis {
  const grouped = symptoms.reduce<Record<string, SymptomEntry[]>>((acc, s) => {
    acc[s.region] = acc[s.region] ?? [];
    acc[s.region].push(s);
    return acc;
  }, {});
  const differentials: DifferentialSuggestion[] = Object.keys(grouped).flatMap(
    (region) => MOCK_DIFFERENTIALS[region] ?? MOCK_DIFFERENTIALS['全身']
  );
  const sorted = differentials.sort((a, b) => b.likelihood - a.likelihood).slice(0, 5);
  const topUrgency: Urgency =
    sorted.find((d) => d.urgency === 'er')?.urgency ??
    sorted.find((d) => d.urgency === 'urgent-care')?.urgency ??
    sorted.find((d) => d.urgency === 'gp-today')?.urgency ??
    sorted.find((d) => d.urgency === 'gp-soon')?.urgency ??
    'self-care';
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    symptoms,
    contextSummary: `${symptoms.length}件の症状を解析しました。鑑別 ${sorted.length} 候補を提示します。`,
    topUrgency,
    differentials: sorted,
    habits: [
      '今日は睡眠を 7.5h 以上確保（就寝22:30推奨）',
      'カフェインは14時以降を避ける',
      '20分の散歩で副交感神経を整える',
    ],
    redFlags: [
      '激しい胸痛・呼吸困難',
      '突然の片麻痺・ろれつが回らない',
      '38.5℃以上が3日以上続く',
      '吐血・血便',
    ],
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

export function useSymptomAI(settings: AppSettings) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (
      symptoms: SymptomEntry[],
      phr: DailyHealth[],
      history: MedicalProfile
    ): Promise<SymptomAnalysis> => {
      setIsLoading(true);
      setError(null);
      // /api/ai は env Gemini で fallback できるので apiKey ガードは不要。
      // deterministic は AI 失敗時の最終フォールバックとして try/catch で使う。
      const userBlock = `
# 自覚症状
${symptoms.map(symptomToText).join('\n')}

# PHR (Personal Health Record)
${summarizePhr(phr)}

# 既往歴・服用薬・アレルギー・家族歴
${summarizeHistory(history)}
`.trim();

      try {
        const res = await aiFetch({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 2400,
            system: ANALYSIS_SYSTEM,
            messages: [{ role: 'user', content: userBlock }],
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error?.message ?? `APIエラー ${res.status}`);
        }
        const data = await res.json();
        const text: string = data.content?.[0]?.text ?? '';
        const json = extractJson(text);
        const parsed = JSON.parse(json);
        const result: SymptomAnalysis = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          symptoms,
          contextSummary: parsed.contextSummary ?? '',
          topUrgency: parsed.topUrgency ?? 'monitor',
          differentials: (parsed.differentials ?? []).map((d: DifferentialSuggestion) => ({
            ...d,
            id: crypto.randomUUID(),
          })),
          habits: parsed.habits ?? [],
          redFlags: parsed.redFlags ?? [],
          disclaimer: parsed.disclaimer ?? DEFAULT_DISCLAIMER,
        };
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : '解析エラー';
        setError(msg);
        // Fallback so UI still shows something useful
        return deterministicAnalysis(symptoms);
      } finally {
        setIsLoading(false);
      }
    },
    [settings]
  );

  return { analyze, isLoading, error };
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/```json\s*([\s\S]*?)```/) || trimmed.match(/```\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Attempt to extract first JSON object
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return '{}';
}

// ── Health Coach (chat) ────────────────────────────────────────
const COACH_SYSTEM_BASE = `あなたは予防医療を専門とするヘルスコーチAIです。
ユーザーのPHRデータ（睡眠/HRV/活動/ストレス）と既往歴・服用薬・アレルギー・家族歴を踏まえて、
日常の習慣改善・睡眠最適化・運動・栄養・メンタルケアを具体的に提案します。
- 必ず日本語で
- 確定診断はしない
- 数値根拠を引きながら、今日明日からできる行動を3つ以内に絞って提案
- 必要なら医師受診を勧める
- 簡潔で温かい口調`;

export function useHealthCoach(settings: AppSettings) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chat = useCallback(
    async (
      message: string,
      history: ChatMessage[],
      phr: DailyHealth[],
      profile: MedicalProfile
    ): Promise<ChatMessage | null> => {
      setIsLoading(true);
      setError(null);
      // /api/ai は env Gemini で fallback できるので apiKey ガード (デモモード)
      // は廃止。AI 失敗時は下の catch でフォールバックメッセージを返す。

      const system = `${COACH_SYSTEM_BASE}

# ユーザーPHR
${summarizePhr(phr)}

# 既往歴
${summarizeHistory(profile)}
`;

      try {
        const res = await aiFetch({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: settings.preferredModel,
            max_tokens: 800,
            system,
            messages: [
              ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: message },
            ],
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error?.message ?? `APIエラー ${res.status}`);
        }
        const data = await res.json();
        const content = data.content?.[0]?.text ?? '';
        return {
          role: 'assistant',
          content,
          timestamp: new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : '通信エラー';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [settings]
  );

  return { chat, isLoading, error };
}
