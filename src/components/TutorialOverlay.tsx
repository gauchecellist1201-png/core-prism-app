// ============================================================
// CORE Tutorial Overlay
// 初回起動時の使い方ガイド (Prism / Iris 両対応)
// ・4-5 ステップ、スキップ可
// ・localStorage で 1 回だけ表示
// ============================================================
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X, Sparkles, MessageSquare, Wand2, Calendar, BookOpen } from 'lucide-react';

const STORAGE_KEY_PRISM = 'core_tutorial_seen_prism_v1';
const STORAGE_KEY_IRIS  = 'core_tutorial_seen_iris_v1';

interface Step {
  icon: any;
  title: string;
  body: string;
  hint?: string;
}

const PRISM_STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'ようこそ、CORE Prism へ',
    body: '事業家・経営者の「7 つの人格」を 1 つの AI で管理。会議準備・資料作成・営業文書・戦略策定 — 役割ごとに切り替えて、全部 AI が動きます。',
    hint: '今ご覧いただいているのは「ホーム」画面です',
  },
  {
    icon: BookOpen,
    title: 'まず、ナレッジを入れる',
    body: '右上の「ナレッジ」から、自分の事業に関する資料 (PDF / メモ / URL) を入れてください。AI はこれを土台に提案します。空のままだと一般論しか返せません。',
    hint: 'PDF / Word / 画像 / URL なんでも',
  },
  {
    icon: Wand2,
    title: 'AI が、次の一手を提案する',
    body: '画面トップの「PRISM が考えた次の一手」カードが、ナレッジを読んで具体的な行動を 3-5 件提案します。「やる」ボタンで AI が即実行 → 成果物 (営業文 / スライド / 議事録 / 分析) が出てきます。',
    hint: 'タップ → 実行 → コピペで完成',
  },
  {
    icon: MessageSquare,
    title: '右下の「●」アイコンで、何でも相談',
    body: 'AI アシスタント「プリズム」が常駐。経営判断・案件相談・調べごと、何でも話しかけてください。文字でも音声 (マイクボタン) でも、画像を貼っても OK。',
    hint: '右下のロゴをタップ',
  },
  {
    icon: Calendar,
    title: '音声でタスク予約も',
    body: '右下のマイクボタンで「明日 9 時にチラシを作って」のように話すと、AI が時刻に自動実行 → 完了で通知。複数役を 1 人でこなす経営者のための仕組みです。',
    hint: 'これで準備完了',
  },
];

const IRIS_STEPS: Step[] = [
  {
    icon: Sparkles,
    title: 'ようこそ、CORE Iris へ',
    body: 'クリエイター・インフルエンサーの 6 つの仕事 (案件・分析・創作・ブランド・コミュニティ・収益) を 1 つに統合。フォーム入力ナシ、AI が動いて、あなたは選ぶだけ。',
    hint: '今ご覧いただいているのは「ホーム」画面です',
  },
  {
    icon: Wand2,
    title: 'リール作成 → 投稿予約',
    body: '上部タブの「リール作成」で、画像/動画をドロップ → AI が 2026 Q2 トレンドのバイラルパターン (POV / GRWM / 3つの真実 等) を提案 → 即書き出し。「投稿予約」タブで時刻指定 → Instagram に 1 タップ送信。',
    hint: 'CapCut / Edits の代わりに使えます',
  },
  {
    icon: BookOpen,
    title: '案件管理も AI が自動で',
    body: '「案件」「案件精査」「交渉」「投稿下書き」タブで、ブランドからの DM をペーストすると AI が報酬妥当性・契約リスクを判定。返信や投稿キャプションも自動生成。',
    hint: '夜の連絡もう面倒じゃない',
  },
  {
    icon: MessageSquare,
    title: '右下の「●」で AI「アイリス」と会話',
    body: 'いつでも相談できる AI アシスタント。スランプの相談、ブランドとの揉め事、プライベートな悩みも。Bond カードに少しずつ自分のことを教えると、より親しくなります。',
    hint: '右下のロゴをタップ',
  },
  {
    icon: Calendar,
    title: 'AI が「次の一手」を先回り',
    body: 'ホーム画面の「今日やること、3 つ用意しました」が起点。AI があなたの状況を読んで具体的な提案。「やる」で実行 → 成果物が出てくる。フォーム入力ゼロのワークフロー。',
    hint: 'これで準備完了',
  },
];

interface Props {
  brand: 'prism' | 'iris';
  /** 強制表示 (設定からのトリガー) */
  force?: boolean;
  onClose?: () => void;
}

export default function TutorialOverlay({ brand, force = false, onClose }: Props) {
  const STORAGE_KEY = brand === 'prism' ? STORAGE_KEY_PRISM : STORAGE_KEY_IRIS;
  const steps = brand === 'prism' ? PRISM_STEPS : IRIS_STEPS;
  const accent = brand === 'prism'
    ? 'linear-gradient(135deg, #2E6FFF 0%, #8E5CFF 50%, #E84B97 100%)'
    : 'linear-gradient(135deg, #E1306C 0%, #F77737 50%, #FBBF24 100%)';

  const [open, setOpen] = useState(() => {
    if (force) return true;
    if (typeof window === 'undefined') return false;
    // 使い方ガイドは「アプリをインストールして使い始めた時」だけ初回表示する。
    // LP/ブラウザ閲覧の段階では出さない（説明が先に来ると面倒で離脱するため）。
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!standalone) return false;
    try { return !localStorage.getItem(STORAGE_KEY); } catch { return false; }
  });
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  // force prop が変わったら再表示
  useEffect(() => {
    if (force) { setOpen(true); setStep(0); }
  }, [force]);

  const dismiss = (markSeen = true) => {
    setClosing(true);
    if (markSeen) try { localStorage.setItem(STORAGE_KEY, '1'); } catch {/* */}
    setTimeout(() => { setOpen(false); setClosing(false); onClose?.(); }, 250);
  };

  const next = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else dismiss();
  };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  if (!open) return null;
  const s = steps[step];
  const Icon = s.icon;
  const last = step === steps.length - 1;

  return (
    <AnimatePresence>
      {!closing && (
        <motion.div
          key="tutorial-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(8, 6, 16, 0.78)',
            backdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => dismiss()}
        >
          {/* スキップボタン (右上) */}
          <button
            onClick={() => dismiss()}
            style={{
              position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
              right: 16, zIndex: 1,
              padding: '0.5rem 0.95rem',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999,
              fontSize: 12, fontWeight: 700,
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: '"Noto Sans JP", system-ui',
            }}>
            スキップ <X size={11} />
          </button>

          <motion.div
            key={`step-${step}`}
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              width: '100%', maxWidth: 460,
              maxHeight: 'calc(100dvh - 80px)',
              padding: '2rem 1.6rem 1.4rem',
              background: 'linear-gradient(180deg, rgba(30,20,50,0.95) 0%, rgba(15,10,25,0.95) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(225,48,108,0.18)',
              color: '#fff',
              fontFamily: '"Noto Sans JP", system-ui, sans-serif',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}>

            {/* グラデアイコン */}
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 12px 32px rgba(225,48,108,0.32)',
              marginBottom: '1.2rem',
            }}>
              <Icon size={30} color="#fff" strokeWidth={1.6} />
            </div>

            {/* ステップ ピル */}
            <div style={{
              display: 'inline-flex', gap: 5, marginBottom: '0.85rem',
            }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  height: 4, borderRadius: 999,
                  width: i === step ? 24 : 14,
                  background: i === step ? accent : 'rgba(255,255,255,0.18)',
                  transition: 'all 0.3s',
                }} />
              ))}
            </div>

            {/* タイトル */}
            <h2 style={{
              margin: 0,
              fontFamily: '"Cinzel", "Noto Serif JP", serif', fontStyle: 'italic',
              fontSize: 'clamp(1.4rem, 5vw, 1.8rem)',
              fontWeight: 500, lineHeight: 1.3,
              letterSpacing: '-0.01em',
              marginBottom: '0.7rem',
            }}>
              {s.title}
            </h2>

            {/* 本文 */}
            <p style={{
              margin: 0,
              fontSize: 14, lineHeight: 1.75,
              color: 'rgba(255,255,255,0.85)',
              marginBottom: s.hint ? '0.7rem' : '1.4rem',
            }}>
              {s.body}
            </p>

            {s.hint && (
              <div style={{
                padding: '0.55rem 0.85rem',
                background: 'rgba(225,48,108,0.10)',
                border: '1px solid rgba(225,48,108,0.30)',
                borderRadius: 10,
                fontSize: 11.5, lineHeight: 1.55,
                color: 'rgba(255,255,255,0.7)',
                marginBottom: '1.4rem',
                display: 'inline-flex', gap: 5, alignItems: 'center',
              }}>
                💡 {s.hint}
              </div>
            )}

            {/* ナビゲーション */}
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              {step > 0 ? (
                <button onClick={prev} style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 999,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontFamily: 'inherit',
                }}>
                  <ChevronLeft size={14} /> 戻る
                </button>
              ) : <div style={{ flex: 1 }} />}
              <button onClick={next} style={{
                flex: 1, padding: '0.85rem 1.2rem',
                background: accent,
                color: '#fff', border: 'none', borderRadius: 999,
                fontSize: 14, fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(225,48,108,0.32)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                fontFamily: 'inherit',
              }}>
                {last ? '使ってみる' : '次へ'} {!last && <ChevronRight size={14} />}
              </button>
            </div>

            <p style={{
              margin: '0.7rem 0 0',
              fontSize: 10.5, color: 'rgba(255,255,255,0.45)',
              textAlign: 'center', fontStyle: 'italic',
            }}>
              {step + 1} / {steps.length} ・ いつでも設定から再表示できます
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
