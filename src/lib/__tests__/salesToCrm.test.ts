import { describe, it, expect, beforeEach } from 'vitest';

// jsdom を入れずに動かすための最小 localStorage (ブラウザと同じ挙動だけ用意)
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
const Storage = MemStorage;
(globalThis as any).localStorage = new MemStorage();
(globalThis as any).window = globalThis;

const { pushLeadToCrm, countSalesAgentDeals, SALES_AGENT_SOURCE } = await import('../salesToCrm');

const KEY = 'core_crm_deals_v1';

function store(): any[] {
  return JSON.parse(localStorage.getItem(KEY) || '[]');
}

describe('salesToCrm — 営業エージェントで採用した相手を案件管理へ渡す', () => {
  beforeEach(() => { localStorage.clear(); });

  it('採用すると案件が 1 件増える', () => {
    expect(pushLeadToCrm('p1', { companyName: '株式会社サンプル', reason: 'DX 推進中', origin: '今日の5社' })).toBe('added');
    const deals = store();
    expect(deals).toHaveLength(1);
    expect(deals[0].personaId).toBe('p1');
    expect(deals[0].title).toBe('株式会社サンプル');
    expect(deals[0].stage).toBe('lead');
    expect(deals[0].source).toBe(`${SALES_AGENT_SOURCE}:今日の5社`);
    // 勝手な金額を作らない
    expect(deals[0].amount).toBeUndefined();
    // 来歴が活動履歴に 1 行残る
    expect(deals[0].activities).toHaveLength(1);
  });

  it('同じ会社を二度採用しても増えない', () => {
    pushLeadToCrm('p1', { companyName: '株式会社サンプル', origin: '今日の5社' });
    expect(pushLeadToCrm('p1', { companyName: ' 株式会社サンプル ', origin: 'Gmail の受信箱' })).toBe('duplicate');
    expect(store()).toHaveLength(1);
  });

  it('別の人格の同名会社は別案件として入る', () => {
    pushLeadToCrm('p1', { companyName: '株式会社サンプル', origin: '今日の5社' });
    expect(pushLeadToCrm('p2', { companyName: '株式会社サンプル', origin: '今日の5社' })).toBe('added');
    expect(countSalesAgentDeals('p1')).toBe(1);
    expect(countSalesAgentDeals('p2')).toBe(1);
  });

  it('手で作った案件（営業エージェント以外）は数に入れない', () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: 'x', personaId: 'p1', title: '手入力の案件', stage: 'lead', activities: [], createdAt: '', updatedAt: '' },
    ]));
    expect(countSalesAgentDeals('p1')).toBe(0);
    pushLeadToCrm('p1', { companyName: '株式会社サンプル', origin: '今日の5社' });
    expect(countSalesAgentDeals('p1')).toBe(1);
    expect(store()).toHaveLength(2);
  });

  it('保存できないときは failed を返す（黙って成功にしない）', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    try {
      expect(pushLeadToCrm('p1', { companyName: '株式会社サンプル', origin: '今日の5社' })).toBe('failed');
    } finally {
      Storage.prototype.setItem = orig;
    }
  });

  it('会社名が空なら何もしない', () => {
    expect(pushLeadToCrm('p1', { companyName: '   ', origin: '今日の5社' })).toBe('failed');
    expect(store()).toHaveLength(0);
  });
});
