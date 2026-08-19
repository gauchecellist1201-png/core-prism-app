// ============================================================
// CORE Vertical — 業界特化ライン のハブ（/vertical）
//
// プラットフォーム（Prism / Iris / Resonance …）とは別の棚。
// 「どの業界でも使える道具」ではなく「その業界の仕事そのものを動かすもの」を並べる。
// 第1弾 ULTIMA（建設・電気設備工事） / 第2弾 ANIMA（アニメ制作進行） / 第3弾 VERITAS（広告運用） / 第4弾 SOMA（林業） / 第5弾 Tabitto（出張・経費精算）。
// ============================================================
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CoreLogo, UltimaLogo, AnimaLogo, VeritasLogo, SomaLogo, TabittoLogo } from '../components/Logo';
import { VERTICALS, type VerticalProduct } from './verticalData';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';

const C = {
  bg: '#050505',
  panel: 'rgba(255,255,255,0.03)',
  gold: '#C9A24B',
  goldLite: '#E9CD8A',
  ink: '#F1E9D8',
  mute: 'rgba(240,233,216,0.66)',
  faint: 'rgba(240,233,216,0.62)', // 2026-07-30: 0.45は黒地で3.87:1と基準未達だった
  line: 'rgba(201,162,75,0.22)',
};

const LOGOS: Record<VerticalProduct['key'], typeof UltimaLogo> = {
  ultima: UltimaLogo,
  anima: AnimaLogo,
  veritas: VeritasLogo,
  soma: SomaLogo,
  tabitto: TabittoLogo,
};

export default function VerticalHub() {
  useEffect(() => {
    document.title = 'CORE Vertical — 業界の中に、入り込むAI。';
    const setMeta = (sel: string, attr: string, value: string) => {
      let m = document.querySelector(sel);
      if (!m) {
        m = document.createElement('meta');
        const s = sel.match(/\[(?:property|name)="([^"]+)"\]/);
        if (s) m.setAttribute(sel.includes('property=') ? 'property' : 'name', s[1]);
        document.head.appendChild(m);
      }
      m.setAttribute(attr, value);
    };
    const desc = 'CORE Vertical — ひとつの業界の仕事そのものを動かす特化プロダクト。建設・電気設備工事の ULTIMA、アニメ制作進行の ANIMA、広告運用の VERITAS、林業の SOMA。';
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', 'CORE Vertical — 業界の中に、入り込むAI。');
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', 'https://core-prism-app.vercel.app/vertical');
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute('content', '#050505');
  }, []);

  return (
    <div style={{
      background: C.bg, color: C.ink, minHeight: '100dvh', fontFamily: FONT_SANS,
      overflowX: 'clip', overflowY: 'visible', WebkitOverflowScrolling: 'touch',
    }}>
      {/* ヘッダー */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(5,5,5,0.86)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.line}`, paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '0.7rem 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
        }}>
          <a href="/corp" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.ink, minHeight: 44 }}>
            <CoreLogo size={24} withWordmark={false} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.9rem', letterSpacing: '0.2em' }}>CORE</span>
              <span style={{ fontSize: '0.58rem', letterSpacing: '0.22em', color: C.faint }}>VERTICAL</span>
            </span>
          </a>
          <a href="/corp#platform" style={{
            // 指で狙える床は 44px。左の CORE ロゴが既に 44px なのでヘッダーの高さは変わらない
            display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 0.95rem',
            borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap',
            border: `1px solid ${C.line}`, color: C.mute, fontSize: '0.75rem', fontWeight: 600,
          }}>
            プラットフォームを見る
          </a>
        </div>
      </header>

      {/* ヒーロー */}
      <section style={{
        padding: '3.4rem 1.25rem 2.8rem',
        background: 'radial-gradient(120% 90% at 50% 0%, rgba(201,162,75,0.13), rgba(5,5,5,0) 62%)',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.36em', color: C.gold, margin: '0 0 1.1rem' }}
          >
            CORE VERTICAL
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
            style={{
              fontFamily: FONT_SERIF_JA, fontWeight: 700, margin: 0,
              fontSize: 'clamp(1.7rem, 6vw, 2.9rem)', lineHeight: 1.55, letterSpacing: '0.03em',
            }}
          >
            業界の中に、<br />入り込むAI。
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.18 }}
            style={{
              fontFamily: FONT_SERIF_JA, color: C.mute, marginTop: '1.5rem',
              fontSize: 'clamp(0.9rem, 2.6vw, 1.02rem)', lineHeight: 2.05, maxWidth: 620,
              marginLeft: 'auto', marginRight: 'auto',
            }}
          >
            どの業界でも使える道具は、すでに揃えました。<br />
            ここに並ぶのは、ひとつの業界の仕事そのものを引き受けるためのAIです。<br />
            その業界の言葉で話し、その業界の書類を作り、その業界の法令の中で動きます。
          </motion.p>
        </div>
      </section>

      {/* プロダクトカード */}
      <section style={{ padding: '0 1.25rem 3rem' }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1rem',
        }}>
          {VERTICALS.map((v, i) => {
            const Logo = LOGOS[v.key];
            return (
              <motion.a
                key={v.key}
                href={v.path}
                target={v.external ? '_blank' : undefined}
                rel={v.external ? 'noopener' : undefined}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                className="lp-tap-link"
                style={{
                  display: 'flex', flexDirection: 'column', textDecoration: 'none', color: C.ink,
                  padding: '1.9rem 1.6rem 1.7rem', borderRadius: 20,
                  background: `linear-gradient(165deg, ${v.accent}1F, rgba(255,255,255,0.02))`,
                  border: `1px solid ${v.accent}55`,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <span style={{
                    width: 52, height: 52, borderRadius: 15, display: 'grid', placeItems: 'center', flexShrink: 0,
                    background: `radial-gradient(circle at 50% 30%, ${v.accent}2E, #0c0a07)`,
                    border: `1px solid ${v.accent}66`, boxShadow: `0 0 22px ${v.accent}26`,
                  }}>
                    <Logo size={32} withWordmark={false} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: '1.4rem', fontWeight: 600, letterSpacing: '0.1em', lineHeight: 1.2 }}>{v.name}</span>
                    <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.58rem', letterSpacing: '0.22em', color: v.accent, textTransform: 'uppercase', marginTop: 4 }}>{v.role}</span>
                  </span>
                </span>

                <span style={{ fontSize: '0.68rem', color: C.faint, letterSpacing: '0.06em', marginTop: '1.1rem' }}>{v.industry}</span>
                <span style={{
                  fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700,
                  margin: '0.5rem 0 0.75rem', lineHeight: 1.65, letterSpacing: '0.02em',
                }}>{v.tagline}</span>
                <span style={{ fontSize: '0.82rem', color: C.mute, lineHeight: 1.95 }}>{v.body}</span>

                <span style={{ display: 'grid', gap: '0.45rem', margin: '1.2rem 0 1.3rem' }}>
                  {v.points.map(pt => (
                    <span key={pt} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.78rem', color: C.mute, lineHeight: 1.7 }}>
                      <span style={{ color: v.accent, flexShrink: 0, marginTop: 2 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5L20 7" /></svg>
                      </span>
                      {pt}
                    </span>
                  ))}
                </span>

                <span style={{
                  marginTop: 'auto', paddingTop: '1rem', borderTop: `1px solid ${v.accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: '0.7rem', color: C.faint }}>{v.status}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: v.accent, whiteSpace: 'nowrap' }}>
                    {v.external ? '見にいく ↗' : '詳しく見る →'}
                  </span>
                </span>
              </motion.a>
            );
          })}
        </div>
      </section>

      {/* なぜ別の棚なのか */}
      <section style={{ padding: '0 1.25rem 4rem' }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '2rem 1.5rem', borderRadius: 20,
          background: C.panel, border: `1px solid ${C.line}`,
        }}>
          <p style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem', margin: '0 0 1rem' }}>
            <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.84rem', letterSpacing: '0.34em', fontWeight: 700 }}>考え方</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.56rem', letterSpacing: '0.38em', color: 'rgba(201,162,75,0.85)' }}>WHY VERTICAL</span>
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.4rem' }}>
            {[
              { h: '汎用の道具は、最後の一歩が埋まらない', b: 'どの業界でも使えるAIは、どの業界でも「あと一歩」が残ります。その一歩こそ、現場がいちばん時間を取られているところでした。' },
              { h: '業界の言葉と、法令の中で動く', b: '現場語の聞き取り、工番での書類の引き当て、有資格者による最終確認。その業界の作法そのものを機能にしています。' },
              { h: '一社の実務から、生まれている', b: '机上の想定ではなく、実際にその仕事をしている会社の一日を、そのままAIに移し替えるところから始めています。' },
            ].map(x => (
              <div key={x.h}>
                <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.55rem', lineHeight: 1.65 }}>{x.h}</h3>
                <p style={{ fontSize: '0.81rem', color: C.mute, lineHeight: 1.95, margin: 0 }}>{x.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer style={{
        borderTop: `1px solid ${C.line}`, padding: '2.2rem 1.25rem calc(2.4rem + env(safe-area-inset-bottom))',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap',
          gap: '1.2rem', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <a href="/corp" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.faint, minHeight: 44 }}>
            <CoreLogo size={22} withWordmark={false} />
            <span style={{ fontSize: '0.74rem', letterSpacing: '0.1em' }}>CORE のトップへ</span>
          </a>
          <p style={{ fontSize: '0.68rem', color: 'rgba(240,233,216,0.55)', margin: 0 }}>
            © {new Date().getFullYear()} CORE（設立準備中）
          </p>
        </div>
      </footer>
    </div>
  );
}
