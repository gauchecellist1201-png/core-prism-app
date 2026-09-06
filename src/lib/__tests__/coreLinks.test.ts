import { describe, it, expect } from 'vitest';
import { NERI_LP, NERI_APP, neriLpUrl, NERI_FACTS } from '../coreLinks';

describe('NERI へのリンク', () => {
  it('LP は canonical と同じホストを指す（vercel.app 側へ内部リンクを集めない）', () => {
    expect(NERI_LP).toBe('https://nexus.core-ai.jp/lp/');
    expect(NERI_LP).not.toContain('vercel.app');
  });

  it('アプリ本体のホストは据え置く（ホストを変えると触ってくれた人の鍵と履歴が消える）', () => {
    expect(NERI_APP).toBe('https://core-nexus-kappa.vercel.app');
  });

  it('どこから送ったかの印が付く', () => {
    expect(neriLpUrl('studio-home')).toBe('https://nexus.core-ai.jp/lp/?from=studio-home');
  });

  it('utm_ は使わない（同じ cookie 域では本当の流入元を上書きして消してしまう）', () => {
    expect(neriLpUrl('corp-card')).not.toMatch(/utm_/);
  });

  it('印は LP 側の受け取り（12文字・英数字とハイフンだけ）に収まる形へ落とす', () => {
    expect(neriLpUrl('studio-very-long-name')).toBe('https://nexus.core-ai.jp/lp/?from=studio-very');
    expect(neriLpUrl('corp カード<script>')).toBe('https://nexus.core-ai.jp/lp/?from=corpscript');
    expect(neriLpUrl('')).toBe('https://nexus.core-ai.jp/lp/');
    expect(neriLpUrl('＿＿＿')).toBe('https://nexus.core-ai.jp/lp/');
  });

  it('金額は 1 か所にだけ持つ（章の中に書き写さない）', () => {
    expect(NERI_FACTS.from).toContain('39,800');
  });

  // 印は LP 側で 12 文字に切られる。切られた印は GA4 の探索で別の流入元と混ざり、
  // 「どこから来たか」を分けられなくなる（気づけないまま数字だけが残る）。
  it('実際に使っている印が、12文字で切られずにそのまま届く', () => {
    const USED = [
      'corp-head', 'corp-foot', 'corp-card', 'corp-plans',
      'corp-finder', 'corp-galry', 'corp-guide',
      'corp-home',   // ホーム9幕の NERI の章
      'roai-brief',  // ROAI診断の結果（prepare / focus のときだけ）
      'studio-home', 'studio-care',
    ];
    for (const f of USED) expect(neriLpUrl(f)).toBe(`https://nexus.core-ai.jp/lp/?from=${f}`);
  });
});
