// ============================================================
// PulseBanner — Prism 内から CORE Pulse (からだ専用アプリ) への誘致バナー
//
// 置き場所: HealthHub 上部 / ホーム『カラダ』タブ。
// 濃コーラルのグラデ + 白文字なので、Prism のライト/ダークどちらのテーマでも
// コントラストが崩れない (背景に依存しない自己完結スタイル)。
// ============================================================
import { ArrowRight } from 'lucide-react';

export default function PulseBanner() {
  return (
    <a
      href="/pulse"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 14, textDecoration: 'none',
        background: 'linear-gradient(120deg, #C2483F, #D97066)',
        border: '1px solid rgba(255,255,255,0.25)',
        boxSizing: 'border-box', width: '100%',
      }}
    >
      {/* 鼓動の波形マーク */}
      <svg width={30} height={30} viewBox="0 0 32 32" fill="none" aria-hidden style={{ flexShrink: 0 }}>
        <circle cx="16" cy="16" r="15" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.85)" strokeWidth="1.4" />
        <path d="M5.5 16.5h5l2.2-6 3.6 11 2.8-8 1.6 3h6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.4 }}>
          CORE Pulse — からだ専用アプリができました
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5, marginTop: 2 }}>
          もっと詳しく、もっとやさしく。いまのデータのまま使えます
        </div>
      </div>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
        padding: '8px 12px', minHeight: 36, borderRadius: 999,
        background: '#FFFFFF', color: '#C2483F', fontSize: 12.5, fontWeight: 800,
      }}>
        使ってみる <ArrowRight size={13} />
      </span>
    </a>
  );
}
