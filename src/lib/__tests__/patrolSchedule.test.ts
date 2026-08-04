import { describe, it, expect } from 'vitest';
import {
  localDay, windowKind, duePatrol, bumpTries, markPatrolDone,
  MAX_PATROL_TRIES, type PatrolRecord,
} from '../patrolSchedule';

// ローカル時刻で Date を作る (UTC ではなく端末時刻で判定することを固定する)
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe('localDay — 日付は端末のローカル日', () => {
  it('UTC の日付境界をまたぐ時刻でも、その日は 1 つの日付になる', () => {
    // 日本時間なら 9:00 は UTC 0:00 (= 日付の変わり目)。6:30 と 9:30 は同じ「今日」でなければならない。
    expect(localDay(at(2026, 8, 5, 6, 30))).toBe('2026-08-05');
    expect(localDay(at(2026, 8, 5, 9, 30))).toBe('2026-08-05');
  });
  it('月・日は 2 桁でゼロ埋めされる', () => {
    expect(localDay(at(2026, 1, 3, 12))).toBe('2026-01-03');
  });
});

describe('windowKind — 朝/夜の時間帯', () => {
  it('6:00〜9:59 は朝', () => {
    expect(windowKind(at(2026, 8, 5, 6, 0))).toBe('morning');
    expect(windowKind(at(2026, 8, 5, 9, 59))).toBe('morning');
  });
  it('20:00〜23:59 は夜', () => {
    expect(windowKind(at(2026, 8, 5, 20, 0))).toBe('evening');
    expect(windowKind(at(2026, 8, 5, 23, 59))).toBe('evening');
  });
  it('昼と深夜はどちらでもない', () => {
    expect(windowKind(at(2026, 8, 5, 13, 0))).toBeNull();
    expect(windowKind(at(2026, 8, 5, 3, 0))).toBeNull();
  });
});

describe('duePatrol — 出すべき時だけ出す', () => {
  it('その日まだ出していなければ出す', () => {
    expect(duePatrol({}, at(2026, 8, 5, 7))).toBe('morning');
  });

  it('★回帰: 作れなかった日は印が付かないので、次の見回りでやり直す', () => {
    // 以前は「作る前」に印を付けていたので、生成が弾かれた日は朝のブリーフが二度と出なかった。
    let rec: PatrolRecord = {};
    rec = bumpTries(rec, 'morning', at(2026, 8, 5, 7));   // 1 回目 — 生成は失敗した想定 (markPatrolDone を呼ばない)
    expect(duePatrol(rec, at(2026, 8, 5, 7, 1))).toBe('morning');
  });

  it('★回帰: 同じ朝に 2 回出さない (UTC 日付だと 9 時台に再発火していた)', () => {
    const rec = markPatrolDone({}, 'morning', at(2026, 8, 5, 6, 30));
    expect(duePatrol(rec, at(2026, 8, 5, 9, 30))).toBeNull();
  });

  it('翌朝はまた出す', () => {
    const rec = markPatrolDone({}, 'morning', at(2026, 8, 5, 6, 30));
    expect(duePatrol(rec, at(2026, 8, 6, 6, 30))).toBe('morning');
  });

  it('試行の上限に達したら、その日はもう叩かない', () => {
    let rec: PatrolRecord = {};
    for (let i = 0; i < MAX_PATROL_TRIES; i++) rec = bumpTries(rec, 'morning', at(2026, 8, 5, 7));
    expect(duePatrol(rec, at(2026, 8, 5, 7))).toBeNull();
    // 日が変われば試行回数はリセットされる
    expect(duePatrol(rec, at(2026, 8, 6, 7))).toBe('morning');
  });

  it('朝と夜は互いに影響しない', () => {
    const rec = markPatrolDone({}, 'morning', at(2026, 8, 5, 7));
    expect(duePatrol(rec, at(2026, 8, 5, 21))).toBe('evening');
  });

  it('時間帯の外では出さない', () => {
    expect(duePatrol({}, at(2026, 8, 5, 13))).toBeNull();
  });
});
