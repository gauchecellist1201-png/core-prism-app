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

/** 台帳の色を、薄い下地色に変換する (16 進 → 18% 透過) */
function tint(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.18)`;
}

export function StudioHeaderIcon({ iconKey, fallbackColor, fallbackBg }: Props) {
  const entry = resolveFeatureIcon(iconKey);
  const color = entry?.color || fallbackColor;
  const bg = entry ? tint(entry.color) : fallbackBg;
  const Icon = entry?.Icon;

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: bg, color }}
      aria-hidden="true"
    >
      {Icon ? <Icon size={20} strokeWidth={1.8} /> : null}
    </div>
  );
}

export default StudioHeaderIcon;
