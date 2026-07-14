// ============================================================
// ProductsTab — Prism / Iris の製品説明書 (Web 版)
// /strategy の「プロダクト」タブ
// generateProductCatalog.py の Web 化版。1 ページ完結 + 価格表 + KGI
// ============================================================
import { useState } from 'react';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';

type ProductId = 'prism' | 'iris' | 'lume' | 'resonance';

const PRODUCTS: Record<ProductId, {
  name: string;
  tagline: string;
  for: string;
  description: string;
  color: { primary: string; secondary: string };
  featureLabel: { en: string; ja: string };
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
    featureLabel: { en: '7 AGENTS', ja: '7 つのエージェント' },
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
      { plan: 'Starter', price: '¥2,980', period: '/ 月', features: ['3 つの人格 (経営 / 営業 / +1)', '商談・議事録・スライド AI', 'Cmd+K 横断検索', '3 日間 無料トライアル'] },
      { plan: 'Standard', price: '¥9,800', period: '/ 月', features: ['7 つの人格 (全エージェント)', '提案書・契約書・財務 AI', 'Gmail シャドー秘書', '見積→請求の一気通貫', '3 日間 無料トライアル'], highlight: true },
      { plan: 'Exclusive', price: '¥29,800', period: '/ 月', features: ['Standard 全機能', '人物ケア (1on1 + センチメント)', 'API + Webhook', 'チーム共有 (5 名)', '優先サポート + 戦略コーチ'] },
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
    description: 'クリエイター活動の 6 つの仕事を 1 つの AI 相棒に統合。案件管理 / Instagram 解析 / 投稿生成 / ブランド統一 / コミュニティ運営 / 収益管理 — Instagram・X・TikTok・YouTube すべてに対応。',
    color: { primary: '#f472b6', secondary: '#fbbf24' },
    featureLabel: { en: '6 FACETS', ja: '6 つのファセット' },
    agents: [
      { name: '案件', en: 'BRIEFS', role: '受注→投稿→レポート' },
      { name: '分析', en: 'ANALYTICS', role: 'Instagram / X / TikTok 解析' },
      { name: '創作', en: 'CREATION', role: 'キャプション・サムネ生成' },
      { name: 'ブランド', en: 'BRAND', role: 'プロフィール / トーン統一' },
      { name: 'コミュニティ', en: 'COMMUNITY', role: 'DM / コメント返信支援' },
      { name: '収益', en: 'REVENUE', role: '案件単価 / 投げ銭 / EC' },
    ],
    pricing: [
      { plan: 'Lite', price: '¥2,980', period: '/ 月', features: ['AI キャプション 30 回 / 月', '案件管理 無制限', '基本フィルター', 'コミュニティ閲覧'] },
      { plan: 'Standard', price: '¥6,980', period: '/ 月', features: ['AI キャプション 無制限', 'IG 分析 月 10 回', 'ストーリー設計 5 本', 'コミュニティ投稿'], highlight: true },
      { plan: 'Pro', price: '¥12,800', period: '/ 月', features: ['Standard 全機能', 'チーム 5 名', 'ブランドマッチ無制限', 'メディアキット'] },
      { plan: 'Agency', price: '¥29,800', period: '/ 月', features: ['Pro 全機能', '連携アカウント 30 (複数クライアント)', '企画・台本スタジオ 無制限', '専任サポート'] },
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
  lume: {
    name: 'Lume',
    tagline: 'あなたのリンクを、いちばん美しく光らせる。',
    for: 'クリエイター / 個人事業主 / 店舗',
    description: 'LitLink 代替のリンクまとめサービス。30 秒で美しいプロフィールを公開し、「誰がどのリンクを踏んだか」をヒートマップで見える化する。日本のクリエイターに最適化。',
    color: { primary: '#FFC23A', secondary: '#FF7A18' },
    featureLabel: { en: '4 FEATURES', ja: '主な機能' },
    agents: [
      { name: '美しいプロフィール', en: 'PROFILE', role: '30 秒で公開 / 5 テーマ自由' },
      { name: 'クリックヒートマップ', en: 'HEATMAP', role: '誰がどこを踏んだか色で可視化' },
      { name: '流入元クロス分析', en: 'SOURCE', role: 'Instagram / TikTok 別の行動' },
      { name: '爆速表示', en: 'SPEED', role: '開いた瞬間に表示 / 離脱させない' },
    ],
    pricing: [
      { plan: 'Free', price: '¥0', period: '', features: ['リンク無制限', '基本テーマ', 'クリック総数'] },
      { plan: 'Pro', price: '¥1,480', period: '/ 月', features: ['全テーマ + カスタムフォント', 'ヒートマップ分析', '流入元クロス分析', '独自ドメイン', '3日間無料'], highlight: true },
      { plan: 'Business', price: '¥3,480', period: '/ 月〜', features: ['チーム管理', 'EC / 予約連携', 'チーム分析', 'ロゴ非表示', '3日間無料'] },
    ],
    kgi: [
      { label: '有料ユーザー数 (Q4)', q4_target: '1,000 人' },
      { label: '月次 MRR', q4_target: '¥1.9M' },
      { label: '無料→有料 転換', q4_target: '3%+' },
      { label: 'チャーン率', q4_target: '< 5%' },
    ],
    targetCustomers: [
      'LitLink / Linktree を使っているクリエイター',
      'フォロワーを EC・予約・公式 LINE に誘導したい発信者',
      '店舗 / EC / アーティスト・絵本作家',
      '「踏まれ方」を見て改善したい個人事業主',
    ],
  },
  resonance: {
    name: 'Resonance',
    tagline: '一人ひとりに、その人だけのメッセージを。',
    for: '個人事業主 / 店舗 / アーティスト',
    description: 'LINE × Claude のパーソナライズ配信 SaaS。大企業の CRM のような「一人ひとりに寄り添う体験」を、月1,980円から個人事業主にも届ける。利用者が自分の鍵を接続するため AI 原価はほぼゼロ。',
    color: { primary: '#22c55e', secondary: '#06b6d4' },
    featureLabel: { en: '4 FEATURES', ja: '中心機能' },
    agents: [
      { name: '個別パーソナライズ', en: 'PERSONALIZE', role: '過去の会話を踏まえ自動生成' },
      { name: '名前差し替え', en: 'NAME', role: 'その人の名前で語りかける' },
      { name: '承認フロー', en: 'APPROVAL', role: '誤送信を防いで安全に配信' },
      { name: '自前鍵接続', en: 'BYOK', role: 'AI 原価ゼロのコスト構造' },
    ],
    pricing: [
      { plan: 'Solo', price: '¥1,980', period: '/ 月', features: ['名前差し替え 無制限', '個別配信をまず始める層に', '承認フローで誤送信ゼロ'], highlight: true },
      { plan: 'Pro', price: '¥6,980', period: '/ 月', features: ['Claude 個別パーソナライズ配信', '過去の会話を踏まえる', 'ファンとの関係を深める'] },
      { plan: 'Business', price: '¥14,800', period: '/ 月', features: ['大規模 / 複数ライン配信', 'チーム運用', '優先サポート'] },
    ],
    kgi: [
      { label: '有料件数 (Q4)', q4_target: '1,000 件' },
      { label: '月次 MRR', q4_target: '¥1.6M' },
      { label: 'LTV ÷ CAC', q4_target: '約 5 倍' },
      { label: 'チャーン率', q4_target: '< 5%' },
    ],
    targetCustomers: [
      'アーティスト / 音楽教室 / サロン',
      'LINE 公式アカウントを運用する小規模事業者',
      'ファンとの関係を深めたい個人ビジネス',
      '名前入り・個別配信で特別感を出したい店舗',
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
        <p style={{
          fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)',
          maxWidth: 640, margin: '0 auto', lineHeight: 1.9,
          wordBreak: 'keep-all', overflowWrap: 'break-word',
        }}>{p.description}</p>
        <p style={{ marginTop: '1rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
          <strong style={{ color: '#fff' }}>対象:</strong> {p.for}
        </p>
      </div>

      {/* エージェント / ファセット一覧 */}
      <section style={sectionStyle}>
        <p style={eyebrowStyle}>{p.featureLabel.en}</p>
        <h3 style={h3Style}>{p.featureLabel.ja}</h3>
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

      {/* 機能比較表 (Prism / Iris のみ) */}
      {(active === 'prism' || active === 'iris') && (
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
      )}

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
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>CORE 公開情報ページ</p>
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
  { label: '料金 (主力プラン)', prism: '¥9,800 / 月', iris: '¥6,980 / 月' },
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
