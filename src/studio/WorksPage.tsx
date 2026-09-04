// ============================================================
// CORE Studio — 実績 (/studio/works) 2026-09-04 全面刷新
// 旧: 白760pxの1段組。映像は先頭に1件+帯、Webは st-workcard の格子。
// 新: 他5ページ (plans/dev/care/about/contact) と同じ暗部ヒーロー+1160px
//     編集レイアウトに揃える。映像実績の見せ方は据え置き (flagship+帯)、
//     Web実績は plans ページの「規模の近い実例」と同じ sp-ex カードで統一する。
// 文言・数字は plans.ts / works.ts が正本。ここにはレイアウトだけを書く。
// ============================================================
import { WORKS, CONTACT, thumbOf, type Work } from './plans';
import { FILM_WORKS } from './works';
import { C, D } from './theme';
import { Band, H2, LineCta, IconArrow } from './ui';
import { PageStyle, PageHero, ClosingCta } from './PageHero';
import { track } from './track';
import type { Go } from './tabs';

const CATS = ['企業サイト', 'EC・ブランド', 'アプリ', '個人'] as const;

// ヒーローの3D束。plansページの束 (tengoku/crossover/asahikan/radhookah) と
// あえて重ならない4件を選び、企業・EC・アプリを横断させる。
const DECK_IDS = ['crossover', 'radhookah', 'anima', 'soma'] as const;
const workOf = (id: string): Work | undefined => WORKS.find(w => w.id === id);

export default function WorksPage({ go }: { go: Go }) {
  const deck = DECK_IDS.flatMap(id => { const w = workOf(id); return w ? [w] : []; });

  return (
    <div>
      <PageStyle />
      <PageHero
        en="Works"
        size="compact"
        title={<>言葉より先に、<br />実物を。</>}
        lead="映像制作・ウェブ制作・受託開発。いずれも当社が実際に手がけ、公開・納品したものだけを載せています。"
        amb={deck[0]?.img}
        facts={[
          { v: String(WORKS.length + FILM_WORKS.length), l: '件の公開・納品実績' },
          { v: `${WORKS.length}件`, l: 'Web実績' },
          { v: `${FILM_WORKS.length}件`, l: '映像実績' },
          { v: String(CATS.length), l: '種のカテゴリ' },
        ]}
        cta={<><LineCta where="works-hero" /><button className="st-btn st-btn-dark" onClick={() => go('contact')}>6つの質問で概算を出す</button></>}
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

      {/* 映像の実績 — ヒーローの黒地をそのまま続ける */}
      <FilmWorksBand go={go} />

      {/* Webの実績 — plansページの「規模の近い実例」と同じ sp-ex カードで統一 */}
      <Band wide pad="clamp(56px, 6vw, 88px) 0">
        <H2 en="Web" sub="いずれも公開中のサイト・システムです。実物をご確認ください。">サイト・システムの実績</H2>
        {CATS.map(cat => {
          const list = WORKS.filter(w => w.category === cat);
          if (!list.length) return null;
          return (
            <div key={cat} style={{ marginBottom: 28 }}>
              <div className="st-label" style={{ fontSize: 11, marginBottom: 12 }}>{cat}</div>
              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))' }}>
                {list.map(w => (
                  <a key={w.id} className="sp-ex" href={w.url} target="_blank" rel="noopener noreferrer">
                    <span className="sp-ex-shot"><img src={thumbOf(w)} alt={`${w.name} のトップページ`} loading="lazy" decoding="async" /></span>
                    <span className="sp-ex-cap"><span>{w.name}</span><IconArrow color={C.gold} /></span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <LineCta where="works" />
        </div>
      </Band>

      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <ClosingCta title="貴社の案件も、この一覧に加わります。" body="まずは実物と近い規模感をお聞かせください。ヒアリングをもとに構成とプランをご提案します。">
          <LineCta where="works-bottom" />
          <div style={{ marginTop: 12 }}>
            <button className="st-btn st-btn-ghost" onClick={() => go('contact')}>先に概算を知る</button>
          </div>
        </ClosingCta>
      </Band>
    </div>
  );
}

// ---- 映像制作の実績 (旧 StudioSite.tsx の FilmWorksBand を移設) ----
function FilmWorksBand({ go }: { go: Go }) {
  const [lead, ...rest] = FILM_WORKS;
  if (!lead) return null;
  const openFilm = () => { track('studio_works_to_film', { from: 'works-page' }); go('film'); };

  return (
    <Band dark wide pad="46px 0 40px">
      <H2 dark en="Film" sub="商品広告・ブランドムービー・ショートドラマまで。すべて当社が制作し、実際に納品した映像です。">映像制作の実績</H2>
      <div className="st-fw">
        <button type="button" className="st-fw-shot" onClick={openFilm}
          aria-label={`${lead.client} の制作事例を映像制作のページで見る`}>
          {lead.poster && <img src={lead.poster} alt={`${lead.client} の制作事例`} loading="lazy" />}
        </button>
        <div className="st-fw-info">
          <span className="st-label" style={{ color: D.gold, fontSize: 10.5 }}>{lead.category}</span>
          <h3 className="st-serif" style={{ fontSize: 'clamp(20px, 5vw, 27px)', fontWeight: 700, color: D.ink, lineHeight: 1.5, margin: '11px 0 0' }}>{lead.client}</h3>
          <p style={{ fontSize: 13.5, lineHeight: 2.05, color: D.body, margin: '12px 0 18px', maxWidth: 460 }}>{lead.purpose}</p>
          <button className="st-btn" onClick={openFilm}
            style={{ background: D.gold, color: '#17130A', border: `1px solid ${D.gold}`, fontWeight: 700 }}>
            映像を再生して見る
          </button>
        </div>
      </div>
      {rest.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <div className="st-fw-row">
            {rest.map(w => (
              <button key={w.id} type="button" className="st-fw-item" onClick={openFilm}
                aria-label={`${w.client} の制作事例を映像制作のページで見る`}>
                <span className="st-fw-thumb">{w.poster && <img src={w.poster} alt="" loading="lazy" />}</span>
                <span className="st-fw-name">{w.client}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Band>
  );
}
