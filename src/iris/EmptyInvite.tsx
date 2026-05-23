import { motion } from 'framer-motion';
import type { ComponentType, ReactNode } from 'react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';

/**
 * 「まだ◯◯がありません」の灰色 1 行を、
 * 「ここで何ができるか」を一緒に教える招待カードに昇格させるための共通 UI。
 *
 * - アイコンはアクセント色の小さなグロー付きでふわっと呼吸
 * - 見出しはセリフ斜体 (Iris のブランド線)
 * - 説明は 1〜2 行のやさしい言葉
 * - 任意の CTA ボタンで「今すぐ始める」導線
 */

type LucideIconLike = ComponentType<{ size?: number; style?: React.CSSProperties }>;

interface EmptyInviteProps {
  bg: IrisBackgroundDef;
  icon?: LucideIconLike;
  /** 見出し (例: 「コミュニティはまだ静かです」) */
  title: string;
  /** 1〜2 行のやさしい説明 */
  description: ReactNode;
  /** 任意の CTA ボタン */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIconLike;
  };
  /** 末尾のさらに小さなヒント */
  hint?: ReactNode;
  /** 縦サイズ (省略時は標準) */
  size?: 'sm' | 'md';
}

export default function EmptyInvite({
  bg,
  icon: Icon,
  title,
  description,
  primaryAction,
  hint,
  size = 'md',
}: EmptyInviteProps) {
  const accent = bg.accent;
  const padding = size === 'sm' ? '1.5rem 1rem' : '2.4rem 1.4rem';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      style={{
        position: 'relative',
        padding,
        background: bg.card,
        border: `1px dashed ${bg.cardBorder}`,
        borderRadius: 18,
        textAlign: 'center',
        color: bg.inkSoft,
        overflow: 'hidden',
      }}
    >
      {/* うっすら背景に流れる斜めライン (シマー) */}
      <motion.div
        aria-hidden
        animate={{ x: ['-30%', '130%'] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.8 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '40%',
          height: '100%',
          background: `linear-gradient(120deg, transparent 0%, ${accent}11 50%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* アイコン: ふわっと浮いて呼吸 */}
      {Icon && (
        <motion.div
          aria-hidden
          animate={{ y: [0, -3, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 54,
            height: 54,
            marginBottom: '0.85rem',
          }}
        >
          {/* アクセントのソフトグロー */}
          <span
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`,
              filter: 'blur(2px)',
            }}
          />
          <Icon size={28} style={{ color: accent, position: 'relative' }} />
        </motion.div>
      )}

      {/* 見出し: セリフ斜体 */}
      <p
        style={{
          fontFamily: IRIS_FONTS.serif,
          fontStyle: 'italic',
          fontSize: size === 'sm' ? '1rem' : '1.1rem',
          color: bg.ink,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {title}
      </p>

      {/* 説明: やさしい本文 */}
      <div
        style={{
          fontSize: '0.85rem',
          color: bg.inkSoft,
          lineHeight: 1.85,
          marginTop: '0.55rem',
          maxWidth: 380,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        {description}
      </div>

      {/* CTA */}
      {primaryAction && (
        <button
          type="button"
          onClick={primaryAction.onClick}
          style={{
            marginTop: '1.1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '0.65rem 1.4rem',
            background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            fontSize: '0.88rem',
            fontWeight: 700,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            boxShadow: `0 6px 18px ${accent}40`,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            minHeight: 44,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = `0 9px 22px ${accent}55`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = `0 6px 18px ${accent}40`;
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.97)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
        >
          {primaryAction.icon && <primaryAction.icon size={16} />}
          {primaryAction.label}
        </button>
      )}

      {/* ヒント (もっと小さく) */}
      {hint && (
        <div
          style={{
            marginTop: primaryAction ? '0.85rem' : '0.7rem',
            fontSize: '0.74rem',
            color: bg.inkSoft,
            opacity: 0.78,
            lineHeight: 1.7,
          }}
        >
          {hint}
        </div>
      )}
    </motion.div>
  );
}
