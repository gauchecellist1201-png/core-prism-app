// ============================================================
// ApiErrorCard — AI エラーをポップに表示し、解消手順をガイド
// dismiss すると同じエラーは 60 秒間 (sessionStorage) 再表示しない
// ============================================================
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Waves, Key, Wifi, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  /** エラーメッセージ。null/空なら何も出さない */
  error: string | null | undefined;
  /** 設定モーダルを開くハンドラ (マスターモード切替へ誘導) */
  onOpenSettings?: () => void;
  /** 表示位置の調整 (default はフルワイド) */
  className?: string;
  /** ダーク/ライト自動 (transparent 背景に対して読みやすく) */
  variant?: 'dark' | 'light' | 'auto';
}

const DISMISS_KEY = 'core_api_error_dismissed_until_v1';

function isDismissedNow(error: string): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const map: Record<string, number> = JSON.parse(raw);
    const sig = signature(error);
    const until = map[sig];
    return !!until && until > Date.now();
  } catch { return false; }
}

function dismissFor(error: string, durationMs = 60_000) {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[signature(error)] = Date.now() + durationMs;
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

function signature(error: string): string {
  // 数字・URL を取り除いて識別子化
  return error.toLowerCase().replace(/\d+/g, '#').replace(/https?:\/\/\S+/g, '').slice(0, 80);
}

function classifyError(error: string): {
  kind: 'quota' | 'auth' | 'network' | 'other';
  Icon: LucideIcon;
  iconColor: string;
  title: string;
  steps: string[];
} {
  const e = error.toLowerCase();
  if (/quota|混みあって|rate|429|503/i.test(error)) {
    return {
      kind: 'quota', Icon: Waves, iconColor: '#5BA8FF',
      title: 'AI が今、混みあっています',
      steps: [
        '60 秒待ってから、もう一度送信してみる',
        '設定 → マスターモード で高品質 AI に切替える',
        'それでも続くときは、ページを再読み込み',
      ],
    };
  }
  if (/api key|unauthorized|forbidden|認証/i.test(error)) {
    return {
      kind: 'auth', Icon: Key, iconColor: '#FACC15',
      title: 'AI の認証に失敗しました',
      steps: [
        '設定 → API キー を確認する',
        '時間をおいて再試行する',
        '解消しないときはサポートへ連絡',
      ],
    };
  }
  if (/network|fetch|offline|connection/i.test(e)) {
    return {
      kind: 'network', Icon: Wifi, iconColor: '#4ADE80',
      title: 'ネットワークが不安定です',
      steps: ['Wi-Fi / モバイル通信を確認', '再接続後にもう一度送信', 'ページ再読み込みも有効'],
    };
  }
  return {
    kind: 'other', Icon: AlertTriangle, iconColor: '#FFA94D',
    title: 'AI が応答しませんでした',
    steps: ['少し時間をおいてもう一度お試しください', '繰り返す場合はページを再読み込み', '解消しないときはサポートへ連絡'],
  };
}

export default function ApiErrorCard({ error, onOpenSettings, className, variant = 'auto' }: Props) {
  const [version, setVersion] = useState(0); // 再描画用
  const visible = !!error && !isDismissedNow(error);

  // sessionStorage の TTL 切れに合わせて 5 秒ごとに再評価
  useEffect(() => {
    if (!error) return;
    const t = setInterval(() => setVersion(v => v + 1), 5000);
    return () => clearInterval(t);
  }, [error]);

  if (!visible || !error) return null;

  const c = classifyError(error);

  // 色: dark or light 自動
  const bg = variant === 'light'
    ? 'rgba(255, 245, 240, 0.96)'
    : 'rgba(48, 12, 18, 0.92)';
  const fg = variant === 'light' ? '#7B0E29' : '#FFEAEC';
  const fgDim = variant === 'light' ? '#9C3A5C' : '#FFB8C0';
  const border = variant === 'light' ? 'rgba(225, 48, 108, 0.35)' : 'rgba(255, 184, 192, 0.30)';

  const handleDismiss = () => {
    dismissFor(error, 60_000);
    setVersion(v => v + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        key={c.kind + version}
        initial={{ opacity: 0, y: -8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className={className}
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 14,
          padding: '0.85rem 1rem',
          margin: '0.5rem 0.75rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(10px)',
          color: fg,
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `linear-gradient(135deg, ${c.iconColor}, ${c.iconColor}cc)`,
            boxShadow: `0 4px 12px ${c.iconColor}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 1,
          }}>
            <c.Icon size={17} color="#FFFFFF" strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <p style={{ fontWeight: 700, fontSize: 13, color: fg, margin: 0 }}>{c.title}</p>
              <button
                onClick={handleDismiss}
                title="60 秒間、表示しない"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: fgDim, fontSize: 18, lineHeight: 1, padding: '0 4px',
                  borderRadius: 6,
                }}
              >×</button>
            </div>
            <ol style={{
              margin: '0 0 0.4rem', padding: '0 0 0 1.1rem',
              fontSize: 12, color: fgDim, lineHeight: 1.65,
            }}>
              {c.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            {c.kind === 'quota' && onOpenSettings && (
              <button
                onClick={onOpenSettings}
                style={{
                  marginTop: '0.3rem',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid ' + border,
                  color: fg,
                  borderRadius: 999, padding: '0.4rem 0.95rem',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                }}
              ><SettingsIcon size={13} strokeWidth={2.2} /> 設定でマスターモードを有効化</button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
