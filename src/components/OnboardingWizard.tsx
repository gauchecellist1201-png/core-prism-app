import { useState } from 'react';
import { motion } from 'framer-motion';
import { PrismLogo } from './Logo';
import { markOnboarded, seedDemoData, setDemoActive } from '../lib/onboarding';
import { logEvent } from '../lib/onboardingAnalytics';
import { resolveFeatureIcon } from '../lib/featureIcons';
import {
  Lightbulb, LayoutGrid, MessageSquare, BookOpen, Search,
  PlayCircle, PenLine, Check, Package, Rocket, type LucideIcon,
} from 'lucide-react';
import { accentFaceBg, accentFaceInk } from '../lib/accentFace';

interface Props {
  onComplete: () => void;
  accentColor?: string;
}

// 使い方の紹介は「iPhone で実際に見えているもの」だけを指す。
// (⌘K・左サイドバーはスマホに存在しないので、主語をスマホ側に置き換えた)
const TOUR_HIGHLIGHTS: { Icon: LucideIcon; color: string; title: string; desc: string }[] = [
  {
    Icon: Lightbulb,
    color: '#FACC15',
    title: '毎朝、やる事を 3 つ出します',
    desc: 'ホームのいちばん上のカードです。あなたの売上・予定・案件を AI が読んで、「今日はこれをやると効く」を 3 つ並べます。「やる」を押すと、その場で下書きまで作ります。',
  },
  {
    Icon: LayoutGrid,
    color: '#C084FC',
    title: 'やりたい事の名前から選ぶ',
    desc: 'その下に「請求書を作る」「会議を文字に起こす」「利益を確認」のように、やる事の名前が並んでいます。押すとその画面が開きます。迷ったら上の 3 つから。',
  },
  {
    Icon: MessageSquare,
    color: '#5BA8FF',
    title: '画面の下の欄に、話しかけるだけ',
    desc: '「先月の利益は？」「この案件に返信を書いて」と書けば答えます。となりのマイクを押せば、声でもかまいません。',
  },
  {
    Icon: BookOpen,
    color: '#4ADE80',
    title: '自分の資料を渡すと、答えが変わります',
    desc: 'PDF・写真・議事録を渡すと AI が覚えて、次からはあなたの会社の中身で答えます。何も渡さないと、どこにでもある一般論しか返せません。',
  },
  {
    Icon: Search,
    color: '#FF6FB5',
    title: '探す時は、画面の右はし',
    desc: '右はしの細いつまみを引くと、機能もお客さんも資料もまとめて探せます。パソコンでは Command キー + K でも開きます。',
  },
];

// 退場アニメは付けない。AnimatePresence mode="wait" は退場の完了を待つため、
// 画面が固まって次のスライドが永久に出てこない事故 (=詰み) を起こす。入場だけにする。
const STEP_SLIDE = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export default function OnboardingWizard({ onComplete, accentColor = '#c9a96e' }: Props) {
  const [step, setStep] = useState(0);
  const [tourIdx, setTourIdx] = useState(0);
  const [choice, setChoice] = useState<'demo' | 'empty' | null>(null);

  const accent = accentColor;
  const accentBg = `${accent}22`;
  const accentBorder = `${accent}55`;

  // このウィザードを最後まで見た / 飛ばした人に、直後にもう 1 つ同じ内容の
  // 使い方ガイド (TutorialOverlay) が出て「スキップ」を 2 回押させていた。
  // ここで見たことにして、説明の二度出しを止める。
  // (設定 →「使い方ガイドをもう一度見る」からはこれまで通り開ける)
  const suppressDuplicateTutorial = () => {
    try { localStorage.setItem('core_tutorial_seen_prism_v1', '1'); } catch { /* quota */ }
  };

  const handleComplete = () => {
    suppressDuplicateTutorial();
    if (choice === 'demo') {
      const count = seedDemoData();
      setDemoActive(true);
      markOnboarded();
      logEvent('onboarding_completed', { choice: 'demo', seededItems: count });
      logEvent('demo_seeded', { count });
      window.location.reload();
    } else {
      markOnboarded();
      logEvent('onboarding_completed', { choice: 'empty' });
      onComplete();
    }
  };

  const handleSkip = () => {
    suppressDuplicateTutorial();
    markOnboarded();
    logEvent('onboarding_skipped', { step });
    onComplete();
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(16px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: '#111118',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '90dvh',
        }}
        initial={{ scale: 0.92, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 24 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-0.5 w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full"
            style={{ background: accent }}
            animate={{ width: `${((step + 1) / 4) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === step ? '20px' : '6px',
                  height: '6px',
                  background: i <= step ? accent : 'rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
          <button
            onClick={handleSkip}
            className="text-xs transition-colors"
            style={{ color: 'rgba(255,255,255,0.62)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.92)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.62)')}
          >
            説明を飛ばして使う
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <>

            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div key="s0" className="p-6 space-y-5" {...STEP_SLIDE}>
                <div className="flex flex-col items-center text-center space-y-3 py-2">
                  <PrismLogo size={48} withWordmark />
                  <div>
                    <h2 className="text-lg font-medium" style={{ color: '#f2f2f7' }}>
                      CORE Prism へようこそ
                    </h2>
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
                      請求書・議事録・資料づくり・売上の管理を、AI がまとめて引き受けます。
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* 絵も色も featureIcons の台帳から引く。ここで見た絵が、
                      あとでホームの機能タイルにそのまま並ぶので迷わない。
                      ラベルも「AI 戦略提案」→「やることを提案してくれる」のように
                      横文字を外し、何が起きるかで書く。 */}
                  {[
                    { id: 'strategy', label: '次の一手を出す' },
                    { id: 'kb',       label: '資料を覚えさせる' },
                    { id: 'crm',      label: '案件を管理する' },
                    { id: 'invoice',  label: '請求書を作る' },
                    { id: 'minutes',  label: '会議を文字に' },
                    { id: 'pnl',      label: '利益を見る' },
                  ].map(f => {
                    const entry = resolveFeatureIcon(f.id);
                    const Icon = entry?.Icon;
                    return (
                      <div
                        key={f.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
                      >
                        {Icon ? (
                          <Icon size={16} strokeWidth={1.8} aria-hidden="true"
                            style={{ color: entry!.color, flexShrink: 0 }} />
                        ) : null}
                        <span className="text-xs font-medium" style={{ color: '#f2f2f7' }}>{f.label}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  この案内はあと 3 枚です。最後まで 30 秒ほど。<br />
                  中身の入った状態で触ってみることもできます。
                </p>
              </motion.div>
            )}

            {/* Step 1: Demo choice */}
            {step === 1 && (
              <motion.div key="s1" className="p-6 space-y-4" {...STEP_SLIDE}>
                <div className="text-center">
                  <h2 className="text-base font-medium" style={{ color: '#f2f2f7' }}>
                    どこから始めますか？
                  </h2>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
                    中身が入った状態で触るか、まっさらから始めるか。<br />
                    どちらを選んでも、あとから切り替えられます。
                  </p>
                </div>
                <motion.button
                  onClick={() => setChoice('demo')}
                  className="w-full p-4 rounded-xl text-left transition-all"
                  style={{
                    background: choice === 'demo' ? accentBg : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${choice === 'demo' ? accentBorder : 'rgba(255,255,255,0.08)'}`,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start gap-3">
                    <PlayCircle size={22} strokeWidth={1.8} aria-hidden="true"
                      style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p className="font-medium text-sm" style={{ color: '#f2f2f7' }}>
                        見本の会社で、中を触ってみる（おすすめ）
                      </p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
                        架空のカフェ店主「田中健一」さんの 1 週間ぶんが入ります。
                        やる事 5 件・覚えさせた資料 3 件・商談 2 件・見積書 1 枚。
                        空っぽの画面を手さぐりしなくて済みます。
                      </p>
                      <p className="text-xs mt-1.5 flex items-start gap-1" style={{ color: accent }}>
                        <Check size={13} strokeWidth={2.6} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>いつでも 1 タップで消せます。あなたの本物のデータとは混ざりません。</span>
                      </p>
                    </div>
                  </div>
                </motion.button>
                <motion.button
                  onClick={() => setChoice('empty')}
                  className="w-full p-4 rounded-xl text-left transition-all"
                  style={{
                    background: choice === 'empty' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${choice === 'empty' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  <div className="flex items-start gap-3">
                    <PenLine size={22} strokeWidth={1.8} aria-hidden="true"
                      style={{ color: 'rgba(255,255,255,0.8)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p className="font-medium text-sm" style={{ color: '#f2f2f7' }}>
                        まっさらから始める
                      </p>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
                        見本は入れません。自分の仕事の情報だけを、これから足していきます。
                      </p>
                    </div>
                  </div>
                </motion.button>
              </motion.div>
            )}

            {/* Step 2: Guide tour */}
            {step === 2 && (
              <motion.div key="s2" className="p-6 space-y-4" {...STEP_SLIDE}>
                <div className="text-center">
                  <h2 className="text-base font-medium" style={{ color: '#f2f2f7' }}>
                    ホーム画面の、どこを見ればいいか
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.74)' }}>
                    {tourIdx + 1} 枚目 / 全 {TOUR_HIGHLIGHTS.length} 枚
                  </p>
                </div>

                {/* 退場アニメ (AnimatePresence mode="wait") は使わない。
                    退場の完了を待ち続けて中身が 1 枚目のまま固まり、点と「5 枚目 / 全 5 枚」だけが
                    進む = 説明を 4 枚読み飛ばさせる実害が出ていた。入場アニメだけにする。 */}
                <div className="relative overflow-hidden" style={{ minHeight: '160px' }}>
                  <div>
                    <motion.div
                      key={tourIdx}
                      className="p-5 rounded-xl text-center space-y-3"
                      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {(() => {
                        const t = TOUR_HIGHLIGHTS[tourIdx];
                        return (
                          <>
                            <div
                              className="mx-auto inline-flex items-center justify-center rounded-xl"
                              aria-hidden="true"
                              style={{
                                width: 44, height: 44,
                                background: `linear-gradient(135deg, ${t.color}, ${t.color}bb)`,
                                boxShadow: `0 4px 14px ${t.color}55`,
                              }}
                            >
                              <t.Icon size={22} strokeWidth={2.1} color="#FFFFFF" />
                            </div>
                            <p className="font-semibold text-sm" style={{ color: '#f2f2f7' }}>
                              {t.title}
                            </p>
                            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
                              {t.desc}
                            </p>
                          </>
                        );
                      })()}
                    </motion.div>
                  </div>
                </div>

                {/* 今どこかを示す点。button に効く共通の min-width/min-height 44px が
                    そのまま当たると 44px の巨大な丸 5 つになって「押す物」に見えてしまうため、
                    指のあたり判定 (44px) は透明な button 側で確保し、見た目の点は中の span で描く */}
                <div className="flex items-center justify-center">
                  {TOUR_HIGHLIGHTS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTourIdx(i)}
                      aria-label={`${i + 1} 枚目の説明を見る`}
                      aria-current={i === tourIdx ? 'true' : undefined}
                      className="flex items-center justify-center"
                      style={{ width: 30, height: 44, background: 'transparent', border: 'none', padding: 0 }}
                    >
                      <span
                        aria-hidden="true"
                        className="rounded-full transition-all duration-200 block"
                        style={{
                          width: i === tourIdx ? 18 : 6,
                          height: 6,
                          background: i === tourIdx ? accent : 'rgba(255,255,255,0.28)',
                        }}
                      />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 3: Complete */}
            {step === 3 && (
              <motion.div key="s3" className="p-6 space-y-4 text-center" {...STEP_SLIDE}>
                <div className="flex justify-center py-1">
                  <div
                    className="inline-flex items-center justify-center rounded-2xl"
                    aria-hidden="true"
                    style={{
                      width: 56, height: 56,
                      background: accentFaceBg(accent),
                      boxShadow: `0 6px 18px ${accent}55`,
                    }}
                  >
                    <Rocket size={28} strokeWidth={2} color="#0a0a0f" />
                  </div>
                </div>
                <div>
                  <h2 className="text-base font-medium" style={{ color: '#f2f2f7' }}>
                    {choice === 'demo' ? 'これで、中を見られます' : 'これで、始められます'}
                  </h2>
                  <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
                    {choice === 'demo'
                      ? '下のボタンを押すと、見本のデータが入って画面が読み込み直されます。そのあと「だれとして使うか」を選ぶ画面で「カフェ経営者・田中健一」を選んでください。'
                      : '下のボタンでホーム画面に進みます。まず「だれとして使うか」を 1 つ決めて、そのあと自分の資料を読ませると、AI の答えがあなたの会社の中身になります。'}
                  </p>
                </div>
                {choice === 'demo' && (
                  <div
                    className="p-3 rounded-lg text-left space-y-1"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {/* OS標準のカラー絵文字(📦)はドクトリン違反なのでライン系アイコンに置き換え */}
                    <p className="text-xs font-medium flex items-center gap-1.5" style={{ color: accent }}>
                      <Package size={13} strokeWidth={1.9} aria-hidden="true" style={{ flex: 'none' }} />
                      入る見本データ
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>
                      使う人 1 人ぶん ／ やる事 5 件 ／ 覚えさせる資料 3 件 ／ 商談 2 件 ／ 見積書 1 枚
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => {
              // 使い方の紹介の中にいるときは、まず紹介を 1 枚戻る
              if (step === 2 && tourIdx > 0) { setTourIdx(i => i - 1); return; }
              setStep(s => Math.max(0, s - 1));
            }}
            className="text-sm px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'rgba(255,255,255,0.7)', visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            ← 戻る
          </button>

          {step < 3 ? (
            <motion.button
              onClick={() => {
                if (step === 1 && choice === null) return;
                // 使い方の紹介 (5 枚) は、この 1 つのボタンで最後までめくれる。
                // 以前は 1 枚目で「次へ」を押すと残り 4 枚を見ないまま飛ばしていた。
                if (step === 2 && tourIdx < TOUR_HIGHLIGHTS.length - 1) {
                  setTourIdx(i => i + 1);
                  return;
                }
                setStep(s => s + 1);
                if (step === 0) logEvent('onboarding_started');
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={
                // まだ選んでいない間は「押せない」と分かる見た目にする。
                // ここで opacity を掛けると **面だけでなく中の文字まで薄まる**ので、
                // 指示（「上のどちらかを選んでください」）自体が読めなくなる。
                // 0.62 でも本番の実効は 3 以下だった＝薄めるのではなく、
                // 面を落ち着いた面に差し替えて文字は満額のまま出す。
                step === 1 && choice === null
                  ? { background: 'var(--surface-3)', color: 'var(--fg)', border: '1px solid var(--border)' }
                  : { background: accentFaceBg(accent), color: accentFaceInk(accent) }
              }
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* ボタンは「押すと何が起きるか」で書く。「次へ」だけだと何枚あるかも分からない */}
              {step === 0 && 'どこから始めるか選ぶ →'}
              {step === 1 && (choice === null ? '上のどちらかを選んでください' : '使い方を 5 枚で見る →')}
              {step === 2 && (
                tourIdx < TOUR_HIGHLIGHTS.length - 1
                  ? `次の説明へ（${tourIdx + 2}/${TOUR_HIGHLIGHTS.length}）→`
                  : '最後の確認へ →'
              )}
            </motion.button>
          ) : (
            <motion.button
              onClick={handleComplete}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{
                background: accentFaceBg(accent),
                color: accentFaceInk(accent),
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {choice === 'demo' ? '見本データを入れて、中を見る' : 'ホーム画面へ進む'}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
