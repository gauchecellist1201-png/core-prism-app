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
/**
 * 帯(ヘッダー・下部ドック)として数えてよい要素か。
 *
 * ★2026-09-04 根治: これまで「飾りかどうか」は **z-index が負かどうか**だけで
 *   見分けていた。ところが Iris ホームには **z-index: 0 / pointer-events: none の
 *   320x320 のぼかし玉**(背景の光)が `position: fixed` で置かれており、
 *   画面幅の 60% を超え・高さも 24〜画面の半分に収まるため、
 *   **下部バーとして数えられていた**(実測 375x812: bottom=400px)。
 *   結果、丸ボタンの可動域が y=131..338 の 207px しか残らず、
 *   **画面いっぱいの入力欄(x39..335)を避けられる場所が1つも無くなり**、
 *   「いちばんマシな場所」として入力欄の角に 373px^2 乗ったまま動けなくなっていた。
 *   (＝費用0の場所が無いのは探索が狭いからではなく、可動域を飾りに奪われていたから)
 *
 * pointer-events:none で弾いてはいけない(Prism の下部バーは外枠が none・
 * 中身だけ auto という作りで、それで弾くとバーを見失う 実測2026-07-27)ので、
 * **中身を持っているか**で見分ける: 文字・押せるもの・絵のどれも無い箱は飾り。
 * 実装は DOM に依存しない形(textContent / querySelector を持つものなら何でも)に
 * してあるので、画面なしで固定できる。
 */
export const BAND_CONTENT_SELECTOR =
  'a,button,input,textarea,select,[role="button"],img,video,canvas,svg';

export function bandHasContent(el: {
  textContent?: string | null;
  querySelector?: (selector: string) => unknown;
}): boolean {
  if ((el.textContent ?? '').trim()) return true;
  if (typeof el.querySelector === 'function' && el.querySelector(BAND_CONTENT_SELECTOR)) return true;
  return false;
}

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
    // 中身の無い箱は飾り(背景の光・ぼかし玉)＝帯として数えない。詳細は bandHasContent。
    if (!bandHasContent(el)) continue;
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
  // ★2026-09-03 根治: これまで「文字」と「押せるもの」しか数えていなかったので、
  //   **絵そのものが中身**であるもの(サムネ・写真)は覆っても費用ゼロ＝丸ボタンが
  //   平気で乗り、しかも「何も覆っていないから動かない」ので永久にどかなかった。
  //   実測(375px・保存済みリール3本を実注入): Iris「作ったリールの棚」の1枚目の
  //   サムネ(44x60)を切替オーブ(52x52)が最大 939px^2 覆い、可視 64% まで欠けた。
  //   棚のサムネは「どのリールか」を見分ける唯一の手がかりなので、隠れると棚の目的が消える。
  //   文字と同じ重みで数える(押せるものより桁違いに軽い)＝逃げ場が無い画面で
  //   「絵を避けるためにボタンの上に乗る」は起こさない。
  for (const el of document.querySelectorAll('img,video,canvas')) {
    if (out.length >= INK_LIMIT) break;
    if (skip(el)) continue;
    const r = el.getBoundingClientRect();
    if (inView(r) && countsAsMedia(r, { w: window.innerWidth, h: vh })) out.push({ r, control: false });
  }
  return out;
}

/**
 * 背景・全面の飾りは「中身」として数えないための上限(画面に対する面積比)。
 * これを超える絵は避けようがない(どこへ逃げても乗る)ので、数えると
 * 丸ボタンを画面の隅へ無意味に追いやるだけになる。
 */
export const MEDIA_MAX_VIEWPORT_RATIO = 0.25;

/**
 * その絵を「読むもの」として数えるか。
 * DOM を触らない純粋な判定なので、画面なしで固定できる。
 */
export function countsAsMedia(
  r: { width: number; height: number },
  viewport: { w: number; h: number },
): boolean {
  if (!(r.width > 8 && r.height > 8)) return false;
  const vpArea = viewport.w * viewport.h;
  if (!(vpArea > 0)) return false;
  return r.width * r.height <= vpArea * MEDIA_MAX_VIEWPORT_RATIO;
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
 * ★2026-09-05 根治: 浮きボタンが **もう1つの浮きボタンに乗られた時** だけ起きられない。
 *
 * 実測(Iris「動画おまかせ」): 右下の「アイリス と話す」FAB(80x80) は自分の避け計算で
 * 上へ移動し、左下の切替オーブ(52x52)の上に来る。オーブ側は FAB を
 * 「押せるもの」として数えているので、測り直しさえすれば費用0の場所へ逃げる
 * (実際、**もう一度スクロールした瞬間に重なり 2,100px^2 → 0px^2 になる**)。
 * つまり「逃げ場が無い」のではなく **起こされていない**。
 * 原因は下の MutationObserver が childList / characterData しか見ておらず、
 * **FAB が inline style で動くのは attributes の変化なので 1 件も届かない**こと。
 *
 * ただし `attributes: true` をそのまま足すと、このリポジトリが何度も踏んでいる
 * 「読んでいる最中に飛び回る」に直結する。守りを 2 枚かけてある:
 *
 *  ①**拾う属性を絞る**: `style` / `class` の変化で、かつ **その要素が
 *    `position: fixed`** の時だけ「浮きボタンが動いた」と見なす
 *    (`isFloatMove`)。本文のアニメーションや React の className 付け替えでは起きない。
 *  ②**回数で必ず止まる**: 2 秒に 3 回を超えて属性で起こされたら、
 *    **その観測の間はもう属性では起こさない**(`allowAttrWake` が false を返し続ける)。
 *    浮きボタン同士が起こし合う形になっても、**必ず有限回で止まる**
 *    (止まった後は 2026-09-04 以前と同じ挙動＝安全側)。正しく使う分には
 *    1〜2 回で収まるので、この上限に当たること自体が異常の合図。
 */
export const FLOAT_MOVE_ATTRS = ['style', 'class'];

/** その属性変化を「浮きボタンが動いた」として拾うか。DOM に依存しない純粋な判定。 */
export function isFloatMove(attr: string | null | undefined, position: string): boolean {
  if (!attr || !FLOAT_MOVE_ATTRS.includes(attr)) return false;
  return position === 'fixed';
}

/** 属性で起こしてよい回数(この窓の中で) */
export const ATTR_WAKE_LIMIT = 3;
export const ATTR_WAKE_WINDOW_MS = 2000;

export type AttrWakeBudget = { hits: number[]; off: boolean };

export function createAttrWakeBudget(): AttrWakeBudget {
  return { hits: [], off: false };
}

/**
 * 属性の変化で測り直してよいか。上限を超えたら **二度と true を返さない**
 * (＝浮きボタン同士の起こし合いは必ず有限回で止まる)。
 */
export function allowAttrWake(
  b: AttrWakeBudget,
  now: number,
  limit = ATTR_WAKE_LIMIT,
  windowMs = ATTR_WAKE_WINDOW_MS,
): boolean {
  if (b.off) return false;
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) { b.off = true; b.hits = []; return false; }
  b.hits.push(now);
  return true;
}

/** 1回の通知で getComputedStyle を撃つ上限(重い画面で固まらせない) */
const ATTR_INSPECT_LIMIT = 30;

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
  const budget = createAttrWakeBudget();
  const mo = new MutationObserver((records) => {
    const ex = excludes().filter(Boolean) as Element[];
    const outside = (el: Element | null) => !!el && !ex.some((e) => e === el || e.contains(el));
    let structural = false;
    let floatMoved = false;
    let inspected = 0;
    for (const rec of records) {
      const target = rec.target as Node;
      const el = target.nodeType === 1 ? (target as Element) : target.parentElement;
      if (!outside(el)) continue;
      if (rec.type !== 'attributes') { structural = true; break; }
      if (floatMoved || inspected >= ATTR_INSPECT_LIMIT) continue;
      inspected++;
      if (isFloatMove(rec.attributeName, getComputedStyle(el as Element).position)) floatMoved = true;
    }
    if (!structural) {
      // 属性だけの変化＝浮きボタンが動いた時だけ、しかも有限回だけ起こす
      if (!floatMoved) return;
      if (!allowAttrWake(budget, Date.now())) return;
    }
    if (t) clearTimeout(t);
    t = setTimeout(cb, delay);
  });
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: FLOAT_MOVE_ATTRS,
  });
  return () => { if (t) clearTimeout(t); mo.disconnect(); };
}
