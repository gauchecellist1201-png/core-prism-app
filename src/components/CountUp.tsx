// ============================================================
// CountUp — 数値が 0 からスッと立ち上がるカウントアップ表示
//
// 「数字が動く」だけで達成感・期待感が跳ね上がる。フォロワー数やスコアなど、
// ユーザーが一番見たい数字に“命”を吹き込む小さな感動装置。Prism / Iris 共用。
// prefers-reduced-motion を尊重（その場合は即値表示で揺らさない）。
// ============================================================
import { useHonestCountUp } from '../hooks/useHonestCountUp';

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
  // 動きを減らす設定・裏タブ・rAF 停止の安全網は useHonestCountUp が持つ。
  // 「0 のまま固まって誤った数字を見せる」事故を絶対に作らない。
  const display = useHonestCountUp(value, { durationMs });

  return <span className={className} style={style}>{prefix}{format(display)}{suffix}</span>;
}
