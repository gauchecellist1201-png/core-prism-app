// ============================================================
// IRIS Voice Home — Gemini Voice 風の対話型ホーム
// 中央に大きい🎙、上部に数字サマリー、下部に AI とのチャット履歴
// ============================================================
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppSettings } from '../types/identity';
import type { MediaKit, InfluencerDeal } from '../types/influencerDeal';
import { chatWithIris, type AssistantMessage } from './irisAssistant';
import { shareToInstagram } from './instagramShare';
import ApiErrorCard from '../components/ApiErrorCard';
import {
  Film, Camera, MessageSquare, BarChart3, HeartPulse, Mic, Mail,
  Image as ImageIcon, Calendar, Wallet, Sparkles, Trash2, ArrowUp,
  Bell, Flame, X,
} from 'lucide-react';
import { IrisHeroGreeting } from './IrisWelcome';
import IrisBondCard from './IrisBondCard';
import { useIrisBond } from './useIrisBond';
import AutoAgentHero from '../components/AutoAgentHero';
import type { AgentContext } from '../lib/autoAgent';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useDailyStreak } from '../hooks/useDailyStreak';
import { useReengagement } from '../hooks/useReengagement';
import {
  notificationPermission,
  notificationSupported,
  notificationAlreadyAsked,
  requestNotificationPermission,
} from '../lib/pushNotify';

const STORAGE_KEY = 'core_iris_voicehome_history_v1';

interface Props {
  bg: IrisBackgroundDef;
  settings: AppSettings;
  myDeals: InfluencerDeal[];
  mediaKit?: MediaKit;
  /** 投稿予約キュー — 緊急アラートに使用 */
  postQueue?: any;
  /** AI が action を返したときにタブ切替する */
  onNavigate?: (tab: string) => void;
}

export default function IrisVoiceHome({ bg, settings, myDeals, mediaKit, postQueue, onNavigate }: Props) {
  const bond = useIrisBond();
  // チャット履歴 (localStorage 永続化)
  const [history, setHistory] = useState<AssistantMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-30))); } catch { /* */ }
  }, [history]);

  const [textInput, setTextInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<{ data: string; mediaType: string; preview: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 音声入力
  const { state: voiceState, transcript, interim, isAvailable: voiceAvailable, start: voiceStart, stop: voiceStop, reset: voiceReset } = useVoiceInput(
    () => { /* on result handled via transcript watcher below */ },
    { lang: 'ja-JP', continuous: true, interimResults: true, silenceTimeout: 2500 }
  );
  const listening = voiceState === 'listening';

  // 音声で確定された transcript を textInput に反映
  useEffect(() => {
    if (!listening && transcript) {
      setTextInput(prev => (prev ? prev + ' ' : '') + transcript);
      voiceReset();
    }
  }, [listening, transcript, voiceReset]);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history.length, busy]);

  // デイリーストリーク (リテンション計測)
  const streakInfo = useDailyStreak();
  // 1 日以上空いた再訪なら朝メールをキック (Resend 未設定なら no-op)
  useReengagement(streakInfo, { brand: 'iris' });

  // 通知パーミッション (default のとき軽い CTA を出す)
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(() =>
    notificationSupported() ? notificationPermission() : 'denied'
  );
  const [notifDismissed, setNotifDismissed] = useState(notificationAlreadyAsked());
  const askNotifPerm = async () => {
    const next = await requestNotificationPermission();
    setNotifPerm(next);
    setNotifDismissed(true);
  };

  // 統計
  const activeCount = myDeals.filter(d => !['closed', 'declined', 'reported'].includes(d.stage)).length;
  const earnings = myDeals.filter(d => ['posted', 'reported', 'closed'].includes(d.stage)).reduce((s, d) => s + (d.fee || 0), 0);
  const upcomingThisWeek = myDeals.flatMap(d => [d.draftDeadline, d.postDeadline, d.reportDeadline])
    .filter(Boolean)
    .filter(iso => {
      if (!iso) return false;
      const days = (new Date(iso).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    }).length;

  // 画像追加
  const handleAddImages = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const next: typeof pendingImages = [];
    for (let i = 0; i < files.length && pendingImages.length + next.length < 3; i++) {
      const f = files[i];
      if (!f.type.startsWith('image/')) continue;
      const reader = new FileReader();
      const dataUrl: string = await new Promise(res => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(f);
      });
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) next.push({ mediaType: m[1], data: m[2], preview: dataUrl });
    }
    setPendingImages(p => [...p, ...next]);
  }, [pendingImages]);

  // ペースト (クリップボード画像)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItems = items.filter(it => it.type.startsWith('image/'));
      if (imageItems.length === 0) return;
      const dt = new DataTransfer();
      for (const it of imageItems) {
        const f = it.getAsFile();
        if (f) dt.items.add(f);
      }
      handleAddImages(dt.files);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleAddImages]);

  // 送信
  const send = async () => {
    const userText = (textInput + (interim ? ' ' + interim : '')).trim();
    if (!userText && pendingImages.length === 0) return;
    if (busy) return;

    if (listening) voiceStop();

    const userMsg: AssistantMessage = {
      role: 'user',
      content: userText || '(画像のみ)',
      timestamp: new Date().toISOString(),
      images: pendingImages.length ? pendingImages.map(({ data, mediaType }) => ({ data, mediaType })) : undefined,
    };
    setHistory(prev => [...prev, userMsg]);
    setTextInput('');
    setPendingImages([]);
    setErr(null);
    setBusy(true);

    try {
      const res = await chatWithIris({
        settings, history,
        userMessage: userText || '(画像)',
        userImages: userMsg.images,
        mediaKit,
        bondContext: bond.aiContext,
      });
      const aiMsg: AssistantMessage = {
        role: 'assistant',
        content: res.reply,
        intent: res.intent,
        actions: res.actions,
        timestamp: new Date().toISOString(),
      };
      setHistory(prev => [...prev, aiMsg]);
    } catch (e: any) {
      setErr(e.message || '送信失敗');
    } finally { setBusy(false); }
  };

  const clearChat = () => {
    if (confirm('チャット履歴をクリアしますか?')) setHistory([]);
  };

  const isDarkBg = bg.id === 'neon-night';
  const subtleColor = isDarkBg ? 'rgba(255,255,255,0.7)' : '#5A4570';

  // ─── 緊急アラート集計 (今日対応必須) ─────
  const urgent = useMemo(() => {
    const list: { kind: 'ready_post' | 'overdue_reply' | 'due_today' | 'due_24h'; label: string; tab: string; n?: number }[] = [];
    // 1. 投稿予約 ready (時刻到達 / 過ぎ)
    const readyPosts = postQueue?.posts?.filter((p: any) => p.status === 'ready') || [];
    if (readyPosts.length) list.push({ kind: 'ready_post', label: `投稿時刻 ${readyPosts.length} 件`, tab: 'schedule', n: readyPosts.length });
    // 2. 返信遅延 (inquiry のまま 48h+)
    const overdue = myDeals.filter(d => {
      if (d.stage !== 'inquiry') return false;
      const ts = (d as any).createdAt ? new Date((d as any).createdAt).getTime() : 0;
      return ts && Date.now() - ts > 48 * 3_600_000;
    });
    if (overdue.length) list.push({ kind: 'overdue_reply', label: `返信遅延 ${overdue.length} 件`, tab: 'deals', n: overdue.length });
    // 3. 納期 24h 以内
    const dueSoon = myDeals.filter(d => {
      const dates = [d.draftDeadline, d.postDeadline, d.reportDeadline].filter(Boolean) as string[];
      return dates.some(iso => {
        const dt = new Date(iso).getTime();
        const diff = dt - Date.now();
        return diff > 0 && diff < 24 * 3_600_000;
      });
    });
    if (dueSoon.length) list.push({ kind: 'due_24h', label: `納期 24h 以内 ${dueSoon.length} 件`, tab: 'deals', n: dueSoon.length });
    return list;
  }, [postQueue?.posts, myDeals]);

  // ─── 今日のリール候補 (バイラルパターンから AI ピック / 簡易版) ─────
  const todayReelHint = useMemo(() => {
    // 日付からハッシュして安定的にピック
    const day = new Date().getDate();
    const HINTS = [
      { name: 'POV ストーリーテリング', why: '今日は内省的な日。共感×ストーリーで深いシェアを', emoji: '✦', mood: 'emotional' },
      { name: '知っとくべき 3 つの◯◯',   why: '情報密度の高い保存型。保存率トップ',                emoji: '⌥', mood: 'inspiring' },
      { name: 'GRWM (Get Ready)',     why: '朝活コンテンツ。完視聴率 1.65×',                    emoji: '◊', mood: 'chill pop' },
      { name: 'Before / After 変化',  why: 'シェア率最高。視覚インパクトで拡散',                emoji: '⟁', mood: 'cinematic' },
      { name: '「正直に言うと…」型',    why: 'シェア性 5/5。今日は本音を出す日',                  emoji: '◉', mood: 'ambient' },
      { name: '誤解バスター (逆張り)',  why: '保存・シェア・コメ三冠。逆張りで突き抜けろ',        emoji: '✕', mood: 'dramatic' },
      { name: 'ボイスオーバー B-roll', why: 'アルゴ最適 (字幕 + 動画素材)',                      emoji: '⟿', mood: 'minimal' },
    ];
    return HINTS[day % HINTS.length];
  }, []);

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {/* 通知 opt-in CTA (default & 未提示) */}
      {notificationSupported() && notifPerm === 'default' && !notifDismissed && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          onClick={askNotifPerm}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            padding: '0.5rem 0.9rem', borderRadius: 999,
            background: isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(225,48,108,0.08)',
            border: `1px dashed ${bg.accent}77`, color: bg.ink,
            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
            width: 'fit-content', margin: '0 auto',
          }}
          aria-label="ブリーフ通知をオンにする"
        >
          <Bell size={13} /> 朝・昼・晩のブリーフを通知で受け取る
        </motion.button>
      )}

      {/* デイリーストリーク (リテンション・バッジ) */}
      {streakInfo.streak >= 1 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem',
            padding: '0.55rem 1rem',
            borderRadius: 999,
            background: isDarkBg
              ? 'linear-gradient(135deg, rgba(255,140,90,0.22), rgba(225,48,108,0.22))'
              : 'linear-gradient(135deg, rgba(255,140,90,0.14), rgba(225,48,108,0.14))',
            border: `1px solid ${bg.accent}55`,
            color: bg.ink,
            fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.02em',
            width: 'fit-content', margin: '0 auto',
          }}
          aria-label={`連続起動 ${streakInfo.streak} 日`}
          title={streakInfo.best > streakInfo.streak ? `最高記録: ${streakInfo.best} 日` : '最高記録更新中'}
        >
          <Flame size={14} color={bg.accent} />
          <span>
            {streakInfo.streak === 1
              ? '今日も Iris 開いた!'
              : `今日も Iris 開いた! ${streakInfo.streak} 日連続`}
          </span>
        </motion.div>
      )}

      {/* 上部: 数字サマリー (極小) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
      }}>
        <SummaryCard bg={bg} label="進行中"   value={activeCount + ' 件'}      Icon={Mail} />
        <SummaryCard bg={bg} label="今週納期" value={upcomingThisWeek + ' 件'} Icon={Calendar} />
        <SummaryCard bg={bg} label="今月報酬" value={'¥' + (earnings / 1000).toFixed(0) + 'K'} Icon={Wallet} />
      </div>

      {/* ── 自律エージェント: Iris が考えた次の一手 ── */}
      <AutoAgentHero
        ctx={{
          brand: 'iris',
          user: mediaKit?.handleName,
          persona: mediaKit?.handleName,
          now: new Date(),
          bondContext: bond.aiContext,
          deals: myDeals.length
            ? `${myDeals.length} 件進行中。stage: ${[...new Set(myDeals.map((d: any) => d.stage))].join(', ')}`
            : '案件まだなし',
          postQueue: postQueue?.posts?.length
            ? `${postQueue.posts.length} 件キュー中 (ready: ${postQueue.posts.filter((p: any) => p.status === 'ready').length})`
            : '予約投稿まだなし',
        } as AgentContext}
        onJump={onNavigate}
      />

      <IrisBondCard bg={bg} />
      <IrisHeroGreeting
        bg={bg}
        handle={mediaKit?.handleName}
        preparedReel={{ name: todayReelHint.name, reason: `${todayReelHint.why} · BGM: ${todayReelHint.mood}` }}
        readyPostCount={(postQueue?.posts || []).filter((p: any) => p.status === 'ready' || p.status === 'scheduled').length}
        pendingReplies={urgent.find((u: { kind: string }) => u.kind === 'overdue_reply')?.n || 0}
        onJump={(t) => onNavigate?.(t)}
      />

      {/* AI 名前 + 開始メッセージ */}
      <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
        <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.8rem', letterSpacing: '0.3em', color: bg.accent, fontWeight: 700, marginBottom: '0.4rem', textTransform: 'uppercase' }}>
          Your AI Manager
        </p>
        <h2 style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: 'clamp(1.5rem, 5.5vw, 2.4rem)',
          color: bg.ink, margin: 0, fontWeight: 500, lineHeight: 1.25,
          textWrap: 'balance' as any,
          wordBreak: 'keep-all',
          overflowWrap: 'break-word',
          padding: '0 0.5rem',
        }}>
          おかえり。<br className="iris-okaeri-br" />なんでも話して。
        </h2>
        <p style={{ color: subtleColor, fontSize: '0.85rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
          スクショ・声・テキスト ── どれでも OK
        </p>
      </div>

      {/* チャット履歴 */}
      <div ref={scrollRef} style={{
        background: bg.card, backdropFilter: 'blur(12px)',
        border: `1px solid ${bg.cardBorder}`, borderRadius: 22,
        padding: '1.2rem',
        minHeight: 280, maxHeight: 'min(60vh, 540px)', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '0.85rem',
      }}>
        {history.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
              boxShadow: `0 10px 28px ${bg.accent}66, inset 0 1px 0 rgba(255,255,255,0.22)`,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '0.85rem',
            }}>
              <Sparkles size={30} color="#fff" strokeWidth={2.2} />
            </div>
            <p style={{ fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '1.15rem', color: bg.ink, marginBottom: '1rem' }}>
              何から、はなしましょうか?
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', maxWidth: 600, width: '100%' }}>
              {/* 動画スタジオへの直接ナビ */}
              <button onClick={() => onNavigate?.('video')} style={{
                background: `linear-gradient(135deg, ${bg.accent}22, ${bg.accent}11)`,
                border: `1px solid ${bg.accent}55`,
                borderRadius: 12, padding: '0.7rem 0.9rem',
                cursor: 'pointer', fontSize: '0.88rem',
                color: bg.ink, fontFamily: IRIS_FONTS.body, textAlign: 'left',
                fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '0.55rem',
              }}>
                <Film size={16} color={bg.accent} strokeWidth={2.2} />
                動画スタジオを開く
              </button>
              {[
                { Ico: Camera, t: 'スクショから案件追加' },
                { Ico: MessageSquare, t: '断り文を書いて' },
                { Ico: BarChart3, t: '今週、何投稿すべき?' },
                { Ico: HeartPulse, t: '肌が荒れて困ってる' },
              ].map(s => (
                <button key={s.t} onClick={() => setTextInput(s.t)} style={{
                  background: 'rgba(255,255,255,0.85)',
                  border: `1px solid ${bg.cardBorder}`,
                  borderRadius: 12, padding: '0.7rem 0.9rem',
                  cursor: 'pointer', fontSize: '0.88rem',
                  color: '#1F1A2E', fontFamily: IRIS_FONTS.body, textAlign: 'left',
                  display: 'inline-flex', alignItems: 'center', gap: '0.55rem',
                }}>
                  <s.Ico size={16} color={bg.accent} strokeWidth={2.2} />
                  {s.t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {history.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  display: 'flex', flexDirection: 'column', gap: '0.4rem',
                }}
              >
                {/* 画像 (ユーザー側) */}
                {m.images && m.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    {m.images.map((img, ii) => (
                      <img key={ii}
                        src={`data:${img.mediaType};base64,${img.data}`}
                        alt=""
                        style={{ maxWidth: 140, borderRadius: 12, border: `1px solid ${bg.cardBorder}` }} />
                    ))}
                  </div>
                )}
                <div style={{
                  background: m.role === 'user' ? bg.accent : 'rgba(255,255,255,0.94)',
                  color: m.role === 'user' ? '#FFFFFF' : '#1F1A2E',
                  padding: '0.7rem 1rem',
                  borderRadius: m.role === 'user' ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                  fontSize: '0.94rem', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                }}>
                  {m.content}
                </div>
                {/* AI からの提案アクション (タブへ誘導) */}
                {m.role === 'assistant' && m.actions && m.actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {m.actions.map((a, ai) => (
                      <button key={ai}
                        onClick={() => onNavigate?.(a.tab)}
                        style={{
                          background: 'rgba(255,255,255,0.94)',
                          border: `1px solid ${bg.accent}55`,
                          color: bg.accent,
                          borderRadius: 999, padding: '0.4rem 0.95rem',
                          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                          fontFamily: IRIS_FONTS.body,
                          boxShadow: `0 2px 8px ${bg.accent}22`,
                        }}>
                        {a.emoji ? a.emoji + ' ' : ''}{a.label} →
                      </button>
                    ))}
                  </div>
                )}
                {/* Instagram 投稿ボタン: AI 応答が投稿系コピーを含む場合に表示 */}
                {m.role === 'assistant' && /(?:キャプション|投稿|ハッシュタグ|ストーリー|caption|hashtag)/i.test(m.content) && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={async () => {
                        const r = await shareToInstagram({ caption: m.content, filename: `iris-voice-${Date.now()}.png` });
                        alert(r.message);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #FCB045 0%, #E1306C 50%, #833AB4 100%)',
                        color: '#fff', border: 'none',
                        borderRadius: 999, padding: '0.5rem 1.1rem',
                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: IRIS_FONTS.body,
                        boxShadow: '0 4px 14px rgba(225,48,108,0.32)',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                      <Camera size={14} strokeWidth={2.4} />
                      Instagram で投稿
                    </button>
                    <button
                      onClick={async () => {
                        const r = await shareToInstagram({ caption: m.content, filename: `iris-story-${Date.now()}.png`, asStory: true });
                        alert(r.message);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.94)',
                        border: `1px solid ${bg.accent}55`,
                        color: bg.accent,
                        borderRadius: 999, padding: '0.5rem 1.1rem',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        fontFamily: IRIS_FONTS.body,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                      <ImageIcon size={14} strokeWidth={2.4} />
                      ストーリーへ
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {busy && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              alignSelf: 'flex-start',
              padding: '0.7rem 1rem',
              background: 'rgba(255,255,255,0.94)',
              borderRadius: '20px 20px 20px 6px',
              color: '#5A4570',
            }}>
            <span style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <motion.span key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: bg.accent,
                  }} />
              ))}
            </span>
          </motion.div>
        )}
      </div>

      <ApiErrorCard error={err} variant="light" />

      {/* 入力エリア (中央に大きいマイク + 補助テキスト + 画像添付) */}
      <div style={{
        background: bg.card, backdropFilter: 'blur(12px)',
        border: `1px solid ${bg.cardBorder}`, borderRadius: 24,
        padding: '1rem',
      }}>
        {/* 添付画像プレビュー */}
        {pendingImages.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            {pendingImages.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img.preview} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 10, border: `1px solid ${bg.cardBorder}` }} />
                <button onClick={() => setPendingImages(p => p.filter((_, idx) => idx !== i))} style={{
                  position: 'absolute', top: -6, right: -6,
                  background: '#1F1A2E', color: '#fff', border: 'none',
                  borderRadius: '50%', width: 22, height: 22, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                }} aria-label="画像を削除"><X size={12} strokeWidth={2.5} /></button>
              </div>
            ))}
          </div>
        )}

        {/* 中央のマイクボタン */}
        <div style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
          <motion.button
            onClick={listening ? voiceStop : (voiceAvailable ? voiceStart : undefined)}
            disabled={!voiceAvailable || busy}
            whileTap={voiceAvailable && !busy ? { scale: 0.95 } : {}}
            style={{
              width: 88, height: 88, borderRadius: '50%',
              background: listening
                ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`
                : `linear-gradient(135deg, ${bg.accent}ee, ${bg.accent}aa)`,
              color: '#fff',
              border: `3px solid rgba(255,255,255,0.4)`,
              fontSize: '2.6rem', cursor: voiceAvailable && !busy ? 'pointer' : 'not-allowed',
              boxShadow: listening
                ? `0 0 0 14px ${bg.accent}22, 0 0 0 28px ${bg.accent}11, 0 12px 32px ${bg.accent}66`
                : `0 12px 32px ${bg.accent}66`,
              animation: listening ? 'voice-home-pulse 1.6s ease-in-out infinite' : 'none',
              opacity: voiceAvailable ? 1 : 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {listening ? (
              <span style={{ display: 'inline-block', width: 28, height: 28, background: '#fff', borderRadius: 4 }} />
            ) : (
              <Mic size={38} strokeWidth={2.0} color="#fff" />
            )}
          </motion.button>
          <p style={{ marginTop: '0.5rem', color: subtleColor, fontSize: '0.78rem' }}>
            {listening ? '聞いてます…' : voiceAvailable ? '押して話す or 下に書く' : '(音声非対応)'}
          </p>
          {interim && (
            <p style={{ marginTop: '0.3rem', color: bg.accent, fontSize: '0.85rem', fontStyle: 'italic' }}>
              {interim}
            </p>
          )}
        </div>

        {/* 補助テキスト + 画像 + 送信 */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <label style={{
            background: 'rgba(255,255,255,0.92)',
            border: `1px solid ${bg.cardBorder}`,
            borderRadius: 14, width: 44, height: 44,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <Camera size={20} color={bg.accent} strokeWidth={2.2} />
            <input type="file" accept="image/*" multiple style={{ display: 'none' }}
              onChange={e => handleAddImages(e.target.files)} />
          </label>

          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="書いてもいい… (Cmd/Ctrl+Enter で送信)"
            rows={1}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.94)',
              border: `1px solid ${bg.cardBorder}`,
              borderRadius: 14,
              padding: '0.7rem 0.95rem',
              fontSize: '0.95rem',
              fontFamily: IRIS_FONTS.body,
              color: '#1F1A2E',
              outline: 'none',
              resize: 'none',
              minHeight: 44,
              maxHeight: 140,
            }}
          />

          <button
            onClick={send}
            disabled={busy || (!textInput.trim() && pendingImages.length === 0)}
            style={{
              background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              width: 44, height: 44,
              cursor: busy ? 'wait' : 'pointer',
              fontSize: '1.1rem',
              fontFamily: IRIS_FONTS.body,
              fontWeight: 700,
              flexShrink: 0,
              boxShadow: `0 6px 16px ${bg.accent}55`,
              opacity: busy || (!textInput.trim() && pendingImages.length === 0) ? 0.5 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {busy ? '···' : <ArrowUp size={20} strokeWidth={2.6} />}
          </button>
        </div>

        {history.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button onClick={clearChat} style={{
              background: 'transparent', color: subtleColor,
              border: 'none', cursor: 'pointer', fontSize: '0.78rem', padding: '0.2rem 0.5rem',
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            }}>
              <Trash2 size={13} strokeWidth={2.2} /> 履歴を消す
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes voice-home-pulse {
          0%, 100% { box-shadow: 0 0 0 14px ${bg.accent}22, 0 0 0 28px ${bg.accent}11, 0 12px 32px ${bg.accent}66; }
          50%     { box-shadow: 0 0 0 24px ${bg.accent}11, 0 0 0 48px ${bg.accent}05, 0 12px 40px ${bg.accent}99; }
        }
      `}</style>
    </div>
  );
}

function SummaryCard({ bg, label, value, Icon }: { bg: IrisBackgroundDef; label: string; value: string; Icon: any }) {
  // 数字部分とサフィックス (例: '3 件' / '¥12K') を分離して、数字を強く目立たせる
  const m = value.match(/^([¥]?[\d.,]+)\s*(.*)$/);
  const num = m ? m[1] : value;
  const suffix = m ? m[2] : '';
  return (
    <div style={{
      background: bg.card, backdropFilter: 'blur(8px)',
      border: `1px solid ${bg.cardBorder}`, borderRadius: 16,
      padding: '0.7rem 0.85rem',
      minHeight: 76,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
        <Icon size={14} color={bg.accent} strokeWidth={2.2} />
        <span style={{ fontSize: '0.68rem', color: bg.inkSoft, letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{
        fontFamily: IRIS_FONTS.body,
        color: bg.ink, lineHeight: 1.1,
        display: 'flex', alignItems: 'baseline', gap: '0.2rem',
      }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{num}</span>
        {suffix && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: bg.inkSoft }}>{suffix}</span>}
      </div>
    </div>
  );
}
