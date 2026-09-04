// ============================================================
// CORE Studio — 受託開発 (/studio/dev) 2026-09-04 全面刷新
// 旧: チップで Tier を1つずつ切り替えるカード1枚。4段の価格の関係も、
//     「自社で8つ運営している」の証拠も、画面に1つも無かった。
// 新: 公開中の業務システム2件を重ねたヒーロー → 対数の横軸に4 Tier の価格幅を置いた目盛り
//     → 4 Tier の詳細 → どう作るか (体制・技術) → 自社プロダクト8つ → 開発実績 → 相談。
// 文言・価格は plans.ts が正本。技術の一覧だけはここに置く (このリポジトリで実際に使っているものだけ)。
// ============================================================
import { DEV_TIERS, DEV_LEAD, REASONS, WORKS, CONTACT, CORE_PRODUCT_COUNT, type Work } from './plans';
import { C, D } from './theme';
import { Band, H2, Note, IconCheck, IconArrow, LineCta } from './ui';
import { PageStyle, PageHero, ProductsGrid, ClosingCta } from './PageHero';
import type { Go } from './tabs';

// 実際に自社プロダクト・受託案件で使っている技術だけを並べる (宣伝のために盛らない)。
const STACK = ['React', 'TypeScript', 'Node.js', 'Supabase (PostgreSQL)', 'Vercel', 'Stripe', 'Claude API', 'LINE Messaging API', 'Google Calendar API', 'PWA'];

// 価格の目盛り。対数軸にしないと ¥50万 と ¥3,000万 が同じ画面に入らない。
const SCALE_MIN = 50;
const SCALE_MAX = 3000;
const pos = (v: number) => ((Math.log(v) - Math.log(SCALE_MIN)) / (Math.log(SCALE_MAX) - Math.log(SCALE_MIN))) * 100;
const TICKS = [50, 150, 500, 1500, 3000];
const man = (v: number) => `¥${v.toLocaleString('ja-JP')}万`;

const workOf = (id: string): Work | undefined => WORKS.find(w => w.id === id);

export default function DevPage({ go }: { go: Go }) {
  const apps = WORKS.filter(w => w.category === 'アプリ');
  const stageA = workOf('anima') ?? apps[0];
  const stageB = workOf('soma') ?? apps[1];

  return (
    <div>
      <PageStyle />
      <PageHero
        en="Development"
        title={<>構想を、<br />動くかたちにする。</>}
        lead={DEV_LEAD}
        amb={stageA?.img}
        facts={[
          { v: String(DEV_TIERS.length), l: 'つのTier' },
          { v: `${DEV_TIERS[0].price}`, l: `${DEV_TIERS[0].name} から` },
          { v: DEV_TIERS[0].duration.split('〜')[0] + '〜', l: '最短の着手〜納品' },
          { v: String(CORE_PRODUCT_COUNT), l: '自社開発・運営プロダクト' },
        ]}
        cta={<><LineCta label="開発についてLINEで相談する" where="dev-hero" /><button className="st-btn st-btn-dark" onClick={() => go('contact')}>6つの質問で概算を出す</button></>}
        note="要件が固まっていない段階からのご相談も承ります。"
        visual={
          (stageA || stageB) && (
            <div className="sp-stage" aria-label="公開中の業務システム">
              {stageA && (
                <a className="sp-stage-a" href={stageA.url} target="_blank" rel="noopener noreferrer" aria-label={`${stageA.name} を見る`}>
                  <img src={stageA.img} alt="" decoding="async" />
                  <span className="sp-deck-cap">{stageA.name} — {stageA.category}</span>
                </a>
              )}
              {stageB && (
                <a className="sp-stage-b" href={stageB.url} target="_blank" rel="noopener noreferrer" aria-label={`${stageB.name} を見る`}>
                  <img src={stageB.img} alt="" decoding="async" />
                  <span className="sp-deck-cap">{stageB.name} — {stageB.category}</span>
                </a>
              )}
            </div>
          )
        }
      />

      {/* 価格の目盛り */}
      <Band wide pad="clamp(56px, 6vw, 88px) 0">
        <H2 en="Scale" sub="規模に応じて4段に分けています。横軸は金額 (対数)、帯の中は期間の目安です。">4つのTier — 金額と期間の関係</H2>
        <div className="sp-scale">
          {DEV_TIERS.map(t => (
            <div key={t.id} className="sp-scale-row">
              <div className="sp-scale-name">{t.name}<small>{t.price}</small><em>{t.duration}</em></div>
              <div className="sp-scale-track">
                <div className="sp-scale-bar" style={{ left: `${pos(t.minPrice)}%`, width: `${pos(t.maxPrice) - pos(t.minPrice)}%` }} title={`${t.price} / ${t.duration}`}>{t.duration}</div>
              </div>
            </div>
          ))}
          <div className="sp-scale-row" data-axis="true">
            <div />
            <div className="sp-scale-axis" aria-hidden>
              {TICKS.map((v, i) => (
                <span key={v} className="sp-scale-tick" data-minor={i % 2 === 1} data-edge={i === 0 ? 'start' : i === TICKS.length - 1 ? 'end' : undefined} style={{ left: `${pos(v)}%` }}>{man(v)}</span>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Tier の詳細 */}
        <div className="sp-grid2" style={{ marginTop: 34 }}>
          {DEV_TIERS.map(t => (
            <div key={t.id} className="st-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <div className="sp-col-name">{t.name}</div>
                <div className="st-serif" style={{ fontSize: 20, fontWeight: 700, color: C.ink }}>{t.price}</div>
              </div>
              <div className="sp-col-lead">{t.lead}</div>
              <p className="sp-col-scope">{t.scope}</p>
              <div className="sp-col-meta"><span>期間の目安 {t.duration}</span></div>
              <div className="sp-col-sub">開発例</div>
              <ul className="sp-list">
                {t.examples.map(e => <li key={e}><IconCheck />{e}</li>)}
              </ul>
              <div className="sp-best" style={{ marginTop: 'auto' }}><b>価格の考え方 — </b>{t.pricing}</div>
            </div>
          ))}
        </div>
      </Band>

      {/* どう作るか */}
      <section style={{ background: D.bg, padding: 'clamp(52px, 6vw, 84px) 0' }}>
        <div className="st-inner st-wide">
          <H2 dark en="How we build" sub="受託だけの会社と違い、当社は自社のプロダクトを毎日運営しています。そこで検証した設計と技術を、そのまま貴社の案件に投入します。">自分たちの事業で、毎日検証している。</H2>
          <div className="sp-grid3">
            {REASONS.map((r, i) => (
              <div key={r.id} style={{ background: D.raise, border: `1px solid ${D.line}`, borderRadius: 14, padding: '22px 20px' }}>
                <span className="st-serif" style={{ display: 'block', fontSize: 15, fontWeight: 700, color: D.gold, marginBottom: 10 }}>{String(i + 1).padStart(2, '0')}</span>
                <div className="st-serif" style={{ fontSize: 17, fontWeight: 700, color: D.ink, lineHeight: 1.6 }}>{r.title}</div>
                <p style={{ fontSize: 13.5, lineHeight: 1.95, color: D.body, margin: '8px 0 0' }}>{r.body}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 34 }}>
            <div className="st-label" style={{ color: D.gold, marginBottom: 12 }}>Stack</div>
            <div className="sp-pills">
              {STACK.map(s => <span key={s} className="sp-pill">{s}</span>)}
            </div>
            <p style={{ fontSize: 12.5, color: D.mute, margin: '12px 0 0', lineHeight: 1.9 }}>自社プロダクトと受託案件で、実際に運用している技術です。案件ごとに最適なものを選びます。</p>
          </div>
          <div style={{ marginTop: 40 }}>
            <div className="st-label" style={{ color: D.gold, marginBottom: 12 }}>Our products</div>
            <div className="st-serif" style={{ fontSize: 'clamp(19px, 2.2vw, 24px)', fontWeight: 700, color: D.ink, lineHeight: 1.6, marginBottom: 18 }}>
              自社で開発・運営している{CORE_PRODUCT_COUNT}つのプロダクト
            </div>
            <ProductsGrid />
          </div>
        </div>
      </section>

      {/* 開発実績 */}
      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Works" sub="いずれも公開中のシステムです。実物をご確認ください。">開発の実績</H2>
        <div className="sp-grid2">
          {apps.map(w => (
            <a key={w.id} className="st-card st-workcard" href={w.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="sp-shot" style={{ borderRadius: 0, border: 'none', borderBottom: `1px solid ${C.line}` }}>
                <img src={w.img} alt={`${w.name} の画面`} loading="lazy" decoding="async" />
              </div>
              <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="st-label" style={{ fontSize: 10 }}>{w.category}</div>
                <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{w.name}</div>
                <p style={{ fontSize: 13, lineHeight: 1.9, color: C.body, margin: 0 }}>{w.copy}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 4 }}>
                  実物を見る <IconArrow color={C.gold} />
                </span>
              </div>
            </a>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="st-btn st-btn-ghost" onClick={() => go('works')}>{WORKS.length}件の実績をすべて見る</button>
        </div>
      </Band>

      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <ClosingCta title="構想の段階から、ご相談ください。" body="要件が固まっていなくても構いません。何を作れば事業が前に進むかを、いっしょに整理するところから始めます。">
          <LineCta label="開発についてLINEで相談する" where="dev-bottom" />
          <div style={{ marginTop: 12 }}>
            <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
          </div>
          <Note>{CONTACT.lineNote}</Note>
        </ClosingCta>
      </Band>
    </div>
  );
}
