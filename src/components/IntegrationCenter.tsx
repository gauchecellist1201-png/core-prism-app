// ============================================================
// IntegrationCenter — 有名アプリとの連携を「わかりやすい 3 ステップ」で
//
// オーナー指示 (2026-05-17):
//   Gmail / Google カレンダー / HubSpot / Notion / Google Drive など
//   有名アプリ全部との連携を、アプリ名+アイコン付きで表示。
//   それぞれちゃんと連携できるように。
//
// 連携方式:
//   oauth   … ボタン一発で Google ログイン (Gmail / カレンダー)
//   token   … API トークン / キーを貼り付けて保存
//   webhook … Webhook URL を貼り付けて保存
//   guide   … 3 ステップの手順を表示
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, ArrowRight, Loader2 } from 'lucide-react';
import {
  isGmailConfigured, isGmailConnected, connectGmail, clearGmailToken,
} from '../lib/gmail';
import {
  isCalConfigured, isCalConnected, connectCalendar, clearCalToken,
} from '../lib/googleCalendar';

interface Props {
  onClose: () => void;
  accent?: string;
}

type ConnectKind = 'oauth' | 'token' | 'webhook' | 'guide';
type ToolStatus = 'connected' | 'ready' | 'preparing';

interface Tool {
  id: string;
  name: string;
  /** ブランドカラー */
  color: string;
  /** アイコンに描く頭文字 or 記号 (1〜2 文字) */
  glyph: string;
  /** Instagram のようなグラデ背景にしたい場合 */
  gradient?: string;
  category: string;
  can: string;
  kind: ConnectKind;
  steps: string[];
  /** token / webhook 入力のプレースホルダ */
  inputHint?: string;
  oauthConnect?: () => Promise<void>;
}

// localStorage キー: token/webhook 連携の保存先
const tokenKey = (id: string) => `core_integration_${id}`;
function loadToken(id: string): string { return localStorage.getItem(tokenKey(id)) || ''; }
function saveTokenLS(id: string, v: string) { localStorage.setItem(tokenKey(id), v.trim()); }
function clearTokenLS(id: string) { localStorage.removeItem(tokenKey(id)); }

// ─── 連携できる有名アプリ一覧 ───────────────────────
const CATALOG: Tool[] = [
  // Google ワークスペース
  {
    id: 'gmail', name: 'Gmail', color: '#EA4335', glyph: 'M', category: 'Google ワークスペース',
    can: '届いたメールに AI が返信を下書き。確認して送るだけ',
    kind: 'oauth',
    steps: ['「Gmail とつなぐ」を押す', 'Google アカウントでログイン', 'メールの読み取りを許可 → 完了'],
    oauthConnect: async () => { await connectGmail(); },
  },
  {
    id: 'gcal', name: 'Google カレンダー', color: '#4285F4', glyph: '31', category: 'Google ワークスペース',
    can: '予定を AI が把握し、会議準備や移動を先回りで提案',
    kind: 'oauth',
    steps: ['「カレンダーとつなぐ」を押す', 'Google アカウントでログイン', '予定の読み取りを許可 → 完了'],
    oauthConnect: async () => { await connectCalendar(); },
  },
  {
    id: 'gdrive', name: 'Google ドライブ', color: '#1FA463', glyph: '▲', category: 'Google ワークスペース',
    can: '資料を AI が読み込み、ナレッジとして活用',
    kind: 'token',
    inputHint: 'Google Drive 共有フォルダの URL',
    steps: ['ドライブで対象フォルダを「リンクを知っている全員」に', 'フォルダの共有 URL をコピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'gdocs', name: 'Google ドキュメント', color: '#4285F4', glyph: '≡', category: 'Google ワークスペース',
    can: '議事録や提案書を Google ドキュメントに自動で書き出し',
    kind: 'guide',
    steps: ['Gmail 連携を済ませる (同じ Google アカウント)', '書き出し先のフォルダを選ぶ', '以後 AI が自動で保存'],
  },
  {
    id: 'gsheets', name: 'Google スプレッドシート', color: '#0F9D58', glyph: '田', category: 'Google ワークスペース',
    can: '売上・経費の数字をスプレッドシートに自動集計',
    kind: 'token',
    inputHint: 'スプレッドシートの共有 URL',
    steps: ['対象シートを「リンクを知っている全員」で共有', '共有 URL をコピー', '下に貼り付けて保存 → 完了'],
  },
  // 営業・CRM
  {
    id: 'hubspot', name: 'HubSpot', color: '#FF7A59', glyph: 'H', category: '営業 / CRM',
    can: '見込み客と商談を CRM と同期。AI が次の一手を提案',
    kind: 'token',
    inputHint: 'HubSpot プライベートアプリのアクセストークン',
    steps: ['HubSpot 設定 → 連携 → プライベートアプリ を作成', 'アクセストークンをコピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'salesforce', name: 'Salesforce', color: '#00A1E0', glyph: '☁', category: '営業 / CRM',
    can: '商談データを Salesforce と双方向で同期',
    kind: 'guide',
    steps: ['Salesforce で接続アプリを作成', 'コンシューマー鍵を CORE サポートに連携', '審査後に自動で有効化'],
  },
  // 仕事・整理
  {
    id: 'notion', name: 'Notion', color: '#0A0A0A', glyph: 'N', category: '仕事・整理',
    can: '議事録・メモ・ナレッジを Notion に自動保存',
    kind: 'token',
    inputHint: 'Notion インテグレーションのシークレットトークン',
    steps: ['Notion の「インテグレーション」を新規作成', 'シークレット (secret_…) をコピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'slack', name: 'Slack', color: '#4A154B', glyph: '#', category: '仕事・整理',
    can: 'AI の提案や重要通知を Slack に届ける',
    kind: 'webhook',
    inputHint: 'Slack の受信 Webhook URL (https://hooks.slack.com/…)',
    steps: ['Slack アプリで「Incoming Webhook」を有効化', 'Webhook URL を発行・コピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'trello', name: 'Trello', color: '#0079BF', glyph: 'T', category: '仕事・整理',
    can: 'タスクを Trello ボードと同期',
    kind: 'token',
    inputHint: 'Trello API キー',
    steps: ['trello.com/app-key で API キーを取得', 'キーをコピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'asana', name: 'Asana', color: '#F06A6A', glyph: 'a', category: '仕事・整理',
    can: 'プロジェクトとタスクを Asana と同期',
    kind: 'token',
    inputHint: 'Asana パーソナルアクセストークン',
    steps: ['Asana 設定 → アプリ → 開発者コンソール', 'アクセストークンを発行・コピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'ms365', name: 'Microsoft 365', color: '#D83B01', glyph: '⊞', category: '仕事・整理',
    can: 'Outlook メール・予定・Teams を CORE と連携',
    kind: 'guide',
    steps: ['Microsoft Entra でアプリ登録', 'クライアント ID を CORE サポートに連携', '審査後に自動で有効化'],
  },
  // 保存・会議
  {
    id: 'dropbox', name: 'Dropbox', color: '#0061FF', glyph: '▽', category: '保存・会議',
    can: 'Dropbox の資料を AI が読み込みナレッジ化',
    kind: 'token',
    inputHint: 'Dropbox アクセストークン',
    steps: ['Dropbox App Console でアプリを作成', 'アクセストークンを生成・コピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'zoom', name: 'Zoom', color: '#2D8CFF', glyph: 'Z', category: '保存・会議',
    can: '会議の録画を AI が議事録に自動変換',
    kind: 'guide',
    steps: ['Zoom Marketplace でアプリを作成', 'JWT / OAuth 情報を CORE サポートに連携', '審査後に自動で有効化'],
  },
  // お金
  {
    id: 'stripe', name: 'Stripe', color: '#635BFF', glyph: 'S', category: 'お金まわり',
    can: '売上・サブスクの数字を Stripe からそのまま取り込み',
    kind: 'token',
    inputHint: 'Stripe 制限付き API キー (rk_live_… 推奨)',
    steps: ['Stripe ダッシュボード → 開発者 → API キー', '「読み取り専用」の制限付きキーを作成', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'freee', name: 'freee 会計', color: '#0F8FE0', glyph: 'f', category: 'お金まわり',
    can: '会計データを freee と同期し P&L を自動生成',
    kind: 'token',
    inputHint: 'freee アクセストークン',
    steps: ['freee アプリストアで開発者登録', 'アクセストークンを発行・コピー', '下に貼り付けて保存 → 完了'],
  },
  {
    id: 'mfcloud', name: 'マネーフォワード', color: '#1C9DD9', glyph: 'MF', category: 'お金まわり',
    can: '会計・経費データをマネーフォワードと同期',
    kind: 'token',
    inputHint: 'マネーフォワード API トークン',
    steps: ['MF クラウド API の利用申請', 'トークンを発行・コピー', '下に貼り付けて保存 → 完了'],
  },
  // SNS
  {
    id: 'instagram', name: 'Instagram', color: '#E1306C',
    gradient: 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)',
    glyph: '◎', category: 'SNS',
    can: 'フォロワー分析と案件マッチに使用 (Iris と共通)',
    kind: 'guide',
    steps: ['Iris の「Instagram 連携」から接続', 'ユーザー名・フォロワー数を登録', '案件マッチと分析が自動で動きます'],
  },
  {
    id: 'x', name: 'X (Twitter)', color: '#0A0A0A', glyph: '𝕏', category: 'SNS',
    can: '投稿の予約と反応分析を X と連携',
    kind: 'guide',
    steps: ['X 開発者ポータルでアプリを作成', 'API キーを CORE サポートに連携', '審査後に自動で有効化'],
  },
  {
    id: 'line', name: 'LINE', color: '#06C755', glyph: 'L', category: 'SNS',
    can: 'AI の提案やリマインドを LINE に届ける',
    kind: 'token',
    inputHint: 'LINE Notify トークン',
    steps: ['notify-bot.line.me でトークンを発行', 'トークンをコピー', '下に貼り付けて保存 → 完了'],
  },
  // 健康
  {
    id: 'apple-watch', name: 'Apple Watch / ヘルス', color: '#FF2D55', glyph: '♥', category: '健康',
    can: '心拍・睡眠・歩数を毎朝 自動で取り込み、体調を見守る',
    kind: 'guide',
    steps: ['iPhone「ショートカット」に CORE 用ショートカットを追加', '「オートメーション」で毎朝の自動実行を ON', '初回だけ手でタップ → 以後 毎朝 自動で届きます'],
  },
];

const CATEGORY_ORDER = [
  'Google ワークスペース', '営業 / CRM', '仕事・整理', '保存・会議', 'お金まわり', 'SNS', '健康',
];

export default function IntegrationCenter({ onClose, accent = '#2E6FFF' }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; msg: string } | null>(null);
  const [, forceRender] = useState(0);
  const refresh = () => forceRender(n => n + 1);

  const statusOf = (t: Tool): ToolStatus => {
    if (t.id === 'gmail') return isGmailConnected() ? 'connected' : isGmailConfigured() ? 'ready' : 'preparing';
    if (t.id === 'gcal')  return isCalConnected() ? 'connected' : isCalConfigured() ? 'ready' : 'preparing';
    if (t.kind === 'token' || t.kind === 'webhook') return loadToken(t.id) ? 'connected' : 'ready';
    return 'ready'; // guide はいつでも手順表示
  };

  const connectedCount = CATALOG.filter(t => statusOf(t) === 'connected').length;

  const handleOauth = async (t: Tool) => {
    if (!t.oauthConnect) return;
    setError(null); setBusyId(t.id);
    try { await t.oauthConnect(); refresh(); }
    catch (e: any) { setError({ id: t.id, msg: e?.message || '連携に失敗しました。もう一度お試しください。' }); }
    finally { setBusyId(null); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(8,8,18,0.8)', backdropFilter: 'blur(14px)',
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
          maxWidth: 600, width: '100%',
          maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
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
          {CATALOG.length} のアプリと連携できます。
          {connectedCount > 0 && <strong style={{ color: '#10B981' }}> 連携済み {connectedCount} 件。</strong>}
          手順は 3 ステップだけ。
        </p>

        {CATEGORY_ORDER.map(cat => {
          const items = CATALOG.filter(t => t.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: '1.1rem' }}>
              <div style={{
                fontSize: 10, letterSpacing: '0.18em', fontWeight: 800,
                color: 'rgba(255,255,255,0.4)', marginBottom: 8, textTransform: 'uppercase',
              }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.map(t => (
                  <ToolCard
                    key={t.id}
                    tool={t}
                    status={statusOf(t)}
                    accent={accent}
                    busy={busyId === t.id}
                    error={error?.id === t.id ? error.msg : null}
                    onOauth={() => handleOauth(t)}
                    onSaveToken={(v) => { saveTokenLS(t.id, v); refresh(); }}
                    onDisconnect={() => {
                      if (t.id === 'gmail') clearGmailToken();
                      else if (t.id === 'gcal') clearCalToken();
                      else clearTokenLS(t.id);
                      refresh();
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <p style={{
          fontSize: 10.5, color: 'rgba(255,255,255,0.4)',
          marginTop: '0.5rem', lineHeight: 1.7, textAlign: 'center',
        }}>
          連携情報はあなたのブラウザ内にのみ保存されます。<br />
          パスワードを CORE が預かることはありません。
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── ブランドアイコン ───────────────────────
function BrandIcon({ tool, size = 40 }: { tool: Tool; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.27, flexShrink: 0,
      background: tool.gradient || tool.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 900,
      fontSize: tool.glyph.length > 1 ? size * 0.34 : size * 0.46,
      letterSpacing: tool.glyph.length > 1 ? '-0.04em' : 0,
      boxShadow: `0 4px 12px ${tool.color}55`,
      border: tool.color === '#0A0A0A' ? '1px solid rgba(255,255,255,0.15)' : 'none',
    }}>
      {tool.glyph}
    </div>
  );
}

const STATUS_META: Record<ToolStatus, { label: string; color: string; bg: string }> = {
  connected: { label: '連携済み', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  ready:     { label: 'つなげます', color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' },
  preparing: { label: '準備中', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' },
};

function ToolCard({ tool, status, accent, busy, error, onOauth, onSaveToken, onDisconnect }: {
  tool: Tool; status: ToolStatus; accent: string; busy: boolean; error: string | null;
  onOauth: () => void; onSaveToken: (v: string) => void; onDisconnect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const s = STATUS_META[status];
  const isConnected = status === 'connected';

  return (
    <div style={{
      borderRadius: 14,
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${isConnected ? '#10B98144' : 'rgba(255,255,255,0.08)'}`,
      padding: '0.8rem 0.9rem',
    }}>
      {/* 上段 */}
      <button
        type="button"
        onClick={() => !isConnected && setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', cursor: isConnected ? 'default' : 'pointer',
          color: '#fff', padding: 0, textAlign: 'left',
        }}
      >
        <BrandIcon tool={tool} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{tool.name}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, marginTop: 1 }}>
            {tool.can}
          </div>
        </div>
        <span style={{
          fontSize: 9.5, fontWeight: 800, color: s.color, background: s.bg,
          padding: '4px 9px', borderRadius: 999, flexShrink: 0,
        }}>{s.label}</span>
      </button>

      {/* 連携済み行 */}
      {isConnected && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 8, gap: 8,
        }}>
          <span style={{
            fontSize: 11, color: '#10B981', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 4,
          }}><Check size={12} /> 連携が有効です</span>
          <button
            type="button" onClick={onDisconnect}
            style={{
              fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.05)', border: 'none',
              borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
            }}
          >解除</button>
        </div>
      )}

      {/* 展開: ステップ + 接続 UI */}
      {!isConnected && expanded && (
        <div style={{ marginTop: 10 }}>
          {tool.steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
              <span style={{
                width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                background: accent, color: '#fff', fontSize: 10, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
              }}>{i + 1}</span>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}

          {error && (
            <div style={{
              fontSize: 11, color: '#F87171', lineHeight: 1.5,
              background: 'rgba(248,113,113,0.1)', borderRadius: 8,
              padding: '6px 9px', margin: '8px 0',
            }}>⚠ {error}</div>
          )}

          {/* OAuth ボタン */}
          {tool.kind === 'oauth' && status === 'ready' && (
            <button
              type="button" onClick={onOauth} disabled={busy}
              style={{
                width: '100%', marginTop: 8,
                fontSize: 12.5, fontWeight: 800, color: '#fff',
                background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
                border: 'none', borderRadius: 999, padding: '9px 16px',
                cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {busy
                ? <><Loader2 size={14} className="spin" /> つないでいます…</>
                : <>{tool.name} とつなぐ <ArrowRight size={14} /></>}
            </button>
          )}
          {tool.kind === 'oauth' && status === 'preparing' && (
            <div style={{
              fontSize: 10.5, color: '#FBBF24', lineHeight: 1.5,
              background: 'rgba(251,191,36,0.08)', borderRadius: 8,
              padding: '6px 9px', marginTop: 8,
            }}>連携の準備中です。Google の設定が済み次第、自動で「つなぐ」ボタンが有効になります。</div>
          )}

          {/* token / webhook 入力 */}
          {(tool.kind === 'token' || tool.kind === 'webhook') && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder={tool.inputHint}
                style={{
                  flex: 1, fontSize: 12, padding: '8px 10px', borderRadius: 9,
                  background: 'rgba(255,255,255,0.06)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.12)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => { if (tokenInput.trim()) onSaveToken(tokenInput); }}
                style={{
                  fontSize: 12, fontWeight: 800, color: '#fff',
                  background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
                  border: 'none', borderRadius: 9, padding: '8px 14px', cursor: 'pointer',
                  flexShrink: 0,
                }}
              >保存</button>
            </div>
          )}

          {/* guide のみ */}
          {tool.kind === 'guide' && (
            <div style={{
              fontSize: 10.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5,
              marginTop: 8,
            }}>手順どおりに進めると連携できます。不明点は AI に聞いてください。</div>
          )}
        </div>
      )}

      {/* 折りたたみ時のヒント */}
      {!isConnected && !expanded && (
        <div style={{
          fontSize: 10, color: accent, fontWeight: 700,
          marginTop: 6, display: 'flex', alignItems: 'center', gap: 3,
        }}>
          タップして連携手順を見る <ArrowRight size={10} />
        </div>
      )}

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
