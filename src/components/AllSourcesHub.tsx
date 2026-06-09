// ============================================================
// AllSourcesHub — 「最強 の RAG」 ビジョン カード
//
// オーナー指示 (2026-06-05):
//   「Instagram / TikTok も 接続 項目 に 含めて。 全データ を プリズム に
//    入れて いく イメージ。 最強 の RAG を 作りたい。」
//
// 表示:
//   - 各 ソース (Gmail / IG / TikTok / Stripe / Calendar / Slack / LINE / Meeting 録音)
//   - 接続 状態 (🟢 連携 中 / ⬜ 未連携 / ⚠️ Phase 2)
//   - 連携 ボタン (実装 済 の もの は 動く、 未実装 は 「Phase 2」 表示)
//   - 役員 が この データ で 何 を できる か (1 行)
// ============================================================
import { useState, useEffect } from 'react';
import { isGmailConnected, connectGmail } from '../lib/gmail';

interface Source {
  key: string;
  name: string;
  emoji: string;
  color: string;
  what: string;          // 何を 取得 する か
  why: string;           // 役員 が 何 が できる ように なる か
  status: 'connected' | 'available' | 'phase2';
  onConnect?: () => Promise<void>;
}

const SOURCES_INIT: Source[] = [
  {
    key: 'gmail',
    name: 'Gmail',
    emoji: '📧', color: '#EA4335',
    what: 'メール / スレッド',
    why: '案件 候補 抽出、 返信 下書き、 督促 検知',
    status: 'available',
  },
  {
    key: 'calendar',
    name: 'Google Calendar',
    emoji: '📅', color: '#4285F4',
    what: '予定 / 会議',
    why: '空き 時間 提案、 商談 後 の フォロー 自動 化',
    status: 'available',
  },
  {
    key: 'stripe',
    name: 'Stripe',
    emoji: '💳', color: '#635BFF',
    what: '売上 / 顧客 / 解約',
    why: 'MRR / 解約 兆候 / 入金 予測',
    status: 'available',
  },
  {
    key: 'instagram',
    name: 'Instagram',
    emoji: '📸', color: '#E4405F',
    what: '投稿 / DM / フォロワー',
    why: '案件 DM 自動 仕分け、 投稿 案 / リール 台本',
    status: 'phase2',
  },
  {
    key: 'tiktok',
    name: 'TikTok',
    emoji: '🎵', color: '#000000',
    what: '動画 / コメント / 分析',
    why: 'バズ パターン 抽出、 次 投稿 の 設計',
    status: 'phase2',
  },
  {
    key: 'meeting',
    name: '会議 録音',
    emoji: '🎙️', color: '#A855F7',
    what: 'Zoom / Meet / iPhone 録音',
    why: '議事 録 自動 生成 + 次 アクション 抽出',
    status: 'available',
  },
  {
    key: 'slack',
    name: 'Slack',
    emoji: '💬', color: '#4A154B',
    what: 'メッセージ / DM',
    why: 'チーム 動向、 重要 通知 抜粋',
    status: 'phase2',
  },
  {
    key: 'line',
    name: 'LINE',
    emoji: '💚', color: '#06C755',
    what: 'メッセージ / 公式 アカウント',
    why: '顧客 連絡、 配信 自動 化',
    status: 'available',
  },
];

export default function AllSourcesHub() {
  const [gmailConn, setGmailConn] = useState(() => isGmailConnected());
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const t = window.setInterval(() => setGmailConn(isGmailConnected()), 2000);
    return () => window.clearInterval(t);
  }, []);

  const sources = SOURCES_INIT.map((s) => {
    if (s.key === 'gmail') return { ...s, status: (gmailConn ? 'connected' : 'available') as Source['status'] };
    return s;
  });

  const handleConnect = async (s: Source) => {
    if (s.status === 'phase2') {
      setToast(`${s.name} 連携 は 次 フェーズ で 実装 予定 です`);
      window.setTimeout(() => setToast(''), 2500);
      return;
    }
    if (s.key === 'gmail') {
      setBusy('gmail');
      try {
        await connectGmail();
        setGmailConn(true);
        setToast('✓ Gmail を 連携 しました');
        window.setTimeout(() => setToast(''), 2500);
      } catch (e: any) {
        setToast(`⚠️ Gmail 連携 失敗: ${e?.message || ''}`);
        window.setTimeout(() => setToast(''), 4000);
      } finally { setBusy(null); }
      return;
    }
    // 他 は 設定 画面 に 誘導
    setToast(`${s.name} は 環境 設定 → 連携 から 接続 して ください`);
    window.setTimeout(() => setToast(''), 3000);
  };

  const connectedCount = sources.filter((s) => s.status === 'connected').length;

  return (
    <div style={{
      padding: '16px 16px 14px',
      borderRadius: 14,
      background: 'var(--surface)',
      border: '1px solid rgba(167,139,250,0.35)',
      marginBottom: 14,
      color: 'var(--fg)',
      position: 'relative',
    }}>
      {/* ヘッダ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, #A78BFA, #6366F1)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, boxShadow: '0 4px 14px rgba(167,139,250,0.5)', flexShrink: 0,
        }}>✨</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: 'var(--fg-strong)', margin: 0, letterSpacing: '-0.01em' }}>
            ✨ 最強 の RAG — 全 ソース 連携 ハブ
          </h3>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 2 }}>
            {connectedCount} / {sources.length} 連携 中 · 繋ぐ ほど 役員 が 賢く なります
          </div>
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--fg-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>
        全ての ツール を プリズム に 入れる ほど、 役員 が 「この 案件 は X で 触れて、 Y で 反応 良い」 と
        横断 で 意思決定 できる 様 に。
      </p>

      {/* グリッド */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 8,
      }}>
        {sources.map((s) => (
          <button
            key={s.key}
            onClick={() => handleConnect(s)}
            disabled={busy === s.key}
            style={{
              textAlign: 'left',
              padding: '10px 11px',
              borderRadius: 10,
              background: 'var(--surface-3)',
              border: `1px solid ${
                s.status === 'connected' ? '#34D399' :
                s.status === 'phase2' ? 'var(--border, rgba(0,0,0,0.08))' :
                s.color + '55'
              }`,
              color: 'var(--fg)',
              cursor: busy === s.key ? 'wait' : 'pointer',
              position: 'relative',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 26, height: 26, borderRadius: 7,
                background: `linear-gradient(135deg, ${s.color}, ${s.color}aa)`,
                color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
              }}>{s.emoji}</span>
              <strong style={{ fontSize: 12.5, color: 'var(--fg-strong)', flex: 1, minWidth: 0 }}>{s.name}</strong>
              <span style={{
                fontSize: 9, padding: '2px 5px', borderRadius: 999, fontWeight: 800,
                background: s.status === 'connected' ? 'rgba(52,211,153,0.22)' :
                            s.status === 'phase2' ? 'rgba(148,163,184,0.18)' :
                            s.color + '22',
                color: s.status === 'connected' ? '#34D399' :
                       s.status === 'phase2' ? 'var(--fg-subtle)' :
                       s.color,
              }}>
                {s.status === 'connected' ? '🟢 連携 中' :
                 s.status === 'phase2' ? '⏳ 準備中' :
                 '⬜ 連携 する'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--fg-strong)', fontWeight: 700 }}>取得:</span> {s.what}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-muted)', lineHeight: 1.5, marginTop: 2 }}>
              <span style={{ color: s.color, fontWeight: 700 }}>役員 が:</span> {s.why}
            </div>
          </button>
        ))}
      </div>

      {toast && (
        <div style={{
          position: 'absolute', left: '50%', bottom: -10, transform: 'translate(-50%, 100%)',
          background: '#1a1a26', color: '#fff', padding: '6px 12px', borderRadius: 8,
          fontSize: 11, fontWeight: 700, zIndex: 5,
          boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
        }}>{toast}</div>
      )}
    </div>
  );
}
