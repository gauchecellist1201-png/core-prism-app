// ============================================================
// ErrorLogViewer — 画面で起きたエラーを一覧で見られる/コピーできる窓
// 「ご不便があったら、このログをお問い合わせに添付してください」用途
// 外部送信はしない (オプトインのみ、別ヘルパーに分離)
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Copy, Trash2, RefreshCw, Check, Mail } from 'lucide-react';
import { confirmAction } from '../lib/confirmDialog';

const SUPPORT_EMAIL = 'gauche.cellist1201@gmail.com';

const LOCAL_BUFFER_KEY = 'core_error_log_v1';

interface ErrorEntry {
  type: 'console' | 'window' | 'unhandledrejection';
  message: string;
  stack?: string;
  url: string;
  ts: number;
}

interface Props {
  onClose: () => void;
}

function load(): ErrorEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_BUFFER_KEY);
    return raw ? (JSON.parse(raw) as ErrorEntry[]) : [];
  } catch {
    return [];
  }
}

function formatTs(ts: number): string {
  try {
    return new Date(ts).toLocaleString('ja-JP', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return String(ts); }
}

function entriesToText(entries: ErrorEntry[]): string {
  const lines: string[] = [];
  lines.push(`# CORE 不具合ログ (${entries.length} 件)`);
  lines.push(`書き出し日時: ${new Date().toISOString()}`);
  lines.push('');
  for (const e of entries) {
    lines.push(`[${formatTs(e.ts)}] ${e.type}`);
    lines.push(`  画面: ${e.url}`);
    lines.push(`  内容: ${e.message}`);
    if (e.stack) lines.push(`  詳細: ${e.stack.split('\n').slice(0, 4).join(' / ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

const TYPE_LABEL: Record<ErrorEntry['type'], string> = {
  console: 'メッセージ',
  window: '画面エラー',
  unhandledrejection: '通信失敗',
};

const TYPE_COLOR: Record<ErrorEntry['type'], string> = {
  console: '#FBBF24',
  window: '#F87171',
  unhandledrejection: '#A78BFA',
};

export default function ErrorLogViewer({ onClose }: Props) {
  const [entries, setEntries] = useState<ErrorEntry[]>(load);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 開いている間はストレージ変更を見て自動更新
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_BUFFER_KEY) setEntries(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const refresh = () => setEntries(load());
  const clear = async () => {
    if (!(await confirmAction({ title: '不具合ログをすべて消去しますか?', body: '保存されているエラーログが空になります。', tone: 'danger', okLabel: '消去する' }))) return;
    try { localStorage.removeItem(LOCAL_BUFFER_KEY); } catch { /* */ }
    setEntries([]);
  };
  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(entriesToText(entries));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* */ }
  };

  /** メーラーを起動して整形済みログを件名+本文に乗せる (個人情報は最小化) */
  const sendByEmail = async () => {
    if (entries.length === 0) return;
    if (!(await confirmAction({
      title: '不具合ログをお問い合わせに送りますか?',
      body: '端末のメールアプリが開きます。本文には直近 ' + entries.length + ' 件のログだけが入り、ご自身で送信ボタンを押すまで何も送信されません。',
      tone: 'normal', okLabel: '送る準備をする',
    }))) return;
    const subject = `[CORE 不具合報告] ${new Date().toLocaleDateString('ja-JP')} ${entries.length} 件`;
    const intro = `CORE スタッフ各位\n\n以下の不具合ログを共有します。確認のうえ対処をお願いします。\n\n--- ここからログ ---\n\n`;
    const body = intro + entriesToText(entries);
    // mailto: の URL 上限を超えないよう 6KB で切る
    const safeBody = body.length > 6000 ? body.slice(0, 5900) + '\n\n(以降は長いため省略)' : body;
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(safeBody)}`;
    window.location.href = href;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(8,8,18,0.78)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#12121E', borderRadius: 18,
          maxWidth: 720, width: '100%', maxHeight: 'calc(100dvh - 2rem)',
          color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <header style={{ padding: '1.1rem 1.2rem 0.8rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.3em', fontWeight: 800, color: '#A78BFA' }}>DEBUG</div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '4px 0 0' }}>不具合ログ</h2>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: '4px 0 0', lineHeight: 1.55 }}>
                直近 50 件まで、あなたの端末内にだけ保存しています。<br />
                「メールで送る」でお問い合わせメールの下書きが開きます (送信ボタンを押すまで送られません)。
              </p>
            </div>
            <button
              type="button" onClick={onClose} aria-label="閉じる"
              style={{
                background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
                width: 36, height: 36, cursor: 'pointer', color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, minHeight: 44, minWidth: 44,
              }}
            ><X size={16} /></button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={sendByEmail} disabled={entries.length === 0}
              style={btnStyle('#10B981', entries.length === 0)}>
              <Mail size={12} />メールで送る
            </button>
            <button type="button" onClick={copyAll} disabled={entries.length === 0}
              style={btnStyle('#A78BFA', entries.length === 0)}>
              {copied ? <><Check size={12} />コピーしました</> : <><Copy size={12} />ぜんぶコピー</>}
            </button>
            <button type="button" onClick={refresh} style={btnStyle('rgba(255,255,255,0.6)', false)}>
              <RefreshCw size={12} />更新
            </button>
            <button type="button" onClick={clear} disabled={entries.length === 0}
              style={btnStyle('#F87171', entries.length === 0)}>
              <Trash2 size={12} />ぜんぶ消す
            </button>
            <span style={{
              marginLeft: 'auto', alignSelf: 'center',
              fontSize: 10.5, color: 'rgba(255,255,255,0.5)',
            }}>{entries.length} 件 / 上限 50 件</span>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem 1.2rem 1.4rem' }}>
          {entries.length === 0 ? (
            <div style={{
              padding: '2rem 1rem', textAlign: 'center',
              color: 'rgba(255,255,255,0.5)', fontSize: 12.5,
            }}>
              いまのところ不具合は記録されていません。
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {entries.map((e, i) => (
                <li key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: '8px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 800,
                      color: TYPE_COLOR[e.type],
                      background: `${TYPE_COLOR[e.type]}22`,
                      padding: '2px 7px', borderRadius: 999, letterSpacing: '0.04em',
                    }}>{TYPE_LABEL[e.type]}</span>
                    <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>
                      {formatTs(e.ts)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 11.5, color: '#fff', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    lineHeight: 1.5, wordBreak: 'break-word',
                  }}>{e.message}</div>
                  {e.stack && (
                    <details style={{ marginTop: 5 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>詳細</summary>
                      <pre style={{
                        marginTop: 4, fontSize: 10.5, color: 'rgba(255,255,255,0.55)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      }}>{e.stack.slice(0, 1200)}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function btnStyle(color: string, disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color: color,
    padding: '6px 12px', borderRadius: 999,
    fontSize: 11.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    minHeight: 32,
  };
}
