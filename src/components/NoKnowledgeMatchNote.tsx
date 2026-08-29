// ============================================================
// NoKnowledgeMatchNote — 「この質問に当てはまる資料が無かった」を答えの上に一行だけ出す。
// 3つのチャット画面（右サイド AISidebar / 下部 BottomChatDock / モバイル・チャット専用ホーム）
// で同じ文言・同じ見た目にするため、1つの部品にまとめている。
// 判定そのものは lib/knowledgeCoverage.ts（計算だけ）。ここは描くだけ。
// ============================================================
import { NO_KNOWLEDGE_MATCH_TEXT, NO_KNOWLEDGE_MATCH_CTA } from '../lib/knowledgeCoverage';

interface Props {
  /** 人格のアクセント色。「資料を入れる」だけに使う（注記本体は色で驚かせない）。 */
  accent: string;
  /** 押すとナレッジ画面へ。行き止まりにしないための1タップ。 */
  onOpenKnowledge: () => void;
  /** 注記本体の文字色。既定はテーマの補助色。暗い吹き出しの中では白系を渡す。 */
  textColor?: string;
  /** 区切り線の色。吹き出しの地に合わせて渡す。 */
  hairline?: string;
}

export default function NoKnowledgeMatchNote({
  accent,
  onOpenKnowledge,
  textColor = 'var(--fg-muted)',
  hairline = 'rgba(255,255,255,0.12)',
}: Props) {
  return (
    <div
      style={{
        marginBottom: 8,
        paddingBottom: 8,
        borderBottom: `1px dashed ${hairline}`,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      <span style={{ color: textColor }}>{NO_KNOWLEDGE_MATCH_TEXT}</span>
      <button
        type="button"
        onClick={onOpenKnowledge}
        style={{
          fontSize: 11,
          padding: '5px 9px',
          minHeight: 28,
          borderRadius: 7,
          background: `${accent}22`,
          color: accent,
          border: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {NO_KNOWLEDGE_MATCH_CTA}
      </button>
    </div>
  );
}
