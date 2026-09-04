// ============================================================
// CORE Studio — サイト制作 (/studio/plans) 2026-09-04 全面刷新
// 旧: チップで1プランずつ切り替えて 760px のカード1枚を出す構成。
//     4つを見比べられず、実物が1枚も無く、制作会社のページに見えなかった。
// 新: 公開中のサイト4件を3Dに重ねたヒーロー → 4プランを横に並べた価格の段
//     (各段に規模の近い実例) → 迷ったら → 工程の時間軸 → FAQ → 相談。
// 文言・価格は plans.ts が正本。ここにはレイアウトだけを書く。
// ============================================================
import { PRODUCTION_PLANS, PROCESS, WORKS, CONTACT, thumbOf, type ProductionPlan, type Work } from './plans';
import { C } from './theme';
import { Band, H2, Note, IconCheck, IconArrow, LineCta } from './ui';
import { PageStyle, PageHero, Faq, ClosingCta } from './PageHero';
import type { Go } from './tabs';

// プランごとに「規模の近い実例」を1件添える (価格の実績ではなく、規模感の目安として見せる)。
// ここに無い id を書いても落ちない (見つからなければ実例枠を出さない)。
const EXAMPLE_OF: Record<ProductionPlan['id'], string> = {
  spark: 'tengoku',       // 1ページ完結のブランドサイト
  core: 'crossover',      // 7ページ構成のコーポレートサイト
  pro: 'asahikan',        // 直販予約を備えた旅館サイト
  signature: 'radhookah', // ブランドの世界観ごと作ったEC
};
const workOf = (id: string): Work | undefined => WORKS.find(w => w.id === id);

// 「迷ったら」— 各プランの lead から、判断の入口になる1行を出す
const CHOOSE: Array<{ id: ProductionPlan['id']; when: string }> = [
  { id: 'spark', when: 'まず1ページを、最短で公開したい' },
  { id: 'core', when: '古くなった会社の顔を、作り直したい' },
  { id: 'pro', when: '予約・決済を自社サイトに移し、手数料を減らしたい' },
  { id: 'signature', when: 'ブランドからデジタル全体を、ひとつの世界観で統合したい' },
];

export default function PlansPage({ go }: { go: Go }) {
  const deck = (['tengoku', 'crossover', 'asahikan', 'radhookah'] as const).flatMap(id => { const w = workOf(id); return w ? [w] : []; });
  const faqs = PRODUCTION_PLANS.flatMap(p => p.faq.map(f => ({ ...f, tag: p.name })));
  const jump = (id: ProductionPlan['id']) => document.getElementById(`plan-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div>
      <PageStyle />
      <PageHero
        en="Website"
        size="compact"
        title={<>事業の顔を、<br />成果から逆算してつくる。</>}
        lead="1ページのLPから、予約・決済を備えた企業サイトまで。原稿と写真がなくても始められます。金額はご契約時に確定し、以後の追加費用はいただきません。"
        amb={deck[0]?.img}
        facts={[
          { v: String(PRODUCTION_PLANS.length), l: 'つのプラン' },
          { v: PRODUCTION_PLANS[0].duration.replace(/週間$/, '週間〜'), l: '最短公開' },
          { v: '¥0', l: 'ご契約後の追加費用' },
          { v: `${WORKS.length}件`, l: '公開中の実績' },
        ]}
        cta={<><LineCta where="plans-hero" /><button className="st-btn st-btn-dark" onClick={() => go('contact')}>6つの質問で概算を出す</button></>}
        note={CONTACT.lineNote}
        visual={
          <div className="sp-deck" aria-label="公開中のサイト">
            {deck.map(w => (
              <a key={w.id} className="sp-deck-card" href={w.url} target="_blank" rel="noopener noreferrer" aria-label={`${w.name} のサイトを見る`}>
                <img src={thumbOf(w)} alt="" width={480} height={300} decoding="async" />
                <span className="sp-deck-cap">{w.name}</span>
              </a>
            ))}
          </div>
        }
      />

      {/* 4プランの価格の段 */}
      <Band wide pad="clamp(56px, 6vw, 88px) 0">
        <H2 en="Plans" sub="規模と目的で4段に分けています。いずれも、構成設計・原稿・デザイン・実装・公開作業までを含みます。">4つのプラン</H2>
        <div className="sp-ladder">
          {PRODUCTION_PLANS.map(p => {
            const ex = workOf(EXAMPLE_OF[p.id]);
            return (
              <div key={p.id} id={`plan-${p.id}`} className="sp-col" data-featured={!!p.featured}>
                {p.featured && <span className="sp-col-tag">RECOMMENDED</span>}
                <div className="sp-col-name">{p.name}</div>
                <div className="sp-col-price">{p.price}</div>
                <div className="sp-col-lead">{p.lead}</div>
                <p className="sp-col-scope">{p.scope}</p>
                <div className="sp-col-meta"><span>納期 {p.duration}</span><span>{p.pages}</span></div>
                <div className="sp-col-sub">含まれるもの</div>
                <ul className="sp-list">
                  {p.includes.map(i => <li key={i}><IconCheck />{i}</li>)}
                </ul>
                <div className="sp-best"><b>こんな貴社に — </b>{p.bestFor}</div>
                {ex && (
                  <a className="sp-ex" href={ex.url} target="_blank" rel="noopener noreferrer">
                    <span className="sp-ex-shot"><img src={thumbOf(ex)} alt={`${ex.name} のトップページ`} loading="lazy" decoding="async" /></span>
                    <span className="sp-ex-cap"><span>規模の近い実例 — {ex.name}</span><IconArrow color={C.gold} /></span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <LineCta label="プランについてLINEで相談する" where="plans" />
          <Note>{CONTACT.lineNote}</Note>
        </div>
      </Band>

      {/* 迷ったら */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Which plan" sub="いちばん近いものを押すと、そのプランへ移動します。判断がつかない場合は、そのままご相談ください。">迷ったら、この4つから。</H2>
        <div className="sp-choose">
          {CHOOSE.map(c => {
            const p = PRODUCTION_PLANS.find(x => x.id === c.id);
            if (!p) return null;
            return (
              <button key={c.id} type="button" className="sp-choose-row" onClick={() => jump(c.id)}>
                <span>{c.when}</span>
                <b>{p.name}</b>
                <IconArrow color={C.gold} />
              </button>
            );
          })}
        </div>
      </Band>

      {/* 工程 */}
      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Process" sub="お見積り時に金額を確定し、以後の追加費用はいただきません。各工程の進捗は随時ご報告します。">ご契約から公開まで、6つの工程</H2>
        <ol className="sp-tl">
          {PROCESS.map(s => (
            <li key={s.no}>
              <span className="sp-tl-no">{s.no}</span>
              <div><b>{s.title}</b><p>{s.body}</p></div>
            </li>
          ))}
        </ol>
      </Band>

      {/* FAQ (各プランの Q&A を1か所に) */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <H2 en="FAQ" sub="プランごとに多くいただくご質問です。ここに無いことも、そのままお尋ねください。">サイト制作でよくあるご質問</H2>
          <Faq items={faqs} />
        </div>
      </Band>

      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <ClosingCta title="まずは、いまのサイトと目標をお聞かせください。" body="ヒアリングをもとに構成とプランをご提案します。原稿も写真も、お手元に無い状態から始められます。">
          <LineCta where="plans-bottom" />
          <div style={{ marginTop: 12 }}>
            <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
          </div>
          <Note>{CONTACT.lineNote}</Note>
        </ClosingCta>
      </Band>
    </div>
  );
}
