// ============================================================
// StudioHeaderIcon — 画面いちばん上の見出し横にある 40px の四角いアイコン。
//
// これまで各スタジオが header に絵文字を直書きしていた (請求書 🧾 / 経費 📷)。
// そのため「青い請求書タイルを押したのに、開いた画面の上は人格の色 + 別の絵」
// という食い違いが残っていた。
//
// ここで featureIcons の台帳から 絵 + 色 を引くので、
//   機能タイル → 画面の見出し → 3秒説明 (StudioIntro)
// の 3 か所が必ず同じ絵・同じ色になる。
// ============================================================
import { resolveFeatureIcon } from '../lib/featureIcons';

interface Props {
  /** featureIcons の機能 ID (例: 'invoice' / 'expense') */
  iconKey: string;
  /** 台帳に無かった時に使う色。ふつうは persona.accentColor */
  fallbackColor: string;
  /** 台帳に無かった時の下地色。ふつうは persona.accentColorLight */
  fallbackBg: string;
}

export function StudioHeaderIcon({ iconKey, fallbackColor, fallbackBg }: Props) {
  const entry = resolveFeatureIcon(iconKey);
  const Icon = entry?.Icon;

  // 台帳に無い時だけ、これまで通り人格の色で出す (見た目の後退なし)
  if (!Icon) {
    return (
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: fallbackBg, color: fallbackColor }}
        aria-hidden="true"
      />
    );
  }

  // QuickActions のタイルと "まったく同じ" 描き方にする:
  //   濃い台帳色のベタ塗り + 白いアイコン。
  // 薄い色を敷いて同色のアイコンを載せると、明るいテーマで
  // コントラストが 1.4:1 まで落ちて見えなくなる (文字コントラストの恒久ルール)。
  // 台帳の色はもともと「白いアイコンを載せる前提の濃さ」で選んである。
  const color = entry.color;
  return (
    <div
      className="w-10 h-10 rounded-xl inline-flex items-center justify-center flex-shrink-0"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        boxShadow: `0 6px 14px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
      aria-hidden="true"
    >
      <Icon size={20} color="#fff" strokeWidth={2.2} />
    </div>
  );
}

export default StudioHeaderIcon;
