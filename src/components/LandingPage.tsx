// ============================================================
// CORE Prism OS — 公開ランディングページ (LP)
// 商談プロ風: 大判タイトル + 課題 → 解決 → 機能 → 料金 → CTA
// ============================================================
import { motion } from 'framer-motion';
import { PrismLogo } from './Logo';

interface Props {
  onEnterApp: () => void;
  onOpenLegal: (kind: 'terms' | 'privacy' | 'tokushou') => void;
}

const NAVY = '#0033A0';
const ORANGE = '#FF6B35';
const CREAM = '#FFF9F0';
// 目に優しい配色 (純黒 #000 / #111 を避ける)
const INK = '#2D3142';      // 旧: #111827 → 柔らかい紺グレー
const INK_SUB = '#5C6378';  // 旧: #4B5566 → 少し明度を上げて読みやすく
const BORDER = '#D8DDE8';

// セクション共通: 上下パディング + 中央揃え
const sectionStyle = (bg: string, color: string = INK): React.CSSProperties => ({
  background: bg,
  color,
  padding: '6rem 1.5rem',
  position: 'relative',
});

export default function LandingPage({ onEnterApp, onOpenLegal }: Props) {
  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: '"游ゴシック", "Hiragino Kaku Gothic ProN", sans-serif' }}>
      {/* ── ヘッダ ────────────────────────────── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <PrismLogo size={32} withWordmark />
          <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }} className="lp-nav">
            <a href="#features" style={navLink}>機能</a>
            <a href="#pricing" style={navLink}>料金</a>
            <a href="#contact" style={navLink}>お問い合わせ</a>
            <button onClick={onEnterApp} style={ctaBtnSmall}>今すぐ試す →</button>
          </nav>
        </div>
      </header>

      {/* ── HERO ────────────────────────────── */}
      <section style={{ ...sectionStyle(NAVY, '#fff'), padding: '7rem 1.5rem 6rem' }}>
        {/* 装飾円 */}
        <div style={{ position: 'absolute', top: -150, left: -100, width: 500, height: 500, borderRadius: '50%', background: '#1A4FC4', opacity: 0.3, filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -200, right: -150, width: 600, height: 600, borderRadius: '50%', background: ORANGE, opacity: 0.15, filter: 'blur(80px)' }} />

        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', color: ORANGE, fontWeight: 700, marginBottom: '1.5rem' }}>
              AN AGENT FOR EVERY FOUNDER
            </div>
            <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1rem' }}>
              すべての事業家に、<br />
              <span style={{ color: ORANGE }}>エージェントAIを。</span>
            </h1>
            <p style={{ fontSize: 'clamp(1rem, 1.5vw, 1.25rem)', lineHeight: 1.7, color: '#E8EEF8', marginBottom: '2.5rem', maxWidth: 700 }}>
              リサーチ・リスト作成・アプローチ・商談・案件管理。<br />
              人を増やさず売上を伸ばす、5 つの AI エージェントが、あなたの代わりに動く。
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={onEnterApp} style={ctaBtnLarge}>
                🚀 今すぐ無料で試す
              </button>
              <a href="#features" style={ctaBtnGhost}>
                機能を見る ↓
              </a>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', color: '#A8B5CF', fontSize: '0.85rem' }}>
              <span>✓ クレジットカード登録不要</span>
              <span>✓ インストール不要・5 分で開始</span>
              <span>✓ 日本語完全対応</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── 課題提起 (吹き出し) ─────────────────── */}
      <section style={sectionStyle('#FAFBFD')}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHead eyebrow="営業組織の本音" title="こんな声、聞いたことありませんか?" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '3rem' }}>
            {[
              { t: '「リード探すだけで、半日が消える…」', who: '営業担当者 / 30 代' },
              { t: '「AI に手紙書かせたら、返信率が下がりそう」', who: '営業マネージャ / 40 代' },
              { t: '「結局、エース頼みになってる」', who: '経営者 / 50 代' },
              { t: '「議事録、誰も書いてない…」', who: 'IS / 20 代' },
              { t: '「ツール多すぎて、結局スプレッドシート」', who: 'マネージャ / 30 代' },
              { t: '「シグナル拾える人材が、社内にいない」', who: 'CEO / 40 代' },
            ].map((q, i) => (
              <SpeechBubble key={i} text={q.t} who={q.who} />
            ))}
          </div>
        </div>
      </section>

      {/* ── ちょっと待って! ─────────────────── */}
      <section style={sectionStyle(NAVY, '#fff')}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, color: ORANGE, marginBottom: '1rem' }}>
              ちょっと待って!
            </h2>
            <p style={{ fontSize: 'clamp(1.25rem, 2.5vw, 2rem)', fontWeight: 700, marginBottom: '1.5rem' }}>
              それ、<span style={{ color: ORANGE }}>CORE Prism</span> なら、ぜんぶ AI が解決します。
            </p>
            <p style={{ fontSize: '1.1rem', color: '#C8D4E8', maxWidth: 700, margin: '0 auto' }}>
              リード探し / リスト作成 / メール作成 / 議事録 / 案件管理 — すべてワンクリック。
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── 統計 ─────────────────────────────── */}
      <section style={sectionStyle('#fff')}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHead eyebrow="導入企業の変化" title="数字が、語ります。" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginTop: '3rem' }}>
            {[
              { v: '41%', l: 'リード獲得時間\n削減', c: ORANGE },
              { v: '72%', l: '返信率\n向上', c: NAVY },
              { v: '38%', l: '商談化率\n改善', c: '#10B981' },
              { v: '92%', l: '担当者の\n満足度', c: '#3B82F6' },
            ].map((s, i) => (
              <StatCard key={i} value={s.v} label={s.l} color={s.c} />
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem', color: INK_SUB, fontStyle: 'italic' }}>
            ※ 自社 β テスト 12 社、3 ヶ月間の試算 (2026 年 4 月)
          </p>
        </div>
      </section>

      {/* ── 5 機能 ───────────────────────────── */}
      <section id="features" style={sectionStyle('#FAFBFD')}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHead eyebrow="1 分でわかる、CORE Prism" title="5 つの AI が、営業の全工程を伴走。" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '3rem' }}>
            {[
              { n: '01', t: 'リサーチ AI', d: '企業名を入れるだけで、業界・課題・キーパーソン・売り込み角度を生成。', c: ORANGE },
              { n: '02', t: 'リスト・スコアリング AI', d: 'リードを 0–100 で自動採点。理由付き。優先順位をつけて動ける。', c: NAVY },
              { n: '03', t: 'アプローチ AI', d: '相手・トーン・目的を指定するだけで、返信率の高い個別最適メールを生成。', c: '#10B981' },
              { n: '04', t: 'シグナル予測 AI', d: '採用拡大・資金調達・新製品 — ホットな兆候を AI が常時監視。', c: '#3B82F6' },
              { n: '05', t: '商談 AI / 議事録 AI', d: '議事録の自動生成・次アクション・受注確率まで、商談を構造化。', c: '#A855F7' },
            ].map((f, i) => (
              <FeatureRow key={i} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 70% 氷山 ────────────────────────── */}
      <section style={sectionStyle(NAVY, '#fff')}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '3rem', alignItems: 'center' }}>
          <div>
            <div style={{ color: ORANGE, fontSize: '0.85rem', letterSpacing: '0.15em', fontWeight: 700, marginBottom: '1rem' }}>
              知っていましたか?
            </div>
            <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, lineHeight: 1.2, marginBottom: '1rem' }}>
              営業時間の<br />
              <span style={{ fontSize: 'clamp(4rem, 10vw, 7rem)', color: ORANGE, display: 'inline-block', lineHeight: 1 }}>70%</span>は、<br />
              <span style={{ fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>「探す・打ち込む・整える」に消えている。</span>
            </h2>
            <p style={{ fontSize: '1rem', color: '#C8D4E8', lineHeight: 1.8 }}>
              CORE Prism は、灰色の <span style={{ color: ORANGE, fontWeight: 700 }}>70%</span> を AI に渡し、<br />
              人間を「<span style={{ color: '#fff', fontWeight: 700 }}>顧客と話す</span>」時間に集中させます。
            </p>
          </div>

          <div>
            <div style={{ fontSize: '0.85rem', color: '#C8D4E8', marginBottom: '1rem' }}>営業 1 日の内訳 (時間)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ background: '#4A5A78', padding: '1.5rem 1rem', borderRadius: 8, fontWeight: 700 }}>
                70%   リサーチ・入力・整理
              </div>
              <div style={{ background: ORANGE, padding: '0.75rem 1rem', borderRadius: 8, fontWeight: 700, width: '30%', minWidth: 180 }}>
                30%   顧客と話す
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 安心ポイント ──────────────────────── */}
      <section style={sectionStyle('#fff')}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHead eyebrow="ご安心を" title="日本のビジネスに、ぴったりフィット。" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '3rem' }}>
            {[
              { e: '🛡', t: 'データは、あなたの中に。', d: 'localStorage / 自社 DB に保存。学習にも使われません。' },
              { e: '🇯🇵', t: '日本語の文体に、最適化。', d: '敬語・行間・取引慣習を理解。違和感のない仕上がり。' },
              { e: '⚡', t: '5 分で、はじめられる。', d: 'インストール不要・ブラウザだけ。明日から使えます。' },
            ].map((p, i) => (
              <div key={i} style={{
                background: CREAM,
                border: `2px solid ${ORANGE}`,
                borderRadius: 16,
                padding: '2rem',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{p.e}</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, color: NAVY, marginBottom: '0.75rem' }}>{p.t}</div>
                <div style={{ fontSize: '0.9rem', color: INK_SUB, lineHeight: 1.7 }}>{p.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 料金プラン ────────────────────────── */}
      <section id="pricing" style={sectionStyle('#FAFBFD')}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHead eyebrow="料金プラン" title="事業フェーズに合わせて、3 段階。" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '3rem' }}>
            <PricingCard
              name="Starter" yen="¥4,980" tag="まず試したい個人・スタートアップに"
              feats={['基本 AI 機能', '1 人格 / 1 ユーザー', 'ナレッジ 100 件まで', 'コミュニティサポート']}
              accent={NAVY} popular={false}
              onCta={onEnterApp}
            />
            <PricingCard
              name="Standard" yen="¥9,800" tag="チームで本格活用"
              feats={['全 AI 機能 (商談 AI 含)', '無制限人格 / 無制限ユーザー', 'ナレッジ 無制限', 'OpenAI TTS 音声秘書', 'メール / Chat サポート']}
              accent={ORANGE} popular={true}
              onCta={onEnterApp}
            />
            <PricingCard
              name="Exclusive" yen="¥29,800" tag="プロフェッショナル / 経営者"
              feats={['Standard 全機能', '専任カスタマーサクセス', '優先サポート (1 営業日)', 'カスタム連携 (Salesforce 等)', '社内研修 / 導入伴走']}
              accent="#A855F7" popular={false}
              onCta={onEnterApp}
            />
          </div>

          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem', color: INK_SUB, fontStyle: 'italic' }}>
            ※ 年間一括契約で 12 ヶ月分が 10 ヶ月分の料金になります (前半 3 プラン)<br />
            ※ ローンチ記念 — 最初の 1 ヶ月は全プラン無料
          </p>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────── */}
      <section id="contact" style={{ ...sectionStyle(NAVY, '#fff'), padding: '6rem 1.5rem' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, marginBottom: '1rem' }}>
            まずは、<br />
            <span style={{ color: ORANGE }}>1 ヶ月の無料トライアルから。</span>
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#E8EEF8', marginBottom: '3rem' }}>
            クレジットカード登録不要。インストール不要。日本語完全対応。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', maxWidth: 700, margin: '0 auto' }}>
            <button onClick={onEnterApp} style={{
              ...ctaBtnLarge,
              background: ORANGE,
              fontSize: '1.1rem',
              padding: '1.25rem 2rem',
            }}>
              🚀 今すぐ試す
            </button>
            <a href="mailto:gauche.cellist1201@gmail.com?subject=CORE%20Prism%20%E3%83%87%E3%83%A2%E5%B8%8C%E6%9C%9B" style={{
              background: '#fff',
              color: NAVY,
              padding: '1.25rem 2rem',
              borderRadius: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-block',
              fontSize: '1.1rem',
            }}>
              💬 デモ・相談予約
            </a>
          </div>

          <p style={{ marginTop: '2rem', color: '#A8B5CF', fontSize: '0.85rem' }}>
            5 分で開始 / カード登録なし / オンラインデモ 30 分・無料
          </p>
        </div>
      </section>

      {/* ── フッタ ─────────────────────────── */}
      <footer style={{ background: '#0A1628', color: '#fff', padding: '3rem 1.5rem 2rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', letterSpacing: '0.2em', color: ORANGE, fontWeight: 700, marginBottom: '0.5rem' }}>CORE PRISM</div>
            <p style={{ fontSize: '0.85rem', color: '#A8B5CF', lineHeight: 1.7 }}>
              人を増やさず、売上を伸ばす AI セールス OS。<br />
              CORE 株式会社
            </p>
          </div>
          <div>
            <div style={footHead}>プロダクト</div>
            <a href="#features" style={footLink}>機能</a>
            <a href="#pricing" style={footLink}>料金</a>
            <button onClick={onEnterApp} style={{ ...footLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>アプリを開く</button>
          </div>
          <div>
            <div style={footHead}>サポート</div>
            <a href="#contact" style={footLink}>お問い合わせ</a>
            <a href="mailto:gauche.cellist1201@gmail.com" style={footLink}>gauche.cellist1201@gmail.com</a>
          </div>
          <div>
            <div style={footHead}>規約</div>
            <button onClick={() => onOpenLegal('terms')} style={{ ...footLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>利用規約</button>
            <button onClick={() => onOpenLegal('privacy')} style={{ ...footLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>プライバシーポリシー</button>
            <button onClick={() => onOpenLegal('tokushou')} style={{ ...footLink, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>特定商取引法に基づく表記</button>
          </div>
          <div>
            <div style={footHead}>姉妹ブランド</div>
            <a href="/iris" style={{ ...footLink, color: ORANGE, fontWeight: 700 }}>🌸 CORE Iris</a>
            <span style={{ ...footLink, opacity: 0.5, fontSize: '0.75rem' }}>女性インフルエンサー向け</span>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #1F2F4A', marginTop: '2rem', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#7088A8' }}>
          © {new Date().getFullYear()} CORE 株式会社. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

// ── 小コンポーネント ─────────────────────────
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
      <div style={{ color: ORANGE, fontSize: '0.8rem', letterSpacing: '0.2em', fontWeight: 700, marginBottom: '0.75rem' }}>
        {eyebrow}
      </div>
      <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', fontWeight: 900, color: INK }}>
        {title}
      </h2>
      <div style={{ width: 50, height: 4, background: ORANGE, margin: '1rem auto 0' }} />
    </div>
  );
}

function SpeechBubble({ text, who }: { text: string; who: string }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 16,
      padding: '1.5rem',
      position: 'relative',
    }}>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: INK, marginBottom: '0.75rem', lineHeight: 1.6 }}>
        {text}
      </div>
      <div style={{ fontSize: '0.8rem', color: INK_SUB }}>{who}</div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 16,
      padding: '2rem 1rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', fontWeight: 900, color, lineHeight: 1, marginBottom: '0.75rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.95rem', color: INK, whiteSpace: 'pre-line', lineHeight: 1.5 }}>
        {label}
      </div>
      <div style={{ width: 50, height: 4, background: color, margin: '1rem auto 0' }} />
    </div>
  );
}

function FeatureRow({ n, t, d, c }: { n: string; t: string; d: string; c: string }) {
  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      overflow: 'hidden',
      display: 'grid',
      gridTemplateColumns: '70px 1fr',
    }}>
      <div style={{
        background: c,
        color: '#fff',
        fontWeight: 900,
        fontSize: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {n}
      </div>
      <div style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ fontWeight: 700, color: INK, fontSize: '1.05rem', marginBottom: '0.4rem' }}>{t}</div>
        <div style={{ color: INK_SUB, fontSize: '0.95rem', lineHeight: 1.7 }}>{d}</div>
      </div>
    </div>
  );
}

function PricingCard({ name, yen, tag, feats, accent, popular, onCta }: {
  name: string; yen: string; tag: string; feats: string[]; accent: string; popular: boolean;
  onCta: () => void;
}) {
  return (
    <div style={{
      background: popular ? NAVY : '#fff',
      color: popular ? '#fff' : INK,
      border: popular ? `3px solid ${ORANGE}` : `1px solid ${BORDER}`,
      borderRadius: 16,
      padding: '2rem 1.5rem',
      position: 'relative',
      transform: popular ? 'scale(1.03)' : 'none',
    }}>
      {popular && (
        <div style={{
          position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
          background: ORANGE, color: '#fff', padding: '0.3rem 1rem', borderRadius: 8,
          fontSize: '0.75rem', fontWeight: 700,
        }}>
          人気 No.1
        </div>
      )}
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: accent, marginBottom: '0.5rem' }}>{name}</div>
      <div style={{ fontSize: '0.85rem', color: popular ? '#C8D4E8' : INK_SUB, marginBottom: '1rem', minHeight: '2.5rem' }}>{tag}</div>
      <div style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.25rem' }}>
        {yen}
        <span style={{ fontSize: '0.85rem', color: popular ? '#C8D4E8' : INK_SUB, marginLeft: '0.5rem' }}>/ 月</span>
      </div>
      <div style={{ height: 1, background: popular ? '#1A4FC4' : BORDER, margin: '1.5rem 0' }} />
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem', minHeight: '11rem' }}>
        {feats.map((f, i) => (
          <li key={i} style={{ marginBottom: '0.6rem', display: 'flex', gap: '0.5rem' }}>
            <span style={{ color: accent, fontWeight: 900 }}>✓</span>
            <span style={{ fontSize: '0.9rem' }}>{f}</span>
          </li>
        ))}
      </ul>
      <button onClick={onCta} style={{
        width: '100%',
        background: popular ? ORANGE : 'transparent',
        color: popular ? '#fff' : accent,
        border: popular ? 'none' : `2px solid ${accent}`,
        padding: '0.8rem',
        borderRadius: 10,
        fontWeight: 700,
        fontSize: '0.95rem',
        cursor: 'pointer',
      }}>
        このプランで試す →
      </button>
    </div>
  );
}

// ── スタイル定数 ─────────────────────────────
const navLink: React.CSSProperties = {
  color: INK,
  fontSize: '0.9rem',
  textDecoration: 'none',
  fontWeight: 500,
};
const ctaBtnSmall: React.CSSProperties = {
  background: ORANGE,
  color: '#fff',
  padding: '0.5rem 1.1rem',
  borderRadius: 8,
  fontSize: '0.85rem',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
};
const ctaBtnLarge: React.CSSProperties = {
  background: ORANGE,
  color: '#fff',
  padding: '1rem 2rem',
  borderRadius: 12,
  fontSize: '1rem',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(255,107,53,0.35)',
};
const ctaBtnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  color: '#fff',
  padding: '1rem 2rem',
  borderRadius: 12,
  fontSize: '1rem',
  fontWeight: 700,
  border: '1px solid rgba(255,255,255,0.3)',
  textDecoration: 'none',
  display: 'inline-block',
};
const footHead: React.CSSProperties = {
  fontSize: '0.75rem',
  letterSpacing: '0.15em',
  color: '#A8B5CF',
  marginBottom: '0.75rem',
  fontWeight: 700,
};
const footLink: React.CSSProperties = {
  display: 'block',
  color: '#fff',
  fontSize: '0.85rem',
  textDecoration: 'none',
  marginBottom: '0.5rem',
  opacity: 0.8,
};
