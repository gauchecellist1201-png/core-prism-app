// ============================================================
// RoadmapPage — /roadmap 公開ロードマップ
//
// オーナー指示 (2026-06-04 第 34 波 LLLLL):
//   直近 3 ヶ月の予定 を 「今 / 次 / 後」 の 3 列で表示。
//   各項目は 投票 可能 (localStorage + Upstash 集計)。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Heart, Sparkles, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

type Status = 'shipping' | 'building' | 'planning';

interface RoadmapItem {
  id: string;
  title: string;
  desc: string;
  tag?: string;            // 「AI」「営業」「セキュリティ」 等
  estimate?: string;       // 「6 月」「7 月」 など
}

interface Column {
  status: Status;
  title: string;            // 今 / 次 / 後
  subtitle: string;
  color: string;
  bg: string;
  items: RoadmapItem[];
}

// 6 月 (出荷中) — 直近 出した もの や 出している もの
const SHIPPING: RoadmapItem[] = [
  { id: 'agent-team-monitor',    title: 'AI 役員 14 名 ライブ',      desc: '判断 / 営業 / 採用 を 並列で 動かす 中枢',         tag: 'AI', estimate: '6 月' },
  { id: 'industry-lp-7',         title: '業界 LP 7 種',                desc: '中小 / 不動産 / コンサル / 個人 / クリエイター / フリーランス / SaaS', tag: 'LP', estimate: '6 月' },
  { id: 'stripe-v2-billing',     title: 'Stripe v2 + Coupon + 試用',  desc: 'BtoC ¥3K〜 / BtoB ¥20K〜 / 7 日無料 / クーポン',  tag: '料金', estimate: '6 月' },
  { id: 'trust-status-page',     title: 'Trust + Status 公開',         desc: 'データの所在 / 監査 + サービス健康診断 + 90 日インシデント',     tag: '信頼', estimate: '6 月' },
];

// 7 月 (building) — 次 やる
const BUILDING: RoadmapItem[] = [
  { id: 'onboarding-video',       title: '60-90 秒 オンボ チュートリアル動画', desc: '5 シーン (LP→料金→ダッシュ→CXO→Iris) を 1 本にまとめる',  tag: '動画', estimate: '7 月' },
  { id: 'sales-auto-mail',        title: 'AI 営業メール 一括 下書き',   desc: 'enrichLeadList → draftSalesEmail で 100 社 を 30 分で',     tag: '営業', estimate: '7 月' },
  { id: 'morning-coach',          title: '朝コーチ / 提案 履歴',        desc: '毎朝 3 案 + 採用率を CXO 別に追跡',                      tag: 'AI', estimate: '7 月' },
  { id: 'mascot-iris-prism',      title: '公式 マスコット 確定',       desc: 'PRISM / Iris の キャラクター 1 本に 絞る',                tag: 'ブランド', estimate: '7 月' },
  { id: 'mrr-stripe-dash',        title: '/master MRR + 解約率 公式版', desc: 'Stripe 12 ヶ月 棒グラフ + 折れ線 + 累計',                tag: '経営', estimate: '7 月' },
  { id: 'retention-snapshot',     title: 'リテンション スナップ 自動',  desc: '毎日 6 UTC に DAU / 7 日 / 30 日 を スナップ + 週報',        tag: '計測', estimate: '7 月' },
];

// 8-9 月 (planning) — 後 やる
const PLANNING: RoadmapItem[] = [
  { id: 'enterprise-sso',         title: 'エンタープライズ SSO',         desc: 'Google Workspace / Microsoft 365 SSO + 監査ログ',          tag: 'SOC2', estimate: '8 月' },
  { id: 'team-multi-seat',        title: 'マルチ シート (会社のチーム)',  desc: 'オーナー / 編集 / 閲覧 の 3 役割 + 招待 + 退会',          tag: 'チーム', estimate: '8 月' },
  { id: 'mobile-app',             title: 'モバイル ネイティブ アプリ',   desc: 'PWA → iOS / Android アプリ化 (Capacitor)',                tag: 'モバイル', estimate: '9 月' },
  { id: 'slack-integration',      title: 'Slack ⇄ CORE 連携',           desc: '対話 + 通知 + ボタン から AI 役員 を呼び出し',           tag: '連携', estimate: '9 月' },
  { id: 'finance-integration',    title: '会計ソフト 連携 (freee / MF)', desc: '請求 + 支払 + 仕訳 を AI で 自動分類',                 tag: '会計', estimate: '9 月' },
];

const COLUMNS: Column[] = [
  { status: 'shipping', title: '今 動いてる',       subtitle: '出荷済 / 出荷中',                color: '#34D399', bg: 'rgba(52,211,153,0.10)', items: SHIPPING },
  { status: 'building', title: '次 来る (7 月)',     subtitle: '実装中 + 確認中',                color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', items: BUILDING },
  { status: 'planning', title: '後 やる (8-9 月)',  subtitle: '構想中 — 投票で 順番 が変わる',  color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', items: PLANNING },
];

const LS_VOTED = 'core_roadmap_voted_v1';

function readVoted(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(LS_VOTED) || '[]')); } catch { return new Set(); }
}
function writeVoted(s: Set<string>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(LS_VOTED, JSON.stringify([...s])); } catch { /* */ }
}

export default function RoadmapPage() {
  const [voted, setVoted] = useState<Set<string>>(() => readVoted());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/roadmap-votes');
      if (res.ok) {
        const j = await res.json() as { items: Record<string, number> };
        setCounts(j.items || {});
      }
    } catch { /* */ } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const vote = async (id: string) => {
    if (voted.has(id) || posting) return;
    setPosting(id);
    // 楽観 UI
    const next = new Set(voted); next.add(id); setVoted(next); writeVoted(next);
    setCounts((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
    try {
      const res = await fetch('/api/roadmap-votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const j = await res.json() as { count?: number };
        if (typeof j.count === 'number') setCounts((c) => ({ ...c, [id]: j.count! }));
      }
    } catch { /* */ } finally { setPosting(null); }
  };

  const totalVotes = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #070712 0%, #0d0d1c 100%)',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 18px 80px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={14} /> ホームへ戻る
        </a>

        {/* Hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #A78BFA, #6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 12px 24px rgba(167,139,250,0.4)',
            flexShrink: 0,
          }}><Sparkles size={26} /></div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#A78BFA', fontWeight: 800 }}>PUBLIC ROADMAP</div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', margin: '4px 0 6px', fontWeight: 900, lineHeight: 1.25 }}>
              CORE Prism / Iris の これから 3 ヶ月
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.72)', margin: 0, lineHeight: 1.6 }}>
              気になる項目 に ♡ を タップ — 順番 と 優先度 を 変えます (匿名 / 24 時間に 1 回まで)。
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              marginLeft: 'auto',
              padding: '8px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          ><RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 更新</button>
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 28 }}>
          合計 投票 数: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{totalVotes}</strong> · 最終更新: {new Date().toLocaleString('ja-JP')}
        </div>

        {/* 3 列グリッド */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {COLUMNS.map((col) => (
            <div key={col.status} style={{
              background: col.bg,
              border: `1px solid ${col.color}33`,
              borderRadius: 16,
              padding: '16px 14px',
              display: 'flex', flexDirection: 'column',
              minHeight: 200,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                {col.status === 'shipping' ? <CheckCircle2 size={18} color={col.color} />
                  : col.status === 'building' ? <Loader2 size={18} color={col.color} style={{ animation: 'spin 4s linear infinite' }} />
                  : <Sparkles size={18} color={col.color} />}
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: col.color }}>{col.title}</div>
                  <div style={{ fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{col.subtitle}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{col.items.length} 件</span>
              </div>
              {col.items.map((it) => {
                const c = counts[it.id] || 0;
                const v = voted.has(it.id);
                return (
                  <div key={it.id} style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, lineHeight: 1.35 }}>{it.title}</div>
                        <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.6 }}>{it.desc}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                          {it.tag && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 999, background: `${col.color}22`, color: col.color, fontWeight: 800, letterSpacing: '0.05em' }}>{it.tag}</span>}
                          {it.estimate && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>{it.estimate}</span>}
                        </div>
                      </div>
                      {col.status !== 'shipping' && (
                        <button
                          onClick={() => vote(it.id)}
                          disabled={v || !!posting}
                          aria-label={v ? '投票済' : '投票する'}
                          title={v ? '投票済 (24 時間以内に 1 回まで)' : '気になる項目 に ♡'}
                          style={{
                            padding: '5px 9px', borderRadius: 999,
                            border: `1px solid ${v ? col.color : 'rgba(255,255,255,0.18)'}`,
                            background: v ? `${col.color}22` : 'transparent',
                            color: v ? col.color : 'rgba(255,255,255,0.8)',
                            cursor: v || posting ? 'default' : 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          <Heart size={11} fill={v ? col.color : 'none'} />
                          {c}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {col.items.length === 0 && (
                <div style={{ padding: 14, color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>
                  ここに 新規 項目 を 追加予定
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footnote */}
        <div style={{ marginTop: 28, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
          ロードマップ は 1 ヶ月単位で 更新されます。
          匿名投票は IP 単位で 24 時間に 1 回 まで (重複防止)。
          このページの 結果 は <code>/api/roadmap-votes</code> で 取得可能 (公開)。
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
