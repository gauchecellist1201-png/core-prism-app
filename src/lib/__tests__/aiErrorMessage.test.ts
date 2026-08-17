// ============================================================
// 「AI が失敗したときに、英語の原文を人に見せない」を固定するテスト (2026-08-18)
//
// なぜ要るか:
//   Iris の AI 画面は `setErr(e.message)` の形で書かれていた場所が 20 か所以上あり、
//   実際に人が見る文字は "Failed to fetch" や "429 Too Many Requests" だった。
//   読んだ人は何が起きたのかも、次に何を押せばいいのかも分からない。
//   全部 humanizeAiError を通す方針にしたので、その砦をここで固める。
// ============================================================
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  humanizeAiError,
  aiFailureWithReason,
  aiErrorFromStatus,
  AI_TIMEOUT_MSG,
  AI_OFFLINE_MSG,
} from '../aiErrorMessage';

/** 人に見せてよい文か = 日本語で、英語の原文らしき断片が残っていないか */
const looksHuman = (s: string) =>
  /[ぁ-んァ-ヶ一-龠]/.test(s) &&
  !/failed to fetch|too many requests|unexpected token|typeerror|networkerror/i.test(s);

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('humanizeAiError — 英語の原文を外に出さない', () => {
  it('Chrome の通信失敗 (Failed to fetch) が人の言葉になる', () => {
    const out = humanizeAiError(new TypeError('Failed to fetch'));
    expect(looksHuman(out)).toBe(true);
    expect(out).not.toContain('Failed to fetch');
  });

  it('Safari の通信失敗 (Load failed) も人の言葉になる', () => {
    expect(looksHuman(humanizeAiError(new TypeError('Load failed')))).toBe(true);
  });

  it('混み合い (429) は「1分ほど待って」と伝える', () => {
    const out = humanizeAiError(new Error('AI request failed with status 429'));
    expect(out).toBe(aiErrorFromStatus(429));
    expect(out).toContain('1分');
  });

  it('サーバー不調 (500) は「少し待ってから」と伝える', () => {
    expect(humanizeAiError(new Error('HTTP 500 Internal Server Error'))).toBe(aiErrorFromStatus(500));
  });

  it('JSON の位置番号をステータスと読み違えない', () => {
    // "position 512" の 512 をサーバー不調と読むのが以前の挙動だった
    const out = humanizeAiError(new Error('Unexpected token < in JSON at position 512'));
    expect(out).not.toBe(aiErrorFromStatus(500));
    expect(looksHuman(out)).toBe(true);
  });

  it('打ち切り (AbortError) は「AIの不調」ではなく時間切れとして伝える', () => {
    const abort = new Error('The operation was aborted.');
    abort.name = 'AbortError';
    expect(humanizeAiError(abort)).toBe(AI_TIMEOUT_MSG);
  });

  it('オフラインのときは「電波」を案内する', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(humanizeAiError(new TypeError('Failed to fetch'))).toBe(AI_OFFLINE_MSG);
  });

  it('オンラインなら電波の文言は出さない (嘘をつかない)', () => {
    vi.stubGlobal('navigator', { onLine: true });
    expect(humanizeAiError(new TypeError('Failed to fetch'))).not.toBe(AI_OFFLINE_MSG);
  });

  it('自前の日本語メッセージはそのまま通す', () => {
    const mine = '案件メールを貼り付けてください';
    expect(humanizeAiError(new Error(mine))).toBe(mine);
  });

  it('日本語でも生の番号入り (「エラー: 404」) は作り直す', () => {
    const out = humanizeAiError(new Error('提案APIエラー: 404'));
    expect(out).toBe(aiErrorFromStatus(404));
    expect(out).not.toContain('404');
  });

  it('空・undefined・文字列でも必ず一文を返す', () => {
    for (const v of [undefined, null, '', 'boom', { nope: 1 }]) {
      expect(humanizeAiError(v).length).toBeGreaterThan(10);
    }
  });

  it('どんな入力でも必ず「次の一手」が書かれている', () => {
    const inputs = [
      new TypeError('Failed to fetch'),
      new Error('429'),
      new Error('500'),
      new Error('nonsense'),
      undefined,
    ];
    for (const e of inputs) {
      expect(humanizeAiError(e)).toMatch(/おためしください|ご連絡ください/);
    }
  });
});

describe('aiFailureWithReason — 頭に日本語を付けても原文が漏れない', () => {
  it('「予約できませんでした」+ 原因、の形になる', () => {
    const out = aiFailureWithReason('予約に失敗しました', new TypeError('Failed to fetch'));
    expect(out.startsWith('予約に失敗しました。')).toBe(true);
    expect(looksHuman(out)).toBe(true);
  });

  it('末尾のコロンや句点が二重にならない', () => {
    expect(aiFailureWithReason('予約に失敗しました: ', new Error('429'))).not.toContain('：。');
    expect(aiFailureWithReason('予約に失敗しました。', new Error('429'))).not.toContain('。。');
  });

  it('以前の書き方 (`${lead}: ${e.message}`) なら通らないことを示す', () => {
    const oldStyle = `予約に失敗しました: ${new TypeError('Failed to fetch').message}`;
    expect(looksHuman(oldStyle)).toBe(false); // これが本番に出ていた
    expect(looksHuman(aiFailureWithReason('予約に失敗しました', new TypeError('Failed to fetch')))).toBe(true);
  });
});
