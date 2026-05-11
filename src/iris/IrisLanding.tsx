// ============================================================
// CORE Iris — Landing
// コンセプト: IRIS = 光彩 / Aurora / Halo
// 「あなたの光が、世界をつくる」 ── 影響力という光を、AI が広げる
// ============================================================
import { motion } from 'framer-motion';
import { IRIS_COLORS, IRIS_FONTS } from './irisStyle';
import { IrisLogo } from '../components/Logo';
import { useLocale } from '../hooks/useLocale';
import type { Locale } from '../lib/i18n';

interface Props {
  onEnter: () => void;
  onSelectPlan?: (planId: string) => void;
}

const sectionPad = '5.5rem 1.25rem';

const FACETS = [
  { icon: '✦', name: '案件',     desc: '受注 → 下書き → 投稿 → レポートまで AI が一気通㛧で伴走',           color: IRIS_COLORS.hotPink },
  { icon: '◐', name: '分析',     desc: 'Instagram アカウント解析 — 投稿時間・反応率・伸びるテーマを学習', color: IRIS_COLORS.purple },
  { icon: '✶', name: '創作',     desc: 'キャプション・サムネ・OG 画像 — 雰囲気に合わせて即生成',           color: IRIS_COLORS.gold },
  { icon: '◇', name: '交渉',     desc: '料金交渉ロープレ・媒体資料・ブランド提案文を AI がドラフト',       color: IRIS_COLORS.roseGold },
  { icon: '✣', name: 'ブランド', desc: '世界観に合うフォント・カラー・トーンをパーソナル AI が提案',       color: IRIS_COLORS.purpleLt },
  { icon: '❋', name: '仲間',     desc: '同じ志のクリエイター同士が繋がる、招待制コミュニティ',             color: IRIS_COLORS.pink },
];

const PLANS = [
  { id: 'lite', name: 'Lite', tag: '創作のはじめに', price: '¥2,800', suffix: '/ 月', features: ['AIキャプション 30回 / 月', '案件管理 (3件まで)', '基本フィルター', 'コミュニティ閲覧'] },
  { id: 'standard', name: 'Standard', tag: '伸びる時期に', price: '¥6,800', suffix: '/ 月', features: ['AIキャプション 無制限', 'Instagram 分析 月10回', 'ストーリー設計 5本/月', '案件交渉サポート', 'コミュニティ投稿'], highlight: true },
  { id: 'pro', name: 'Pro', tag: '事業として育てる', price: '¥9,800', suffix: '/ 月', features: ['Standard 全機能', 'チームメンバー 5名', 'ブランドマッチ 無制限', 'メディアキット PDF', '優先サポート'] },
  { id: 'studio', name: 'Studio', tag: 'プロチーム / 法人', price: '¥29,800', suffix: '/ 月', features: ['Pro 全機能', 'API アクセス + Webhook', 'ホワイトラベル', '無制限チーム', '専任コンサル付き'] },
];

export default function IrisLanding({ onEnter, onSelectPlan }: Props) {
  const { locale, setLocale, t } = useLocale();

  const handlePlan = (id: string) => {
    if (onSelectPlan) onSelectPlan(id);
    else onEnter();
  };

  return (
    <div style={{
      background: IRIS_COLORS.inkBlack,
      color: IRIS_COLORS.cream,
      fontFamily: IRIS_FONTS.body,
      minHeight: '100vh',
      overflowX: 'hidden',
    }}>
      {/* ── ベータ公開告知バー ────────────────────────────── */}
      <div className="iris-beta-bar" style={{
        background: `linear-gradient(90deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`,
        color: '#fff',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        position: 'relative',
        zIndex: 60,
      }}>
        ✨ 2026/05/12 ベータ公開 — 14 日間無料 / クレカ不要 / 先着で 30 日延長
      </div>

      {/* ── ヘッダ ────────────────────────────── */}
      <header className="lp-safe" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(26,10,38,0.7)',
        backdropFilter: 'blur(18px)',
        borderBottom: `1px solid ${IRIS_COLORS.purpleDeep}40`,
      }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <IrisLogo size={28} withWordmark />
          <nav style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <a href="#wow" style={navLink} className="lp-nav-link iris-lp-nav-link">体験</a>
            <a href="#facets" style={navLink} className="lp-nav-link iris-lp-nav-link">機能</a>
            <a href="#pricing" style={navLink} className="lp-nav-link iris-lp-nav-link">料金</a>
            <IrisLocaleToggle locale={locale} setLocale={setLocale} />
            <button onClick={onEnter} style={ctaBtnSmall}>{t('iris.nav.cta')}</button>
          </nav>
        </div>
      </header>

      {/* ── HERO */}
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '8rem 1.25rem 7rem', overflow: 'hidden', textAlign: 'center' }}>
        <IrisAuroraBackdrop />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ fontSize: '0.7rem', letterSpacing: '0.5em', fontWeight: 600, marginBottom: '1.5rem', background: `linear-gradient(90deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('iris.hero.eyebrow')}
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1 }} style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(2.5rem, 7vw, 5.6rem)', fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.01em', marginBottom: '1.5rem' }}>
            {t('iris.hero.h1.line1')}
            <br />
            <span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold} 0%, ${IRIS_COLORS.hotPink} 50%, ${IRIS_COLORS.purpleLt} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t('iris.hero.h1.line2')}
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} style={{ fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1.05rem, 1.9vw, 1.4rem)', color: IRIS_COLORS.ivoryDeep, lineHeight: 1.8, marginBottom: '0.75rem' }}>
            {t('iris.hero.sub1')}
          </motion.p>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.45 }} style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.1rem)', color: 'rgba(255,250,245,0.65)', lineHeight: 1.8, marginBottom: '2.5rem', maxWidth: 720, margin: '0 auto 2.5rem' }}>
            {t('iris.hero.sub2')}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }} style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onEnter} style={ctaBtnHero}>{t('iris.hero.cta')}</button>
            <a href="#facets" style={ctaBtnGhost}>{t('iris.hero.cta2')}</a>
          </motion.div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,250,245,0.4)', marginTop: '1.5rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>{t('iris.hero.free')}</p>
        </div>
      </section>

      {/* ── 30 秒の Wow (Before / After) ────────────────────────── */}
      <section id="wow" className="lp-section-pad" style={{
        padding: '5rem 1.25rem 5.5rem',
        background: `linear-gradient(180deg, ${IRIS_COLORS.inkBlack} 0%, #240b32 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{
              fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 700, marginBottom: '0.9rem',
              color: IRIS_COLORS.gold,
            }}>
              30 SECONDS WITH IRIS
            </p>
            <h2 style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: 'clamp(1.7rem, 4.2vw, 2.65rem)',
              fontWeight: 500, lineHeight: 1.25, marginBottom: '0.85rem',
              background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink} 55%, ${IRIS_COLORS.purpleLt})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              スクショを投げる、それだけ。
            </h2>
            <p style={{ color: 'rgba(255,250,245,0.65)', fontSize: '0.95rem', fontFamily: IRIS_FONTS.serif, lineHeight: 1.85, maxWidth: 620, margin: '0 auto' }}>
              DM、案件依頼、撮影現場、肌の悩み ── ぜんぶ写真と一言で。<br />
              Iris が読み取って、次の一手まで用意する。
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem',
            maxWidth: 1080, margin: '0 auto',
          }}>
            {[
              {
                emoji: '📸', tag: 'スクショから',
                before: 'PR 依頼の DM を見たけど、料金交渉が苦手で 3 日寝かせてしまう',
                after: 'スクショを撮って投げる → 媒体資料・希望ギャラ・断り文 3 案を 30 秒で',
                accent: IRIS_COLORS.hotPink,
              },
              {
                emoji: '🎙', tag: '声で',
                before: '撮影帰りで疲れてキャプションが書けない、ハッシュタグも考えられない',
                after: '一言だけ吹き込む → 投稿文・ストーリー台本・サムネ案を一括ドラフト',
                accent: IRIS_COLORS.gold,
              },
              {
                emoji: '💆‍♀️', tag: '美容相談',
                before: '肌が荒れて何を使えばいいかわからない、検索しても情報が多すぎる',
                after: '荒れた肌を撮って一言 → 原因仮説・スキンケア順序・受診目安まで',
                accent: IRIS_COLORS.purpleLt,
              },
            ].map((c, i) => (
              <motion.div
                key={c.tag}
                className="iris-wow-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                style={{
                  position: 'relative',
                  background: 'rgba(255,250,245,0.045)',
                  border: `1px solid ${c.accent}40`,
                  borderRadius: 22,
                  padding: '1.6rem 1.4rem 1.7rem',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  position: 'absolute', top: -60, right: -60, width: 200, height: 200,
                  borderRadius: '50%', background: c.accent, opacity: 0.18, filter: 'blur(60px)',
                }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.55rem' }}>{c.emoji}</span>
                    <span style={{
                      fontSize: '0.65rem', letterSpacing: '0.25em', fontWeight: 700,
                      color: c.accent, textTransform: 'uppercase',
                    }}>
                      {c.tag}
                    </span>
                  </div>
                  <div style={{ marginBottom: '0.85rem' }}>
                    <p style={{
                      fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
                      color: 'rgba(255,250,245,0.4)', marginBottom: '0.35rem',
                    }}>
                      BEFORE
                    </p>
                    <p style={{ fontSize: '0.88rem', color: 'rgba(255,250,245,0.62)', lineHeight: 1.6 }}>
                      {c.before}
                    </p>
                  </div>
                  <div style={{
                    height: 1, background: `linear-gradient(90deg, transparent, ${c.accent}66, transparent)`,
                    margin: '0.85rem 0 0.85rem',
                  }} />
                  <div>
                    <p style={{
                      fontSize: '0.62rem', letterSpacing: '0.2em', fontWeight: 700,
                      color: c.accent, marginBottom: '0.35rem',
                    }}>
                      WITH IRIS
                    </p>
                    <p style={{ fontSize: '0.92rem', color: IRIS_COLORS.ivory, lineHeight: 1.7, fontWeight: 500 }}>
                      {c.after}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button onClick={onEnter} style={{
              ...ctaBtnHero,
              fontSize: '0.95rem',
              padding: '0.9rem 1.85rem',
            }}>
              ✦ 30 秒、自分で試す
            </button>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,250,245,0.45)', marginTop: '0.85rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
              14 日間無料 · クレカ不要
            </p>
          </div>
        </div>
      </section>

      {/* ── 機能 (光彩のファセット) ────────────────────────────── */}
      <section id="facets" className="lp-section-pad" style={{ padding: sectionPad, background: `linear-gradient(180deg, ${IRIS_COLORS.inkBlack} 0%, #2a0a3a 100%)` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 600, marginBottom: '1rem', color: IRIS_COLORS.gold }}>SIX FACETS OF LIGHT</p>
            <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)', lineHeight: 1.2, fontWeight: 500, marginBottom: '1rem' }}>光は、6 つの色を持つ。</h2>
            <p style={{ color: 'rgba(255,250,245,0.65)', maxWidth: 700, margin: '0 auto', fontSize: '1rem', lineHeight: 1.8, fontFamily: IRIS_FONTS.serif }}>ひとつの輝きを、6 つのエージェントが角度を変えて磨く。<br />戦略・分析・創作・交渉・ブランド・コミュニティ ── 全部、自動で。</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {FACETS.map((f, i) => (
              <motion.div key={f.name} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: i * 0.07 }} style={{ position: 'relative', background: 'rgba(255,250,245,0.04)', border: `1px solid ${f.color}30`, borderRadius: 18, padding: '1.75rem 1.5rem', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: f.color, opacity: 0.16, filter: 'blur(50px)' }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ fontSize: '2.25rem', color: f.color, marginBottom: '0.6rem', fontFamily: IRIS_FONTS.serif, lineHeight: 1 }}>{f.icon}</div>
                  <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 500, marginBottom: '0.5rem', color: IRIS_COLORS.ivory }}>{f.name}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,250,245,0.7)', lineHeight: 1.7, fontFamily: IRIS_FONTS.body }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REFLECTION */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: `linear-gradient(180deg, #2a0a3a 0%, ${IRIS_COLORS.inkBlack} 100%)` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 600, marginBottom: '1.5rem', color: IRIS_COLORS.purpleLt }}>REFLECTION</p>
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)', fontWeight: 500, lineHeight: 1.4, marginBottom: '2rem', background: `linear-gradient(120deg, ${IRIS_COLORS.gold} 0%, ${IRIS_COLORS.pink} 50%, ${IRIS_COLORS.purpleLt} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            光は、<br />受け取る人がいて<br />初めて、光になる。
          </motion.h2>
          <p style={{ fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', color: 'rgba(255,250,245,0.6)', lineHeight: 1.9 }}>投稿の数より、誰の心に届いたか。<br />CORE Iris は、あなたの光を <strong style={{ color: IRIS_COLORS.gold }}>必要としている人</strong> へ正確に届ける。</p>
        </div>
      </section>

      {/* ── 価格 */}
      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: IRIS_COLORS.inkBlack }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 600, marginBottom: '1rem', color: IRIS_COLORS.hotPink }}>PRICING</p>
            <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.85rem, 3.8vw, 2.75rem)', fontWeight: 500, marginBottom: '0.75rem' }}><span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Aurora</span> Plans</h2>
            <p style={{ color: 'rgba(255,250,245,0.6)', fontSize: '0.95rem', fontFamily: IRIS_FONTS.serif }}>すべてのプランで Claude / Gemini を内蔵。API キー不要。</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {PLANS.map(p => (
              <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ duration: 0.2 }} style={{ position: 'relative', background: p.highlight ? `linear-gradient(180deg, ${IRIS_COLORS.hotPink}25, ${IRIS_COLORS.purpleDeep}15)` : 'rgba(255,250,245,0.03)', border: p.highlight ? `1px solid ${IRIS_COLORS.hotPink}60` : `1px solid ${IRIS_COLORS.purpleDeep}30`, borderRadius: 18, padding: '1.75rem 1.5rem', boxShadow: p.highlight ? `0 16px 48px ${IRIS_COLORS.hotPink}25` : 'none' }}>
                {p.highlight && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink})`, color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.3rem 0.85rem', borderRadius: 999, letterSpacing: '0.15em' }}>人気</div>}
                <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.85rem', color: IRIS_COLORS.gold, marginBottom: '0.5rem' }}>— {p.tag}</p>
                <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.85rem', fontWeight: 500, marginBottom: '0.4rem' }}>{p.name}</h3>
                <p style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: IRIS_FONTS.body }}>{p.price}<span style={{ fontSize: '0.85rem', color: 'rgba(255,250,245,0.5)', fontWeight: 500 }}>{p.suffix}</span></p>
                <div style={{ height: 1, background: `${IRIS_COLORS.purpleDeep}40`, margin: '1rem 0' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
                  {p.features.map((f, i) => <li key={i} style={{ fontSize: '0.85rem', color: 'rgba(255,250,245,0.78)', lineHeight: 1.7, marginBottom: '0.4rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}><span style={{ color: p.highlight ? IRIS_COLORS.gold : IRIS_COLORS.hotPink, flexShrink: 0 }}>✦</span><span>{f}</span></li>)}
                </ul>
                <button
                  onClick={() => handlePlan(p.id)}
                  className="iris-plan-cta"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    background: p.highlight
                      ? `linear-gradient(135deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink})`
                      : 'rgba(255,250,245,0.06)',
                    color: '#fff',
                    border: p.highlight ? 'none' : `1px solid ${IRIS_COLORS.purpleDeep}50`,
                    padding: '0.95rem 1rem',
                    borderRadius: 12,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: p.highlight ? `0 10px 30px ${IRIS_COLORS.hotPink}55` : 'none',
                    fontFamily: IRIS_FONTS.body,
                    letterSpacing: '0.02em',
                  }}
                >
                  <span style={{ position: 'relative', zIndex: 2 }}>
                    {p.id === 'studio' ? 'チームでの導入を相談' :
                     p.id === 'pro' ? '👑 Pro を 14 日無料で' :
                     p.id === 'standard' ? '✦ Standard を 14 日無料で (人気)' :
                     '✨ Lite ではじめる (14 日無料)'}
                  </span>
                </button>
                <p style={{
                  textAlign: 'center', fontSize: '0.7rem',
                  color: 'rgba(255,250,245,0.45)', marginTop: '0.55rem',
                  fontFamily: IRIS_FONTS.body, letterSpacing: '0.04em',
                }}>
                  {p.id === 'studio' ? '専任コンサルが伴走' : 'クレカ不要 · いつでも解約'}
                </p>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,250,245,0.45)', marginTop: '1.75rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>年払いで 2 ヶ月分割引 · チームプラン別途相談</p>
        </div>
      </section>

      {/* ── 最終 CTA */}
      <section style={{ padding: '5rem 1.25rem', background: `radial-gradient(ellipse at center, ${IRIS_COLORS.purpleDeep}25 0%, ${IRIS_COLORS.inkBlack} 70%)`, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 50%, ${IRIS_COLORS.hotPink}20 0%, transparent 40%), radial-gradient(circle at 70% 50%, ${IRIS_COLORS.gold}15 0%, transparent 40%)` }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.85rem, 4.5vw, 3rem)', fontWeight: 500, lineHeight: 1.2, marginBottom: '1.25rem' }}>
            あなたの光を、<br />
            <span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>いま、世界へ。</span>
          </h2>
          <p style={{ color: 'rgba(255,250,245,0.6)', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.8, fontFamily: IRIS_FONTS.serif }}>14 日間、すべての機能を無料でお試しできます。</p>
          <button onClick={onEnter} style={ctaBtnHero}>✦ あなたの光をはじめる</button>
        </div>
      </section>

      {/* ── フッタ */}
      <footer style={{ background: '#0a0014', padding: '3rem 1.25rem 2rem', borderTop: `1px solid ${IRIS_COLORS.purpleDeep}30` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <IrisLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,250,245,0.45)', marginTop: '0.75rem', lineHeight: 1.7, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>すべてのインフルエンサーに、<br />エージェント AI を。</p>
          </div>
          <div>
            <p style={footHead}>PRODUCT</p>
            <a href="#facets" style={footLink}>機能</a>
            <a href="#pricing" style={footLink}>料金</a>
            <a href="/" style={footLink}>姉妹ブランド · CORE Prism</a>
          </div>
          <div>
            <p style={footHead}>COMPANY</p>
            <a href="mailto:hello@coreprism.app" style={footLink}>お問い合わせ</a>
            <a href="/?legal=terms" style={footLink}>利用規約</a>
            <a href="/?legal=privacy" style={footLink}>プライバシー</a>
          </div>
          <div>
            <p style={footHead}>CONNECT</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,250,245,0.55)', lineHeight: 1.7, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>世界中のクリエイターが集う場所。<br /><a href="mailto:hello@coreprism.app" style={{ color: IRIS_COLORS.gold, textDecoration: 'none' }}>hello@coreprism.app</a></p>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${IRIS_COLORS.purpleDeep}30`, paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(255,250,245,0.35)', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          © {new Date().getFullYear()} CORE Iris · Aurora for every creator
        </div>
      </footer>
    </div>
  );
}

function IrisAuroraBackdrop() {
  const halos = [
    { color: IRIS_COLORS.gold, x: '20%', y: '30%', size: 600 },
    { color: IRIS_COLORS.hotPink, x: '70%', y: '20%', size: 700 },
    { color: IRIS_COLORS.purpleLt, x: '50%', y: '70%', size: 650 },
    { color: IRIS_COLORS.roseGold, x: '15%', y: '75%', size: 500 },
  ];
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      {halos.map((h, i) => (
        <motion.div key={i} animate={{ x: ['0%', '6%', '-4%', '5%', '0%'], y: ['0%', '-5%', '4%', '-3%', '0%'], opacity: [0.3, 0.55, 0.3] }} transition={{ duration: 18 + i * 3, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', left: h.x, top: h.y, width: h.size, height: h.size, marginLeft: -h.size / 2, marginTop: -h.size / 2, borderRadius: '50%', background: `radial-gradient(circle, ${h.color}55 0%, ${h.color}22 40%, transparent 70%)`, filter: 'blur(60px)' }} />
      ))}

      {/* 中央の光輪リング */}
      <motion.div
        animate={{ scale: [1, 1.3, 1], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute',
          left: '50%', top: '40%',
          width: 320, height: 320,
          marginLeft: -160, marginTop: -160,
          borderRadius: '50%',
          border: `1px solid ${IRIS_COLORS.gold}60`,
          boxShadow: `0 0 80px ${IRIS_COLORS.gold}40, inset 0 0 80px ${IRIS_COLORS.hotPink}30`,
        }}
      />
      <motion.div
        animate={{ scale: [1.1, 1.5, 1.1], opacity: [0.18, 0.3, 0.18] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        style={{
          position: 'absolute',
          left: '50%', top: '40%',
          width: 480, height: 480,
          marginLeft: -240, marginTop: -240,
          borderRadius: '50%',
          border: `1px solid ${IRIS_COLORS.purpleLt}50`,
        }}
      />

      {/* 浮遊する光の粒子 — 5 個、ふわっと縦移動 */}
      {[
        { x: '12%', delay: 0,   color: IRIS_COLORS.gold,     size: 6 },
        { x: '30%', delay: 2.5, color: IRIS_COLORS.hotPink,  size: 4 },
        { x: '52%', delay: 1.2, color: IRIS_COLORS.purpleLt, size: 5 },
        { x: '74%', delay: 3.4, color: IRIS_COLORS.roseGold, size: 4 },
        { x: '88%', delay: 0.8, color: IRIS_COLORS.gold,     size: 6 },
      ].map((p, i) => (
        <motion.div
          key={`particle-${i}`}
          animate={{
            y: ['100%', '-15%'],
            opacity: [0, 0.85, 0.85, 0],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: p.delay,
            times: [0, 0.15, 0.85, 1],
          }}
          style={{
            position: 'absolute',
            left: p.x,
            top: 0, height: '100%',
            width: p.size, marginLeft: -p.size / 2,
            pointerEvents: 'none',
          }}
        >
          <div style={{
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}, 0 0 ${p.size * 8}px ${p.color}80`,
          }} />
        </motion.div>
      ))}
    </div>
  );
}

function IrisLocaleToggle({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  const locales: Locale[] = ['ja', 'en', 'zh'];
  const labels: Record<Locale, string> = { ja: '日', en: 'EN', zh: '中' };
  return (
    <div style={{ display: 'flex', gap: 2, background: 'rgba(255,250,245,0.08)', borderRadius: 8, padding: 2 }}>
      {locales.map(l => (
        <button key={l} onClick={() => setLocale(l)} style={{ background: locale === l ? 'rgba(255,250,245,0.18)' : 'transparent', color: locale === l ? IRIS_COLORS.cream : 'rgba(255,250,245,0.45)', border: 'none', borderRadius: 6, padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}>{labels[l]}</button>
      ))}
    </div>
  );
}

const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(255,250,245,0.7)', textDecoration: 'none', fontWeight: 500 };
const ctaBtnSmall: React.CSSProperties = { background: `linear-gradient(135deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink})`, color: '#fff', padding: '0.55rem 1.1rem', borderRadius: 10, fontSize: '0.85rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: `0 4px 12px ${IRIS_COLORS.hotPink}45` };
const ctaBtnHero: React.CSSProperties = { background: `linear-gradient(135deg, ${IRIS_COLORS.gold} 0%, ${IRIS_COLORS.hotPink} 50%, ${IRIS_COLORS.purpleLt} 100%)`, backgroundSize: '200% 100%', color: '#fff', padding: '1.05rem 2.25rem', borderRadius: 14, fontSize: '1.05rem', fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: `0 12px 36px ${IRIS_COLORS.hotPink}55`, letterSpacing: '0.05em' };
const ctaBtnGhost: React.CSSProperties = { background: 'rgba(255,250,245,0.05)', color: IRIS_COLORS.cream, padding: '1.05rem 2rem', borderRadius: 14, fontSize: '1rem', fontWeight: 700, border: `1px solid ${IRIS_COLORS.gold}40`, textDecoration: 'none', display: 'inline-block' };
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.25em', color: IRIS_COLORS.gold, marginBottom: '0.75rem', fontWeight: 700 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(255,250,245,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };
