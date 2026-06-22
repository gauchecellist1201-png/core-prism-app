// ============================================================
// /strategy — 株式会社CORE 経営戦略司令塔 (オーナー専用)
// 5 タブ構成:
//   1. 概要 (Overview)         — 販売チャネル / 集客動線
//   2. KPI 実行値 (Actuals)    — 実 MRR vs 目標 / Prism / Iris / 12mo トレンド
//   3. 事業計画 (Plan)         — 印刷可能な事業計画書アーカイブ
//   4. プロダクト (Products)   — Prism / Iris 製品説明書
//   5. シミュレーション + ロードマップ
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import BusinessPlanView from './BusinessPlanView';
import KpiActualsTab from './KpiActualsTab';
import ProductsTab from './ProductsTab';
import NewVenturesTab from './NewVenturesTab';
import RoboticsPlan from './RoboticsPlan';
import { isMasterAuth } from '../lib/billing';

type StrategyTab = 'overview' | 'actuals' | 'plan' | 'products' | 'ventures' | 'robotics' | 'simulation';

function getInitialTab(): StrategyTab {
  if (typeof window === 'undefined') return 'overview';
  const p = window.location.pathname;
  if (/\/plan(\/|$)/.test(p)) return 'plan';
  if (/\/actuals|\/kpi/.test(p)) return 'actuals';
  if (/\/robotics|\/robot/.test(p)) return 'robotics';
  if (/\/ventures|\/new-?business|\/portfolio/.test(p)) return 'ventures';
  if (/\/products?/.test(p)) return 'products';
  if (/\/simulation|\/sim/.test(p)) return 'simulation';
  // legacy: /strategy/sales → overview
  return 'overview';
}

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", sans-serif';

// ─── 売上シミュレーション ─────────────────
type Scenario = 'conservative' | 'base' | 'aggressive';
const SCENARIOS: Record<Scenario, {
  label: string;
  monthlyGrowth: number;
  startUsers: number;
  avgArpuYen: number;
  churnRate: number;
}> = {
  conservative: { label: '保守', monthlyGrowth: 1.20, startUsers: 30, avgArpuYen: 6800, churnRate: 0.08 },
  base:         { label: '基準', monthlyGrowth: 1.35, startUsers: 50, avgArpuYen: 8500, churnRate: 0.05 },
  aggressive:   { label: '強気', monthlyGrowth: 1.55, startUsers: 80, avgArpuYen: 10200, churnRate: 0.03 },
};

function simulate(scenario: Scenario, months: number) {
  const s = SCENARIOS[scenario];
  const out = [];
  let users = s.startUsers;
  let cumulative = 0;
  for (let m = 1; m <= months; m++) {
    const newUsers = m === 1 ? users : Math.round(users * (s.monthlyGrowth - 1));
    const churned = Math.round(users * s.churnRate);
    if (m > 1) users = users + newUsers - churned;
    const mrr = users * s.avgArpuYen;
    cumulative += mrr;
    out.push({ month: m, users, mrr, cumulative });
  }
  return out;
}

const fmt = (n: number) => '¥' + n.toLocaleString('ja-JP');
const fmtShort = (n: number) => {
  if (n >= 100_000_000) return '¥' + (n / 100_000_000).toFixed(1) + '億';
  if (n >= 10_000) return '¥' + (n / 10_000).toFixed(0) + '万';
  return '¥' + n.toLocaleString('ja-JP');
};

// ─── 販売チャネル ─────────────────
const CHANNELS = [
  { name: '直販 (LP → Stripe)',     mix: 35, cac: 2000, desc: 'core-prism-app.vercel.app からの直接購入。LP の最適化と SEO で広げる。' },
  { name: 'リファラル (招待コード)', mix: 20, cac: 500,  desc: '既存ユーザーが紹介 → 30 日延長。CAC が圧倒的に低い。' },
  { name: 'X (Twitter) 自動投稿',  mix: 15, cac: 300,  desc: '既稼働の x-automation リポジトリで毎日投稿。バズ → LP 流入。' },
  { name: 'パートナー営業',         mix: 12, cac: 8000, desc: '士業・コンサル・代理店との連携。法人案件の母艦。' },
  { name: 'ProductHunt / SaaS 集約', mix: 8,  cac: 1500, desc: 'ローンチ時の認知爆発。海外ユーザー流入の起点。' },
  { name: 'YouTube / note',          mix: 6,  cac: 1200, desc: '使い方デモ・事例記事で検討段階の背中を押す。' },
  { name: '法人 / 取材経由',        mix: 4,  cac: 0,    desc: '記事になるとオーガニック流入が長期に伸びる。' },
];

// ─── 集客動線 (ファネル) ─────────────────
const FUNNEL = [
  { stage: '認知',     en: 'AWARENESS',   target: '月 50,000 リーチ', tactics: ['X 自動投稿 (毎日)', 'ProductHunt ローンチ', 'YouTube 解説動画', 'note エディトリアル'] },
  { stage: '興味',     en: 'INTEREST',    target: '月 5,000 LP訪問', tactics: ['業種別ユースケースページ', 'note 記事 (週 2 本)', 'X スレッド (週 3 本)', 'SEO最適化'] },
  { stage: '検討',     en: 'CONSIDERATION', target: '月 1,500 試用開始', tactics: ['/pricing で ROI 計算機', '14 日無料トライアル', '比較表 (HubSpot 等)', '事例ページ'] },
  { stage: '購入',     en: 'PURCHASE',    target: '月 300 課金転換', tactics: ['Stripe Checkout 4 ステップ', 'マスターモード対応', '招待コード割引', '法人向け見積もり'] },
  { stage: '継続',     en: 'RETENTION',   target: '月次解約率 < 5%', tactics: ['オンボーディング革命', 'デイリー戦略コーチ', 'シャドー秘書 (Gmail)', 'チームコラボ'] },
  { stage: '紹介',     en: 'REFERRAL',    target: '紹介率 25%+', tactics: ['招待コードで 30 日延長', 'X 共有ボタン', '事例公開承諾割引', 'コミュニティ機能'] },
];

// ─── 実行ロードマップ ─────────────────
const ROADMAP = [
  { phase: 'Phase 1', dates: '〜5/15', focus: 'プロダクト完成と公開開始', items: ['Stripe 本番接続 (5/10)', 'AI 戦略コーチ (5/11)', 'チームコラボ (5/12)', 'AI 動画 / ベンチマーク (5/13-14)'] },
  { phase: 'Phase 2', dates: '5/15-5/22', focus: '販売動線の構築',     items: ['Slack/Discord 統合', 'AI が SaaS を操作', 'マルチ言語', 'ProductHunt 申請キット'] },
  { phase: 'Phase 3', dates: '5/22-5/31', focus: '集客の本格稼働',     items: ['X 自動投稿の質向上', '業種別ユースケース 8 本', 'パートナー営業資料', 'note 記事 4 本'] },
  { phase: 'Phase 4', dates: '6月',       focus: '法人化・スケール',   items: ['株式会社CORE 法人登記', '独自ドメイン取得 (core-inc.jp)', '本格 PR / メディア対応', 'カスタマー成功チーム整備'] },
];

export default function StrategyDashboard() {
  const [scenario, setScenario] = useState<Scenario>('base');
  const [tab, setTab] = useState<StrategyTab>(() => getInitialTab());
  const masterMode = isMasterAuth();

  useEffect(() => {
    document.title = '株式会社CORE — 経営戦略司令塔';
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
  }, []);

  // マスター専用タブは非マスター時にオーバービューへフォールバック
  useEffect(() => {
    if (!masterMode && (tab === 'plan' || tab === 'actuals')) setTab('overview');
  }, [tab, masterMode]);

  const sim = useMemo(() => simulate(scenario, 12), [scenario]);
  const peak = sim[sim.length - 1];
  const scenarioMrrTarget = peak.mrr;

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100dvh', fontFamily: FONT_SANS, overflowX: 'hidden' }}>
      {/* ヘッダ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="lp-safe" style={{ maxWidth: 1320, margin: '0 auto', padding: '0.9rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <a href="/corp" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.4em', color: '#fff', textDecoration: 'none' }}>CORE</a>

          {/* タブ */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>概要</TabBtn>
            {masterMode && <TabBtn active={tab === 'actuals'} onClick={() => setTab('actuals')}>KPI 実行値</TabBtn>}
            {masterMode && <TabBtn active={tab === 'plan'} onClick={() => setTab('plan')}>事業計画</TabBtn>}
            <TabBtn active={tab === 'products'} onClick={() => setTab('products')}>プロダクト</TabBtn>
            <TabBtn active={tab === 'ventures'} onClick={() => setTab('ventures')}>新規事業</TabBtn>
            <TabBtn active={tab === 'robotics'} onClick={() => setTab('robotics')}>CORE Robotics</TabBtn>
            <TabBtn active={tab === 'simulation'} onClick={() => setTab('simulation')}>シミュレーション</TabBtn>
          </div>

          <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontFamily: FONT_SERIF_JA }}>
            {masterMode && (
              <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>OWNER ONLY</span>
            )}
            <a href="/corp" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>← 法人</a>
          </nav>
        </div>
      </header>

      {/* TAB: KPI 実行値 */}
      {tab === 'actuals' && masterMode && (
        <section className="lp-section-pad" style={{ padding: '2.5rem 1.5rem 4rem', background: 'linear-gradient(180deg,#000 0%,#070712 100%)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <SectionHeader subtitle="KPI ACTUALS" title="実行値ダッシュボード" desc="Stripe 実 MRR vs シミュレーション目標。プロダクト別 / 月次推移。" />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {(Object.keys(SCENARIOS) as Scenario[]).map(s => (
                <button key={s} onClick={() => setScenario(s)} style={pillStyle(scenario === s)}>
                  {SCENARIOS[s].label}シナリオ目標
                </button>
              ))}
            </div>
            <KpiActualsTab scenarioMrrTargetJpy={scenarioMrrTarget} scenario={scenario} />
          </div>
        </section>
      )}

      {/* TAB: 事業計画 */}
      {tab === 'plan' && masterMode && (
        <section className="lp-section-pad" style={{ padding: '2.5rem 1.5rem 4rem', background: 'linear-gradient(180deg,#000 0%,#070712 100%)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <SectionHeader subtitle="BUSINESS PLAN" title="事業計画書" desc="2026 Q2-Q4 の経営計画。ブラウザ印刷で PDF 出力可能。" />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button onClick={() => window.print()} style={pillStyle(false)}>印刷 / PDF 出力</button>
            </div>
            <BusinessPlanView />
          </div>
        </section>
      )}

      {/* TAB: プロダクト */}
      {tab === 'products' && (
        <section className="lp-section-pad" style={{ padding: '2.5rem 1.5rem 4rem', background: 'linear-gradient(180deg,#000 0%,#0a0a18 100%)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <SectionHeader subtitle="PRODUCT MANUAL" title="プロダクト製品説明書" desc="CORE Prism (事業家向け 7 エージェント) / CORE Iris (クリエイター向け 6 ファセット)" />
            <ProductsTab />
          </div>
        </section>
      )}

      {/* TAB: 新規事業ポートフォリオ */}
      {tab === 'ventures' && (
        <section className="lp-section-pad" style={{ padding: '2.5rem 1.5rem 4rem', background: 'linear-gradient(180deg,#000 0%,#0a0a18 100%)' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto' }}>
            <SectionHeader subtitle="NEW VENTURES" title="新規事業ポートフォリオ" desc="Prism / Iris / Resonance / Lume — 4事業の事業計画と、この価格での実利益。各事業からLPへ移動できます。" />
            <NewVenturesTab />
          </div>
        </section>
      )}

      {/* TAB: CORE Robotics 事業計画 */}
      {tab === 'robotics' && <RoboticsPlan />}

      {/* TAB: 概要 (販売戦略) */}
      {tab === 'overview' && <>
        <section className="lp-section-pad" style={{ padding: '4.5rem 1.5rem 3rem', textAlign: 'center', background: 'linear-gradient(180deg,#000 0%,#070712 100%)' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.45em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '1.25rem' }}>STRATEGY COMMAND CENTER</p>
          <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.04em', marginBottom: '1rem' }}>
            このページ一つで、<span style={{ background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>経営戦略が立つ。</span>
          </h1>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.9, maxWidth: 720, margin: '0 auto' }}>
            実売上 (KPI) / 事業計画 / 製品説明書 / シナリオ ── 株式会社CORE の意思決定の母艦。
          </p>
        </section>

        <Section title="販売チャネル" subtitle="SALES CHANNELS" desc="どこから売るか。CAC が低い順に重みづけする" bg="#070712">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {CHANNELS.map((c, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 100px', gap: '1rem',
                  padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, alignItems: 'center',
                }}
                className="lp-channel-row"
              >
                <div>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 700, marginBottom: 4 }}>{c.name}</p>
                  <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{c.desc}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: FONT_DISPLAY, color: '#a78bfa' }}>{c.mix}<span style={{ fontSize: '0.7rem' }}>%</span></p>
                  <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>MIX</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'monospace', color: c.cac < 1500 ? '#86efac' : c.cac < 5000 ? '#fbbf24' : '#fca5a5' }}>{fmt(c.cac)}</p>
                  <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>CAC</p>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>

        <Section title="集客動線" subtitle="ACQUISITION FUNNEL" desc="認知 → 興味 → 検討 → 購入 → 継続 → 紹介の流れを設計">
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {FUNNEL.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                style={{
                  position: 'relative', padding: '1.25rem 1.5rem',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14, paddingLeft: '5rem',
                }}
              >
                <div style={{
                  position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                  width: 48, height: 48, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${['#ff5757', '#ff9842', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa'][i]}, ${['#ff9842', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6'][i]})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONT_DISPLAY, fontSize: '1rem', fontWeight: 700, color: '#fff',
                }}>{i + 1}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'center' }} className="lp-funnel-row">
                  <div>
                    <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 700 }}>{f.stage}</p>
                    <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{f.en}</p>
                    <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: '#fbbf24', marginTop: 6, fontWeight: 600 }}>目標: {f.target}</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginBottom: 4, letterSpacing: '0.1em' }}>施策</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {f.tactics.map((t, j) => (
                        <li key={j} style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, paddingLeft: '0.8rem', position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0, color: '#a78bfa' }}>·</span>{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Section>
      </>}

      {/* TAB: シミュレーション + ロードマップ */}
      {tab === 'simulation' && <>
        <Section title="売上シミュレーション" subtitle="REVENUE PROJECTION" desc="3 つのシナリオで 12 ヶ月後の MRR を試算">
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {(Object.keys(SCENARIOS) as Scenario[]).map(s => (
              <button key={s} onClick={() => setScenario(s)} style={pillStyle(scenario === s)}>
                {SCENARIOS[s].label}シナリオ
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <Stat label="12 ヶ月後 MRR"  value={fmtShort(peak.mrr)} />
            <Stat label="ユーザー数"    value={peak.users.toLocaleString('ja-JP')} unit="人" />
            <Stat label="年間累計"      value={fmtShort(peak.cumulative)} />
            <Stat label="平均 ARPU"     value={fmt(SCENARIOS[scenario].avgArpuYen)} unit="/ 月" />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem', overflowX: 'auto' }}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem', fontWeight: 600 }}>月次 MRR 推移</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', minHeight: 220, paddingTop: '1rem' }}>
              {sim.map((d, i) => {
                const h = (d.mrr / peak.mrr) * 200;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 22 }}>
                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }}>{fmtShort(d.mrr).replace('¥', '')}</span>
                    <motion.div
                      initial={{ height: 0 }} animate={{ height: h }}
                      transition={{ duration: 0.5, delay: i * 0.04 }}
                      style={{ width: '100%', background: `linear-gradient(180deg,#a78bfa,#60a5fa)`, borderRadius: '4px 4px 0 0', minHeight: 4 }}
                    />
                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>M{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 12 }}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.9 }}>
              <strong style={{ color: '#c4b5fd' }}>前提:</strong> 月次成長率 {((SCENARIOS[scenario].monthlyGrowth - 1) * 100).toFixed(0)}% / チャーン {(SCENARIOS[scenario].churnRate * 100).toFixed(0)}% / 平均 ARPU {fmt(SCENARIOS[scenario].avgArpuYen)} / 開始ユーザー {SCENARIOS[scenario].startUsers}人。
            </p>
          </div>
        </Section>

        <Section title="実行ロードマップ" subtitle="EXECUTION ROADMAP" desc="今日から法人化まで、4 つのフェーズで前進" bg="#070712">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {ROADMAP.map((r, i) => (
              <div key={i} style={{ position: 'relative', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: '#a78bfa', fontWeight: 700 }}>{r.phase.toUpperCase()}</p>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', marginTop: 2, marginBottom: 8 }}>{r.dates}</p>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', lineHeight: 1.5 }}>{r.focus}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {r.items.map((it, j) => (
                    <li key={j} style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.85, paddingLeft: '0.85rem', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#fbbf24' }}>▸</span>{it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </>}

      <footer style={{ background: '#000', padding: '2rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} CORE INC. — STRATEGY COMMAND CENTER
        </p>
      </footer>

      {/* Print 用スタイル — 事業計画タブのみ印刷可能 */}
      <style>{`
        @media print {
          header, footer { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .lp-section-pad { padding: 0 !important; background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.45rem 0.9rem',
        borderRadius: 999,
        background: active ? 'linear-gradient(135deg, rgba(167,139,250,0.3), rgba(96,165,250,0.18))' : 'rgba(255,255,255,0.04)',
        border: active ? '1px solid rgba(167,139,250,0.55)' : '1px solid rgba(255,255,255,0.1)',
        color: active ? '#fff' : 'rgba(255,255,255,0.65)',
        fontFamily: FONT_SERIF_JA,
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Section({ title, subtitle, desc, children, bg }: { title: string; subtitle: string; desc: string; children: React.ReactNode; bg?: string }) {
  return (
    <section className="lp-section-pad" style={{ padding: '4rem 1.5rem', background: bg || '#000' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <SectionHeader subtitle={subtitle} title={title} desc={desc} />
        {children}
      </div>
    </section>
  );
}

function SectionHeader({ subtitle, title, desc }: { subtitle: string; title: string; desc: string }) {
  return (
    <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 6 }}>{subtitle}</p>
      <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.5rem, 2.8vw, 2rem)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>{title}</h2>
      <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8 }}>{desc}</p>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div style={{ padding: '1.25rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, textAlign: 'center' }}>
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)', fontWeight: 800, color: '#fff' }}>
        {value}
        {unit && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginLeft: 4, fontWeight: 500 }}>{unit}</span>}
      </p>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.55rem 1.15rem',
    borderRadius: 999,
    background: active ? 'linear-gradient(135deg, #a78bfa, #f472b6)' : 'rgba(255,255,255,0.04)',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.12)',
    color: '#fff',
    fontFamily: FONT_SERIF_JA,
    fontSize: '0.82rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    cursor: 'pointer',
  };
}
