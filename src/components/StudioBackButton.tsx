'use client';

import { memo } from 'react';

/**
 * 全サービス共通の「左上の戻る (←)」ボタン。
 * オーナー恒久ルール (2026-07): モーダル / スタジオ / サブ画面の左上に、
 * 閉じる (×) とは別に必ず戻る (←) を置く。押すと前の画面へ戻る (= onClose 再利用)。
 *
 * SupportChat.tsx の実装を共通部品化したもの。
 * theme に依存しないよう currentColor ベース + 半透明の器で、
 * ダーク / ライトどちらのスタジオ・ヘッダーでも視認できる。
 */
function StudioBackButton({
  onClick,
  label = '戻る',
  className = '',
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center flex-shrink-0 rounded-full text-fg-muted hover:text-fg transition-colors ${className}`}
      style={{
        width: 40,
        height: 40,
        minWidth: 40,
        minHeight: 40,
        background: 'rgba(127,127,127,0.12)',
        border: '1px solid rgba(127,127,127,0.22)',
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>
  );
}

export default memo(StudioBackButton);
