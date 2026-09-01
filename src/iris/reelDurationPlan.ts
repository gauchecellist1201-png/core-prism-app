// ============================================================
// IRIS ▸ 尺から逆算する構成テンプレ (LLM を呼ばない・その場で出る)
//
// なぜ要るか:
//   `reelAiScript.ts` の AI は **必ず 3 シーン・15〜20 秒**しか書かない
//   (buildSystemPrompt のルールで固定)。つまり 30 秒 / 60 秒で撮りたい時、
//   台本カードから先に進む道が無く、手で足すしかなかった。
//   ここは「15 / 30 / 60 のどれで撮るか」を選ぶだけで、
//   台本の中身を **1 文字も書き換えずに** カット割りと秒数へ組み直す。
//
// 守っていること:
//   ① AI を呼ばない = 押した瞬間に出る・失敗しない・お金がかからない
//   ② 中身をでっち上げない。台本に無いカットは caption を **空のまま**返し、
//      `fromScript: false` で「これから埋める場所」だと画面に出させる。
//      ここに AI っぽい文を自動で入れると「書いたつもり」の嘘になる。
//   ③ 秒数の合計は **必ず** 選んだ尺と一致する (端数は前のカットに寄せる
//      = 前半をテンポ良くする。最初の 3 秒が最重要という原則に合わせる)
//   ④ 音源そのものは配らない (権利の話になる)。構成と秒数までで止める。
// ============================================================

import type { ReelScriptResult } from './reelAiScript';

export const REEL_DURATIONS = [15, 30, 60] as const;
export type ReelDuration = (typeof REEL_DURATIONS)[number];

export type CutRole = 'hook' | 'body' | 'proof' | 'cta';

export interface PlannedCut {
  /** 1 から始まるカット番号 */
  no: number;
  role: CutRole;
  /** 画面に出す役割名 (やさしい言葉) */
  roleLabel: string;
  /** このカットの秒数 (整数・合計は必ず尺と一致) */
  seconds: number;
  /** 字幕。台本から来たものだけ入る。足したカットは空文字 = 埋める場所 */
  caption: string;
  /** 撮り方 (カメラを触ったことがない人がそのまま撮れる 1 行) */
  shot: string;
  /** true = 台本にあった行 / false = 尺を埋めるために型が足したカット */
  fromScript: boolean;
}

export interface ReelDurationPlan {
  duration: ReelDuration;
  cuts: PlannedCut[];
  /** 秒数の合計 (検算用。duration と必ず一致する) */
  total: number;
  /** 台本に無く、型が足したカットの数 (画面で正直に出す) */
  addedCount: number;
}

/** つかみ・締めは尺に関係なく 3 秒で固定 (最初の 3 秒 / 最後のひと押し) */
const EDGE_SECONDS = 3;

/** 尺ごとのカット数。中身は つかみ 1 + 本編 n + 締め 1 */
const CUT_COUNT: Record<ReelDuration, number> = { 15: 4, 30: 6, 60: 9 };

/** 本編の役割の並び (足りない分はこの順で繰り返す) */
const MIDDLE_CYCLE: CutRole[] = ['body', 'body', 'proof'];

const ROLE_LABEL: Record<CutRole, string> = {
  hook: 'つかみ',
  body: '本編',
  proof: '裏づけ',
  cta: '締め',
};

/** 台本に無いカットに入れる撮り方。中身の代筆はせず「撮り方」だけ渡す */
const FALLBACK_SHOT: Record<CutRole, string> = {
  hook: '自分の顔を正面・窓際の自然光で。言い切る顔から始める',
  body: '本編の続きを 1 つ。手元か画面を寄りで。前のカットと違う画角にする',
  proof: '言ったことの裏づけを 1 つ。数字・実物・使う前と後、のどれかを映す',
  cta: '正面に戻る。保存かフォローを 1 つだけ、口で言う',
};

function normalizeDuration(d: number): ReelDuration {
  return (REEL_DURATIONS as readonly number[]).includes(d) ? (d as ReelDuration) : 15;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * 本編の秒数を配る。合計は必ず `total`。
 * 端数は前のカットへ 1 秒ずつ寄せる (前半のテンポを速くする)
 */
function spread(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** 尺ごとの役割の並びを作る (つかみ → 本編 … → 締め) */
export function rolePlan(duration: ReelDuration): CutRole[] {
  const count = CUT_COUNT[duration];
  const middle = count - 2;
  const roles: CutRole[] = ['hook'];
  for (let i = 0; i < middle; i++) roles.push(MIDDLE_CYCLE[i % MIDDLE_CYCLE.length]);
  roles.push('cta');
  return roles;
}

/**
 * 台本 + 選んだ尺 → カット割り。
 * 台本の文字は書き換えない。足りない分は空の caption で返す。
 */
export function buildDurationPlan(reel: ReelScriptResult | null, durationInput: number): ReelDurationPlan {
  const duration = normalizeDuration(durationInput);
  const roles = rolePlan(duration);
  const middleCount = roles.length - 2;
  const middleSeconds = spread(duration - EDGE_SECONDS * 2, middleCount);

  const scenes = Array.isArray(reel?.scenes) ? reel!.scenes : [];
  // 台本の行を順番に使う。つかみ = シーン 1、本編 = シーン 2 以降
  const queue = scenes
    .map((sc) => ({ caption: text(sc?.caption), shot: text(sc?.shot) }))
    .filter((sc) => sc.caption !== '' || sc.shot !== '');
  const ctaText = text(reel?.cta);
  const titleText = text(reel?.title);

  let qi = 0;
  const cuts: PlannedCut[] = roles.map((role, i) => {
    const seconds = role === 'hook' || role === 'cta' ? EDGE_SECONDS : middleSeconds[i - 1];
    let caption = '';
    let shot = '';
    let fromScript = false;

    if (role === 'cta') {
      // 締めは台本の cta。無ければ空のまま (代筆しない)
      caption = ctaText;
      fromScript = ctaText !== '';
    } else if (qi < queue.length) {
      caption = queue[qi].caption;
      shot = queue[qi].shot;
      fromScript = true;
      qi++;
    } else if (role === 'hook' && titleText !== '') {
      // シーンが 1 つも無い台本でも、つかみだけはタイトル (= フック) が使える
      caption = titleText;
      fromScript = true;
    }

    if (shot === '') shot = FALLBACK_SHOT[role];
    return { no: i + 1, role, roleLabel: ROLE_LABEL[role], seconds, caption, shot, fromScript };
  });

  return {
    duration,
    cuts,
    total: cuts.reduce((s, c) => s + c.seconds, 0),
    addedCount: cuts.filter((c) => !c.fromScript).length,
  };
}

/** 撮影者にそのまま渡せるプレーンテキスト (手入力ゼロ) */
export function buildDurationPlanText(plan: ReelDurationPlan, reel: ReelScriptResult | null, theme: string): string {
  const lines: string[] = [];
  lines.push(`【リール構成 ${plan.duration}秒】${text(reel?.title)}`.trim());
  if (theme.trim() !== '') lines.push(`テーマ: ${theme.trim()}`);
  lines.push(`カット ${plan.cuts.length} 枚 / 合計 ${plan.total}秒`);
  lines.push('');
  plan.cuts.forEach((c) => {
    lines.push(`■ カット${c.no}（${c.seconds}秒・${c.roleLabel}）`);
    lines.push(`撮り方: ${c.shot}`);
    lines.push(c.caption !== '' ? `字幕: ${c.caption}` : '字幕: （ここに 8〜18 字で 1 行）');
    lines.push('');
  });
  if (plan.addedCount > 0) {
    lines.push(`※ 台本にあったのは ${plan.cuts.length - plan.addedCount} 枚。残り ${plan.addedCount} 枚は ${plan.duration}秒 に伸ばすための枠なので、字幕は自分で入れてください。`);
  }
  return lines.join('\n').trim();
}
