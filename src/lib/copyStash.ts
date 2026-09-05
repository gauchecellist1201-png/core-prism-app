// ============================================================
// copyStash — 「さっきコピーしたもの」を、知識に入れる候補として1タップで出す。
// (Raycast「クリップボード履歴」の移植。BACKLOG「貼り付け履歴から知識化」)
//
// ブラウザは他アプリのコピー履歴を読めない。だから読めるふりはしない —
// ここに溜まるのは「この画面の中でコピーしたもの」だけ。
//
// プライバシーの決め事（ここを緩めない）:
//  ・保存しない。localStorage / sessionStorage / サーバへ一切書かない＝再読み込みで消える
//  ・30分で自動的に落ちる（期限つき）
//  ・鍵らしき文字列（sk- / rk_live_ / Bearer / 秘密鍵 / JWT 等）は最初から取り込まない
//  ・多くても5件。古いものから捨てる
// ============================================================

export interface CopyStashEntry {
  /** 一覧の key 用。中身から作らない（本文を識別子に流用しない） */
  id: string;
  /** コピーされた本文（メモリ内のみ） */
  text: string;
  /** 何をコピーしたか（例「本文」）。分からなければ空 */
  label: string;
  /** コピーした時刻(ms) */
  at: number;
}

/** 同時に持つ最大件数 */
export const COPY_STASH_MAX = 5;
/** これを過ぎたものは候補に出さない（30分） */
export const COPY_STASH_TTL_MS = 30 * 60 * 1000;
/** 長すぎるコピーは頭だけ持つ（メモリを食わない） */
export const COPY_STASH_MAX_TEXT = 2000;
/** 1文字のコピーは候補にしても選ばれない */
const MIN_TEXT = 2;

/** 鍵・トークンらしき文字列。1つでも当たったら丸ごと取り込まない */
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\b[a-z]k_(live|test)_[A-Za-z0-9]{10,}/,
  /\bAIza[0-9A-Za-z_-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/i,
  /\b(gh[porsu]|github_pat)_[A-Za-z0-9_]{20,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
];

/** 鍵らしく見えるか（見えたら取り込まない側に倒す） */
export function looksSecret(text: string): boolean {
  return SECRET_PATTERNS.some(re => re.test(text));
}

/** 改行を揃え、前後の空白を落とし、長すぎるものは頭だけにする */
export function normalizeCopy(raw: string): string {
  const t = (raw ?? '').replace(/\r\n?/g, '\n').trim();
  return t.length > COPY_STASH_MAX_TEXT ? t.slice(0, COPY_STASH_MAX_TEXT) : t;
}

/**
 * 1件足した新しい配列を返す。
 * 取り込まない時（空・短すぎ・鍵らしい）は **渡された配列をそのまま返す**
 * ＝呼び出し側は同一性で「何も起きなかった」を判定できる。
 */
export function pushEntry(
  list: CopyStashEntry[],
  raw: string,
  label: string,
  at: number,
  id: string,
): CopyStashEntry[] {
  const text = normalizeCopy(raw);
  if (text.length < MIN_TEXT) return list;
  if (looksSecret(text)) return list;
  // 同じ本文は増やさず、先頭へ上げて時刻だけ更新する
  const rest = list.filter(e => e.text !== text);
  return [{ id, text, label: label ?? '', at }, ...rest].slice(0, COPY_STASH_MAX);
}

/** 期限切れを落とす。落とすものが無ければ渡された配列をそのまま返す */
export function pruneEntries(list: CopyStashEntry[], now: number): CopyStashEntry[] {
  const kept = list.filter(e => now - e.at < COPY_STASH_TTL_MS);
  return kept.length === list.length ? list : kept;
}

/** チップに出す1行（改行・連続空白をつぶし、長ければ…で切る） */
export function chipLabel(entry: CopyStashEntry, max = 22): string {
  const one = entry.text.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max) + '…' : one;
}

// ─── ここから実行時の入れ物（メモリのみ・保存しない） ───────────────

let stash: CopyStashEntry[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(fn => { try { fn(); } catch { /* 1人の失敗で他を止めない */ } });
}

/** コピーが成功した時に呼ぶ。取り込まれなかった時は誰にも通知しない */
export function recordCopy(text: string, label = ''): void {
  const now = Date.now();
  const pruned = pruneEntries(stash, now);
  const next = pushEntry(pruned, text, label, now, `cs${now}_${++seq}`);
  if (next === stash) return;
  stash = next;
  emit();
}

/** いま候補に出せるもの（期限切れは除く） */
export function getRecentCopies(now = Date.now()): CopyStashEntry[] {
  stash = pruneEntries(stash, now);
  return stash;
}

/** 変化を受け取る。戻り値を呼ぶと購読をやめる */
export function subscribeCopies(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** 全部忘れる（テスト・「履歴を消す」用） */
export function clearCopies(): void {
  if (stash.length === 0) return;
  stash = [];
  emit();
}

// ─── 画面で選んで ⌘C した分を拾う ───────────────────────────────

function onDocumentCopy() {
  const sel = typeof window !== 'undefined' ? (window.getSelection?.()?.toString() ?? '') : '';
  if (sel) recordCopy(sel, '選んだ文字');
}

let capturing = 0;

/**
 * 選択してコピー（⌘C）した分も拾い始める。戻り値を呼ぶとやめる。
 * 二重に呼ばれても listener は1つだけ（数えて最後の1人が外す）。
 */
export function startCopyCapture(): () => void {
  if (typeof document === 'undefined') return () => {};
  capturing += 1;
  if (capturing === 1) document.addEventListener('copy', onDocumentCopy);
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    capturing -= 1;
    if (capturing === 0) document.removeEventListener('copy', onDocumentCopy);
  };
}
