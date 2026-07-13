// ============================================================
// CORE Continuum — 特設LP (/continuum)
//
// 旗艦ブランドの世界観ページ。金×黒。
// 「仕事は、AIの仕事に。あなたは、人生に。」— 6つのAIエージェントを統合し、
// 仕事時間をほぼゼロへ。戻った時間で人生（人間関係・趣味・家族）を豊かに。
//
// ヒーローは6サービスのロゴが黄金の環となって CORE を巡る（純CSS・reduced-motion対応）。
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
const ORBIT: Array<{ key: string; deg: number; Logo: typeof PrismLogo; name: string }> = [
  { key: 'prism', deg: 0, Logo: PrismLogo, name: 'Prism' },
  { key: 'resonance', deg: 60, Logo: ResonanceLogo, name: 'Resonance' },
  { key: 'crystal', deg: 120, Logo: CrystalLogo, name: 'Crystal' },
  { key: 'iris', deg: 180, Logo: IrisLogo, name: 'Iris' },
  { key: 'guild', deg: 240, Logo: GuildLogo, name: 'Guild' },
  { key: 'lume', deg: 300, Logo: LumeLogo, name: 'Lume' },
];

// 6サービスの「何を任せられるか」— 統合の星座。
const SIX: Array<{ Logo: typeof PrismLogo; name: string; role: string; hand: string }> = [
  { Logo: ResonanceLogo, name: 'Resonance', role: 'LINEの返信・日程調整', hand: '届いた1通ずつにAIが返信し、予約まで運ぶ。あなたは承認するだけ。' },
  { Logo: CrystalLogo, name: 'Crystal', role: 'サイトの接客・予約受付', hand: '24時間その場で即答するAIコンシェルジュ。問い合わせに追われない。' },
  { Logo: PrismLogo, name: 'Prism', role: '事務・資料・経営の数字', hand: '13名の役員AIが、社長のやりたくない仕事を片づける。' },
  { Logo: IrisLogo, name: 'Iris', role: 'Instagramの毎日', hand: '投稿の企画・台本・案件DMまで、専属マネージャーAIが用意。' },
  { Logo: GuildLogo, name: 'Guild', role: 'チームの意思決定', hand: '提案と投票で、会議をしなくても組織が動く。' },
  { Logo: LumeLogo, name: 'Lume', role: 'あなたの入口', hand: 'すべてのリンクと導線をひとつに。いちばん軽い名刺。' },
];

// AIが働く1日 / あなたの1日 — 世界観を1本のタイムラインで。
const DAY: Array<{ time: string; ai: string; you: string }> = [
  { time: '7:00', ai: '夜間に届いたLINE・問い合わせに、すべて返信済み', you: '家族と、ゆっくり朝食を' },
  { time: '10:00', ai: '今日の投稿と案件の返事を用意。予約はカレンダーへ', you: '気になっていた本を開く' },
  { time: '14:00', ai: '資料と数字をまとめ、決めることだけを1つ提示', you: '5分で「決める」。それだけ' },
  { time: '19:00', ai: '営業時間外の接客も、AIが変わらぬ品で', you: '大切な人と、食事を' },
  { time: '23:00', ai: '今日AIが代行した仕事を、時間レポートに記録', you: 'あしたの人生を、少し設計する' },
];

export default function ContinuumLanding() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'CORE Continuum — 仕事は、AIの仕事に。あなたは、人生に。';
    const html = document.documentElement;
    const prevBg = html.style.background;
    html.style.background = '#050505';
    return () => { document.title = prevTitle; html.style.background = prevBg; };
  }, []);

  return (
    <div style={{ background: '#050505', color: GOLD_PALE, fontFamily: FONT_SANS, overflowX: 'hidden' }}>
      <style>{CSS}</style>

      {/* ───────── HERO ───────── */}
      <section style={{ position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5.5rem 1.25rem 4.5rem', textAlign: 'center', overflow: 'hidden' }}>
        {/* 黄金のオーラ */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(70% 50% at 50% 38%, rgba(201,169,110,0.16), transparent 70%), radial-gradient(120% 80% at 50% 110%, rgba(201,169,110,0.08), transparent 60%)` }} />
        {/* 微細な金粒 */}
        {[
          { l: '12%', t: '22%', d: '0s' }, { l: '84%', t: '18%', d: '1.2s' }, { l: '8%', t: '68%', d: '2.1s' },
          { l: '90%', t: '62%', d: '0.7s' }, { l: '22%', t: '86%', d: '1.7s' }, { l: '74%', t: '84%', d: '2.6s' },
        ].map((p, i) => (
          <span key={i} aria-hidden className="ct-dust" style={{ left: p.l, top: p.t, animationDelay: p.d }} />
        ))}

        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(0.72rem, 1.6vw, 0.9rem)', letterSpacing: '0.5em', color: GOLD, textTransform: 'uppercase', marginBottom: '2.2rem', position: 'relative', paddingLeft: '0.5em' }}>
          CORE Continuum
        </p>

        {/* 黄金の環 — 6ロゴが CORE を巡る */}
        <div className="ct-orbit-wrap" aria-label="6つのAIエージェントがCOREを巡る">
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

        <h1 style={{ fontFamily: FONT_SERIF_JA, fontWeight: 700, fontSize: 'clamp(1.9rem, 6.4vw, 3.6rem)', lineHeight: 1.6, letterSpacing: '0.06em', margin: '2.6rem 0 1.4rem', background: `linear-gradient(120deg, ${GOLD_PALE}, ${GOLD})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', position: 'relative' }}>
          仕事は、AIの仕事に。
          <br />
          あなたは、人生に。
        </h1>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.92rem, 2vw, 1.08rem)', lineHeight: 2.2, color: 'rgba(247,234,208,0.75)', maxWidth: 620, position: 'relative' }}>
          六つのAIエージェントを、ひとつの意思に統合。
          返信も、集客も、接客も、予約も、経営の数字も —— すべてが全自動で回りはじめ、
          あなたの仕事時間は、ほぼゼロへ。
        </p>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '2.4rem', position: 'relative' }}>
          <a href="#plans" className="ct-cta-main">プランを見る</a>
          <a href="#six" className="ct-cta-ghost">統合される6つの力</a>
        </div>

        <div aria-hidden style={{ position: 'absolute', bottom: 'calc(18px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', color: 'rgba(231,201,135,0.55)', fontFamily: FONT_DISPLAY, fontSize: 10, letterSpacing: '0.4em' }}>
          SCROLL
        </div>
      </section>

      <GoldLine />

      {/* ───────── PHILOSOPHY ───────── */}
      <section style={{ maxWidth: 880, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem', textAlign: 'center' }}>
        <p className="ct-label">Philosophy</p>
        <h2 className="ct-h2">時間は、いちばん高価な資産。</h2>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.92rem, 1.6vw, 1.05rem)', lineHeight: 2.3, color: 'rgba(247,234,208,0.72)', maxWidth: 640, margin: '0 auto' }}>
          売上のためでも、効率のためでもなく。
          人間関係を育て、趣味に没頭し、家族と過ごし、人生の計画を立て直すために ——
          私たちは、あなたの仕事をAIの仕事にします。
          Continuum（連続体）という名は、事業のすべてが途切れなくAIでつながり、
          あなたの人生が途切れなく、あなたのものになることを指しています。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '3rem' }}>
          {[
            { n: '6', u: 'つのAI', d: '返信・接客・集客・予約・数字・組織。事業の全面をエージェントが覆う' },
            { n: 'ほぼ0', u: '時間', d: 'あなたが仕事に使う時間。決めることだけが、あなたに残る' },
            { n: '24', u: '時間365日', d: 'あなたが眠っている間も、AIは同じ品で働き続ける' },
          ].map(s => (
            <div key={s.d} style={{ padding: '1.6rem 1.2rem', borderRadius: 18, border: `1px solid rgba(201,169,110,0.28)`, background: 'rgba(201,169,110,0.04)' }}>
              <p style={{ fontFamily: FONT_SERIF_EN, fontSize: '2.4rem', color: GOLD_HI, lineHeight: 1 }}>
                {s.n}<span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', marginLeft: 4, color: GOLD }}>{s.u}</span>
              </p>
              <p style={{ fontFamily: FONT_SANS, fontSize: '0.78rem', lineHeight: 1.9, color: 'rgba(247,234,208,0.62)', marginTop: '0.7rem' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <GoldLine />

      {/* ───────── THE SIX ───────── */}
      <section id="six" style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem', scrollMarginTop: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
          <p className="ct-label">The Six</p>
          <h2 className="ct-h2">六つの力が、ひとつの意思に。</h2>
          <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.9rem, 1.5vw, 1rem)', lineHeight: 2.2, color: 'rgba(247,234,208,0.7)', maxWidth: 620, margin: '0 auto' }}>
            それぞれが単体でも一流のAIエージェント。Continuum では六つがひとつのCOREでつながり、
            お客様も、データも、あなたの人格も、途切れなく流れます。
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

      {/* ───────── A DAY ───────── */}
      <section style={{ maxWidth: 880, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.6rem' }}>
          <p className="ct-label">A Day with Continuum</p>
          <h2 className="ct-h2">AIが働く一日。あなたの一日。</h2>
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

      {/* ───────── PLANS ───────── */}
      <section id="plans" style={{ maxWidth: 1120, margin: '0 auto', padding: 'clamp(4.5rem, 9vw, 7.5rem) 1.5rem', scrollMarginTop: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.8rem' }}>
          <p className="ct-label">Plans</p>
          <h2 className="ct-h2">人生を取り戻す、三つの入口。</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.1rem', alignItems: 'stretch' }}>
          {CONTINUUM_PLANS.map(pl => (
            <div key={pl.name} style={{
              display: 'flex', flexDirection: 'column', gap: '0.9rem', position: 'relative',
              borderRadius: 20, padding: pl.featured ? '2.1rem 1.7rem' : '1.8rem 1.6rem',
              background: pl.featured ? 'linear-gradient(165deg, rgba(201,169,110,0.16), rgba(201,169,110,0.03))' : 'rgba(255,255,255,0.03)',
              border: pl.featured ? `1px solid rgba(201,169,110,0.65)` : '1px solid rgba(255,255,255,0.1)',
              boxShadow: pl.featured ? '0 34px 80px -36px rgba(201,169,110,0.55)' : 'none',
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
              {pl.compare && <p style={{ fontFamily: FONT_SANS, fontSize: '0.72rem', color: '#9BC4A0', lineHeight: 1.7 }}>{pl.compare}</p>}
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
          単品でそろえると 月 約¥109,000 相当。いつでも解約できます。
          <br />
          決済ページ公開までは、ボタンからそのままご相談ください（1営業日以内にお返事します）。
        </p>
      </section>

      {/* ───────── FINAL ───────── */}
      <section style={{ position: 'relative', textAlign: 'center', padding: 'clamp(5rem, 10vw, 8rem) 1.5rem calc(6rem + env(safe-area-inset-bottom))', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(60% 60% at 50% 100%, rgba(201,169,110,0.14), transparent 70%)` }} />
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.44em', color: GOLD, textTransform: 'uppercase', marginBottom: '1.4rem', position: 'relative' }}>
          Your Life, Returned
        </p>
        <h2 style={{ fontFamily: FONT_SERIF_JA, fontWeight: 700, fontSize: 'clamp(1.5rem, 4.6vw, 2.6rem)', lineHeight: 1.8, letterSpacing: '0.05em', background: `linear-gradient(120deg, ${GOLD_PALE}, ${GOLD})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', position: 'relative' }}>
          あなたの時間を、
          <br />
          あなたの人生に返す。
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
  /* ── 黄金の環（6ロゴが CORE を巡る）── */
  .ct-orbit-wrap { position: relative; width: min(76vw, 340px); height: min(76vw, 340px); }
  .ct-ring { position: absolute; inset: 0; border-radius: 50%; border: 1px solid rgba(201,169,110,0.35); box-shadow: 0 0 60px rgba(201,169,110,0.12), inset 0 0 40px rgba(201,169,110,0.06); }
  .ct-ring2 { inset: 12%; border-color: rgba(201,169,110,0.16); box-shadow: none; }
  .ct-core { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 96px; height: 96px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 32%, rgba(201,169,110,0.22), rgba(5,5,5,0.9)); border: 1px solid rgba(201,169,110,0.55); box-shadow: 0 0 44px rgba(201,169,110,0.3); animation: ctCoreBreath 4.5s ease-in-out infinite; }
  .ct-orbit { position: absolute; inset: 0; animation: ctSpin 46s linear infinite; }
  .ct-sat { position: absolute; left: 50%; top: 50%; transform: rotate(var(--deg)) translateY(calc(min(38vw, 170px) * -1)) rotate(calc(var(--deg) * -1)); }
  .ct-sat-inner { width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 50% 30%, rgba(201,169,110,0.14), rgba(8,8,8,0.92)); border: 1px solid rgba(201,169,110,0.42); box-shadow: 0 6px 22px rgba(0,0,0,0.55), 0 0 18px rgba(201,169,110,0.14); animation: ctSpinRev 46s linear infinite; }
  @keyframes ctSpin { to { transform: rotate(360deg); } }
  @keyframes ctSpinRev { to { transform: rotate(-360deg); } }
  @keyframes ctCoreBreath { 0%,100% { box-shadow: 0 0 44px rgba(201,169,110,0.3); } 50% { box-shadow: 0 0 74px rgba(201,169,110,0.5); } }

  /* 金粒 */
  .ct-dust { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: rgba(231,201,135,0.8); box-shadow: 0 0 8px rgba(231,201,135,0.9); animation: ctFloat 6s ease-in-out infinite; }
  @keyframes ctFloat { 0%,100% { opacity: 0.25; transform: translateY(0); } 50% { opacity: 0.9; transform: translateY(-14px); } }

  /* 見出し・ラベル */
  .ct-label { font-family: ${FONT_DISPLAY.replace(/"/g, "'")}; font-size: 0.68rem; letter-spacing: 0.42em; color: ${GOLD}; text-transform: uppercase; margin-bottom: 1.1rem; }
  .ct-h2 { font-family: 'Noto Serif JP','游明朝','Yu Mincho',serif; font-weight: 700; font-size: clamp(1.5rem, 3.8vw, 2.4rem); line-height: 1.7; letter-spacing: 0.05em; margin-bottom: 1.2rem; background: linear-gradient(120deg, ${GOLD_PALE}, ${GOLD}); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

  /* CTA */
  .ct-cta-main { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 34px; border-radius: 999px; text-decoration: none; font-family: ${FONT_SANS.replace(/"/g, "'")}; font-size: 0.92rem; font-weight: 800; letter-spacing: 0.05em; color: #141414; background: linear-gradient(90deg, ${GOLD_HI}, ${GOLD}); box-shadow: 0 14px 40px -12px rgba(201,169,110,0.65); }
  .ct-cta-ghost { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 26px; border-radius: 999px; text-decoration: none; font-family: ${FONT_SANS.replace(/"/g, "'")}; font-size: 0.88rem; font-weight: 700; letter-spacing: 0.04em; color: ${GOLD_PALE}; border: 1px solid rgba(201,169,110,0.5); background: rgba(201,169,110,0.06); }

  .ct-six-card { padding: 1.4rem 1.3rem; border-radius: 18; border-radius: 18px; border: 1px solid rgba(201,169,110,0.26); background: linear-gradient(170deg, rgba(201,169,110,0.06), rgba(255,255,255,0.01)); transition: border-color 0.3s ease, transform 0.3s ease; }
  .ct-six-card:hover { border-color: rgba(201,169,110,0.6); transform: translateY(-2px); }

  @media (prefers-reduced-motion: reduce) {
    .ct-orbit, .ct-sat-inner, .ct-core, .ct-dust { animation: none !important; }
  }
`;
