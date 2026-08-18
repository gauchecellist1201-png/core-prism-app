// ============================================================
// useFloatAvoid — 隅に固定した浮きボタンを「押せるもの」の上から静かにどける
//
// 使い方: 固定ラッパーに ref を付け、返ってきた lift(px) だけ上へずらす。
//   const ref = useRef<HTMLDivElement>(null);
//   const lift = useFloatAvoid(ref, { enabled: isPhone });
//   <div ref={ref} style={{ transform: `translateY(${-lift}px)` }} />
//
// ルールの中身は `lib/floatAvoid.ts` に書いてある（全プロダクト共通）。
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { inkRects, liftToClear, observeContentChange, scanBands } from '../lib/floatAvoid';

export function useFloatAvoid(
  ref: React.RefObject<HTMLElement | null>,
  opts: { enabled?: boolean } = {},
): number {
  const enabled = opts.enabled ?? true;
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);
  liftRef.current = lift;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') { setLift(0); return; }

    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return; // 出ていない時は測らない
      const bands = scanBands();
      // 自分自身・帯・ほかの浮きボタンは「覆ってはいけないもの」から外す
      const otherFloats: Element[] = [];
      for (const cand of document.querySelectorAll<HTMLElement>('body *')) {
        if (cand === el || el.contains(cand)) continue;
        const s = getComputedStyle(cand);
        if (s.position !== 'fixed') continue;
        const cr = cand.getBoundingClientRect();
        if (cr.width > 8 && cr.width < window.innerWidth * 0.6 && cr.height > 8) otherFloats.push(cand);
      }
      const inks = inkRects([el, ...bands.els, ...otherFloats]);
      const naturalTop = r.top + liftRef.current;
      const next = liftToClear(
        { x: r.left, w: r.width, h: r.height },
        naturalTop,
        inks,
        { minTop: bands.top + 8, currentLift: liftRef.current },
      );
      // 数pxの揺れで動かさない（読んでいる最中のちらつき防止）
      if (Math.abs(next - liftRef.current) >= 4) setLift(next);
    };

    // 中身は少し遅れて確定する（画像・フォント・あとから届く一覧）
    const timers = [160, 800, 2000].map((ms) => window.setTimeout(measure, ms));

    let scrollT: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (scrollT) clearTimeout(scrollT);
      scrollT = setTimeout(measure, 150);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    const stopMo = observeContentChange(measure, () => [ref.current]);

    return () => {
      timers.forEach(clearTimeout);
      if (scrollT) clearTimeout(scrollT);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      stopMo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return enabled ? lift : 0;
}
