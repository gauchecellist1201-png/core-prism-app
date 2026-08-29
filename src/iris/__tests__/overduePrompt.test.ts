import { describe, it, expect } from 'vitest';
import { shouldAskOutcome, overdueAskCount, OVERDUE_ASK_AFTER_MS, OVERDUE_ASK_TEXT } from '../overduePrompt';

const NOW = new Date('2026-08-29T12:00:00+09:00').getTime();
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('過ぎた予約の二択を出す条件', () => {
  it('1日以上過ぎた ready にだけ出す', () => {
    expect(shouldAskOutcome({ status: 'ready', scheduledAt: at(OVERDUE_ASK_AFTER_MS) }, NOW)).toBe(true);
    expect(shouldAskOutcome({ status: 'ready', scheduledAt: at(OVERDUE_ASK_AFTER_MS * 3) }, NOW)).toBe(true);
  });

  it('過ぎたばかりの予約は急かさない (23時間59分では出さない)', () => {
    expect(shouldAskOutcome({ status: 'ready', scheduledAt: at(OVERDUE_ASK_AFTER_MS - 60_000) }, NOW)).toBe(false);
  });

  it('まだ時刻が来ていない予約には出さない', () => {
    expect(shouldAskOutcome({ status: 'scheduled', scheduledAt: at(-3_600_000) }, NOW)).toBe(false);
  });

  it('決着済み (投稿済 / スキップ / 下書き) には二度と出さない', () => {
    const old = at(OVERDUE_ASK_AFTER_MS * 5);
    expect(shouldAskOutcome({ status: 'posted', scheduledAt: old }, NOW)).toBe(false);
    expect(shouldAskOutcome({ status: 'skipped', scheduledAt: old }, NOW)).toBe(false);
    expect(shouldAskOutcome({ status: 'draft', scheduledAt: old }, NOW)).toBe(false);
  });

  it('時刻が壊れている予約には出さない (分からないなら訊かない)', () => {
    expect(shouldAskOutcome({ status: 'ready', scheduledAt: 'いつか' }, NOW)).toBe(false);
    expect(shouldAskOutcome({ status: 'ready', scheduledAt: '' }, NOW)).toBe(false);
    expect(shouldAskOutcome(null, NOW)).toBe(false);
    expect(shouldAskOutcome(undefined, NOW)).toBe(false);
  });

  it('件数は対象だけを数える (空配列・null で 0)', () => {
    const posts = [
      { status: 'ready' as const, scheduledAt: at(OVERDUE_ASK_AFTER_MS * 2) },
      { status: 'ready' as const, scheduledAt: at(60_000) },
      { status: 'posted' as const, scheduledAt: at(OVERDUE_ASK_AFTER_MS * 2) },
      { status: 'ready' as const, scheduledAt: at(OVERDUE_ASK_AFTER_MS + 1) },
    ];
    expect(overdueAskCount(posts, NOW)).toBe(2);
    expect(overdueAskCount([], NOW)).toBe(0);
    expect(overdueAskCount(null, NOW)).toBe(0);
  });

  it('文言は責めない (「出さなかった」「忘れ」「未」を使わない) し、二択のまま', () => {
    const blame = ['出さなかった', '忘れ', '放置', 'まだですか'];
    const all = Object.values(OVERDUE_ASK_TEXT).join(' ');
    blame.forEach(w => expect(all).not.toContain(w));
    expect(OVERDUE_ASK_TEXT.skip).toBe('今回は出さない');
    // 押した後に何が起きるかを、実際の挙動どおりに言う
    // (リストからは消えるが、削除はされずカレンダーには「スキップ」として残る)
    expect(OVERDUE_ASK_TEXT.skipHint).toContain('削除はせず');
    expect(OVERDUE_ASK_TEXT.skipHint).toContain('カレンダー');
  });
});
