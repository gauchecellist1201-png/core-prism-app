// ============================================================
// ULTIMA — 建設・電気設備工事の AI 現場基盤（CORE Vertical 第1弾）
// 配置: /ultima
//
// 設計方針:
//   ・1画面1完結。縦に延々と続くLPではなく、タブで画面が入れ替わる（375px基準）
//   ・文言・価格は verticalData.ts の単一の正から読む（画面にハードコードしない）
//   ・OS標準のカラー絵文字は使わない。線画SVGで統一
// ============================================================
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CoreLogo, UltimaLogo } from '../components/Logo';
import {
  ULTIMA_FIELD, ULTIMA_OFFICE, ULTIMA_DOCTRINE, ULTIMA_FLOW,
  ULTIMA_PRICE, ULTIMA_COMPARE, ULTIMA_FAQ,
} from './verticalData';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';

const C = {
  bg: '#050505',
  panel: 'rgba(255,255,255,0.03)',
  gold: '#C9A24B',
  goldLite: '#E9CD8A',
  amber: '#E8A33D',
  ink: '#F1E9D8',
  mute: 'rgba(240,233,216,0.66)',
  faint: 'rgba(240,233,216,0.62)', // 2026-07-30: 0.45は黒地で3.87:1と基準未達だった
  line: 'rgba(201,162,75,0.22)',
};

const CONTACT_MAIL = 'core.inc.guild@gmail.com';
const CONTACT_HREF = `mailto:${CONTACT_MAIL}?subject=${encodeURIComponent('ULTIMA 導入相談')}&body=${encodeURIComponent('会社名：\nご担当者名：\n現場の数（月あたり）：\n気になっている機能（現場／営業／両方）：\n\n')}`;

type TabId = 'field' | 'office' | 'flow' | 'price' | 'faq';
const TABS: Array<{ id: TabId; label: string; sub: string }> = [
  { id: 'field', label: '現場', sub: 'FIELD' },
  { id: 'office', label: '営業', sub: 'OFFICE' },
  { id: 'flow', label: 'つながり', sub: 'FLOW' },
  { id: 'price', label: '料金', sub: 'PRICE' },
  { id: 'faq', label: 'Q&A', sub: 'FAQ' },
];

// ─── 線画アイコン（カラー絵文字は使わない） ───
function Ico({ name, size = 22 }: { name: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    camera: <><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.1-1.8h6.6L15.9 6h2.6A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /><circle cx="12" cy="12.5" r="3.4" /></>,
    mic: <><rect x="9" y="3" width="6" height="10.5" rx="3" /><path d="M5.5 12a6.5 6.5 0 0 0 13 0M12 18.5V21" /></>,
    calc: <><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 7.5h8M8 12h2m3 0h3M8 16.5h2m3 0h3" /></>,
    money: <><circle cx="12" cy="12" r="9" /><path d="M8.5 8.5 12 13l3.5-4.5M9 13.5h6M9 16h6M12 13v4" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
    shield: <><path d="M12 3 5 6v6c0 4 3 6.8 7 9 4-2.2 7-5 7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 2" /></>,
    eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" /><circle cx="12" cy="12" r="3" /></>,
    loop: <><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5" /><path d="M20 4.5v4h-4" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5" /><path d="M4 19.5v-4h4" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name] ?? p.shield}
    </svg>
  );
}

const DOCTRINE_ICONS = ['shield', 'clock', 'eye', 'loop'];
const FIELD_ICONS = ['camera', 'mic', 'calc', 'money', 'layers'];

export default function UltimaLanding() {
  const initial = (): TabId => {
    if (typeof window === 'undefined') return 'field';
    const h = window.location.hash.replace('#', '');
    return (TABS.some(t => t.id === h) ? h : 'field') as TabId;
  };
  const [tab, setTab] = useState<TabId>(initial);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    document.title = 'ULTIMA — 現場の声で、書類が生まれる。｜CORE';
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
    const desc = '建設業・電気設備工事業のためのAI現場基盤。LINEで写真を送るだけで整理まで終わり、夜のうちに提案書・見積・日報が出来上がる。現場と営業をまるごと、月¥29,800。CORE Vertical 第1弾。';
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('meta[property="og:title"]', 'content', 'ULTIMA — 現場の声で、書類が生まれる。');
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', 'https://core-prism-app.vercel.app/ultima');
    setMeta('meta[property="og:type"]', 'content', 'website');
    setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image');
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute('content', '#050505');
  }, []);

  const go = (t: TabId) => {
    setTab(t);
    history.replaceState(null, '', '#' + t);
    const el = document.getElementById('ult-tabs');
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      background: C.bg, color: C.ink, minHeight: '100dvh', fontFamily: FONT_SANS,
      overflowX: 'clip', overflowY: 'visible', WebkitOverflowScrolling: 'touch',
    }}>
      {/* ── ヘッダー ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(5,5,5,0.86)', backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${C.line}`,
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', padding: '0.7rem 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
        }}>
          <a href="/vertical" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.ink, minHeight: 44 }}>
            <UltimaLogo size={26} withWordmark={false} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.98rem', letterSpacing: '0.2em', color: C.ink }}>ULTIMA</span>
              <span style={{ fontFamily: FONT_SANS, fontSize: '0.58rem', letterSpacing: '0.22em', color: C.faint }}>CORE VERTICAL 01</span>
            </span>
          </a>
          <a href={CONTACT_HREF} style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 40, padding: '0 1rem',
            borderRadius: 999, textDecoration: 'none', whiteSpace: 'nowrap',
            background: `linear-gradient(135deg, ${C.goldLite}, ${C.gold})`, color: '#1a1408',
            fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em',
          }}>
            相談する
          </a>
        </div>
      </header>

      {/* ── ヒーロー ── */}
      <section style={{
        position: 'relative', padding: '3.2rem 1.25rem 2.6rem',
        background: 'radial-gradient(120% 90% at 50% 0%, rgba(232,163,61,0.13), rgba(5,5,5,0) 62%)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <motion.p
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            style={{
              fontFamily: FONT_DISPLAY, fontSize: '0.64rem', letterSpacing: '0.34em',
              color: C.amber, margin: '0 0 1.1rem', textTransform: 'uppercase',
            }}
          >
            建設 ・ 電気設備工事 ・ プラント
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.05 }}
            style={{
              fontFamily: FONT_SERIF_JA, fontWeight: 700,
              fontSize: 'clamp(1.75rem, 6.4vw, 3.1rem)', lineHeight: 1.5,
              letterSpacing: '0.03em', margin: 0,
            }}
          >
            現場の声で、<br />書類が生まれる。
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.18 }}
            style={{
              fontFamily: FONT_SERIF_JA, color: C.mute, marginTop: '1.4rem',
              fontSize: 'clamp(0.9rem, 2.6vw, 1.02rem)', lineHeight: 2.05, maxWidth: 640,
              marginLeft: 'auto', marginRight: 'auto',
            }}
          >
            LINEで写真を送る。現場のことばで話しかける。<br />
            それだけで写真は整理され、計算も、見積も、日報も出来上がる。<br />
            夜のうちにAIが明日の段取りを決め、翌朝もうひとりのAIが、その仕事を検査する。
          </motion.p>

          <div style={{
            display: 'flex', gap: '0.7rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem',
          }}>
            <a href={CONTACT_HREF} style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 52, padding: '0 1.7rem',
              borderRadius: 999, textDecoration: 'none',
              background: `linear-gradient(135deg, ${C.goldLite}, ${C.gold})`, color: '#1a1408',
              fontWeight: 700, fontSize: '0.94rem', letterSpacing: '0.04em',
              boxShadow: '0 18px 40px -22px rgba(201,162,75,0.8)',
            }}>
              導入を相談する
            </a>
            <button onClick={() => go('flow')} style={{
              display: 'inline-flex', alignItems: 'center', minHeight: 52, padding: '0 1.5rem',
              borderRadius: 999, cursor: 'pointer',
              background: 'transparent', color: C.ink, border: `1px solid ${C.line}`,
              fontWeight: 600, fontSize: '0.9rem', fontFamily: FONT_SANS,
            }}>
              仕組みを見る
            </button>
          </div>

          <p style={{
            marginTop: '1.6rem', fontSize: '0.72rem', color: C.faint, letterSpacing: '0.04em', lineHeight: 1.9,
          }}>
            β運用中 — 先行導入社と実運用で検証しています。<br />
            月 ¥29,800（税込）まるごと1本。専用アプリのインストールは不要です。
          </p>
        </div>
      </section>

      {/* ── 4つの背骨 ── */}
      <section style={{ padding: '0 1.25rem 2.8rem' }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.85rem',
        }}>
          {ULTIMA_DOCTRINE.map((d, i) => (
            <div key={d.head} style={{
              padding: '1.35rem 1.25rem', borderRadius: 16,
              background: C.panel, border: `1px solid ${C.line}`,
            }}>
              <span style={{ color: C.amber, display: 'inline-flex' }}><Ico name={DOCTRINE_ICONS[i]} /></span>
              <h3 style={{
                fontFamily: FONT_SERIF_JA, fontSize: '0.98rem', fontWeight: 700,
                margin: '0.7rem 0 0.5rem', letterSpacing: '0.03em',
              }}>{d.head}</h3>
              <p style={{ fontSize: '0.8rem', color: C.mute, lineHeight: 1.95, margin: 0 }}>{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── タブ ── */}
      <div id="ult-tabs" style={{
        // ヘッダー(67px)＋ノッチ分の直下に貼りつく。数値を固定にするとノッチ機で隙間が空く
        position: 'sticky', top: 'calc(env(safe-area-inset-top) + 67px)', zIndex: 30,
        background: 'rgba(5,5,5,0.92)', backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`,
      }}>
        {/* 375px で5タブが見切れずに収まる幅にする（横スクロールさせない） */}
        <div style={{
          maxWidth: 1080, margin: '0 auto', display: 'flex', gap: 2,
          padding: '0.5rem 0.4rem', scrollbarWidth: 'none',
        }}>
          {TABS.map(t => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => go(t.id)} style={{
                flex: '1 1 0', minWidth: 0, minHeight: 46, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                borderRadius: 12, border: on ? `1px solid ${C.gold}` : '1px solid transparent',
                background: on ? 'linear-gradient(160deg, rgba(201,162,75,0.18), rgba(201,162,75,0.04))' : 'transparent',
                color: on ? C.goldLite : C.faint, fontFamily: FONT_SANS,
                transition: 'all .25s ease',
              }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, letterSpacing: '0.06em' }}>{t.label}</span>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.5rem', letterSpacing: '0.2em', opacity: 0.75 }}>{t.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── タブ本体 ── */}
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '2.6rem 1.25rem 4rem', minHeight: '52vh' }}>
        <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

          {/* 現場 */}
          {tab === 'field' && (
            <>
              <TabHead
                jp="現場" en="FIELD"
                head="ヘルメットの下から、送るだけ。"
                lead="職人さんに新しい操作を覚えてもらう必要はありません。入口は、いつものLINEだけです。"
              />
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                {ULTIMA_FIELD.map((f, i) => (
                  <div key={f.title} style={{
                    display: 'flex', gap: '1rem', alignItems: 'flex-start',
                    padding: '1.4rem 1.25rem', borderRadius: 16,
                    background: C.panel, border: `1px solid ${C.line}`,
                  }}>
                    <span style={{
                      flexShrink: 0, width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
                      background: 'radial-gradient(circle at 50% 30%, rgba(232,163,61,0.2), #0c0a07)',
                      border: '1px solid rgba(232,163,61,0.4)', color: C.amber,
                    }}>
                      <Ico name={FIELD_ICONS[i]} size={21} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 700, margin: '0 0 0.5rem', letterSpacing: '0.02em' }}>{f.title}</h3>
                      <p style={{ fontSize: '0.83rem', color: C.mute, lineHeight: 1.95, margin: 0 }}>{f.body}</p>
                      {f.voice && (
                        <p style={{
                          marginTop: '0.85rem', padding: '0.6rem 0.85rem', borderRadius: 12,
                          background: 'rgba(6,199,85,0.07)', border: '1px solid rgba(6,199,85,0.22)',
                          fontSize: '0.76rem', color: 'rgba(240,233,216,0.82)', lineHeight: 1.7,
                        }}>
                          <span style={{ color: '#06C755', fontSize: '0.62rem', letterSpacing: '0.16em', display: 'block', marginBottom: 4 }}>LINE でこう送るだけ</span>
                          {f.voice}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 営業 */}
          {tab === 'office' && (
            <>
              <TabHead
                jp="営業" en="OFFICE"
                head="社長が寝ている間に、一日の段取りが決まっている。"
                lead="11体のAIが時刻ごとに動きます。作るAIと、それを検査するAIが別にいるのが、ULTIMAの背骨です。"
              />
              <div style={{ position: 'relative', paddingLeft: '1.15rem' }}>
                <div style={{
                  position: 'absolute', left: 4, top: 8, bottom: 8, width: 1,
                  background: `linear-gradient(180deg, ${C.amber}, rgba(201,162,75,0.25), transparent)`,
                }} />
                {ULTIMA_OFFICE.map((o, i) => {
                  const isAudit = i < 2;
                  return (
                    <div key={o.time} style={{ position: 'relative', paddingBottom: '1.1rem' }}>
                      <span style={{
                        position: 'absolute', left: '-1.15rem', top: 16, width: 9, height: 9, borderRadius: '50%',
                        background: isAudit ? C.amber : C.gold, boxShadow: `0 0 12px ${isAudit ? C.amber : C.gold}`,
                        transform: 'translateX(-0.5px)',
                      }} />
                      <div style={{
                        padding: '1.05rem 1.15rem', borderRadius: 14,
                        background: isAudit ? 'linear-gradient(160deg, rgba(232,163,61,0.11), rgba(232,163,61,0.02))' : C.panel,
                        border: isAudit ? '1px solid rgba(232,163,61,0.42)' : `1px solid ${C.line}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.7rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontFamily: FONT_SANS, fontWeight: 700, fontSize: '0.92rem',
                            color: isAudit ? C.amber : C.goldLite, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em',
                          }}>{o.time}</span>
                          <span style={{ fontFamily: FONT_SERIF_JA, fontWeight: 700, fontSize: '0.94rem' }}>{o.name}</span>
                        </div>
                        <p style={{ fontSize: '0.81rem', color: C.mute, lineHeight: 1.95, margin: '0.5rem 0 0' }}>{o.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{
                marginTop: '1.2rem', padding: '1.3rem 1.25rem', borderRadius: 16,
                background: C.panel, border: `1px solid ${C.line}`,
              }}>
                <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.98rem', fontWeight: 700, margin: '0 0 0.55rem' }}>
                  人が呼ばれるのは、3つの場合だけ
                </h3>
                <p style={{ fontSize: '0.82rem', color: C.mute, lineHeight: 2, margin: 0 }}>
                  ① 出来上がったものの品質が良くないとき（「要再作成」と一言つけるだけで、その案件だけ作り直します）<br />
                  ② 必要な情報がまだ入っていないとき<br />
                  ③ 設備そのものが壊れているとき<br />
                  それ以外は、監査役AIと親方AIの輪が、人を呼ばずに回ります。
                </p>
              </div>
            </>
          )}

          {/* つながり */}
          {tab === 'flow' && (
            <>
              <TabHead
                jp="つながり" en="ONE FLOW"
                head="撮った写真が、そのまま提案書になる。"
                lead="現場と営業を、別々の道具でやらない。ひとつの川として、上流から下流までつなぎます。"
              />
              <div style={{ display: 'grid', gap: '0.85rem' }}>
                {ULTIMA_FLOW.map(s => (
                  <div key={s.step} style={{
                    display: 'flex', gap: '1.1rem', alignItems: 'flex-start',
                    padding: '1.35rem 1.25rem', borderRadius: 16,
                    background: C.panel, border: `1px solid ${C.line}`,
                  }}>
                    <span style={{
                      fontFamily: FONT_DISPLAY, fontSize: '1.5rem', color: 'rgba(201,162,75,0.55)',
                      lineHeight: 1, flexShrink: 0, fontWeight: 600,
                    }}>{s.step}</span>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1rem', fontWeight: 700, margin: '0 0 0.45rem' }}>{s.head}</h3>
                      <p style={{ fontSize: '0.83rem', color: C.mute, lineHeight: 1.95, margin: 0 }}>{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{
                fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700,
                margin: '2.6rem 0 1rem', letterSpacing: '0.03em',
              }}>
                他のサービスと、どう違うか
              </h3>
              <div style={{ overflowX: 'auto', border: `1px solid ${C.line}`, borderRadius: 16 }}>
                <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {['', '月額', 'AI', 'LINE', '営業の自動化'].map(h => (
                        <th key={h} style={{
                          padding: '0.85rem 0.9rem', textAlign: 'left', fontWeight: 600,
                          color: C.faint, fontSize: '0.72rem', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                          borderBottom: `1px solid ${C.line}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ULTIMA_COMPARE.map(r => (
                      <tr key={r.name} style={{ background: r.ours ? 'rgba(232,163,61,0.08)' : 'transparent' }}>
                        <td style={cellStyle(r.ours)}>{r.name}</td>
                        <td style={cellStyle(r.ours)}>{r.price}</td>
                        <td style={cellStyle(r.ours)}>{r.ai}</td>
                        <td style={cellStyle(r.ours)}>{r.line}</td>
                        <td style={cellStyle(r.ours)}>{r.sales}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: '0.7rem', color: C.faint, lineHeight: 1.9, marginTop: '0.8rem' }}>
                ※ 他社の月額は各社の公開価格帯にもとづく参考値です。機能の有無は2026年7月時点の公開情報にもとづく当社調べで、各社の全プランを保証するものではありません。
              </p>
            </>
          )}

          {/* 料金 */}
          {tab === 'price' && (
            <>
              <TabHead
                jp="料金" en="PRICE"
                head="プランは、ひとつだけ。"
                lead={ULTIMA_PRICE.lead}
              />
              <div style={{
                padding: '2rem 1.4rem 1.7rem', borderRadius: 20,
                background: 'linear-gradient(160deg, rgba(232,163,61,0.15), rgba(232,163,61,0.02))',
                border: '1px solid rgba(232,163,61,0.55)',
                boxShadow: '0 26px 64px -32px rgba(232,163,61,0.5)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.3em', color: C.amber }}>ALL IN ONE</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8, marginTop: '0.7rem' }}>
                    <span style={{ fontWeight: 700, fontSize: 'clamp(2.2rem, 9vw, 3rem)', color: C.amber, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                      {ULTIMA_PRICE.price}
                    </span>
                    <small style={{ fontSize: '0.74rem', color: C.faint }}>{ULTIMA_PRICE.priceNote}</small>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: C.mute, lineHeight: 1.9, margin: '0.9rem 0 0' }}>
                    人数制限なし・機能の出し惜しみなし
                  </p>
                </div>

                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.4rem',
                  marginTop: '1.9rem', paddingTop: '1.6rem', borderTop: '1px solid rgba(232,163,61,0.3)',
                }}>
                  {[
                    { head: '現場でできること', items: ULTIMA_PRICE.field },
                    { head: '営業がやってくれること', items: ULTIMA_PRICE.office },
                  ].map(col => (
                    <div key={col.head}>
                      <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.85rem', letterSpacing: '0.04em' }}>{col.head}</h3>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.55rem' }}>
                        {col.items.map(x => (
                          <li key={x} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.79rem', color: C.mute, lineHeight: 1.75 }}>
                            <span style={{ color: C.amber, flexShrink: 0, marginTop: 2 }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5L20 7" /></svg>
                            </span>
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <a href={CONTACT_HREF} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 52, borderRadius: 999, textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem',
                  background: `linear-gradient(135deg, ${C.goldLite}, ${C.gold})`, color: '#1a1408',
                  marginTop: '1.8rem',
                }}>
                  導入を相談する
                </a>
                <p style={{ fontSize: '0.72rem', color: C.faint, lineHeight: 1.9, margin: '1rem 0 0' }}>
                  {ULTIMA_PRICE.note}
                </p>
              </div>

              <div style={{
                marginTop: '1.2rem', padding: '1.35rem 1.25rem', borderRadius: 16,
                background: C.panel, border: `1px solid ${C.line}`,
              }}>
                <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.96rem', fontWeight: 700, margin: '0 0 0.6rem' }}>元は取れますか、という話</h3>
                <p style={{ fontSize: '0.82rem', color: C.mute, lineHeight: 2, margin: 0 }}>
                  月に5現場を持つ会社で、写真の整理・日報・提案書の下書きに費やしている時間を仮に月40時間、人件費を時給¥2,500として計算すると、月¥100,000ぶんの時間です。
                  そのうち3割が戻るだけでも、月¥29,800は釣り合います。<br />
                  <span style={{ color: C.faint, fontSize: '0.74rem' }}>※ これは試算です。実際の削減時間は現場数・書類の量によって変わります。導入前に、御社の数字で一緒に計算します。</span>
                </p>
              </div>
            </>
          )}

          {/* Q&A */}
          {tab === 'faq' && (
            <>
              <TabHead jp="よくある質問" en="FAQ" head="気になるところから。" lead="ここに無いことは、そのまま聞いてください。" />
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {ULTIMA_FAQ.map((f, i) => {
                  const open = openFaq === i;
                  return (
                    <div key={f.q} style={{ borderRadius: 14, background: C.panel, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
                      <button
                        onClick={() => setOpenFaq(open ? null : i)}
                        aria-expanded={open}
                        style={{
                          width: '100%', minHeight: 56, padding: '1rem 1.15rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.9rem',
                          background: 'transparent', border: 'none', color: C.ink, textAlign: 'left',
                          fontFamily: FONT_SANS, fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.7,
                        }}
                      >
                        <span>{f.q}</span>
                        <span style={{ color: C.gold, flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
                        </span>
                      </button>
                      {open && (
                        <p style={{ padding: '0 1.15rem 1.15rem', margin: 0, fontSize: '0.82rem', color: C.mute, lineHeight: 2 }}>
                          {f.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </motion.div>
      </main>

      {/* ── 締めのCTA ── */}
      <section style={{
        padding: '4rem 1.25rem 4.5rem',
        background: 'radial-gradient(110% 80% at 50% 100%, rgba(232,163,61,0.13), rgba(5,5,5,0) 62%)',
        borderTop: `1px solid ${C.line}`,
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <UltimaLogo size={38} withWordmark={false} />
          <h2 style={{
            fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.35rem, 4.6vw, 2rem)', fontWeight: 700,
            lineHeight: 1.7, margin: '1.2rem 0 1rem', letterSpacing: '0.03em',
          }}>
            まず、一現場から。
          </h2>
          <p style={{ fontSize: '0.88rem', color: C.mute, lineHeight: 2.05, margin: '0 0 2rem' }}>
            いま困っていることを一つ教えてください。<br />
            それがULTIMAで消えるかどうか、正直にお答えします。
          </p>
          <a href={CONTACT_HREF} style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 54, padding: '0 2rem',
            borderRadius: 999, textDecoration: 'none',
            background: `linear-gradient(135deg, ${C.goldLite}, ${C.gold})`, color: '#1a1408',
            fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.04em',
            boxShadow: '0 18px 44px -22px rgba(201,162,75,0.85)',
          }}>
            導入を相談する
          </a>
          <p style={{ marginTop: '1.1rem', fontSize: '0.74rem', color: C.faint }}>
            {CONTACT_MAIL}
          </p>
        </div>
      </section>

      {/* ── フッター ── */}
      <footer style={{
        borderTop: `1px solid ${C.line}`, padding: '2.2rem 1.25rem calc(2.4rem + env(safe-area-inset-bottom))',
      }}>
        <div style={{
          maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap',
          gap: '1.2rem', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <a href="/corp" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: C.faint, minHeight: 44 }}>
            <CoreLogo size={22} withWordmark={false} />
            <span style={{ fontSize: '0.74rem', letterSpacing: '0.1em' }}>CORE の他のサービスを見る</span>
          </a>
          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap' }}>
            <a href="/vertical" style={footLink}>業界特化ライン</a>
            <a href="/terms" style={footLink}>利用規約</a>
            <a href="/privacy" style={footLink}>プライバシー</a>
            <a href="/tokushoho" style={footLink}>特定商取引法</a>
          </div>
        </div>
        <p style={{ maxWidth: 1080, margin: '1.6rem auto 0', fontSize: '0.68rem', color: 'rgba(240,233,216,0.55)', lineHeight: 1.9 }}>
          ULTIMA は CORE の業界特化プロダクトです。AIが作成した書類は、建設業法にもとづき有資格者による最終確認を前提としています。補助金に関する情報は参考提供であり、申請の責任はお客様に帰属します。<br />
          © {new Date().getFullYear()} CORE（設立準備中）
        </p>
      </footer>
    </div>
  );
}

const footLink: React.CSSProperties = {
  fontSize: '0.72rem', color: C.faint, textDecoration: 'none',
  letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', minHeight: 44,
};

function cellStyle(ours?: boolean): React.CSSProperties {
  return {
    padding: '0.85rem 0.9rem',
    borderBottom: `1px solid ${C.line}`,
    color: ours ? C.ink : C.mute,
    fontWeight: ours ? 700 : 400,
    whiteSpace: 'nowrap',
  };
}

function TabHead({ jp, en, head, lead }: { jp: string; en: string; head: string; lead: string }) {
  return (
    <div style={{ marginBottom: '1.9rem' }}>
      <p style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem', margin: '0 0 0.9rem' }}>
        <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', letterSpacing: '0.34em', color: 'rgba(240,233,216,0.9)', fontWeight: 700 }}>{jp}</span>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.58rem', letterSpacing: '0.38em', color: 'rgba(201,162,75,0.85)' }}>{en}</span>
      </p>
      <h2 style={{
        fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.25rem, 4.4vw, 1.85rem)', fontWeight: 700,
        lineHeight: 1.6, letterSpacing: '0.03em', margin: '0 0 0.8rem',
      }}>{head}</h2>
      <p style={{ fontSize: '0.86rem', color: C.mute, lineHeight: 2, margin: 0, maxWidth: 640 }}>{lead}</p>
    </div>
  );
}
