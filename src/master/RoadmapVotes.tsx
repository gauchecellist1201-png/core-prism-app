// ============================================================
// RoadmapVotes — /master/roadmap-votes (オーナー専用)
//
// オーナー指示 (2026-06-04 第 36 波 RRRRR):
//   /api/roadmap-votes の集計を 項目別 + 月別 ピボット で見られるダッシュ。
//   「次にやるべきもの」 を 視覚で 即決できる。
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { isMasterAuth } from '../lib/billing';
import { LoaderBlock } from '../components/MicroLoader';
import { ArrowLeft, RefreshCw, Heart, AlertCircle, TrendingUp } from 'lucide-react';

interface RoadmapItem {
  id: string;
  title: string;
  desc: string;
  estimate?: string;
  status: 'shipping' | 'building' | 'planning';
}

// RoadmapPage.tsx と 同期する カタログ (id だけ手動同期)
const CATALOG: RoadmapItem[] = [
  // shipping (6 月)
  { id: 'agent-team-monitor', title: 'AI 役員 14 名 ライブ',          desc: '判断 / 営業 / 採用',         estimate: '6 月', status: 'shipping' },
  { id: 'industry-lp-7',      title: '業界 LP 7 種',                    desc: 'SME〜SaaS-startup',           estimate: '6 月', status: 'shipping' },
  { id: 'stripe-v2-billing',  title: 'Stripe v2 + Coupon + 試用',      desc: 'BtoC ¥3K / BtoB ¥20K',         estimate: '6 月', status: 'shipping' },
  { id: 'trust-status-page',  title: 'Trust + Status 公開',             desc: 'データ所在 + 健康診断',         estimate: '6 月', status: 'shipping' },
  // building (7 月)
  { id: 'onboarding-video',   title: '75 秒 オンボ動画',                desc: 'LP→料金→ダッシュ→CXO→Iris',  estimate: '7 月', status: 'building' },
  { id: 'sales-auto-mail',    title: 'AI 営業メール 一括 下書き',       desc: 'enrich → draftSalesEmail',     estimate: '7 月', status: 'building' },
  { id: 'morning-coach',      title: '朝コーチ / 提案 履歴',            desc: '採用率 を CXO 別に追跡',        estimate: '7 月', status: 'building' },
  { id: 'mascot-iris-prism',  title: '公式 マスコット 確定',           desc: '3 案 から 1 本に絞る',           estimate: '7 月', status: 'building' },
  { id: 'mrr-stripe-dash',    title: '/master MRR + 解約率 公式版',     desc: '12 ヶ月 棒 + 折れ線',            estimate: '7 月', status: 'building' },
  { id: 'retention-snapshot', title: 'リテンション スナップ 自動',     desc: '毎日 6 UTC + 週報',             estimate: '7 月', status: 'building' },
  // planning (8-9 月)
  { id: 'enterprise-sso',     title: 'エンタープライズ SSO',            desc: 'Google / Microsoft + 監査ログ', estimate: '8 月', status: 'planning' },
  { id: 'team-multi-seat',    title: 'マルチ シート (会社のチーム)',   desc: 'オーナー / 編集 / 閲覧',         estimate: '8 月', status: 'planning' },
  { id: 'mobile-app',         title: 'モバイル ネイティブ アプリ',      desc: 'PWA → iOS / Android',            estimate: '9 月', status: 'planning' },
  { id: 'slack-integration',  title: 'Slack ⇄ CORE 連携',              desc: '対話 + 通知 + ボタン',            estimate: '9 月', status: 'planning' },
  { id: 'finance-integration',title: '会計ソフト 連携 (freee / MF)',   desc: '請求 + 支払 + 仕訳',             estimate: '9 月', status: 'planning' },
];

const STATUS_META: Record<RoadmapItem['status'], { label: string; color: string }> = {
  shipping: { label: '出荷済',   color: '#34D399' },
  building: { label: '実装中',   color: '#A78BFA' },
  planning: { label: '構想中',   color: '#FBBF24' },
};

const ESTIMATE_ORDER = ['6 月', '7 月', '8 月', '9 月'];

export default function RoadmapVotes() {
  const [authed] = useState(isMasterAuth);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch('/api/roadmap-votes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json() as { items: Record<string, number>; configured?: boolean };
      setCounts(j.items || {});
      setConfigured(!!j.configured);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // 並び替え: 投票多 → 少
  const ranked = useMemo(() => {
    return [...CATALOG]
      .map((it) => ({ ...it, votes: counts[it.id] || 0 }))
      .sort((a, b) => b.votes - a.votes);
  }, [counts]);

  const totalVotes = ranked.reduce((a, b) => a + b.votes, 0);
  const buildingPick = ranked.find((it) => it.status === 'building');
  const planningPick = ranked.find((it) => it.status === 'planning');

  // 月別 ピボット (building/planning のみ — 出荷済は除外)
  const pivot = useMemo(() => {
    const groups: Record<string, { items: typeof ranked; sum: number }> = {};
    for (const it of ranked) {
      if (it.status === 'shipping') continue;
      const k = it.estimate || '?';
      if (!groups[k]) groups[k] = { items: [], sum: 0 };
      groups[k].items.push(it);
      groups[k].sum += it.votes;
    }
    return ESTIMATE_ORDER.filter((m) => groups[m]).map((m) => ({ month: m, ...groups[m] }));
  }, [ranked]);

  const maxVotes = Math.max(1, ...ranked.map((it) => it.votes));

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '4rem 1.5rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔑</div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 8 }}>master key が必要です</h2>
          <p style={{ fontSize: '0.88rem', lineHeight: 1.7 }}>
            コンソールで{' '}
            <code style={{ background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
              localStorage.setItem('core_master_key', 'GAUCHE2026')
            </code>{' '}
            を実行 → 再読込してください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A12', color: '#fff', padding: '2rem 1.25rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <a href="/master" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: 24 }}>
          <ArrowLeft size={14} /> /master へ戻る
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'linear-gradient(135deg, #EC4899, #F472B6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', boxShadow: '0 12px 24px rgba(236,72,153,0.4)',
            flexShrink: 0,
          }}><Heart size={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.28em', color: '#EC4899', fontWeight: 800 }}>MASTER · ROADMAP VOTES</div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', margin: '4px 0 0', fontWeight: 900 }}>ロードマップ 投票 結果</h1>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              合計 {totalVotes} 票 / {configured === false ? 'Upstash 未設定 (集計 0)' : '24 時間に 1 回 / IP'}
            </div>
          </div>
          <button onClick={load} disabled={loading} style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)',
            border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
            fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> 再取得
          </button>
        </div>

        {err && (
          <div style={{
            padding: 12, borderRadius: 10,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#FCA5A5', fontSize: '0.85rem', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <AlertCircle size={14} /> 取得失敗: {err}
          </div>
        )}

        {!err && loading && totalVotes === 0 && <LoaderBlock message="投票 集計を読み込み中…" />}

        {/* 「次にやるべきもの」 おすすめ */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 24,
        }}>
          <PickCard
            title="🟣 7 月 に着手する 候補"
            item={buildingPick}
            color="#A78BFA"
          />
          <PickCard
            title="🟡 8-9 月 に着手する 候補"
            item={planningPick}
            color="#FBBF24"
          />
          <Kpi label="合計 投票" value={String(totalVotes)} color="#EC4899" icon={<Heart size={12} />} />
        </div>

        {/* 月別 ピボット */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '12px 0 12px' }}>月別 ピボット</h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24,
        }}>
          {pivot.map((g) => (
            <div key={g.month} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              padding: '14px 14px 12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: '1rem', fontWeight: 900 }}>{g.month}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>合計 <strong>{g.sum}</strong> 票 / {g.items.length} 件</div>
              </div>
              {g.items.map((it) => {
                const sMeta = STATUS_META[it.status];
                const pct = Math.max(2, (it.votes / Math.max(1, g.items[0].votes)) * 100);
                return (
                  <div key={it.id} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                      <span style={{ color: 'rgba(255,255,255,0.85)' }}>{it.title}</span>
                      <span style={{ color: sMeta.color, fontWeight: 800 }}>♡ {it.votes}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${sMeta.color}, ${sMeta.color}99)`, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* 全項目 ランキング */}
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '12px 0 12px' }}>投票 ランキング (全項目)</h2>
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 14,
        }}>
          {ranked.map((it, i) => {
            const sMeta = STATUS_META[it.status];
            const pct = Math.max(2, (it.votes / maxVotes) * 100);
            return (
              <div key={it.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 8px',
                borderBottom: i === ranked.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 800, width: 22, textAlign: 'right' }}>#{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{it.title}</span>
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: `${sMeta.color}22`, color: sMeta.color, fontWeight: 800 }}>{sMeta.label}</span>
                    {it.estimate && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>{it.estimate}</span>}
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg, ${sMeta.color}, ${sMeta.color}88)` }} />
                  </div>
                </div>
                <span style={{
                  fontSize: '0.92rem', fontWeight: 900,
                  color: it.votes > 0 ? sMeta.color : 'rgba(255,255,255,0.4)',
                  display: 'inline-flex', alignItems: 'center', gap: 3, minWidth: 50, justifyContent: 'flex-end',
                }}>
                  <Heart size={11} fill={it.votes > 0 ? sMeta.color : 'none'} /> {it.votes}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 18, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          ソース: <code>/api/roadmap-votes</code> · 公開ロードマップ <a href="/roadmap" style={{ color: '#A78BFA' }}>/roadmap</a> から 投票
        </div>

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function PickCard({ title, item, color }: { title: string; item: (RoadmapItem & { votes: number }) | undefined; color: string }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <TrendingUp size={11} /> {title}
      </div>
      {item ? (
        <>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', lineHeight: 1.3, marginTop: 4 }}>{item.title}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{item.desc} — <span style={{ color, fontWeight: 800 }}>♡ {item.votes}</span></div>
        </>
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>該当 候補 なし</div>
      )}
    </div>
  );
}

function Kpi({ label, value, color, icon }: { label: string; value: string; color: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 16px', borderRadius: 14,
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}33`,
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '1.45rem', fontWeight: 900, color, lineHeight: 1.2, marginTop: 4 }}>{value}</div>
    </div>
  );
}
