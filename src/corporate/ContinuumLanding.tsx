// ============================================================
// CORE Continuum — 特設LP (/continuum)
//
// 旗艦ブランドの世界観ページ。金×黒・派手に、しかし上品に。
// コピーは抽象を避け「何が消えて、何が残るか」を具体で言い切る：
//   H1『あなたが働かなくても、お店が回る。』
//   消える仕事(6つの雑務→引き受けるAI) / AIが働く一日 / 6つの力 / プラン。
// プランは continuumPlans.ts を /corp と共有（価格の二重管理を防ぐ）。
// ============================================================
import { useEffect } from 'react';
import { PrismLogo, IrisLogo, ResonanceLogo, LumeLogo, GuildLogo, CoreLogo, CrystalLogo } from '../components/Logo';
import { CONTINUUM_PLANS, CONTINUUM_CONTACT_EMAIL } from './continuumPlans';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const FONT_SERIF_EN = '"EB Garamond", "Cormorant Garamond", "Noto Serif JP", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';

const GOLD = '#C9A96E';
const GOLD_HI = '#E7C987';
const GOLD_PALE = '#F7EAD0';

// 環に乗る6サービス（角度は上から時計回り）。
const ORBIT: Array<{ key: string; deg: number; Logo: typeof PrismLogo }> = [
  { key: 'prism', deg: 0, Logo: PrismLogo },
  { key: 'resonance', deg: 60, Logo: ResonanceLogo },
  { key: 'crystal', deg: 120, Logo: CrystalLogo },
  { key: 'iris', deg: 180, Logo: IrisLogo },
  { key: 'guild', deg: 240, Logo: GuildLogo },
  { key: 'lume', deg: 300, Logo: LumeLogo },
];

// あなたの毎日から消える仕事（具体の雑務 → 引き受けるAI）。
const VANISH: Array<{ chore: string; detail: string; Logo: typeof PrismLogo; ai: string }> = [
  { chore: '届いたLINEへの返信', detail: '一人ひとりに合わせた返事をAIが下書き。あなたは読んで送るだけ', Logo: ResonanceLogo, ai: 'Resonance' },
  { chore: 'サイトの問い合わせ対応', detail: '夜中の質問にも、AIがその場で即答。取りこぼしゼロ', Logo: CrystalLogo, ai: 'Crystal' },
  { chore: '予約の受付と管理', detail: '希望日時を聞いて、カレンダー登録まで自動で', Logo: CrystalLogo, ai: 'Crystal・Resonance' },
  { chore: 'Instagramの投稿づくり', detail: '今日の企画・台本・案件の返事まで、選ぶだけの状態で用意', Logo: IrisLogo, ai: 'Iris' },
  { chore: '資料づくりと売上の集計', detail: '会議メモから資料へ。数字は自動で集計・報告', Logo: PrismLogo, ai: 'Prism' },
  { chore: 'チームへの共有・決めごと', detail: '提案と投票で、会議をしなくても決まっていく', Logo: GuildLogo, ai: 'Guild' },
];

// AIが働く1日 / あなたの1日。
const DAY: Array<{ time: string; ai: string; you: string }> = [
  { time: '7:00', ai: '夜間に届いたLINE・問い合わせに、すべて返信済み', you: '家族と、ゆっくり朝食を' },
  { time: '10:00', ai: '今日の投稿と案件の返事を用意。予約はカレンダーへ', you: '気になっていた本を開く' },
  { time: '14:00', ai: '資料と数字をまとめ、決めることだけを1つ提示', you: '5分で「決める」。それだけ' },
  { time: '19:00', ai: '営業時間外の接客も、AIが変わらぬ品で', you: '大切な人と、食事を' },
  { time: '23:00', ai: '今日AIが代行した仕事を、時間レポートに記録', you: 'あしたの楽しみを、ひとつ決める' },
];

const SIX: Array<{ Logo: typeof PrismLogo; name: string; role: string; hand: string }> = [
  { Logo: ResonanceLogo, name: 'Resonance', role: 'LINEの返信・日程調整', hand: '届いた1通ずつにAIが返信し、予約まで運ぶ。あなたは承認するだけ。' },
  { Logo: CrystalLogo, name: 'Crystal', role: 'サイトの接客・予約受付', hand: '24時間その場で即答するAIコンシェルジュ。問い合わせに追われない。' },
  { Logo: PrismLogo, name: 'Prism', role: '事務・資料・経営の数字', hand: '13名の役員AIが、社長のやりたくない仕事を片づける。' },
  { Logo: IrisLogo, name: 'Iris', role: 'Instagramの毎日', hand: '投稿の企画・台本・案件DMまで、専属マネージャーAIが用意。' },
  { Logo: GuildLogo, name: 'Guild', role: 'チームの意思決定', hand: '提案と投票で、会議をしなくても組織が動く。' },
  { Logo: LumeLogo, name: 'Lume', role: 'あなたの入口', hand: 'すべてのリンクと導線をひとつに。いちばん軽い名刺。' },
];

export default function ContinuumLanding() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'CORE Continuum — あなたが働かなくても、お店が回る。';
    const html = document.documentElement;
    const prevBg = html.style.background;
    html.style.background = '#050505';
    return () => { document.title = prevTitle; html.style.background = prevBg; };
  }, []);

  return (
    <div style={{ background: '#050505', color: GOLD_PALE, fontFamily: FONT_SANS, overflowX: 'hidden' }}>
      <style>{CSS}</style>

      {/* ───────── HERO ───────── */}
      <section style={{ position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 1.25rem 4.5rem', textAlign: 'center', overflow: 'hidden' }}>
        {/* 回る黄金のオーロラ（派手さの土台） */}
        <div aria-hidden className="ct-aurora" />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 50% at 50% 38%, rgba(201,169,110,0.18), transparent 70%), radial-gradient(120% 80% at 50% 110%, rgba(201,169,110,0.1), transparent 60%)` }} />
        {/* 金粒（多め） */}
        {[
          { l: '10%', t: '20%', d: '0s' }, { l: '86%', t: '16%', d: '1.2s' }, { l: '6%', t: '64%', d: '2.1s' },
          { l: '92%', t: '58%', d: '0.7s' }, { l: '20%', t: '84%', d: '1.7s' }, { l: '76%', t: '86%', d: '2.6s' },
          { l: '32%', t: '10%', d: '3.1s' }, { l: '64%', t: '8%', d: '0.4s' }, { l: '46%', t: '92%', d: '2.2s' },
          { l: '4%', t: '40%', d: '1.1s' }, { l: '95%', t: '38%', d: '2.9s' },
        ].map((p, i) => (
          <span key={i} aria-hidden className="ct-dust" style={{ left: p.l, top: p.t, animationDelay: p.d }} />
        ))}

        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(0.72rem, 1.6vw, 0.9rem)', letterSpacing: '0.5em', color: GOLD, textTransform: 'uppercase', marginBottom: '2rem', position: 'relative', paddingLeft: '0.5em' }}>
          CORE Continuum
        </p>

        {/* 黄金の環 — 6ロゴが CORE を巡る */}
        <div className="ct-orbit-wrap" aria-label="6つのAIエージェントがCOREを巡る">
          <div className="ct-beam" aria-hidden />
          <div className="ct-ring" aria-hidden />
          <div className="ct-ring ct-ring2" aria-hidden />
          <div className="ct-core">
            <CoreLogo size={54} withWordmark={false} />
          </div>
          <div className="ct-orbit">
            {ORBIT.map(o => (
              <div key={o.key} className="ct-sat" style={{ ['--deg' as never]: `${o.deg}deg` }}>
                <div className="ct-sat-inner">
                  <o.Logo size={30} withWordmark={false} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <h1 className="ct-shimmer" style={{ fontFamily: FONT_SERIF_JA, fontWeight: 700, fontSize: 'clamp(1.95rem, 6.6vw, 3.7rem)', lineHeight: 1.6, letterSpacing: '0.05em', margin: '2.5rem 0 1.3rem', position: 'relative' }}>
          あなたが働かなくても、
          <br />
          お店が回る。
        </h1>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.94rem, 2vw, 1.1rem)', lineHeight: 2.2, color: 'rgba(247,234,208,0.8)', maxWidth: 640, position: 'relative' }}>
          LINEの返信、問い合わせ対応、Instagram、予約の管理、資料と売上の数字。
          <br />
          その全部を、6つのAIエージェントが引き受けます。
          <br />
          あなたに残る仕事は、<strong style={{ color: GOLD_HI }}>「決めること」だけ</strong>。
        </p>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2.3rem', position: 'relative' }}>
          <a href="#plans" className="ct-cta-main">プランを見る</a>
          <a href="#vanish" className="ct-cta-ghost">何を任せられる？</a>
        </div>

        <div aria-hidden style={{ position: 'absolute', bottom: 'calc(18px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', color: 'rgba(231,201,135,0.55)', fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: '0.4em' }}>
          SCROLL
        </div>
      </section>

      <GoldLine />

      {/* ───────── 消える仕事 ───────── */}
      <section id="vanish" style={{ maxWidth: 1040, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem', scrollMarginTop: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
          <p className="ct-label">What Disappears</p>
          <h2 className="ct-h2">あなたの毎日から、この仕事が消えます。</h2>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.9rem, 1.5vw, 1rem)', lineHeight: 2.2, color: 'rgba(247,234,208,0.72)', maxWidth: 620, margin: '0 auto' }}>
            どれも「やらないと困るのに、やりたくない」仕事。ぜんぶ、担当のAIがいます。
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {VANISH.map(v => (
            <div key={v.chore} className="ct-six-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <p className="ct-strike" style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, color: GOLD_PALE, lineHeight: 1.7 }}>
                {v.chore}
              </p>
              <p style={{ fontFamily: FONT_SANS, fontSize: '0.8rem', lineHeight: 1.95, color: 'rgba(247,234,208,0.62)' }}>{v.detail}</p>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(201,169,110,0.18)' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.35)' }}>
                  <v.Logo size={18} withWordmark={false} />
                </span>
                <span style={{ fontFamily: FONT_SANS, fontSize: '0.74rem', fontWeight: 700, color: GOLD_HI }}>→ {v.ai} がやります</span>
              </p>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '2rem', fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.95rem, 1.8vw, 1.1rem)', color: GOLD_HI, lineHeight: 2 }}>
          しかも、AIは24時間365日、休まず・ムラなく働きます。
        </p>
      </section>

      <GoldLine />

      {/* ───────── A DAY ───────── */}
      <section style={{ maxWidth: 880, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.6rem' }}>
          <p className="ct-label">A Day with Continuum</p>
          <h2 className="ct-h2">導入後の、ある一日。</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {DAY.map((d, i) => (
            <div key={d.time} style={{ display: 'grid', gridTemplateColumns: '52px 1fr', gap: '1rem', position: 'relative', paddingBottom: i === DAY.length - 1 ? 0 : '1.9rem' }}>
              {i < DAY.length - 1 && <span aria-hidden style={{ position: 'absolute', left: 25, top: 30, bottom: 0, width: 1, background: 'linear-gradient(180deg, rgba(201,169,110,0.45), rgba(201,169,110,0.08))' }} />}
              <div style={{ width: 52, height: 30, display: 'grid', placeItems: 'center', borderRadius: 999, border: `1px solid rgba(201,169,110,0.45)`, fontFamily: FONT_SERIF_EN, fontSize: '0.78rem', color: GOLD_HI, background: '#0a0a0a', zIndex: 1 }}>{d.time}</div>
              <div>
                <p style={{ fontFamily: FONT_SANS, fontSize: '0.8rem', lineHeight: 1.9, color: 'rgba(247,234,208,0.55)' }}>
                  <span style={{ color: GOLD, fontWeight: 700, marginRight: 8 }}>AI</span>{d.ai}
                </p>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.98rem', lineHeight: 1.9, color: GOLD_PALE, marginTop: 5 }}>
                  <span style={{ fontFamily: FONT_SANS, fontSize: '0.68rem', letterSpacing: '0.14em', color: GOLD_HI, fontWeight: 700, marginRight: 8 }}>あなた</span>{d.you}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <GoldLine />

      {/* ───────── THE SIX ───────── */}
      <section id="six" style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem', scrollMarginTop: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
          <p className="ct-label">The Six</p>
          <h2 className="ct-h2">担当は、この6人。</h2>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.9rem, 1.5vw, 1rem)', lineHeight: 2.2, color: 'rgba(247,234,208,0.7)', maxWidth: 620, margin: '0 auto' }}>
            それぞれ単体でも売られているAIサービスです。Continuum では6つがつながり、
            お客様の情報も、あなたの話し方も、自動で引き継がれます。
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          {SIX.map(s => (
            <div key={s.name} className="ct-six-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', flexShrink: 0, background: 'radial-gradient(circle at 50% 30%, rgba(201,169,110,0.16), rgba(0,0,0,0.4))', border: `1px solid rgba(201,169,110,0.4)` }}>
                  <s.Logo size={28} withWordmark={false} />
                </span>
                <span>
                  <span style={{ display: 'block', fontFamily: FONT_SERIF_EN, fontSize: '1.2rem', letterSpacing: '0.06em', color: GOLD_PALE }}>{s.name}</span>
                  <span style={{ display: 'block', fontFamily: FONT_SANS, fontSize: '0.68rem', letterSpacing: '0.08em', color: GOLD, marginTop: 2 }}>{s.role}</span>
                </span>
              </div>
              <p style={{ fontFamily: FONT_SANS, fontSize: '0.8rem', lineHeight: 1.95, color: 'rgba(247,234,208,0.62)', marginTop: '0.85rem' }}>{s.hand}</p>
            </div>
          ))}
        </div>
      </section>

      <GoldLine />

      {/* ───────── PLANS ───────── */}
      <section id="plans" style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem', scrollMarginTop: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
          <p className="ct-label">Plans</p>
          <h2 className="ct-h2">人を雇うより、ずっと軽く。</h2>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.9rem, 1.5vw, 1rem)', lineHeight: 2.2, color: 'rgba(247,234,208,0.72)', maxWidth: 620, margin: '0 auto' }}>
            正社員をひとり雇えば、月30万円から。Continuum なら、その一部の金額で
            6人分のAIチームが、今日から休まず働きます。
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.1rem', alignItems: 'stretch' }}>
          {CONTINUUM_PLANS.map(pl => (
            <div key={pl.name} className={pl.featured ? 'ct-plan-featured' : undefined} style={{
              display: 'flex', flexDirection: 'column', gap: '0.9rem', position: 'relative',
              borderRadius: 20, padding: pl.featured ? '2.1rem 1.7rem' : '1.8rem 1.6rem',
              background: pl.featured ? 'linear-gradient(165deg, rgba(201,169,110,0.16), rgba(201,169,110,0.03))' : 'rgba(255,255,255,0.03)',
              border: pl.featured ? `1px solid rgba(201,169,110,0.65)` : '1px solid rgba(255,255,255,0.1)',
            }}>
              {pl.featured && (
                <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontFamily: FONT_SANS, fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.16em', color: '#141414', background: `linear-gradient(90deg,${GOLD_HI},${GOLD})`, borderRadius: 999, padding: '5px 14px' }}>
                  いちばん選ばれています
                </span>
              )}
              <div>
                <p style={{ fontFamily: FONT_SERIF_EN, fontSize: '1.2rem', letterSpacing: '0.1em', color: '#F1E6CE' }}>{pl.name}</p>
                <p style={{ fontFamily: FONT_SANS, fontSize: '0.76rem', color: 'rgba(255,255,255,0.5)', marginTop: 4, lineHeight: 1.8 }}>{pl.tag}</p>
              </div>
              <p style={{ fontFamily: FONT_SANS, fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ fontSize: '1.9rem', fontWeight: 800, color: pl.featured ? GOLD_HI : '#F4F7FC' }}>{pl.price}</span>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>/ 月（税込）</span>
                {pl.setup && <span style={{ display: 'block', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>＋ 初期構築 {pl.setup}（一度だけ）</span>}
              </p>
              {pl.compare && <p style={{ fontFamily: FONT_SANS, fontSize: '0.72rem', color: '#9BC4A0', lineHeight: 1.8 }}>{pl.compare}</p>}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {pl.features.map(f => (
                  <li key={f} style={{ fontFamily: FONT_SANS, fontSize: '0.8rem', color: 'rgba(255,255,255,0.74)', lineHeight: 1.8, paddingLeft: '1.15rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 1, color: GOLD }}>◆</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={pl.stripeUrl || `mailto:${CONTINUUM_CONTACT_EMAIL}?subject=${encodeURIComponent(`【CORE Continuum】${pl.name} のご相談`)}`}
                target={pl.stripeUrl ? '_blank' : undefined}
                rel={pl.stripeUrl ? 'noopener' : undefined}
                style={{
                  marginTop: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 50, borderRadius: 999, textDecoration: 'none',
                  fontFamily: FONT_SANS, fontSize: '0.88rem', fontWeight: 800, letterSpacing: '0.04em',
                  background: pl.featured ? `linear-gradient(90deg,${GOLD_HI},${GOLD})` : 'rgba(255,255,255,0.08)',
                  color: pl.featured ? '#141414' : '#F4F7FC',
                  border: pl.featured ? 'none' : '1px solid rgba(255,255,255,0.2)',
                }}
              >
                {pl.stripeUrl ? 'このプランで始める' : 'このプランを相談する'}
              </a>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', marginTop: '1.8rem', fontFamily: FONT_SANS, fontSize: '0.74rem', color: 'rgba(255,255,255,0.42)', lineHeight: 2 }}>
          6つを単品でそろえると 月 約¥109,000。いつでも解約できます。
          <br />
          決済ページ公開までは、ボタンからそのままご相談ください（1営業日以内にお返事します）。
        </p>
      </section>

      {/* ───────── FINAL ───────── */}
      <section style={{ position: 'relative', textAlign: 'center', padding: 'clamp(5rem, 10vw, 8rem) 1.5rem calc(6rem + env(safe-area-inset-bottom))', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 60% at 50% 100%, rgba(201,169,110,0.16), transparent 70%)` }} />
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.44em', color: GOLD, textTransform: 'uppercase', marginBottom: '1.4rem', position: 'relative' }}>
          Your Time, Back
        </p>
        <h2 className="ct-shimmer" style={{ fontFamily: FONT_SERIF_JA, fontWeight: 700, fontSize: 'clamp(1.55rem, 4.8vw, 2.7rem)', lineHeight: 1.8, letterSpacing: '0.05em', position: 'relative' }}>
          さて、空いた時間で
          <br />
          なにをしましょうか。
        </h2>
        <div style={{ marginTop: '2.2rem', position: 'relative' }}>
          <a href="#plans" className="ct-cta-main">プランを選ぶ</a>
        </div>
        <p style={{ marginTop: '3.5rem', position: 'relative' }}>
          <a href="/corp" style={{ fontFamily: FONT_SANS, fontSize: '0.76rem', color: 'rgba(247,234,208,0.5)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px' }}>
            ← CORE 会社ページへもどる
          </a>
        </p>
      </section>
    </div>
  );
}

function GoldLine() {
  return <div aria-hidden style={{ height: 1, maxWidth: 1080, margin: '0 auto', background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.4), transparent)' }} />;
}

const CSS = `
  /* ── 回る黄金のオーロラ（ヒーロー背景・派手さの土台）── */
  .ct-aurora { position: absolute; left: 50%; top: 34%; width: 170vmax; height: 170vmax; transform: translate(-50%, -50%);
    background: conic-gradient(from 0deg, transparent 0deg, rgba(201,169,110,0.10) 40deg, transparent 90deg, rgba(231,201,135,0.07) 160deg, transparent 210deg, rgba(201,169,110,0.09) 300deg, transparent 360deg);
    animation: ctAurora 36s linear infinite; pointer-events: none; }
  @keyframes ctAurora { to { transform: translate(-50%, -50%) rotate(360deg); } }

  /* ── 黄金の環（6ロゴが CORE を巡る）── */
  .ct-orbit-wrap { position: relative; width: min(76vw, 340px); height: min(76vw, 340px); }
  .ct-beam { position: absolute; inset: -14%; border-radius: 50%;
    background: conic-gradient(from 0deg, transparent 0deg, rgba(231,201,135,0.22) 24deg, transparent 60deg);
    animation: ctSpin 9s linear infinite; filter: blur(6px); }
  .ct-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(201,169,110,0.4); box-shadow: 0 0 70px rgba(201,169,110,0.16), inset 0 0 44px rgba(201,169,110,0.07); animation: ctRingPulse 5.5s ease-in-out infinite; }
  .ct-ring2 { inset: 12%; border-color: rgba(201,169,110,0.18); box-shadow: none; animation: none; }
  .ct-core { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 32%, rgba(201,169,110,0.24), rgba(5,5,5,0.9)); border: 1px solid rgba(201,169,110,0.6); box-shadow: 0 0 48px rgba(201,169,110,0.34); animation: ctCoreBreath 4.5s ease-in-out infinite; z-index: 2; }
  .ct-orbit { position: absolute; inset: 0; animation: ctSpin 46s linear infinite; }
  .ct-sat { position: absolute; left: 50%; top: 50%; transform: rotate(var(--deg)) translateY(calc(min(38vw, 170px) * -1)) rotate(calc(var(--deg) * -1)); }
  .ct-sat-inner { width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 30%, rgba(201,169,110,0.16), rgba(8,8,8,0.92)); border: 1px solid rgba(201,169,110,0.46); box-shadow: 0 6px 22px rgba(0,0,0,0.55), 0 0 20px rgba(201,169,110,0.18); animation: ctSpinRev 46s linear infinite; }
  @keyframes ctSpin { to { transform: rotate(360deg); } }
  @keyframes ctSpinRev { to { transform: rotate(-360deg); } }
  @keyframes ctCoreBreath { 0%,100% { box-shadow: 0 0 48px rgba(201,169,110,0.34); } 50% { box-shadow: 0 0 84px rgba(201,169,110,0.56); } }
  @keyframes ctRingPulse { 0%,100% { box-shadow: 0 0 70px rgba(201,169,110,0.16), inset 0 0 44px rgba(201,169,110,0.07); } 50% { box-shadow: 0 0 100px rgba(201,169,110,0.28), inset 0 0 60px rgba(201,169,110,0.12); } }

  /* 金粒 */
  .ct-dust { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: rgba(231,201,135,0.85); box-shadow: 0 0 9px rgba(231,201,135,0.95); animation: ctFloat 6s ease-in-out infinite; }
  @keyframes ctFloat { 0%,100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-16px); } }

  /* きらめく金文字（H1/決めの見出し） */
  .ct-shimmer { background: linear-gradient(110deg, ${GOLD_PALE} 20%, ${GOLD} 40%, #FFF3D6 50%, ${GOLD} 60%, ${GOLD_PALE} 80%); background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: ctShimmer 5.5s ease-in-out infinite; }
  @keyframes ctShimmer { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

  /* 見出し・ラベル */
  .ct-label { font-family: ${FONT_DISPLAY.replace(/"/g, "'")}; font-size: 0.68rem; letter-spacing: 0.42em; color: ${GOLD}; text-transform: uppercase; margin-bottom: 1.1rem; }
  .ct-h2 { font-family: 'Noto Serif JP','游明朝','Yu Mincho',serif; font-weight: 700; font-size: clamp(1.5rem, 3.8vw, 2.4rem); line-height: 1.7; letter-spacing: 0.05em; margin-bottom: 1.2rem; background: linear-gradient(120deg, ${GOLD_PALE}, ${GOLD}); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

  /* 「消える仕事」の打ち消し線（金の線がすっと入る） */
  .ct-strike { position: relative; display: inline-block; }
  .ct-strike::after { content: ''; position: absolute; left: -2%; right: -2%; top: 54%; height: 2px; border-radius: 2px;
    background: linear-gradient(90deg, transparent, ${GOLD_HI}, ${GOLD}); transform-origin: left center; animation: ctStrike 1.1s ease-out 0.6s both; }
  @keyframes ctStrike { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 0.85; } }

  /* CTA */
  .ct-cta-main { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 34px; border-radius: 999px; text-decoration: none; font-family: ${FONT_SANS.replace(/"/g, "'")}; font-size: 0.92rem; font-weight: 800; letter-spacing: 0.05em; color: #141414; background: linear-gradient(90deg, ${GOLD_HI}, ${GOLD}); box-shadow: 0 14px 44px -12px rgba(201,169,110,0.75); animation: ctCtaGlow 3.4s ease-in-out infinite; }
  @keyframes ctCtaGlow { 0%,100% { box-shadow: 0 14px 44px -12px rgba(201,169,110,0.75); } 50% { box-shadow: 0 14px 58px -8px rgba(231,201,135,0.95); } }
  .ct-cta-ghost { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 26px; border-radius: 999px; text-decoration: none; font-family: ${FONT_SANS.replace(/"/g, "'")}; font-size: 0.88rem; font-weight: 700; letter-spacing: 0.04em; color: ${GOLD_PALE}; border: 1px solid rgba(201,169,110,0.5); background: rgba(201,169,110,0.06); }

  .ct-six-card { padding: 1.4rem 1.3rem; border-radius: 18px; border: 1px solid rgba(201,169,110,0.26); background: linear-gradient(170deg, rgba(201,169,110,0.06), rgba(255,255,255,0.01)); transition: border-color 0.3s ease, transform 0.3s ease; }
  .ct-six-card:hover { border-color: rgba(201,169,110,0.6); transform: translateY(-2px); }

  /* 推奨プランの光る枠 */
  .ct-plan-featured { box-shadow: 0 34px 80px -36px rgba(201,169,110,0.55); animation: ctPlanGlow 4.2s ease-in-out infinite; }
  @keyframes ctPlanGlow { 0%,100% { box-shadow: 0 34px 80px -36px rgba(201,169,110,0.55); } 50% { box-shadow: 0 34px 96px -30px rgba(231,201,135,0.8); } }

  @media (prefers-reduced-motion: reduce) {
    .ct-orbit, .ct-sat-inner, .ct-core, .ct-dust, .ct-aurora, .ct-beam, .ct-shimmer, .ct-cta-main, .ct-plan-featured, .ct-ring { animation: none !important; }
    .ct-strike::after { animation: none !important; transform: scaleX(1); opacity: 0.85; }
  }
`;
