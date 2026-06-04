// ============================================================
// SocialShareButtons — LP に置く シェア ボタン (X / FB / LinkedIn / コピー)
//
// オーナー指示 (2026-06-04 第 46 波 XXXXXX):
//   タップで OS / Browser の share window を 開きつつ、
//   /api/track/social-share に beacon で 記録。
// ============================================================

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// lucide-react から Twitter/Facebook/Linkedin は 除去されたので 自前テキストアイコン (aria-label で a11y)
const XIcon = ({ size = 16 }: { size?: number }) => (
  <span aria-hidden="true" style={{ fontSize: size, fontWeight: 900, lineHeight: 1 }}>𝕏</span>
);
const FbIcon = ({ size = 16 }: { size?: number }) => (
  <span aria-hidden="true" style={{ fontSize: size, fontWeight: 900, lineHeight: 1, fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>f</span>
);
const InIcon = ({ size = 16 }: { size?: number }) => (
  <span aria-hidden="true" style={{ fontSize: size * 0.78, fontWeight: 900, lineHeight: 1, fontFamily: 'Arial, sans-serif' }}>in</span>
);

interface Props {
  /** シェアする URL — 未指定なら 現在の location.href */
  url?: string;
  /** シェア時に 添える 文字列 */
  text?: string;
  /** Hashtag (X のみ) */
  hashtags?: string[];
  /** 表示モード */
  compact?: boolean;
  /** 親色 (任意) */
  accent?: string;
}

const NETWORKS = [
  { id: 'x', Icon: XIcon, color: '#000000', hover: '#1da1f2', label: 'X (Twitter)' },
  { id: 'facebook', Icon: FbIcon, color: '#1877F2', hover: '#0a5dd2', label: 'Facebook' },
  { id: 'linkedin', Icon: InIcon, color: '#0A66C2', hover: '#0758a8', label: 'LinkedIn' },
] as const;

function trackBeacon(network: string, url: string) {
  try {
    const payload = JSON.stringify({ network, url });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/social-share', new Blob([payload], { type: 'application/json' }));
      return;
    }
    fetch('/api/track/social-share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* */ });
  } catch { /* */ }
}

function openShare(network: string, url: string, text: string, hashtags?: string[]) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  let w = '';
  switch (network) {
    case 'x':
      w = `https://twitter.com/intent/tweet?url=${u}&text=${t}${hashtags?.length ? `&hashtags=${encodeURIComponent(hashtags.join(','))}` : ''}`;
      break;
    case 'facebook':
      w = `https://www.facebook.com/sharer/sharer.php?u=${u}`;
      break;
    case 'linkedin':
      w = `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
      break;
  }
  if (w) window.open(w, 'core-share', 'noopener,noreferrer,width=600,height=720');
}

export default function SocialShareButtons({ url, text = '', hashtags, compact = false, accent = '#A78BFA' }: Props) {
  const target = url || (typeof window !== 'undefined' ? window.location.href : '');
  const [copied, setCopied] = useState(false);

  const handleShare = (id: string) => {
    if (id === 'copy') {
      try {
        navigator.clipboard.writeText(target);
        setCopied(true);
        trackBeacon('copy', target);
        setTimeout(() => setCopied(false), 1500);
      } catch { /* */ }
      return;
    }
    openShare(id, target, text, hashtags);
    trackBeacon(id, target);
  };

  const size = compact ? 32 : 38;
  const iconSize = compact ? 14 : 16;

  return (
    <div
      role="group"
      aria-label="シェアする"
      style={{
        display: 'inline-flex', gap: 8, alignItems: 'center',
      }}
    >
      {!compact && (
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700, letterSpacing: '0.12em', marginRight: 4 }}>
          📣 SHARE
        </span>
      )}
      {NETWORKS.map((n) => {
        const Icon = n.Icon;
        return (
          <button
            key={n.id}
            onClick={() => handleShare(n.id)}
            aria-label={`${n.label} で シェア`}
            title={n.label}
            style={{
              width: size, height: size, borderRadius: size / 2,
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${accent}44`,
              color: '#fff', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.12s, background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${n.color}33`; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
          >
            <Icon size={iconSize} />
          </button>
        );
      })}
      <button
        onClick={() => handleShare('copy')}
        aria-label="URL を コピー"
        title="URL を コピー"
        style={{
          width: size, height: size, borderRadius: size / 2,
          background: copied ? 'rgba(52,211,153,0.22)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${copied ? '#34D399' : accent + '44'}`,
          color: copied ? '#34D399' : '#fff', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}
      >
        {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      </button>
    </div>
  );
}
