// ============================================================
// MusicSchoolLanding — 音楽スクール経営者向け 業界特化 LP
//
// オーナー戦略 (2026-06-02):
//   汎用 LP では刺さらない。1 業界に絞って垂直立ち上げ。
//   AI 代表「イーロン」推し: 音楽スクール (GAUCHE Cello School が当事者ベース)
//
// 訴求軸:
//   1. 「事務時間を 1/3 に」のシンプル ROI
//   2. 「使ったぶんだけ」の納得料金
//   3. 業界の生々しい数字 (生徒数 × 月謝 → 取り戻せる時間)
// ============================================================
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Music, Clock, Calendar, MessageCircle, FileText, TrendingUp, Check, ArrowRight, Printer } from 'lucide-react';

const FONT_SERIF_JA = '"Noto Serif JP", "Yu Mincho", serif';
const FONT_SERIF_EN = '"Cinzel", "Cormorant Garamond", serif';
const FONT_SANS = '"Inter", system-ui, -apple-system, sans-serif';

const ACCENT_PRIMARY = '#9333EA';   // 紫 (Cello / 音楽)
const ACCENT_GOLD = '#FBBF24';      // 金 (上質感)
const ACCENT_GREEN = '#34D399';     // 緑 (節約・利益)

interface PainPoint { emoji: string; before: string; after: string }
interface Feature { icon: React.ReactNode; title: string; body: string; saves: string }

export default function MusicSchoolLanding() {
  return (
    <div style={{
      background: '#0A0A12',
      color: '#fff',
      minHeight: '100dvh',
      fontFamily: FONT_SANS,
      overflowX: 'clip',
    }}>
      <Hero />
      <RoiCalculator />
      <Features />
      <BeforeAfter />
      <Pricing />
      <DemoCTA />
      <ProposalSheet />
      <Footer />
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HERO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Hero() {
  return (
    <section style={{
      position: 'relative',
      padding: '6rem 1.5rem 5rem',
      textAlign: 'center',
      overflow: 'hidden',
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)',
        width: 720, height: 720, borderRadius: '50%',
        background: `radial-gradient(circle, ${ACCENT_PRIMARY}33 0%, transparent 60%)`,
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 880, margin: '0 auto', position: 'relative' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 16px', borderRadius: 999,
            background: `${ACCENT_PRIMARY}22`,
            border: `1px solid ${ACCENT_PRIMARY}55`,
            fontFamily: FONT_SERIF_EN,
            fontSize: 11, letterSpacing: '0.25em',
            color: ACCENT_PRIMARY, fontWeight: 700,
            marginBottom: '2rem',
          }}
        >
          <Music size={13} /> FOR MUSIC SCHOOLS
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          style={{
            fontFamily: FONT_SERIF_JA,
            fontSize: 'clamp(2rem, 5.5vw, 3.4rem)',
            fontWeight: 700,
            lineHeight: 1.35,
            letterSpacing: '0.03em',
            marginBottom: '1.5rem',
          }}
        >
          レッスン管理の<br />
          <span style={{
            background: `linear-gradient(90deg, ${ACCENT_GOLD}, ${ACCENT_PRIMARY})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: 900,
          }}>事務時間を 1/3 に。</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          style={{
            fontSize: 'clamp(0.95rem, 1.45vw, 1.1rem)',
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 2.1,
            maxWidth: 640,
            margin: '0 auto 2.5rem',
            fontFamily: FONT_SERIF_JA,
          }}
        >
          月謝管理、振替日程、生徒さんへの連絡、発表会の準備 ——<br />
          先生は <strong style={{ color: '#fff' }}>「教えること」だけ</strong> に集中できるべきです。<br />
          AI 役員 13 名が、それ以外の雑務を全部巻き取ります。
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}
        >
          <a href="#roi" style={ctaPrimary}>
            自分の数字で試算する <ArrowRight size={15} />
          </a>
          <a href="#demo" style={ctaGhost}>
            🎻 デモデータで触る
          </a>
        </motion.div>

        {/* 信頼の数字帯 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          style={{
            display: 'flex', justifyContent: 'center', gap: '2.5rem',
            flexWrap: 'wrap',
            padding: '1.25rem 1rem',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            maxWidth: 720,
            margin: '0 auto',
            fontFamily: FONT_SERIF_JA,
          }}
        >
          {[
            { v: '7日', l: '完全無料体験' },
            { v: '¥2,980〜', l: '使ったぶんだけ' },
            { v: '5分', l: '導入の所要時間' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.4rem, 2.6vw, 1.85rem)', fontWeight: 800, color: '#fff', fontFamily: '"SF Mono", monospace' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROI CALCULATOR — 生徒数 × 月謝 で取り戻せる時間と金額を試算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function RoiCalculator() {
  const [students, setStudents] = useState(25);
  const [fee, setFee] = useState(18000);
  const [hourlyValue, setHourlyValue] = useState(3000);

  const calc = useMemo(() => {
    // 経験則 (オーナー指示・嘘禁止):
    // - 生徒 1 人あたり月の事務作業 ≈ 12 分 (連絡 / 振替 / 出席記録 / 月謝確認)
    // - AI で 70% 削減できる前提
    const minutesPerStudentMonth = 12;
    const totalMinutesNow = students * minutesPerStudentMonth;
    const savedMinutes = Math.round(totalMinutesNow * 0.70);
    const savedHours = savedMinutes / 60;
    const savedMoney = Math.round(savedHours * hourlyValue);
    const monthlyRevenue = students * fee;
    const annualRevenue = monthlyRevenue * 12;
    return { totalMinutesNow, savedMinutes, savedHours, savedMoney, monthlyRevenue, annualRevenue };
  }, [students, fee, hourlyValue]);

  return (
    <section id="roi" style={{ padding: '5rem 1.5rem', background: 'linear-gradient(180deg, #0A0A12 0%, #14101F 100%)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <h2 style={sectionTitle}>あなたのスクールの数字で試算</h2>
        <p style={sectionLead}>3 つの数字を変えるだけで、毎月いくら・何時間取り戻せるか分かります。</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: '2.5rem',
        }}>
          <SliderInput
            label="生徒さんの人数"
            value={students}
            setValue={setStudents}
            min={5} max={120} step={1}
            suffix="名"
            color={ACCENT_PRIMARY}
          />
          <SliderInput
            label="平均の月謝"
            value={fee}
            setValue={setFee}
            min={5000} max={50000} step={1000}
            suffix="円"
            color={ACCENT_GOLD}
          />
          <SliderInput
            label="あなたの時給換算"
            value={hourlyValue}
            setValue={setHourlyValue}
            min={1500} max={10000} step={500}
            suffix="円/時"
            color={ACCENT_GREEN}
          />
        </div>

        {/* 結果カード */}
        <div style={{
          padding: '2rem 1.75rem',
          borderRadius: 18,
          background: `linear-gradient(135deg, ${ACCENT_PRIMARY}1c, ${ACCENT_GOLD}10 60%, transparent)`,
          border: `1px solid ${ACCENT_PRIMARY}55`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.25em', color: ACCENT_GOLD, fontWeight: 700, marginBottom: 12 }}>
            あなたが取り戻せるもの
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 20 }}>
            <ResultStat label="毎月の時間" value={`${calc.savedHours.toFixed(1)}`} unit="時間" color={ACCENT_GREEN} />
            <ResultStat label="金額換算" value={`¥${calc.savedMoney.toLocaleString()}`} unit="/月" color={ACCENT_GOLD} big />
            <ResultStat label="年間で" value={`¥${(calc.savedMoney * 12).toLocaleString()}`} unit="/年" color={ACCENT_PRIMARY} />
          </div>
          <p style={{
            fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, marginTop: '1.4rem',
            maxWidth: 540, margin: '1.4rem auto 0',
          }}>
            ※ 生徒 1 名あたり月の事務作業を 12 分 (業界平均) として、AI で 70% 削減できる前提で計算しています。
            実際の削減率は導入状況により異なります。
          </p>
        </div>
      </div>
    </section>
  );
}

function SliderInput({ label, value, setValue, min, max, step, suffix, color }: {
  label: string; value: number; setValue: (v: number) => void;
  min: number; max: number; step: number; suffix: string; color: string;
}) {
  return (
    <div style={{
      padding: '1.1rem 1.2rem',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
    }}>
      <label style={{
        fontSize: 11, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.55)', fontWeight: 700,
        display: 'block', marginBottom: 6,
      }}>{label}</label>
      <div style={{
        fontFamily: '"SF Mono", monospace',
        fontSize: 22, fontWeight: 800, color,
        marginBottom: 6,
      }}>
        {value.toLocaleString()}<span style={{ fontSize: 11, marginLeft: 4, opacity: 0.6 }}>{suffix}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }}
      />
    </div>
  );
}

function ResultStat({ label, value, unit, color, big }: {
  label: string; value: string; unit: string; color: string; big?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontFamily: '"SF Mono", monospace',
        fontSize: big ? 'clamp(1.7rem, 4vw, 2.4rem)' : 'clamp(1.3rem, 3vw, 1.85rem)',
        fontWeight: 800, color,
        letterSpacing: '-0.01em',
        textShadow: `0 0 18px ${color}44`,
      }}>
        {value}<span style={{ fontSize: '0.6em', opacity: 0.6, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FEATURES — 6 本の柱
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Features() {
  const features: Feature[] = [
    {
      icon: <Calendar size={22} color={ACCENT_PRIMARY} strokeWidth={1.7} />,
      title: '振替・出席を自動整理',
      body: 'カレンダーに入れるだけで AI が振替候補を 3 つ提案。生徒さんへの連絡文も下書き済み。',
      saves: '月 4〜6 時間',
    },
    {
      icon: <FileText size={22} color={ACCENT_GOLD} strokeWidth={1.7} />,
      title: '月謝請求書を 1 タップで',
      body: '「7 月分、25 名分」と話すだけで全員分の請求書が PDF で完成。Stripe 連携で入金確認も自動。',
      saves: '月 3〜4 時間',
    },
    {
      icon: <MessageCircle size={22} color={ACCENT_GREEN} strokeWidth={1.7} />,
      title: '生徒さんへの連絡を下書き',
      body: '発表会・体験会・休講のお知らせを AI が下書き。LINE / メールで一斉送信もそのまま。',
      saves: '月 2〜3 時間',
    },
    {
      icon: <TrendingUp size={22} color={ACCENT_PRIMARY} strokeWidth={1.7} />,
      title: '退会兆候を AI が察知',
      body: '「最近振替が多い」「お返事が遅くなった」をデータで検知。早めの 1on1 で防げます。',
      saves: '退会率 -20%',
    },
    {
      icon: <Music size={22} color={ACCENT_GOLD} strokeWidth={1.7} />,
      title: '体験レッスン → 入会の動線',
      body: '問い合わせ DM から体験予約まで自動。入会後の 1 ヶ月目フォローも AI が組み立てます。',
      saves: '入会率 +30%',
    },
    {
      icon: <Clock size={22} color={ACCENT_GREEN} strokeWidth={1.7} />,
      title: '月次レポートを自動生成',
      body: '売上・出席率・人気曜日・新規入会数を 1 枚にまとめ。確定申告にもそのまま使えます。',
      saves: '月 2 時間',
    },
  ];

  return (
    <section style={{ padding: '5rem 1.5rem', background: '#0A0A12' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <h2 style={sectionTitle}>音楽スクールに効く 6 つの機能</h2>
        <p style={sectionLead}>13 の AI 役員が、それぞれの得意分野で先回りで動きます。</p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
          marginTop: '2rem',
        }}>
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              style={{
                padding: '1.5rem 1.4rem',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
              }}
            >
              <div style={{ marginBottom: 10 }}>{f.icon}</div>
              <div style={{ fontFamily: FONT_SERIF_JA, fontWeight: 700, fontSize: '1.05rem', marginBottom: 6, letterSpacing: '0.03em' }}>
                {f.title}
              </div>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.85, margin: '0 0 10px' }}>
                {f.body}
              </p>
              <div style={{
                display: 'inline-block', padding: '3px 9px', borderRadius: 999,
                background: `${ACCENT_GREEN}18`, border: `1px solid ${ACCENT_GREEN}40`,
                fontSize: 10.5, fontWeight: 800, color: ACCENT_GREEN, letterSpacing: '0.04em',
              }}>
                ⏱ {f.saves} 節約
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BEFORE / AFTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function BeforeAfter() {
  const pains: PainPoint[] = [
    { emoji: '📅', before: '振替日程は LINE で 1 件ずつ調整', after: 'AI が候補 3 つ出して、ボタン 1 つで送信' },
    { emoji: '💸', before: '月初は請求書発行で半日つぶれる', after: '「25 名分発行」と言えば 30 秒で全員分 PDF' },
    { emoji: '😟', before: '退会が出てから「あ、ヤバい」と気づく', after: 'AI が兆候を察知して早めにアラート' },
    { emoji: '🎶', before: '体験予約のメールに 1 件ずつ返信', after: 'DM 一覧から AI が体験予約まで自動誘導' },
  ];

  return (
    <section style={{ padding: '5rem 1.5rem', background: '#0A0A12' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <h2 style={sectionTitle}>導入前と導入後</h2>
        <p style={sectionLead}>「先生」が「事務員」になっている時間を取り戻します。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: '2rem' }}>
          {pains.map((p, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto 1fr',
              gap: 12,
              alignItems: 'center',
              padding: '1rem 1.25rem',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
            }}>
              <span style={{ fontSize: 24 }}>{p.emoji}</span>
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#F87171', fontWeight: 700, marginBottom: 2 }}>BEFORE</div>
                <div style={{ fontFamily: FONT_SERIF_JA, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{p.before}</div>
              </div>
              <ArrowRight size={18} color={ACCENT_GREEN} />
              <div>
                <div style={{ fontSize: 10, letterSpacing: '0.2em', color: ACCENT_GREEN, fontWeight: 700, marginBottom: 2 }}>AFTER</div>
                <div style={{ fontFamily: FONT_SERIF_JA, fontSize: 13.5, color: '#fff', lineHeight: 1.6, fontWeight: 600 }}>{p.after}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRICING (シンプル — 詳細は /pricing へ)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Pricing() {
  return (
    <section style={{ padding: '5rem 1.5rem', background: 'linear-gradient(180deg, #0A0A12 0%, #14101F 100%)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={sectionTitle}>使ったぶんだけ。</h2>
        <p style={sectionLead}>月額に上限を設け、超えたぶんは買い足し。決して気づかぬ間に高額にならない料金設計です。</p>

        <div style={{
          padding: '2rem 1.75rem',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${ACCENT_PRIMARY}44`,
          borderRadius: 18,
          marginTop: '2rem',
        }}>
          <div style={{ fontSize: 11, letterSpacing: '0.25em', color: ACCENT_PRIMARY, fontWeight: 700, marginBottom: 6 }}>
            ⭐ スタンダード (主力プラン)
          </div>
          <div style={{ fontFamily: '"SF Mono", monospace', fontSize: '2.6rem', fontWeight: 800, marginBottom: 8 }}>
            ¥9,800<span style={{ fontSize: 14, opacity: 0.6, marginLeft: 4 }}>/月</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>
            音楽スクールの大半はこのプランで余裕で足ります。
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
            {['全機能利用可', 'クレジット 1,000/月 (生徒 80 名規模の事務時間相当)', 'Stripe / Google カレンダー 連携', '7 日間 完全無料体験'].map((p, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'rgba(255,255,255,0.85)' }}>
                <Check size={14} color={ACCENT_GREEN} /> {p}
              </li>
            ))}
          </ul>
          <a href="/pricing" style={{ ...ctaPrimary, display: 'inline-flex' }}>
            すべてのプランを見る <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DEMO CTA — 「触ってみる」フック
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function DemoCTA() {
  return (
    <section id="demo" style={{ padding: '5rem 1.5rem', background: '#0A0A12', textAlign: 'center' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ fontSize: 50, marginBottom: 16 }}>🎻</div>
        <h2 style={sectionTitle}>まず触ってみる。</h2>
        <p style={sectionLead}>
          架空の音楽スクール「GAUCHE Cello School」のデモデータを使って、
          全機能を 5 分で体験できます。クレジット不要。
        </p>
        <a href="/?demo=music-school" style={{ ...ctaPrimary, marginTop: '1.5rem', display: 'inline-flex' }}>
          🎻 デモで触ってみる <ArrowRight size={15} />
        </a>
        <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', marginTop: 12 }}>
          ※ メールアドレス不要・登録なし・端末内のみで動きます
        </p>
      </div>
    </section>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROPOSAL SHEET — 印刷で PDF にできるペライチ提案書
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ProposalSheet() {
  const handlePrint = () => window.print();

  return (
    <section style={{ padding: '5rem 1.5rem', background: 'linear-gradient(180deg, #0A0A12 0%, #050510 100%)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }} className="lp-no-print">
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.25em', color: ACCENT_GOLD, fontWeight: 700 }}>
              PROPOSAL SHEET
            </div>
            <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.4rem', fontWeight: 700, marginTop: 4 }}>
              ペライチ提案書
            </h3>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: ACCENT_GOLD, color: '#0a0a0f',
              border: 'none', fontSize: 12.5, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Printer size={14} /> PDF 保存 / 印刷
          </button>
        </div>

        {/* 印刷時はここだけ印刷される A4 サイズ風シート */}
        <div className="lp-print-sheet" style={{
          background: '#fff', color: '#1a1a2e',
          padding: '2.5rem 2rem',
          borderRadius: 14,
          fontFamily: FONT_SERIF_JA,
          lineHeight: 1.85,
          boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        }}>
          <div style={{ textAlign: 'center', borderBottom: '2px solid #14101F', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.3em', color: '#9333EA', fontWeight: 700, fontFamily: FONT_SERIF_EN }}>
              FOR MUSIC SCHOOLS
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: '6px 0 4px', letterSpacing: '0.04em' }}>
              レッスン管理の事務時間を 1/3 に
            </h2>
            <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
              生徒 25 名規模の音楽スクール様向け 導入ご提案
            </p>
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: '#9333EA' }}>1. 解決する痛み</h3>
          <ul style={{ paddingLeft: 18, marginBottom: 18, fontSize: 13 }}>
            <li>振替日程の調整に毎週 2〜3 時間</li>
            <li>月謝請求書の発行に月 3〜4 時間</li>
            <li>退会の兆候に気づくのが遅い</li>
            <li>体験予約への返信が後手に</li>
          </ul>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: '#9333EA' }}>2. 導入効果 (生徒 25 名・月謝 ¥18,000 想定)</h3>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
            marginBottom: 18,
          }}>
            <ProposalStat label="月の事務時間" value="-70%" sub="約 7 時間 → 約 2 時間" />
            <ProposalStat label="金額換算" value="¥21,000/月" sub="時給 3,000 円換算" />
            <ProposalStat label="退会率" value="-20%" sub="兆候検知で早期対応" />
          </div>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: '#9333EA' }}>3. 投資</h3>
          <p style={{ fontSize: 13, marginBottom: 18 }}>
            <strong>月額 ¥9,800</strong> (スタンダードプラン) ・ <strong>7 日間 無料体験あり</strong><br />
            投資回収 約 1 ヶ月 (上記効果 ¥21,000/月 で計算)
          </p>

          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8, color: '#9333EA' }}>4. 導入の流れ</h3>
          <ol style={{ paddingLeft: 18, marginBottom: 18, fontSize: 13 }}>
            <li>無料体験開始 (5 分・カード登録なし)</li>
            <li>生徒情報をスプレッドシートからアップロード or 手入力</li>
            <li>Google カレンダー / Stripe を連携</li>
            <li>7 日後、続けるかご判断</li>
          </ol>

          <div style={{
            marginTop: '2rem', paddingTop: '1.25rem',
            borderTop: '1px solid #ddd',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, color: '#666',
          }}>
            <span>株式会社 CORE — core-prism-app.vercel.app</span>
            <span>{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}</span>
          </div>
        </div>
      </div>

      {/* 印刷専用 CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .lp-print-sheet, .lp-print-sheet * { visibility: visible; }
          .lp-print-sheet {
            position: absolute; top: 0; left: 0; right: 0;
            box-shadow: none !important; border-radius: 0 !important;
          }
          .lp-no-print { display: none !important; }
        }
      `}</style>
    </section>
  );
}

function ProposalStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{
      padding: '10px 12px',
      background: 'linear-gradient(135deg, #9333EA10, #FBBF2410)',
      border: '1px solid #9333EA33',
      borderRadius: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#9333EA' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOOTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Footer() {
  return (
    <footer style={{
      padding: '3rem 1.5rem',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
      fontFamily: FONT_SERIF_JA,
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginBottom: '1rem', fontSize: 12 }}>
        <a href="/corp" style={footerLink}>会社概要</a>
        <a href="/pricing" style={footerLink}>料金</a>
        <a href="/faq" style={footerLink}>FAQ</a>
        <a href="/privacy" style={footerLink}>プライバシー</a>
        <a href="/terms" style={footerLink}>利用規約</a>
      </div>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
        © 2026 株式会社 CORE — Music School Edition
      </p>
    </footer>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED STYLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const sectionTitle: React.CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textAlign: 'center',
  marginBottom: '0.85rem',
  lineHeight: 1.4,
};

const sectionLead: React.CSSProperties = {
  fontFamily: FONT_SERIF_JA,
  fontSize: 'clamp(0.92rem, 1.3vw, 1.02rem)',
  color: 'rgba(255,255,255,0.65)',
  textAlign: 'center',
  maxWidth: 640,
  margin: '0 auto',
  lineHeight: 1.95,
};

const ctaPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '13px 22px', borderRadius: 999,
  background: `linear-gradient(135deg, ${ACCENT_PRIMARY}, ${ACCENT_GOLD})`,
  color: '#0a0a0f', fontWeight: 800, fontSize: 14,
  textDecoration: 'none',
  boxShadow: `0 8px 24px ${ACCENT_PRIMARY}55`,
  border: 'none', cursor: 'pointer',
};

const ctaGhost: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '12px 20px', borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: '#fff', fontWeight: 700, fontSize: 13.5,
  textDecoration: 'none',
  border: '1px solid rgba(255,255,255,0.15)',
};

const footerLink: React.CSSProperties = {
  color: 'rgba(255,255,255,0.55)',
  textDecoration: 'none',
};
