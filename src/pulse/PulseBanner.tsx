// ============================================================
// PulseBanner — Prism 内から CORE Pulse (からだ専用アプリ) への誘致バナー
//
// 置き場所: HealthHub 上部 / ホーム『カラダ』タブ。
// 深いモーブブラウンのグラデ + 白文字なので、Prism のライト/ダークどちらの
// テーマでもコントラストが崩れない (背景に依存しない自己完結スタイル)。
// 白文字のコントラスト: #6F5749 = 7.0:1 / #8A6D5C = 4.75:1 (どちらも 4.5:1 以上)
// ============================================================
import { ArrowRight } from 'lucide-react';

export default function PulseBanner() {
  return (
    <a
      href="/pulse"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px', borderRadius: 18, textDecoration: 'none',
        background: 'linear-gradient(120deg, #6F5749, #8A6D5C)',
        border: '1px solid rgba(201,179,126,0.45)',
        boxSizing: 'border-box', width: '100%',
      }}
    >
      {/* 鼓動の波形マーク */}
      <svg width={30} height={30} viewBox="0 0 32 32" fill="none" aria-hidden style={{ flexShrink: 0 }}>
        <circle cx="16" cy="16" r="15" fill="rgba(255,255,255,0.12)" stroke="rgba(201,179,126,0.9)" strokeWidth="1" />
        <path d="M6.5 16.5h4l2.2-6 3.6 11 2.8-8 1.6 3h5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
        background: '#FFFFFF', color: '#6F5749', fontSize: 12.5, fontWeight: 700,
      }}>
        使ってみる <ArrowRight size={13} />
      </span>
    </a>
  );
}
