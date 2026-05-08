// ============================================================
// VoiceConversation — AIと電話のように音声会話するモーダル
// FaceTime / Apple Phone 風、フルスクリーン、波形アニメ付き
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { PrismLogo, IrisLogo } from './Logo';

interface Props {
  open: boolean;
  onClose: () => void;
  brand: 'prism' | 'iris';
  accentColor: string;
  context?: string; // 任意の前情報 (今日のタスク数等)
}

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

const GREETINGS = {
  prism: 'お疲れ様です。プリズムです。今日は何をお手伝いしましょうか。',
  iris: 'こんにちは。アイリスです。今日はどんなお話をしましょう？',
};

const SYSTEM_PROMPT = (brand: 'prism' | 'iris', context?: string) => `あなたは「${brand === 'iris' ? 'アイリス' : 'プリズム'}」── ${brand === 'iris' ? 'CORE Iris (インフルエンサー向け)' : 'CORE Prism (事業家向け)'} のAIエージェント。
ユーザーと電話で会話しています。
${context ? `\n## 現在のコンテキスト\n${context}\n` : ''}
## 話し方ルール
- 1回の発言は 60 字以内、長くても 100 字以内 (電話会話だから)
- 結論を先に。次の質問で深掘りする
- 句読点は自然に。「です・ます」調で丁寧に
- 専門用語は使わず、わかりやすく
- 絵文字・記号は使わない (音声で読み上げると変なので)
- 不明なら「もう少し教えてもらえますか？」と返す`;

export default function VoiceConversation({ open, onClose, brand, accentColor, context }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'ai-speaking' | 'listening' | 'processing'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const turnsRef = useRef<Turn[]>([]);
  turnsRef.current = turns;

  const tts = useTextToSpeech({ lang: 'ja-JP', preferGender: 'female' });

  // 自動的に listening を開始するため continuous=false で短いセグメント取得
  const handleResult = useCallback(async (text: string, isFinal: boolean) => {
    if (!isFinal || !text.trim()) return;
    setPhase('processing');
    const next: Turn[] = [...turnsRef.current, { role: 'user', text, ts: Date.now() }];
    setTurns(next);
    try {
      const reply = await enqueueClaudeCall(async () => {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 200,
            system: SYSTEM_PROMPT(brand, context),
            messages: next.slice(-10).map(t => ({ role: t.role, content: t.text })),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.userMessage || j?.error?.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        return data?.content?.[0]?.text || '';
      });
      const aiTurn: Turn = { role: 'assistant', text: reply, ts: Date.now() };
      setTurns(prev => [...prev, aiTurn]);
      setPhase('ai-speaking');
      tts.speak(reply, {
        onEnd: () => {
          // AI 発話終了後に再び listening
          if (open) {
            setPhase('listening');
            voice.reset();
            voice.start();
          }
        },
      });
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase('idle');
    }
  }, [brand, context, open, tts]);

  const voice = useVoiceInput(handleResult, {
    lang: 'ja-JP',
    continuous: false,
    interimResults: true,
    silenceTimeout: 1800,
    autoSubmit: true,
  });

  // 通話開始 → 挨拶 → listening
  useEffect(() => {
    if (!open) return;
    if (turns.length > 0) return; // 再開時は挨拶不要
    setCallStartedAt(Date.now());
    setPhase('connecting');
    setErrorMsg(null);

    const greeting = GREETINGS[brand];
    setTurns([{ role: 'assistant', text: greeting, ts: Date.now() }]);

    // 0.5 秒後に発話 (TTS voice list ロード待ち)
    const t = setTimeout(() => {
      setPhase('ai-speaking');
      tts.speak(greeting, {
        onEnd: () => {
          if (!open) return;
          setPhase('listening');
          voice.start();
        },
      });
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, brand]);

  // 通話時間タイマー
  useEffect(() => {
    if (!open || !callStartedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, callStartedAt]);

  // 終話処理
  const handleHangUp = useCallback(() => {
    voice.stop();
    tts.cancel();
    setPhase('idle');
    setCallStartedAt(null);
    setTurns([]);
    onClose();
  }, [voice, tts, onClose]);

  // モーダル閉じたらリセット
  useEffect(() => {
    if (!open) {
      voice.stop();
      tts.cancel();
    }
  }, [open, voice, tts]);

  if (!open) return null;

  const elapsed = callStartedAt ? Math.floor((now - callStartedAt) / 1000) : 0;
  const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const ss = (elapsed % 60).toString().padStart(2, '0');

  const aiName = brand === 'iris' ? 'アイリス' : 'プリズム';
  const BrandIcon = brand === 'iris' ? IrisLogo : PrismLogo;

  const lastTurn = turns[turns.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: `radial-gradient(ellipse at top, ${accentColor}33 0%, #0a0a14 50%, #050510 100%)`,
        color: '#fff',
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
    >
      {/* ヘッダ: 通話時間 */}
      <div style={{ padding: '24px 24px 0', textAlign: 'center', flexShrink: 0 }}>
        <p style={{ fontSize: 11, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          VOICE CALL · 接続中
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6, fontFamily: 'monospace' }}>
          {mm}:{ss}
        </p>
      </div>

      {/* AI アバター */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <motion.div
          animate={{
            scale: phase === 'ai-speaking' ? [1, 1.08, 1] : phase === 'listening' ? [1, 1.04, 1] : 1,
          }}
          transition={{ duration: phase === 'ai-speaking' ? 0.7 : 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${accentColor}, ${accentColor}88 60%, ${accentColor}33)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 80px ${accentColor}88, inset 0 0 60px rgba(255,255,255,0.2)`,
            position: 'relative',
            marginBottom: 32,
          }}
        >
          {/* ブランドロゴをアバターとして表示 */}
          <div style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))', transform: 'scale(1.05)' }}>
            <BrandIcon size={120} withWordmark={false} />
          </div>

          {/* リング エフェクト */}
          {(phase === 'ai-speaking' || phase === 'listening') && (
            <>
              <motion.div
                animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${accentColor}`, pointerEvents: 'none' }}
              />
              <motion.div
                animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${accentColor}`, pointerEvents: 'none' }}
              />
            </>
          )}
        </motion.div>

        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>{aiName}</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 24 }}>
          {phase === 'connecting' && '接続中...'}
          {phase === 'ai-speaking' && '🔊 話しています'}
          {phase === 'listening' && '🎙️ 聞いています'}
          {phase === 'processing' && '考えています...'}
          {phase === 'idle' && '待機中'}
        </p>

        {/* 音声インジケーター */}
        {phase === 'listening' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            {[...Array(7)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [8, 24, 8] }}
                transition={{ duration: 0.6 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.07, ease: 'easeInOut' }}
                style={{
                  width: 4,
                  background: accentColor,
                  borderRadius: 2,
                  opacity: 0.85,
                }}
              />
            ))}
          </div>
        )}

        {/* 中間結果 */}
        {voice.interim && phase === 'listening' && (
          <p style={{
            maxWidth: 360,
            fontSize: 14,
            color: 'rgba(255,255,255,0.55)',
            fontStyle: 'italic',
            textAlign: 'center',
            lineHeight: 1.5,
            marginTop: 4,
          }}>
            ...「{voice.interim}」
          </p>
        )}

        {/* 直近の発言 */}
        {lastTurn && phase !== 'listening' && (
          <AnimatePresence mode="wait">
            <motion.div
              key={lastTurn.ts}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              style={{
                maxWidth: 460,
                background: lastTurn.role === 'assistant' ? 'rgba(255,255,255,0.06)' : `${accentColor}22`,
                border: `1px solid ${lastTurn.role === 'assistant' ? 'rgba(255,255,255,0.1)' : accentColor + '50'}`,
                padding: '14px 18px',
                borderRadius: 18,
                fontSize: 15,
                lineHeight: 1.7,
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                {lastTurn.role === 'assistant' ? aiName : 'YOU'}
              </p>
              {lastTurn.text}
            </motion.div>
          </AnimatePresence>
        )}

        {errorMsg && (
          <div style={{
            marginTop: 16,
            padding: '10px 14px',
            background: 'rgba(248,113,113,0.15)',
            border: '1px solid rgba(248,113,113,0.4)',
            borderRadius: 12,
            fontSize: 12,
            color: '#fca5a5',
            maxWidth: 380,
            textAlign: 'center',
          }}>
            ⚠ {errorMsg}
          </div>
        )}
      </div>

      {/* コントロール (下部) */}
      <div style={{ padding: '24px', display: 'flex', justifyContent: 'center', gap: 24, flexShrink: 0 }}>
        {/* マイク手動 toggle */}
        <button
          onClick={() => {
            if (phase === 'listening') {
              voice.stop();
              setPhase('idle');
            } else if (phase === 'idle' || phase === 'ai-speaking') {
              tts.cancel();
              voice.reset();
              voice.start();
              setPhase('listening');
            }
          }}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: phase === 'listening' ? accentColor : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 24,
            cursor: 'pointer',
          }}
          aria-label="マイク toggle"
        >
          🎙️
        </button>

        {/* 終話 */}
        <button
          onClick={handleHangUp}
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            border: 'none',
            color: '#fff',
            fontSize: 30,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(239,68,68,0.5)',
          }}
          aria-label="終話"
        >
          📴
        </button>

        {/* スピーカー (TTS) toggle */}
        <button
          onClick={() => {
            if (tts.state === 'speaking') {
              tts.cancel();
            }
          }}
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: tts.state === 'speaking' ? accentColor : 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff',
            fontSize: 24,
            cursor: 'pointer',
          }}
          aria-label="スピーカー停止"
        >
          🔊
        </button>
      </div>
    </motion.div>
  );
}
