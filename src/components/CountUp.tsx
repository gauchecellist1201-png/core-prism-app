// ============================================================
// CountUp — 数値が 0 からスッと立ち上がるカウントアップ表示
//
// 「数字が動く」だけで達成感・期待感が跳ね上がる。フォロワー数やスコアなど、
// ユーザーが一番見たい数字に“命”を吹き込む小さな感動装置。Prism / Iris 共用。
// prefers-reduced-motion を尊重（その場合は即値表示で揺らさない）。
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Props {
  value: number;
  /** 立ち上がり時間 (ms) */
  durationMs?: number;
  /** 表示整形（既定は日本語ロケールの整数） */
  format?: (n: number) => string;
  /** 接頭・接尾辞 */
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
  className?: string;
}

export default function CountUp({
  value, durationMs = 1100, format = (n) => Math.round(n).toLocaleString('ja-JP'),
  prefix = '', suffix = '', style, className,
}: Props) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce || !isFinite(value)) { setDisplay(value); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic — 勢いよく入って優しく着地
      setDisplay(value * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    rafRef.current = requestAnimationFrame(tick);
    // 安全網: rAF が（非表示タブ等で）止まっても必ず最終値に着地させる。
    // 「0 のまま固まって誤った数字を見せる」事故を絶対に作らない。
    const guard = setTimeout(() => setDisplay(value), durationMs + 400);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); clearTimeout(guard); };
  }, [value, durationMs, reduce]);

  return <span className={className} style={style}>{prefix}{format(display)}{suffix}</span>;
}
