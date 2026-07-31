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

let putReelAsset: typeof import('../reelStore').putReelAsset;
let saveReelProject: typeof import('../reelStore').saveReelProject;

beforeEach(async () => {
  ({ putReelAsset, saveReelProject } = await import('../reelStore'));
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
