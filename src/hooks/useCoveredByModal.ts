// ============================================================
// useCoveredByModal — 「全画面のモーダルが出ている間だけ引っ込む」浮遊ボタン用の判定
//
// もともと CoreDock(2026-07-29) にあった仕組みを、同じ画面に浮いている他の
// 常駐ボタン(Prism のマイクFAB 等)でも使えるように切り出したもの。
//
// なぜ必要か: 初回オンボーディングのような fixed inset-0 のモーダルより
// 浮遊ボタンの z-index が上だと、新規ユーザーが最初に見る画面でカードの文字や
// ボタンに被る・オンボ中に押せてしまう。クラス名に頼らず“見た目の条件”
// (fixed / 素通しでない / z>=50 / 画面をほぼ覆う) で判定するので、
// どのモーダル実装でも効く。
//
// ⚠️実装上の鉄則(2026-07-29 に自分で起こした事故の教訓):
//   点検の間引きは「先送り(デバウンス)」にしてはいけない。Prism は件数の更新や
//   アニメーションで画面が絶えず動くため、毎回 clearTimeout する書き方だと
//   MutationObserver が点検を永久に先送りし、一度隠れたボタンが二度と戻らない。
//   ＝隠す条件より先に「戻す経路が絶対に飢えない」ことを保証する。
// ============================================================
import { useEffect, useState, type RefObject } from "react";

/** 画面中央の要素スタックだけを見て、全画面モーダルに覆われているか判定する(軽い) */
export function isCoveredByModal(self: HTMLElement | null): boolean {
  if (typeof document === "undefined") return false;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const stack = document.elementsFromPoint(Math.round(vw / 2), Math.round(vh / 2)) as HTMLElement[];
  for (const el of stack) {
    if (!el || el === self || (self && el.contains(self))) continue;
    const s = getComputedStyle(el);
    if (s.position !== "fixed") continue;
    if (s.pointerEvents === "none") continue; // 飾り(背景グラデ等)は素通しなので対象外
    const z = Number(s.zIndex);
    if (!Number.isFinite(z) || z < 50) continue; // アプリの土台(z無し/低い)は隠す理由にしない
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.9 || r.height < vh * 0.8) continue; // 画面をほぼ覆うものだけ=モーダル
    return true;
  }
  return false;
}

/** 対象要素が全画面モーダルに覆われている間 true。閉じれば自動で false に戻る。 */
export function useCoveredByModal(ref: RefObject<HTMLElement | null>): boolean {
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    let t: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    const check = () => {
      last = Date.now();
      setCovered(isCoveredByModal(ref.current));
    };
    // 予約済みなら何もしない・必ず 200ms 以内に1回は走る「間引き」(先送りにしない)
    const schedule = () => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        check();
      }, Math.max(0, 200 - (Date.now() - last)));
    };
    check();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      if (t) clearTimeout(t);
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return covered;
}
