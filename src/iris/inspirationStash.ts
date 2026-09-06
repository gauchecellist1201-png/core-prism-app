// ============================================================
// CORE Iris — 「これみたいなのを作りたい」を、置いておける場所
//
// なぜこれが要るか:
//   Iris の入口 (IrisThoughtDrop) は、投げた瞬間に AI が 3 プラットフォーム分を
//   書き上げる一発勝負しかない。「まだ考えていないけど、これは覚えておきたい」を
//   置く場所が無いので、夜中に見つけた参考は朝には消えている。
//   ここは AI を一切呼ばない・往復ゼロの「あとで」だけの棚。
//
// 守っていること:
//   ・持つのは **自分が書いたひとことと URL だけ**。他人の投稿の中身は取り込まない
//     (取り込む口を作らない = fetch しない・本文を保存しない。ひとことは 140 字で
//      止める＝人のキャプションを丸ごと貼り付ける器にしない)
//   ・URL は http/https だけ。リンクとして描くので javascript: 等は捨てる
//   ・保存先は 1 キーだけ。新しい保存先を増やさない
//   ・件数バッジや未処理数は出さない (宿題に変わった瞬間に開かなくなる) ため、
//     ここでは「数を見せるための関数」を用意しない
// ============================================================

const KEY = 'core_iris_inspiration_v1';

/** 自分のひとことの上限。人のキャプションを丸ごと貼り付ける器にしないための蓋 */
export const INSPIRATION_NOTE_MAX = 140;
/** 棚に残す上限 (古いものから落ちる) */
export const INSPIRATION_MAX = 30;

export interface InspirationItem {
  id: string;
  /** 自分が書いたひとこと (最大 140 字。空でも URL だけなら置ける) */
  note: string;
  /** 参考先の URL (自分が貼ったもの。中身は取り込まない) */
  url?: string;
  /** 置いた日時 (ISO) */
  createdAt: string;
}

/** localStorage が使える環境なら返す (Safari のプライベート等では null) */
function store(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

function uid(): string {
  return 'i_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

/** リンクとして描いてよい URL だけ通す (http/https 以外は捨てる) */
export function safeUrl(raw: string): string | undefined {
  const t = (raw || '').trim();
  if (!t) return undefined;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/**
 * 打った文から「自分のひとこと」と「URL」を分ける。
 * URL は最初の 1 つだけを拾い、残りをひとことにする
 * (「これ好き https://... 」も「https://... これ好き」も同じ形に落ちる)。
 */
export function splitNoteAndUrl(raw: string): { note: string; url?: string } {
  const text = String(raw ?? '');
  let url: string | undefined;
  const rest = text.replace(/https?:\/\/\S+/g, (m) => {
    if (url) return m;           // 2 つ目以降はひとことの一部として残す
    const safe = safeUrl(m);
    if (!safe) return m;
    url = safe;
    return ' ';
  });
  const note = rest.replace(/\s+/g, ' ').trim().slice(0, INSPIRATION_NOTE_MAX);
  return url ? { note, url } : { note };
}

/** 壊れた保存データで嘘の在庫を見せない。形の合う物だけ通す */
function sanitize(list: unknown): InspirationItem[] {
  if (!Array.isArray(list)) return [];
  const out: InspirationItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const note = typeof o.note === 'string' ? o.note.slice(0, INSPIRATION_NOTE_MAX) : '';
    const url = typeof o.url === 'string' ? safeUrl(o.url) : undefined;
    if (!note && !url) continue;          // 中身が無い物は在庫にしない
    const id = typeof o.id === 'string' && o.id ? o.id : uid();
    const createdAt = typeof o.createdAt === 'string' && o.createdAt ? o.createdAt : new Date(0).toISOString();
    out.push(url ? { id, note, url, createdAt } : { id, note, createdAt });
  }
  return out.slice(0, INSPIRATION_MAX);
}

/** 置いてあるものを新しい順で返す */
export function loadInspirations(): InspirationItem[] {
  const s = store();
  if (!s) return [];
  try {
    const raw = s.getItem(KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveInspirations(list: InspirationItem[]): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify(list.slice(0, INSPIRATION_MAX)));
  } catch {
    /* quota / private mode — 置けなくても入力は止めない */
  }
}

/**
 * 打った文をそのまま置く。AI は呼ばない。
 * 何も置けなかった時 (空欄) は null を返す＝呼び手が「置きました」と嘘をつかずに済む。
 * 同じひとこと＋同じ URL が既にある時は増やさない (棚が同じ物で埋まらない)。
 */
export function addInspiration(raw: string, now: Date = new Date()): InspirationItem[] | null {
  const { note, url } = splitNoteAndUrl(raw);
  if (!note && !url) return null;
  const list = loadInspirations();
  const same = list.some((it) => it.note === note && (it.url || '') === (url || ''));
  if (same) return null;
  const item: InspirationItem = url
    ? { id: uid(), note, url, createdAt: now.toISOString() }
    : { id: uid(), note, createdAt: now.toISOString() };
  const next = [item, ...list].slice(0, INSPIRATION_MAX);
  saveInspirations(next);
  return next;
}

/** 1 件だけ捨てる (棚から出す道が無いと、置くのが怖くなる) */
export function removeInspiration(id: string): InspirationItem[] {
  const next = loadInspirations().filter((it) => it.id !== id);
  saveInspirations(next);
  return next;
}

/** 台本の下敷きとして AI に渡す文。URL は渡さない (テーマに URL を混ぜても意味が無い) */
export function inspirationSeed(item: InspirationItem): string {
  return item.note.trim();
}

/** 一覧に出す見出し。ひとことが無い時は URL のドメインで代わりを立てる */
export function inspirationLabel(item: InspirationItem): string {
  const note = item.note.trim();
  if (note) return note;
  if (item.url) {
    try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return item.url; }
  }
  return '';
}

/** 置いた日 (今日 / 昨日 / 9月2日)。now を渡せるのは、日付をまたぐ判定を実測で固定するため */
export function savedAtLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dayOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayOf(now) - dayOf(d)) / 86400000);
  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
