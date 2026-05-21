// ============================================================
// ShareArtifactButton — 成果物を「共有リンク + CTA」付きで誰かに送るボタン
// shareLink.ts で URL を作り Web Share API → クリップボードに fallback
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Share2, Check, AlertCircle } from 'lucide-react';
import { buildShareUrl, shareOrCopy, type SharedArtifact } from '../lib/shareLink';
import { notifyInApp } from '../lib/inAppNotify';

interface Props {
  /** 共有する成果物 (kind / title / body / imageUrl など) */
  artifact: SharedArtifact;
  /** ボタンの色 (デフォルト紫) */
  accent?: string;
  /** ラベル文字 (デフォルト "リンクで送る") */
  label?: string;
  /** ボタンの見た目: 'pill' (細長) / 'icon' (小さい丸) */
  variant?: 'pill' | 'icon';
  size?: 'sm' | 'md';
  /** Web Share の text 部分 (本文の冒頭などプレビュー用) */
  shareText?: string;
}

export default function ShareArtifactButton({
  artifact, accent = '#A78BFA', label = 'リンクで送る',
  variant = 'pill', size = 'md', shareText,
}: Props) {
  const [state, setState] = useState<'idle' | 'shared' | 'copied' | 'failed'>('idle');

  const onClick = async () => {
    try {
      const url = buildShareUrl(artifact);
      const result = await shareOrCopy(url, artifact.title || '届いたよ', shareText);
      setState(result);
      if (result === 'copied') {
        notifyInApp({
          kind: 'success',
          title: 'リンクをコピーしました',
          body: 'メッセージやメールに貼り付けてお友達に送れます',
          duration: 5000,
        });
      } else if (result === 'failed') {
        notifyInApp({
          kind: 'warn',
          title: 'リンクを作れませんでした',
          body: 'もう一度お試しください',
          duration: 5000,
        });
      }
      window.setTimeout(() => setState('idle'), 2400);
    } catch {
      setState('failed');
      window.setTimeout(() => setState('idle'), 2400);
    }
  };

  const Icon = state === 'shared' || state === 'copied' ? Check
    : state === 'failed' ? AlertCircle
    : variant === 'icon' ? Share2 : Share2;

  const text = state === 'copied' ? 'コピーしました'
    : state === 'shared' ? '送れました'
    : state === 'failed' ? '失敗'
    : label;

  if (variant === 'icon') {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        aria-label={label}
        title={label}
        style={{
          width: size === 'sm' ? 34 : 40, height: size === 'sm' ? 34 : 40,
          minWidth: 44, minHeight: 44,
          borderRadius: '50%',
          background: `${accent}22`,
          border: `1px solid ${accent}55`,
          color: accent,
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={size === 'sm' ? 15 : 17} />
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: state === 'failed' ? '#F8717122'
          : (state === 'shared' || state === 'copied') ? '#10B98122'
          : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
        color: state === 'failed' ? '#F87171'
          : (state === 'shared' || state === 'copied') ? '#10B981'
          : '#fff',
        border: state !== 'idle' ? `1px solid currentColor` : 'none',
        borderRadius: 999,
        padding: size === 'sm' ? '8px 14px' : '10px 18px',
        fontSize: size === 'sm' ? 12 : 13,
        fontWeight: 800, letterSpacing: '0.02em',
        cursor: 'pointer', minHeight: 44,
        boxShadow: state === 'idle' ? `0 6px 16px ${accent}44` : 'none',
        transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
      }}
    >
      <Icon size={size === 'sm' ? 13 : 14} />
      {text}
    </motion.button>
  );
}
