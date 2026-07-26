// ============================================================
// CORE Pulse — 「けさのことば」を本物のAIで書く
//
// ★なぜ必要か（2026-07-26 の調査で判明した事実）
//   Pulse は LP で「AIがやさしく見守ります」と約束しているのに、
//   PulseApp.tsx には AI 呼び出しが 1 件も無く、けさのことばは
//   固定の文字列テンプレート（buildMorningWords）だった。
//   売り物にする前に、この約束を事実にする。
//
// ★設計（待たせない・落ちない）
//   ルールベースの文面は今までどおり即座に表示する。
//   その裏で AI に書かせ、返ってきたら差し替える。
//   失敗・未設定・オフラインなら、ルールベースのまま（後退しない）。
//   同じ日に何度も呼ばないよう、日付キーで localStorage にキャッシュする。
// ============================================================
import { callAiWithFallback } from '../lib/aiFallbackChain';

export interface MorningInput {
  name: string;
  /** きのうの睡眠時間（時間） */
  sleepHours?: number;
  /** 安静時心拍 */
  restingHr?: number;
  /** 歩数 */
  steps?: number;
  /** きょうの調子スコア 0-100 */
  score?: number | null;
  /** ふだんと違う点（detectAnomalies の説明文） */
  anomalies?: string[];
  /** 本人がタップした体調チップ（例: 頭が重い） */
  chips?: string[];
  /** ルールベースで作った文面。AIにはこれを下敷きとして渡す。 */
  fallback: string[];
}

const CACHE_PREFIX = 'pulse_morning_ai_';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 同じ日に生成済みなら、それを返す（無駄なAI呼び出しをしない）。 */
export function loadCachedMorning(): string[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + todayKey());
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch {
    return null;
  }
}

function saveCachedMorning(lines: string[]) {
  try {
    // 前日以前のキャッシュは掃除する（localStorage を無限に増やさない）
    const key = CACHE_PREFIX + todayKey();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX) && k !== key) localStorage.removeItem(k);
    }
    localStorage.setItem(key, JSON.stringify(lines));
  } catch {
    /* 保存できなくても表示は続ける */
  }
}

const SYSTEM = `あなたは、その人のからだを毎朝見守る担当です。医師ではありません。
渡された数値をもとに、今朝のひとことを日本語で書きます。

守ること:
- 3〜4文。1文は短く。やさしい、落ち着いた口調（敬体）。
- 最初に、きのうの睡眠か体調に「気づいている」ことを一言で伝える。
- 数値は渡されたものだけを使う。渡されていない数値を書かない。推測で数字を作らない。
- 診断・病名・治療の断定は絶対にしない（「〜かもしれません」も避ける）。
  気になる状態のときは「続くようなら、お医者さんに相談してくださいね」と添える程度にとどめる。
- 最後に、今日すぐできる小さな行動をひとつだけ提案する（水を飲む・15分早く寝る 等）。
- 大げさに褒めない。脅さない。絵文字は使わない。
- 前置き・見出し・箇条書きの記号は付けない。本文だけを返す。`;

/**
 * AIに「けさのことば」を書かせる。失敗したら null（呼び出し側はルールベースを出し続ける）。
 */
export async function aiMorningWords(input: MorningInput): Promise<string[] | null> {
  const facts: string[] = [];
  if (typeof input.sleepHours === 'number') facts.push(`きのうの睡眠: ${input.sleepHours.toFixed(1)}時間`);
  if (typeof input.restingHr === 'number') facts.push(`安静時心拍: ${Math.round(input.restingHr)}`);
  if (typeof input.steps === 'number') facts.push(`歩数: ${Math.round(input.steps)}歩`);
  if (typeof input.score === 'number') facts.push(`きょうの調子スコア: ${input.score}/100`);
  if (input.anomalies?.length) facts.push(`ふだんと違う点: ${input.anomalies.join(' / ')}`);
  if (input.chips?.length) facts.push(`本人が選んだ今の状態: ${input.chips.join('・')}`);
  // 数値が何も無いなら AI を呼ぶ意味がない（憶測で書かせない）
  if (facts.length === 0) return null;

  const user = [
    `相手の呼び名: ${input.name ? input.name + 'さん' : 'あなた'}`,
    '',
    '# 今日わかっている数値（これ以外の数値は書かないこと）',
    ...facts,
    '',
    '# 参考（システムが作った素っ気ない文面。内容の事実はこれに合わせる）',
    ...input.fallback,
    '',
    '上のルールに従って、今朝のひとことを書いてください。',
  ].join('\n');

  try {
    const resp = await callAiWithFallback(
      {
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: 'user', content: user }],
      },
      { timeoutMs: 40_000 },
    );
    const text = (resp.content?.[0]?.text || '').trim();
    if (!text) return null;
    const lines = text
      .split(/\n+/)
      .map((l) => l.replace(/^[-・*\s]+/, '').trim())
      .filter(Boolean);
    if (lines.length === 0) return null;
    saveCachedMorning(lines);
    return lines;
  } catch {
    // オフライン・AI障害でも画面は壊さない。ルールベースのまま。
    return null;
  }
}
