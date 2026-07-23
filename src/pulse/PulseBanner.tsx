// ============================================================
// PulseBanner — Prism 内から CORE Pulse (からだ専用アプリ) への誘致バナー
//
// 置き場所: HealthHub 上部 / ホーム『カラダ』タブ。
// 深い夜色×ピンクグローのグラデ + 白文字なので、Prism のライト/ダークどちらの
// テーマでもコントラストが崩れない (背景に依存しない自己完結スタイル)。
// 白文字のコントラスト: #2A0F1B〜#4A1830 上の #FFFFFF ≈ 14:1 以上 /
// CTA は #FF5C8A 上に #2A0D17 ≈ 5.2:1 (どちらも 4.5:1 以上)
// ============================================================
import { ArrowRight } from 'lucide-react';

export default function PulseBanner() {
  return (
    <a
      href="/pulse"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px', borderRadius: 18, textDecoration: 'none',
        background: 'linear-gradient(120deg, #1A0D14, #3D142A)',
        border: '1px solid rgba(255,92,138,0.45)',
        boxShadow: '0 8px 26px rgba(255,92,138,0.16)',
        boxSizing: 'border-box', width: '100%',
      }}
    >
      {/* 鼓動が描くハート (PulseLogo と同モチーフのミニ版) */}
      <svg width={30} height={30} viewBox="0 0 32 32" fill="none" aria-hidden style={{ flexShrink: 0 }}>
        <path
          d="M16 27 C 11 23, 5.5 18.5, 5 13.5 C 4.5 9.5, 7 6.5, 10.5 6.5 C 13.3 6.5, 15 8.4, 16 10.6 C 17 8.4, 18.7 6.5, 21.5 6.5 C 25 6.5, 27.5 9.5, 27 13.5 C 26.5 18.5, 21 23, 16 27 Z"
          stroke="#FF5C8A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        />
        <path d="M9 16 h3.4 l1.8 -3.6 2.6 7.2 2 -5.2 1.1 1.6 h3.6"
          stroke="#FFB8CC" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.5, letterSpacing: '0.02em' }}>
          CORE Pulse — からだ専用アプリができました
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5, marginTop: 2 }}>
          もっと詳しく、もっとやさしく。いまのデータのまま使えます
        </div>
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: '8px 14px', minHeight: 36, borderRadius: 999,
        background: 'linear-gradient(120deg, #FF5C8A, #E8859E)', color: '#2A0D17',
        fontSize: 12.5, fontWeight: 700,
      }}>
        使ってみる <ArrowRight size={13} />
      </span>
    </a>
  );
}
