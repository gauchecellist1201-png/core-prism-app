// ============================================================
// SitemapPalette — Cmd+Shift+? で開く「全機能マップ」
//
// オーナー指示 (2026-06-04 第 17 波 OOO):
//   Studio / CXO / 設定 / 法務 / Master の階層を 1 画面で見渡せる、
//   検索可能な モーダル。Cmd+K (CommandPalette) と被らない位置付け:
//     - Cmd+K: 機能を「実行」する (Raycast 型)
//     - Cmd+Shift+?: 機能を「見つける」(sitemap 型)
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronRight, Map, ExternalLink } from 'lucide-react';

interface SiteNode {
  group: string;
  icon: string;
  items: SiteItem[];
}

interface SiteItem {
  label: string;
  href?: string;           // 直接遷移
  hash?: string;           // 同ページ内アンカー
  desc: string;
  kw?: string[];           // 検索 ヒット用キーワード
  badge?: string;          // 「Master」「Beta」「v2」など
}

const SITEMAP: SiteNode[] = [
  {
    group: '🏠 メイン',
    icon: '🏠',
    items: [
      { label: 'ダッシュボード',     href: '/',          desc: '14 CXO + 朝ブリーフ + 売上' , kw: ['home', 'top'] },
      { label: 'プライシング',       href: '/pricing',   desc: 'BtoC ¥3K〜 / BtoB ¥20K〜 / Enterprise', kw: ['price', '料金', '値段'] },
      { label: '請求 / 解約',        href: '/billing',   desc: 'プラン変更 / 解約 / 請求書 / CSV', kw: ['billing', '解約', '支払'] },
      { label: 'お問い合わせ',       href: '/contact',   desc: '6 トピックから問い合わせ', kw: ['contact', '問い合わせ', 'メール'] },
      { label: 'トラスト センター',  href: '/trust',     desc: 'データの所在 / アクセス / 削除 / 法令', kw: ['trust', 'GDPR', 'プライバシー', '監査'] },
      { label: 'ステータス',         href: '/status',    desc: 'API / Stripe / Upstash 健康診断 + 90 日インシデント', kw: ['status', '障害', 'uptime'] },
      { label: 'ロードマップ',       href: '/roadmap',   desc: '今 / 次 / 後 の 3 ヶ月予定 + 投票', kw: ['roadmap', 'ロード', '予定', '投票'] },
    ],
  },
  {
    group: '💼 業界別 LP',
    icon: '💼',
    items: [
      { label: '中小企業 (SME)',           href: '/lp/sme', desc: '飲食 / 小売 / サービス向け' },
      { label: '不動産 / 金融',             href: '/lp/realestate-finance', desc: '物件管理 + 営業 + 顧客分析' },
      { label: 'コンサルティング',         href: '/lp/consulting', desc: '提案書 + リサーチ AI' },
      { label: '個人事業主',                 href: '/lp/solo', desc: '事務・営業・経理 ぜんぶ AI' },
      { label: 'クリエイター (Iris)',       href: '/iris', desc: 'インスタ / 動画 / 案件交渉' },
      { label: 'フリーランスプロ',         href: '/lp/freelance-pro', desc: '高単価フリーランサー向け' },
      { label: 'SaaS スタートアップ CEO',  href: '/lp/saas-startup', desc: '1 人 CEO × AI 役員 13 名 でシリーズ A まで走る', kw: ['saas', 'startup', 'CEO', '創業'] },
    ],
  },
  {
    group: '⚖ 法務',
    icon: '⚖',
    items: [
      { label: 'プライバシーポリシー (v3)', href: '/privacy', desc: 'Push / DAU / VAPID 反映', badge: 'v3' },
      { label: '利用規約 (v3)',              href: '/terms', desc: 'v2 料金 + 7 日無料 + 解約', badge: 'v3' },
      { label: '特定商取引法に基づく表記', hash: 'tokushou', desc: 'BillingDashboard 内' },
    ],
  },
  {
    group: '🔑 Master (オーナー専用)',
    icon: '🔑',
    items: [
      { label: 'Master Entry',            href: '/master',                    desc: 'オーナー専用 ハブ', badge: 'Master' },
      { label: 'AI 使用量 ダッシュボード', href: '/master/ai-stats',           desc: 'route / model 別 集計', badge: 'Master' },
      { label: 'AI コスト試算',            href: '/master/ai-cost',            desc: 'Haiku/Sonnet/Opus 月額', badge: 'Master' },
      { label: 'Stripe 接続診断',          href: '/master/stripe-status',      desc: 'live 鍵 / payouts / failures', badge: 'Master' },
      { label: 'Secrets Health',           href: '/master/secrets-health',     desc: '8 系統 env 疎通テスト', badge: 'Master' },
      { label: 'オンボ ファネル',           href: '/master/onboard-funnel',     desc: 'welcome→completed 14 日 + 改善提案', badge: 'Master' },
      { label: 'エラーログ',               href: '/master/error-log',          desc: 'window.onerror 履歴', badge: 'Master' },
    ],
  },
  {
    group: '⚙ 内部機能 (ダッシュ内タブ)',
    icon: '⚙',
    items: [
      { label: 'CRM Studio',              hash: 'crm',         desc: '営業先 / Deals / 進捗', kw: ['CRM', '営業'] },
      { label: 'Content Engine',          hash: 'content',     desc: 'SNS 投稿 + コピー生成', kw: ['SNS', '投稿'] },
      { label: 'Knowledge Base',          hash: 'knowledge',   desc: '文書 / メモ アップロード', kw: ['ナレッジ', 'KB'] },
      { label: 'Cognitive Dashboard',     hash: 'cognitive',   desc: 'KPI / 健康 / 体感',  kw: ['cognitive', 'KPI'] },
      { label: 'Benchmark Studio',        hash: 'benchmark',   desc: '同業他社比較 + Q&A', kw: ['ベンチマーク'] },
      { label: 'Meeting Recorder',        hash: 'meeting',     desc: '会議録音 → 要約', kw: ['会議', '録音'] },
      { label: 'Sales Agent (営業)',      hash: 'sales',       desc: '営業文 + マッチング' },
    ],
  },
  {
    group: '🆘 ヘルプ',
    icon: '🆘',
    items: [
      { label: 'いま AI に質問 (FAB)',    desc: '右下の💬。LP / Dashboard どこからでも', kw: ['help', 'AI'] },
      { label: '改善提案 (FAB)',          desc: '左下の💡。1〜2 行 で送信', kw: ['feedback'] },
      { label: 'AI 提案 履歴 (7 日)',     desc: 'Cmd+Shift+H — 採用 / 却下 を ワンタップ + 採用率', kw: ['履歴', 'history', '提案'] },
      { label: '環境設定 → AI キー',      hash: 'settings-ai', desc: 'Claude / Gemini キー登録' },
      { label: 'PWA インストール',         desc: 'ホーム画面に追加で Push 通知 + オフライン' },
    ],
  },
];

export default function SitemapPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    let gPressed = 0;        // PPPPP (2026-06-04): Vim 風「g s」 2 連打 で 開く
    const onKey = (e: KeyboardEvent) => {
      // Cmd+Shift+? (US 配列) / Ctrl+Shift+? (Win/Linux)
      const isOpen = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '?' || e.key === '/');
      if (isOpen) {
        e.preventDefault();
        setOpen(o => !o);
        return;
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        return;
      }
      // 入力中 (input / textarea / contentEditable) は g s ショートカット を無効化
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'g') { gPressed = Date.now(); return; }
      if (e.key === 's' && gPressed && Date.now() - gPressed < 1200) {
        e.preventDefault();
        gPressed = 0;
        setOpen(true);
      } else if (e.key !== 'g') {
        gPressed = 0;
      }
    };
    const onOpenEvt = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('core:open-sitemap-palette', onOpenEvt as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('core:open-sitemap-palette', onOpenEvt as EventListener);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const qn = q.trim().toLowerCase();
    if (!qn) return SITEMAP;
    return SITEMAP
      .map(g => ({
        ...g,
        items: g.items.filter(it => {
          const hay = [it.label, it.desc, ...(it.kw || [])].join(' ').toLowerCase();
          return hay.includes(qn);
        }),
      }))
      .filter(g => g.items.length > 0);
  }, [q]);

  // 全 ヒット 件数 (フッタ に表示)
  const totalHits = filtered.reduce((a, g) => a + g.items.length, 0);

  /** クエリにマッチした 部分文字列を <mark> でラップ。q が空なら そのまま返す。 */
  const renderHighlighted = (text: string): React.ReactNode => {
    const qn = q.trim();
    if (!qn) return text;
    const lower = text.toLowerCase();
    const ql = qn.toLowerCase();
    if (!lower.includes(ql)) return text;
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < text.length) {
      const idx = lower.indexOf(ql, i);
      if (idx === -1) {
        out.push(text.slice(i));
        break;
      }
      if (idx > i) out.push(text.slice(i, idx));
      out.push(
        <mark
          key={i}
          style={{
            background: 'linear-gradient(180deg, rgba(251,191,36,0.55) 0%, rgba(245,158,11,0.45) 100%)',
            color: '#fff',
            padding: '0 2px',
            borderRadius: 3,
          }}
        >
          {text.slice(idx, idx + qn.length)}
        </mark>,
      );
      i = idx + qn.length;
    }
    return out;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => setOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,12,0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '60px 16px 16px',
        }}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(720px, 100%)',
            maxHeight: 'calc(100vh - 80px)',
            background: 'rgba(15,14,27,0.97)',
            border: '1px solid rgba(167,139,250,0.4)',
            borderRadius: 18,
            color: '#fff',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'linear-gradient(180deg, rgba(167,139,250,0.1), transparent)',
          }}>
            <Map size={16} color="#a78bfa" />
            <div style={{ fontWeight: 800, fontSize: '0.92rem', flex: 1 }}>全機能マップ</div>
            <kbd style={{
              fontSize: 10, fontFamily: 'Menlo, monospace',
              background: 'rgba(255,255,255,0.08)', padding: '2px 6px',
              borderRadius: 4, color: 'rgba(255,255,255,0.6)',
            }}>⌘⇧/</kbd>
            <button
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              style={{
                width: 28, height: 28, borderRadius: 14,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <Search size={14} color="rgba(255,255,255,0.5)" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="検索 (例: stripe, 解約, CRM, master)"
              style={{
                flex: 1,
                background: 'transparent', border: 'none', outline: 'none',
                color: '#fff', fontSize: '0.88rem',
              }}
            />
            {q && (
              <button onClick={() => setQ('')} aria-label="クリア" style={{
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              }}><X size={13} /></button>
            )}
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 16px' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                該当する機能が見つかりません。
              </div>
            )}
            {filtered.map((g, gi) => (
              <div key={gi} style={{ marginBottom: 10 }}>
                <div style={{
                  padding: '8px 12px 4px',
                  fontSize: '0.65rem', letterSpacing: '0.15em',
                  fontWeight: 800, color: 'rgba(255,255,255,0.5)',
                  textTransform: 'uppercase',
                }}>
                  {g.group}
                </div>
                {g.items.map((it, i) => (
                  <a
                    key={i}
                    href={it.href || '#'}
                    target={it.href ? undefined : undefined}
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px',
                      borderRadius: 10, margin: '0 4px',
                      background: 'transparent',
                      color: '#fff', textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.1)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{renderHighlighted(it.label)}</span>
                        {it.badge && (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 6,
                            background: it.badge === 'Master' ? 'rgba(167,139,250,0.25)' : 'rgba(251,191,36,0.2)',
                            color: it.badge === 'Master' ? '#ddd6fe' : '#fde68a',
                            fontWeight: 800, letterSpacing: '0.05em',
                          }}>{it.badge}</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                        {renderHighlighted(it.desc)}
                        {it.href && <span style={{ marginLeft: 6, fontFamily: 'Menlo, monospace', color: 'rgba(167,139,250,0.6)' }}>{renderHighlighted(it.href)}</span>}
                      </div>
                    </div>
                    {it.href ? <ExternalLink size={12} color="rgba(255,255,255,0.4)" /> : <ChevronRight size={12} color="rgba(255,255,255,0.4)" />}
                  </a>
                ))}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 14px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.02)',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.45)',
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span><kbd style={kbdStyle}>↑↓</kbd> 移動</span>
            <span><kbd style={kbdStyle}>Enter</kbd> 開く</span>
            <span><kbd style={kbdStyle}>Esc</kbd> 閉じる</span>
            {q && (
              <span style={{ color: '#FBBF24', fontWeight: 700 }}>
                {totalHits} 件 ヒット
              </span>
            )}
            <span style={{ marginLeft: 'auto', opacity: 0.6 }}>Cmd+K で「実行」 / Cmd+Shift+/ で「探す」</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: 10, fontFamily: 'Menlo, monospace',
  background: 'rgba(255,255,255,0.08)', padding: '1px 5px',
  borderRadius: 3, color: 'rgba(255,255,255,0.7)',
};
