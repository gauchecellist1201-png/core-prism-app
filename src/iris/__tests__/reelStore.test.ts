import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================
// reelStore — 「保存できなかった理由」を必ず返すことの確認
//
// なぜこのテストが要るか:
//   以前は成否が boolean だけだったので、素材が端末に置けなかった時に
//   画面へ理由を出す道が型の時点で無かった。ユーザーには
//   「リロードしたら素材が消えていた」としか見えなかった。
//   ここでは理由 (quota / unavailable / timeout) が付いて返ることを固定する。
// ============================================================

/** put が指定の例外でトランザクション失敗する、最小の偽 IndexedDB */
function fakeIndexedDb(failWith: { name?: string; message: string } | null) {
  return {
    open() {
      const req: Record<string, any> = { result: null, error: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => undefined,
          close: () => undefined,
          transaction() {
            const tx: Record<string, any> = {
              error: null,
              objectStore: () => ({ put: () => undefined }),
            };
            setTimeout(() => {
              if (failWith) {
                const e = new Error(failWith.message);
                if (failWith.name) e.name = failWith.name;
                tx.error = e;
                tx.onerror?.();
              } else {
                tx.oncomplete?.();
              }
            }, 0);
            return tx;
          },
        };
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

const blob = () => new Blob(['x'], { type: 'image/png' });

// ============================================================
// 「棚」の素材を掃除で巻き込まないことの確認 (2026-08-03)
//
// なぜこのテストが要るか:
//   pruneReelAssets / clearReelStore は元々「いま編集中のリールに使われていない
//   素材」を全部消していた。棚 (library) を足した以上、ここが以前のままだと
//   2 本目を作り始めた瞬間に棚が空になる = 棚が存在しないのと同じになる。
//   「棚に載っている素材は消えない」を型でなく振る舞いとして固定する。
// ============================================================

/** getAllKeys / delete / clear まで動く、最小の偽 IndexedDB (ストアは Map) */
function memIndexedDb(stores: Record<string, Map<string, any>>) {
  return {
    open() {
      const req: Record<string, any> = { result: null, error: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: (n: string) => n in stores },
          createObjectStore: (n: string) => { stores[n] = stores[n] || new Map(); },
          close: () => undefined,
          transaction() {
            const tx: Record<string, any> = { error: null };
            tx.objectStore = (name: string) => {
              const m = stores[name] || (stores[name] = new Map());
              return {
                put: (v: any, key?: string) => { m.set(String(key ?? v?.id), v); },
                delete: (k: any) => { m.delete(String(k)); },
                clear: () => { m.clear(); },
                get: (k: any) => {
                  const r: Record<string, any> = { result: m.get(String(k)) };
                  setTimeout(() => r.onsuccess?.(), 0);
                  return r;
                },
                getAll: () => {
                  const r: Record<string, any> = { result: Array.from(m.values()) };
                  setTimeout(() => r.onsuccess?.(), 0);
                  return r;
                },
                getAllKeys: () => {
                  const r: Record<string, any> = { result: Array.from(m.keys()) };
                  setTimeout(() => r.onsuccess?.(), 0);
                  return r;
                },
              };
            };
            // getAllKeys 等の onsuccess より後に complete させる
            setTimeout(() => tx.oncomplete?.(), 5);
            return tx;
          },
        };
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

let putReelAsset: typeof import('../reelStore').putReelAsset;
let saveReelProject: typeof import('../reelStore').saveReelProject;
let pruneReelAssets: typeof import('../reelStore').pruneReelAssets;
let clearReelStore: typeof import('../reelStore').clearReelStore;
let deleteLibraryItems: typeof import('../reelStore').deleteLibraryItems;
let listReelProjects: typeof import('../reelStore').listReelProjects;
let loadReelProjectById: typeof import('../reelStore').loadReelProjectById;
let deleteReelProject: typeof import('../reelStore').deleteReelProject;
let restoreReelProject: typeof import('../reelStore').restoreReelProject;
let summarizeProjects: typeof import('../reelStore').summarizeProjects;
let reelSavedLabel: typeof import('../reelStore').reelSavedLabel;

beforeEach(async () => {
  ({ putReelAsset, saveReelProject, pruneReelAssets, clearReelStore, deleteLibraryItems,
     listReelProjects, loadReelProjectById, deleteReelProject, restoreReelProject, summarizeProjects,
     reelSavedLabel } =
    await import('../reelStore'));
});

afterEach(() => {
  delete (globalThis as any).indexedDB;
});

describe('putReelAsset', () => {
  it('保存できたら ok:true', async () => {
    (globalThis as any).indexedDB = fakeIndexedDb(null);
    const r = await putReelAsset('a1', blob(), 'ねこ.png');
    expect(r.ok).toBe(true);
  });

  it('容量オーバーは quota として、そのまま画面に出せる日本語で返す', async () => {
    (globalThis as any).indexedDB = fakeIndexedDb({ name: 'QuotaExceededError', message: 'quota exceeded' });
    const r = await putReelAsset('a1', blob(), 'ねこ.png');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('quota');
    expect(r.message).toContain('空き容量');
  });

  it('IndexedDB が使えない端末 (プライベートモード等) は unavailable', async () => {
    (globalThis as any).indexedDB = undefined;
    const r = await putReelAsset('a1', blob(), 'ねこ.png');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('unavailable');
  });

  it('理由が分からない失敗でも、黙らず message を返す', async () => {
    (globalThis as any).indexedDB = fakeIndexedDb({ message: 'なにかがおかしい' });
    const r = await putReelAsset('a1', blob(), 'ねこ.png');
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('unknown');
    expect(r.message).toContain('なにかがおかしい');
  });
});

describe('saveReelProject', () => {
  const project = { clips: [], captions: [], savedAt: 0 };

  it('保存できたら ok:true', async () => {
    (globalThis as any).indexedDB = fakeIndexedDb(null);
    expect((await saveReelProject(project)).ok).toBe(true);
  });

  it('失敗は理由つきで返る (呼び出し側はこれを見て掃除を止める)', async () => {
    (globalThis as any).indexedDB = fakeIndexedDb({ name: 'QuotaExceededError', message: 'quota exceeded' });
    const r = await saveReelProject(project);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('quota');
  });
});

describe('棚の素材は掃除で消えない', () => {
  /** assets = 実体、library = 棚に載っている印 */
  const setup = () => {
    const stores: Record<string, Map<string, any>> = {
      assets: new Map([
        ['inProject', { id: 'inProject' }],   // いま編集中のリールが使っている
        ['onShelf', { id: 'onShelf' }],       // 棚にだけ載っている (前に読み込んだ素材)
        ['orphan', { id: 'orphan' }],         // どちらでもない = 消えてよい
      ]),
      library: new Map([['onShelf', { id: 'onShelf', usedCount: 0 }]]),
      project: new Map(),
    };
    (globalThis as any).indexedDB = memIndexedDb(stores);
    return stores;
  };

  it('pruneReelAssets は棚の素材を残し、どこにも属さない素材だけ消す', async () => {
    const stores = setup();
    await pruneReelAssets(['inProject']);
    expect(stores.assets.has('inProject')).toBe(true);
    expect(stores.assets.has('onShelf')).toBe(true);   // ここが false に戻ると棚が毎回空になる
    expect(stores.assets.has('orphan')).toBe(false);
  });

  it('clearReelStore は作りかけを消しても、棚の素材は残す', async () => {
    const stores = setup();
    stores.project.set('current', { clips: [] });
    await clearReelStore();
    expect(stores.project.size).toBe(0);
    expect(stores.assets.has('onShelf')).toBe(true);
    expect(stores.assets.has('orphan')).toBe(false);
  });

  it('棚から消すのはユーザーが選んだ時だけ。編集中の素材は実体を残す', async () => {
    const stores = setup();
    stores.library.set('inProject', { id: 'inProject', usedCount: 1 });
    await deleteLibraryItems(['onShelf', 'inProject'], ['inProject']);
    expect(stores.library.has('onShelf')).toBe(false);
    expect(stores.assets.has('onShelf')).toBe(false);
    expect(stores.library.has('inProject')).toBe(false);
    expect(stores.assets.has('inProject')).toBe(true); // 画面から素材が消える事故を防ぐ
  });
});

// ============================================================
// 作ったリールが 1 本しか残らない、の解消 (2026-08-31)
//
// なぜこのテストが要るか:
//   保存枠はキー 'current' の 1 件だけだった。つまり 2 本目を作り始めた瞬間に
//   1 本目の並び・尺・字幕が上書きで消えていた。素材の棚は残る作りなのに、
//   組み上げた結果だけが残らない = 毎回ゼロから組み直しになる。
//   ここでは「2 本目を保存しても 1 本目が残る」「他のリールの素材を掃除で消さない」を
//   型ではなく振る舞いとして固定する。
// ============================================================
const clip = (assetId: string) => ({
  assetId, kind: 'image' as const, duration: 2.5, kenBurns: 'none', transition: 'none',
});

describe('作ったリールが全部残る', () => {
  const setup = () => {
    const stores: Record<string, Map<string, any>> = {
      assets: new Map(), library: new Map(), project: new Map(),
    };
    (globalThis as any).indexedDB = memIndexedDb(stores);
    return stores;
  };

  it('id を付けて保存すると current と proj:<id> の両方に残る', async () => {
    const stores = setup();
    await saveReelProject({ id: 'a', title: '1本目', clips: [clip('x1')], captions: [], savedAt: 100 });
    expect(stores.project.has('current')).toBe(true);
    expect(stores.project.has('proj:a')).toBe(true);
  });

  it('2 本目を保存しても 1 本目が消えない (これが直したかったこと)', async () => {
    const stores = setup();
    await saveReelProject({ id: 'a', title: '1本目', clips: [clip('x1')], captions: [], savedAt: 100 });
    await saveReelProject({ id: 'b', title: '2本目', clips: [clip('x2')], captions: [], savedAt: 200 });
    const list = await listReelProjects();
    expect(list.map(r => r.id)).toEqual(['b', 'a']);      // 新しい順
    expect(stores.project.has('proj:a')).toBe(true);
    const first = await loadReelProjectById('a');
    expect(first?.clips[0].assetId).toBe('x1');           // 中身も 1 本目のまま
  });

  it('id を付けない保存 (上級版スタジオ) は今までどおり current だけ', async () => {
    const stores = setup();
    await saveReelProject({ clips: [clip('x1')], captions: [], savedAt: 100 });
    expect(stores.project.has('current')).toBe(true);
    expect(Array.from(stores.project.keys()).filter(k => k.startsWith('proj:'))).toEqual([]);
  });

  it('掃除は「他のリールが使っている素材」を消さない', async () => {
    const stores = setup();
    stores.assets.set('x1', { id: 'x1' });
    stores.assets.set('x2', { id: 'x2' });
    stores.assets.set('orphan', { id: 'orphan' });
    stores.project.set('proj:a', { id: 'a', clips: [clip('x1')], captions: [], savedAt: 100 });
    // いま編集中の 2 本目を保存 → 掃除
    await pruneReelAssets(['x2']);
    expect(stores.assets.has('x1')).toBe(true);   // false に戻ると、一覧に並ぶのに開くと中身が無い
    expect(stores.assets.has('x2')).toBe(true);
    expect(stores.assets.has('orphan')).toBe(false);
  });

  it('クリップを全部消しても、保存した過去のリールは残る', async () => {
    const stores = setup();
    stores.assets.set('x1', { id: 'x1' });
    stores.project.set('proj:a', { id: 'a', clips: [clip('x1')], captions: [], savedAt: 100 });
    stores.project.set('current', { id: 'b', clips: [], captions: [], savedAt: 200 });
    await clearReelStore();
    expect(stores.project.has('current')).toBe(false);   // 開いていた 1 本は閉じる
    expect(stores.project.has('proj:a')).toBe(true);     // 作ったものは残る
    expect(stores.assets.has('x1')).toBe(true);          // その素材も残る
  });

  it('消すのは選んだ 1 本だけ。元に戻しても、いま開いている別のリールを奪わない', async () => {
    const stores = setup();
    await saveReelProject({ id: 'a', title: '1本目', clips: [clip('x1')], captions: [], savedAt: 100 });
    await saveReelProject({ id: 'b', title: '2本目', clips: [clip('x2')], captions: [], savedAt: 200 });
    const kept = await loadReelProjectById('a');
    expect((await deleteReelProject('a')).ok).toBe(true);
    expect(stores.project.has('proj:a')).toBe(false);
    expect(stores.project.has('proj:b')).toBe(true);
    expect(stores.project.get('current')?.id).toBe('b'); // 開いている 2 本目はそのまま
    expect((await restoreReelProject(kept!)).ok).toBe(true);
    expect(stores.project.has('proj:a')).toBe(true);
    expect(stores.project.get('current')?.id).toBe('b'); // 戻しても current を踏まない
  });

  it('いま開いている 1 本を消したら current も閉じる', async () => {
    const stores = setup();
    await saveReelProject({ id: 'a', clips: [clip('x1')], captions: [], savedAt: 100 });
    await deleteReelProject('a');
    expect(stores.project.has('current')).toBe(false);
  });
});

describe('一覧の組み立て (summarizeProjects)', () => {
  const thumbs = new Map([['x1', 'data:image/jpeg;base64,AAAA']]);

  it("current は一覧に出さない (同じものが 2 つ並ばない)", () => {
    const rows = summarizeProjects(
      ['current', 'proj:a'],
      [{ id: 'a', clips: [clip('x1')], savedAt: 100 }, { id: 'a', clips: [clip('x1')], savedAt: 100 }],
      thumbs,
    );
    expect(rows.map(r => r.id)).toEqual(['a']);
  });

  it('新しい順に並び、1 枚目のサムネと枚数は実測値', () => {
    const rows = summarizeProjects(
      ['proj:a', 'proj:b'],
      [
        { id: 'a', title: '古い', clips: [clip('x1')], savedAt: 100 },
        { id: 'b', title: '新しい', clips: [clip('x9'), clip('x8')], savedAt: 300 },
      ],
      thumbs,
    );
    expect(rows.map(r => r.title)).toEqual(['新しい', '古い']);
    expect(rows[0].clipCount).toBe(2);
    expect(rows[0].thumb).toBeUndefined();       // 棚に無い素材のサムネは作らない
    expect(rows[1].thumb).toBe('data:image/jpeg;base64,AAAA');
  });

  it('カットが 0 枚のものは一覧に出さない (開いても何も無いものを並べない)', () => {
    const rows = summarizeProjects(['proj:a'], [{ id: 'a', clips: [], savedAt: 100 }], thumbs);
    expect(rows).toEqual([]);
  });

  it('見出しが無い保存にも日付から見出しが付く (無名で並ばない)', () => {
    const at = new Date(2026, 7, 25, 10, 0).getTime();
    const rows = summarizeProjects(['proj:a'], [{ id: 'a', clips: [clip('x1')], savedAt: at }], thumbs);
    expect(rows[0].title).toBe('8/25 のリール');
  });
});

describe('保存時刻の見せ方 (reelSavedLabel)', () => {
  const now = new Date(2026, 7, 31, 18, 30).getTime();

  it('今日のものは「今日 HH:MM」', () => {
    expect(reelSavedLabel(new Date(2026, 7, 31, 9, 5).getTime(), now)).toBe('今日 09:05');
  });

  it('別の日は日付から出す (今日と混ぜない)', () => {
    expect(reelSavedLabel(new Date(2026, 7, 25, 21, 40).getTime(), now)).toBe('8/25 21:40');
  });

  it('時刻が無いものには何も書かない (推定しない)', () => {
    expect(reelSavedLabel(0, now)).toBe('');
  });
});
