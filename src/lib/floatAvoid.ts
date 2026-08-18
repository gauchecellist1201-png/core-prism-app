// ============================================================
// floatAvoid — 浮いているボタンが「押せるもの・読むもの」の上に乗らないための共通ルール
//
// 【なぜ要るか】(2026-08-18 本番 iPhone 13/390px 実測)
//  Iris「動画おまかせ」で、右下の丸ボタン「AI と話す」(92x118) が
//  カードの主ボタン「任せる →」を 2,778px^2 ぶん覆っていた。
//  見えているのに押すと別のものが開く＝いちばん質の悪い壊れ方。
//  同じ画面で、左の切替オーブ(52x52)は見出し「クリエイティブ司令塔」を
//  1,054px^2 覆っていた（タブを切り替えても置き場所を測り直さないため）。
//
// 【決めたルール（全プロダクト共通）】
//  1. 浮きボタンは **押せるもの（ボタン・リンク・入力欄）の上には絶対に置かない**。
//     文字の上は「なるべく」避ける（画面が文字で埋まっていても破綻させないため）。
//  2. 逃げ道は **同じ側の縦の道だけ**。左右に飛ばすと、指が覚えた場所が変わる。
//  3. **中身が入れ替わったら測り直す**（タブ切替はスクロールもリサイズも起きない）。
//  4. いま何も覆っていなければ **動かさない**（読んでいる最中に飛び回らせない）。
//
// 測るのは要素の箱ではなく「文字が実際に描かれている行の箱」。
// 要素の箱で数えるとカードの余白まで“埋まっている”ことになり、
// 空きゼロ＝画面の一番上へ逃げてしまう（CoreDock 2026-08-01 の知見）。
// ============================================================

/** 重すぎる画面でも固まらせないための走査上限 */
const INK_LIMIT = 1500;
const BAND_SCAN_LIMIT = 4000;

export type InkRect = {
  r: DOMRect;
  /** 押せるもの＝true。ここは絶対に覆わない */
  control: boolean;
};

/**
 * 画面の上下に貼り付いている「帯」(ヘッダー・下部ドック等) を実測する。
 * クラス名で探してはいけない: 目印のクラスが無いバーがある(Prism 実測)。
 * 見た目の条件(画面幅いっぱい・固定/追従・上か下の 1/4 に居る)だけで判定する。
 */
export function scanBands(): { top: number; bottom: number; els: HTMLElement[] } {
  const out = { top: 0, bottom: 0, els: [] as HTMLElement[] };
  if (typeof document === 'undefined') return out;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const all = document.body.querySelectorAll<HTMLElement>('*');
  const n = Math.min(all.length, BAND_SCAN_LIMIT);
  for (let i = 0; i < n; i++) {
    const el = all[i];
    const s = getComputedStyle(el);
    if (s.position !== 'fixed' && s.position !== 'sticky') continue;
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
    // 飾り(背景グラデ等)は「奥に置かれている」ことで見分ける
    if (Number(s.zIndex) < 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.6 || r.height < 24 || r.height > vh * 0.5) continue;
    if (r.top < vh * 0.25 && r.bottom > 0) { out.top = Math.max(out.top, r.bottom); out.els.push(el); }
    else if (r.bottom > vh * 0.75 && r.top < vh) { out.bottom = Math.max(out.bottom, vh - r.top); out.els.push(el); }
  }
  out.top = Math.max(0, Math.round(out.top));
  out.bottom = Math.max(0, Math.round(out.bottom));
  return out;
}

/**
 * 画面に出ている「文字の行」と「押せるもの」の箱を集める。
 * excludes の中身(自分自身・ほかの浮きボタン・上下の帯)は数えない。
 */
export function inkRects(excludes: (Element | null | undefined)[]): InkRect[] {
  const out: InkRect[] = [];
  if (typeof document === 'undefined') return out;
  const vh = window.innerHeight;
  const ex = excludes.filter(Boolean) as Element[];
  const skip = (el: Element | null) => !el || ex.some((e) => e === el || e.contains(el));
  const inView = (r: DOMRect) => r.bottom > 0 && r.top < vh;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n && out.length < INK_LIMIT; n = walker.nextNode()) {
    if (!(n.textContent ?? '').trim()) continue;
    const parent = (n as Text).parentElement;
    if (skip(parent)) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width > 2 && r.height > 2 && inView(r)) out.push({ r, control: false });
    }
  }
  for (const el of document.querySelectorAll('a,button,input,textarea,select,[role="button"]')) {
    if (out.length >= INK_LIMIT) break;
    if (skip(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 8 && r.height > 8 && inView(r)) out.push({ r, control: true });
  }
  return out;
}

/** 押せるものは 1px でも覆ったら失格にするための重み(実質の禁止) */
const CONTROL_WEIGHT = 10000;
const TEXT_WEIGHT = 1;

/** box が inks をどれだけ覆っているか。押せるものは桁違いに重い */
export function coverCost(
  box: { x: number; y: number; w: number; h: number },
  inks: InkRect[],
): number {
  let total = 0;
  for (const { r, control } of inks) {
    const ow = Math.min(r.right, box.x + box.w) - Math.max(r.left, box.x);
    const oh = Math.min(r.bottom, box.y + box.h) - Math.max(r.top, box.y);
    if (ow > 0 && oh > 0) total += ow * oh * (control ? CONTROL_WEIGHT : TEXT_WEIGHT);
  }
  return total;
}

/**
 * 画面の隅に固定された浮きボタンを「同じ縦の道」で持ち上げる量(px)を決める。
 *
 * @param naturalTop 何も持ち上げていない時の上端 y
 * @returns 持ち上げる px（0＝そのまま）
 */
export function liftToClear(
  box: { x: number; w: number; h: number },
  naturalTop: number,
  inks: InkRect[],
  opts: { minTop: number; currentLift: number; step?: number },
): number {
  const step = opts.step ?? 8;
  const maxLift = Math.max(0, naturalTop - opts.minTop);
  if (!inks.length) return opts.currentLift; // まだ描画されていない＝判断材料が無い

  const at = (lift: number) => coverCost({ x: box.x, y: naturalTop - lift, w: box.w, h: box.h }, inks);

  // いまの場所が何も覆っていなければ動かさない
  const currentCost = at(opts.currentLift);
  if (currentCost === 0) return opts.currentLift;

  let best = { lift: opts.currentLift, cost: currentCost };
  for (let lift = 0; lift <= maxLift; lift += step) {
    const c = at(lift);
    if (c === 0) return lift; // 何も覆わない場所が見つかった＝いちばん下を採る
    if (c < best.cost) best = { lift, cost: c };
  }
  return best.lift;
}

/**
 * 「中身が入れ替わった」を拾う。タブ切替はスクロールもリサイズも起きないので、
 * MutationObserver が無いと古い画面に合わせた置き場所のまま居座る(実測)。
 * 浮きボタン自身の動きで再発火しないよう、除外した枝の変化は無視する。
 */
export function observeContentChange(
  cb: () => void,
  excludes: () => (Element | null | undefined)[],
  delay = 320,
): () => void {
  if (typeof MutationObserver === 'undefined') return () => { };
  let t: ReturnType<typeof setTimeout> | null = null;
  const mo = new MutationObserver((records) => {
    const ex = excludes().filter(Boolean) as Element[];
    const relevant = records.some((rec) => {
      const target = rec.target as Node;
      const el = target.nodeType === 1 ? (target as Element) : target.parentElement;
      return !!el && !ex.some((e) => e === el || e.contains(el));
    });
    if (!relevant) return;
    if (t) clearTimeout(t);
    t = setTimeout(cb, delay);
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => { if (t) clearTimeout(t); mo.disconnect(); };
}
