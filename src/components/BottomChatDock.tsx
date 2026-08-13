// ============================================================
// BottomChatDock — Claude Code 風の「下部チャットバー」。
// 右サイドの AISidebar とは別に、画面下中央に常時表示する分かりやすい入口。
// 既存のチャット状態 (messages / onSend / isLoading) をそのまま共有する。
// ・折りたたみ時: 1 本の入力バー（どこからでもすぐ聞ける）
// ・展開時: 上方向に会話スレッドが開く（送信すると自動展開）
// モバイル最優先: full-width / safe-area / 16px入力(自動ズーム防止) / タップ44px。
// ============================================================
import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../types/identity';
import { onAccentInk } from '../lib/contrast';
import { useCoveredByModal } from '../hooks/useCoveredByModal';
import { routeCommand } from '../lib/prismCommandRouter';

interface Props {
  /** アクセント色（persona.accentColor）。 */
  accent: string;
  /** 表示名（例: 人格名）。プレースホルダ等に使う。 */
  name: string;
  messages: ChatMessage[];
  onSend: (msg: string) => Promise<void> | void;
  isLoading: boolean;
  /**
   * ★2026-08-13 「ルーターを通さずに、ただのAI会話として送る」経路。
   * これが無いと『タスクって何？』のような“質問”が routeCommand に
   * 機能起動として横取りされ、質問する手段が画面から消える（下の注記参照）。
   *
   * 必須にしてある理由: 省略できるようにすると「機能が開きます」の予告だけが出て
   * 逃げ道が無い画面を、型が許してしまう。この帯は逃げ道とセットで初めて成立する。
   *
   * ★前提: onSend は routeCommand を通す送信であること (App.tsx の handleSendMessage)。
   *   帯は routeCommand の判定をそのまま出しているので、ここに素の会話送信を
   *   渡すと「開きます」と出して開かない画面になる。
   */
  onSendChat: (msg: string) => Promise<void> | void;
}

const MINIMIZED_KEY = 'prism-chat-dock-minimized';

export default function BottomChatDock({ accent, name, messages, onSend, isLoading, onSendChat }: Props) {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  // 「待機」状態: 帯だけ残して下の画面を広く見せる。次回訪問時も記憶。
  const [minimized, setMinimized] = useState(() => {
    try { return localStorage.getItem(MINIMIZED_KEY) === '1'; } catch { return false; }
  });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // 画面幅は「描画時に1回だけ」ではなく追従させる（回転・ウィンドウ変更でも崩れないように）
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 640);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth <= 640);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(MINIMIZED_KEY, minimized ? '1' : '0'); } catch { /* noop */ }
  }, [minimized]);

  // ★2026-07-31 通話ボタン。iPhone(375px)で「プリズム と話す」オーブを畳んだぶん、
  //   オーブでしか行けなかった音声通話の入口をここに移す。
  //   受け手(SupportChat)が居る画面でだけ出す — 押しても何も起きないボタンを作らないため。
  //   SupportChat は画面によって出たり消えたりするので、body の目印を見張って追従する。
  // ★2026-07-31 オンボーディング(全画面モーダル)の暗幕の上に、この下部バーだけが
  //   出たままで押せてしまっていた。COREの丸ボタン(2026-07-29)・マイクFAB(2026-07-31)は
  //   既に引っ込むようにしてあるので、同じ判定をここにも当てる(閉じれば自動で戻る)。
  const coveredByModal = useCoveredByModal(rootRef);

  const [canCall, setCanCall] = useState(false);
  useEffect(() => {
    const sync = () => setCanCall(document.body.dataset.prismVoiceCall === '1');
    sync();
    const ob = new MutationObserver(sync);
    ob.observe(document.body, { attributes: true, attributeFilter: ['data-prism-voice-call'] });
    return () => ob.disconnect();
  }, []);

  // ★2026-07-26 文字かぶりの根治（オーナー報告「文字がかぶっている」）
  //   このドックは画面下に固定表示されるが、同じく bottom 固定の
  //   「役員 会議室」ドック等と重なり、下の要素が完全に隠れていた（実測 239x62px の重なり）。
  //   ドックの実測高さを CSS 変数 --prism-dock-h に流し込み、
  //   他の下部固定要素が必ずその上へ逃げられるようにする（決め打ちの px を使わない）。
  useEffect(() => {
    const root = document.documentElement;
    document.body.dataset.prismChatDock = '1';
    const measure = () => {
      const h = rootRef.current?.getBoundingClientRect().height ?? 0;
      root.style.setProperty('--prism-dock-h', `${Math.round(h)}px`);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && rootRef.current) ro.observe(rootRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      delete document.body.dataset.prismChatDock;
      root.style.removeProperty('--prism-dock-h');
    };
  }, [minimized, expanded]);

  // 送信や新着で会話末尾へスクロール
  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, expanded]);

  // メッセージが付いたら自動で開く（初回送信の手応え）
  useEffect(() => {
    if (messages.length > 0) setExpanded(true);
  }, [messages.length]);

  const submit = async () => {
    const msg = input.trim();
    if (!msg || isLoading) return;
    setInput('');
    setExpanded(true);
    await onSend(msg);
  };

  // ★2026-08-13 「Enter を押すと何が起きるか」を、押す前に見せる。
  //   これまで routeCommand は送信した“後”に初めて働いていたので、
  //   ①『請求書を開いて』で請求書スタジオが開くことを誰も知らず(魔法の言葉を
  //     当てるまで機能に一生たどり着けない = コマンドバーと同じ迷子)、
  //   ②逆に『タスクって何？』のような短い質問が横取りされてスタジオが開き、
  //     ただ質問する手段が画面に無かった。
  //   routeCommand をそのまま使う(同じ判定を2回書かない)。純粋関数なので
  //   1文字ごとに呼んでも待ち時間は無い。
  const route = useMemo(() => routeCommand(input), [input]);
  const showRouteHint = !!input.trim() && !isLoading && route.type !== 'chat';

  // 「AIに聞くだけ」= ルーターを通さない送信。宛先が無い時はボタンを出さない。
  const askAiInstead = async () => {
    const msg = input.trim();
    if (!msg || isLoading || !onSendChat) return;
    setInput('');
    setExpanded(true);
    await onSendChat(msg);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // ★2026-08-13 日本語変換中(IME)の Enter で送ってしまうのを止める。
    //   「請求書を開いて」と打つには 漢字変換の確定で必ず Enter を押す。
    //   ガードが無いと、その確定の Enter がそのまま送信になり、
    //   『せいきゅうしょ』のような変換途中の文が飛んでいた（しかも今は
    //   ルーターが動くので、意図しないスタジオまで開きうる）。
    //   同じ書き方が IrisReelStudioMinimal.tsx にあり、そちらに揃えた。
    //   keyCode 229 は「変換中」を表す古くからの合図で、Safari 対策に併せて見る。
    const composing = e.nativeEvent.isComposing || e.keyCode === 229;
    if (e.key === 'Enter' && !e.shiftKey && !composing) { e.preventDefault(); submit(); }
  };

  const hasMsgs = messages.length > 0;

  // ★2026-07-26 見切れの根治（オーナー報告「文字がかぶっている」）
  //   375px 実機で `${name} に聞く… (Enterで送信)` が3行に折り返し、
  //   1行分の高さしかない入力欄から 48px はみ出して切れていた（実測）。
  //   狭い画面では要素を削って1行に収める。名前が長い人格でも切れないよう短縮する。
  //   入力欄の内側は実測 132px しか無かった（右に FAB 用の余白を 84px 取っていたため）。
  //   FAB 群はドックより上の帯にいて重ならないので、狭い画面では余白を返して入力欄を広げる。
  const placeholder = narrow ? 'AIに聞く…' : `${name} に聞く… (Enterで送信)`;
  const dockPaddingRight = narrow ? 12 : 84;

  // 待機状態: 帯だけ残し、下のコンテンツが見えるスペースを確保する。
  if (minimized) {
    return (
      <div
        ref={rootRef}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'max(12px, env(safe-area-inset-bottom))',
          paddingLeft: 12,
          paddingRight: dockPaddingRight,
          display: coveredByModal ? 'none' : 'flex',
          justifyContent: 'center',
          zIndex: 46,
          pointerEvents: 'none',
        }}
      >
        <motion.button
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          onClick={() => setMinimized(false)}
          aria-label={`${name} のチャットを開く`}
          style={{
            pointerEvents: 'auto',
            height: 44,
            padding: '0 18px',
            borderRadius: 999,
            border: `1px solid ${accent}55`,
            background: 'var(--dock-surface)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 10px 34px rgba(0,0,0,0.45)',
            color: 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: accent, boxShadow: `0 0 8px ${accent}`, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>{name} に聞く</span>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 8l3.5-3.5L10 8" /></svg>
        </motion.button>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'max(12px, env(safe-area-inset-bottom))',
        // 右下の常駐FAB群（役員日報/音声/アシスタント）と重ならないよう右側を空ける
        paddingLeft: 12,
        paddingRight: dockPaddingRight,
        display: coveredByModal ? 'none' : 'flex',
        justifyContent: 'center',
        zIndex: 46,
        pointerEvents: 'none',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
      {/* 会話スレッド（展開時のみ） */}
      <AnimatePresence>
        {expanded && hasMsgs && (
          <motion.div
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 12, height: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            style={{
              pointerEvents: 'auto',
              marginBottom: 8,
              maxHeight: '52vh',
              overflowY: 'auto',
              background: 'var(--dock-surface-2)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid var(--dock-hairline)',
              borderRadius: 16,
              padding: '12px 12px 10px',
              boxShadow: '0 18px 50px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '0.04em' }}>
                AI チャット · {name}
              </span>
              <button
                onClick={() => setExpanded(false)}
                aria-label="閉じる"
                style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--dock-hairline)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5l3.5 3.5L10 5" /></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '86%',
                      padding: '8px 12px',
                      borderRadius: 14,
                      fontSize: 14,
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      background: m.role === 'user' ? accent : 'var(--surface-3)',
                      color: m.role === 'user' ? onAccentInk(accent) : 'var(--fg)',
                      border: m.role === 'user' ? `1px solid ${accent}` : '1px solid var(--border)',
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '8px 12px', borderRadius: 14, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', gap: 5, alignItems: 'center' }}>
                    {[0, 1, 2].map(d => (
                      <motion.span
                        key={d}
                        style={{ width: 6, height: 6, borderRadius: 999, background: accent, display: 'inline-block' }}
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                      />
                    ))}
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)', marginLeft: 4 }}>{name} の AI が考えています</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ★2026-08-13 Enter を押す前に「何が起きるか」を出す帯。
          高さが変わるぶんは rootRef の ResizeObserver が --prism-dock-h に
          流し直すので、上の固定要素は自動で逃げる（決め打ちの px を足さない）。 */}
      <AnimatePresence>
        {showRouteHint && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14 }}
            // 帯は打っている途中に現れる。読み上げにも「Enterで何が起きるか」を伝える。
            role="status"
            aria-live="polite"
            style={{
              pointerEvents: 'auto',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              padding: '8px 10px 8px 12px',
              background: 'var(--dock-surface-2)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: `1px solid ${accent}55`,
              borderRadius: 14,
              boxShadow: '0 10px 34px rgba(0,0,0,0.28)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: '1 1 190px' }}>
              {/* 線画アイコン（OS依存の絵文字を使わない 恒久ルール） */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>
                {route.type === 'open-modal'
                  ? <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></>
                  : <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>}
              </svg>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--fg)', minWidth: 0 }}>
                {route.type === 'open-modal' ? (
                  <>Enter で <strong style={{ color: accent, fontWeight: 800 }}>{route.label}</strong> が開きます</>
                ) : (
                  <>Enter で <strong style={{ color: accent, fontWeight: 800 }}>実行</strong> します（計画 → 納品まで）</>
                )}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                onClick={submit}
                // 「開く」だけでは何が開くのか読み上げに乗らないので、対象名まで入れる
                aria-label={route.type === 'open-modal' ? `${route.label} を開く` : '実行する'}
                style={{
                  height: 44, padding: '0 14px', borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: accent, color: onAccentInk(accent), fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
                }}
              >
                {route.type === 'open-modal' ? '開く' : '実行'}
              </button>
              <button
                onClick={askAiInstead}
                aria-label="機能を開かず、質問としてAIに送る"
                title="機能を開かず、そのまま質問として送ります"
                style={{
                  height: 44, padding: '0 12px', borderRadius: 11, cursor: 'pointer',
                  border: '1px solid var(--dock-hairline)', background: 'transparent',
                  color: 'var(--fg-muted)', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                }}
              >
                AIに聞くだけ
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 入力バー（常時表示） */}
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '8px 10px 8px 14px',
          background: 'var(--dock-surface)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `1px solid ${accent}55`,
          borderRadius: 16,
          boxShadow: `0 10px 34px rgba(0,0,0,0.22), 0 0 0 1px var(--dock-hairline)`,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 999, background: accent, boxShadow: `0 0 10px ${accent}`, flexShrink: 0, marginBottom: 12 }} />
        <button
          onClick={() => setMinimized(true)}
          aria-label="チャットを待機（畳む）"
          title="チャットを待機（畳む）"
          style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--dock-hairline)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 5.5l4 4 4-4" /></svg>
        </button>
        <textarea
          ref={taRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => { if (hasMsgs) setExpanded(true); }}
          rows={1}
          placeholder={placeholder}
          style={{
            flex: 1,
            // minWidth:0 が無いと textarea の既定の最小幅(20文字ぶん)で下限が決まり、
            // 右側のボタンが増えたときにバー全体が画面からはみ出す
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--fg)',
            fontSize: 16, // 16px=iOS自動ズーム防止
            lineHeight: 1.5,
            maxHeight: 120,
            minHeight: 24,
            paddingTop: 6,
            paddingBottom: 6,
          }}
        />
        {hasMsgs && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            aria-label="会話を開く"
            style={{ height: 44, minWidth: 44, borderRadius: 12, border: '1px solid var(--dock-hairline)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 9l3.5-3.5L11 9" /></svg>
          </button>
        )}
        {canCall && (
          <button
            onClick={() => window.dispatchEvent(new Event('prism:open-voice-call'))}
            aria-label="通話（声で話す）"
            title={`${name} と声で話す`}
            style={{ height: 44, minWidth: 44, borderRadius: 12, border: '1px solid var(--dock-hairline)', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92z" /></svg>
          </button>
        )}
        <button
          onClick={submit}
          disabled={!input.trim() || isLoading}
          // 押すと起きることを名前にする（機能起動なのに「送信」と読み上げない）
          aria-label={
            route.type === 'open-modal' ? `送信して ${route.label} を開く`
            : route.type === 'execute' ? '送信して実行する'
            : '送信'
          }
          style={{
            height: 44,
            minWidth: 44,
            borderRadius: 12,
            border: 'none',
            cursor: input.trim() && !isLoading ? 'pointer' : 'default',
            background: input.trim() && !isLoading ? accent : 'var(--surface-3)',
            color: input.trim() && !isLoading ? onAccentInk(accent) : 'var(--fg-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {isLoading ? (
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="cp-phase-spin"><path d="M12.5 7.5a5 5 0 1 1-5-5" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 9l7-7M14 2l-4.5 12-2.5-5-5-2.5L14 2z" /></svg>
          )}
        </button>
      </div>
      </div>
    </div>
  );
}
