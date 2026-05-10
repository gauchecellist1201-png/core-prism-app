// ============================================================
// /strategy — 販売戦略ダッシュボード (オーナー専用)
// 販売チャネル / 集客動線 / 売上シミュレーション / 実行ロードマップ / KPI
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", sans-serif';

// ─── 売上シミュレーション ─────────────────
type Scenario = 'conservative' | 'base' | 'aggressive';
const SCENARIOS: Record<Scenario, {
  label: string;
  monthlyGrowth: number; // 前月比
  startUsers: number;
  avgArpuYen: number;    // 平均 ARPU (円/月)
  churnRate: number;     // 月次チャーン率
}> = {
  conservative: { label: '保守', monthlyGrowth: 1.20, startUsers: 30, avgArpuYen: 6800, churnRate: 0.08 },
  base:         { label: '基準', monthlyGrowth: 1.35, startUsers: 50, avgArpuYen: 8500, churnRate: 0.05 },
  aggressive:   { label: '強気', monthlyGrowth: 1.55, startUsers: 80, avgArpuYen: 10200, churnRate: 0.03 },
};

function simulate(scenario: Scenario, months: number): {
  month: number;
  users: number;
  mrr: number;
  cumulative: number;
}[] {
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
  { phase: 'Phase 4', dates: '6月',       focus: '法人化・スケール',   items: ['株式会社コア 法人登記', '独自ドメイン取得 (core-inc.jp)', '本格 PR / メディア対応', 'カスタマー成功チーム整備'] },
];

// ─── KPI ─────────────────
const KPIS = [
  { label: 'MRR',         target: '¥30M / 月 (12ヶ月後)', current: '¥0', unit: '円', source: 'Stripe' },
  { label: '有料ユーザー数', target: '3,000 (12ヶ月後)',    current: '0',  unit: '人', source: 'localStorage user' },
  { label: 'CAC',         target: '< ¥3,000',             current: '?',  unit: '円', source: '広告 + 営業コスト ÷ 新規' },
  { label: 'LTV',         target: '> ¥80,000',           current: '?',  unit: '円', source: '平均 ARPU × 滞留月数' },
  { label: 'LTV / CAC',    target: '> 3.0x',              current: '?',  unit: '倍', source: '上記 2 つから計算' },
  { label: '月次チャーン',  target: '< 5%',                current: '?',  unit: '%',  source: '解約数 ÷ 月初ユーザー' },
];

export default function StrategyDashboard() {
  const [scenario, setScenario] = useState<Scenario>('base');
  const [months, _setMonths] = useState(12);
  void _setMonths;

  useEffect(() => {
    document.title = '株式会社コア — 戦略ダッシュボード';
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
  }, []);

  const sim = useMemo(() => simulate(scenario, months), [scenario, months]);
  const peak = sim[sim.length - 1];

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', fontFamily: FONT_SANS, overflowX: 'hidden' }}>
      {/* ヘッダ */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="lp-safe" style={{ maxWidth: 1320, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/corp" style={{ fontFamily: FONT_DISPLAY, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.4em', color: '#fff', textDecoration: 'none' }}>CORE</a>
          <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', fontFamily: FONT_SERIF_JA }}>
            <span style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>OWNER ONLY</span>
            <a href="/corp" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>← 法人サイトへ</a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="lp-section-pad" style={{ padding: '4.5rem 1.5rem 3rem', textAlign: 'center', background: 'linear-gradient(180deg,#000 0%,#070712 100%)' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.45em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '1.25rem' }}>STRATEGY DASHBOARD</p>
        <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(2rem, 4.5vw, 3rem)', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.04em', marginBottom: '1rem' }}>
          売れる仕組みを、<span style={{ background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>骨組みから。</span>
        </h1>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.9, maxWidth: 720, margin: '0 auto' }}>
          プロダクト → 販売動線 → 集客 ── この三段で売上が伸びます。
          <br />このページは<strong style={{ color: '#fff' }}>井出さん専用の意思決定ダッシュボード</strong>です。
        </p>
      </section>

      {/* ─── 売上シミュレーション ─── */}
      <Section title="売上シミュレーション" subtitle="REVENUE PROJECTION" desc="3 つのシナリオで 12 ヶ月後の MRR を試算">
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {(Object.keys(SCENARIOS) as Scenario[]).map(s => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: 999,
                background: scenario === s ? 'linear-gradient(135deg, #a78bfa, #f472b6)' : 'rgba(255,255,255,0.04)',
                border: scenario === s ? 'none' : '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                fontFamily: FONT_SERIF_JA,
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
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

        {/* 月次推移の棒グラフ */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem', overflowX: 'auto' }}>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem', fontWeight: 600 }}>月次 MRR 推移</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', minHeight: 220, paddingTop: '1rem' }}>
            {sim.map((d, i) => {
              const h = (d.mrr / peak.mrr) * 200;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 22 }}>
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', fontFamily: 'monospace' }}>{fmtShort(d.mrr).replace('¥', '')}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: h }}
                    transition={{ duration: 0.5, delay: i * 0.04 }}
                    style={{
                      width: '100%',
                      background: `linear-gradient(180deg,#a78bfa,#60a5fa)`,
                      borderRadius: '4px 4px 0 0',
                      minHeight: 4,
                    }}
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
            数値はコントロール可能 ── マーケティング・LP CVR・チャーン施策で動かせる。
          </p>
        </div>
      </Section>

      {/* ─── 販売チャネル ─── */}
      <Section title="販売チャネル" subtitle="SALES CHANNELS" desc="どこから売るか。CAC が低い順に重みづけする" bg="#070712">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {CHANNELS.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 100px',
                gap: '1rem',
                padding: '1rem 1.25rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                alignItems: 'center',
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

      {/* ─── 集客動線 (ファネル) ─── */}
      <Section title="集客動線" subtitle="ACQUISITION FUNNEL" desc="認知 → 興味 → 検討 → 購入 → 継続 → 紹介の流れを設計">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {FUNNEL.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              style={{
                position: 'relative',
                padding: '1.25rem 1.5rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                paddingLeft: '5rem',
              }}
            >
              <div style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 48, height: 48,
                borderRadius: '50%',
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

      {/* ─── 実行ロードマップ ─── */}
      <Section title="実行ロードマップ" subtitle="EXECUTION ROADMAP" desc="今日から法人化まで、4 つのフェーズで前進" bg="#070712">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {ROADMAP.map((r, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                padding: '1.5rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
              }}
            >
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

      {/* ─── KPI ─── */}
      {/* ─── 5/12 ベータ公開チェックリスト ─── */}
      <Section title="5/12 ベータ公開 チェックリスト" subtitle="BETA LAUNCH CHECKLIST" desc="経営者集まりで決済が通常に動く状態に仕上げる" bg="linear-gradient(180deg,#0d0815 0%,#15052a 100%)">
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {[
            {
              priority: 'CRITICAL',
              title: 'Stripe ダッシュボードで Product / Price を作成',
              steps: [
                'console.stripe.com にログイン (法人化前なので個人事業主アカウントで OK)',
                'Products → 「Add product」 → CORE Prism Standard ¥9,800/月 を作成',
                '同様に Starter ¥4,800、Exclusive ¥29,800、Iris Lite ¥2,800、Iris Standard ¥6,800 等',
                '各 Price ID をコピー (price_xxx)',
              ],
              eta: '30 分',
            },
            {
              priority: 'CRITICAL',
              title: 'Vercel env に Stripe キーを設定',
              steps: [
                'vercel.com → core-prism-app → Settings → Environment Variables',
                'STRIPE_SECRET_KEY=sk_live_xxx (本番用)',
                'STRIPE_WEBHOOK_SECRET=whsec_xxx',
                'STRIPE_PRICE_PRISM_STARTER / STANDARD / EXCLUSIVE',
                'STRIPE_PRICE_LITE / STANDARD / PRO / STUDIO (Iris)',
                '各設定後 Redeploy (Production)',
              ],
              eta: '15 分',
            },
            {
              priority: 'CRITICAL',
              title: 'Stripe Webhook エンドポイント登録',
              steps: [
                'Stripe → Developers → Webhooks → 「Add endpoint」',
                'URL: https://core-prism-app.vercel.app/api/stripe/webhook',
                'イベント: checkout.session.completed, customer.subscription.* を選択',
                'Signing secret (whsec_xxx) をコピーして上記 env に設定',
              ],
              eta: '10 分',
            },
            {
              priority: 'HIGH',
              title: 'テストカードで決済フロー検証',
              steps: [
                'シークレットウィンドウで https://core-prism-app.vercel.app/ を開く',
                '「今すぐ試す」 → CheckoutModal → Stripe Checkout 画面に遷移するか',
                'Stripe テストカード 4242 4242 4242 4242 / 任意の将来日 / 任意 3 桁',
                '決済成功 → 自動でアプリに入場、user.plan が反映されているか確認',
                'Stripe ダッシュボード Payments で取引が見えるか',
              ],
              eta: '20 分',
            },
            {
              priority: 'HIGH',
              title: 'オーナー (井出) のバイパス動作確認',
              steps: [
                'シークレットウィンドウで /master を開く',
                'マスターキー GAUCHE2026 + Claude API キーを入力',
                '「Prism へ進む」をクリック → CheckoutModal なしで直接アプリへ',
                'LP の右上に「👑 アプリへ →」が表示されているか',
              ],
              eta: '5 分',
            },
            {
              priority: 'HIGH',
              title: 'Resend (メール) のドメイン認証',
              steps: [
                'resend.com にサインアップ',
                'Domains → 「Add Domain」 → core-inc.jp など (法人化前なら個人ドメイン)',
                'DNS に TXT / DKIM レコード追加 → 認証',
                'API Keys → 作成 → RESEND_API_KEY を Vercel env へ',
              ],
              eta: '20 分 (DNS 反映含めて 1-24h)',
            },
            {
              priority: 'MEDIUM',
              title: 'ベータ用招待コードを発行',
              steps: [
                '集まりの参加者数分、招待リンクを生成 (BETA50, FOUNDERS50 等)',
                '/master でリファラル設定機能から発行',
                '50% OFF の永久クーポン化を Stripe Coupons で実現',
              ],
              eta: '15 分',
            },
            {
              priority: 'MEDIUM',
              title: '当日デモ用シナリオの最終リハーサル',
              steps: [
                '「3 分で価値を見せる」シナリオを 1 つ用意 (例: 商談議事録 → スライド)',
                'デモ用ペルソナを seedDemoData で投入済み確認',
                'マイク・スピーカー・ネット環境のチェック',
              ],
              eta: '30 分',
            },
            {
              priority: 'LOW',
              title: 'バックアッププラン (もし Stripe が間に合わない)',
              steps: [
                '一時的に CheckoutModal を test mode (¥0) に固定 → 後で本番切替',
                '当日参加者は招待コード経由で 30 日延長扱い',
                '請求は手動 (Stripe Invoice) で別途送付',
              ],
              eta: '即時',
            },
          ].map((task, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              style={{
                padding: '1.25rem 1.5rem',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${task.priority === 'CRITICAL' ? 'rgba(239,68,68,0.4)' : task.priority === 'HIGH' ? 'rgba(251,191,36,0.35)' : 'rgba(167,139,250,0.25)'}`,
                borderRadius: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    padding: '3px 9px',
                    borderRadius: 4,
                    background: task.priority === 'CRITICAL' ? 'rgba(239,68,68,0.2)' : task.priority === 'HIGH' ? 'rgba(251,191,36,0.18)' : 'rgba(167,139,250,0.15)',
                    color: task.priority === 'CRITICAL' ? '#fca5a5' : task.priority === 'HIGH' ? '#fcd34d' : '#c4b5fd',
                    border: `1px solid ${task.priority === 'CRITICAL' ? 'rgba(239,68,68,0.4)' : task.priority === 'HIGH' ? 'rgba(251,191,36,0.4)' : 'rgba(167,139,250,0.4)'}`,
                  }}
                >
                  {task.priority}
                </span>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 700, flex: 1 }}>{task.title}</p>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>所要 {task.eta}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                {task.steps.map((s, j) => (
                  <li
                    key={j}
                    style={{
                      fontFamily: FONT_SERIF_JA,
                      fontSize: '0.82rem',
                      color: 'rgba(255,255,255,0.72)',
                      lineHeight: 1.85,
                      paddingLeft: '1.2rem',
                      position: 'relative',
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0, color: '#a78bfa', fontWeight: 700 }}>{j + 1}.</span>
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(132,204,22,0.08)', border: '1px solid rgba(132,204,22,0.3)', borderRadius: 14 }}>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: '#bef264', fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em' }}>
            ⏱ 合計所要時間 約 2 時間半 (DNS 反映待ち除く)
          </p>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 2 }}>
            5/12 朝の集まり前に <strong style={{ color: '#fff' }}>5/11 までに CRITICAL 3 件を完了</strong>させれば、当日は決済が通常に動きます。HIGH 以下は当日中の調整で OK。
          </p>
        </div>
      </Section>

      <Section title="KPI" subtitle="KEY PERFORMANCE INDICATORS" desc="この数字を毎週見て、判断する" >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          {KPIS.map((k, i) => (
            <div key={i} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.45)', fontWeight: 700 }}>{k.label}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, marginTop: 8, color: '#a78bfa' }}>{k.target}</p>
              <p style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>現在: {k.current}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.6 }}>取得元: {k.source}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section style={{ padding: '5rem 1.5rem', background: 'radial-gradient(ellipse at center, rgba(167,139,250,0.1) 0%, #000 70%)', textAlign: 'center' }}>
        <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 700, marginBottom: '1.25rem', letterSpacing: '0.04em', lineHeight: 1.5 }}>
          つくる、敷く、集める。<br />
          <span style={{ background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>順番に、確実に。</span>
        </h3>
        <p style={{ fontFamily: FONT_SERIF_JA, color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', lineHeight: 2, maxWidth: 580, margin: '0 auto' }}>
          現在は Phase 1 (プロダクト完成) の最終段階。
          <br />毎朝のリモートエージェントが Phase 2/3 を自動的に押し進めています。
        </p>
      </section>

      <footer style={{ background: '#000', padding: '2rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.3)' }}>
          © {new Date().getFullYear()} CORE INC. — STRATEGY DASHBOARD
        </p>
      </footer>
    </div>
  );
}

// ============================================================
//  Section / Stat ヘルパー
// ============================================================
function Section({ title, subtitle, desc, children, bg }: { title: string; subtitle: string; desc: string; children: React.ReactNode; bg?: string }) {
  return (
    <section className="lp-section-pad" style={{ padding: '4rem 1.5rem', background: bg || '#000' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.4em', color: 'rgba(255,255,255,0.4)', fontWeight: 600, marginBottom: 6 }}>{subtitle}</p>
          <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.5rem, 2.8vw, 2rem)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>{title}</h2>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.8 }}>{desc}</p>
        </div>
        {children}
      </div>
    </section>
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
