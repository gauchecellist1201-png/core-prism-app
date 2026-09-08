import { describe, it, expect } from 'vitest';
import { buildProfileGrid } from '../profileGridOrder';
import type { GridTile } from '../coverGrid';

// ============================================================
// profileGridOrder — 「公開前に仕上がりが見える」が本当に見えていることの固定
//
// なぜこのテストが要るか:
//   予約グリッドは、並び順を1つ間違えるだけで**静かに逆の絵**を見せる。
//   画面には絵が出ているので、見ても壊れていることに気づけない
//   （実際 2026-09-08 まで、古い予約が左上に出ていた）。
//   下書きを混ぜる／画像の無い予約をダミーで埋める、も同じで
//   「出ているのに嘘」になる形なので、振る舞いで釘を打っておく。
// ============================================================

function q(id: string, status: string, at: string, thumb?: string, caption = 'テスト') {
  return { id, status, scheduledAt: at, createdAt: at, caption, thumbDataUrl: thumb };
}
function tile(id: string, src: string, at: number, label = ''): GridTile {
  return { id, src, at, label, from: 'instagram' };
}

describe('buildProfileGrid — 予約の並び順', () => {
  it('★いちばん先の予約が左上に来る（プロフィールは新しいものが上）', () => {
    // 渡す順は upcoming() と同じ「古い順」。ここで逆にできていないと画面が嘘になる。
    const r = buildProfileGrid([
      q('a', 'scheduled', '2026-09-10T09:00:00Z', 'img-a'),
      q('b', 'scheduled', '2026-09-12T09:00:00Z', 'img-b'),
      q('c', 'scheduled', '2026-09-11T09:00:00Z', 'img-c'),
    ], []);
    expect(r.cells.map(c => c.postId)).toEqual(['b', 'c', 'a']);
  });

  it('ready も予約と同じ土俵で時刻順に混ざる（状態でひとかたまりにしない）', () => {
    const r = buildProfileGrid([
      q('ready-old', 'ready', '2026-09-01T09:00:00Z', 'img-1'),
      q('sched-new', 'scheduled', '2026-09-20T09:00:00Z', 'img-2'),
    ], []);
    expect(r.cells.map(c => c.postId)).toEqual(['sched-new', 'ready-old']);
  });

  it('予約時刻が読めないものは並びに出さない（いつ並ぶか言えない）', () => {
    const r = buildProfileGrid([
      q('bad', 'scheduled', 'こわれた日付', 'img-x'),
      q('ok', 'scheduled', '2026-09-10T09:00:00Z', 'img-y'),
    ], []);
    expect(r.cells.map(c => c.postId)).toEqual(['ok']);
  });
});

describe('buildProfileGrid — 嘘のマスを作らない', () => {
  it('画像がまだ無い予約はマスを作らず、件数だけ返す', () => {
    const r = buildProfileGrid([
      q('no-img', 'scheduled', '2026-09-10T09:00:00Z'),
      q('has', 'scheduled', '2026-09-11T09:00:00Z', 'img-a'),
    ], []);
    expect(r.cells).toHaveLength(1);
    expect(r.plannedWithoutImage).toBe(1);
  });

  it('下書きは並びに入れず、件数だけ返す（出す約束をしていない）', () => {
    const r = buildProfileGrid([
      q('d', 'draft', '2026-09-10T09:00:00Z', 'img-d'),
      q('s', 'scheduled', '2026-09-11T09:00:00Z', 'img-s'),
    ], []);
    expect(r.cells.map(c => c.postId)).toEqual(['s']);
    expect(r.draftsHidden).toBe(1);
  });

  it('スキップ・投稿済みは予約側からは並びに入らない（数にも足さない）', () => {
    const r = buildProfileGrid([
      q('sk', 'skipped', '2026-09-10T09:00:00Z', 'img-1'),
      q('po', 'posted', '2026-09-09T09:00:00Z', 'img-2'),
    ], []);
    expect(r.cells).toHaveLength(0);
    expect(r.draftsHidden).toBe(0);
    expect(r.plannedWithoutImage).toBe(0);
  });

  it('動画の予約はサムネが無ければ出さない（mediaDataUrl を絵として使わない）', () => {
    const r = buildProfileGrid([
      { id: 'v', status: 'scheduled', scheduledAt: '2026-09-10T09:00:00Z', mediaKind: 'video', mediaDataUrl: 'data:video/mp4;base64,xxx' },
      { id: 'i', status: 'scheduled', scheduledAt: '2026-09-09T09:00:00Z', mediaKind: 'image', mediaDataUrl: 'data:image/png;base64,yyy' },
    ], []);
    expect(r.cells.map(c => c.postId)).toEqual(['i']);
    expect(r.plannedWithoutImage).toBe(1);
  });

  it('何も無い時・壊れた入力でも落ちず、空の並びを返す', () => {
    expect(buildProfileGrid(null, null).cells).toEqual([]);
    expect(buildProfileGrid(undefined, undefined).plannedShown).toBe(0);
    expect(buildProfileGrid([null as never, 'x' as never], []).cells).toEqual([]);
  });
});

describe('buildProfileGrid — 投稿済みは予約のうしろ', () => {
  it('★予約が先、投稿済みがあと（未来が上に乗る絵になる）', () => {
    const r = buildProfileGrid(
      [q('s1', 'scheduled', '2026-09-10T09:00:00Z', 'img-s1')],
      [tile('p1', 'img-p1', 200), tile('p2', 'img-p2', 100)],
    );
    expect(r.cells.map(c => c.kind)).toEqual(['planned', 'posted', 'posted']);
    expect(r.plannedShown).toBe(1);
    expect(r.postedShown).toBe(2);
  });

  it('投稿済みどうしは新しい順（渡された順に引きずられない）', () => {
    const r = buildProfileGrid([], [tile('old', 'a', 100), tile('new', 'b', 300), tile('mid', 'c', 200)]);
    expect(r.cells.map(c => c.key)).toEqual(['posted:new', 'posted:mid', 'posted:old']);
  });

  it('同じ画像が予約と投稿済みの両方にあれば予約側だけ残す', () => {
    const r = buildProfileGrid(
      [q('s', 'scheduled', '2026-09-10T09:00:00Z', 'same')],
      [tile('h', 'same', 100), tile('h2', 'other', 90)],
    );
    expect(r.cells.map(c => c.src)).toEqual(['same', 'other']);
  });

  it('予約どうしの同じ画像も1枚だけ（新しい方を残す）', () => {
    const r = buildProfileGrid([
      q('old', 'scheduled', '2026-09-10T09:00:00Z', 'dup'),
      q('new', 'scheduled', '2026-09-12T09:00:00Z', 'dup'),
    ], []);
    expect(r.cells.map(c => c.postId)).toEqual(['new']);
  });

  it('画像の無い投稿済みは黙って落とす（空のマスにしない）', () => {
    const r = buildProfileGrid([], [tile('a', '', 100), tile('b', 'ok', 90)]);
    expect(r.cells.map(c => c.src)).toEqual(['ok']);
  });

  it('key は予約と投稿済みで衝突しない（同じ id でも別のマス）', () => {
    const r = buildProfileGrid(
      [q('x', 'scheduled', '2026-09-10T09:00:00Z', 'img-1')],
      [tile('x', 'img-2', 100)],
    );
    expect(new Set(r.cells.map(c => c.key)).size).toBe(2);
  });
});

describe('buildProfileGrid — 上限', () => {
  it('★上限は予約から先に埋め、あふれた投稿済みは数にも入れない', () => {
    const posts = Array.from({ length: 4 }, (_, i) =>
      q(`s${i}`, 'scheduled', `2026-09-${10 + i}T09:00:00Z`, `img-s${i}`));
    const posted = Array.from({ length: 5 }, (_, i) => tile(`p${i}`, `img-p${i}`, 100 - i));
    const r = buildProfileGrid(posts, posted, 6);
    expect(r.cells).toHaveLength(6);
    expect(r.plannedShown).toBe(4);
    expect(r.postedShown).toBe(2);
  });

  it('予約だけで上限を超えたら投稿済みは 0 枚（数も 0 と正直に返す）', () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      q(`s${i}`, 'scheduled', `2026-09-${10 + i}T09:00:00Z`, `img-s${i}`));
    const r = buildProfileGrid(posts, [tile('p', 'img-p', 1)], 3);
    expect(r.plannedShown).toBe(3);
    expect(r.postedShown).toBe(0);
  });

  it('上限が壊れていても既定(12)で動く／0 なら 1 枚も出さない', () => {
    const posted = Array.from({ length: 20 }, (_, i) => tile(`p${i}`, `img-${i}`, 100 - i));
    expect(buildProfileGrid([], posted, NaN).cells).toHaveLength(12);
    expect(buildProfileGrid([], posted, 0).cells).toHaveLength(0);
  });

  it('渡された配列を書き換えない（呼び出し側の予約リストを並べ替えない）', () => {
    const posts = [
      q('a', 'scheduled', '2026-09-10T09:00:00Z', 'img-a'),
      q('b', 'scheduled', '2026-09-12T09:00:00Z', 'img-b'),
    ];
    const before = posts.map(p => p.id);
    buildProfileGrid(posts, []);
    expect(posts.map(p => p.id)).toEqual(before);
  });
});
