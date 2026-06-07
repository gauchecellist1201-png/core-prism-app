// ============================================================
// InlineHints — 画面 を 開いた 瞬間 に 自然 に 出る 「👆 ここ タップで 説明」 チップ
//
// オーナー指示 (2026-06-05):
//   「16 ステップ ツアー は うざい から 廃止。
//    代わり に、 画面 を 開いて から 各 セクション の 使い方 を 自然 に
//    教える インライン ヒント に して。」
//
// 設計:
//   - 既存 の data-tour-id 要素 の 近く に 浮かぶ 小さな チップ
//   - 「タップ で 役割 を 確認」 「タップ で 仕事 を 任せる」 等
//   - 一度 ユーザー が 該当 要素 を 触ったら 消える
//   - 5 秒 経って も 触らなかったら ふわっと 消える (空気 化)
//   - localStorage で 既読 管理 (再表示 しない)
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_PREFIX = 'core_hint_seen_';
const AUTO_FADE_MS = 9000;

interface HintProps {
  /** ヒント ID (localStorage の キー) */
  id: string;
  /** どの 要素 の 近く に 出す か (data-tour-id 推奨) */
  targetSelector: string;
  /** 表示 する メッセージ */
  message: string;
  /** ターゲット の 上 / 下 どちら に 出す か (default: 上) */
  placement?: 'top' | 'bottom';
  /** 開始 遅延 ms (順番 に 出したい 時) */
  delayMs?: number;
  /** アクセント 色 */
  color?: string;
}

export default function InlineHint({
  id, targetSelector, message, placement = 'top', delayMs = 0, color = '#A78BFA',
}: HintProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 既読 チェック
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_PREFIX + id) === '1') return;
    } catch { /* */ }

    let cancelled = false;
    let fadeTimer: number | undefined;
    let interactionListener: (() => void) | undefined;

    // 起動 遅延
    const t = window.setTimeout(() => {
      if (cancelled) return;
      // target 要素 を 探す (出現 まで 待つ)
      let attempts = 0;
      const tryFind = () => {
        const el = document.querySelector(targetSelector) as HTMLElement | null;
        if (!el || el.offsetParent === null) {
          if (++attempts < 30 && !cancelled) {
            window.setTimeout(tryFind, 200);
          }
          return;
        }
        const r = el.getBoundingClientRect();
        const scrollY = window.scrollY;
        const left = Math.max(12, Math.min(window.innerWidth - 280, r.left + r.width / 2 - 140));
        const top = placement === 'top'
          ? r.top + scrollY - 50
          : r.bottom + scrollY + 10;
        setPos({ left, top });
        setVisible(true);

        // ユーザー が target を 触ったら 消す
        interactionListener = () => dismiss();
        el.addEventListener('click', interactionListener, { once: true });
        el.addEventListener('touchstart', interactionListener, { once: true, passive: true });

        // 自動 フェード
        fadeTimer = window.setTimeout(() => dismiss(), AUTO_FADE_MS);
      };
      tryFind();
    }, delayMs);

    const dismiss = () => {
      setVisible(false);
      try { localStorage.setItem(STORAGE_PREFIX + id, '1'); } catch { /* */ }
    };

    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!pos) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: placement === 'top' ? 8 : -8, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: placement === 'top' ? -4 : 4, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'absolute',
            left: pos.left, top: pos.top,
            zIndex: 50, width: 280,
            pointerEvents: 'auto',
          }}
        >
          <div
            onClick={() => {
              try { localStorage.setItem(STORAGE_PREFIX + id, '1'); } catch { /* */ }
              setVisible(false);
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 12,
              background: `linear-gradient(135deg, ${color}, ${color}cc)`,
              color: '#fff',
              fontSize: 11.5, fontWeight: 800, lineHeight: 1.45,
              boxShadow: `0 10px 26px ${color}55, 0 0 0 1px rgba(255,255,255,0.08)`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
            }}
            aria-label="ヒント を 閉じる"
          >
            <motion.span
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}
            >👆</motion.span>
            <span style={{ flex: 1 }}>{message}</span>
            <span style={{
              fontSize: 14, opacity: 0.7, marginLeft: 4, flexShrink: 0,
            }}>×</span>
          </div>
          {/* 吹き出し の しっぽ */}
          <div style={{
            position: 'absolute',
            ...(placement === 'top'
              ? { bottom: -6, left: 130 }
              : { top: -6, left: 130 }),
            width: 0, height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            ...(placement === 'top'
              ? { borderTop: `6px solid ${color}cc` }
              : { borderBottom: `6px solid ${color}` }),
          }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** ダッシュホーム 用 の 推奨 ヒント セット */
export function DashboardHints({ brand = 'prism' }: { brand?: 'prism' | 'iris' }) {
  const accent = brand === 'iris' ? '#F472B6' : '#A78BFA';
  return (
    <>
      {/* 1. 7 人 の 参謀 */}
      <InlineHint
        id="orbit-agents"
        targetSelector='[data-tour-id="agents-orbit"]'
        message="7 人 の 参謀 — 1 タップ で 役割 説明、 もう 1 回 で 仕事 を 任せる"
        placement="top"
        delayMs={1200}
        color={accent}
      />
      {/* 2. 14 役員 ヒーロー */}
      <InlineHint
        id="digital-company"
        targetSelector='[data-tour-id="digital-company-hero"]'
        message="あなた の デジタル 会社 — 役員 を タップ で 役職 + 任せられる 仕事"
        placement="top"
        delayMs={3000}
        color={accent}
      />
      {/* 3. 役員 日報 ボタン */}
      <InlineHint
        id="briefings-fab"
        targetSelector='[data-tour-id="briefings-button"]'
        message="役員 が 作った 全 成果物 は ここ に 蓄積 されます"
        placement="top"
        delayMs={5500}
        color={accent}
      />
    </>
  );
}
