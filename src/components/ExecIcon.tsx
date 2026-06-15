// ============================================================
// ExecIcon — CXO/役員アイコンを「OS絵文字」ではなく
// ブランド配色のライン系アイコン(Lucide)で描く共通コンポーネント。
// CXO_META に既に定義済みの Icon（Crown / Cpu / Target ...）を使う。
// オーナー指示 2026-06-15: LPのエージェントアイコンを絵文字→きちんとしたデザインへ。
// ============================================================
import type { CSSProperties } from 'react';
import { CXO_META, type CxoRole } from '../hooks/useAgentTaskQueue';

type MetaLike = { Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }>; color?: string };

/** CxoMeta オブジェクトを直接渡す版（描画側に meta がある場合） */
export function MetaIcon({
  meta, size = 22, color, strokeWidth = 2, style,
}: { meta: MetaLike; size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }) {
  const I = meta.Icon;
  return <I size={size} color={color ?? meta.color ?? 'currentColor'} strokeWidth={strokeWidth} style={style} aria-hidden />;
}

/** 役職コードを渡す版 */
export function ExecIcon({
  role, size = 22, color, strokeWidth = 2, style,
}: { role: CxoRole; size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }) {
  return <MetaIcon meta={CXO_META[role]} size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
