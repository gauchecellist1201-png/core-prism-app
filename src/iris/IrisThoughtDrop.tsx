// ============================================================
// IrisThoughtDrop — フラッグシップ入力
// 「思考を投げるだけ。あとはIrisが全てを支配する。」
//
// Apple ボイスメモ × カレンダーの静謐なミニマリズム。
//   - 巨大な丸角カードに、思いついたことをそのまま投げる (声 or 文字)
//   - 送信すると 1 回の AI リクエストで X / Instagram / note の
//     3 プラットフォーム分を JSON 一括生成 (reelAiCaption パターン踏襲)
//   - 生成中は GenerationOrb。失敗時は必ず「もう一度ためす」を出す
//     (silent fail 禁止 / 復旧手段とセット)
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Sparkles, RefreshCw } from 'lucide-react';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { enqueueClaudeCall } from '../lib/apiQueue';
import { TONE_HEADLINE } from '../lib/aiTone';
import { logIrisActivity } from './irisActivity';
import { IRIS_FONTS, type IrisBackgroundDef } from './irisStyle';
import GenerationOrb from '../components/GenerationOrb';

// ─── 生成結果の型 (IrisPlatformCards と共有) ─────
export interface ThoughtDropResult {
  /** ユーザーが投げた元の思考 (再試行・文脈表示用) */
  sourceThought: string;
  x: { body: string };
  instagram: { caption: string; hashtags: string[]; reelHook: string };
  note: { title: string; lead: string; headings: string[] };
}

// ─── プロンプト (プラットフォーム別トーン&マナーを明記) ─────
const SYSTEM_PROMPT = `あなたは一流のSNS編集者。ユーザーが投げた「思考の断片」を、3つのプラットフォームそれぞれで一番強く届く投稿に仕立てる。

返答は JSON のみ。前後に説明文を一切入れない:
{
  "x": { "body": "X(旧Twitter)の投稿本文" },
  "instagram": {
    "caption": "Instagramのキャプション",
    "hashtags": ["#タグ1", "#タグ2"],
    "reelHook": "この思考をリールにするなら、の冒頭フック案 1行"
  },
  "note": {
    "title": "note記事のタイトル案",
    "lead": "リード文 (200字程度)",
    "headings": ["見出し1", "見出し2", "見出し3"]
  }
}

## プラットフォーム別のトーン&マナー (厳守)
- x: 切れ味。140字以内の強い1文を核に、改行で呼吸を作る。ハッシュタグは0〜1個。飾らない断言。
- instagram: 共感。冒頭1行で心を掴むフック → 本文 → 空行で読みやすく整形。絵文字はユーザーの文体に合わせて最小限 (元の思考に絵文字が無ければ使わない)。ハッシュタグはニッチ+大規模の混合で5〜10個。
- note: 誠実で深い。読み終えた人の見方が少し変わるリード文200字。見出し構成は3〜5個で、物語としての流れを持たせる。

## 共通ルール
- ユーザーの思考の言葉づかい・熱をそのまま活かす。別人の文章にしない
- 数字・事実の捏造禁止。思考に無い実績や数値を勝手に足さない
- x.body は必ず140字以内に収める
${TONE_HEADLINE}`;

// ─── JSON 抜き取り (前後の説明文をはがす — reelAiCaption と同じ) ─────
function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI応答からJSONを取り出せませんでした');
  return JSON.parse(m[0]);
}

// ─── メイン生成 (1 リクエストで 3 プラットフォーム一括) ─────
export async function generateThoughtDrop(thought: string, model?: string): Promise<ThoughtDropResult> {
  const data = await enqueueClaudeCall(async () => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `思考の断片:\n${thought}` }],
      }),
    });
    if (!res.ok) {
      const err: any = await res.json().catch(() => ({}));
      const msg = err?.userMessage || err?.error?.message || `AIエラー: ${res.status}`;
      const recov = err?.recovery || '少し待ってから、もう一度お試しください。';
      throw new Error(`${msg} ${recov}`);
    }
    return res.json();
  });

  const text = data?.content?.[0]?.text ?? '';
  if (!text) throw new Error('AIから空の応答が返りました。もう一度お試しください。');

  let parsed: any;
  try {
    parsed = extractJson(text);
  } catch (e: any) {
    throw new Error(`AI応答を読み取れませんでした: ${e.message}。もう一度お試しください。`);
  }

  const strOf = (v: any) => String(v ?? '').trim();
  const result: ThoughtDropResult = {
    sourceThought: thought,
    x: { body: strOf(parsed?.x?.body) },
    instagram: {
      caption: strOf(parsed?.instagram?.caption),
      hashtags: Array.isArray(parsed?.instagram?.hashtags)
        ? parsed.instagram.hashtags.map((h: any) => strOf(h)).filter((h: string) => h.startsWith('#')).slice(0, 10)
        : [],
      reelHook: strOf(parsed?.instagram?.reelHook),
    },
    note: {
      title: strOf(parsed?.note?.title),
      lead: strOf(parsed?.note?.lead),
      headings: Array.isArray(parsed?.note?.headings)
        ? parsed.note.headings.map((h: any) => strOf(h)).filter(Boolean).slice(0, 5)
        : [],
    },
  };

  if (!result.x.body && !result.instagram.caption && !result.note.lead) {
    throw new Error('AIが投稿を作れませんでした。思考をもう少しだけ具体的にして、もう一度お試しください。');
  }

  logIrisActivity('caption'); // 実際に生成できた時だけ記録 (honest-numbers)
  return result;
}

// ─── 生成中の段階テキスト ─────
const STAGES = [
  '思考を読み取っています…',
  'X の言葉を研いでいます…',
  'Instagram の共感を織っています…',
  'note の構成を組んでいます…',
];

interface Props {
  bg: IrisBackgroundDef;
  /** AI モデル (settings.preferredModel)。未指定なら haiku */
  model?: string;
  /** 生成成功時に結果を親へ渡す (IrisPlatformCards を親側で展開) */
  onResult: (r: ThoughtDropResult) => void;
  /** ヒーロー (IrisCrystalHero) 側に見出しがある時は内部見出しを消す */
  hideHeading?: boolean;
}

export default function IrisThoughtDrop({ bg, model, onResult, hideHeading }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const lastThoughtRef = useRef('');
  const stageTimerRef = useRef<number | null>(null);

  // 音声入力: 確定した端から即テキストに合流 (リアルタイム文字起こし)
  const { state: vState, interim, isAvailable, start, stop, reset } = useVoiceInput(
    (t, isFinal) => { if (isFinal) setText(prev => prev + t); },
    { lang: 'ja-JP', continuous: true, interimResults: true, silenceTimeout: 8000 },
  );
  const listening = vState === 'listening';

  useEffect(() => () => {
    if (stageTimerRef.current) window.clearInterval(stageTimerRef.current);
  }, []);

  const toggleMic = () => {
    if (busy || !isAvailable) return;
    if (listening) { stop(); reset(); }
    else { reset(); start(); }
  };

  const runGenerate = async (thought: string) => {
    setBusy(true);
    setErr(null);
    setStageIdx(0);
    stageTimerRef.current = window.setInterval(() => setStageIdx(i => (i + 1) % STAGES.length), 2200);
    try {
      const r = await generateThoughtDrop(thought, model);
      onResult(r);
      setText('');
    } catch (e: any) {
      setErr(e?.message || '生成に失敗しました。もう一度お試しください。');
    } finally {
      setBusy(false);
      if (stageTimerRef.current) { window.clearInterval(stageTimerRef.current); stageTimerRef.current = null; }
    }
  };

  const submit = () => {
    const thought = (text + (interim || '')).trim();
    if (!thought || busy) return;
    if (listening) { stop(); reset(); }
    lastThoughtRef.current = thought;
    runGenerate(thought);
  };

  const canSubmit = !busy && (text.trim().length > 0 || interim.trim().length > 0);

  return (
    <section aria-label="思考を投げる" style={{ display: 'grid', gap: '0.9rem' }}>
      {/* 見出し */}
      {!hideHeading && (
      <div style={{ textAlign: 'center', padding: '0.25rem 0.5rem 0' }}>
        <p style={{
          fontSize: '0.66rem', letterSpacing: '0.32em', color: bg.accent,
          fontWeight: 800, margin: '0 0 0.45rem', textTransform: 'uppercase',
          fontFamily: IRIS_FONTS.body,
        }}>
          Thought Drop
        </p>
        <h2 style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: 'clamp(1.3rem, 5.2vw, 2rem)',
          color: bg.ink, margin: 0, fontWeight: 500, lineHeight: 1.4,
          wordBreak: 'keep-all', overflowWrap: 'break-word',
        }}>
          思考を投げるだけ。<br />あとはIrisが全てを支配する。
        </h2>
      </div>
      )}

      {/* 入力カード — Apple ボイスメモの静謐さ。余計な装飾ゼロ */}
      <div style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(31,26,46,0.08)',
        borderRadius: 28,
        padding: '1.25rem 1.15rem 1.15rem',
        boxShadow: '0 4px 24px rgba(31,26,46,0.08), 0 1px 0 rgba(255,255,255,0.9) inset',
      }}>
        <textarea
          className="iris-tdrop-ta"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="思いついたこと、そのまま投げてください"
          rows={4}
          disabled={busy}
          style={{
            width: '100%',
            minHeight: 116,
            maxHeight: 280,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            fontSize: 16, // 16px+ で iOS 自動ズーム防止
            lineHeight: 1.75,
            color: '#1F1A2E',
            fontFamily: IRIS_FONTS.body,
            padding: '0.15rem 0.1rem',
            opacity: busy ? 0.55 : 1,
          }}
        />

        {/* リアルタイム文字起こし (確定前の中間テキスト) */}
        <AnimatePresence>
          {listening && interim && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                margin: '0 0 0.4rem', padding: '0 0.1rem',
                color: bg.accent, fontSize: '0.92rem', lineHeight: 1.6,
                fontStyle: 'italic', fontFamily: IRIS_FONTS.serif,
              }}
            >
              {interim}
            </motion.p>
          )}
        </AnimatePresence>

        {/* マイク (録音中は波形パルス) */}
        <div style={{ textAlign: 'center', margin: '0.35rem 0 0.9rem' }}>
          {listening && <WaveBars accent={bg.accent} />}
          {isAvailable && (
            <motion.button
              type="button"
              onClick={toggleMic}
              disabled={busy}
              whileTap={!busy ? { scale: 0.92 } : {}}
              aria-label={listening ? '録音を止める' : '声で投げる'}
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: listening ? '#1F1A2E' : bg.accent,
                color: '#FFFFFF',
                border: 'none',
                cursor: busy ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
                boxShadow: listening
                  ? `0 0 0 10px ${bg.accent}1e, 0 0 0 20px ${bg.accent}0c, 0 8px 22px rgba(31,26,46,0.35)`
                  : `0 8px 24px ${bg.accent}55`,
                animation: listening ? 'iris-tdrop-pulse 1.6s ease-in-out infinite' : 'none',
                opacity: busy ? 0.5 : 1,
              }}
            >
              {listening
                ? <Square size={20} fill="#FFFFFF" strokeWidth={0} />
                : <Mic size={26} strokeWidth={2} />}
            </motion.button>
          )}
          <p style={{
            marginTop: '0.55rem', marginBottom: 0,
            color: '#8A7AA0', fontSize: '0.74rem', fontFamily: IRIS_FONTS.body,
          }}>
            {listening
              ? '聞いています ─ タップで止める'
              : isAvailable
                ? 'タップして、声で投げる'
                : 'この端末は音声に対応していないので、書いて投げてください'}
          </p>
        </div>

        {/* 生成中 / 送信ボタン */}
        {busy ? (
          <div role="status" aria-live="polite" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.7rem',
            padding: '0.9rem 0 0.5rem',
          }}>
            <GenerationOrb brand="iris" size={56} />
            <AnimatePresence mode="wait">
              <motion.p
                key={stageIdx}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                style={{ margin: 0, fontSize: '0.85rem', color: '#3D3247', fontWeight: 600 }}
              >
                {STAGES[stageIdx]}
              </motion.p>
            </AnimatePresence>
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#8A7AA0' }}>
              長くて30秒くらいです
            </p>
          </div>
        ) : (
          <motion.button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            whileTap={canSubmit ? { scale: 0.98 } : {}}
            style={{
              width: '100%', minHeight: 52,
              borderRadius: 16, border: 'none',
              background: canSubmit
                ? 'linear-gradient(135deg, #E1306C 0%, #833AB4 100%)'
                : 'rgba(31,26,46,0.08)',
              color: canSubmit ? '#FFFFFF' : '#8A7AA0',
              fontSize: '0.95rem', fontWeight: 700,
              fontFamily: IRIS_FONTS.body,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: canSubmit ? '0 8px 22px rgba(225,48,108,0.35)' : 'none',
              transition: 'box-shadow 0.2s, background 0.2s',
            }}
          >
            <Sparkles size={17} strokeWidth={2.2} />
            3つの投稿に変える
          </motion.button>
        )}

        {/* エラー: 必ず再試行とセット (silent fail 禁止) */}
        {err && !busy && (
          <div role="alert" style={{
            marginTop: '0.8rem',
            background: '#FDE8EF',
            border: '1px solid rgba(225,48,108,0.3)',
            borderRadius: 14,
            padding: '0.8rem 0.9rem',
          }}>
            <p style={{ margin: '0 0 0.6rem', fontSize: '0.82rem', color: '#8E1F44', lineHeight: 1.6 }}>
              {err}
            </p>
            <button
              type="button"
              onClick={() => (lastThoughtRef.current ? runGenerate(lastThoughtRef.current) : submit())}
              style={{
                minHeight: 44, padding: '0.5rem 1rem',
                borderRadius: 12, border: 'none',
                background: '#E1306C', color: '#FFFFFF',
                fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: IRIS_FONTS.body,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <RefreshCw size={15} strokeWidth={2.4} />
              もう一度ためす
            </button>
          </div>
        )}
      </div>

      <style>{`
        .iris-tdrop-ta::placeholder { color: #A99BBE; }
        @keyframes iris-tdrop-pulse {
          0%, 100% { box-shadow: 0 0 0 10px ${bg.accent}1e, 0 0 0 20px ${bg.accent}0c, 0 8px 22px rgba(31,26,46,0.35); }
          50%      { box-shadow: 0 0 0 18px ${bg.accent}10, 0 0 0 34px ${bg.accent}06, 0 8px 28px rgba(31,26,46,0.4); }
        }
      `}</style>
    </section>
  );
}

// ─── 録音中の波形風パルス ─────
function WaveBars({ accent }: { accent: string }) {
  const heights = [12, 22, 30, 18, 26, 14, 20];
  return (
    <div
      aria-hidden
      style={{
        display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center',
        height: 34, marginBottom: 10,
      }}
    >
      {heights.map((h, i) => (
        <motion.span
          key={i}
          animate={{ scaleY: [0.35, 1, 0.5, 0.9, 0.35] }}
          transition={{ duration: 1.1 + (i % 3) * 0.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
          style={{
            width: 3.5, height: h, borderRadius: 99,
            background: accent, transformOrigin: 'center',
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  );
}
