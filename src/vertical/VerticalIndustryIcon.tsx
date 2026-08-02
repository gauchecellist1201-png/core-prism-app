// ============================================================
// VerticalIndustryIcon.tsx — 業種がひと目で分かる線画アイコン
//
// なぜ作ったか（2026-08-02 オーナー指摘）:
//   「アルティマとかソマとか、どの業界なのか分かりづらい。建築関係の人はこれ、
//     みたいに業種で分けているのが視覚的に分かりやすいようにしてほしい」
//   ブランドロゴ（UltimaLogo 等）は"そのサービスの顔"であって"業種の看板"ではない。
//   ロゴだけでは業種が読み取れないので、業種そのものを描いたアイコンを別に持つ。
//
// 描き分け:
//   construction … ヘルメット（建設・電気設備）
//   anime        … フィルムのコマ（アニメ制作）
//   ads          … 右肩上がりの棒グラフ（広告・マーケ）
//   forestry     … 針葉樹（林業）
//   travel       … スーツケース（総務・経理・出張管理）
//
// 方針: currentColor で描くので、置いた場所の色をそのまま使う。
//       線は 1.6px 固定（小さくしても潰れない太さ）。塗りは使わない。
// ============================================================
import type { VerticalProduct } from './verticalData';

export type IndustryIconKind = VerticalProduct['industryIcon'];

export function VerticalIndustryIcon({
  kind,
  size = 20,
}: {
  kind: IndustryIconKind;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (kind === 'construction') {
    // ヘルメット — 建設・電気設備工事
    return (
      <svg {...common}>
        <path d="M3 17a9 9 0 0 1 18 0" />
        <path d="M2 17h20" />
        <path d="M9.5 8.2V4.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3.6" />
        <path d="M12 3.6V2" />
      </svg>
    );
  }

  if (kind === 'anime') {
    // フィルムのコマ — アニメ制作
    return (
      <svg {...common}>
        <rect x="2.6" y="4.6" width="18.8" height="14.8" rx="2.2" />
        <path d="M7.4 4.6v14.8M16.6 4.6v14.8" />
        <path d="M2.6 12h18.8" />
        <path d="M4.9 8.3h.6M4.9 15.7h.6M18.5 8.3h.6M18.5 15.7h.6" />
      </svg>
    );
  }

  if (kind === 'ads') {
    // 右肩上がりの棒グラフ＋伸びる矢印 — 広告・マーケティング
    return (
      <svg {...common}>
        <path d="M3 20.4h18" />
        <path d="M6.2 20.4v-4.6M10.7 20.4v-7.4M15.2 20.4v-3.4M19.7 20.4v-9.8" />
        <path d="M5 9.4l4.6-4 3.6 3.1 5.6-5.2" />
        <path d="M15.4 3.3h3.4v3.3" />
      </svg>
    );
  }

  if (kind === 'forestry') {
    // 針葉樹 — 林業
    return (
      <svg {...common}>
        <path d="M12 2.6 7.4 9.1h2.4L5.9 14.4h3.1L5.2 19.4h13.6l-3.8-5h3.1l-3.9-5.3h2.4z" />
        <path d="M12 19.4v2" />
      </svg>
    );
  }

  // travel — スーツケース（総務・経理・出張管理）
  return (
    <svg {...common}>
      <rect x="4.2" y="7.8" width="15.6" height="12.6" rx="2" />
      <path d="M9 7.8V5.6a1.4 1.4 0 0 1 1.4-1.4h3.2a1.4 1.4 0 0 1 1.4 1.4v2.2" />
      <path d="M4.2 12.6h15.6" />
      <path d="M11.3 12.6v1.8" />
    </svg>
  );
}
