// ============================================================
// InstagramGlyph — Instagram 公式グリフ (角丸スクエア + レンズ + ドット)
//
// 当プロジェクトの lucide-react には Instagram アイコンが含まれないため、
// 公式ロゴと同形状のグリフを SVG で用意し、カメラアイコンの差し替えに使う
// (オーナー指示 2026-06-18)。色・サイズ・線幅は props で調整可能。
// ============================================================
interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export default function InstagramGlyph({ size = 24, color = 'currentColor', strokeWidth = 2, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
