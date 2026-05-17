// ============================================================
// IntegrationCenter — ツール連携を「わかりやすい 3 ステップ」で
//
// オーナー指示 (2026-05-17): Gmail 連携を実際にしたい。
// ツール連携系を全部わかりやすい連携ステップで表示。
//
// 各ツールを統一カードで:
//   アイコン / 名前 / できること / 状態バッジ / ① ② ③ ステップ / ボタン
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ArrowRight, Loader2 } from 'lucide-react';
import {
  isGmailConfigured, isGmailConnected, loadGmailUser, connectGmail, clearGmailToken,
} from '../lib/gmail';
import {
  isCalConfigured, isCalConnected, loadCalUser, connectCalendar, clearCalToken,
} from '../lib/googleCalendar';

interface Props {
  onClose: () => void;
  accent?: string;
}

type ToolStatus = 'connected' | 'ready' | 'preparing' | 'guide';

interface Tool {
  id: string;
  emoji: string;
  name: string;
  can: string;             // できること (1 行)
  steps: string[];         // ① ② ③
  status: ToolStatus;
  connectedAs?: string;    // 連携済みアカウント
  /** 実際に連携を実行する。null ならステップ表示のみ */
  connect?: () => Promise<void>;
  disconnect?: () => void;
  /** preparing 状態のときに出すオーナー向け準備手順 */
  prepNote?: string;
}

export default function IntegrationCenter({ onClose, accent = '#2E6FFF' }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; msg: string } | null>(null);
  const [, forceRender] = useState(0);
  const refresh = () => forceRender(n => n + 1);

  const gmailUser = loadGmailUser();
  const calUser = loadCalUser();

  const tools: Tool[] = [
    {
      id: 'gmail',
      emoji: '📧',
      name: 'Gmail',
      can: '届いたメールに AI が返信を下書き。あなたは確認して送るだけ',
      status: isGmailConnected() ? 'connected' : isGmailConfigured() ? 'ready' : 'preparing',
      connectedAs: gmailUser?.email,
      steps: [
        '下の「Gmail とつなぐ」を押す',
        'いつもの Google アカウントでログイン',
        'メールの読み取りを許可 → 連携完了',
      ],
      prepNote: 'Gmail 連携の準備中です。Google の審査が通り次第、自動で「つなぐ」ボタンが有効になります。',
      connect: async () => {
        await connectGmail();
      },
      disconnect: () => { clearGmailToken(); refresh(); },
    },
    {
      id: 'apple-watch',
      emoji: '⌚️',
      name: 'Apple Watch / ヘルス',
      can: '心拍・睡眠・歩数を毎朝 自動で取り込み、体調を見守る',
      status: 'guide',
      steps: [
        'iPhone の「ショートカット」アプリに CORE 用ショートカットを追加',
        '「オートメーション」で毎朝の自動実行を ON',
        '初回だけ手でタップ → 以後は毎朝 自動で届きます',
      ],
    },
    {
      id: 'google-calendar',
      emoji: '📅',
      name: 'Google カレンダー',
      can: '予定を AI が把握し、会議の準備や移動を先回りで提案',
      status: isCalConnected() ? 'connected' : isCalConfigured() ? 'ready' : 'preparing',
      connectedAs: calUser?.email,
      steps: [
        '下の「カレンダーとつなぐ」を押す',
        'Google アカウントでログイン',
        '予定の読み取りを許可 → 連携完了',
      ],
      prepNote: 'カレンダー連携は近日公開です。',
      connect: async () => {
        await connectCalendar();
      },
      disconnect: () => { clearCalToken(); refresh(); },
    },
    {
      id: 'notion',
      emoji: '🗂',
      name: 'Notion',
      can: '議事録やメモを Notion に自動保存。AI が整理して書き込み',
      status: 'guide',
      steps: [
        'Notion で「インテグレーション」を作成し、トークンをコピー',
        'CORE の設定画面にトークンを貼り付け',
        '保存先のページを選んで連携完了',
      ],
    },
    {
      id: 'slack',
      emoji: '💬',
      name: 'Slack',
      can: '重要な通知や AI の提案を Slack に届ける',
      status: 'guide',
      steps: [
        'Slack で受信用の Webhook URL を発行',
        'CORE の設定画面に URL を貼り付け',
        'テスト送信して連携完了',
      ],
    },
  ];

  const handleConnect = async (tool: Tool) => {
    if (!tool.connect) return;
    setError(null);
    setBusyId(tool.id);
    try {
      await tool.connect();
      refresh();
    } catch (e: any) {
      setError({ id: tool.id, msg: e?.message || '連携に失敗しました。もう一度お試しください。' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(8,8,18,0.78)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 24 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#12121E', borderRadius: 22, padding: '1.4rem',
          maxWidth: 560, width: '100%',
          maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* ヘッダ */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', fontWeight: 800, color: accent }}>
              INTEGRATIONS
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.25rem 0 0' }}>
              連携センター
            </h2>
          </div>
          <button
            type="button" onClick={onClose} aria-label="閉じる"
            style={{
              background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
              width: 38, height: 38, cursor: 'pointer', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: '1.1rem', lineHeight: 1.6 }}>
          つなぐほど AI が賢くなります。手順は 3 ステップだけ。
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tools.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              accent={accent}
              busy={busyId === tool.id}
              error={error?.id === tool.id ? error.msg : null}
              onConnect={() => handleConnect(tool)}
              onDisconnect={tool.disconnect}
            />
          ))}
        </div>

        <p style={{
          fontSize: 10.5, color: 'rgba(255,255,255,0.4)',
          marginTop: '1rem', lineHeight: 1.7, textAlign: 'center',
        }}>
          連携情報はあなたのブラウザ内に保存されます。<br />
          パスワードを CORE が預かることはありません。
        </p>
      </motion.div>
    </motion.div>
  );
}

const STATUS_META: Record<ToolStatus, { label: string; color: string; bg: string }> = {
  connected: { label: '連携済み', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  ready:     { label: 'つなげます', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  preparing: { label: '準備中', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
  guide:     { label: '手順あり', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' },
};

function ToolCard({ tool, accent, busy, error, onConnect, onDisconnect }: {
  tool: Tool; accent: string; busy: boolean; error: string | null;
  onConnect: () => void; onDisconnect?: () => void;
}) {
  const s = STATUS_META[tool.status];
  const isConnected = tool.status === 'connected';

  return (
    <div style={{
      borderRadius: 16,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${isConnected ? '#10B98144' : 'rgba(255,255,255,0.08)'}`,
      padding: '0.95rem 1rem',
    }}>
      {/* 上段: アイコン + 名前 + 状態 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, flexShrink: 0,
          background: 'rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
        }}>{tool.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{tool.name}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, marginTop: 1 }}>
            {tool.can}
          </div>
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 800, color: s.color, background: s.bg,
          padding: '4px 9px', borderRadius: 999, flexShrink: 0,
        }}>{s.label}</span>
      </div>

      {/* 連携済みアカウント */}
      {isConnected && tool.connectedAs && (
        <div style={{
          fontSize: 11, color: '#10B981', fontWeight: 600,
          background: 'rgba(16,185,129,0.1)', borderRadius: 8,
          padding: '5px 9px', marginBottom: 8,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <Check size={12} /> {tool.connectedAs} として連携中
        </div>
      )}

      {/* ステップ (未連携のときだけ) */}
      {!isConnected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 9 }}>
          {tool.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
              <span style={{
                width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                background: accent, color: '#fff',
                fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 1,
              }}>{i + 1}</span>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                {step}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 準備中ノート */}
      {tool.status === 'preparing' && tool.prepNote && (
        <div style={{
          fontSize: 10.5, color: '#FBBF24', lineHeight: 1.5,
          background: 'rgba(251,191,36,0.08)', borderRadius: 8,
          padding: '6px 9px', marginBottom: 8,
        }}>{tool.prepNote}</div>
      )}

      {/* エラー */}
      {error && (
        <div style={{
          fontSize: 11, color: '#F87171', lineHeight: 1.5,
          background: 'rgba(248,113,113,0.1)', borderRadius: 8,
          padding: '6px 9px', marginBottom: 8,
        }}>⚠ {error}</div>
      )}

      {/* アクションボタン */}
      {isConnected ? (
        <button
          type="button" onClick={onDisconnect}
          style={{
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.05)', border: 'none',
            borderRadius: 999, padding: '6px 14px', cursor: 'pointer',
          }}
        >連携を解除</button>
      ) : tool.status === 'ready' ? (
        <button
          type="button" onClick={onConnect} disabled={busy}
          style={{
            width: '100%',
            fontSize: 12.5, fontWeight: 800, color: '#fff',
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            border: 'none', borderRadius: 999,
            padding: '9px 16px', cursor: busy ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy
            ? <><Loader2 size={14} className="spin" /> つないでいます…</>
            : <>{tool.name} とつなぐ <ArrowRight size={14} /></>}
        </button>
      ) : null}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
