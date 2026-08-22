// ============================================================
// Sales OS — 壊れたら営業が止まるところだけをテストする
//   1. 根拠のないスコアは 0 点になる (AI の想像で 90 点にならない)
//   2. ステージは戻らない (返信をもらった会社が「接触ずみ」に落ちない)
//   3. どの結果を入れても「次にやる日」が必ず入る (二度と出てこない会社を作らない)
//   4. 期限超過の追客が、新規の高スコアより前に来る
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildScore, priorityValue } from '../shared/score';
import { applyActivity } from '../../../api/_lib/sales/flow';
import { blankCompany } from '../../../api/_lib/sales/store';
import type { ActivityKind, Stage } from '../shared/types';
import { FUNNEL_STAGES, stageMeta } from '../shared/catalog';
import { assertSafeUrl, isForbiddenAddress } from '../../../api/_lib/sales/fetchSite';

describe('CORE SALES SCORE', () => {
  it('根拠が無い項目は 0 点・未確認になる', () => {
    const s = buildScore([
      { key: 'videoDemand', value: 20, evidence: '' },
      { key: 'buyingSignal', value: 20, evidence: '不明' },
      { key: 'productFit', value: 18, evidence: '美容クリニックの施術写真をサイトに多数掲載' },
    ]);
    expect(s.items.find(i => i.key === 'videoDemand')?.value).toBe(0);
    expect(s.items.find(i => i.key === 'buyingSignal')?.value).toBe(0);
    expect(s.items.find(i => i.key === 'productFit')?.value).toBe(18);
    expect(s.total).toBe(18);
    expect(s.confidence).toBeCloseTo(1 / 6, 5);
  });

  it('満点を超える申告は各項目の上限で切る', () => {
    const s = buildScore([{ key: 'oemPotential', value: 999, evidence: '広告代理店であるとサイトに明記' }]);
    expect(s.items.find(i => i.key === 'oemPotential')?.value).toBe(10);
    expect(s.total).toBeLessThanOrEqual(100);
  });

  it('AI が何も返さなくても壊れない', () => {
    const s = buildScore(null);
    expect(s.total).toBe(0);
    expect(s.items).toHaveLength(6);
  });
});

describe('ステージ遷移', () => {
  const base = () => blankCompany({ id: 'x', name: 'テスト', url: 'https://example.com', domain: 'example.com' });

  it('返信をもらったあとに電話しても段は戻らない', () => {
    const a = applyActivity({ company: base(), kind: 'reply', today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z' });
    expect(a.company.stage).toBe<Stage>('REPLIED');
    const b = applyActivity({ company: a.company, kind: 'call', today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z' });
    expect(b.company.stage).toBe<Stage>('REPLIED');
    expect(stageMeta(b.company.stage).step).toBeGreaterThanOrEqual(stageMeta(a.company.stage).step);
  });

  it('不在は接触回数に数えない', () => {
    const a = applyActivity({ company: base(), kind: 'call_no_answer', today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z' });
    expect(a.company.touches).toBe(0);
    expect(a.company.nextActionAt).toBe('2026-08-24');
  });

  it('どの結果を入れても次にやる日が必ず入る', () => {
    const kinds: ActivityKind[] = [
      'call', 'call_no_answer', 'email', 'reply', 'meeting',
      'proposal', 'trial', 'won', 'monthly', 'oem', 'lost', 'note',
    ];
    for (const k of kinds) {
      const r = applyActivity({ company: base(), kind: k, today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z' });
      expect(r.company.nextActionAt, `${k} に次の日が入っていない`).toBeTruthy();
      expect(r.company.nextActionLabel, `${k} に次の内容が入っていない`).toBeTruthy();
    }
  });

  it('接触するたびに追客の切り口が変わる', () => {
    let c = base();
    const angles: string[] = [];
    for (let i = 0; i < 4; i++) {
      c = applyActivity({ company: c, kind: 'email', today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z' }).company;
      angles.push(c.nextActionLabel);
    }
    expect(new Set(angles).size).toBe(angles.length);
  });

  it('失注しても90日後に戻ってくる', () => {
    const r = applyActivity({
      company: base(), kind: 'lost', today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z',
      lostReason: '社内に編集者がいる',
    });
    expect(r.company.stage).toBe<Stage>('LOST');
    expect(r.company.lostReason).toBe('社内に編集者がいる');
    expect(r.company.nextActionAt).toBe('2026-11-20');
  });
});

describe('今日の並び順', () => {
  it('期限超過の追客は、未接触の満点リードより前に来る', () => {
    const overdue = priorityValue({ score: 40, nextActionAt: '2026-08-01', touches: 2, todayISO: '2026-08-22' });
    const freshTop = priorityValue({ score: 100, nextActionAt: null, touches: 0, todayISO: '2026-08-22' });
    expect(overdue).toBeGreaterThan(freshTop);
  });

  it('予定日がまだ先の会社は下がる', () => {
    const later = priorityValue({ score: 90, nextActionAt: '2026-09-30', touches: 1, todayISO: '2026-08-22' });
    const today = priorityValue({ score: 50, nextActionAt: '2026-08-22', touches: 1, todayISO: '2026-08-22' });
    expect(today).toBeGreaterThan(later);
  });
});

// ---- Codex レビュー (2026-08-22) の指摘に対する回帰テスト ----
describe('失注しても到達段は消えない', () => {
  it('商談まで行って失注した会社は、商談まで到達した扱いのまま残る', () => {
    let c = blankCompany({ id: 'y', name: '失注テスト' });
    c = applyActivity({ company: c, kind: 'meeting', today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z' }).company;
    expect(c.maxStep).toBe(stageMeta('MEETING').step);
    c = applyActivity({ company: c, kind: 'lost', today: '2026-08-22', nowISO: '2026-08-22T00:00:00.000Z', lostReason: '予算' }).company;
    expect(c.stage).toBe<Stage>('LOST');
    // 現在の段は -1 でも、到達段は商談のまま = 商談率から消えない
    expect(stageMeta(c.stage).step).toBe(-1);
    expect(c.maxStep).toBe(stageMeta('MEETING').step);
  });
});

describe('ファネル', () => {
  it('初回受注 (TRIAL) が段から抜け落ちていない', () => {
    expect(FUNNEL_STAGES).toContain('TRIAL');
    const steps = FUNNEL_STAGES.map(s => stageMeta(s).step);
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });
});

describe('SSRF ガード', () => {
  it('社内・ループバック・メタデータ宛のアドレスを弾く', () => {
    for (const ip of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isForbiddenAddress(ip), `${ip} を通してしまった`).toBe(true);
    }
  });
  it('公開アドレスは通す', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '203.0.113.10', '2606:4700:4700::1111']) {
      expect(isForbiddenAddress(ip), `${ip} を弾いてしまった`).toBe(false);
    }
  });
  it('IPを名前に埋め込んだホスト・ワイルドカードDNSを弾く', () => {
    for (const u of ['http://127.0.0.1.nip.io/', 'https://10.0.0.1.sslip.io/', 'http://localhost/', 'http://169.254.169.254/', 'http://intranet/']) {
      expect(() => assertSafeUrl(u), `${u} を通してしまった`).toThrow();
    }
    expect(() => assertSafeUrl('https://www.cyberagent.co.jp/')).not.toThrow();
  });
});
