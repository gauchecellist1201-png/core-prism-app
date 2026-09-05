// ============================================================
// /strategy/services — CORE 全サービスの入口を1枚に
//
// 各サービスのLPは別々のドメインに散っていて、URLを覚えていないと辿り着けない。
// ここに実際のファーストビューの絵を並べ、どれも1タップで開けるようにする。
//
// ★ここに書くURLは、実機で200と表示を確認したものだけ。推測で足さない。
//   (crystal-concierge / veritas-gauches-projects は同一実体の別名やSSO保護のため採らない)
// ★カードに出現アニメを掛けないこと。裏タブや省電力で opacity:0 のまま固まると
//   一覧そのものが空白になる(過去に別サービスで実際に起きている)。
// ============================================================

type Service = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  url: string;
};

const SERVICES: Service[] = [
  { slug: 'corehp', name: 'CORE', tagline: '人手が足りない仕事を、AIが引き受ける', category: '会社', url: 'https://core-hp.vercel.app' },
  { slug: 'ichibannori', name: 'イチバンノリ', tagline: '問い合わせに、AIが60秒で一番乗り返信', category: '営業', url: 'https://ichibannori.vercel.app' },
  { slug: 'prism', name: 'CORE Prism', tagline: 'レシートは撮るだけ。請求書も営業文もAIが作る', category: '経営', url: 'https://core-prism-app.vercel.app' },
  { slug: 'nexus', name: 'CORE NERI', tagline: '話すだけで、会社が動く。Voice-First Company OS', category: '経営', url: 'https://core-nexus-kappa.vercel.app/lp/' },
  { slug: 'universe', name: 'CORE Universe', tagline: 'どの仕事からAIに任せるかを、星図で示す', category: '経営', url: 'https://core-universe.vercel.app/lp' },
  { slug: 'resonance', name: 'Resonance', tagline: '公式LINEの返信を、AIが先に書いておく', category: '接客', url: 'https://resonancebot-ivory.vercel.app' },
  { slug: 'crystal', name: 'CRYSTAL', tagline: '受付と接客を、タブレット1台で24時間AIに', category: '接客', url: 'https://crystal-nine-self.vercel.app' },
  { slug: 'veritas', name: 'CORE VERITAS', tagline: '広告がなくても取れていた分を、切り分ける', category: '広告', url: 'https://veritas-lime.vercel.app' },
  { slug: 'iris', name: 'Iris', tagline: 'Instagram運用のすべてを、AIが伴走する', category: '集客', url: 'https://iris-lp.vercel.app' },
  { slug: 'lume', name: 'Lume', tagline: '30分で作れる、売れるプロフィール1枚ページ', category: '集客', url: 'https://lume-deploy-five.vercel.app' },
  { slug: 'guild', name: 'GUILD', tagline: '会議で決めたことを、消えない記録に残す', category: '組織', url: 'https://guild-hazel.vercel.app' },
  { slug: 'anima', name: 'ANIMA', tagline: 'アニメ制作進行の支払集計60時間を、ゼロに', category: '制作', url: 'https://core-anime-os.vercel.app/lp' },
  { slug: 'soma', name: 'Soma', tagline: '林業の書類業務を、現場から申請までひとつに', category: '現場', url: 'https://soma-indol-gamma.vercel.app' },
  { slug: 'tabitto', name: 'タビット', tagline: '出張のぜんぶを、話しかけるだけで終わらせる', category: '業務', url: 'https://tabitto-lp.vercel.app' },
  { slug: 'takt', name: 'Takt', tagline: 'AI未経験から90日で作品を作る月額コミュニティ', category: '学び', url: 'https://gauche-ai-school.vercel.app/takt.html' },
];

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", serif';

export default function ServiceGalleryTab() {
  return (
    <>
      <style>{`
        .svc-grid{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
        @media (max-width:640px){
          .svc-grid{grid-template-columns:1fr;gap:1rem}
          /* iPhoneでは見出しで1画面を使い切らせない。カードを早く見せる */
          .svc-hero{padding:2rem 1.25rem 1.25rem !important}
          .svc-hero h1{font-size:1.5rem !important}
        }
        .svc-card{display:block;text-decoration:none;color:inherit;border-radius:14px;overflow:hidden;
          background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.10);
          transition:border-color .2s ease, transform .2s ease, background .2s ease}
        .svc-card:hover,.svc-card:focus-visible{border-color:rgba(251,191,36,0.55);
          background:rgba(255,255,255,0.06);transform:translateY(-3px);outline:none}
        .svc-shot{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top center;
          background:#0b1020;border-bottom:1px solid rgba(255,255,255,0.08)}
      `}</style>

      <section className="svc-hero" style={{ padding: '4rem 1.5rem 2rem', textAlign: 'center', background: 'linear-gradient(180deg,#000 0%,#070712 100%)' }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.7rem', letterSpacing: '0.45em', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: '1.25rem' }}>ALL SERVICES</p>
        <h1 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)', fontWeight: 700, lineHeight: 1.4, letterSpacing: '0.04em', marginBottom: '0.9rem' }}>
          CORE のぜんぶが、<span style={{ background: 'linear-gradient(90deg,#fbbf24,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 900 }}>この1枚から。</span>
        </h1>
        <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.95rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.9, maxWidth: 640, margin: '0 auto' }}>
          {SERVICES.length}サービス。押すとそのままLPが開きます。
        </p>
      </section>

      <div style={{ padding: '0 1.5rem 5rem', maxWidth: 1400, margin: '0 auto' }}>
        <div className="svc-grid">
          {SERVICES.map((s) => (
            <a key={s.slug} className="svc-card" href={s.url} target="_blank" rel="noopener noreferrer">
              <img
                className="svc-shot"
                src={`/lp-shots/${s.slug}.webp`}
                /* 幅640pxで撮ってある。ここを書いておかないと読み込み中に高さが跳ねて、
                   下のカードを押そうとした指が別のサービスを開く。 */
                width={640}
                height={400}
                loading="lazy"
                decoding="async"
                alt={`${s.name} のトップページ`}
              />
              <div style={{ padding: '1rem 1.15rem 1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
                  <span style={{ fontFamily: FONT_SERIF_JA, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.02em' }}>{s.name}</span>
                  <span style={{
                    fontFamily: FONT_SERIF_JA, fontSize: '0.68rem', color: 'rgba(255,255,255,0.75)',
                    border: '1px solid rgba(255,255,255,0.22)', borderRadius: 999, padding: '2px 9px',
                  }}>{s.category}</span>
                </div>
                <p style={{ fontFamily: FONT_SERIF_JA, fontSize: '0.85rem', color: 'rgba(255,255,255,0.68)', lineHeight: 1.75, margin: 0 }}>{s.tagline}</p>
                <p style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'rgba(255,255,255,0.42)', marginTop: '0.6rem', wordBreak: 'break-all' }}>
                  {s.url.replace(/^https:\/\//, '')}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
