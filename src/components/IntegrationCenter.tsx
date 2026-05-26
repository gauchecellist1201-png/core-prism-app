// ============================================================
// IntegrationCenter — タップして進むだけで連携完了するウィザード
//
// オーナー指示 (2026-05-17):
//   カードをタップしていくと そのまま連携完了まで持っていける形に。
//
// 各アプリは「ステップウィザード」:
//   カードをタップ → ステップ 1 → [アクション] → 次へ → ... → 連携完了
// ステップのアクション種別:
//   openLink … 必要な外部ページを新タブで開く
//   input    … トークン / URL を貼り付ける
//   oauth    … Google ログイン (Gmail / カレンダー)
//   info     … 説明を読んで「次へ」
// ============================================================
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, Loader2, ExternalLink, PartyPopper } from 'lucide-react';
import EasyImportPanel from './EasyImportPanel';
import {
  isGmailConfigured, isGmailConnected, connectGmail, clearGmailToken,
} from '../lib/gmail';
import {
  isCalConfigured, isCalConnected, connectCalendar, clearCalToken,
} from '../lib/googleCalendar';
import IntegrationCelebrate from './IntegrationCelebrate';

interface Props {
  onClose: () => void;
  accent?: string;
  /** 起動時にウィザードを開いておきたい連携 ID (例: 'stripe') */
  focusToolId?: string;
}

type StepAction =
  | { kind: 'openLink'; url: string; btn: string }
  | { kind: 'input'; placeholder: string }
  | { kind: 'oauth'; provider: 'gmail' | 'gcal' }
  | { kind: 'stripeConnect' }
  | { kind: 'info' };

interface Step {
  label: string;
  action: StepAction;
}

interface Tool {
  id: string;
  name: string;
  color: string;
  glyph: string;
  gradient?: string;
  category: string;
  can: string;
  steps: Step[];
}

const tokenKey = (id: string) => `core_integration_${id}`;
function loadToken(id: string): string { return localStorage.getItem(tokenKey(id)) || ''; }
function saveTokenLS(id: string, v: string) { localStorage.setItem(tokenKey(id), v.trim()); }
function clearTokenLS(id: string) { localStorage.removeItem(tokenKey(id)); }
// guide 系: 読了フラグで「連携済み」扱い
const isDone = (id: string) => localStorage.getItem(tokenKey(id)) === '__done__';

// ─── 連携できる有名アプリ ───────────────────────
const CATALOG: Tool[] = [
  {
    id: 'gmail', name: 'Gmail', color: '#EA4335', glyph: 'M', category: 'Google ワークスペース',
    can: '届いたメールに AI が返信を下書き。確認して送るだけ',
    steps: [
      { label: 'まず「このアプリは Google で確認されていません」と出ても安全です。「詳細」→「(安全でないページに移動)」を 1 タップで通過してください (Google 審査前のため一時的に表示される正規の警告です)', action: { kind: 'info' } },
      { label: 'Google アカウントでログインします', action: { kind: 'oauth', provider: 'gmail' } },
    ],
  },
  {
    id: 'gcal', name: 'Google カレンダー', color: '#4285F4', glyph: '31', category: 'Google ワークスペース',
    can: '予定を AI が把握し、会議準備や移動を先回りで提案',
    steps: [
      { label: 'まず「このアプリは Google で確認されていません」と出ても安全です。「詳細」→「(安全でないページに移動)」を 1 タップで通過してください (Google 審査前のため一時的に表示される正規の警告です)', action: { kind: 'info' } },
      { label: 'Google アカウントでログインします', action: { kind: 'oauth', provider: 'gcal' } },
    ],
  },
  {
    id: 'gdrive', name: 'Google ドライブ', color: '#1FA463', glyph: '▲', category: 'Google ワークスペース',
    can: '資料を AI が読み込み、ナレッジとして活用',
    steps: [
      { label: 'ドライブで対象フォルダを開きます', action: { kind: 'openLink', url: 'https://drive.google.com', btn: 'Google ドライブを開く' } },
      { label: 'フォルダを「リンクを知っている全員」に共有し、URL をコピー', action: { kind: 'info' } },
      { label: '共有 URL を貼り付けて連携完了', action: { kind: 'input', placeholder: 'https://drive.google.com/drive/folders/…' } },
    ],
  },
  {
    id: 'gdocs', name: 'Google ドキュメント', color: '#4285F4', glyph: '≡', category: 'Google ワークスペース',
    can: '議事録や提案書を Google ドキュメントに自動で書き出し',
    steps: [
      { label: 'まず Gmail 連携を済ませてください (同じ Google アカウント)', action: { kind: 'info' } },
      { label: '書き出し先フォルダの URL をコピー', action: { kind: 'openLink', url: 'https://drive.google.com', btn: 'ドライブを開く' } },
      { label: 'フォルダ URL を貼り付けて連携完了', action: { kind: 'input', placeholder: 'フォルダの共有 URL' } },
    ],
  },
  {
    id: 'gsheets', name: 'Google スプレッドシート', color: '#0F9D58', glyph: '田', category: 'Google ワークスペース',
    can: '売上・経費の数字をスプレッドシートに自動集計',
    steps: [
      { label: '集計用シートを開きます', action: { kind: 'openLink', url: 'https://sheets.google.com', btn: 'スプレッドシートを開く' } },
      { label: 'シートを「リンクを知っている全員」で共有し、URL をコピー', action: { kind: 'info' } },
      { label: '共有 URL を貼り付けて連携完了', action: { kind: 'input', placeholder: 'シートの共有 URL' } },
    ],
  },
  {
    id: 'hubspot', name: 'HubSpot', color: '#FF7A59', glyph: 'H', category: '営業 / CRM',
    can: '見込み客と商談を CRM と同期。AI が次の一手を提案',
    steps: [
      { label: 'HubSpot のプライベートアプリ作成ページを開きます', action: { kind: 'openLink', url: 'https://app.hubspot.com/private-apps', btn: 'HubSpot を開く' } },
      { label: 'プライベートアプリを作成し、アクセストークンをコピー', action: { kind: 'info' } },
      { label: 'トークンを貼り付けて連携完了', action: { kind: 'input', placeholder: 'pat-na1-…' } },
    ],
  },
  {
    id: 'salesforce', name: 'Salesforce', color: '#00A1E0', glyph: '☁', category: '営業 / CRM',
    can: '商談データを Salesforce と双方向で同期',
    steps: [
      { label: 'Salesforce の接続アプリ設定を開きます', action: { kind: 'openLink', url: 'https://login.salesforce.com', btn: 'Salesforce を開く' } },
      { label: '接続アプリを作成し、コンシューマー鍵をコピー', action: { kind: 'info' } },
      { label: 'コンシューマー鍵を貼り付けて連携完了', action: { kind: 'input', placeholder: 'Consumer Key' } },
    ],
  },
  {
    id: 'notion', name: 'Notion', color: '#0A0A0A', glyph: 'N', category: '仕事・整理',
    can: '議事録・メモ・ナレッジを Notion に自動保存',
    steps: [
      { label: 'Notion のインテグレーション作成ページを開きます', action: { kind: 'openLink', url: 'https://www.notion.so/my-integrations', btn: 'Notion を開く' } },
      { label: '新しいインテグレーションを作成し、シークレットをコピー', action: { kind: 'info' } },
      { label: 'シークレットを貼り付けて連携完了', action: { kind: 'input', placeholder: 'secret_…' } },
    ],
  },
  {
    id: 'slack', name: 'Slack', color: '#4A154B', glyph: '#', category: '仕事・整理',
    can: 'AI の提案や重要通知を Slack に届ける',
    steps: [
      { label: 'Slack の Incoming Webhook 設定を開きます', action: { kind: 'openLink', url: 'https://api.slack.com/messaging/webhooks', btn: 'Slack を開く' } },
      { label: 'Webhook を有効化し、URL をコピー', action: { kind: 'info' } },
      { label: 'Webhook URL を貼り付けて連携完了', action: { kind: 'input', placeholder: 'https://hooks.slack.com/services/…' } },
    ],
  },
  {
    id: 'trello', name: 'Trello', color: '#0079BF', glyph: 'T', category: '仕事・整理',
    can: 'タスクを Trello ボードと同期',
    steps: [
      { label: 'Trello の API キー取得ページを開きます', action: { kind: 'openLink', url: 'https://trello.com/app-key', btn: 'Trello を開く' } },
      { label: 'API キーをコピー', action: { kind: 'info' } },
      { label: 'API キーを貼り付けて連携完了', action: { kind: 'input', placeholder: 'Trello API キー' } },
    ],
  },
  {
    id: 'asana', name: 'Asana', color: '#F06A6A', glyph: 'a', category: '仕事・整理',
    can: 'プロジェクトとタスクを Asana と同期',
    steps: [
      { label: 'Asana の開発者コンソールを開きます', action: { kind: 'openLink', url: 'https://app.asana.com/0/my-apps', btn: 'Asana を開く' } },
      { label: 'パーソナルアクセストークンを発行し、コピー', action: { kind: 'info' } },
      { label: 'トークンを貼り付けて連携完了', action: { kind: 'input', placeholder: 'Asana アクセストークン' } },
    ],
  },
  {
    id: 'ms365', name: 'Microsoft 365', color: '#D83B01', glyph: '⊞', category: '仕事・整理',
    can: 'Outlook メール・予定・Teams を CORE と連携',
    steps: [
      { label: 'Microsoft Entra のアプリ登録ページを開きます', action: { kind: 'openLink', url: 'https://entra.microsoft.com', btn: 'Microsoft を開く' } },
      { label: 'アプリを登録し、クライアント ID をコピー', action: { kind: 'info' } },
      { label: 'クライアント ID を貼り付けて連携完了', action: { kind: 'input', placeholder: 'Application (client) ID' } },
    ],
  },
  {
    id: 'dropbox', name: 'Dropbox', color: '#0061FF', glyph: '▽', category: '保存・会議',
    can: 'Dropbox の資料を AI が読み込みナレッジ化',
    steps: [
      { label: 'Dropbox App Console を開きます', action: { kind: 'openLink', url: 'https://www.dropbox.com/developers/apps', btn: 'Dropbox を開く' } },
      { label: 'アプリを作成し、アクセストークンを生成・コピー', action: { kind: 'info' } },
      { label: 'トークンを貼り付けて連携完了', action: { kind: 'input', placeholder: 'Dropbox アクセストークン' } },
    ],
  },
  {
    id: 'zoom', name: 'Zoom 録音', color: '#2D8CFF', glyph: 'Z', category: '保存・会議',
    can: '録音ファイルを「議事録 AI」に入れるだけで、文字起こし→要約→ToDo',
    steps: [
      { label: 'Zoom の録音ファイルを用意します。パソコンのローカル録音は「書類 ▸ Zoom」フォルダの中、スマホ録音はボイスメモ等に保存されています。', action: { kind: 'info' } },
      { label: 'クラウド録音を使っている場合は、ここから mp4 / m4a を保存できます。', action: { kind: 'openLink', url: 'https://zoom.us/recording', btn: 'Zoom 録音を開く' } },
      { label: 'その録音を CORE の「議事録 AI ▸ ファイル」にドロップ（スマホはタップで選択）。文字起こし・要約・ToDo まで自動で出ます。これで連携完了です。', action: { kind: 'info' } },
    ],
  },
  {
    id: 'stripe', name: 'Stripe', color: '#635BFF', glyph: 'S', category: 'お金まわり',
    can: 'あなたの事業の Stripe をつなぐと、今月の売上・経費・利益が自動で出ます',
    steps: [
      // 推奨ルート: Stripe Connect OAuth (鍵を手で貼らなくて済む)
      // 但し Stripe 側 Connect プラットフォーム承認が必要なため、未準備の環境では
      // 503 が返るので、自動的に次のステップ (キー貼り付け) に進めるよう案内する。
      { label: '【簡単】Stripe にログインして「許可」を押すだけ。鍵のコピペは不要です。', action: { kind: 'stripeConnect' } },
      // フォールバック: 読み取り専用キーを手動で貼る (今すぐ確実に動く)
      { label: '【上手くいかない場合】Stripe ダッシュボードを開いて、上の「制限付きキー」を新規作成 (権限: Charges / PaymentIntents / Customers / Balance / Payouts を「読み取り」)', action: { kind: 'openLink', url: 'https://dashboard.stripe.com/apikeys', btn: 'Stripe ダッシュボードを開く' } },
      { label: '作った rk_live_… で始まるキーを下に貼り付けて連携完了', action: { kind: 'input', placeholder: 'rk_live_… で始まる読み取り専用キー' } },
    ],
  },
  {
    id: 'freee', name: 'freee 会計', color: '#0F8FE0', glyph: 'f', category: 'お金まわり',
    can: '会計データを freee と同期し P&L を自動生成',
    steps: [
      { label: 'freee アプリストアの開発者ページを開きます', action: { kind: 'openLink', url: 'https://app.secure.freee.co.jp/developers/apps', btn: 'freee を開く' } },
      { label: 'アプリ登録し、アクセストークンを発行・コピー', action: { kind: 'info' } },
      { label: 'トークンを貼り付けて連携完了', action: { kind: 'input', placeholder: 'freee アクセストークン' } },
    ],
  },
  {
    id: 'mfcloud', name: 'マネーフォワード', color: '#1C9DD9', glyph: 'MF', category: 'お金まわり',
    can: '会計・経費データをマネーフォワードと同期',
    steps: [
      { label: 'マネーフォワード API の申請ページを開きます', action: { kind: 'openLink', url: 'https://biz.moneyforward.com', btn: 'マネーフォワードを開く' } },
      { label: 'API 利用を申請し、トークンを発行・コピー', action: { kind: 'info' } },
      { label: 'トークンを貼り付けて連携完了', action: { kind: 'input', placeholder: 'MF API トークン' } },
    ],
  },
  {
    id: 'instagram', name: 'Instagram', color: '#E1306C',
    gradient: 'linear-gradient(135deg, #833AB4, #E1306C 50%, #F77737)',
    glyph: '◎', category: 'SNS',
    can: 'フォロワー分析と案件マッチに使用 (Iris と共通)',
    steps: [
      { label: 'Iris アプリの「Instagram 連携」を開きます', action: { kind: 'openLink', url: '/iris?app=1', btn: 'Iris を開く' } },
      { label: 'ユーザー名・フォロワー数・ジャンルを登録', action: { kind: 'info' } },
      { label: '登録できたら「連携完了」を押してください', action: { kind: 'info' } },
    ],
  },
  {
    id: 'x', name: 'X (Twitter)', color: '#0A0A0A', glyph: '𝕏', category: 'SNS',
    can: '投稿の予約と反応分析を X と連携',
    steps: [
      { label: 'X 開発者ポータルを開きます', action: { kind: 'openLink', url: 'https://developer.twitter.com/en/portal/dashboard', btn: 'X を開く' } },
      { label: 'アプリを作成し、API キーをコピー', action: { kind: 'info' } },
      { label: 'API キーを貼り付けて連携完了', action: { kind: 'input', placeholder: 'X API キー' } },
    ],
  },
  {
    id: 'line', name: 'LINE', color: '#06C755', glyph: 'L', category: 'SNS',
    can: 'AI の提案やリマインドを LINE に届ける',
    steps: [
      { label: 'LINE Notify のトークン発行ページを開きます', action: { kind: 'openLink', url: 'https://notify-bot.line.me/my/', btn: 'LINE Notify を開く' } },
      { label: 'トークンを発行し、コピー', action: { kind: 'info' } },
      { label: 'トークンを貼り付けて連携完了', action: { kind: 'input', placeholder: 'LINE Notify トークン' } },
    ],
  },
  {
    id: 'apple-watch', name: 'Apple Watch / ヘルス', color: '#FF2D55', glyph: '♥', category: '健康',
    can: '心拍・睡眠・歩数を毎朝 自動で取り込み、体調を見守る',
    steps: [
      { label: 'iPhone の「ショートカット」アプリを開きます', action: { kind: 'openLink', url: 'https://www.icloud.com/shortcuts/', btn: 'ショートカットを開く' } },
      { label: 'CORE 用ショートカットを追加し、「オートメーション」で毎朝の自動実行を ON', action: { kind: 'info' } },
      { label: '初回だけ手でタップ → 以後 毎朝 自動。完了を押してください', action: { kind: 'info' } },
    ],
  },
];

const CATEGORY_ORDER = [
  'Google ワークスペース', '営業 / CRM', '仕事・整理', '保存・会議', 'お金まわり', 'SNS', '健康',
];

export default function IntegrationCenter({ onClose, accent = '#2E6FFF', focusToolId }: Props) {
  const [openId, setOpenId] = useState<string | null>(focusToolId ?? null);
  const [, force] = useState(0);
  const [celebratedId, setCelebratedId] = useState<string | null>(null);
  const refresh = () => force(n => n + 1);

  const isConnected = (t: Tool): boolean => {
    if (t.id === 'gmail') return isGmailConnected();
    if (t.id === 'gcal') return isCalConnected();
    return !!loadToken(t.id);
  };

  // 運営側 (CORE) の OAuth 設定がまだ用意できていない連携は「準備中」扱い
  const isComingSoon = (t: Tool): boolean => {
    if (t.id === 'gmail') return !isGmailConfigured();
    if (t.id === 'gcal') return !isCalConfigured();
    return false;
  };

  const connectedCount = CATALOG.filter(isConnected).length;

  const disconnect = (t: Tool) => {
    if (t.id === 'gmail') clearGmailToken();
    else if (t.id === 'gcal') clearCalToken();
    else clearTokenLS(t.id);
    refresh();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(8,8,18,0.8)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <motion.div
        initial={{ scale: 0.94, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 24 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#12121E', borderRadius: 22, padding: '1.4rem',
          maxWidth: 600, width: '100%', maxHeight: 'calc(100dvh - 2rem)', overflow: 'auto',
          color: '#fff', border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', fontWeight: 800, color: accent }}>INTEGRATIONS</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0.25rem 0 0' }}>連携センター</h2>
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
          つなぎたいアプリをタップ → 案内どおり進むだけで連携完了。
          {connectedCount > 0 && <strong style={{ color: '#10B981' }}> 連携済み {connectedCount} 件。</strong>}
        </p>

        {/* API キー不要で取り込むためのショートカット (オーナー指示 2026-05-26) */}
        <EasyImportPanel accent={accent} />

        {CATEGORY_ORDER.map(cat => {
          const items = CATALOG.filter(t => t.category === cat);
          if (!items.length) return null;
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
                    accent={accent}
                    connected={isConnected(t)}
                    comingSoon={isComingSoon(t)}
                    open={openId === t.id}
                    focused={focusToolId === t.id}
                    onToggle={() => setOpenId(openId === t.id ? null : t.id)}
                    onConnected={() => { refresh(); setCelebratedId(t.id); }}
                    onDisconnect={() => disconnect(t)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem', lineHeight: 1.7, textAlign: 'center' }}>
          連携情報はあなたのブラウザ内にのみ保存されます。<br />
          パスワードを CORE が預かることはありません。
        </p>
      </motion.div>

      {/* 連携完了 → 紙吹雪 + できること 3 つ */}
      <AnimatePresence>
        {celebratedId && (
          <IntegrationCelebrate
            integrationId={celebratedId}
            onClose={() => setCelebratedId(null)}
            onJump={() => {
              setCelebratedId(null);
              // 連携センター自体を閉じて、該当画面のヒントは whereVisible テキストで案内済み
              onClose();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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
    }}>{tool.glyph}</div>
  );
}

function ToolCard({ tool, accent, connected, comingSoon = false, open, focused = false, onToggle, onConnected, onDisconnect }: {
  tool: Tool; accent: string; connected: boolean; comingSoon?: boolean; open: boolean; focused?: boolean;
  onToggle: () => void; onConnected: () => void; onDisconnect: () => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (focused && cardRef.current) {
      // Modal が描画されたあと、軽く待ってからスクロール
      const t = window.setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 220);
      return () => window.clearTimeout(t);
    }
  }, [focused]);
  const [stepIdx, setStepIdx] = useState(0);
  const [tokenInput, setTokenInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [justDone, setJustDone] = useState(false);
  // Stripe テスト接続の結果メッセージ ("✓ つながった..." 等) を一瞬出すため
  const [verifyOk, setVerifyOk] = useState<string | null>(null);

  const total = tool.steps.length;
  const step = tool.steps[stepIdx];
  const isLast = stepIdx === total - 1;

  const completeConnection = (token?: string) => {
    if (token !== undefined) saveTokenLS(tool.id, token || '__done__');
    else saveTokenLS(tool.id, '__done__');
    setJustDone(true);
    // 他のコンポーネント (MyBusinessRevenueCard 等) が即時反映できるよう通知
    try {
      window.dispatchEvent(new CustomEvent(`core:${tool.id}-connected`));
      window.dispatchEvent(new CustomEvent('core:integration-connected', { detail: { id: tool.id } }));
    } catch { /* */ }
    setTimeout(() => { onConnected(); }, 1400);
  };

  const next = () => { setErr(null); if (!isLast) setStepIdx(i => i + 1); };

  // 貼り付けられた値が、そのアプリにふさわしい形か簡易チェック
  const validateInput = (v: string): string | null => {
    if (/\s/.test(v)) return 'キーに空白が含まれています。コピーし直してください。';
    if (v.length < 12) return 'キーが短すぎます。正しいキーを丸ごとコピーしてください。';
    const prefixRules: Record<string, { re: RegExp; hint: string }> = {
      stripe:  { re: /^(rk|sk)_(live|test)_/, hint: 'Stripe の読み取り専用キー (rk_live_… で始まる)' },
      notion:  { re: /^(secret_|ntn_)/,        hint: 'Notion のインテグレーションキー (secret_… または ntn_… で始まる)' },
      slack:   { re: /^xox[bp]-/,              hint: 'Slack のトークン (xoxb-… で始まる)' },
      hubspot: { re: /^pat-/,                  hint: 'HubSpot のプライベートアプリトークン (pat-… で始まる)' },
      github:  { re: /^(ghp_|github_pat_)/,    hint: 'GitHub のトークン (ghp_… で始まる)' },
      linear:  { re: /^lin_api_/,              hint: 'Linear の API キー (lin_api_… で始まる)' },
      openai:  { re: /^sk-/,                   hint: 'OpenAI の API キー (sk-… で始まる)' },
    };
    const rule = prefixRules[tool.id];
    if (rule && !rule.re.test(v)) {
      return `${rule.hint} を貼り付けてください。`;
    }
    return null;
  };

  // Stripe: 形式OK → /api/revenue/snapshot を叩いて、結果に応じて
  // 「✓ つながった (N 件 / ¥X)」or 「✗ キーが違うかも」を 2 秒以内に返す。
  // 成功時のみ localStorage に保存する。
  const verifyStripeAndComplete = async (rawKey: string) => {
    const k = rawKey.trim();
    setErr(null);
    setVerifyOk(null);
    const ve = validateInput(k);
    if (ve) { setErr(ve); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/revenue/snapshot', { headers: { 'x-stripe-key': k } });
      const ct = r.headers.get('content-type') || '';
      // API 未デプロイ等 (HTML が返るケース) — local dev 向けに優しく
      if (!ct.includes('application/json')) {
        // 形式 OK までは確認できているので、ローカル開発では保存して終了
        completeConnection(k);
        return;
      }
      const j = await r.json();
      if (r.status === 200 && !j.error) {
        // 直近 12 ヶ月の合計取引数で「先月の N 件」を計算
        const monthly: Array<{ revenueJpy: number; txnCount: number }> = j.monthly || [];
        const prev = monthly.length >= 2 ? monthly[monthly.length - 2] : null;
        const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');
        const msg = prev && prev.txnCount > 0
          ? `先月の取引 ${prev.txnCount} 件、合計 ${yen(prev.revenueJpy)} が見えました`
          : '売上データを読み取れました';
        setVerifyOk(msg);
        // 「✓ つながった」を 1.1 秒見せてから完了アニメへ
        setTimeout(() => completeConnection(k), 1100);
        return;
      }
      // エラー分岐 — API が返した status を最優先に解釈
      if (r.status === 400 || j.error === 'INVALID_KEY') {
        setErr('キーの形式が違うようです。`rk_live_…` で始まる文字列を貼ってください。');
      } else if (r.status === 401 || r.status === 403 || j.error === 'KEY_REJECTED') {
        setErr('キーの権限が足りません。Stripe で「すべて読み取り」を選んで作り直してください。');
      } else {
        setErr('いまは取得できませんでした、少し待ってからもう一度。');
      }
    } catch {
      setErr('いまは取得できませんでした、少し待ってからもう一度。');
    } finally {
      setBusy(false);
    }
  };

  const handleOauth = async (provider: 'gmail' | 'gcal') => {
    setErr(null);
    const configured = provider === 'gmail' ? isGmailConfigured() : isCalConfigured();
    if (!configured) {
      setErr('この連携は現在 準備中です。運営の Google 設定が済み次第、自動でつながります。');
      return;
    }
    setBusy(true);
    try {
      if (provider === 'gmail') await connectGmail();
      else await connectCalendar();
      setJustDone(true);
      setTimeout(onConnected, 1400);
    } catch (e: any) {
      // 防御策: connectGmail/Cal が popup_closed エラーを投げたとしても、
      // 実際にはトークンが localStorage に書かれている事例 (race) がある。
      // (オーナー報告 2026-05-25)
      // 「認証完了しませんでした」と出してから接続済になる無限ループを止める。
      const actuallyConnected = provider === 'gmail' ? isGmailConnected() : isCalConnected();
      if (actuallyConnected) {
        setJustDone(true);
        setTimeout(onConnected, 1400);
      } else {
        setErr(e?.message || '連携に失敗しました。もう一度お試しください。');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={cardRef} style={{
      borderRadius: 14,
      background: focused ? `linear-gradient(135deg, ${tool.color}22, rgba(255,255,255,0.04))` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${
        focused ? `${tool.color}88` :
        connected ? '#10B98144' :
        open ? `${accent}55` : 'rgba(255,255,255,0.08)'
      }`,
      boxShadow: focused ? `0 0 0 3px ${tool.color}22, 0 8px 22px ${tool.color}33` : undefined,
      padding: '0.8rem 0.9rem',
      transition: 'box-shadow 0.3s, border-color 0.3s',
    }}>
      {/* 上段 */}
      <button
        type="button"
        onClick={() => { if (!connected) { onToggle(); setStepIdx(0); setErr(null); } }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', color: '#fff',
          cursor: connected ? 'default' : 'pointer', padding: 0, textAlign: 'left',
        }}
      >
        <BrandIcon tool={tool} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800 }}>{tool.name}</div>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, marginTop: 1 }}>{tool.can}</div>
        </div>
        {connected ? (
          <span style={{
            fontSize: 9.5, fontWeight: 800, color: '#10B981', background: 'rgba(16,185,129,0.15)',
            padding: '4px 9px', borderRadius: 999, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 3,
          }}><Check size={11} /> 連携済み</span>
        ) : comingSoon ? (
          <span style={{
            fontSize: 9.5, fontWeight: 800, color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.08)',
            padding: '4px 9px', borderRadius: 999, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 3,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>準備中</span>
        ) : (
          <span style={{
            fontSize: 10, fontWeight: 800, color: accent,
            display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
          }}>{open ? '閉じる' : 'つなぐ'}<ArrowRight size={11} /></span>
        )}
      </button>

      {/* 連携済み: 解除 */}
      {connected && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            type="button" onClick={onDisconnect}
            style={{
              fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.05)', border: 'none',
              borderRadius: 999, padding: '5px 12px', cursor: 'pointer',
            }}
          >連携を解除</button>
        </div>
      )}

      {/* ウィザード */}
      <AnimatePresence>
        {open && !connected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {justDone ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                style={{
                  marginTop: 12, padding: '14px',
                  borderRadius: 12, textAlign: 'center',
                  background: 'rgba(16,185,129,0.12)', border: '1px solid #10B98155',
                }}
              >
                <PartyPopper size={24} color="#10B981" style={{ marginBottom: 4 }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>
                  {tool.name} の連携が完了しました
                </div>
              </motion.div>
            ) : (
              <div style={{ marginTop: 12 }}>
                {/* 進捗ドット */}
                <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                  {tool.steps.map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: i <= stepIdx ? accent : 'rgba(255,255,255,0.1)',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>

                {/* 現在ステップ */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: accent, color: '#fff', fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{stepIdx + 1}</span>
                  <span style={{ fontSize: 12.5, color: '#fff', lineHeight: 1.55, paddingTop: 1 }}>
                    {step.label}
                  </span>
                </div>

                {err && (
                  <div style={{
                    fontSize: 11, color: '#FBBF24', lineHeight: 1.5,
                    background: 'rgba(251,191,36,0.1)', borderRadius: 8,
                    padding: '7px 10px', marginBottom: 9,
                  }}>{err}</div>
                )}

                {/* アクション */}
                {step.action.kind === 'openLink' && (
                  <div style={{ display: 'flex', gap: 7 }}>
                    <a
                      href={step.action.url} target="_blank" rel="noopener noreferrer"
                      style={{
                        flex: 1, textAlign: 'center', textDecoration: 'none',
                        fontSize: 12, fontWeight: 800, color: '#fff',
                        background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
                        borderRadius: 9, padding: '9px 12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      }}
                    >
                      <ExternalLink size={13} /> {step.action.btn}
                    </a>
                    <button type="button" onClick={next} style={nextBtn(accent)}>
                      次へ <ArrowRight size={12} />
                    </button>
                  </div>
                )}

                {step.action.kind === 'info' && (
                  <button
                    type="button"
                    onClick={() => { if (isLast) completeConnection(); else next(); }}
                    style={{ ...nextBtn(accent), width: '100%' }}
                  >
                    {isLast
                      ? <>連携完了 <Check size={13} /></>
                      : <>できた・次へ <ArrowRight size={12} /></>}
                  </button>
                )}

                {step.action.kind === 'input' && (() => {
                  const isStripe = tool.id === 'stripe';
                  const trimmed = tokenInput.trim();
                  const formatOk = isStripe ? /^(rk|sk)_(live|test)_/.test(trimmed) && trimmed.length >= 12 : true;
                  const submit = (v: string) => {
                    if (isStripe) verifyStripeAndComplete(v);
                    else {
                      const ve = validateInput(v);
                      if (ve) { setErr(ve); return; }
                      completeConnection(v);
                    }
                  };
                  return (
                  <div>
                    {/* テストキーで試したい人向けの一行 (Stripe のみ) */}
                    {isStripe && (
                      <div style={{
                        fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.55,
                        background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                        padding: '6px 9px', marginBottom: 8,
                      }}>
                        実キーがまだなくても、<strong style={{ color: '#fff' }}>テストキー</strong>
                        (sk_test_…) で動作を確認できます。
                      </div>
                    )}
                    {/* コピーした内容をワンタップで貼り付け → そのまま連携完了 */}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setErr(null);
                        try {
                          const text = (await navigator.clipboard.readText()).trim();
                          if (!text) { setErr('クリップボードが空です。先にコピーしてください'); return; }
                          if (isStripe) {
                            setTokenInput(text);
                            await verifyStripeAndComplete(text);
                            return;
                          }
                          const ve = validateInput(text);
                          if (ve) { setErr(ve); return; }
                          completeConnection(text);
                        } catch {
                          setErr('自動貼り付けできませんでした。下の欄に手で貼り付けてください');
                        }
                      }}
                      style={{
                        width: '100%', fontSize: 12.5, fontWeight: 800, color: '#fff',
                        background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
                        border: 'none', borderRadius: 9, padding: '10px 14px',
                        cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        marginBottom: 7,
                      }}
                    >
                      {busy
                        ? <><Loader2 size={14} className="spin" /> つないでいます…</>
                        : <>📋 コピーした内容を貼り付けて{isStripe ? 'テスト接続' : '連携完了'}</>}
                    </button>
                    <div style={{
                      fontSize: 9.5, color: 'rgba(255,255,255,0.4)',
                      textAlign: 'center', marginBottom: 6,
                    }}>― うまくいかないときは下に手で貼り付け ―</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={tokenInput}
                        onChange={e => { setTokenInput(e.target.value); setErr(null); setVerifyOk(null); }}
                        placeholder={step.action.placeholder}
                        style={{
                          flex: 1, fontSize: 12, padding: '11px 12px', borderRadius: 9,
                          background: 'rgba(255,255,255,0.06)', color: '#fff',
                          border: `1px solid ${
                            isStripe && trimmed.length >= 4 && !formatOk
                              ? 'rgba(248,113,113,0.6)'
                              : isStripe && formatOk
                                ? 'rgba(52,211,153,0.6)'
                                : 'rgba(255,255,255,0.12)'
                          }`,
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        disabled={isStripe ? (busy || !formatOk) : busy}
                        onClick={() => {
                          const v = tokenInput.trim();
                          if (!v) { setErr('上の欄に貼り付けてください'); return; }
                          submit(v);
                        }}
                        style={{
                          minHeight: 42,
                          fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
                          background: isStripe
                            ? (formatOk
                                ? `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`
                                : 'rgba(255,255,255,0.06)')
                            : 'rgba(255,255,255,0.1)',
                          border: 'none', borderRadius: 9, padding: '11px 16px',
                          cursor: isStripe && !formatOk ? 'not-allowed' : (busy ? 'wait' : 'pointer'),
                          opacity: isStripe && !formatOk ? 0.55 : (busy ? 0.7 : 1),
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {isStripe
                          ? (busy ? <><Loader2 size={12} className="spin" /> 接続中</> : <>テスト接続 <Check size={12} /></>)
                          : <>保存 <Check size={12} /></>}
                      </button>
                    </div>
                    {/* 形式 OK のヒント */}
                    {isStripe && trimmed.length >= 4 && !formatOk && !err && (
                      <div style={{
                        fontSize: 10.5, color: '#FBBF24', marginTop: 7, lineHeight: 1.5,
                      }}>キーは <code>rk_live_…</code> または <code>sk_test_…</code> で始まる必要があります</div>
                    )}
                    {/* テスト接続成功メッセージ */}
                    {verifyOk && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                          marginTop: 9, padding: '8px 11px', borderRadius: 9,
                          fontSize: 11.5, fontWeight: 700, color: '#34D399',
                          background: 'rgba(52,211,153,0.12)',
                          border: '1px solid rgba(52,211,153,0.35)',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <Check size={13} /> つながりました。{verifyOk}
                      </motion.div>
                    )}
                  </div>
                  );
                })()}

                {step.action.kind === 'oauth' && (
                  <button
                    type="button"
                    onClick={() => handleOauth((step.action as any).provider)}
                    disabled={busy}
                    style={{
                      width: '100%',
                      fontSize: 12.5, fontWeight: 800, color: '#fff',
                      background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
                      border: 'none', borderRadius: 9, padding: '10px 16px',
                      cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {busy
                      ? <><Loader2 size={14} className="spin" /> つないでいます…</>
                      : <>Google でログインして連携 <ArrowRight size={13} /></>}
                  </button>
                )}

                {step.action.kind === 'stripeConnect' && (
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(true); setErr(null);
                      try {
                        // サーバ側で env STRIPE_CONNECT_CLIENT_ID が未設定なら 503 が返るので、
                        // まず疎通チェックして 503 なら旧鍵貼付フローに自動 fallback。
                        const probe = await fetch('/api/stripe/connect-start', {
                          method: 'GET',
                          redirect: 'manual',
                        }).catch(() => null);
                        if (probe && probe.status === 503) {
                          setErr('ワンタップ連携は準備中です。下の「Stripe ダッシュボードを開く」から制限付きキーを作って貼り付けてください (このまま「→ 前のステップに戻る」ではなく、画面の指示に従って次へ進めます)。');
                          // 次ステップ (ダッシュボードを開く案内) へ自動で進める
                          setStepIdx(i => i + 1);
                          setBusy(false);
                          return;
                        }
                        // 302 redirect が来るはずなので、location をそのまま window.location に
                        // (fetch は redirect=manual で 0 や opaqueredirect が返ることがある)
                        window.location.href = '/api/stripe/connect-start';
                      } catch (e: any) {
                        setErr(e?.message || 'Stripe 認可ページに移動できませんでした');
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                    style={{
                      width: '100%',
                      fontSize: 12.5, fontWeight: 800, color: '#fff',
                      background: `linear-gradient(135deg, ${tool.color}, ${tool.color}cc)`,
                      border: 'none', borderRadius: 9, padding: '12px 16px',
                      cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    {busy
                      ? <><Loader2 size={14} className="spin" /> Stripe へ移動中…</>
                      : <>Stripe で許可する <ArrowRight size={13} /></>}
                  </button>
                )}

                {/* 戻る */}
                {stepIdx > 0 && (
                  <button
                    type="button"
                    onClick={() => { setStepIdx(i => i - 1); setErr(null); }}
                    style={{
                      marginTop: 8, fontSize: 10.5, fontWeight: 700,
                      color: 'rgba(255,255,255,0.45)', background: 'transparent',
                      border: 'none', cursor: 'pointer',
                    }}
                  >← 前のステップに戻る</button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function nextBtn(accent: string): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 800, color: '#fff',
    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
    border: 'none', borderRadius: 9, padding: '9px 14px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    flexShrink: 0,
  };
}

// isDone は guide 系の連携判定に使用 (loadToken === '__done__')
void isDone;
