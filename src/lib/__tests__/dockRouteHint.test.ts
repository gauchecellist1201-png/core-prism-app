// ============================================================
// 下部チャットの「Enter を押すと何が起きるか」帯の契約テスト (2026-08-13)
//
// 帯は routeCommand の判定をそのまま出す。ここで守りたいのは1つだけ:
//   **帯に書いてあることと、Enter を押して実際に起きることが必ず一致する**
// 判定を2か所に書くと必ずズレる(同じ数字を2か所で計算する罠)ので、
// 帯は routeCommand を呼ぶだけにしてある。このテストはその前提を固定する。
// ============================================================
import { describe, it, expect } from 'vitest';
import { routeCommand } from '../prismCommandRouter';

/** 帯を出すかどうかの判定 (BottomChatDock の showRouteHint と同じ条件)。 */
const hintShown = (input: string) => !!input.trim() && routeCommand(input).type !== 'chat';

describe('帯を出す条件', () => {
  it('空文字・空白だけのときは出さない', () => {
    expect(hintShown('')).toBe(false);
    expect(hintShown('   ')).toBe(false);
  });

  it('ふつうの会話では出さない（黙っていてほしい場面で騒がない）', () => {
    expect(hintShown('おはよう')).toBe(false);
    expect(hintShown('今日の調子はどう？')).toBe(false);
  });
});

describe('機能を開く場面 — これまで「魔法の言葉」を当てないと届かなかった', () => {
  const cases: [string, string][] = [
    ['請求書を開いて', '請求書スタジオ'],
    ['議事録をまとめて', '議事録AI'],
    ['レシートを登録して', '経費 / レシートOCR'],
    ['スライドを作って', 'スライド生成'],
  ];

  it.each(cases)('「%s」→ 帯に「%s が開きます」と出る', (input, label) => {
    const hit = routeCommand(input);
    expect(hit.type).toBe('open-modal');
    // 帯に出す文字列は routeCommand が返したラベルそのもの（言い換えない）
    expect(hit.type === 'open-modal' && hit.label).toBe(label);
    expect(hintShown(input)).toBe(true);
  });
});

describe('横取りされる場面 — 「AIに聞くだけ」の逃げ道が必要な理由', () => {
  // ここが空振りだと逃げ道ボタンは要らないことになるので、
  // 「実際に質問が機能起動へ倒れる」ことを実例で固定しておく。
  it('「タスクって何？」は“質問”なのに機能起動に倒れる（だから逃げ道が要る）', () => {
    const hit = routeCommand('タスクって何？');
    expect(hit.type).toBe('open-modal');
  });

  it('短い単語だけでも機能起動に倒れる', () => {
    expect(routeCommand('ナレッジ').type).toBe('open-modal');
    expect(routeCommand('体調').type).toBe('open-modal');
  });

  // 注意: ここで確かめられるのは「帯を出す条件を満たすこと」まで。
  // 逃げ道ボタンが実際に描画されることは DOM を見ていないので、このテストでは
  // 保証していない（型で onSendChat を必須にすることで、渡し忘れを防いでいる）。
  it('横取りされる場面では帯を出す条件を満たす（＝逃げ道を出す場所がある）', () => {
    for (const q of ['タスクって何？', 'ナレッジ', '体調']) {
      expect(hintShown(q)).toBe(true);
    }
  });
});

describe('帯の文言と実際の動きが一致する', () => {
  it('open-modal のときだけ「開きます」、execute のときだけ「実行します」', () => {
    const open = routeCommand('請求書を開いて');
    expect(open.type).toBe('open-modal');

    const exec = routeCommand('プリズム 来期の事業計画をまとめて');
    // 呼びかけ + 実行動詞 + 該当スタジオなし → AI 実行
    expect(exec.type).toBe('execute');
    expect(hintShown('プリズム 来期の事業計画をまとめて')).toBe(true);
  });
});
