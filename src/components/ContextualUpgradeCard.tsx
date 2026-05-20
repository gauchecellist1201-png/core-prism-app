// ============================================================
// ContextualUpgradeCard — 文脈に合ったアップグレード提案
// 「ちょうど必要になった瞬間」だけ出す。閉じられる・押し付けない
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X, ArrowRight } from 'lucide-react';

export type UpgradeTrigger =
  | 'generation-cap'     // 無料枠の生成回数を使い切った
  | 'artifact-volume'    // 成果物が一定数たまった
  | 'feature-locked'     // 特定機能がロックされている
  | 'trial-ending';      // 体験期間がもうすぐ終わる

interface Props {
  trigger: UpgradeTrigger;
  /** 提案先のプラン名 (例: '標準プラン') */
  planName: string;
  /** クリック時の遷移先 (アプリ内 URL) */
  onUpgrade: () => void;
  /** 「いまはやめる」ボタンを押したときの後始末 (オプション) */
  onDismiss?: () => void;
  /** ストレージにこのキーで「閉じた」状態を保持 (24h くらいで再表示) */
  dismissKey?: string;
  /** 1 行目に出す文脈データ (例: "今月 50 件作りました") */
  context?: string;
  accent?: string;
}

const STORAGE_PREFIX = 'core_upgrade_dismissed_';
const REAPPEAR_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

const COPY: Record<UpgradeTrigger, { eyebrow: string; title: string; body: string; cta: string }> = {
  'generation-cap': {
    eyebrow: 'ちょっとした提案',
    title: 'もっと作れるプランに上げますか？',
    body: '無料枠の生成回数を使い切りそうです。月内であと何回でも作れるプランがあります。',
    cta: 'もっと作る →',
  },
  'artifact-volume': {
    eyebrow: '使い込んでくださってありがとうございます',
    title: 'まとめて管理するなら上位プラン',
    body: '作った成果物が増えてきました。フォルダ整理・検索・チーム共有が使えるプランがあります。',
    cta: 'まとめて管理する →',
  },
  'feature-locked': {
    eyebrow: 'この機能は上位プラン向け',
    title: 'プランをアップグレードして使えるようにしますか？',
    body: 'いま試そうとした機能は、上位プランで解禁されます。',
    cta: '解禁する →',
  },
  'trial-ending': {
    eyebrow: '体験期間のお知らせ',
    title: 'まもなく無料体験が終わります',
    body: 'いま登録すれば、いつでも解約できます。今までに作ったデータも引き継がれます。',
    cta: '続けて使う →',
  },
};

export default function ContextualUpgradeCard({
  trigger, planName, onUpgrade, onDismiss, dismissKey, context, accent = '#A78BFA',
}: Props) {
  const [hidden, setHidden] = useState<boolean>(() => {
    if (!dismissKey || typeof localStorage === 'undefined') return false;
    const at = localStorage.getItem(STORAGE_PREFIX + dismissKey);
    if (!at) return false;
    const ts = Number(at);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < REAPPEAR_AFTER_MS;
  });

  useEffect(() => { /* ストレージは同期。effect は不要 */ }, []);

  if (hidden) return null;
  const c = COPY[trigger];

  const dismiss = () => {
    if (dismissKey) {
      try { localStorage.setItem(STORAGE_PREFIX + dismissKey, String(Date.now())); } catch { /* */ }
    }
    setHidden(true);
    onDismiss?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
      role="region"
      aria-label="アップグレード提案"
      style={{
        position: 'relative',
        borderRadius: 14,
        padding: '0.95rem 1.05rem',
        background: `linear-gradient(135deg, ${accent}22, ${accent}0a)`,
        border: `1px solid ${accent}55`,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="閉じる"
        style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(255,255,255,0.05)', border: 'none',
          color: 'rgba(255,255,255,0.55)', borderRadius: '50%',
          width: 26, height: 26, minHeight: 32, minWidth: 32,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      ><X size={13} /></button>

      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, paddingRight: 36 }}>
        <Sparkles size={12} color={accent} />
        <span style={{ fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 800, color: accent }}>
          {c.eyebrow.toUpperCase()}
        </span>
      </div>

      <h3 style={{ fontSize: 14, fontWeight: 800, margin: '2px 0 0', lineHeight: 1.45 }}>
        {c.title}
      </h3>

      {context && (
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.75)', margin: '2px 0 0', lineHeight: 1.55 }}>
          {context}
        </p>
      )}

      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', margin: '4px 0 0', lineHeight: 1.6 }}>
        {c.body}
      </p>

      <button
        type="button"
        onClick={onUpgrade}
        style={{
          marginTop: 10, alignSelf: 'flex-start',
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: '#fff', border: 'none', borderRadius: 999,
          padding: '8px 18px', fontSize: 12, fontWeight: 800,
          cursor: 'pointer', minHeight: 36,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          boxShadow: `0 6px 18px ${accent}44`,
        }}
      >
        {c.cta.replace('→', '')}
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>({planName})</span>
        <ArrowRight size={12} />
      </button>
    </motion.div>
  );
}
