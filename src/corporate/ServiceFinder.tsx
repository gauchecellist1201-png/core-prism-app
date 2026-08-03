// ============================================================
// ServiceFinder — 「7つのうち、あなたにはどれ？」3問診断＋7サービス比較
// 配置: /corp のヒーロー直下（初めて来た人が最初に出会う分岐）
//
// 設計の意図（2026-07-29 夜間アップグレード）:
//   /corp は 375px で高さ 30,314px（約37画面ぶん）あり、7つが詩的なコピーで
//   縦に並ぶだけだった。初めて来た人が「自分にはどれか」を知る手段が
//   「全部読む」しかない状態を、3問で終わらせるために作った。
//
//   ・答えは LLM を使わず、下の SCORES による純粋な足し算で決まる（毎回同じ答えが出る）
//   ・出す価格は PLATFORM_PLANS と同じ実際の金額のみ。効果や実績を約束する文言は書かない
//   ・「はじめの一歩」は “つないだ直後に実際に起きること” だけを書く（成果の予告はしない）
//   ・1画面1完結。質問→結果→比較 と画面が入れ替わる（縦に足さない）
// ============================================================
import { useState } from 'react';
import { PrismLogo, IrisLogo, ResonanceLogo, LumeLogo, GuildLogo, CrystalLogo, PulseLogo } from '../components/Logo';

const FONT_DISPLAY = '"Cinzel", "Noto Serif JP", serif';
const FONT_SERIF_JA = '"Noto Serif JP", "游明朝", "Yu Mincho", serif';
const FONT_SANS = '"Noto Sans JP", "Inter", "游ゴシック", sans-serif';

/* 記号文字（◆）は環境ごとに字形も太さも変わり、フォント未搭載だと豆腐になる。
   選択肢の目印は線画アイコンで描く（恒久ルール）。 */
function MarkSelect({ size = 15, color = '#C9A96E' }: { size?: number; color?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M5.6 8.2l1.7 1.7 3.2-3.6" />
    </svg>
  );
}

function MarkStep({ size = 15, color = '#C9A96E' }: { size?: number; color?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M2.5 8h9.5" />
      <path d="M8.6 4.4L12.2 8l-3.6 3.6" />
    </svg>
  );
}

export type ServiceKey = 'lume' | 'guild' | 'prism' | 'iris' | 'pulse' | 'resonance' | 'crystal';

type Service = {
  key: ServiceKey;
  name: string;
  /** 誰向けか。機能ではなく「人」から書く */
  who: string;
  /** 何ができるか（事実だけ） */
  can: string;
  price: string;
  priceNote: string;
  /** つないだ直後に実際に起きること。成果の予告はしない */
  firstStep: string;
  accent: string;
  url: string;
  Logo: typeof PrismLogo;
};

// 価格は src/corporate/CoreSite.tsx の PLATFORM_PLANS と同じ実額
export const SERVICES: Service[] = [
  {
    key: 'lume', name: 'Lume',
    who: 'まず、ネットの上に自分の入口をひとつ持ちたい人',
    can: 'すべてのリンクを1ページに束ね、誰がどこを押したかを見る',
    price: '無料', priceNote: 'から使えます',
    firstStep: '登録したその場で、自分のリンクページが1つできます',
    accent: '#FFA42A', url: 'https://lume-deploy-five.vercel.app/', Logo: LumeLogo,
  },
  {
    key: 'guild', name: 'Guild',
    who: '社員・副業・フリーランスが混ざっていて、決めごとが前に進まないチーム',
    can: '提案と投票で決め、決まったことを後から書き換えられない記録に残す',
    price: '¥980', priceNote: '〜 / 月（税込）',
    firstStep: 'ギルドを1つ作って、最初の提案を出せます',
    accent: '#2DD4BF', url: 'https://guild-gauches-projects.vercel.app/?lp=1', Logo: GuildLogo,
  },
  {
    key: 'prism', name: 'Prism',
    who: '数字・営業・契約・議事録を、ぜんぶ自分ひとりで抱えている経営者',
    can: '13名のAI役員が、経営の調べもの・書きもの・段取りを引き受ける',
    price: '¥2,980', priceNote: '〜 / 月（税込）',
    firstStep: '事業の情報を貼ると、AI役員が最初の一手を返します',
    accent: '#C9A96E', url: '/pricing', Logo: PrismLogo,
  },
  {
    key: 'iris', name: 'Iris',
    who: 'Instagram で知ってもらいたい人・運用を任されている人',
    can: '投稿と分析、リールの企画・台本づくり、コメント返信をAIと',
    price: '¥2,980', priceNote: '〜 / 月（税込）',
    firstStep: 'Instagram をつなぐと、いまの投稿の分析が出ます',
    accent: '#E1306C', url: '/iris?lp=1', Logo: IrisLogo,
  },
  {
    key: 'pulse', name: 'Pulse',
    who: '働きすぎて、自分のからだのことが後回しになっている人',
    can: '睡眠・心拍・歩数から「きょうの調子」を毎朝ことばで受け取る',
    price: '無料', priceNote: '（先行モニター中・正式版 ¥2,980/月 の予定）',
    firstStep: 'Apple Watch か iPhone をつなぐと、翌朝から届きます',
    accent: '#FF5C8A', url: '/pulse', Logo: PulseLogo,
  },
  {
    key: 'resonance', name: 'Resonance',
    who: 'LINE に友だちがいるのに、活かしきれていないお店・事業者',
    can: '一人ひとりに書き分けた LINE を届け、返信も自動で受ける',
    price: '¥6,980', priceNote: '〜 / 月（税込）',
    firstStep: 'LINE 公式アカウントをつなぐと、その日から自動返信が動きます',
    accent: '#06C755', url: 'https://resonancebot-ivory.vercel.app/lp', Logo: ResonanceLogo,
  },
  {
    key: 'crystal', name: 'Crystal',
    who: '電話と問い合わせの対応に、人手を取られているお店・会社',
    can: 'サイトに1行入れるだけで、24時間 AI がお客様に応対する',
    price: '¥29,800', priceNote: '〜 / 月（税込）・¥49,800 のプランもあります',
    firstStep: 'お店の情報を貼ると、その場で AI が質問に答え始めます',
    accent: '#C9A96E', url: 'https://crystal-nine-self.vercel.app/', Logo: CrystalLogo,
  },
];

const byKey = (k: ServiceKey) => SERVICES.find(s => s.key === k)!;

// ---- 3つの質問 ------------------------------------------------

type Choice = { id: string; label: string; phrase?: string; scores: Partial<Record<ServiceKey, number>> };
type Question = { id: 'q1' | 'q2' | 'q3'; title: string; note: string; choices: Choice[] };

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    title: 'いま、いちばん困っていることは？',
    note: '答えに、いちばん近いものをひとつ',
    choices: [
      // 悩み（Q1）の点数は 10 / 5 / 3。Q2+Q3 の最大は 5 なので、
      // 「からだが心配」と答えた人に Pulse 以外が出るような逆転は起こらない。
      { id: 'reach', label: '知ってもらえない。お客様が来ない', scores: { iris: 10, lume: 5, resonance: 3 } },
      { id: 'repeat', label: '一度きりで終わってしまう。また来てもらえない', scores: { resonance: 10, crystal: 3, lume: 1 } },
      { id: 'reply', label: '問い合わせや電話の対応で、自分の手が止まる', scores: { crystal: 10, resonance: 3 } },
      { id: 'manage', label: '数字も事務もぐちゃぐちゃで、経営の判断ができない', scores: { prism: 10, guild: 3 } },
      { id: 'team', label: 'チームで決まらない。決めても動かない', scores: { guild: 10, prism: 3 } },
      { id: 'body', label: '自分のからだが心配。この働き方が続かない', scores: { pulse: 10 } },
    ],
  },
  {
    id: 'q2',
    title: 'お客様との接点は、いまどこにありますか？',
    note: 'いちばん人がいる場所をひとつ。「次に足すなら」がここで変わります',
    choices: [
      { id: 'ig', label: 'Instagram', phrase: 'お客様がいるのは Instagram', scores: { iris: 4, lume: 2 } },
      { id: 'line', label: 'LINE', phrase: 'お客様がいるのは LINE', scores: { resonance: 4 } },
      { id: 'site', label: '自分のサイト、またはお店', phrase: 'お客様は自分のサイトやお店に来る', scores: { crystal: 4, lume: 2 } },
      { id: 'none', label: 'まだ、ほとんど無い', phrase: '接点は、これから作る', scores: { lume: 4, iris: 2 } },
      { id: 'inside', label: '社内の話なので、お客様の接点は関係ない', phrase: '社外よりも、まず社内を整えたい', scores: { prism: 2, guild: 2, pulse: 2 } },
    ],
  },
  {
    id: 'q3',
    title: 'いま、動かしているのは？',
    note: '規模でおすすめが変わります',
    choices: [
      { id: 'solo', label: 'ひとり（個人・フリーランス）', scores: { lume: 1, iris: 1, pulse: 1 } },
      { id: 'small', label: '数人のチーム', scores: { guild: 1, prism: 1 } },
      { id: 'shop', label: 'お店・会社（お客様がいらっしゃる）', scores: { crystal: 1, resonance: 1, prism: 1 } },
    ],
  },
];

/**
 * 3つの答えから、おすすめ1つと「次に足すなら」1つを決める純粋関数。
 * 同点のときは下の TIE_ORDER（軽い入口が先）で決まるので、答えは毎回同じになる。
 */
const TIE_ORDER: ServiceKey[] = ['lume', 'iris', 'resonance', 'prism', 'guild', 'crystal', 'pulse'];

export function recommend(a1: string, a2: string, a3: string) {
  const total: Record<ServiceKey, number> = { lume: 0, guild: 0, prism: 0, iris: 0, pulse: 0, resonance: 0, crystal: 0 };
  const picked = [
    QUESTIONS[0].choices.find(c => c.id === a1),
    QUESTIONS[1].choices.find(c => c.id === a2),
    QUESTIONS[2].choices.find(c => c.id === a3),
  ];
  picked.forEach(c => {
    if (!c) return;
    (Object.keys(c.scores) as ServiceKey[]).forEach(k => { total[k] += c.scores[k] ?? 0; });
  });
  const ranked = TIE_ORDER.slice().sort((x, y) => total[y] - total[x]);
  const top = byKey(ranked[0]);
  const second = byKey(ranked[1]);
  const painLabel = picked[0]?.label ?? '';
  const channelPhrase = picked[1]?.phrase ?? '';
  return { top, second, painLabel, channelPhrase, scores: total };
}

// ---- 画面 ------------------------------------------------------

const cardBase: React.CSSProperties = {
  borderRadius: 20,
  border: '1px solid rgba(201,169,110,0.28)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012))',
};

export default function ServiceFinder() {
  const [step, setStep] = useState(0); // 0,1,2 = 質問 / 3 = 結果
  const [ans, setAns] = useState<string[]>([]);
  const [mode, setMode] = useState<'finder' | 'compare'>('finder');

  const answer = (id: string) => {
    const next = [...ans.slice(0, step), id];
    setAns(next);
    setStep(step + 1);
  };
  const reset = () => { setAns([]); setStep(0); };

  const result = step >= 3 ? recommend(ans[0], ans[1], ans[2]) : null;

  return (
    <section
      id="finder"
      className="lp-section-pad"
      style={{
        padding: '4.5rem 1.25rem',
        background: 'radial-gradient(120% 100% at 50% 0%, #0E0E0E 0%, #060606 72%)',
        borderTop: '1px solid rgba(201,169,110,0.16)',
        borderBottom: '1px solid rgba(201,169,110,0.16)',
        // 追従ヘッダー(約72px)に見出しが隠れないよう、他セクションより深くとる
        scrollMarginTop: 104,
      }}
    >
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '0.72rem', letterSpacing: '0.32em', color: '#C9A96E', textTransform: 'uppercase', marginBottom: '0.9rem' }}>
            Which one is yours
          </p>
          <h2
            style={{
              fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.4rem, 5vw, 2.2rem)', fontWeight: 700, lineHeight: 1.6, letterSpacing: '0.03em',
              background: 'linear-gradient(120deg, #F7EAD0, #C9A96E)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              marginBottom: '0.8rem',
            }}
          >
            7つのうち、あなたにはどれ？
          </h2>
          <p style={{ fontFamily: FONT_SANS, fontSize: '0.84rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.95 }}>
            3つ答えるだけで、いまのあなたに効く1つと、その理由・料金までお見せします。
            <br />
            登録もメールアドレスも要りません。
          </p>
        </div>

        {mode === 'compare' ? (
          <CompareView onBack={() => setMode('finder')} />
        ) : result ? (
          <ResultView result={result} onReset={reset} onCompare={() => setMode('compare')} />
        ) : (
          <QuestionView
            q={QUESTIONS[step]}
            step={step}
            onAnswer={answer}
            onBack={step > 0 ? () => setStep(step - 1) : undefined}
            onCompare={() => setMode('compare')}
          />
        )}
      </div>
    </section>
  );
}

function QuestionView({ q, step, onAnswer, onBack, onCompare }: {
  q: Question; step: number; onAnswer: (id: string) => void; onBack?: () => void; onCompare: () => void;
}) {
  return (
    <div style={{ ...cardBase, padding: '1.5rem 1.15rem 1.25rem' }}>
      {/* 進み具合 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.1rem' }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            aria-hidden
            style={{
              height: 3, flex: 1, borderRadius: 999,
              background: i <= step ? 'linear-gradient(90deg,#E7C987,#C9A96E)' : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
        <span style={{ fontFamily: FONT_SANS, fontSize: '0.7rem', fontWeight: 700, color: '#C9A96E', fontVariantNumeric: 'tabular-nums', marginLeft: 4 }}>
          {step + 1} / 3
        </span>
      </div>

      <h3 style={{ fontFamily: FONT_SERIF_JA, fontSize: 'clamp(1.05rem, 3.6vw, 1.3rem)', fontWeight: 700, color: '#F4F0E6', lineHeight: 1.7, marginBottom: '0.35rem' }}>
        {q.title}
      </h3>
      <p style={{ fontFamily: FONT_SANS, fontSize: '0.74rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1.1rem' }}>{q.note}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {q.choices.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => onAnswer(c.id)}
            style={{
              minHeight: 56, width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: '0.9rem 1rem', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)',
              color: '#F4F7FC', fontFamily: FONT_SANS, fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.65,
              display: 'flex', alignItems: 'center', gap: '0.7rem',
            }}
          >
            <MarkSelect />
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
        {onBack ? (
          <button type="button" onClick={onBack} style={subtleBtn}>← ひとつ戻る</button>
        ) : <span />}
        <button type="button" onClick={onCompare} style={subtleBtn}>7つを見比べる →</button>
      </div>
    </div>
  );
}

function ResultView({ result, onReset, onCompare }: {
  result: ReturnType<typeof recommend>; onReset: () => void; onCompare: () => void;
}) {
  const { top, second, painLabel, channelPhrase } = result;
  const TopLogo = top.Logo;
  const external = top.url.startsWith('http');
  return (
    <div style={{ ...cardBase, padding: '1.6rem 1.15rem 1.3rem', borderColor: 'rgba(201,169,110,0.55)', boxShadow: '0 34px 80px -40px rgba(201,169,110,0.5)' }}>
      <p style={{ fontFamily: FONT_SANS, fontSize: '0.74rem', letterSpacing: '0.1em', color: '#C9A96E', fontWeight: 800, marginBottom: '1rem' }}>
        あなたには、これを
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1.1rem' }}>
        <span style={{ flexShrink: 0, filter: `drop-shadow(0 8px 22px ${top.accent}66)`, lineHeight: 0 }}>
          <TopLogo size={56} withWordmark={false} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: '#F1E6CE', lineHeight: 1.3 }}>
            {top.name}
          </p>
          <p style={{ fontFamily: FONT_SANS, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#E7C987' }}>{top.price}</span>
            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginLeft: 5 }}>{top.priceNote}</span>
          </p>
        </div>
      </div>

      {/* なぜこれなのか（選んだ答えから作る） */}
      <div style={{ borderRadius: 14, background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.22)', padding: '0.95rem 1rem', marginBottom: '1rem' }}>
        <p style={{ fontFamily: FONT_SANS, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.08em', color: '#C9A96E', marginBottom: 6 }}>なぜ、これなのか</p>
        <p style={{ fontFamily: FONT_SANS, fontSize: '0.86rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.95 }}>
          「{painLabel}」——{top.name} は、そこを解くために作りました。
          <br />
          {top.can}。{top.who}のためのものです。
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
        <span style={{ marginTop: 5, display: 'inline-flex', flexShrink: 0 }}><MarkStep /></span>
        <p style={{ fontFamily: FONT_SANS, fontSize: '0.84rem', color: 'rgba(255,255,255,0.74)', lineHeight: 1.9 }}>
          <strong style={{ color: '#F1E6CE', fontWeight: 700 }}>はじめの一歩：</strong>{top.firstStep}
        </p>
      </div>

      <a
        href={top.url}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener' : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 54,
          borderRadius: 999, textDecoration: 'none',
          fontFamily: FONT_SANS, fontSize: '0.92rem', fontWeight: 800, letterSpacing: '0.03em',
          background: 'linear-gradient(90deg,#E7C987,#C9A96E)', color: '#141414',
        }}
      >
        {top.name} を見る →
      </a>

      <p style={{ fontFamily: FONT_SANS, fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.9, marginTop: '1.1rem' }}>
        {channelPhrase}。であれば、
        <strong style={{ color: '#F1E6CE', fontWeight: 700 }}>次に足すなら {second.name}。</strong>
        {second.can}（{second.price}{second.priceNote}）。
        <br />
        CORE の7つは、あとからつなげます。最初から全部そろえる必要はありません。
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1.1rem' }}>
        <button type="button" onClick={onReset} style={subtleBtn}>← もう一度やる</button>
        <button type="button" onClick={onCompare} style={subtleBtn}>7つを見比べる →</button>
      </div>
    </div>
  );
}

function CompareView({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
        <p style={{ fontFamily: FONT_SANS, fontSize: '0.78rem', fontWeight: 800, color: '#C9A96E', letterSpacing: '0.06em' }}>7つ、すべて</p>
        <button type="button" onClick={onBack} style={subtleBtn}>← 3問で選ぶ</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.8rem' }}>
        {SERVICES.map(s => {
          const Logo = s.Logo;
          const external = s.url.startsWith('http');
          return (
            <div key={s.key} style={{ ...cardBase, padding: '1.1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <span style={{ flexShrink: 0, lineHeight: 0, filter: `drop-shadow(0 6px 16px ${s.accent}55)` }}>
                  <Logo size={34} withWordmark={false} />
                </span>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.07em', color: '#F1E6CE' }}>{s.name}</p>
                <span style={{ marginLeft: 'auto', fontFamily: FONT_SANS, fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem', fontWeight: 800, color: '#E7C987', whiteSpace: 'nowrap' }}>
                  {s.price}
                </span>
              </div>

              <CompareRow label="こんな人に" value={s.who} />
              <CompareRow label="できること" value={s.can} />
              <CompareRow label="料金" value={`${s.price}${s.priceNote}`} />
              <CompareRow label="はじめの一歩" value={s.firstStep} />

              <a
                href={s.url}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener' : undefined}
                style={{
                  marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 46,
                  borderRadius: 999, textDecoration: 'none', border: '1px solid rgba(201,169,110,0.45)',
                  background: 'rgba(201,169,110,0.08)', color: '#F1E6CE',
                  fontFamily: FONT_SANS, fontSize: '0.82rem', fontWeight: 700,
                }}
              >
                {s.name} を見る →
              </a>
            </div>
          );
        })}
      </div>

      {/* 2026-07-31 巡回: 0.45 は黒地で 4.43:1 と基準未達。税込表記と解約条件は読めないと困る。 */}
      <p style={{ fontFamily: FONT_SANS, fontSize: '0.74rem', color: 'rgba(255,255,255,0.62)', lineHeight: 1.95, marginTop: '1rem', textAlign: 'center' }}>
        表示はすべて税込です。いつでも解約できます。
        <br />
        「どれか分からない」ままで大丈夫です。3問に答えるか、そのままご相談ください。
      </p>
    </div>
  );
}

function CompareRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: FONT_SANS, fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.1em', color: 'rgba(201,169,110,0.85)', marginBottom: 3 }}>{label}</p>
      <p style={{ fontFamily: FONT_SANS, fontSize: '0.82rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.85 }}>{value}</p>
    </div>
  );
}

const subtleBtn: React.CSSProperties = {
  minHeight: 44, padding: '0 0.85rem', cursor: 'pointer',
  background: 'transparent', border: 'none',
  color: 'rgba(255,255,255,0.6)', fontFamily: FONT_SANS, fontSize: '0.78rem', fontWeight: 700,
};
