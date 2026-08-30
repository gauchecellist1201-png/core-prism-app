import { describe, it, expect } from 'vitest';
import { labelOfProps, STUDIO_EVENTS } from '../track';
import { STUDIO_EVENTS as SERVER_EVENTS, sanitizeLabel } from '../../../api/track/studio';

describe('計測ラベルの組み立て', () => {
  it('props の値だけを _ でつないだ 1 本のラベルにする', () => {
    expect(labelOfProps({ where: 'home-hero' })).toBe('home-hero');
    expect(labelOfProps({ plan: 'f1', to: 'line' })).toBe('f1_line');
    expect(labelOfProps({ step: 3 })).toBe('3');
  });

  it('props が無い / 空なら空文字 (内訳を立てない)', () => {
    expect(labelOfProps()).toBe('');
    expect(labelOfProps({})).toBe('');
  });

  it('null・undefined・オブジェクトは飛ばす', () => {
    expect(labelOfProps({ a: null, b: undefined, c: { x: 1 }, d: 'ok' })).toBe('ok');
  });

  it('Redis のフィールド名に使えない文字は _ に落とす', () => {
    expect(labelOfProps({ where: 'home hero' })).toBe('home_hero');
    // 全部が使えない文字だった時は、_ だけのキーを作らずに内訳を立てない
    expect(labelOfProps({ q: '概算・見積' })).toBe('');
  });

  it('長すぎるラベルは 40 文字で切る (キーが際限なく伸びない)', () => {
    expect(labelOfProps({ a: 'x'.repeat(200) }).length).toBe(40);
  });
});

describe('サーバー側の allowlist と取りこぼしなく揃っている', () => {
  it('画面が送るイベント名は、すべてサーバーが受け付ける', () => {
    const server = new Set<string>(SERVER_EVENTS);
    const missing = [...STUDIO_EVENTS].filter(e => !server.has(e));
    expect(missing).toEqual([]);
  });

  it('サーバーが受け付けるイベント名は、すべて画面側にもある (片側だけ足す事故を止める)', () => {
    const extra = SERVER_EVENTS.filter(e => !STUDIO_EVENTS.has(e));
    expect(extra).toEqual([]);
  });
});

describe('サーバー側のラベル正規化', () => {
  it('画面側で作ったラベルは、サーバーを通しても変わらない', () => {
    for (const raw of ['home-hero', 'f1_line', '3', 'plan.pro', 'a:b']) {
      expect(sanitizeLabel(raw)).toBe(raw);
    }
  });

  it('前後に残った _ は落とす (空の props から _ だけのキーを作らない)', () => {
    expect(sanitizeLabel('__x__')).toBe('x');
    expect(sanitizeLabel('   ')).toBe('');
    expect(sanitizeLabel(undefined)).toBe('');
  });
});
