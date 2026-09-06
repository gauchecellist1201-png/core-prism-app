import { describe, it, expect } from 'vitest';
import { NERI, ONE_CORE } from '../coreStory';
import { NERI_FACTS } from '../../lib/coreLinks';

// 2026-09-07: ホーム9幕の Studio の直後に NERI の章を置いた（オーナー判断）。
// 営業設計「映像で接点（Studio）→ NERI で業務に入る → CORE が会社を変える」の
// 真ん中が、ホームの本文に1語（2035年表）しか無かった。
describe('ホームの NERI の章', () => {
  it('金額を章の中に書き写さない（正本は coreLinks の NERI_FACTS）', () => {
    const text = [NERI.kicker, NERI.h2, NERI.lead, NERI.note, NERI.cta, ...NERI.points].join('\n');
    expect(text).not.toMatch(/[0-9][0-9,]*\s*円/);
    expect(text).not.toContain('¥');
    expect(text).not.toContain('39,800');
    // 金額の正本の側には入っている
    expect(NERI_FACTS.from).toContain('39,800');
  });

  it('ONE CORE の5つ目の層にしない（NERI は層ではなく、層の上で毎日を動かす製品）', () => {
    expect(ONE_CORE.layers).toHaveLength(4);
    expect(ONE_CORE.layers.map(l => l.en).join(' ')).not.toContain('NERI');
  });

  it('章として要る物が揃っている', () => {
    expect(NERI.points.length).toBeGreaterThanOrEqual(3);
    expect(NERI.h2).toContain('\n');   // Lines が改行を描く
    expect(NERI.cta).toContain('NERI');
  });
});
