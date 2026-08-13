// ============================================================
// CORE Iris — 作ったメディアキットを、端末に置いておく
//
// なぜこれが要るか:
//   メディアキットは Iris でいちばん「お金になる」成果物（企業に送る自己紹介
//   資料）なのに、これまでは画面の中だけに置かれていた。別のタブに移った瞬間に
//   消えるので、戻ってきた人には「美しい1枚で書き出す」ボタンごと無くなって
//   見えていた。もう一度作るには AI の待ち時間がまた要る。
//   ここで端末に残し、次に来たときはそのまま送れるようにする。
//
//   併せて「作ったときの素材の指紋」を残す。フォロワー数を増やしたのに
//   古い数字の資料を企業に送ってしまう事故を防ぐため、素材が変わったときだけ
//   「作り直しませんか」と伝えられるようにする（勝手に消さない）。
// ============================================================
import type { MediaKitDoc } from './mediaKitDoc';
import type { MediaKit } from '../types/influencerDeal';

const KEY = 'core_iris_mediakit_doc_v1_'; // suffix: personaId

export interface SavedMediaKitDoc {
  doc: MediaKitDoc;
  /** 作った日時 (ISO) */
  createdAt: string;
  /** 作ったときの素材の指紋（数字などが変わったかを見るため） */
  fingerprint: string;
}

/** localStorage が使える環境なら返す（Safari のプライベート等では null） */
function store(): Storage | null {
  try {
    const s = (globalThis as { localStorage?: Storage }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

/**
 * 生成に使った素材の指紋。
 * 金額（rateCard）も含める。文章そのもの（強み・一緒にできること）を書くときの
 * 材料に金額が渡っているので、金額を直したあとの文章には古い金額が残りうる。
 * 資料の「金額の目安」欄だけが新しくなって、文中は古い、という食い違いを企業に
 * 送らせないため、金額が変わったら作り直しを勧める。
 */
export function mediaKitFingerprint(kit?: MediaKit): string {
  if (!kit) return '';
  const nums = (o?: Record<string, number | undefined>) =>
    Object.entries(o || {})
      .filter(([, v]) => typeof v === 'number' && v > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
  return [
    (kit.handleName || '').trim(),
    nums(kit.followers as Record<string, number | undefined> | undefined),
    nums(kit.avgEngagementRate as Record<string, number | undefined> | undefined),
    kit.monthlyReach && kit.monthlyReach > 0 ? String(kit.monthlyReach) : '',
    (kit.audienceProfile || '').trim(),
    (kit.caseHistory || '').trim(),
    (kit.rateCard || '').trim(),
    (kit.brandValues || '').trim(),
    kit.entity || '',
    (kit.legalName || '').trim(),
  ].join('|');
}

/** 文字列だけを通す（壊れた保存データで画面を壊さない） */
function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** {title, detail} の配列だけを通す */
function items(v: unknown): { title: string; detail: string }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map(x => (x && typeof x === 'object' ? { title: str((x as Record<string, unknown>).title), detail: str((x as Record<string, unknown>).detail) } : null))
    .filter((x): x is { title: string; detail: string } => !!x && (!!x.title || !!x.detail))
    .slice(0, 4);
}

/**
 * 保存データを読む。
 * 中身が空っぽ・形が違うものは null にする＝「前に作った資料」の見た目だけ出して、
 * 押すと白紙の PDF が出る、という壊れ方をさせない。
 */
export function loadMediaKitDoc(personaId: string): SavedMediaKitDoc | null {
  const s = store();
  if (!s) return null;
  let raw: string | null = null;
  try { raw = s.getItem(KEY + personaId); } catch { return null; }
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const o = parsed as Record<string, unknown>;
  const rawDoc = (o.doc && typeof o.doc === 'object' ? o.doc : null) as Record<string, unknown> | null;
  if (!rawDoc) return null;
  const doc: MediaKitDoc = {
    tagline: str(rawDoc.tagline),
    intro: str(rawDoc.intro),
    strengths: items(rawDoc.strengths),
    audience: str(rawDoc.audience),
    whyCollab: str(rawDoc.whyCollab),
    collabFormats: items(rawDoc.collabFormats),
    closing: str(rawDoc.closing),
  };
  // 送れる中身が何も無いなら「作ってある」とは言わない
  const hasBody = !!(doc.intro || doc.whyCollab || doc.strengths.length || doc.collabFormats.length);
  if (!hasBody) return null;
  return {
    doc,
    createdAt: str(o.createdAt),
    fingerprint: str(o.fingerprint),
  };
}

/**
 * 作った資料を端末に置く。書けたかどうかを返す（成功を装わない）。
 */
export function saveMediaKitDoc(personaId: string, doc: MediaKitDoc, kit?: MediaKit, nowIso?: string): SavedMediaKitDoc | null {
  const s = store();
  const saved: SavedMediaKitDoc = {
    doc,
    createdAt: nowIso || new Date().toISOString(),
    fingerprint: mediaKitFingerprint(kit),
  };
  if (!s) return null;
  try {
    s.setItem(KEY + personaId, JSON.stringify(saved));
    return saved;
  } catch {
    return null;
  }
}

/**
 * 指定の時刻より後に作られた資料が、すでに置いてあるか。
 *
 * なぜ要るか: AI の生成には数十秒かかる。作っている途中で別のタブへ移り、
 * 戻ってもう一度作ると、先に始めた古い方が後から返ってきて、新しい方を
 * 上書きしてしまう（ユーザーには「作り直したのに古い文章が出る」と見える）。
 * 返ってきた側が「自分より新しいものが在る」と分かれば、上書きせずに引き下がれる。
 */
export function hasNewerSavedDoc(personaId: string, sinceIso: string): boolean {
  const saved = loadMediaKitDoc(personaId);
  if (!saved || !saved.createdAt) return false;
  const savedAt = Date.parse(saved.createdAt);
  const since = Date.parse(sinceIso);
  if (Number.isNaN(savedAt) || Number.isNaN(since)) return false;
  return savedAt > since;
}

export function clearMediaKitDoc(personaId: string): void {
  const s = store();
  if (!s) return;
  try { s.removeItem(KEY + personaId); } catch { /* */ }
}

/**
 * 保存した資料が、いまのプロフィールより古くなっているか。
 * 指紋が残っていない古い保存データでは false（根拠が無いのに「古い」と言わない）。
 */
export function isMediaKitDocStale(saved: SavedMediaKitDoc | null, kit?: MediaKit): boolean {
  if (!saved || !saved.fingerprint) return false;
  return saved.fingerprint !== mediaKitFingerprint(kit);
}

/** 「8月13日に作りました」。年が変わっていれば年も出す */
export function madeAtLabel(iso: string, now: Date = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === now.getFullYear();
  const head = sameYear ? '' : `${d.getFullYear()}年`;
  return `${head}${d.getMonth() + 1}月${d.getDate()}日に作りました`;
}
