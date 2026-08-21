// ============================================================
// TransformSections — CORE を「AI Transformation Company」として語る章
//
// 2026-08-21 オーナー指示による全面再定義。
//   売っているのは AI ではなく、企業の変化。
//   見た目は既存の金×黒・明朝・静かな余白をそのまま踏襲し、
//   事業内容だけを次の段階へ進める。
//
// 演出は fade / slide / smooth reveal のみ（0.9s）。
// 1秒未満の速い派手な動きは使わない。
// ============================================================
import type { ReactNode } from 'react';
import { Suspense, lazy, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FONT_DISPLAY, FONT_SERIF_JA, FONT_SERIF_EN, FONT_SANS,
  GOLD, GOLD_LIGHT, TEXT_BODY, TEXT_MUTED,
  sectionLabel, sectionLabelMain, sectionLabelSub, sectionH2, sectionLead,
  quietCard, stepNumber, ctaHero, ctaGhost, reveal,
} from './corpTheme';
import {
  SERVICE_LAYERS, DIFF_GENERIC, DIFF_CORE, COMPANY_OS_NODES,
  ASSESSMENT_TARGETS, ASSESSMENT_STEPS, USE_CASES, AI_NATIVE_STEPS,
  TECH_GROUPS, BIZDEV_ITEMS, PARTNER_TARGETS, PARTNER_FORMS,
  INVESTMENT_TIERS, CORE_NUMBERS,
  ENGAGEMENT_STEPS, ENGAGEMENT_TERMS, SECURITY_ITEMS, CORP_FAQ, INDUSTRY_NEXT,
} from './transformData';
import { VERTICALS } from '../vertical/verticalData';
import { useIsMobile } from './useIsMobile';

// 実3Dの図。three.js は重いので、この章に来て初めて読み込む。
// 読み込み中・WebGL が無い環境では、下の SVG 版がそのまま出る。
const CompanyOsScene = lazy(() => import('./CompanyOsScene'));

type AnchorHandler = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => void;

// ── 章の共通の器 ──────────────────────────────────
function Section({
  id, background, children, labelJa, labelEn, title, lead, narrow,
}: {
  id: string;
  background: string;
  children?: ReactNode;
  labelJa: string;
  labelEn: string;
  title: ReactNode;
  lead?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <section id={id} className="lp-section-pad" style={{ padding: '7rem 1.5rem', background, scrollMarginTop: 70 }}>
      <div style={{ maxWidth: narrow ? 900 : 1180, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <p style={sectionLabel}>
            <span style={sectionLabelMain}>{labelJa}</span>
            <span style={sectionLabelSub}>{labelEn}</span>
          </p>
          <motion.h2 {...reveal} style={sectionH2}>{title}</motion.h2>
          {lead && <p style={sectionLead}>{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** 章の中の小見出し（英語の副題つき）。 */
function Kicker({ en }: { en: string }) {
  return (
    <p style={{
      fontFamily: FONT_SERIF_EN, fontStyle: 'italic', fontSize: 'clamp(0.85rem, 1.3vw, 1rem)',
      color: 'rgba(240,233,216,0.5)', letterSpacing: '0.1em', textAlign: 'center', marginTop: '0.9rem',
    }}>
      {en}
    </p>
  );
}

/** 業務の流れ（A → B → C）。狭い画面では縦に折れる。 */
function FlowChain({ steps, accent }: { steps: string[]; accent: string }) {
  return (
    <div className="corp-chain">
      {steps.map((s, i) => (
        <span key={s} className="corp-chain-item">
          <span className="corp-chain-chip" style={{ borderColor: `${accent}55`, color: '#F1E6CE' }}>{s}</span>
          {i < steps.length - 1 && <span aria-hidden className="corp-chain-arrow" style={{ color: accent }}>→</span>}
        </span>
      ))}
    </div>
  );
}

// ============================================================
//  02 CORE Philosophy（ホームの短い版）
// ============================================================
export function PhilosophyLead({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <section
      id="philosophy"
      className="lp-section-pad"
      style={{ padding: '7rem 1.5rem', background: 'linear-gradient(180deg,#050505 0%,#0a0805 100%)', scrollMarginTop: 70 }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <p style={sectionLabel}>
          <span style={sectionLabelMain}>思&nbsp;想</span>
          <span style={sectionLabelSub}>PHILOSOPHY</span>
        </p>
        <motion.h2 {...reveal} style={{ ...sectionH2, lineHeight: 1.75 }}>
          技術は変わる。
          <br />
          <span style={{
            background: 'linear-gradient(110deg,#F7EAD0,#E7C987 55%,#C9A96E)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900,
          }}>
            核は、変わらない。
          </span>
        </motion.h2>
        <p style={{ ...sectionLead, maxWidth: 640, lineHeight: 2.3 }}>
          AIも、ツールも、いずれ入れ替わります。
          <br />
          けれど、人の役に立つこと。企業が価値を生むこと。
          <br />
          本質的な問題を解決すること。その核は変わりません。
          <br />
          <br />
          CORE は、最新技術を追いかける会社ではなく、
          <br />
          <strong style={{ color: '#F1E6CE', fontWeight: 700 }}>変わらない本質のために、最新技術を使う会社</strong>です。
        </p>
        {onAnchor && (
          <p style={{ marginTop: '2.2rem' }}>
            <a
              href="#mission"
              onClick={e => onAnchor(e, '#mission')}
              /* 単独で置くリンクは指で狙える高さを持たせる（実測 20px だった） */
              style={{
                display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 0.4rem',
                fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: GOLD_LIGHT,
                textDecoration: 'underline', textUnderlineOffset: 4,
              }}
            >
              CORE という会社の核について
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================
//  会社の思想（会社タブの長い版）
// ============================================================
export function PhilosophyCore() {
  return (
    <section
      id="philosophy-core"
      className="lp-section-pad"
      style={{ padding: '7rem 1.5rem', background: 'radial-gradient(120% 90% at 50% 0%, #0d0a05 0%, #050505 70%)', scrollMarginTop: 70 }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <p style={{ ...sectionLabel, alignItems: 'flex-start' }}>
          <span style={sectionLabelMain}>変わらないもの</span>
          <span style={sectionLabelSub}>WHAT STAYS</span>
        </p>
        <motion.h2 {...reveal} style={{ ...sectionH2, lineHeight: 1.7, textAlign: 'left' }}>
          AIブームに、乗るための会社ではありません。
        </motion.h2>
        <div style={{
          fontFamily: FONT_SERIF_JA, color: TEXT_BODY, fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
          lineHeight: 2.5, marginTop: '2rem',
        }}>
          <p style={{ marginBottom: '1.8rem' }}>
            技術は変わります。AIも変わります。ツールも変わります。
            五年前に正しかった構成は、五年後には残っていないかもしれません。
          </p>
          <p style={{ marginBottom: '1.8rem' }}>
            しかし、人の役に立つこと。企業が価値を生むこと。本質的な問題を解決すること。
            <strong style={{ color: '#F1E6CE', fontWeight: 700 }}>その核は、変わりません。</strong>
          </p>
          <p style={{ marginBottom: '1.8rem' }}>
            だから CORE は、流行している技術から話を始めません。
            御社の事業のどこに無理があり、どこに伸びしろがあるのかから始めます。
            その答えとして AI が要らないなら、要らないと申し上げます。
          </p>
          <p>
            「すべての時代の、核となるものを。」
            <br />
            時代が変わっても残るものを作るために、いま最も強い技術を使う。
            それが、この社名の意味です。
          </p>
        </div>
        <p style={{
          fontFamily: FONT_SERIF_EN, fontStyle: 'italic', fontSize: '1rem',
          color: 'rgba(240,233,216,0.5)', letterSpacing: '0.08em', marginTop: '2.4rem',
        }}>
          We use the newest technology for the oldest reasons.
        </p>
      </div>
    </section>
  );
}

// ============================================================
//  03 What We Do — 4階層の概観
// ============================================================
export function WhatWeDo({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <Section
      id="whatwedo"
      background="#070604"
      labelJa="事&nbsp;業"
      labelEn="WHAT&nbsp;WE&nbsp;DO"
      title={<>AIを導入するのではなく、<br />AI前提で会社をつくり直す。</>}
      lead={<>戦略から実装、運用、そして次の事業まで。<br />区切らずに引き受けるので、決めたことがそのまま形になります。</>}
    >
      <div className="corp-grid-2">
        {SERVICE_LAYERS.map((s, i) => (
          <motion.div
            key={s.no}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.08 }}
            style={{ ...quietCard, display: 'flex', flexDirection: 'column', gap: '0.9rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.9rem', flexWrap: 'wrap' }}>
              <span style={{ ...stepNumber, color: s.accent, fontSize: '1.05rem' }}>{s.no}</span>
              {s.soon && (
                <span style={{
                  fontFamily: FONT_DISPLAY, fontSize: '0.58rem', letterSpacing: '0.24em',
                  color: '#0d0b06', background: `linear-gradient(135deg, ${s.accent}, #C9A96E)`,
                  padding: '3px 9px', borderRadius: 999, fontWeight: 700,
                }}>
                  COMING SOON
                </span>
              )}
            </div>
            <div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1rem, 1.6vw, 1.2rem)', letterSpacing: '0.1em', color: '#F1E6CE', fontWeight: 700 }}>
                {s.titleEn}
              </p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.8rem', color: TEXT_MUTED, letterSpacing: '0.12em', marginTop: 4 }}>
                {s.titleJa}
              </p>
            </div>
            <p style={{
              fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.02rem, 1.7vw, 1.22rem)', fontWeight: 700,
              lineHeight: 1.9, color: s.accent, letterSpacing: '0.02em',
            }}>
              {s.copy}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.92rem', color: TEXT_BODY, lineHeight: 2.05 }}>
              {s.body}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {s.items.map(it => (
                <li key={it} style={{
                  fontFamily: FONT_SANS, fontSize: '0.74rem', color: 'rgba(240,233,216,0.78)',
                  border: `1px solid ${s.accent}33`, borderRadius: 999, padding: '5px 11px',
                }}>
                  {it}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {onAnchor && (
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="#services" onClick={e => onAnchor(e, '#services')} style={ctaGhost}>
            サービスの詳細を見る
          </a>
        </div>
      )}
    </Section>
  );
}

// ============================================================
//  開発会社との違い
// ============================================================
export function DifferenceSection() {
  const rows = [
    { label: '一般的な開発会社', steps: DIFF_GENERIC, core: false },
    { label: 'CORE', steps: DIFF_CORE, core: true },
  ];
  return (
    <Section
      id="difference"
      background="linear-gradient(180deg,#050505 0%,#0a0805 100%)"
      labelJa="違&nbsp;い"
      labelEn="THE&nbsp;DIFFERENCE"
      title={<>私たちは、<br />会社そのものをアップデートする。</>}
      lead={<>作って納めることを仕事の終わりにしていません。<br />変わったかどうかが、私たちの成果です。</>}
    >
      <div className="corp-diff">
        {rows.map(r => (
          <motion.div
            key={r.label}
            {...reveal}
            style={{
              ...quietCard,
              padding: 'clamp(1.6rem, 3vw, 2.6rem)',
              border: r.core ? '1px solid rgba(201,169,110,0.55)' : '1px solid rgba(255,255,255,0.09)',
              background: r.core
                ? 'radial-gradient(130% 110% at 80% -10%, #1a1508 0%, #080705 62%)'
                : 'rgba(255,255,255,0.018)',
              boxShadow: r.core ? '0 40px 90px -50px rgba(201,169,110,0.6)' : 'none',
            }}
          >
            <p style={{
              fontFamily: r.core ? FONT_DISPLAY : FONT_SERIF_JA,
              fontSize: r.core ? '1.15rem' : '0.95rem',
              letterSpacing: r.core ? '0.24em' : '0.1em',
              color: r.core ? GOLD_LIGHT : 'rgba(240,233,216,0.6)',
              fontWeight: 700, marginBottom: '1.6rem',
            }}>
              {r.label}
            </p>
            <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {r.steps.map((s, i) => (
                <li key={s} style={{ marginBottom: i < r.steps.length - 1 ? '0.55rem' : 0 }}>
                  <span style={{
                    display: 'block',
                    fontFamily: FONT_SERIF_JA,
                    fontSize: r.core ? 'clamp(1rem, 1.6vw, 1.15rem)' : '0.98rem',
                    fontWeight: r.core ? 700 : 400,
                    color: r.core ? '#F5EAD4' : 'rgba(240,233,216,0.62)',
                    letterSpacing: '0.04em',
                  }}>
                    {s}
                  </span>
                  {i < r.steps.length - 1 && (
                    <span aria-hidden style={{
                      display: 'block', color: r.core ? GOLD : 'rgba(240,233,216,0.28)',
                      fontSize: '0.8rem', lineHeight: 1.6, marginTop: 2,
                    }}>
                      ↓
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </motion.div>
        ))}
      </div>
      <p style={{
        fontFamily: FONT_SERIF_EN, fontStyle: 'italic', textAlign: 'center', marginTop: '3rem',
        fontSize: 'clamp(1rem, 2vw, 1.35rem)', color: 'rgba(240,233,216,0.62)', letterSpacing: '0.06em',
      }}>
        We don’t just build software.
      </p>
    </Section>
  );
}

// ============================================================
//  05 AI COMPANY OS
// ============================================================
function CompanyOsDiagram() {
  const isMobile = useIsMobile('(max-width: 860px)');
  // WebGL が使えない端末では 3D を諦めて、下の SVG / 金の円に戻す。
  const [no3d, setNo3d] = useState(false);

  if (isMobile) {
    // 狭い画面では放射状の図は文字が読めなくなる。
    // 「バラバラの業務が、下の CORE に集まっていく」縦の図に置き換える。
    return (
      <div className={no3d ? 'corp-os-stack' : 'corp-os-stack corp-os-stack-3d'} aria-hidden={false}>
        <div className="corp-os-stack-line" aria-hidden />
        {COMPANY_OS_NODES.map((n, i) => (
          <motion.div
            key={n.label}
            initial={{ opacity: 0, x: i % 2 === 0 ? -18 : 18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: (i % 3) * 0.05 }}
            className="corp-os-node"
          >
            <span className="corp-os-node-label">{n.label}</span>
            <span className="corp-os-node-sub">{n.sub}</span>
          </motion.div>
        ))}
        {/* 業務が集まる先。狭い画面でも、ここだけは立体で見せる。 */}
        {no3d ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="corp-os-center"
          >
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '1.15rem', letterSpacing: '0.3em', color: '#14100a', fontWeight: 800, paddingLeft: '0.3em' }}>
              CORE
            </span>
            <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.68rem', letterSpacing: '0.12em', color: 'rgba(20,16,10,0.72)', fontWeight: 700 }}>
              AI COMPANY OS
            </span>
          </motion.div>
        ) : (
          <Suspense fallback={<div className="corp-os3d corp-os3d-core" aria-hidden />}>
            <CompanyOsScene variant="core" onUnavailable={() => setNo3d(true)} />
          </Suspense>
        )}
      </div>
    );
  }

  if (!no3d) {
    return (
      <Suspense fallback={<CompanyOsSvg />}>
        <CompanyOsScene variant="full" onUnavailable={() => setNo3d(true)} />
      </Suspense>
    );
  }

  return <CompanyOsSvg />;
}

// ── WebGL が無い環境のための平面版（従来の図） ──
function CompanyOsSvg() {
  const cx = 460, cy = 300, rx = 355, ry = 218;
  const nodes = COMPANY_OS_NODES.map((n, i) => {
    const a = (-90 + (360 / COMPANY_OS_NODES.length) * i) * (Math.PI / 180);
    return { ...n, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });

  return (
    <svg viewBox="0 0 920 600" role="img" aria-label="営業・顧客管理・問い合わせ・会議・タスク・契約・請求・マーケティング・経営分析が、中心の CORE につながる図" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <radialGradient id="corpOsGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E7C987" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#E7C987" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="corpOsCore" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F7EAD0" />
          <stop offset="55%" stopColor="#E7C987" />
          <stop offset="100%" stopColor="#C9A96E" />
        </linearGradient>
      </defs>

      <circle cx={cx} cy={cy} r={210} fill="url(#corpOsGlow)" />

      {/* 業務 → CORE の線。ゆっくり引かれる */}
      {nodes.map((n, i) => (
        <motion.line
          key={`l-${n.label}`}
          x1={n.x} y1={n.y} x2={cx} y2={cy}
          stroke={GOLD} strokeWidth={1} strokeOpacity={0.42}
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 1.1, ease: 'easeInOut', delay: 0.25 + i * 0.07 }}
        />
      ))}

      {/* 業務のノード */}
      {nodes.map((n, i) => (
        <motion.g
          key={n.label}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, delay: i * 0.06 }}
        >
          <rect
            x={n.x - 74} y={n.y - 27} width={148} height={54} rx={27}
            fill="rgba(255,255,255,0.045)" stroke="rgba(201,169,110,0.34)" strokeWidth={1}
          />
          <text x={n.x} y={n.y - 3} textAnchor="middle" fill="#F1E6CE" fontSize={16} fontFamily={FONT_SERIF_JA} fontWeight={600} letterSpacing="0.06em">
            {n.label}
          </text>
          <text x={n.x} y={n.y + 15} textAnchor="middle" fill="rgba(240,233,216,0.5)" fontSize={10.5} fontFamily={FONT_SANS} letterSpacing="0.04em">
            {n.sub}
          </text>
        </motion.g>
      ))}

      {/* 中心の CORE */}
      <motion.g
        initial={{ opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        <circle cx={cx} cy={cy} r={84} fill="#050505" stroke="url(#corpOsCore)" strokeWidth={1.6} />
        <circle cx={cx} cy={cy} r={68} fill="none" stroke={GOLD} strokeOpacity={0.28} strokeWidth={1} />
        <text x={cx} y={cy - 4} textAnchor="middle" fill="#F5EAD4" fontSize={26} fontFamily={FONT_DISPLAY} fontWeight={700} letterSpacing="0.24em" dx="0.12em">
          CORE
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill="rgba(201,169,110,0.9)" fontSize={10} fontFamily={FONT_DISPLAY} letterSpacing="0.28em" dx="0.14em">
          AI COMPANY OS
        </text>
      </motion.g>
    </svg>
  );
}

export function CompanyOsSection({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <Section
      id="companyos"
      background="radial-gradient(130% 95% at 50% 0%, #0e0b06 0%, #050505 68%)"
      labelJa="中核商品"
      labelEn="AI&nbsp;COMPANY&nbsp;OS"
      title={<>会社の中に点在する業務を、<br />AIでひとつにつなぐ。</>}
      lead={<>ツールを一つずつ足していくと、つながらない道具が増えるだけです。<br />CORE は、会社全体をAI前提で設計し直します。</>}
    >
      <motion.div {...reveal} style={{ margin: '0 auto', maxWidth: 1000 }}>
        <CompanyOsDiagram />
      </motion.div>

      <div className="corp-grid-3" style={{ marginTop: '3.5rem' }}>
        {[
          { t: '道具ではなく、流れを買う', d: '営業で聞いた内容が、顧客管理・見積・請求・経営分析まで、入力し直しなしで流れます。' },
          { t: '会社の記憶が、資産になる', d: '議事録も、問い合わせも、過去の判断も、AIが参照できる形で残ります。人が辞めても消えません。' },
          { t: '経営者が、直接聞ける', d: '数字の裏側を人に頼まなくても、その場で問い直せます。判断までの時間が短くなります。' },
        ].map((c, i) => (
          <motion.div key={c.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} style={quietCard}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, color: '#F1E6CE', lineHeight: 1.8, marginBottom: '0.7rem' }}>{c.t}</p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: TEXT_BODY, lineHeight: 2.05 }}>{c.d}</p>
          </motion.div>
        ))}
      </div>

      {onAnchor && (
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaHero}>AI・DXについて相談する</a>
        </div>
      )}
    </Section>
  );
}

// ============================================================
//  06 AI Transformation 診断
// ============================================================
export function AssessmentSection({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <Section
      id="assessment"
      background="#070604"
      labelJa="診&nbsp;断"
      labelEn="AI&nbsp;TRANSFORMATION&nbsp;ASSESSMENT"
      title={<>「御社のどこをAI化すべきか」を診断します。</>}
      lead={<>「AIで何ができるか」から始めると、使われない仕組みができます。<br />先に、変えるべき場所を決めます。</>}
    >
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.3em', color: GOLD, marginBottom: '1.1rem' }}>
          SCOPE
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
          {ASSESSMENT_TARGETS.map(t => (
            <li key={t} style={{
              fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: '#F1E6CE',
              border: '1px solid rgba(201,169,110,0.34)', background: 'rgba(201,169,110,0.05)',
              borderRadius: 999, padding: '9px 18px', letterSpacing: '0.06em',
            }}>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="corp-steps">
        {ASSESSMENT_STEPS.map((s, i) => (
          <motion.div
            key={s.no}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.09 }}
            className="corp-step"
          >
            <span style={{ ...stepNumber, fontSize: '1.4rem', display: 'block', marginBottom: '0.7rem' }}>{s.no}</span>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.02rem', fontWeight: 700, color: '#F1E6CE', marginBottom: '0.6rem', letterSpacing: '0.06em' }}>
              {s.title}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: TEXT_BODY, lineHeight: 2 }}>{s.body}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        {...reveal}
        style={{
          marginTop: '3.2rem', textAlign: 'center', padding: 'clamp(2rem, 4vw, 3.2rem)',
          borderRadius: 22, border: '1px solid rgba(201,169,110,0.4)',
          background: 'radial-gradient(140% 120% at 50% -20%, #17120a 0%, #070707 65%)',
        }}
      >
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.72rem', letterSpacing: '0.3em', color: GOLD, marginBottom: '1rem' }}>
          DELIVERABLE
        </p>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.3rem, 2.6vw, 1.9rem)', fontWeight: 700, color: '#F5EAD4', lineHeight: 1.8, marginBottom: '1rem' }}>
          AI Transformation Roadmap
        </p>
        <p style={{ ...sectionLead, maxWidth: 560, marginBottom: '2rem' }}>
          どの業務を、どの順番で、いくらの効果を見込んで変えるか。
          実行できる形の1枚にしてお渡しします。
        </p>
        {onAnchor && (
          <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaHero}>
            AI Transformation診断を相談する
          </a>
        )}
      </motion.div>
    </Section>
  );
}

// ============================================================
//  07 Use Cases
// ============================================================
export function UseCasesSection() {
  return (
    <Section
      id="usecases"
      background="linear-gradient(180deg,#050505 0%,#0a0805 100%)"
      labelJa="実&nbsp;例"
      labelEn="USE&nbsp;CASES"
      title={<>つながると、仕事はこう変わる。</>}
      lead={<>部署ごとに切れていた作業を、ひと続きにした場合の姿です。</>}
    >
      <div className="corp-grid-2">
        {USE_CASES.map((u, i) => (
          <motion.div
            key={u.domainEn}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.08 }}
            style={{ ...quietCard, display: 'flex', flexDirection: 'column', gap: '1.1rem' }}
          >
            <div>
              <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.95rem', letterSpacing: '0.22em', color: u.accent, fontWeight: 700 }}>
                {u.domainEn}
              </p>
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.76rem', color: TEXT_MUTED, letterSpacing: '0.14em', marginTop: 3 }}>
                {u.domainJa}
              </p>
            </div>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.05rem, 1.8vw, 1.3rem)', fontWeight: 700, color: '#F5EAD4', lineHeight: 1.85 }}>
              {u.headline}
            </p>
            <FlowChain steps={u.steps} accent={u.accent} />
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: TEXT_BODY, lineHeight: 2.05 }}>{u.body}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ============================================================
//  01〜04 サービス詳細
// ============================================================
export function ServiceLayersSection() {
  return (
    <Section
      id="services"
      background="#070604"
      labelJa="サービス"
      labelEn="SERVICES"
      title={<>戦略から、事業になるまで。</>}
      lead={<>四つの階層で、企業の変革を一貫して引き受けます。<br />どこか一つだけのご依頼も承ります。</>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
        {SERVICE_LAYERS.map((s, i) => (
          <motion.div
            key={s.no}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.06 }}
            className="corp-layer"
            style={{ ...quietCard, padding: 'clamp(1.8rem, 3.4vw, 3rem)' }}
          >
            <div className="corp-layer-head">
              <span style={{ ...stepNumber, fontSize: 'clamp(2rem, 4.5vw, 3.2rem)', color: s.accent, lineHeight: 1 }}>{s.no}</span>
              <div>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(1.1rem, 2.1vw, 1.5rem)', letterSpacing: '0.1em', color: '#F5EAD4', fontWeight: 700 }}>
                  {s.titleEn}
                </p>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.82rem', color: TEXT_MUTED, letterSpacing: '0.14em', marginTop: 5 }}>
                  {s.titleJa}{s.soon && <span style={{ color: s.accent, marginLeft: '0.8em', letterSpacing: '0.2em', fontFamily: FONT_DISPLAY, fontSize: '0.7rem' }}>COMING SOON</span>}
                </p>
              </div>
            </div>
            <p style={{
              fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.15rem, 2.2vw, 1.55rem)', fontWeight: 700,
              lineHeight: 1.9, color: s.accent, margin: '1.6rem 0 1rem', letterSpacing: '0.03em',
            }}>
              {s.copy}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: TEXT_BODY, lineHeight: 2.2, maxWidth: 760 }}>
              {s.body}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '1.6rem 0 0', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
              {s.items.map(it => (
                <li key={it} style={{
                  fontFamily: FONT_SANS, fontSize: '0.78rem', color: 'rgba(240,233,216,0.8)',
                  border: `1px solid ${s.accent}38`, borderRadius: 999, padding: '6px 13px',
                }}>
                  {it}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ============================================================
//  11 Business Development
// ============================================================
export function BusinessDevSection() {
  return (
    <Section
      id="business-dev"
      background="linear-gradient(180deg,#050505 0%,#0a0805 100%)"
      labelJa="事業開発"
      labelEn="BUSINESS&nbsp;DEVELOPMENT"
      title={<>作るだけではなく、<br />事業にするところまで。</>}
      lead={<>システムができても、売れなければ事業にはなりません。<br />立ち上げの設計と、最初の売上までを一緒に見ます。</>}
    >
      <div className="corp-grid-3">
        {BIZDEV_ITEMS.map((b, i) => (
          <motion.div key={b.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} style={quietCard}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, color: '#F1E6CE', marginBottom: '0.7rem', letterSpacing: '0.04em' }}>
              {b.t}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: TEXT_BODY, lineHeight: 2.05 }}>{b.d}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ============================================================
//  10 Industry AI OS
// ============================================================
export function IndustryOsSection({ onAnchor }: { onAnchor?: AnchorHandler }) {
  // 「すでに5つの業界で作っている」と書きながら、まだ無い7業界を並べていた。
  // 動いているものは VERTICALS から数え、これから広げる領域とは分けて出す。
  return (
    <Section
      id="industry-os"
      background="#070604"
      labelJa="業界OS"
      labelEn="INDUSTRY&nbsp;AI&nbsp;OS"
      title={<>一社の課題解決を、<br />業界全体の仕組みに変える。</>}
      lead={<>受託で得た知見のうち、その業界の誰もが抱えている部分を製品にします。<br />いま {VERTICALS.length} つの業界で、業務そのものを引き受けるAIが動いています。</>}
    >
      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.66rem', letterSpacing: '0.3em', color: GOLD, textAlign: 'center', marginBottom: '1rem' }}>
        IN&nbsp;OPERATION
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', justifyContent: 'center', marginBottom: '2.4rem' }}>
        {VERTICALS.map(v => (
          <span key={v.name} style={{
            display: 'inline-flex', alignItems: 'baseline', gap: '0.6em',
            fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: '#F1E6CE',
            border: '1px solid rgba(201,169,110,0.4)', background: 'rgba(201,169,110,0.06)',
            borderRadius: 999, padding: '10px 20px', letterSpacing: '0.08em',
          }}>
            {v.industryShort}
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: '0.62rem', letterSpacing: '0.16em', color: GOLD }}>{v.name}</span>
          </span>
        ))}
      </div>

      <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.66rem', letterSpacing: '0.3em', color: 'rgba(240,233,216,0.5)', textAlign: 'center', marginBottom: '1rem' }}>
        NEXT
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '2.6rem' }}>
        {INDUSTRY_NEXT.map(t => (
          <span key={t} style={{
            fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', color: TEXT_MUTED,
            border: '1px dashed rgba(201,169,110,0.28)', borderRadius: 999, padding: '9px 18px', letterSpacing: '0.08em',
          }}>
            {t}
          </span>
        ))}
        <span style={{
          fontFamily: FONT_DISPLAY, fontSize: '0.6rem', letterSpacing: '0.24em', color: 'rgba(240,233,216,0.55)',
          border: '1px dashed rgba(201,169,110,0.28)', borderRadius: 999, padding: '9px 14px', fontWeight: 700,
          display: 'inline-flex', alignItems: 'center',
        }}>
          COMING SOON
        </span>
      </div>
      {onAnchor && (
        <div style={{ textAlign: 'center' }}>
          <a href="#vertical" onClick={e => onAnchor(e, '#vertical')} style={ctaGhost}>
            いま動いている業界特化AIを見る
          </a>
        </div>
      )}
    </Section>
  );
}

// ============================================================
//  12 Partner with CORE
// ============================================================
export function PartnerSection({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <Section
      id="partner"
      background="radial-gradient(120% 95% at 50% 0%, #0e0b06 0%, #050505 70%)"
      labelJa="提&nbsp;携"
      labelEn="PARTNER&nbsp;WITH&nbsp;CORE"
      title={<>あなたの顧客に、<br />AIという新しい選択肢を。</>}
      lead={<>すでに信頼関係のある顧客に、AIの提案を持っていけるようにします。<br />設計と実装は CORE が引き受けます。</>}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', marginBottom: '3rem' }}>
        {PARTNER_TARGETS.map(t => (
          <span key={t} style={{
            fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: '#F1E6CE',
            border: '1px solid rgba(201,169,110,0.32)', background: 'rgba(201,169,110,0.05)',
            borderRadius: 999, padding: '9px 18px', letterSpacing: '0.06em',
          }}>
            {t}
          </span>
        ))}
      </div>

      <div className="corp-grid-3">
        {PARTNER_FORMS.map((f, i) => (
          <motion.div key={f.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} style={quietCard}>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.95rem', letterSpacing: '0.16em', color: GOLD_LIGHT, fontWeight: 700, marginBottom: '0.7rem' }}>
              {f.t}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: TEXT_BODY, lineHeight: 2.05 }}>{f.d}</p>
          </motion.div>
        ))}
      </div>

      {onAnchor && (
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaHero}>パートナー提携について相談する</a>
        </div>
      )}
    </Section>
  );
}

// ============================================================
//  08 AI Native Development
// ============================================================
export function AiNativeSection() {
  return (
    <Section
      id="ai-native"
      background="linear-gradient(180deg,#050505 0%,#0a0805 100%)"
      labelJa="開発思想"
      labelEn="AI&nbsp;NATIVE&nbsp;DEVELOPMENT"
      title={<>AIを、開発プロセスそのものに。</>}
      lead={<>AIは補助ツールではなく、工程の中にいます。<br />同じ期間で、より速く、より深く、より多く直せるようにするためです。</>}
    >
      <ol className="corp-native" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {AI_NATIVE_STEPS.map((s, i) => (
          <motion.li
            key={s.en}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.05 }}
            className="corp-native-item"
          >
            <span style={{ ...stepNumber, fontSize: '0.72rem', opacity: 0.8 }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)', letterSpacing: '0.1em', color: '#F5EAD4', fontWeight: 700 }}>
              {s.en}
            </span>
            <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.76rem', color: TEXT_MUTED, letterSpacing: '0.12em' }}>{s.ja}</span>
            <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: TEXT_BODY, lineHeight: 1.95 }}>{s.body}</span>
          </motion.li>
        ))}
      </ol>
      <Kicker en="Not cheaper. Faster, deeper, and improved more often." />
    </Section>
  );
}

// ============================================================
//  12 Technology
// ============================================================
export function TechnologySection() {
  return (
    <Section
      id="technology"
      background="#070604"
      labelJa="技&nbsp;術"
      labelEn="TECHNOLOGY"
      title={<>技術は、目的ではありません。</>}
      lead={<>何を使うかより、それで何が実現するか。<br />用途に対して最適なものを選び、必要がなくなれば替えます。</>}
    >
      <div className="corp-grid-2">
        {TECH_GROUPS.map((g, i) => (
          <motion.div key={g.purpose} {...reveal} transition={{ ...reveal.transition, delay: i * 0.07 }} style={quietCard}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.05rem, 1.8vw, 1.25rem)', fontWeight: 700, color: '#F5EAD4', lineHeight: 1.85, marginBottom: '0.8rem' }}>
              {g.purpose}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: TEXT_BODY, lineHeight: 2.05, marginBottom: '1.3rem' }}>
              {g.body}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {g.tech.map(t => (
                <li key={t} style={{
                  fontFamily: FONT_SANS, fontSize: '0.74rem', letterSpacing: '0.06em',
                  color: 'rgba(240,233,216,0.72)', border: '1px solid rgba(201,169,110,0.24)',
                  borderRadius: 6, padding: '5px 10px',
                }}>
                  {t}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <Kicker en="Technology is a means, not the goal." />
    </Section>
  );
}

// ============================================================
//  14 数字で見る CORE
//  確定値のない項目は value: null。全部 null なら章ごと出さない。
// ============================================================
export function CoreNumbersSection() {
  const shown = CORE_NUMBERS.filter(n => n.value !== null);
  if (shown.length === 0) return null;
  return (
    <Section
      id="numbers"
      background="#050505"
      labelJa="数&nbsp;字"
      labelEn="CORE&nbsp;IN&nbsp;NUMBERS"
      title={<>作ってきたもので、話します。</>}
      lead={<>本番で動いているものだけを数えています。</>}
      narrow
    >
      <div className="corp-grid-3">
        {shown.map((n, i) => (
          <motion.div
            key={n.label}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.08 }}
            style={{ ...quietCard, textAlign: 'center' }}
          >
            <p style={{
              fontFamily: FONT_DISPLAY, fontSize: 'clamp(2.6rem, 6vw, 3.6rem)', fontWeight: 700, lineHeight: 1,
              background: 'linear-gradient(120deg,#F7EAD0,#E7C987 55%,#C9A96E)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {n.value}
            </p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.64rem', letterSpacing: '0.26em', color: GOLD, marginTop: '0.9rem', fontWeight: 600 }}>
              {n.label}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.86rem', color: '#F1E6CE', marginTop: '0.4rem', letterSpacing: '0.06em' }}>
              {n.labelJa}
            </p>
            {n.note && (
              <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.74rem', color: TEXT_MUTED, marginTop: '0.5rem', lineHeight: 1.8 }}>
                {n.note}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

// ============================================================
//  15 投資規模
// ============================================================
export function InvestmentSection({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <Section
      id="investment"
      background="linear-gradient(180deg,#050505 0%,#0a0805 100%)"
      labelJa="ご&nbsp;予&nbsp;算"
      labelEn="INVESTMENT"
      title={<>価格より、価値で決めていただくために。</>}
      lead={<>範囲も期間も会社ごとに違うため、目安だけを置いています。<br />診断のうえで、必要なものだけをお見積りします。</>}
    >
      <div className="corp-grid-3">
        {INVESTMENT_TIERS.map((t, i) => (
          <motion.div
            key={t.name}
            {...reveal}
            transition={{ ...reveal.transition, delay: i * 0.08 }}
            style={{ ...quietCard, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
          >
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.9rem', letterSpacing: '0.16em', color: GOLD_LIGHT, fontWeight: 700 }}>
              {t.name}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.78rem', color: TEXT_MUTED, letterSpacing: '0.1em' }}>{t.nameJa}</p>
            <p style={{
              fontFamily: t.price === 'CUSTOM' ? FONT_DISPLAY : FONT_SERIF_JA,
              fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: '#F5EAD4', letterSpacing: '0.06em', marginTop: '0.4rem',
            }}>
              {t.price}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.76rem', color: TEXT_MUTED, lineHeight: 1.8 }}>{t.note}</p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: TEXT_BODY, lineHeight: 2.05, marginTop: '0.4rem' }}>{t.body}</p>
          </motion.div>
        ))}
      </div>
      <p style={{ ...sectionLead, textAlign: 'center', marginTop: '2.4rem', fontSize: '0.86rem', color: TEXT_MUTED, maxWidth: 640 }}>
        自社プロダクト（Prism・Resonance ほか）単体のご利用は月額数千円から。
        ここに示しているのは、事業そのものを設計し直す伴走型プロジェクトの規模感です。
      </p>
      {onAnchor && (
        <div style={{ textAlign: 'center', marginTop: '2.2rem' }}>
          <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaGhost}>まず診断から相談する</a>
        </div>
      )}
    </Section>
  );
}

// ============================================================
//  進め方・体制（ENGAGEMENT）
//  2026-08-21 追記。「何ができるか」だけでは稟議に持ち込めない。
//  どう進み、誰が出て、いつ止められて、作ったものが誰のものかを先に書く。
// ============================================================
export function EngagementSection({ onAnchor }: { onAnchor?: AnchorHandler }) {
  return (
    <Section
      id="engagement"
      background="radial-gradient(120% 95% at 50% 0%, #0e0b06 0%, #050505 70%)"
      labelJa="進め方"
      labelEn="HOW&nbsp;WE&nbsp;WORK"
      title={<>決めてから動くまでを、<br />見えるようにしておく。</>}
      lead={<>初めてAIに投資する会社ほど、怖いのは金額ではなく「先が見えないこと」です。<br />進み方と、やめ方を、先に決めてから始めます。</>}
    >
      <div className="corp-steps">
        {ENGAGEMENT_STEPS.map((s, i) => (
          <motion.div key={s.no} {...reveal} transition={{ ...reveal.transition, delay: i * 0.07 }} className="corp-step">
            <span style={{ ...stepNumber, fontSize: '1.4rem', display: 'block', marginBottom: '0.7rem' }}>{s.no}</span>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.02rem', fontWeight: 700, color: '#F1E6CE', marginBottom: '0.6rem', letterSpacing: '0.06em' }}>
              {s.title}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: TEXT_BODY, lineHeight: 2 }}>{s.body}</p>
          </motion.div>
        ))}
      </div>

      <div className="corp-grid-3" style={{ marginTop: '3.2rem' }}>
        {ENGAGEMENT_TERMS.map((t, i) => (
          <motion.div key={t.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.05 }} style={quietCard}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.98rem', fontWeight: 700, color: '#F5EAD4', marginBottom: '0.6rem', letterSpacing: '0.06em' }}>
              {t.t}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.88rem', color: TEXT_BODY, lineHeight: 2.05 }}>{t.d}</p>
          </motion.div>
        ))}
      </div>

      <Kicker en="No black box. You can stop, and you keep what we built." />

      {onAnchor && (
        <div style={{ textAlign: 'center', marginTop: '2.4rem' }}>
          <a href="#contact" onClick={e => onAnchor(e, '#contact')} style={ctaGhost}>進め方について相談する</a>
        </div>
      )}
    </Section>
  );
}

// ============================================================
//  機密と安全（SECURITY）
//  取得していない認証は書かない。実際にやっている取り扱いだけを並べる。
// ============================================================
export function SecuritySection() {
  return (
    <Section
      id="security"
      background="#070604"
      labelJa="機密と安全"
      labelEn="SECURITY&nbsp;&amp;&nbsp;CONFIDENTIALITY"
      title={<>会社の中身を預けても、<br />怖くない形にしてから始める。</>}
      lead={<>AIの導入で最後まで残る不安は、精度ではなく「その情報はどこへ行くのか」です。<br />先に、預かり方を決めます。</>}
    >
      <div className="corp-grid-2">
        {SECURITY_ITEMS.map((s, i) => (
          <motion.div key={s.t} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} style={quietCard}>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1rem, 1.6vw, 1.15rem)', fontWeight: 700, color: '#F5EAD4', lineHeight: 1.85, marginBottom: '0.7rem' }}>
              {s.t}
            </p>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: TEXT_BODY, lineHeight: 2.05 }}>{s.d}</p>
          </motion.div>
        ))}
      </div>
      <p style={{ ...sectionLead, textAlign: 'center', marginTop: '2.4rem', fontSize: '0.84rem', color: TEXT_MUTED, maxWidth: 660 }}>
        第三者認証（ISO/Pマークなど）は取得していません。取得していないものを、あるようには書きません。
        御社の情報セキュリティ基準に合わせた運用が必要な場合は、着手前にすり合わせます。
      </p>
    </Section>
  );
}

// ============================================================
//  よくあるご質問（FAQ）— 相談ボタンの前に立ちはだかる不安を、先に外す
// ============================================================
export function FaqSection() {
  return (
    <Section
      id="faq"
      background="linear-gradient(180deg,#050505 0%,#0a0805 100%)"
      labelJa="よくあるご質問"
      labelEn="FAQ"
      title={<>聞きにくいことから、先に。</>}
      lead={<>相談の前に確かめておきたいことを、こちらから書いておきます。</>}
      narrow
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {CORP_FAQ.map((f, i) => (
          <motion.details
            key={f.q}
            {...reveal}
            transition={{ ...reveal.transition, delay: Math.min(i, 5) * 0.05 }}
            className="corp-faq"
            style={quietCard}
          >
            <summary className="corp-faq-q">
              <span style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(0.96rem, 1.6vw, 1.08rem)', fontWeight: 700, color: '#F5EAD4', lineHeight: 1.8 }}>
                {f.q}
              </span>
              <span aria-hidden className="corp-faq-mark" style={{ color: GOLD }}>＋</span>
            </summary>
            <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.9rem', color: TEXT_BODY, lineHeight: 2.1, marginTop: '0.9rem' }}>
              {f.a}
            </p>
          </motion.details>
        ))}
      </div>
    </Section>
  );
}
