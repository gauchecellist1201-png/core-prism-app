import { describe, it, expect } from 'vitest';
import { parseSavedEstimate, EMPTY_DRAFT, type DraftOptions } from '../estimateDraft';

const OPTS: DraftOptions = {
  purposes: ['lp', 'corporate', 'ec', 'webapp', 'saas'],
  scales: ['small', 'medium', 'large'],
  features: ['booking', 'payment', 'auth', 'ai', 'multilingual'],
  timelines: ['asap', 'normal', 'flexible'],
  budgets: ['u10', 'u30', 'u100', 'u500', 'over500', 'unknown'],
};

const draft = (over: Record<string, unknown>) => JSON.stringify({ ...EMPTY_DRAFT, ...over });

describe('概算ウィザードの途中保存を読み戻す', () => {
  it('3問目まで答えた保存は、そのまま続きから開ける', () => {
    const got = parseSavedEstimate(draft({ step: 3, purpose: 'corporate', scale: 'medium', cms: true }), OPTS);
    expect(got).not.toBeNull();
    expect(got!.step).toBe(3);
    expect(got!.purpose).toBe('corporate');
    expect(got!.cms).toBe(true);
  });

  it('6問答えきった保存は結果の画面から開ける', () => {
    const got = parseSavedEstimate(draft({
      step: 6, purpose: 'saas', scale: 'large', cms: false,
      features: ['auth', 'payment'], timeline: 'normal', budget: 'u500',
    }), OPTS);
    expect(got!.step).toBe(6);
    expect(got!.features).toEqual(['payment', 'auth']); // 並びは選択肢の順に正規化される
  });

  // ---- 復帰させない ----
  it('保存が無い / 空文字 のときは null', () => {
    expect(parseSavedEstimate(null, OPTS)).toBeNull();
    expect(parseSavedEstimate('', OPTS)).toBeNull();
  });

  it('1問目のまま (step 0) は「続きから」と名乗る意味が無いので復帰させない', () => {
    expect(parseSavedEstimate(draft({ step: 0 }), OPTS)).toBeNull();
  });

  it('JSON として壊れている / 配列 / 数値 は捨てる', () => {
    expect(parseSavedEstimate('{壊れ', OPTS)).toBeNull();
    expect(parseSavedEstimate('[1,2,3]', OPTS)).toBeNull();
    expect(parseSavedEstimate('42', OPTS)).toBeNull();
    expect(parseSavedEstimate('null', OPTS)).toBeNull();
  });

  it('step が範囲外・小数・文字列なら捨てる', () => {
    expect(parseSavedEstimate(draft({ step: 7, purpose: 'lp' }), OPTS)).toBeNull();
    expect(parseSavedEstimate(draft({ step: -1, purpose: 'lp' }), OPTS)).toBeNull();
    expect(parseSavedEstimate(draft({ step: 2.5, purpose: 'lp' }), OPTS)).toBeNull();
    expect(parseSavedEstimate(draft({ step: '3', purpose: 'lp' }), OPTS)).toBeNull();
  });

  it('途中の答えが抜けている保存は捨てる (画面が途中で詰まるため)', () => {
    // 3問目まで来たことになっているのに、規模とCMSの答えが無い
    expect(parseSavedEstimate(draft({ step: 3, purpose: 'lp' }), OPTS)).toBeNull();
    // 結果の画面なのに予算が無い
    expect(parseSavedEstimate(draft({
      step: 6, purpose: 'lp', scale: 'small', cms: false, timeline: 'asap',
    }), OPTS)).toBeNull();
  });

  it('選択肢に無い値は捨てる (手元の保存は書き換えられる前提)', () => {
    expect(parseSavedEstimate(draft({ step: 1, purpose: 'FREE_PLAN' }), OPTS)).toBeNull();
    expect(parseSavedEstimate(draft({ step: 2, purpose: 'lp', scale: 'huge' }), OPTS)).toBeNull();
  });

  it('cms は真偽値だけを認める ("true" という文字列は未回答扱い)', () => {
    expect(parseSavedEstimate(draft({ step: 3, purpose: 'lp', scale: 'small', cms: 'true' }), OPTS)).toBeNull();
  });

  it('機能に知らない値が混ざっていても、その値だけを落として復帰できる', () => {
    const got = parseSavedEstimate(draft({
      step: 5, purpose: 'ec', scale: 'medium', cms: true,
      features: ['payment', '__proto__', 'nope'], timeline: 'flexible',
    }), OPTS);
    expect(got!.features).toEqual(['payment']);
  });

  it('機能が配列でない場合も、そこだけ空にして復帰できる (4問目は未選択でも進めるため)', () => {
    const got = parseSavedEstimate(draft({
      step: 5, purpose: 'lp', scale: 'small', cms: false, features: 'payment', timeline: 'asap',
    }), OPTS);
    expect(got!.features).toEqual([]);
  });
});
