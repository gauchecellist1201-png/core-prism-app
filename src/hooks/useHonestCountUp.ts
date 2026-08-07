// ============================================================
// useHonestCountUp — 数字が「途中の値で固まる」事故を作らないカウントアップ
//
// なぜ要るのか (2026-08-07 実測・姉妹プロダクトで再現):
//   カウントアップは requestAnimationFrame で動く。ところが rAF は
//   「タブが裏に回った」「画面をロックした」「省電力モード」のとき
//   まったく発火しなくなる。すると数字は 0 や途中の値のまま固まり、
//   戻ってきた人には ¥0 / ¥1,200 のような **本当ではない金額** が見える。
//   売上・KPI・取り戻した時間 — Prism がお金を頂いている根拠そのものが
//   嘘になるので、演出より先に「必ず本当の数字に着地する」ことを守る。
//
// この hook が守ること:
//   1. 動きを減らす設定の人には、はじめから最終値を出す (演出しない)
//   2. 画面が裏にある間は演出しない = はじめから最終値を出す
//   3. 演出の途中で裏に回ったら、その場で最終値へ飛ばす (固まらせない)
//   4. rAF が一度も来なくても、時間切れで必ず最終値へ着地する (安全網)
//
// 数字そのものは一切いじらない。出すのが早くなるだけで、
// 出る値は常に呼び出し側が渡した実データのまま。
// ============================================================
import { useEffect, useRef, useState } from 'react';

interface Options {
  /** 立ち上がり時間 (ms) */
  durationMs?: number;
  /**
   * 初回だけ 0 から立ち上げるか。
   * false のときは最初から実値を出し、値が変わったときだけ前の値から動かす。
   */
  startFromZero?: boolean;
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined'
      && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function isHidden(): boolean {
  try {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  } catch {
    return false;
  }
}

export function useHonestCountUp(target: number, options: Options = {}): number {
  const { durationMs = 900, startFromZero = true } = options;
  const safeTarget = Number.isFinite(target) ? target : 0;

  // 初期表示。0 から立ち上げない設定なら最初から実値 (= 一瞬も嘘を出さない)。
  const [value, setValue] = useState(startFromZero ? 0 : safeTarget);
  // いま画面に出ている値。次の演出はここから動かす。
  const fromRef = useRef(startFromZero ? 0 : safeTarget);

  useEffect(() => {
    // 最終値に着地させる。演出をやめる時は必ずここを通す。
    const settle = () => {
      fromRef.current = safeTarget;
      setValue(safeTarget);
    };

    if (safeTarget === fromRef.current) { settle(); return; }
    // 動きを減らす設定 / 画面が裏 → 演出せず即座に本当の数字
    if (prefersReducedMotion() || isHidden()) { settle(); return; }

    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    let finished = false;

    const stop = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      settle();
    };

    const tick = (now: number) => {
      if (finished) return;
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      if (p < 1) {
        setValue(from + (safeTarget - from) * eased);
        raf = requestAnimationFrame(tick);
      } else {
        stop();
      }
    };
    raf = requestAnimationFrame(tick);

    // 安全網: rAF が一度も来なくても、時間切れで必ず本当の数字にする。
    // setTimeout は裏タブでも (間隔は伸びるが) 必ず発火するので、
    // 「0 のまま固まって嘘の金額を見せ続ける」経路がなくなる。
    const guard = window.setTimeout(stop, durationMs + 400);

    // 演出の途中で裏に回ったら、その瞬間に最終値へ。
    // 戻ってきた人が「途中の値」を本当の数字だと思い込む事故を防ぐ。
    const onVisibility = () => { if (isHidden()) stop(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(guard);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [safeTarget, durationMs]);

  return value;
}

export default useHonestCountUp;
