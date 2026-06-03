// ============================================================
// InviteShareHero — ダッシュボード トップ「+N 日延長」ライブ カード
//
// オーナー指示 (2026-06-04 第 17 波 MMM):
//   既存 InviteShareCard は重ためのカード。本コンポーネントは「トップに
//   常駐する軽いリビング カード」で 4 経路シェアに絞る:
//     X / LINE / メール / Web Share API
//
// 表示:
//   - 累計獲得日数 (bonusDays) と紹介人数 (referredCount) を大きく
//   - 4 ボタン (X / LINE / メール / Web Share)
//   - シェア後は recordShare() で local 履歴を加算
//   - 招待コードのコピーボタン (副次)
// ============================================================

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Mail, MessageCircle, Share2, Sparkles, Check } from 'lucide-react';
import {
  getReferralData, getReferralUrl, getInviterName,
  REFERRAL_BONUS_DAYS, recordShare,
} from '../lib/referral';

// X (Twitter) glyph (lucide が削除済のため自前 SVG)
function XGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2H21.5l-7.5 8.575L22.5 22h-6.844l-5.36-6.99L4.16 22H.9l8.025-9.17L1 2h6.95l4.85 6.41L18.244 2Zm-1.2 18h1.78L7.045 4H5.158l11.886 16Z" />
    </svg>
  );
}

interface Props {
  brand?: 'prism' | 'iris';
}

export default function InviteShareHero({ brand = 'prism' }: Props) {
  const [copied, setCopied] = useState(false);
  const data = useMemo(() => getReferralData(), []);
  const inviter = useMemo(() => getInviterName(), []);
  const url = useMemo(() => getReferralUrl(brand, data.myCode, { from: inviter }), [brand, data.myCode, inviter]);

  const earnedDays = data.bonusDays || 0;
  const referredCount = data.referredCount || 0;

  const shareTextBase = `${inviter || '友達'} からの招待で CORE ${brand === 'iris' ? 'Iris' : 'Prism'} を +${REFERRAL_BONUS_DAYS} 日 無料で試せます。`;

  const shareX = () => {
    recordShare();
    const u = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTextBase)}&url=${encodeURIComponent(url)}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };
  const shareLine = () => {
    recordShare();
    const u = `https://line.me/R/msg/text/?${encodeURIComponent(`${shareTextBase}\n${url}`)}`;
    window.open(u, '_blank', 'noopener,noreferrer');
  };
  const shareMail = () => {
    recordShare();
    const subject = encodeURIComponent(`CORE ${brand === 'iris' ? 'Iris' : 'Prism'} を試してみない?`);
    const body = encodeURIComponent(`${shareTextBase}\n\n登録はこちらから:\n${url}\n\nもし良かったら使ってみて感想教えて!`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };
  const shareWeb = async () => {
    recordShare();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `CORE ${brand === 'iris' ? 'Iris' : 'Prism'} 招待`, text: shareTextBase, url });
      } catch { /* ユーザーがキャンセル */ }
    } else {
      navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  const copyLink = () => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const accent = brand === 'iris' ? '#E1306C' : '#A78BFA';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'relative',
        borderRadius: 16,
        padding: '0.9rem 1rem',
        background: `linear-gradient(135deg, ${accent}18, ${accent}08 60%, transparent)`,
        border: `1px solid ${accent}44`,
        color: 'var(--fg)',
        overflow: 'hidden',
      }}
    >
      <div aria-hidden style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        borderRadius: '50%', filter: 'blur(40px)',
        background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Sparkles size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.25em', fontWeight: 800, color: accent, textTransform: 'uppercase', marginBottom: 4 }}>
            INVITE & EARN
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--fg)' }}>
              招待で <span style={{ color: accent }}>+{REFERRAL_BONUS_DAYS} 日</span> 延長 / 両者
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
              累計 +{earnedDays} 日 / {referredCount} 名 招待済
            </div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 6,
        marginTop: 10,
      }}>
        {[
          { key: 'x',    label: 'X',         icon: <XGlyph size={14} />,            onClick: shareX,    bg: '#000', color: '#fff' },
          { key: 'line', label: 'LINE',      icon: <MessageCircle size={14} />,     onClick: shareLine, bg: '#06C755', color: '#fff' },
          { key: 'mail', label: 'メール',    icon: <Mail size={14} />,              onClick: shareMail, bg: 'rgba(255,255,255,0.08)', color: 'var(--fg)' },
          { key: 'web',  label: 'シェア',    icon: <Share2 size={14} />,            onClick: shareWeb,  bg: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: '#fff' },
        ].map(b => (
          <button
            key={b.key}
            onClick={b.onClick}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 0', borderRadius: 10,
              background: b.bg as string, color: b.color, border: 'none',
              fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}
            aria-label={`${b.label} で招待`}
          >
            {b.icon} {b.label}
          </button>
        ))}
      </div>

      <button
        onClick={copyLink}
        style={{
          marginTop: 8, width: '100%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          padding: '6px 10px', borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'var(--fg-muted)', cursor: 'pointer',
          fontSize: 11, fontWeight: 600,
          fontFamily: 'Menlo, monospace',
        }}
        aria-label="招待リンクをコピー"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
        {copied ? 'コピーしました!' : url.replace(/^https?:\/\//, '')}
      </button>
    </motion.div>
  );
}
