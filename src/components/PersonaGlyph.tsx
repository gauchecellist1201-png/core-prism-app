// ============================================================
// PersonaGlyph — ペルソナ アイコンを「OS絵文字」ではなく
// ブランド配色のライン系アイコン(Lucide)で描く共通コンポーネント。
//
// オーナー恒久ルール: LP/UI に OS 標準カラー絵文字を出さない。
//   personaPresets.ts の icon は 役割コード (CxoRole: 'CEO' / 'CSO' ...) を持つ。
//   ここで CXO_META[role].Icon (Crown / Briefcase / Megaphone ...) に解決して描く。
//
// フォールバック: 役割コードでない値 (既存のユーザー作成ペルソナが持つ
//   任意アイコン文字列) はそのまま文字として描画し、後方互換を保つ。
// ============================================================
import type { CSSProperties } from 'react';
import { Sparkles, Star, Flame, Heart, type LucideIcon } from 'lucide-react';
import { CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';
import { MetaIcon } from './ExecIcon';

const ROLE_SET = new Set(Object.keys(CXO_META));

// OS絵文字を渡された場合の救済マップ (恒久ルール: UIにOSカラー絵文字を出さない)。
// 役割コードでない生の絵文字は、対応するLucideライン系アイコンに置き換えて描く。
const EMOJI_GLYPH: Record<string, LucideIcon> = {
  '✨': Sparkles,
  '⭐': Star,
  '🌟': Star,
  '🔥': Flame,
  '❤️': Heart,
  '💗': Heart,
};

/** icon 文字列が CxoRole (役割コード) かどうか */
export function isRoleCode(icon: string | undefined | null): icon is CxoRole {
  return !!icon && ROLE_SET.has(icon);
}

export default function PersonaGlyph({
  icon, color, size = 20, strokeWidth = 2.1, style,
}: {
  icon?: string | null;
  color?: string;
  size?: number;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  if (isRoleCode(icon)) {
    return (
      <MetaIcon
        meta={CXO_META[icon]}
        size={size}
        color={color ?? '#fff'}
        strokeWidth={strokeWidth}
        style={style}
      />
    );
  }
  // OS絵文字はLucideライン系アイコンへ置換 (恒久ルール)
  const EmojiIcon = icon ? EMOJI_GLYPH[icon.trim()] : undefined;
  if (EmojiIcon) {
    return <EmojiIcon size={size} color={color ?? '#fff'} strokeWidth={strokeWidth} style={style} />;
  }
  // 後方互換: 役割コードでも既知絵文字でもない文字列アイコンはそのまま表示
  return <span style={{ fontSize: size, lineHeight: 1, color, ...style }}>{icon}</span>;
}
