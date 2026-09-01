// ============================================================
// 尺から逆算する構成テンプレ (reelDurationPlan) の通しテスト
//
// ここで固定したいのは 3 つだけ:
//   ① 秒数の合計が、選んだ尺と **必ず** 一致する (足りない・余るを画面に出さない)
//   ② 台本の文字を書き換えない・でっち上げない (足したカットは空のまま)
//   ③ 台本がおかしい (シーン 0 件 / 文字化けた型) 時も落ちない
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  buildDurationPlan,
  buildDurationPlanText,
  rolePlan,
  REEL_DURATIONS,
  type ReelDuration,
} from '../reelDurationPlan';
import type { ReelScriptResult } from '../reelAiScript';

const script: ReelScriptResult = {
  title: '知らないと損する洗い方',
  scenes: [
    { index: 1, caption: 'その洗い方、逆効果', duration: 5, shot: '正面・窓際で言い切る', narration: 'じつは逆効果です' },
    { index: 2, caption: '正しい手順は3つ', duration: 5, shot: '手元を真上から' },
    { index: 3, caption: '1週間で変わる', duration: 6, shot: '使う前と後を並べて' },
  ],
  cta: '保存して見返してね',
  hashtags: ['#洗濯', '#暮らし'],
};

describe('buildDurationPlan ▸ 秒数の合計は必ず選んだ尺と一致する', () => {
  for (const d of REEL_DURATIONS) {
    it(`${d}秒: 合計が ${d} 秒ぴったり・全カットが 1 秒以上の整数`, () => {
      const plan = buildDurationPlan(script, d);
      expect(plan.duration).toBe(d);
      expect(plan.total).toBe(d);
      expect(plan.cuts.reduce((s, c) => s + c.seconds, 0)).toBe(d);
      for (const c of plan.cuts) {
        expect(Number.isInteger(c.seconds)).toBe(true);
        expect(c.seconds).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it('つかみと締めは尺に関係なく 3 秒 (最初の 3 秒 / 最後のひと押しを潰さない)', () => {
    for (const d of REEL_DURATIONS) {
      const cuts = buildDurationPlan(script, d).cuts;
      expect(cuts[0].role).toBe('hook');
      expect(cuts[0].seconds).toBe(3);
      expect(cuts[cuts.length - 1].role).toBe('cta');
      expect(cuts[cuts.length - 1].seconds).toBe(3);
    }
  });

  it('端数は前のカットに寄る (前半のテンポが速い)', () => {
    // 15秒: 3 + [5,4] + 3
    const mid = buildDurationPlan(script, 15).cuts.slice(1, -1).map((c) => c.seconds);
    expect(mid).toEqual([5, 4]);
    // 60秒: 中 7 カットで 54 秒 → 8 が 5 枚 + 7 が 2 枚、8 が先
    const mid60 = buildDurationPlan(script, 60).cuts.slice(1, -1).map((c) => c.seconds);
    expect(mid60).toEqual([8, 8, 8, 8, 8, 7, 7]);
    expect(mid60.reduce((s, n) => s + n, 0)).toBe(54);
  });

  it('尺が長いほどカットは増える (15 < 30 < 60)', () => {
    const n = (d: ReelDuration) => buildDurationPlan(script, d).cuts.length;
    expect(n(15)).toBeLessThan(n(30));
    expect(n(30)).toBeLessThan(n(60));
  });
});

describe('buildDurationPlan ▸ 台本の文字は書き換えない・足したカットは空のまま', () => {
  it('15秒 (4カット) は 3 シーン + 締め でぴったり埋まる = 足したカット 0', () => {
    const plan = buildDurationPlan(script, 15);
    expect(plan.addedCount).toBe(0);
    expect(plan.cuts.map((c) => c.caption)).toEqual([
      'その洗い方、逆効果',
      '正しい手順は3つ',
      '1週間で変わる',
      '保存して見返してね',
    ]);
    // 撮り方も台本のものがそのまま残る
    expect(plan.cuts[1].shot).toBe('手元を真上から');
  });

  it('30秒に伸ばした分は caption を空のまま返す (AI っぽい文を代筆しない)', () => {
    const plan = buildDurationPlan(script, 30);
    expect(plan.cuts.length).toBe(6);
    expect(plan.addedCount).toBe(2);
    const added = plan.cuts.filter((c) => !c.fromScript);
    expect(added.length).toBe(2);
    for (const c of added) {
      expect(c.caption).toBe('');
      // 中身は代筆しないが、撮り方だけは渡す (白紙で放り出さない)
      expect(c.shot.length).toBeGreaterThan(0);
    }
    // 台本から来た 4 枚は 15秒 の時と同じ文字
    expect(plan.cuts.filter((c) => c.fromScript).map((c) => c.caption)).toEqual([
      'その洗い方、逆効果',
      '正しい手順は3つ',
      '1週間で変わる',
      '保存して見返してね',
    ]);
  });

  it('締めは必ず最後の 1 枚だけ (途中に締めが挟まらない)', () => {
    for (const d of REEL_DURATIONS) {
      const cuts = buildDurationPlan(script, d).cuts;
      expect(cuts.filter((c) => c.role === 'cta').length).toBe(1);
    }
  });

  it('元の台本オブジェクトを書き換えない', () => {
    const before = JSON.stringify(script);
    buildDurationPlan(script, 60);
    expect(JSON.stringify(script)).toBe(before);
  });
});

describe('buildDurationPlan ▸ 台本がおかしくても落ちない', () => {
  it('シーン 0 件なら、つかみにはタイトル (=フック) を使う', () => {
    const plan = buildDurationPlan({ title: '3秒で分かる', scenes: [], cta: '' }, 15);
    expect(plan.total).toBe(15);
    expect(plan.cuts[0].caption).toBe('3秒で分かる');
    expect(plan.cuts[0].fromScript).toBe(true);
    // 締めが空の台本では締めも「埋める場所」として数える
    expect(plan.cuts[plan.cuts.length - 1].caption).toBe('');
    expect(plan.addedCount).toBe(3);
  });

  it('台本が null / scenes が配列でない / 空文字だけ でも落ちない', () => {
    expect(buildDurationPlan(null, 30).total).toBe(30);
    // 型を無視した値が来ても落とさない (AI の返りを直に流す経路があるため)
    const broken = { title: '', scenes: 'ぜんぶ文字' as unknown, cta: '   ' } as unknown as ReelScriptResult;
    const plan = buildDurationPlan(broken, 60);
    expect(plan.total).toBe(60);
    expect(plan.addedCount).toBe(plan.cuts.length);
    for (const c of plan.cuts) expect(c.caption).toBe('');
  });

  it('知らない尺が来たら 15秒 に落として、合計も 15 にする', () => {
    const plan = buildDurationPlan(script, 45 as ReelDuration);
    expect(plan.duration).toBe(15);
    expect(plan.total).toBe(15);
  });
});

describe('rolePlan / buildDurationPlanText', () => {
  it('役割の並びは つかみ で始まり 締め で終わる', () => {
    for (const d of REEL_DURATIONS) {
      const roles = rolePlan(d);
      expect(roles[0]).toBe('hook');
      expect(roles[roles.length - 1]).toBe('cta');
      expect(roles.filter((r) => r === 'hook').length).toBe(1);
    }
  });

  it('コピー用テキストに 全カットの秒数と合計が入る', () => {
    const plan = buildDurationPlan(script, 30);
    const t = buildDurationPlanText(plan, script, '洗濯のコツ');
    expect(t).toContain('【リール構成 30秒】知らないと損する洗い方');
    expect(t).toContain('テーマ: 洗濯のコツ');
    expect(t).toContain(`カット ${plan.cuts.length} 枚 / 合計 30秒`);
    for (const c of plan.cuts) expect(t).toContain(`■ カット${c.no}（${c.seconds}秒・${c.roleLabel}）`);
    // 空のカットは「埋める場所」だと分かる形で出す (空欄を黙って消さない)
    expect(t).toContain('字幕: （ここに 8〜18 字で 1 行）');
    // 足した枚数を正直に書く
    expect(t).toContain(`残り ${plan.addedCount} 枚`);
  });

  it('足したカットが 0 枚の時は「残り◯枚」の注意書きを出さない', () => {
    const plan = buildDurationPlan(script, 15);
    const t = buildDurationPlanText(plan, script, '');
    expect(plan.addedCount).toBe(0);
    expect(t).not.toContain('残り');
    expect(t).not.toContain('テーマ:');
  });
});
