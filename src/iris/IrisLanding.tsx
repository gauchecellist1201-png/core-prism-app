// ============================================================
// CORE Iris — Landing
// コンセプト: IRIS = 光彩 / Aurora / Halo
// 「あなたの光が、世界をつくる」 ── 影響力という光を、AI が広げる
// ============================================================
import { motion } from 'framer-motion';
import { Mail, BarChart3, Sparkle, MessageSquare, Palette, UsersRound, Camera, Mic, HeartPulse, Check, ArrowRight, TrendingUp, Clock, Sparkles as SparklesIcon, Sunrise, Zap, Rocket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import IrisHeroDemo from './IrisHeroDemo';
import IrisBloomHero from './IrisBloomHero';
import { useState, useMemo } from 'react';
import { IRIS_COLORS, IRIS_FONTS } from './irisStyle';
import { IrisLogo } from '../components/Logo';
import { useLocale } from '../hooks/useLocale';
import type { Locale } from '../lib/i18n';
import LiveAgentMock from '../components/LiveAgentMock';
import IndustryWeekTimeline from '../components/IndustryWeekTimeline';
import { seedDemoData, setDemoActive, clearDemoData } from '../lib/onboarding';
import CountUp from '../components/CountUp';
import { REFERRAL_BONUS_DAYS } from '../lib/referral';

interface Props {
  onEnter: () => void;
  onSelectPlan?: (planId: string) => void;
}

const sectionPad = '5.5rem 1.25rem';

const FACETS: { Icon: LucideIcon; name: string; desc: string; color: string }[] = [
  { Icon: Mail,         name: '案件',     desc: '受注 → 下書き → 投稿 → レポートまで AI が一気通貫で伴走',           color: IRIS_COLORS.hotPink },
  { Icon: BarChart3,    name: '分析',     desc: 'Instagram アカウント解析 — 投稿時間・反応率・伸びるテーマを学習', color: IRIS_COLORS.purple },
  { Icon: Sparkle,      name: '創作',     desc: 'キャプション・サムネ・OG 画像 — 雰囲気に合わせて即生成',           color: IRIS_COLORS.gold },
  { Icon: MessageSquare, name: '交渉',    desc: '料金交渉ロープレ・媒体資料・ブランド提案文を AI がドラフト',       color: IRIS_COLORS.roseGold },
  { Icon: Palette,      name: 'ブランド', desc: '世界観に合うフォント・カラー・トーンをパーソナル AI が提案',       color: IRIS_COLORS.purpleLt },
  { Icon: UsersRound,   name: '仲間',     desc: '同じ志のクリエイター同士が繋がる、招待制コミュニティ',             color: IRIS_COLORS.pink },
];

// 比較表データ (テーブル/モバイルカードの 2 レイアウトで共用)
const COMPARE_ROWS: { label: string; core: string; mgmt: string; agency: string; self: string }[] = [
  { label: '月額コスト', core: '月 ¥2,980〜', mgmt: '売上の 20〜30%', agency: '月 ¥10〜30 万', self: '¥0 (時間コスト)' },
  { label: '創作の自由度', core: '100% あなたのまま', mgmt: '事務所方針に従う', agency: '世界観の擦り合せ必要', self: '100% 自由' },
  { label: '稼働時間', core: '24h / 365 日', mgmt: '担当者の営業時間', agency: '営業時間のみ', self: 'あなたの時間に依存' },
  { label: '反応速度', core: '10 秒〜数分', mgmt: '数日〜数週間', agency: '1〜数日', self: 'いまの心の状態次第' },
  { label: 'カバー範囲', core: '案件/分析/創作/交渉/ブランド/仲間 (6 領域)', mgmt: 'マネジメント中心', agency: 'SNS 運用のみ', self: 'あなた次第' },
  { label: '導入時間', core: '7 日間 無料 + 5 分', mgmt: 'オーディション → 契約', agency: '商談 → 契約 → 開始', self: '即日' },
];
const COMPARE_COLS: { key: 'core' | 'mgmt' | 'agency' | 'self'; label: string }[] = [
  { key: 'core', label: '★ CORE Iris' },
  { key: 'mgmt', label: '事務所所属' },
  { key: 'agency', label: '運用代行' },
  { key: 'self', label: '自分で全部' },
];

const PLANS = [
  { id: 'lite', name: 'Lite', tag: '創作のはじめに', price: '¥2,980', listPrice: '¥5,960', suffix: '/ 月', features: ['AIキャプション 30回 / 月', '案件管理 (3件まで)', '基本フィルター', 'コミュニティ閲覧'] },
  { id: 'standard', name: 'Standard', tag: '伸びる時期に', price: '¥6,980', listPrice: '¥13,960', suffix: '/ 月', features: ['AIキャプション 無制限', 'Instagram 分析 月10回', 'ストーリー設計 5本/月', '案件交渉サポート', 'コミュニティ投稿'], highlight: true },
  { id: 'pro', name: 'Pro', tag: '事業として育てる', price: '¥12,800', listPrice: '¥25,600', suffix: '/ 月', features: ['Standard 全機能', 'チームメンバー 5名', 'ブランドマッチ 無制限', 'メディアキット PDF', '優先サポート'] },
];

export default function IrisLanding({ onEnter, onSelectPlan }: Props) {
  const { locale, setLocale, t } = useLocale();

  const handlePlan = (id: string) => {
    if (onSelectPlan) onSelectPlan(id);
    else onEnter();
  };

  // 「サンプルで触ってみる」: 既存デモを掃除 → 投入 → 入室 (実物品質体験)
  // Iris は creator プロファイル (@hina_lifestyle 12 ヶ月) を seed
  const handleSampleEnter = () => {
    try {
      clearDemoData();
      seedDemoData({ profile: 'creator' });
      setDemoActive(true);
    } catch { /* quota — そのまま入室 */ }
    onEnter();
  };

  return (
    <div style={{
      background: '#FFFFFF',
      color: '#1F1A2E',
      fontFamily: IRIS_FONTS.body,
      minHeight: '100dvh',
      overflowX: 'hidden',
    }}>
      {/* ── 告知バー (1本に統合: ベータ告知 + 招待特典) ────────────── */}
      <div className="iris-beta-bar" style={{
        background: `linear-gradient(90deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`,
        color: '#fff',
        textAlign: 'center',
        padding: '0.5rem 1rem',
        fontSize: '0.78rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        lineHeight: 1.6,
        position: 'relative',
        zIndex: 60,
      }}>
        <span style={{ whiteSpace: 'nowrap' }}>ベータ公開中 — 7 日間 完全無料</span>{' / '}
        <span style={{ whiteSpace: 'nowrap' }}>クレカ登録不要</span>{' · '}
        <span style={{ whiteSpace: 'nowrap' }}>招待リンク登録でお互い +{REFERRAL_BONUS_DAYS} 日 無料</span>
      </div>

      {/* ── ヘッダ ────────────────────────────── */}
      <header className="lp-safe" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.92)',
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

      {/* ── 1画面目: 全画面ブルームヒーロー(3D浮遊・全サービス統一 2026-07-08) ── */}
      <IrisBloomHero onStart={onEnter} />

      {/* ── HERO */}
      <section className="lp-hero-pad lp-safe" style={{ position: 'relative', padding: '6.5rem 1.25rem 5rem', overflow: 'hidden' }}>
        <IrisAuroraBackdrop />
        <div className="iris-hero-grid" style={{ maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: '3rem', alignItems: 'center' }}>
          {/* ── 左: 文言 + CTA ───────── */}
          <div className="iris-hero-copy">
            <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ fontSize: '0.7rem', letterSpacing: '0.45em', fontWeight: 600, marginBottom: '1.25rem', background: `linear-gradient(90deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              CORE IRIS — AGENT FOR INSTAGRAM CREATORS
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1 }} style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(2.2rem, 5.2vw, 4.6rem)', fontWeight: 500, lineHeight: 1.08, letterSpacing: '-0.01em', marginBottom: '1.25rem' }}>
              <span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold} 0%, ${IRIS_COLORS.hotPink} 50%, ${IRIS_COLORS.purpleLt} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Instagram
              </span> に、
              <br />
              専属マネージャー <span style={{ fontFamily: IRIS_FONTS.body, fontStyle: 'normal', fontWeight: 800 }}>AI</span> を雇おう。
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }} style={{ fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1rem, 1.7vw, 1.25rem)', color: 'rgba(31,26,46,0.72)', lineHeight: 1.8, marginBottom: '2rem', maxWidth: 560 }}>
              DM スクショ → <strong style={{ color: IRIS_COLORS.gold }}>案件登録 30 秒</strong>。<br />
              AI 交渉文、戦略まで全部やる。<strong style={{ color: '#1F1A2E' }}>月 ¥2,980</strong> から。
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.45 }} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onEnter} style={ctaBtnHero} className="iris-hero-cta-primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  7 日間 無料で試す <ArrowRight size={18} strokeWidth={2.6} />
                </span>
              </button>
              <a href="#pricing" style={ctaBtnGhost} className="iris-hero-cta-secondary">価格を見る</a>
            </motion.div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.5)', marginTop: '1.1rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', lineHeight: 1.6 }}>
              7 日間ぜんぶ無料 · クレカ登録不要 · 解約は 1 タップ
            </p>

            {/* 触れるデモ — 「DMスクショ→案件登録30秒」の主張を、その場で体験させる */}
            <IrisHeroDemo onStart={onEnter} />

            <button
              type="button"
              onClick={handleSampleEnter}
              style={{
                marginTop: '0.85rem',
                background: 'transparent',
                color: 'rgba(0,0,0,0.85)',
                border: `1px dashed ${IRIS_COLORS.gold}80`,
                borderRadius: 10,
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: IRIS_FONTS.body,
              }}
            >
              <SparklesIcon size={14} color={IRIS_COLORS.gold} />
              <span>サンプルで触ってみる</span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(0,0,0,0.55)' }}>(架空クリエイターのデータで体験)</span>
            </button>
          </div>

          {/* ── 右: Live AgentTeamMonitor 風モック ───────── */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
            className="iris-hero-mock"
          >
            <LiveAgentMock theme="iris" />
          </motion.div>
        </div>

        {/* ── ヒーロー直下: 3 実例 ───────── */}
        <div className="iris-hero-examples" style={{ maxWidth: 1100, margin: '3.5rem auto 0', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '1rem' }}>
            {([
              {
                Icon: Camera,
                tag: 'DM 案件',
                lead: 'スクショ 1 枚 → 30 秒で案件カード',
                detail: 'PR 依頼 DM のスクショを送るだけ。条件・希望ギャラ・締切まで自動で抽出。',
                color: IRIS_COLORS.hotPink,
              },
              {
                Icon: MessageSquare,
                tag: '交渉',
                lead: '案件カテゴリ → AI が DM 4 トーン',
                detail: '丁寧 / カジュアル / プロ / 断り ── 4 つの返信トーンを Iris が同時にドラフト。',
                color: IRIS_COLORS.gold,
              },
              {
                Icon: TrendingUp,
                tag: '収益',
                lead: 'フォロワーごとの広告単価で月収予測',
                detail: 'あなたのジャンル × フォロワー数で、業界相場から月の見込み収入を試算。',
                color: IRIS_COLORS.purpleLt,
              },
            ] as { Icon: LucideIcon; tag: string; lead: string; detail: string; color: string }[]).map((ex, i) => (
              <motion.div
                key={ex.tag}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                style={{
                  position: 'relative',
                  background: 'rgba(0,0,0,0.04)',
                  border: `1px solid ${ex.color}38`,
                  borderRadius: 16,
                  padding: '1.1rem 1.15rem 1.2rem',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: -50, right: -50, width: 160, height: 160, borderRadius: '50%', background: ex.color, opacity: 0.16, filter: 'blur(50px)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.55rem', position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: `linear-gradient(135deg, ${ex.color}, ${ex.color}cc)`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 6px 14px ${ex.color}55, inset 0 1px 0 rgba(0,0,0,0.2)`,
                  }}>
                    <ex.Icon size={18} color="#fff" strokeWidth={2.3} />
                  </div>
                  <span style={{ fontSize: '0.62rem', letterSpacing: '0.22em', fontWeight: 700, color: ex.color, textTransform: 'uppercase' }}>{ex.tag}</span>
                </div>
                <p style={{ position: 'relative', zIndex: 2, fontSize: '0.98rem', fontWeight: 700, color: '#1F1A2E', marginBottom: '0.4rem', lineHeight: 1.4 }}>{ex.lead}</p>
                <p style={{ position: 'relative', zIndex: 2, fontSize: '0.82rem', color: 'rgba(0,0,0,0.68)', lineHeight: 1.65, fontFamily: IRIS_FONTS.body }}>{ex.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 30 秒の Wow (Before / After) ────────────────────────── */}
      <section id="wow" className="lp-section-pad" style={{
        padding: '5rem 1.25rem 5.5rem',
        background: `linear-gradient(180deg, ${'#FFFFFF'} 0%, #F4ECFB 100%)`,
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
            <p style={{ color: 'rgba(0,0,0,0.65)', fontSize: '0.95rem', fontFamily: IRIS_FONTS.serif, lineHeight: 1.85, maxWidth: 620, margin: '0 auto' }}>
              DM、案件依頼、撮影現場、肌の悩み ── ぜんぶ写真と一言で。<br />
              Iris が読み取って、次の一手まで用意する。
            </p>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem',
            maxWidth: 1080, margin: '0 auto',
          }}>
            {([
              {
                Icon: Camera, tag: 'スクショから',
                before: 'PR 依頼の DM を見たけど、料金交渉が苦手で 3 日寝かせてしまう',
                after: 'スクショを撮って投げる → 媒体資料・希望ギャラ・断り文 3 案を 30 秒で',
                accent: IRIS_COLORS.hotPink,
              },
              {
                Icon: Mic, tag: '声で',
                before: '撮影帰りで疲れてキャプションが書けない、ハッシュタグも考えられない',
                after: '一言だけ吹き込む → 投稿文・ストーリー台本・サムネ案を一括ドラフト',
                accent: IRIS_COLORS.gold,
              },
              {
                Icon: HeartPulse, tag: '美容相談',
                before: '肌が荒れて何を使えばいいかわからない、検索しても情報が多すぎる',
                after: '荒れた肌を撮って一言 → 原因仮説・スキンケア順序・受診目安まで',
                accent: IRIS_COLORS.purpleLt,
              },
            ] as { Icon: LucideIcon; tag: string; before: string; after: string; accent: string }[]).map((c, i) => (
              <motion.div
                key={c.tag}
                className="iris-wow-card"
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                style={{
                  position: 'relative',
                  background: 'rgba(0,0,0,0.045)',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10,
                      background: `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)`,
                      boxShadow: `0 6px 16px ${c.accent}55, inset 0 1px 0 rgba(0,0,0,0.18)`,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <c.Icon size={20} color="#FFFFFF" strokeWidth={2.2} />
                    </div>
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
                      color: 'rgba(0,0,0,0.4)', marginBottom: '0.35rem',
                    }}>
                      BEFORE
                    </p>
                    <p style={{ fontSize: '0.88rem', color: 'rgba(0,0,0,0.62)', lineHeight: 1.6 }}>
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
                    <p style={{ fontSize: '0.92rem', color: '#1F1A2E', lineHeight: 1.7, fontWeight: 500 }}>
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
              無料で Iris を試す
            </button>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.45)', marginTop: '0.85rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
              7 日間無料 · クレカ不要
            </p>
          </div>
        </div>
      </section>

      {/* ── フォロワー → 月収予測 電卓 ────────────────────────────── */}
      <FollowerEarningsCalculator onEnter={onEnter} />

      {/* ── あなたが捨てる時間 ────────────────────────────── */}
      <ReclaimTimeSection onEnter={onEnter} />

      {/* ── 機能 (光彩のファセット) ────────────────────────────── */}
      <section id="facets" className="lp-section-pad" style={{ padding: sectionPad, background: `linear-gradient(180deg, ${'#FFFFFF'} 0%, #FFFFFF 100%)` }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 600, marginBottom: '1rem', color: IRIS_COLORS.gold }}>SIX FACETS OF LIGHT</p>
            <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.85rem, 3.8vw, 2.85rem)', lineHeight: 1.2, fontWeight: 500, marginBottom: '1rem' }}>光は、6 つの色を持つ。</h2>
            <p style={{ color: 'rgba(0,0,0,0.65)', maxWidth: 700, margin: '0 auto', fontSize: '1rem', lineHeight: 1.8, fontFamily: IRIS_FONTS.serif }}>ひとつの輝きを、6 つのエージェントが角度を変えて磨く。<br />戦略・分析・創作・交渉・ブランド・コミュニティ ── 全部、自動で。</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {FACETS.map((f, i) => (
              <motion.div key={f.name} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.35, delay: i * 0.05 }} style={{ position: 'relative', background: 'rgba(0,0,0,0.04)', border: `1px solid ${f.color}30`, borderRadius: 18, padding: '1.75rem 1.5rem', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -50, right: -50, width: 180, height: 180, borderRadius: '50%', background: f.color, opacity: 0.16, filter: 'blur(50px)' }} />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: `linear-gradient(135deg, ${f.color}, ${f.color}cc)`,
                    boxShadow: `0 8px 22px ${f.color}55, inset 0 1px 0 rgba(0,0,0,0.18)`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: '0.85rem',
                  }}>
                    <f.Icon size={26} color="#FFFFFF" strokeWidth={2.2} />
                  </div>
                  <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 500, marginBottom: '0.5rem', color: '#1F1A2E' }}>{f.name}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.7)', lineHeight: 1.7, fontFamily: IRIS_FONTS.body }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REFLECTION */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: `linear-gradient(180deg, #FFFFFF 0%, ${'#FFFFFF'} 100%)` }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 600, marginBottom: '1.5rem', color: IRIS_COLORS.purpleLt }}>REFLECTION</p>
          {/* 白背景に淡goldは読めない → 濃トーン(#B8860B系)から始まる濃色グラデに */}
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.6rem, 3.2vw, 2.4rem)', fontWeight: 500, lineHeight: 1.4, marginBottom: '2rem', background: `linear-gradient(120deg, #B8860B 0%, ${IRIS_COLORS.hotPink} 50%, ${IRIS_COLORS.purple} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            光は、<br />受け取る人がいて<br />初めて、光になる。
          </motion.h2>
          <p style={{ fontFamily: IRIS_FONTS.serif, fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', color: 'rgba(0,0,0,0.6)', lineHeight: 1.9 }}>投稿の数より、誰の心に届いたか。<br />CORE Iris は、あなたの光を <strong style={{ color: IRIS_COLORS.gold }}>必要としている人</strong> へ正確に届ける。</p>
        </div>
      </section>

      {/* ── 導入事例 (USE CASES) — 想定の使われ方 */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: `linear-gradient(180deg, ${'#FFFFFF'} 0%, #F4ECFB 100%)` }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 700, color: IRIS_COLORS.gold, textAlign: 'center', marginBottom: '0.6rem' }}>USE CASES</p>
          <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)', fontWeight: 500, textAlign: 'center', marginBottom: '0.6rem', color: '#1F1A2E' }}>こんな風に <span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>使われています</span></h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.55)', textAlign: 'center', fontFamily: IRIS_FONTS.serif }}>※ 想定シナリオです（実在の利用者の声ではありません）。効果は使い方や環境により異なります。</p>
          <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem' }}>
            {[
              {
                persona: '絵本作家 (Instagram + ECサイト運用)',
                usage: '新作の世界観に合うキャプション・サムネ・OG画像を AI が一気通貫で生成。ファン分析で「次に何を描けば届くか」を毎週学習。',
                result: '世界観を保ったまま、投稿づくりの手間を大きく短縮。分析をもとに「次に描くもの」の判断材料が毎週手に入る。',
              },
              {
                persona: 'インディー音楽アーティスト (リリース運用)',
                usage: '新曲リリース日から逆算して 3 週間分の投稿カレンダーを AI が自動編成。フォロワーの聴く時間帯に合わせた最適配信。',
                result: 'リリースから逆算した投稿計画を、マネージャーなしで一人で回せる。配信は聴かれやすい時間帯へ自動で寄せられる。',
              },
              {
                persona: 'インスタグラマー (案件交渉 + 配信)',
                usage: 'ブランド企業からの DM を AI が読み取り、相場感に基づいた料金提示文を 30 秒で生成。メディア資料も毎月自動更新。',
                result: 'DM から料金提示文まで数十秒。相場感のある提案で、値づけの心理的ハードルを下げられる。',
              },
            ].map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  padding: '1.5rem',
                  background: 'rgba(0,0,0,0.03)',
                  border: `1px solid ${IRIS_COLORS.gold}33`,
                  borderRadius: 16,
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: IRIS_COLORS.hotPink, fontWeight: 800, marginBottom: 10, fontFamily: IRIS_FONTS.body }}>
                  CASE 0{i + 1}
                </div>
                <p style={{ fontFamily: IRIS_FONTS.serif, fontSize: 13.5, fontWeight: 700, color: '#1F1A2E', lineHeight: 1.6, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                  {c.persona}
                </p>
                <div style={{ fontSize: 11, color: IRIS_COLORS.gold, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>使い方</div>
                <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.8)', lineHeight: 1.7, marginBottom: 14, fontFamily: IRIS_FONTS.serif }}>
                  {c.usage}
                </p>
                <div style={{ fontSize: 11, color: IRIS_COLORS.hotPink, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>変わること</div>
                <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.9)', lineHeight: 1.7, marginBottom: 16, fontFamily: IRIS_FONTS.serif, fontWeight: 600 }}>
                  {c.result}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FFFF (2026-06-04): 導入後の典型 1 週間 (Iris 向けにカスタム ステップ) */}
      {/* 白LP上の暗い"導入後の1週間"帯(内部が白文字前提のため暗背景を保つ=デモ帯として映える) */}
      <IndustryWeekTimeline
        accent={IRIS_COLORS.gold}
        bgDark={'#160A20'}
        steps={[
          {
            day: '初日 (Day 1)',
            Icon: Sunrise,
            title: 'Instagram を 1 タップ連携',
            body: 'スクショ or OAuth でアカウントを接続。サンプル投稿が AI に読まれて、世界観の理解が始まります。',
            ai: '「フォロワーの伸びる時間帯を教えて」を AI に頼む',
            outcome: '最適投稿時間 + フォロワー属性の 1 枚レポートを受け取れます',
          },
          {
            day: '3 日目',
            Icon: Zap,
            title: '案件 DM の返信を AI と一緒に',
            body: '受信した DM に対する返信案を Iris が即提案。あなたは「これでいい」と承認 → 送信のみ。',
            ai: '「単価交渉の文面 を 3 案 ください」を AI に',
            outcome: '案件単価 +20%-50% の事例も (想定)。返信が翌日朝まで貯まりません',
          },
          {
            day: '7 日目',
            Icon: Rocket,
            title: '初週終了 — 続けるか判断',
            body: '今週の反応数 / 新規フォロワー / 案件件数を 1 枚で確認。あなたの「自由時間」が増えたか実感できます。',
            ai: '夜のフィードで「今週の Iris が頑張ったこと」を確認',
            outcome: '毎週の投稿づくりが、ぐっと軽くなっているはず',
          },
        ]}
      />

      {/* ── 比較 (COMPARISON) — 他の選択肢との違い */}
      <section className="lp-section-pad" style={{ padding: sectionPad, background: '#F6F7FB' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 700, color: IRIS_COLORS.hotPink, textAlign: 'center', marginBottom: '0.6rem' }}>COMPARISON</p>
          <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)', fontWeight: 500, textAlign: 'center', marginBottom: '0.6rem', color: '#1F1A2E' }}>他の選択肢と <span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>何が違うか</span></h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.55)', textAlign: 'center', fontFamily: IRIS_FONTS.serif }}>「事務所所属」「運用代行」「自分で全部」と比べたときの位置づけ</p>

          {/* デスクトップ/タブレット: 表 (640px 未満はカード縦積みに切替 — 見切れゼロ) */}
          <div className="iris-cmp-tablewrap" style={{ position: 'relative', marginTop: '2.5rem' }}>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="iris-cmp-tbl" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'rgba(0,0,0,0.85)', minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: `1px solid ${IRIS_COLORS.gold}22`, color: 'rgba(0,0,0,0.5)', fontWeight: 600, fontSize: 11, letterSpacing: '0.1em' }}></th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: `2px solid ${IRIS_COLORS.gold}`, background: `linear-gradient(180deg, ${IRIS_COLORS.gold}15, transparent)`, color: IRIS_COLORS.gold, fontWeight: 800, fontSize: 12, letterSpacing: '0.05em' }}>★ CORE Iris</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: `1px solid ${IRIS_COLORS.gold}22`, color: 'rgba(0,0,0,0.5)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>事務所所属</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: `1px solid ${IRIS_COLORS.gold}22`, color: 'rgba(0,0,0,0.5)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>運用代行</th>
                    <th style={{ padding: '12px 10px', textAlign: 'left', borderBottom: `1px solid ${IRIS_COLORS.gold}22`, color: 'rgba(0,0,0,0.5)', fontWeight: 600, fontSize: 11, letterSpacing: '0.05em' }}>自分で全部</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '14px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.55)', fontWeight: 600 }}>{r.label}</td>
                      <td style={{ padding: '14px 10px', borderBottom: `1px solid ${IRIS_COLORS.gold}22`, background: `${IRIS_COLORS.gold}08` }}>
                        <strong style={{ color: '#1F1A2E' }}>{r.core}</strong>
                      </td>
                      <td style={{ padding: '14px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.7)' }}>{r.mgmt}</td>
                      <td style={{ padding: '14px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.7)' }}>{r.agency}</td>
                      <td style={{ padding: '14px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.7)' }}>{r.self}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="iris-cmp-fade" aria-hidden />
          </div>

          {/* モバイル (<640px): カード縦積み — CORE Iris はゴールドグローで圧勝を可視化 */}
          <div className="iris-cmp-cards">
            {COMPARE_COLS.map((col, ci) => (
              <motion.div
                key={col.key}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.35, delay: ci * 0.05 }}
                style={{
                  background: col.key === 'core' ? `linear-gradient(180deg, ${IRIS_COLORS.gold}16, #FFFFFF 45%)` : '#FFFFFF',
                  border: col.key === 'core' ? `1.5px solid ${IRIS_COLORS.gold}` : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: col.key === 'core' ? `0 12px 36px ${IRIS_COLORS.gold}38` : '0 2px 8px rgba(0,0,0,0.03)',
                  borderRadius: 18,
                  padding: '1.05rem 1rem 0.7rem',
                }}
              >
                <p style={{ margin: '0 0 0.55rem', fontSize: col.key === 'core' ? '0.95rem' : '0.85rem', fontWeight: 800, letterSpacing: '0.05em', color: col.key === 'core' ? '#B8730A' : 'rgba(0,0,0,0.55)' }}>
                  {col.label}
                </p>
                <dl style={{ margin: 0 }}>
                  {COMPARE_ROWS.map((r, ri) => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', padding: '0.5rem 0', borderBottom: ri < COMPARE_ROWS.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <dt style={{ fontSize: '0.74rem', color: 'rgba(0,0,0,0.5)', fontWeight: 600, flexShrink: 0 }}>{r.label}</dt>
                      <dd style={{ margin: 0, fontSize: '0.82rem', textAlign: 'right', color: col.key === 'core' ? '#1F1A2E' : 'rgba(0,0,0,0.7)', fontWeight: col.key === 'core' ? 700 : 500, lineHeight: 1.5 }}>{r[col.key]}</dd>
                    </div>
                  ))}
                </dl>
              </motion.div>
            ))}
          </div>

          <style>{`
            .iris-cmp-cards { display: none; }
            .iris-cmp-fade { display: none; }
            @media (max-width: 639px) {
              .iris-cmp-tablewrap { display: none; }
              .iris-cmp-cards { display: grid; gap: 0.85rem; margin-top: 2.25rem; }
            }
            @media (min-width: 640px) and (max-width: 767px) {
              .iris-cmp-fade { display: block; position: absolute; top: 0; right: 0; bottom: 0; width: 40px; background: linear-gradient(90deg, rgba(246,247,251,0), #F6F7FB); pointer-events: none; }
            }
            .iris-cmp-tbl th:first-child, .iris-cmp-tbl td:first-child { position: sticky; left: 0; background: #F6F7FB; z-index: 1; }
          `}</style>
          <p style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', textAlign: 'center', marginTop: 12, lineHeight: 1.7 }}>
            ※ 一般的な相場感の比較。実際のコスト・効果は使い方により変動します。
          </p>
        </div>
      </section>

      {/* ── 価格 */}
      {/* 章扉：実物で語る（雑誌のリズム） */}
      <section style={{ padding: '5.5rem 1.5rem', background: 'linear-gradient(150deg, #0d1022, #151735 55%, #0d1022)' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '2.5rem' }}>
            <div style={{ maxWidth: 460, textAlign: 'left' }}>
              <p style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: 'italic', letterSpacing: '0.32em', textTransform: 'uppercase', color: '#E1306C', fontSize: '0.78rem', margin: 0 }}>Real Output</p>
              <h2 style={{ fontSize: 'clamp(1.5rem, 3.4vw, 2.1rem)', fontWeight: 700, lineHeight: 1.6, letterSpacing: '0.03em', margin: '0.7rem 0 0.9rem', color: '#fff' }}>投稿が、<br />雑誌の表紙になる。</h2>
              <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.92rem', lineHeight: 2, margin: 0 }}>テーマを一行書くだけで、AIが見出し・配色・写真の方向性まで提案。あなたの写真が、指の止まる一枚に変わります。</p>
              <p style={{ color: '#E1306C', fontSize: '0.75rem', letterSpacing: '0.06em', marginTop: '1rem' }}>↑ Iris カバースタジオの実際の出力</p>
            </div>
            <div style={{ flex: '0 0 auto', width: 'min(320px, 78vw)', borderRadius: 18, overflow: 'hidden', border: '1px solid #E1306C44', boxShadow: '0 40px 80px -40px rgba(0,0,0,.9)' }}>
              <img src="/lp/iris-cover.jpg" alt="Irisが実際に生成した投稿カバー" loading="lazy" style={{ width: '100%', display: 'block' }} />
            </div>
        </div>
      </section>

      <section id="pricing" className="lp-section-pad" style={{ padding: sectionPad, background: '#FFFFFF' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 600, marginBottom: '1rem', color: IRIS_COLORS.hotPink }}>PRICING</p>
            <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.85rem, 3.8vw, 2.75rem)', fontWeight: 500, marginBottom: '0.75rem' }}><span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Aurora</span> Plans</h2>
            <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.95rem', fontFamily: IRIS_FONTS.serif }}>すべてのプランで Claude / Gemini を内蔵。API キー不要。</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            {PLANS.map(p => (
              <motion.div key={p.id} whileHover={{ y: -4 }} transition={{ duration: 0.2 }} style={{ position: 'relative', background: p.highlight ? `linear-gradient(180deg, ${IRIS_COLORS.hotPink}25, ${IRIS_COLORS.purpleDeep}15)` : 'rgba(0,0,0,0.03)', border: p.highlight ? `1px solid ${IRIS_COLORS.hotPink}60` : `1px solid ${IRIS_COLORS.purpleDeep}30`, borderRadius: 18, padding: '1.75rem 1.5rem', boxShadow: p.highlight ? `0 16px 48px ${IRIS_COLORS.hotPink}25` : 'none' }}>
                {p.highlight && <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink})`, color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '0.3rem 0.85rem', borderRadius: 999, letterSpacing: '0.15em' }}>人気</div>}
                <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.85rem', color: IRIS_COLORS.gold, marginBottom: '0.5rem' }}>— {p.tag}</p>
                <h3 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: '1.85rem', fontWeight: 500, marginBottom: '0.4rem' }}>{p.name}</h3>
                <p style={{ marginBottom: '0.5rem' }}>
                  {p.listPrice && <span style={{ fontSize: '1rem', color: 'rgba(0,0,0,0.4)', fontWeight: 500, textDecoration: 'line-through', marginRight: '0.5rem', fontFamily: IRIS_FONTS.body }}>{p.listPrice}</span>}
                  <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: IRIS_FONTS.body }}>{p.price}</span>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.5)', fontWeight: 500 }}>{p.suffix}</span>
                </p>
                <div style={{ height: 1, background: `${IRIS_COLORS.purpleDeep}40`, margin: '1rem 0' }} />
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem' }}>
                  {p.features.map((f, i) => <li key={i} style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.78)', lineHeight: 1.7, marginBottom: '0.4rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}><Check size={14} color={p.highlight ? IRIS_COLORS.gold : IRIS_COLORS.hotPink} strokeWidth={2.6} style={{ flexShrink: 0, marginTop: 3 }} /><span>{f}</span></li>)}
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
                      : 'rgba(0,0,0,0.06)',
                    color: p.highlight ? '#fff' : '#1F1A2E',
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
                    {p.id === 'pro' ? 'Pro を 7 日無料で試す' :
                     p.id === 'standard' ? 'Standard を 7 日無料で試す' :
                     'Lite を 7 日無料で試す'}
                  </span>
                </button>
                <p style={{
                  textAlign: 'center', fontSize: '0.7rem',
                  color: 'rgba(0,0,0,0.45)', marginTop: '0.55rem',
                  fontFamily: IRIS_FONTS.body, letterSpacing: '0.04em',
                }}>
                  クレカ不要 · いつでも解約
                </p>
              </motion.div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(0,0,0,0.45)', marginTop: '1.75rem', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>年払いで 2 ヶ月分割引 · チームプラン別途相談</p>
        </div>
      </section>

      {/* ── 最終 CTA */}
      <section style={{ padding: '5rem 1.25rem', background: `radial-gradient(ellipse at center, ${IRIS_COLORS.purpleDeep}25 0%, ${'#FFFFFF'} 70%)`, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 50%, ${IRIS_COLORS.hotPink}20 0%, transparent 40%), radial-gradient(circle at 70% 50%, ${IRIS_COLORS.gold}15 0%, transparent 40%)` }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 760, margin: '0 auto' }}>
          <h2 style={{ fontFamily: IRIS_FONTS.display, fontStyle: 'italic', fontSize: 'clamp(1.85rem, 4.5vw, 3rem)', fontWeight: 500, lineHeight: 1.2, marginBottom: '1.25rem' }}>
            あなたの光を、<br />
            <span style={{ background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink}, ${IRIS_COLORS.purpleLt})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>いま、世界へ。</span>
          </h2>
          <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.8, fontFamily: IRIS_FONTS.serif }}>7 日間、すべての機能を無料でお試しできます。</p>
          <button onClick={onEnter} style={ctaBtnHero}>Iris を試す</button>
        </div>
      </section>

      {/* ── フッタ */}
      <footer style={{ background: '#FFFFFF', padding: '3rem 1.25rem 2rem', borderTop: `1px solid ${IRIS_COLORS.purpleDeep}30` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
          <div>
            <IrisLogo size={28} withWordmark />
            <p style={{ fontSize: '0.8rem', color: 'rgba(0,0,0,0.45)', marginTop: '0.75rem', lineHeight: 1.7, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>すべてのインフルエンサーに、<br />エージェント AI を。</p>
          </div>
          <div>
            <p style={footHead}>PRODUCT</p>
            <a href="#facets" style={footLink} className="lp-tap-link">機能</a>
            <a href="#pricing" style={footLink} className="lp-tap-link">料金</a>
            <a href="/" style={footLink} className="lp-tap-link">姉妹ブランド · CORE Prism</a>
          </div>
          <div>
            <p style={footHead}>COMPANY</p>
            <a href="mailto:hello@coreprism.app" style={footLink} className="lp-tap-link">お問い合わせ</a>
            <a href="/faq" style={footLink} className="lp-tap-link">よくある質問</a>
            <a href="/iris/terms" style={footLink} className="lp-tap-link">利用規約</a>
            <a href="/iris/privacy" style={footLink} className="lp-tap-link">プライバシー</a>
            <a href="/tokushoho" style={footLink} className="lp-tap-link">特商法表記</a>
          </div>
          <div>
            <p style={footHead}>CONNECT</p>
            <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.55)', lineHeight: 1.7, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>世界中のクリエイターが集う場所。<br /><a href="mailto:hello@coreprism.app" style={{ color: '#B8730A', textDecoration: 'none', display: 'inline-block', padding: '12px 0' }}>hello@coreprism.app</a></p>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${IRIS_COLORS.purpleDeep}30`, paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(0,0,0,0.35)', fontFamily: IRIS_FONTS.serif, fontStyle: 'italic' }}>
          © {new Date().getFullYear()} CORE Iris · Aurora for every creator
        </div>
      </footer>
    </div>
  );
}

// ─── フォロワー → 月収予測 電卓 ──────────────────────────────
// オーナー指示: 入力に応じて推定月収。実データではないので「目安です」明示
// レンジ補間: 1k→¥10-30k / 10k→¥80-150k / 100k→¥400-900k
function FollowerEarningsCalculator({ onEnter }: { onEnter: () => void }) {
  const [followers, setFollowers] = useState<number>(10000);

  // 対数補間で連続的に。1k〜100k+ をなめらかに繋ぐ
  const { lo, hi } = useMemo(() => {
    const f = Math.max(100, followers);
    // アンカー: 1k → 10-30k, 10k → 80-150k, 100k → 400-900k
    // 対数空間で log10(followers) を x として線形補間
    const logF = Math.log10(f);
    const anchors = [
      { x: 3, lo: 10000,  hi: 30000  },   // 1k
      { x: 4, lo: 80000,  hi: 150000 },   // 10k
      { x: 5, lo: 400000, hi: 900000 },   // 100k
      { x: 6, lo: 1500000, hi: 4000000 }, // 1M
    ];
    // 最寄り 2 アンカー間で線形補間
    let lo = anchors[0].lo, hi = anchors[0].hi;
    if (logF <= anchors[0].x) {
      const r = f / 1000;
      lo = Math.round(anchors[0].lo * r);
      hi = Math.round(anchors[0].hi * r);
    } else {
      for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i], b = anchors[i + 1];
        if (logF >= a.x && logF <= b.x) {
          const t = (logF - a.x) / (b.x - a.x);
          lo = Math.round(a.lo + (b.lo - a.lo) * t);
          hi = Math.round(a.hi + (b.hi - a.hi) * t);
          break;
        }
        if (logF > anchors[anchors.length - 1].x) {
          const last = anchors[anchors.length - 1];
          lo = last.lo; hi = last.hi;
        }
      }
    }
    return { lo, hi };
  }, [followers]);

  const fmt = (n: number) => {
    if (n >= 10000) return `¥${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}万`;
    return `¥${n.toLocaleString('ja-JP')}`;
  };

  const presets: { label: string; value: number }[] = [
    { label: '1千',  value: 1000 },
    { label: '5千',  value: 5000 },
    { label: '1万',  value: 10000 },
    { label: '5万',  value: 50000 },
    { label: '10万', value: 100000 },
    { label: '50万', value: 500000 },
  ];

  return (
    <section
      id="earnings-calc"
      className="lp-section-pad"
      style={{
        padding: sectionPad,
        background: `linear-gradient(180deg, ${'#FFFFFF'} 0%, #F4ECFB 60%, ${'#FFFFFF'} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 700, marginBottom: '0.9rem', color: IRIS_COLORS.gold }}>
            EARNINGS CALCULATOR
          </p>
          <h2 style={{
            fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
            fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 500, lineHeight: 1.25,
            marginBottom: '0.85rem',
            background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink} 55%, ${IRIS_COLORS.purpleLt})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            あなたの月収、いくらになる?
          </h2>
          <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.92rem', fontFamily: IRIS_FONTS.serif, lineHeight: 1.85 }}>
            フォロワー数を動かすと、業界相場ベースの月収レンジが出ます。
          </p>
        </div>

        <div style={{
          background: 'rgba(0,0,0,0.04)',
          border: `1px solid ${IRIS_COLORS.gold}38`,
          borderRadius: 22,
          padding: '1.75rem 1.5rem 1.85rem',
          boxShadow: `0 24px 70px ${IRIS_COLORS.purpleDeep}55, 0 0 80px ${IRIS_COLORS.hotPink}18`,
        }}>
          {/* スライダー */}
          <label style={{
            display: 'block', fontSize: '0.72rem', letterSpacing: '0.2em', fontWeight: 700,
            color: IRIS_COLORS.gold, marginBottom: '0.55rem',
          }}>
            FOLLOWERS · フォロワー数
          </label>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
            <input
              type="number"
              min={100}
              max={2000000}
              step={100}
              value={followers}
              onChange={(e) => setFollowers(Math.max(100, Math.min(2000000, Number(e.target.value) || 0)))}
              style={{
                flex: '1 1 180px',
                background: 'rgba(0,0,0,0.06)',
                color: '#1F1A2E',
                border: `1px solid ${IRIS_COLORS.purpleDeep}66`,
                borderRadius: 12,
                padding: '0.85rem 1rem',
                fontSize: '1.1rem',
                fontWeight: 700,
                fontFamily: IRIS_FONTS.body,
                outline: 'none',
                minHeight: 52,
              }}
              aria-label="フォロワー数を入力"
            />
            <span style={{ fontSize: '0.9rem', color: 'rgba(0,0,0,0.6)' }}>人</span>
          </div>

          <input
            type="range"
            min={3} max={6.3} step={0.05}
            value={Math.log10(Math.max(100, followers))}
            onChange={(e) => setFollowers(Math.round(Math.pow(10, Number(e.target.value))))}
            style={{
              width: '100%',
              accentColor: IRIS_COLORS.hotPink,
              marginBottom: '0.6rem',
            }}
            aria-label="フォロワー数スライダー"
          />

          {/* プリセット */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {presets.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => setFollowers(p.value)}
                style={{
                  background: followers === p.value
                    ? `linear-gradient(135deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink})`
                    : 'rgba(0,0,0,0.05)',
                  color: followers === p.value ? '#fff' : 'rgba(0,0,0,0.78)',
                  border: followers === p.value ? 'none' : `1px solid ${IRIS_COLORS.purpleDeep}55`,
                  borderRadius: 999,
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minHeight: 40,
                  fontFamily: IRIS_FONTS.body,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* 結果 — 数字はカウントアップ + 更新の瞬間にカードが一瞬発光 (『AIが計算した』感) */}
          <div style={{
            background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink}1f, ${IRIS_COLORS.purpleLt}14)`,
            border: `1px solid ${IRIS_COLORS.hotPink}38`,
            borderRadius: 16,
            padding: '1.25rem 1.1rem 1.35rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <motion.div
              key={`${lo}-${hi}`}
              aria-hidden
              initial={{ opacity: 0.55 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(circle at 50% 42%, ${IRIS_COLORS.gold}4d 0%, ${IRIS_COLORS.hotPink}26 45%, transparent 75%)`,
              }}
            />
            <p style={{
              fontSize: '0.7rem', letterSpacing: '0.25em', fontWeight: 700,
              color: IRIS_COLORS.hotPink, marginBottom: '0.55rem',
              position: 'relative',
            }}>
              MONTHLY EARNINGS · 月収予測レンジ
            </p>
            <p style={{
              fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
              fontSize: 'clamp(1.8rem, 5.5vw, 2.85rem)', fontWeight: 600,
              lineHeight: 1.1, margin: 0, position: 'relative',
              background: `linear-gradient(120deg, ${IRIS_COLORS.goldDeep}, ${IRIS_COLORS.hotPink} 55%, ${IRIS_COLORS.purple})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              <CountUp value={lo} durationMs={340} format={fmt} /> 〜 <CountUp value={hi} durationMs={340} format={fmt} />
            </p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.55)', marginTop: '0.45rem', fontFamily: IRIS_FONTS.body }}>
              / 月 · PR 案件 + ギフティング + アフィリエイト合算の目安
            </p>
          </div>

          <p style={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.48)', marginTop: '0.95rem', lineHeight: 1.65, fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', textAlign: 'center' }}>
            ※ 業界相場ベースの目安です。ジャンル・エンゲージメント率・実績で個別差があります。<br />
            数字は保証ではなく、Iris は「この上限に近づくまで」並走します。
          </p>

          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button onClick={onEnter} style={{
              ...ctaBtnHero,
              fontSize: '0.95rem',
              padding: '0.9rem 1.85rem',
            }}>
              この収入を Iris で目指す <ArrowRight size={16} strokeWidth={2.6} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── あなたが捨てる時間 ──────────────────────────────
// オーナー指示: DM 返信 50 件/月 × 15 分 = 12.5 時間 / コンテンツ企画 20 案/月 × 30 分 = 10 時間
// 合計「毎月 22 時間取り戻せます」
function ReclaimTimeSection({ onEnter }: { onEnter: () => void }) {
  const items: { Icon: LucideIcon; label: string; calc: string; hours: number; color: string }[] = [
    { Icon: MessageSquare, label: 'DM 返信',         calc: '50 件 / 月 × 15 分', hours: 12.5, color: IRIS_COLORS.hotPink },
    { Icon: Sparkle,       label: 'コンテンツ企画',  calc: '20 案 / 月 × 30 分', hours: 10,   color: IRIS_COLORS.gold },
    { Icon: BarChart3,     label: '分析・振り返り',  calc: '週 1 × 30 分',       hours: 2,    color: IRIS_COLORS.purpleLt },
  ];
  const total = items.reduce((s, i) => s + i.hours, 0);

  return (
    <section
      className="lp-section-pad"
      style={{
        padding: '4rem 1.25rem 5rem',
        background: `linear-gradient(180deg, ${'#FFFFFF'} 0%, #F4ECFB 60%, ${'#FFFFFF'} 100%)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '0.7rem', letterSpacing: '0.4em', fontWeight: 700, marginBottom: '0.9rem', color: IRIS_COLORS.purpleLt }}>
            TIME RECLAIMED
          </p>
          <h2 style={{
            fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
            fontSize: 'clamp(1.7rem, 4vw, 2.6rem)', fontWeight: 500, lineHeight: 1.25,
            marginBottom: '0.85rem',
          }}>
            あなたが、いま <span style={{
              background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink} 55%, ${IRIS_COLORS.purpleLt})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>捨てている時間</span>。
          </h2>
          <p style={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.92rem', fontFamily: IRIS_FONTS.serif, lineHeight: 1.85 }}>
            Iris が引き受ける作業を、時間に直してみました。
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          {items.map((it, i) => (
            <motion.div
              key={it.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              style={{
                position: 'relative',
                background: 'rgba(0,0,0,0.04)',
                border: `1px solid ${it.color}38`,
                borderRadius: 18,
                padding: '1.35rem 1.2rem 1.45rem',
                overflow: 'hidden',
              }}
            >
              <div aria-hidden style={{ position: 'absolute', top: -50, right: -50, width: 170, height: 170, borderRadius: '50%', background: it.color, opacity: 0.17, filter: 'blur(50px)' }} />
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 12,
                  background: `linear-gradient(135deg, ${it.color}, ${it.color}cc)`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '0.8rem',
                  boxShadow: `0 6px 16px ${it.color}55, inset 0 1px 0 rgba(0,0,0,0.18)`,
                }}>
                  <it.Icon size={20} color="#fff" strokeWidth={2.3} />
                </div>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1F1A2E', margin: '0 0 0.25rem' }}>
                  {it.label}
                </p>
                <p style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.6)', margin: '0 0 0.7rem', lineHeight: 1.55 }}>
                  {it.calc}
                </p>
                <p style={{
                  fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
                  fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 600,
                  color: it.color, margin: 0, lineHeight: 1,
                }}>
                  {it.hours} 時間
                </p>
                <p style={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.55)', margin: '0.25rem 0 0' }}>
                  / 月
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 合計バナー */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6 }}
          style={{
            background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink}28, ${IRIS_COLORS.purpleLt}1a)`,
            border: `1px solid ${IRIS_COLORS.hotPink}55`,
            borderRadius: 22,
            padding: '1.75rem 1.4rem',
            textAlign: 'center',
            boxShadow: `0 20px 60px ${IRIS_COLORS.hotPink}22`,
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem' }}>
            <Clock size={20} color={IRIS_COLORS.gold} strokeWidth={2.4} />
            <span style={{ fontSize: '0.7rem', letterSpacing: '0.3em', fontWeight: 700, color: IRIS_COLORS.gold }}>
              TOTAL
            </span>
          </div>
          <p style={{
            fontFamily: IRIS_FONTS.display, fontStyle: 'italic',
            fontSize: 'clamp(1.85rem, 5.5vw, 3rem)', fontWeight: 600, lineHeight: 1.15, margin: 0,
          }}>
            毎月 <span style={{
              background: `linear-gradient(120deg, ${IRIS_COLORS.gold}, ${IRIS_COLORS.hotPink} 55%, ${IRIS_COLORS.purpleLt})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{total} 時間</span> 取り戻せます。
          </p>
          <p style={{ fontSize: '0.85rem', color: 'rgba(0,0,0,0.7)', margin: '0.85rem 0 1.25rem', lineHeight: 1.7, fontFamily: IRIS_FONTS.serif }}>
            その時間で、撮影に出かけるか、寝るか、家族と過ごすか ── あなたが決める。
          </p>
          <button onClick={onEnter} style={{
            ...ctaBtnHero,
            fontSize: '0.95rem',
            padding: '0.9rem 1.85rem',
          }}>
            時間を取り戻す <ArrowRight size={16} strokeWidth={2.6} style={{ verticalAlign: 'middle', marginLeft: 6 }} />
          </button>
        </motion.div>
      </div>
    </section>
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
    <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 2 }}>
      {locales.map(l => (
        <button key={l} onClick={() => setLocale(l)} aria-label={`Language: ${l.toUpperCase()}`} style={{ background: locale === l ? 'rgba(0,0,0,0.18)' : 'transparent', color: locale === l ? '#1F1A2E' : 'rgba(0,0,0,0.45)', border: 'none', borderRadius: 6, padding: '0.5rem 0.75rem', minWidth: 44, minHeight: 44, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'background 0.15s, color 0.15s' }}>{labels[l]}</button>
      ))}
    </div>
  );
}

const navLink: React.CSSProperties = { fontSize: '0.85rem', color: 'rgba(0,0,0,0.7)', textDecoration: 'none', fontWeight: 500 };
const ctaBtnSmall: React.CSSProperties = {
  background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink} 0%, ${IRIS_COLORS.purple} 60%, ${IRIS_COLORS.gold} 100%)`,
  color: '#fff', padding: '0.6rem 1.25rem', borderRadius: 999, fontSize: '0.85rem', fontWeight: 700,
  border: 'none', cursor: 'pointer',
  boxShadow: `0 6px 20px ${IRIS_COLORS.hotPink}55`,
  transition: 'transform 0.12s, box-shadow 0.12s',
};
const ctaBtnHero: React.CSSProperties = {
  background: `linear-gradient(135deg, ${IRIS_COLORS.hotPink} 0%, ${IRIS_COLORS.purple} 50%, ${IRIS_COLORS.gold} 100%)`,
  color: '#fff', padding: '1.1rem 2.5rem', borderRadius: 999, fontSize: '1.05rem', fontWeight: 800,
  border: 'none', cursor: 'pointer',
  boxShadow: `0 14px 40px ${IRIS_COLORS.hotPink}60, 0 4px 12px ${IRIS_COLORS.purple}40`,
  letterSpacing: '0.04em',
  transition: 'transform 0.12s, box-shadow 0.12s',
};
const ctaBtnGhost: React.CSSProperties = { background: 'rgba(0,0,0,0.05)', color: '#1F1A2E', padding: '1.05rem 2rem', borderRadius: 14, fontSize: '1rem', fontWeight: 700, border: `1px solid ${IRIS_COLORS.gold}40`, textDecoration: 'none', display: 'inline-block' };
const footHead: React.CSSProperties = { fontSize: '0.7rem', letterSpacing: '0.25em', color: IRIS_COLORS.gold, marginBottom: '0.75rem', fontWeight: 700 };
const footLink: React.CSSProperties = { display: 'block', color: 'rgba(0,0,0,0.7)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '0.5rem' };

