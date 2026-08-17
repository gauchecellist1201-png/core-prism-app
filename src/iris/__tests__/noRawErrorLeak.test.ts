// ============================================================
// Iris の画面が「英語の原文」を人に見せていないかを見張るテスト (2026-08-18)
//
// なぜ 1 件ずつではなく grep なのか:
//   直したのは 30 か所以上あり、どれも書き方は同じ `setErr(e.message)` だった。
//   1 か所ずつテストを書いても、次に足された 31 か所目は素通りする。
//   「この書き方をしたら落ちる」を固定するほうが、この失敗の種類には効く。
//
// 落ちたときの直し方:
//   ・AI の失敗            → humanizeAiError(e)
//   ・保存/読込/共有の失敗  → humanizeNonAiError(e, '〇〇できませんでした。…')
//   ・頭に一言つけたい     → aiFailureWithReason('〇〇できませんでした', e)
//   ・開発者向けに原文を残したいだけ → console.warn(e) は許可されている
// ============================================================
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const IRIS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 例外オブジェクトや API の返事の .message を直接読んでいる書き方 */
const RAW_MESSAGE = /\b(e|err|errJson|error|ex|error2)\??\.(error\??\.)?(message|userMessage)\b/;

/**
 * 通してよい行:
 *   ・やさしい言葉に直す関数を通している
 *   ・console にだけ出している / 説明のコメント
 *   ・`userMessage` = サーバーが人向けに書いた日本語なので、そのまま出してよい
 *   ・原文を「判定」にだけ使っている行 (印を付けたものだけ許す)
 */
const ALLOWED =
  /humanizeAiError|humanizeNonAiError|aiFailureWithReason|aiErrorMessage|console\.|^\s*(\/\/|\*)|userMessage|原文は判定にだけ使う/;

function irisSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // 画面 (.tsx) だけでなく、画面に文字を渡す側 (.ts) も見る。
      // 2026-08-18 に .tsx だけ直して本番相当のビルドを実測したら、
      // instagramConnect.ts が返した "Failed to fetch" がまだ画面に出ていた。
      else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(full);
    }
  };
  walk(IRIS_DIR);
  return out;
}

describe('Iris の画面は AI/端末の失敗の原文を人に見せない', () => {
  const files = irisSourceFiles();

  it('画面のファイルを実際に読めている (テストが空振りしていない)', () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it('`e.message` をそのまま画面に出している行が 1 つも無い', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (!RAW_MESSAGE.test(line)) return;
        if (ALLOWED.test(line)) return;
        // 「原文は判定にだけ使う」の印は直前の行にあってもよい
        if (/原文は判定にだけ使う/.test(lines[i - 1] ?? '')) return;
        offenders.push(`${file.slice(IRIS_DIR.length + 1)}:${i + 1}  ${line.trim()}`);
      });
    }
    expect(offenders, `英語の原文が人に見えるおそれのある書き方:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('「エラー」という言葉を画面の文言にそのまま使っていない', () => {
    // 「AIエラー: 404」のような、読んでも何をすればいいか分からない出し方を禁じる
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/['"`][^'"`]*エラー\s*[::]\s*\$?\{?/.test(line) && !ALLOWED.test(line)) {
          offenders.push(`${file.slice(IRIS_DIR.length + 1)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offenders, `番号や原文をそのまま見せている疑いのある文言:\n${offenders.join('\n')}`).toEqual([]);
  });
});
