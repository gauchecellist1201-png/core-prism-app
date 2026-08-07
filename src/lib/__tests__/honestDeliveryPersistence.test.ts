import { describe, it, expect, beforeEach } from 'vitest';

// 端末の保存を模した最小 localStorage。
// quotaBytes を設定すると、その容量を超える setItem が本物のブラウザと同じように例外を投げる。
class MemStorage {
  private m = new Map<string, string>();
  /** 0 なら無制限 */
  quotaBytes = 0;
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) {
    const val = String(v);
    if (this.quotaBytes > 0) {
      let used = 0;
      for (const [key, cur] of this.m) if (key !== k) used += key.length + cur.length;
      if (used + k.length + val.length > this.quotaBytes) {
        const e = new Error('QuotaExceededError');
        e.name = 'QuotaExceededError';
        throw e;
      }
    }
    this.m.set(k, val);
  }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); this.quotaBytes = 0; }
}
const mem = new MemStorage();
(globalThis as any).localStorage = mem;
(globalThis as any).window = globalThis;

const { saveArtifact, listArtifacts } = await import('../actionExecutor');
const { logDeliverableChecked, listDeliverables } = await import('../cxoDeliverables');

function artifact(id: string, contentLen = 40) {
  return {
    id,
    personaId: 'p1',
    action: 'テスト依頼',
    plan: {
      steps: [{ label: '作る', detail: 'テスト' }],
      deliverable: { kind: 'text' as const, title: 'テスト成果物', content: 'あ'.repeat(contentLen) },
    },
    createdAt: new Date().toISOString(),
  };
}

function deliverable(title: string, contentLen = 40) {
  return {
    personaId: 'p1',
    cxoRole: 'CMO' as const,
    cxoName: 'CMO',
    cxoEmoji: '',
    title,
    summary: 'テスト',
    content: 'あ'.repeat(contentLen),
    category: 'copy' as const,
    source: 'inline-executor' as const,
  };
}

describe('成果物の保存 — 「保存済み」と言い切る前に、本当に残ったか確かめる', () => {
  beforeEach(() => { mem.clear(); });

  it('保存できたときは true を返し、実際に読み出せる', () => {
    expect(saveArtifact(artifact('a1'))).toBe(true);
    expect(listArtifacts('p1').map(a => a.id)).toContain('a1');
  });

  it('端末がいっぱいでも、古いものを捨てて「いまの 1 件」は残す', () => {
    // まず 3 件入れてから、その全部は入らない容量に絞る
    for (const id of ['old1', 'old2', 'old3']) expect(saveArtifact(artifact(id, 2000))).toBe(true);
    mem.quotaBytes = 3000; // 3 件ぶんは到底入らない容量
    expect(saveArtifact(artifact('newest', 400))).toBe(true);
    const ids = listArtifacts('p1').map(a => a.id);
    expect(ids).toContain('newest'); // 新しい 1 件は必ず残る
    expect(ids.length).toBeLessThan(4); // 古い分は捨てられている
  });

  it('1 件すら入らないときは false を返す（「自動保存済み」と嘘をつかない）', () => {
    mem.quotaBytes = 50; // 1 件も入らない
    expect(saveArtifact(artifact('nope', 5000))).toBe(false);
  });
});

describe('役員日報への記録 — 記録できなかったことを黙って飲み込まない', () => {
  beforeEach(() => { mem.clear(); });

  it('記録できたときは persisted=true で、一覧にも出る', () => {
    const res = logDeliverableChecked(deliverable('できた成果物'));
    expect(res.persisted).toBe(true);
    expect(listDeliverables('p1').map(d => d.title)).toContain('できた成果物');
  });

  it('端末がいっぱいで 1 件も書けないときは persisted=false', () => {
    mem.quotaBytes = 50;
    const res = logDeliverableChecked(deliverable('入らない成果物', 5000));
    expect(res.persisted).toBe(false);
    expect(listDeliverables('p1')).toHaveLength(0);
  });

  it('古い記録を捨ててでも、今回の 1 件は残す', () => {
    for (const t of ['古1', '古2', '古3']) expect(logDeliverableChecked(deliverable(t, 2000)).persisted).toBe(true);
    mem.quotaBytes = 3500;
    const res = logDeliverableChecked(deliverable('最新', 300));
    expect(res.persisted).toBe(true);
    expect(listDeliverables('p1').map(d => d.title)).toContain('最新');
  });
});
