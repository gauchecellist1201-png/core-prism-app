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

beforeEach(async () => {
  ({ putReelAsset, saveReelProject, pruneReelAssets, clearReelStore, deleteLibraryItems } =
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
