// ============================================================
// 新規事業ポートフォリオ — Lume / ResonanceBot の事業計画ページ
// /strategy の「新規事業」タブから表示。各事業を1ページの計画書として描画。
// 数字は前提つき推定（盛らない）。Stripe Japan 手数料 3.6% で実利益を明示。
// ============================================================
import { useState } from 'react';
import { motion } from 'framer-motion';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';

const yen = (n: number) => '¥' + Math.round(n).toLocaleString('ja-JP');

type PriceRow = { plan: string; price: string; net: string; desc: string; pop?: boolean };
type ProfitRow = { users: string; mrr: string; fee: string; infra: string; net: string; margin: string };
type Venture = {
  id: string;
  name: string;
  reading: string;
  tagline: string;
  status: string;
  accent: string;
  accent2: string;
  liveUrl: string;
  oneLine: string;
  problem: string[];
  solution: string[];
  market: string[];
  pricing: PriceRow[];
  unitNote: string;
  profit: ProfitRow[];
  profitNote: string;
  edge: string[];
  roadmap: { phase: string; body: string }[];
  links: { label: string; url: string }[];
};

const VENTURES: Venture[] = [
  {
    id: 'lume',
    name: 'Lume',
    reading: 'ルーメ',
    tagline: 'あなたのリンクを、いちばん美しく光らせる。',
    status: 'LP・アプリ公開済み / β',
    accent: '#7C5CFF',
    accent2: '#FF6EC7',
    liveUrl: 'https://lume-deploy-five.vercel.app/',
    oneLine: 'LitLink 代替のリンクまとめサービス。30秒で美しいプロフィール、そして「誰がどのリンクを踏んだか」をヒートマップで見える化する。',
    problem: [
      'LitLink は編集画面がごちゃつき、デザインが「みんな同じ見た目」になりがち',
      '分析がクリック総数どまりで、どこが効いているか分からない',
      '海外勢（Linktree）は日本語・日本決済・国内最適化が弱い',
    ],
    solution: [
      'ブロックを並べるだけの直感エディタ + 5テーマ（Aurora/Light/Photo/Sunset/Mono）',
      'クリックヒートマップ：押された比率を熱で可視化。並び替えで成果が伸びる',
      '流入元クロス分析（Instagram から来た人は EC、TikTok は YouTube…）+ 時間帯ヒート',
    ],
    market: [
      'LitLink: 累計400万人（2025/10・TieUps）。10ヶ月で+100万人と加速中',
      'Linktree: 5,000万人超・評価額$13億・月間12億訪問（世界最大手）',
      '乗り換えコストが低い（貼り替えるだけ）→ 良い物を作れば奪える市場',
    ],
    pricing: [
      { plan: 'Free', price: '¥0', net: '—', desc: 'リンク無制限・基本テーマ・クリック総数' },
      { plan: 'Pro', price: '¥980/月', net: yen(945), desc: '全テーマ・ヒートマップ分析・流入元分析・独自ドメイン', pop: true },
      { plan: 'Business', price: '¥2,980/月〜', net: yen(2873), desc: 'チーム管理・EC/予約連携・チーム分析' },
    ],
    unitNote: 'Pro/Business とも Stripe Japan 手数料 3.6% を引いた純額。ソフトウェアなので1人増えても原価はほぼ増えない（限界費用≒0）。',
    profit: [
      { users: '100人', mrr: yen(138000), fee: yen(4968), infra: yen(5000), net: yen(128032), margin: '92.8%' },
      { users: '1,000人', mrr: yen(1380000), fee: yen(49680), infra: yen(20000), net: yen(1310320), margin: '95.0%' },
      { users: '5,000人', mrr: yen(6900000), fee: yen(248400), infra: yen(60000), net: yen(6591600), margin: '95.5%' },
      { users: '10,000人', mrr: yen(13800000), fee: yen(496800), infra: yen(100000), net: yen(13203200), margin: '95.7%' },
    ],
    profitNote: '有料の内訳を Pro 80% / Business 20%（平均単価 ¥1,380）と仮定した【推定】。インフラは Vercel/保存先の概算。CAC（集客費）と人件費は別。実データで更新する。',
    edge: [
      'ヒートマップが差別化の核 — LitLink にも Linktree 無料版にも無い',
      '日本のクリエイターに最適化（言葉・決済・テーマ）',
      '毎日使うインフラ型 → 解約されにくい（高継続）',
    ],
    roadmap: [
      { phase: 'いま', body: 'LP・アプリ・分析を公開。Stripe決済リンク接続。毎日自律改善（16:00）' },
      { phase: '〜1ヶ月', body: '本物のユーザー横断集計（無料KV）/ 自分のページ作成フロー / iPhone実機磨き' },
      { phase: '〜3ヶ月', body: 'テーマ拡充・独自ドメイン・埋め込み・紹介リンク。初期ユーザー獲得' },
      { phase: '〜6ヶ月', body: 'A/Bテスト（並び順自動最適化）・チーム機能で Business 転換' },
    ],
    links: [
      { label: 'LP（本番）', url: 'https://lume-deploy-five.vercel.app/' },
      { label: 'アプリ', url: 'https://lume-deploy-five.vercel.app/app' },
      { label: '分析画面', url: 'https://lume-deploy-five.vercel.app/admin' },
      { label: 'Stripe Pro ¥980', url: 'https://buy.stripe.com/4gMdRaem7bCH6bh6LfdIA0j' },
      { label: 'Stripe Business ¥2,980', url: 'https://buy.stripe.com/eVqaEYguf0Y30QX1qVdIA0k' },
    ],
  },
  {
    id: 'resonance',
    name: 'ResonanceBot',
    reading: 'レゾナンスボット',
    tagline: '一人ひとりに、その人だけのメッセージを。',
    status: 'Phase1 設計完了 / 開発中',
    accent: '#22c55e',
    accent2: '#06b6d4',
    liveUrl: '',
    oneLine: 'LINE × Claude のパーソナライズ配信 SaaS。大企業の CRM のような「一人ひとりに寄り添う体験」を、月数千円で個人事業主にも届ける。',
    problem: [
      'LINE公式は「全員に同じ文章」しか送れず、特別感が出ない',
      'セグメント配信はあっても限界があり、本当の個別対応にならない',
      '手書きの個別メッセージは手間がかかり「続かない」',
    ],
    solution: [
      'Claude が過去の会話を踏まえ、その人だけの文面を自動生成',
      '名前差し替え〜本格パーソナライズまで段階対応',
      '誤送信を防ぐ「承認フロー」付き（安全に配信）',
    ],
    market: [
      'LINE は日本のインフラ（生活者の大多数が日常利用）',
      'LINE公式アカウントは小規模事業者に広く普及',
      '盛らない算定：有料1,000件で月商500万、5,000件で月商2,500万（ARPU¥5,000想定）',
    ],
    pricing: [
      { plan: 'Free', price: '¥0', net: '—', desc: 'AI生成なし・名前差し替えのみ。まず試す人' },
      { plan: 'Basic', price: '¥2,980/月', net: yen(2873), desc: '名前差し替えが無制限', pop: true },
      { plan: 'Premium', price: '¥9,800/月', net: yen(9447), desc: 'Claude による個別パーソナライズ配信' },
    ],
    unitNote: '利用者が自分の API キーを接続する設計のため、使われるほど膨らむ AI 代を構造的に回避（運営の AI 原価 ≒ 0）。だから安い料金でも高利益。',
    profit: [
      { users: '100人', mrr: yen(502600), fee: yen(18094), infra: yen(10000), net: yen(474506), margin: '94.4%' },
      { users: '1,000人', mrr: yen(5026000), fee: yen(180936), infra: yen(30000), net: yen(4815064), margin: '95.8%' },
      { users: '5,000人', mrr: yen(25130000), fee: yen(904680), infra: yen(80000), net: yen(24145320), margin: '96.1%' },
    ],
    profitNote: '有料の内訳を Basic 70% / Premium 30%（平均ARPU ¥5,026）と仮定した【推定】。AI原価は利用者の自前鍵なのでほぼ0。インフラは Vercel/Upstash の概算。CAC・人件費は別。',
    edge: [
      '「便利ツール」ではなく「関係性を深める道具」という哲学',
      '自前鍵接続でAI原価ゼロ → 多くのAI SaaSの弱点を構造回避',
      'LTV ¥10万 ÷ CAC ¥2万 ≒ 5倍（標準・前提値）。紹介中心でCACを低く',
    ],
    roadmap: [
      { phase: 'いま', body: 'Phase1 設計完了。料金プラン実装済み。マルチテナント設計' },
      { phase: '〜3ヶ月', body: 'アーティスト/音楽教室/サロンに初期導入。自社事例（GAUCHE等）で実証' },
      { phase: '〜6ヶ月', body: '紹介チャネル確立・テンプレ拡充・承認フロー磨き込み' },
      { phase: '〜12ヶ月', body: '有料1,000件規模へ。業種別パッケージ展開' },
    ],
    links: [
      { label: '事業計画書（Desktop）', url: '' },
    ],
  },
];

export default function NewVenturesTab() {
  const [sel, setSel] = useState(0);
  const v = VENTURES[sel];
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* 事業セレクタ */}
      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        {VENTURES.map((vv, i) => (
          <button key={vv.id} onClick={() => setSel(i)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 1.2rem', borderRadius: 999, cursor: 'pointer',
            background: sel === i ? `linear-gradient(135deg, ${vv.accent}, ${vv.accent2})` : 'rgba(255,255,255,0.04)',
            border: sel === i ? 'none' : '1px solid rgba(255,255,255,0.12)',
            color: '#fff', fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', fontWeight: 700,
          }}>
            <span style={{ width: 18, height: 18, borderRadius: 6, background: `linear-gradient(135deg,${vv.accent},${vv.accent2})`, display: 'inline-block', boxShadow: sel === i ? '0 0 0 2px rgba(255,255,255,0.4)' : 'none' }} />
            {vv.name}
          </button>
        ))}
      </div>

      <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* ヒーロー */}
        <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', padding: '2.5rem 2rem', marginBottom: '1.5rem',
          background: `linear-gradient(135deg, ${v.accent}22, ${v.accent2}11), rgba(255,255,255,0.02)`, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${v.accent},${v.accent2})`, position: 'relative', flex: '0 0 auto' }}>
              <span style={{ position: 'absolute', inset: 0, margin: 'auto', width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 0 14px 5px rgba(255,255,255,0.7)' }} />
            </div>
            <div>
              <h2 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.2 }}>{v.name} <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>{v.reading}</span></h2>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: 'rgba(255,255,255,0.8)' }}>{v.tagline}</p>
            </div>
          </div>
          <span style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, padding: '4px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', marginBottom: 14 }}>● {v.status}</span>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.9, maxWidth: 760 }}>{v.oneLine}</p>
          {v.liveUrl && <a href={v.liveUrl} target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: 16, padding: '0.6rem 1.3rem', borderRadius: 999, background: `linear-gradient(135deg,${v.accent},${v.accent2})`, color: '#fff', fontFamily: FONT_SERIF_JA, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>本番サイトを開く →</a>}
        </div>

        {/* 課題 / ソリューション */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <Card title="課題" accent="#fca5a5">{v.problem.map((p, i) => <Li key={i} mark="✕" color="#fca5a5">{p}</Li>)}</Card>
          <Card title="ソリューション" accent="#86efac">{v.solution.map((p, i) => <Li key={i} mark="✓" color="#86efac">{p}</Li>)}</Card>
        </div>

        {/* 市場 */}
        <Card title="市場" accent={v.accent2} full>{v.market.map((p, i) => <Li key={i} mark="▸" color={v.accent2}>{p}</Li>)}</Card>

        {/* 料金 */}
        <h3 style={subhead}>料金プラン</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.8rem', marginBottom: 10 }}>
          {v.pricing.map((p, i) => (
            <div key={i} style={{ position: 'relative', padding: '1.4rem 1.2rem', borderRadius: 16,
              background: p.pop ? `linear-gradient(180deg, ${v.accent}25, ${v.accent2}10)` : 'rgba(255,255,255,0.03)',
              border: p.pop ? `1px solid ${v.accent}` : '1px solid rgba(255,255,255,0.1)' }}>
              {p.pop && <span style={{ position: 'absolute', top: -10, left: 16, fontSize: '0.65rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: `linear-gradient(135deg,${v.accent},${v.accent2})` }}>人気</span>}
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{p.plan}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.5rem', fontWeight: 800, margin: '4px 0' }}>{p.price}</p>
              <p style={{ fontSize: '0.7rem', color: '#86efac', fontFamily: 'monospace' }}>手数料引き後 {p.net}</p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginTop: 8 }}>{p.desc}</p>
            </div>
          ))}
        </div>
        <p style={noteStyle}>{v.unitNote}</p>

        {/* 利益モデル */}
        <h3 style={subhead}>利益モデル（この価格での実利益）</h3>
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', marginBottom: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_SERIF_JA, fontSize: '0.82rem', minWidth: 620 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                {['有料顧客', '月商(MRR)', 'Stripe手数料', 'インフラ', '純利益/月', '利益率'].map(h => (
                  <th key={h} style={{ padding: '0.7rem 1rem', textAlign: h === '有料顧客' ? 'left' : 'right', color: 'rgba(255,255,255,0.6)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.profit.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '0.7rem 1rem', fontWeight: 700 }}>{r.users}</td>
                  <td style={tdNum}>{r.mrr}</td>
                  <td style={{ ...tdNum, color: '#fca5a5' }}>-{r.fee}</td>
                  <td style={{ ...tdNum, color: 'rgba(255,255,255,0.5)' }}>-{r.infra}</td>
                  <td style={{ ...tdNum, color: '#86efac', fontWeight: 800 }}>{r.net}</td>
                  <td style={{ ...tdNum, color: v.accent === '#7C5CFF' ? '#c4b5fd' : '#6ee7b7', fontWeight: 800 }}>{r.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={noteStyle}>{v.profitNote}</p>

        {/* 競争優位 / ロードマップ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1rem', marginTop: '1.5rem' }}>
          <Card title="競争優位（堀）" accent={v.accent}>{v.edge.map((p, i) => <Li key={i} mark="◆" color={v.accent}>{p}</Li>)}</Card>
          <div style={cardStyle}>
            <p style={cardTitle('#fbbf24')}>ロードマップ</p>
            {v.roadmap.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <span style={{ flex: '0 0 auto', fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24', fontFamily: FONT_DISPLAY, minWidth: 56 }}>{r.phase}</span>
                <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7 }}>{r.body}</span>
              </div>
            ))}
          </div>
        </div>

        {/* リンク */}
        {v.links.some(l => l.url) && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {v.links.filter(l => l.url).map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noopener" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)', textDecoration: 'none', fontFamily: FONT_SERIF_JA }}>{l.label} ↗</a>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

const cardStyle: React.CSSProperties = { padding: '1.4rem 1.5rem', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' };
const cardTitle = (c: string): React.CSSProperties => ({ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 700, color: c, marginBottom: 12 });
const subhead: React.CSSProperties = { fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, margin: '1.8rem 0 0.9rem' };
const tdNum: React.CSSProperties = { padding: '0.7rem 1rem', textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' };
const noteStyle: React.CSSProperties = { fontFamily: FONT_SERIF_JA, fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: '0.5rem' };

function Card({ title, accent, children, full }: { title: string; accent: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={{ ...cardStyle, ...(full ? { marginBottom: '0.5rem' } : {}) }}>
      <p style={cardTitle(accent)}>{title}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{children}</ul>
    </div>
  );
}
function Li({ mark, color, children }: { mark: string; color: string; children: React.ReactNode }) {
  return (
    <li style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.82rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.8, paddingLeft: '1.3rem', position: 'relative', marginBottom: 6 }}>
      <span style={{ position: 'absolute', left: 0, color, fontWeight: 700 }}>{mark}</span>{children}
    </li>
  );
}
