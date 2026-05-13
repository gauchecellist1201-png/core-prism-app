// ============================================================
// ProductsTab — Prism / Iris の製品説明書 (Web 版)
// /strategy の「プロダクト」タブ
// generateProductCatalog.py の Web 化版。1 ページ完結 + 価格表 + KGI
// ============================================================
import { useState } from 'react';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';

type ProductId = 'prism' | 'iris';

const PRODUCTS: Record<ProductId, {
  name: string;
  tagline: string;
  for: string;
  description: string;
  color: { primary: string; secondary: string };
  agents: { name: string; en: string; role: string }[];
  pricing: { plan: string; price: string; period: string; features: string[]; highlight?: boolean }[];
  kgi: { label: string; q4_target: string }[];
  targetCustomers: string[];
}> = {
  prism: {
    name: 'CORE Prism',
    tagline: 'すべての事業家に、専属のエージェント AI を。',
    for: '事業家 / マルチロール経営者 / フリーランス',
    description: 'ひとつの白い光を、7 つの人格に分散させる。経営・財務・営業・人事・法務・健康・自己実現の 7 つのエージェントが、あなたの分身として動きます。',
    color: { primary: '#60a5fa', secondary: '#a78bfa' },
    agents: [
      { name: '経営戦略', en: 'STRATEGY', role: '事業計画 / KPI / 意思決定' },
      { name: '財務会計', en: 'FINANCE', role: '請求書 / 経費 / キャッシュフロー' },
      { name: '営業 CRM', en: 'SALES', role: 'パイプライン / 提案書 / 顧客分析' },
      { name: '人事', en: 'PEOPLE', role: '採用 / 評価 / 1on1' },
      { name: '法務', en: 'LEGAL', role: '契約レビュー / コンプラ' },
      { name: '健康', en: 'HEALTH', role: 'バイタル / メンタル / 睡眠' },
      { name: '自己実現', en: 'SELF', role: 'コーチ / 目標 / 振り返り' },
    ],
    pricing: [
      { plan: 'Lite', price: '¥980', period: '/ 月', features: ['Gemini 2.5 Flash', '基本 3 エージェント', 'モバイル PWA'] },
      { plan: 'Pro', price: '¥3,980', period: '/ 月', features: ['Gemini 2.5 Pro', '全 7 エージェント', 'チームコラボ 5 名', 'メール / カレンダー連携'], highlight: true },
      { plan: 'Studio', price: '¥9,800', period: '/ 月', features: ['Claude Opus 4.7', '無制限チーム', 'プライベートエージェント学習', 'カスタムワークフロー'] },
    ],
    kgi: [
      { label: '有料ユーザー数 (Q4)', q4_target: '2,000 人' },
      { label: '月次 MRR', q4_target: '¥8M' },
      { label: 'チャーン率', q4_target: '< 4%' },
      { label: 'NPS', q4_target: '> 45' },
    ],
    targetCustomers: [
      '1 人〜10 人の小規模事業者・スタートアップ経営者',
      '士業 (税理士・弁護士・行政書士) / コンサルタント',
      '副業・複業のマルチロール経営者',
      'フリーランス・個人事業主',
    ],
  },
  iris: {
    name: 'CORE Iris',
    tagline: 'クリエイターの目に映る、6 つの世界。',
    for: 'クリエイター / インフルエンサー / SNS マネジメント',
    description: '案件・分析・創作・ブランディング・コミュニティ・財務 ── クリエイター活動の 6 ファセットを統合するエージェント群。Instagram / X / TikTok / YouTube に対応。',
    color: { primary: '#f472b6', secondary: '#fbbf24' },
    agents: [
      { name: '案件', en: 'BRIEFS', role: '受注→投稿→レポート' },
      { name: '分析', en: 'ANALYTICS', role: 'Instagram / X / TikTok 解析' },
      { name: '創作', en: 'CREATION', role: 'キャプション・サムネ生成' },
      { name: 'ブランド', en: 'BRAND', role: 'プロフィール / トーン統一' },
      { name: 'コミュニティ', en: 'COMMUNITY', role: 'DM / コメント返信支援' },
      { name: '収益', en: 'REVENUE', role: '案件単価 / 投げ銭 / EC' },
    ],
    pricing: [
      { plan: 'Starter', price: '¥1,480', period: '/ 月', features: ['1 SNS アカウント', '基本分析', '月 30 投稿生成'] },
      { plan: 'Creator', price: '¥4,800', period: '/ 月', features: ['3 SNS アカウント', '全 6 ファセット', '無制限生成', '案件管理'], highlight: true },
      { plan: 'Agency', price: '¥12,800', period: '/ 月', features: ['10+ アカウント管理', 'チーム機能', 'PRD / クライアント招待', '事務局代行 AI'] },
    ],
    kgi: [
      { label: '有料クリエイター数 (Q4)', q4_target: '1,000 人' },
      { label: '月次 MRR', q4_target: '¥5M' },
      { label: 'チャーン率', q4_target: '< 5%' },
      { label: '紹介率', q4_target: '> 30%' },
    ],
    targetCustomers: [
      'フォロワー 5,000〜100,000 のマイクロ / ミドルインフルエンサー',
      'YouTuber / Vlogger / TikTok クリエイター',
      'ブランド / EC の SNS 担当者',
      'クリエイターエージェンシー',
    ],
  },
};

export default function ProductsTab() {
  const [active, setActive] = useState<ProductId>('prism');
  const p = PRODUCTS[active];

  return (
    <div style={{ fontFamily: FONT_SERIF_JA, color: '#fff' }}>
      {/* プロダクト切替 */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {(Object.keys(PRODUCTS) as ProductId[]).map(id => {
          const isOn = active === id;
          const c = PRODUCTS[id].color;
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                padding: '0.7rem 1.5rem',
                borderRadius: 999,
                background: isOn ? `linear-gradient(135deg, ${c.primary}, ${c.secondary})` : 'rgba(255,255,255,0.04)',
                border: isOn ? 'none' : '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontFamily: FONT_DISPLAY,
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                cursor: 'pointer',
              }}
            >
              {PRODUCTS[id].name.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Hero */}
      <div style={{
        padding: '2.5rem 2rem',
        background: `linear-gradient(135deg, ${p.color.primary}15, ${p.color.secondary}10)`,
        border: `1px solid ${p.color.primary}40`,
        borderRadius: 18,
        textAlign: 'center',
        marginBottom: '2rem',
      }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.4em', color: p.color.primary, fontWeight: 700 }}>
          {p.name.toUpperCase()}
        </p>
        <h2 style={{
          fontSize: 'clamp(1.5rem, 3vw, 2.2rem)',
          fontWeight: 800,
          margin: '1rem 0',
          background: `linear-gradient(90deg, ${p.color.primary}, ${p.color.secondary})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>{p.tagline}</h2>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', maxWidth: 640, margin: '0 auto', lineHeight: 1.9 }}>{p.description}</p>
        <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
          <strong style={{ color: '#fff' }}>対象:</strong> {p.for}
        </p>
      </div>

      {/* エージェント / ファセット一覧 */}
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>{active === 'prism' ? '7 AGENTS' : '6 FACETS'}</p>
        <h3 style={h3Style}>{active === 'prism' ? '7 つのエージェント' : '6 つのファセット'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {p.agents.map((a, i) => (
            <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.28em', color: p.color.primary, fontWeight: 700 }}>{a.en}</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0' }}>{a.name}</p>
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{a.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 価格表 */}
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>PRICING</p>
        <h3 style={h3Style}>価格表</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          {p.pricing.map((pp, i) => (
            <div key={i} style={{
              padding: '1.5rem 1.25rem',
              background: pp.highlight ? `linear-gradient(135deg, ${p.color.primary}20, ${p.color.secondary}10)` : 'rgba(255,255,255,0.03)',
              border: pp.highlight ? `1px solid ${p.color.primary}80` : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14,
              position: 'relative',
            }}>
              {pp.highlight && (
                <p style={{ position: 'absolute', top: -10, right: 16, fontSize: '0.6rem', padding: '2px 8px', background: p.color.primary, color: '#fff', borderRadius: 999, letterSpacing: '0.2em', fontWeight: 700 }}>POPULAR</p>
              )}
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>{pp.plan.toUpperCase()}</p>
              <p style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: 8, fontFamily: FONT_SERIF_JA }}>
                {pp.price}<span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>{pp.period}</span>
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pp.features.map((f, j) => (
                  <li key={j} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', paddingLeft: '1rem', position: 'relative', lineHeight: 1.8 }}>
                    <span style={{ position: 'absolute', left: 0, color: p.color.primary }}>·</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ターゲット顧客 */}
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>TARGET CUSTOMERS</p>
        <h3 style={h3Style}>主要ターゲット</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {p.targetCustomers.map((t, i) => (
            <li key={i} style={{ padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: '0.85rem', lineHeight: 1.8, paddingLeft: '2.4rem', position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)',
                width: 22, height: 22, borderRadius: '50%',
                background: `linear-gradient(135deg, ${p.color.primary}, ${p.color.secondary})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONT_DISPLAY, fontSize: '0.7rem', fontWeight: 700,
              }}>{i + 1}</span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* KGI */}
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>KGI — Q4 2026</p>
        <h3 style={h3Style}>主要目標 (KGI)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          {p.kgi.map((k, i) => (
            <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, textAlign: 'center' }}>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', fontFamily: FONT_DISPLAY, letterSpacing: '0.25em', fontWeight: 700 }}>{k.label}</p>
              <p style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: 6, color: p.color.primary, fontFamily: FONT_SERIF_JA }}>{k.q4_target}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 機能比較表 */}
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>COMPARISON</p>
        <h3 style={h3Style}>Prism vs Iris 機能比較</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'rgba(167,139,250,0.10)' }}>
                <th style={cellHead}>項目</th>
                <th style={{ ...cellHead, color: '#60a5fa' }}>CORE Prism</th>
                <th style={{ ...cellHead, color: '#f472b6' }}>CORE Iris</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i}>
                  <td style={cellStyle}>{row.label}</td>
                  <td style={cellStyle}>{row.prism}</td>
                  <td style={cellStyle}>{row.iris}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* スライド / PDF へのリンク */}
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>RESOURCES</p>
        <h3 style={h3Style}>詳細スライド / 製品カタログ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <a href="/keynote" style={resourceLink}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.25em', color: '#fbbf24' }}>KEYNOTE</span>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>講演会 / 先行案内 LP</p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>イベント参加者向けのプロダクト紹介ページ</p>
          </a>
          <a href="/corp" style={resourceLink}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.25em', color: '#a78bfa' }}>CORP</span>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>法人サイト</p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>株式会社CORE 公開情報ページ</p>
          </a>
          <a href="/pricing" style={resourceLink}>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.65rem', letterSpacing: '0.25em', color: '#60a5fa' }}>PRICING</span>
            <p style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: 4 }}>価格表 + ROI 計算機</p>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>顧客向け価格ページ</p>
          </a>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', marginTop: '1rem', lineHeight: 1.7 }}>
          PPTX カタログは <code>scripts/generateProductCatalog.py</code> で生成。Desktop に出力されます。
        </p>
      </section>
    </div>
  );
}

const COMPARISON = [
  { label: '対象顧客', prism: '事業家・経営者', iris: 'クリエイター・SNS' },
  { label: 'エージェント数', prism: '7 (経営・財務 ...)', iris: '6 (案件・分析 ...)' },
  { label: '主要連携', prism: 'Gmail / Calendar / 会計', iris: 'Instagram / X / TikTok' },
  { label: '料金 (Pro/Creator)', prism: '¥3,980 / 月', iris: '¥4,800 / 月' },
  { label: 'Q4 MRR 目標', prism: '¥8M', iris: '¥5M' },
];

const sectionStyle: React.CSSProperties = {
  marginBottom: '2rem',
  padding: '1.5rem 1.75rem',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: '0.6rem',
  letterSpacing: '0.3em',
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 700,
  margin: 0,
};

const h3Style: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 700,
  margin: '4px 0 1rem',
  color: '#fff',
};

const cellHead: React.CSSProperties = {
  padding: '0.75rem 0.9rem',
  textAlign: 'left',
  fontFamily: FONT_DISPLAY,
  fontSize: '0.7rem',
  letterSpacing: '0.2em',
  fontWeight: 700,
  borderBottom: '1px solid rgba(255,255,255,0.15)',
};

const cellStyle: React.CSSProperties = {
  padding: '0.7rem 0.9rem',
  fontSize: '0.85rem',
  color: 'rgba(255,255,255,0.85)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const resourceLink: React.CSSProperties = {
  display: 'block',
  padding: '1rem 1.1rem',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10,
  textDecoration: 'none',
  color: '#fff',
};
