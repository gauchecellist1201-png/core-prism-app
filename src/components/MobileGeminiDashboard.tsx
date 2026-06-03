// ============================================================
// MobileGeminiDashboard — iPhone 向け ジェミニ風 シンプル UI
//
// オーナー指示 (2026-06-03):
//   「携帯の方の UI はすごくシンプルに。7 エージェント + チャットボットだけ。
//    ジェミニみたいな UI で、実行していったことをひたすら表示するだけ。
//    細かい機能は閉じて開けるように。」
//
// 構成 (上から):
//   ① ヘッダー: 人格 / ペルソナ名 (折り畳み中の機能 ボタン)
//   ② 7 エージェント (CEO/営業/CFO/クリエ/ナレッジ/ピープル/ライフ) 横スクロール
//   ③ チャット欄 (タイムラインで「実行した結果」がストリーム表示)
//   ④ 13 CXO ピル (chip) — 任意で開く
//   ⑤ ボトム: テキスト入力 + 「✦」マイク
// ============================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Send, ChevronDown, ChevronUp, Settings, Plus } from 'lucide-react';
import type { Persona, AppSettings } from '../types/identity';
import { useClaude, selectRelevantKnowledge } from '../hooks/useClaude';
import type { KnowledgeItem } from '../types/identity';
import { executeAction, type ExecutionPlan } from '../lib/actionExecutor';
import { CXO_META, cxoDisplayName, type CxoRole } from '../hooks/useAgentTaskQueue';

interface Props {
  persona: Persona;
  allPersonas: Persona[];
  settings: AppSettings;
  knowledgeItems: KnowledgeItem[];
  onSwitch: (id: string) => void;
  onOpenSettings: () => void;
  onOpenFullFeatures: () => void;
  onAgentOpen: (key: 'ceo' | 'sales' | 'cfo' | 'creative' | 'knowledge' | 'people' | 'life') => void;
  /** Iris ブランドでは 6 エージェント + ピンク (オーナー指示 2026-06-03) */
  brand?: 'prism' | 'iris';
}

type Msg = {
  id: string;
  kind: 'user' | 'ai' | 'plan' | 'system';
  text?: string;
  plan?: ExecutionPlan;
  agentKey?: string;
  ts: number;
};

const AGENTS_PRISM = [
  { key: 'ceo',       emoji: '👑', name: 'CEO 経営', tagline: '今月どう動く?' },
  { key: 'sales',     emoji: '💼', name: '営業',     tagline: '次の一手は?' },
  { key: 'cfo',       emoji: '📊', name: 'CFO',     tagline: '数字を読む' },
  { key: 'creative',  emoji: '✨', name: 'クリエ',   tagline: '原稿を書く' },
  { key: 'knowledge', emoji: '📚', name: 'ナレッジ', tagline: '資料を読む' },
  { key: 'people',    emoji: '🌷', name: 'ピープル', tagline: 'チームを見る' },
  { key: 'life',      emoji: '🌅', name: 'ライフ',   tagline: '身体を見る' },
] as const;

const AGENTS_IRIS = [
  { key: 'creative',  emoji: '🎬', name: '戦略',     tagline: '今月のテーマ' },
  { key: 'creative',  emoji: '🎨', name: '演出',     tagline: 'サムネ AB' },
  { key: 'sales',     emoji: '💼', name: '案件',     tagline: '交渉 / 単価' },
  { key: 'people',    emoji: '💖', name: 'ファン',   tagline: '返信文 下書き' },
  { key: 'cfo',       emoji: '💰', name: '収益',     tagline: '物販 / 投げ銭' },
  { key: 'life',      emoji: '🌙', name: '健康',     tagline: '休む時間' },
] as const;

const CXO_PILLS = [
  { key: 'CEO', emoji: '👑' }, { key: 'CTO', emoji: '⚙' }, { key: 'CPO', emoji: '🧭' },
  { key: 'CDO', emoji: '🎨' }, { key: 'CMO', emoji: '📣' }, { key: 'CSO', emoji: '🎯' },
  { key: 'CFO', emoji: '💰' }, { key: 'COO', emoji: '🗂' }, { key: 'CDS', emoji: '🔬' },
  { key: 'CLO', emoji: '⚖' }, { key: 'CHR', emoji: '🤝' }, { key: 'UIE', emoji: '✨' },
  { key: 'UXE', emoji: '👁' }, { key: 'QAE', emoji: '✓' },
];

const STORAGE_KEY = 'core_mobile_gemini_v1';

function loadMessages(personaId: string): Msg[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${personaId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(-100) : [];
  } catch { return []; }
}
function saveMessages(personaId: string, msgs: Msg[]) {
  try { localStorage.setItem(`${STORAGE_KEY}:${personaId}`, JSON.stringify(msgs.slice(-100))); } catch { /* */ }
}

export default function MobileGeminiDashboard({
  persona, allPersonas, settings, knowledgeItems,
  onSwitch, onOpenSettings, onOpenFullFeatures, onAgentOpen,
  brand = 'prism',
}: Props) {
  const AGENTS = brand === 'iris' ? AGENTS_IRIS : AGENTS_PRISM;
  const [msgs, setMsgs] = useState<Msg[]>(() => loadMessages(persona.id));
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showCxoRow, setShowCxoRow] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  // CXO ピルをタップ → 「この CXO に任せる 3 候補」を出して選択させる
  const [openCxoPicker, setOpenCxoPicker] = useState<CxoRole | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 人格切替で履歴を入れ替え
  useEffect(() => {
    setMsgs(loadMessages(persona.id));
  }, [persona.id]);

  // 朝のブリーフ自動生成 — その日初めて開いた時 + 履歴が空の時のみ
  // (オーナー指示 2026-06-03: 自律実行 — ユーザーが空のチャットを見るだけで時間が止まらないように)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const briefKey = `core_mobile_brief_shown:${persona.id}:${today}`;
    const alreadyShownToday = localStorage.getItem(briefKey) === '1';
    if (alreadyShownToday) return;
    if (msgs.length > 0) return;
    // 履歴が空 + 今日まだ表示してない → 自動でブリーフを生成
    const hour = new Date().getHours();
    const greet = hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';
    const personaName = persona.name;
    const sysHint = `${greet}、${personaName} さん。\n\n今日まずやる「最優先 1 つ」と、AI がいま代わりに進められる「アクション 3 つ」を出して。短く 200 字以内。最後に「下のエージェントに任せる?」と一言。`;
    setBusy(true);
    (async () => {
      try {
        const personaKnowledge = knowledgeItems.filter(k => k.personaId === persona.id);
        const reply = await sendMessage(persona, sysHint, [], [], personaKnowledge.slice(0, 3));
        if (reply?.content) {
          setMsgs([{ id: `b_${Date.now()}`, kind: 'ai', text: reply.content, ts: Date.now() }]);
          try { localStorage.setItem(briefKey, '1'); } catch { /* */ }
        }
      } catch { /* fail silently — 既存 example prompts を表示 */ }
      setBusy(false);
    })();
    // 依存配列を意図的に [persona.id] のみにして、msgs 更新でループしないように
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.id]);

  // 自動保存
  useEffect(() => { saveMessages(persona.id, msgs); }, [persona.id, msgs]);

  // 末尾へスクロール
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs.length]);

  const { sendMessage } = useClaude(settings, () => { /* updateUsageStats noop here */ });

  const appendMsg = useCallback((m: Omit<Msg, 'id' | 'ts'>) => {
    const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setMsgs(prev => [...prev, { ...m, id, ts: Date.now() }]);
    return id;
  }, []);

  const handleSend = async (txt?: string) => {
    const text = (txt ?? input).trim();
    if (!text || busy) return;
    setInput('');
    appendMsg({ kind: 'user', text });
    setBusy(true);
    try {
      const personaKnowledge = knowledgeItems.filter(k => k.personaId === persona.id);
      const relevantItems = selectRelevantKnowledge(text, personaKnowledge, 5);
      const queryWords = text.toLowerCase().split(/[\s　、。!?,.]+/).filter(w => w.length > 1);
      const relevantChunks = relevantItems.length > 0
        ? relevantItems
            .flatMap(item => item.chunks.map(chunk => ({
              ...chunk,
              score: queryWords.reduce((s, w) => s + (chunk.content.toLowerCase().includes(w) ? 1 : 0), 0),
            })))
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
        : [];
      const chatHistory = msgs.filter(m => m.kind === 'user' || m.kind === 'ai').map(m => ({
        role: m.kind === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text || '',
        timestamp: new Date(m.ts).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
      }));
      const reply = await sendMessage(persona, text, chatHistory, relevantChunks, relevantItems);
      appendMsg({ kind: 'ai', text: reply?.content || '応答を取得できませんでした' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '実行に失敗しました';
      appendMsg({ kind: 'system', text: `⚠ ${msg}` });
    } finally {
      setBusy(false);
    }
  };

  // 「実行」モード: AI が手順 + 成果物を出す (CXO ピル選択時)
  const handleExecute = async (action: string, cxoLabel?: string) => {
    if (busy) return;
    appendMsg({ kind: 'user', text: cxoLabel ? `📋 ${cxoLabel}: ${action}` : `📋 「${action}」を実行` });
    setBusy(true);
    try {
      const plan = await executeAction(action, persona, settings);
      appendMsg({ kind: 'plan', plan });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '実行に失敗しました';
      appendMsg({ kind: 'system', text: `⚠ ${msg}` });
    } finally {
      setBusy(false);
    }
  };

  // Iris ブランドはピンク〜オレンジを強制 (persona.accentColor を上書き)
  const accent = brand === 'iris' ? '#E1306C' : persona.accentColor;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-1, #0c0c14)',
      color: '#fff',
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* ── ヘッダー ─────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: `linear-gradient(180deg, ${accent}12, transparent)`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => setShowPersonaPicker(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', padding: '4px 8px', borderRadius: 8,
            flex: 1, minWidth: 0,
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
          }}>{persona.icon}</div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{persona.name}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>タップで切替</div>
          </div>
          <ChevronDown size={14} style={{ opacity: 0.5 }} />
        </button>
        <button
          onClick={onOpenFullFeatures}
          title="細かい機能を全部見る"
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer',
            fontSize: 11, fontWeight: 700,
          }}
        >機能</button>
        <button
          onClick={onOpenSettings}
          title="設定"
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: 6, color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><Settings size={14} /></button>
      </header>

      {/* 人格切替 ドロップダウン */}
      <AnimatePresence>
        {showPersonaPicker && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              position: 'absolute', top: 60, left: 12, right: 12, zIndex: 30,
              background: 'rgba(15,15,25,0.96)', backdropFilter: 'blur(20px)',
              borderRadius: 14, border: `1px solid ${accent}33`,
              padding: 8, maxHeight: 280, overflow: 'auto',
            }}
          >
            {allPersonas.map(p => (
              <button
                key={p.id}
                onClick={() => { onSwitch(p.id); setShowPersonaPicker(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: p.id === persona.id ? `${p.accentColor}22` : 'transparent',
                  border: 'none', color: '#fff', cursor: 'pointer',
                  textAlign: 'left', fontSize: 13,
                }}
              >
                <span style={{ fontSize: 20 }}>{p.icon}</span>
                <span style={{ flex: 1, fontWeight: 600 }}>{p.name}</span>
                {p.id === persona.id && <span style={{ fontSize: 11, color: p.accentColor }}>✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 7 エージェント (横スクロール) ─────── */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden',
        padding: '12px 12px 4px',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0,
      }} className="hide-scrollbar">
        {AGENTS.map((a) => (
          <button
            key={a.key}
            onClick={() => {
              onAgentOpen(a.key);
              // 実行ログを表示
              appendMsg({ kind: 'system', text: `🟢 ${a.name} エージェントを開きました`, agentKey: a.key });
            }}
            style={{
              flex: '0 0 auto', scrollSnapAlign: 'start',
              width: 88, padding: '10px 6px', borderRadius: 14,
              background: `linear-gradient(160deg, ${accent}18, rgba(255,255,255,0.03))`,
              border: `1px solid ${accent}33`,
              color: '#fff', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              fontSize: 11,
            }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: `${accent}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>{a.emoji}</div>
            <div style={{ fontWeight: 800, fontSize: 11 }}>{a.name}</div>
            <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.2, textAlign: 'center' }}>
              {a.tagline}
            </div>
          </button>
        ))}
      </div>

      {/* ── 13 CXO ピル (折り畳み) ────────────── */}
      <button
        onClick={() => setShowCxoRow(s => !s)}
        style={{
          margin: '4px 12px 0', padding: '6px 12px', borderRadius: 999,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.7)', fontSize: 11.5, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          flexShrink: 0,
        }}
      >
        13 名の AI 役員 {showCxoRow ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      <AnimatePresence>
        {showCxoRow && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{
              display: 'flex', gap: 6, overflowX: 'auto',
              padding: '10px 12px 6px',
              WebkitOverflowScrolling: 'touch',
              flexShrink: 0,
            }}
            className="hide-scrollbar"
          >
            {CXO_PILLS.map(c => (
              <button
                key={c.key}
                onClick={() => setOpenCxoPicker(c.key as CxoRole)}
                style={{
                  flex: '0 0 auto',
                  padding: '6px 11px', borderRadius: 999,
                  background: openCxoPicker === c.key ? `${accent}22` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${accent}44`,
                  color: '#fff', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontSize: 14 }}>{c.emoji}</span>
                {c.key}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CXO Action Picker (タップ → 3 候補から選んで AI 実行) */}
      <AnimatePresence>
        {openCxoPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              padding: 14,
            }}
            onClick={() => setOpenCxoPicker(null)}
          >
            <motion.div
              initial={{ y: 30 }} animate={{ y: 0 }} exit={{ y: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 460,
                background: 'rgba(20,20,30,0.98)',
                borderRadius: 22,
                border: `1px solid ${CXO_META[openCxoPicker].color}66`,
                padding: '20px 16px 24px',
                boxShadow: `0 20px 50px ${CXO_META[openCxoPicker].color}44`,
              }}
            >
              {/* ヘッダー */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `linear-gradient(135deg, ${CXO_META[openCxoPicker].color}, ${CXO_META[openCxoPicker].color}99)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>{CXO_META[openCxoPicker].emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                    {cxoDisplayName(openCxoPicker)}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                    {CXO_META[openCxoPicker].tagline}
                  </div>
                </div>
                <button onClick={() => setOpenCxoPicker(null)} style={{
                  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
                  fontSize: 22, cursor: 'pointer',
                }}>×</button>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 10, letterSpacing: '0.1em' }}>
                いま任せられること
              </div>
              {CXO_META[openCxoPicker].canDo.map((cd, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const action = cd;
                    const meta = CXO_META[openCxoPicker];
                    setOpenCxoPicker(null);
                    handleExecute(action, meta.shortLabel);
                  }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '14px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${CXO_META[openCxoPicker].color}33`,
                    borderRadius: 12, marginBottom: 8,
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Sparkles size={14} style={{ color: CXO_META[openCxoPicker].color, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{cd}</span>
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── タイムライン (チャット + 実行結果) ─── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: 'auto',
          padding: '14px 12px 18px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Iris ブランド限定: 朝の 3 カードブリーフ (GG) */}
        {brand === 'iris' && <IrisBriefSlot personaId={persona.id} personaName={persona.name} />}

        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.5)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
            <p style={{ fontSize: 14, lineHeight: 1.8, fontWeight: 600 }}>
              7 名のエージェントに<br />指示してください
            </p>
            <p style={{ fontSize: 11.5, marginTop: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
              下の欄に質問を入力 / 上のエージェントをタップ
            </p>
            {/* クイック例 */}
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['今月の売上を要約して', '明日やるべきことを 3 つ', '直近 3 件の顧客対応をまとめて'].map(ex => (
                <button
                  key={ex}
                  onClick={() => handleSend(ex)}
                  style={{
                    padding: '10px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.8)', fontSize: 12.5,
                    cursor: 'pointer',
                  }}
                >{ex}</button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {msgs.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginBottom: 12 }}
            >
              {m.kind === 'user' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    maxWidth: '85%',
                    background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: '18px 18px 4px 18px',
                    fontSize: 14, lineHeight: 1.6,
                  }}>{m.text}</div>
                </div>
              )}
              {m.kind === 'ai' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: `${accent}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>{persona.icon}</div>
                  <div style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    padding: '12px 14px',
                    borderRadius: '4px 18px 18px 18px',
                    fontSize: 14, lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                  }}>{m.text}</div>
                </div>
              )}
              {m.kind === 'plan' && m.plan && (
                <PlanCard plan={m.plan} accent={accent} icon={persona.icon} />
              )}
              {m.kind === 'system' && (
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.5)',
                  textAlign: 'center', padding: '4px 0',
                }}>{m.text}</div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0' }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${accent}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={14} color={accent} />
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: accent }}
                />
              ))}
              <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>考えています…</span>
            </div>
          </div>
        )}
      </div>

      {/* ── 入力欄 ─────────────────────────── */}
      <form
        onSubmit={e => { e.preventDefault(); handleSend(); }}
        style={{
          padding: '8px 12px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'var(--surface-1, #0c0c14)',
          flexShrink: 0,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 4,
          background: 'rgba(255,255,255,0.06)',
          border: `1px solid ${accent}44`,
          borderRadius: 22,
          padding: '4px 6px 4px 4px',
        }}>
          {/* ＋ ボタン → 機能を開く (将来: ファイル / 会議録音 / 写真) */}
          <button
            type="button"
            onClick={onOpenFullFeatures}
            title="資料追加 / 会議録音 / その他機能"
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)',
              border: 'none', color: 'rgba(255,255,255,0.6)',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Plus size={17} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="何でも聞いてください…"
            rows={1}
            disabled={busy}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              outline: 'none', resize: 'none',
              color: '#fff', fontSize: 16, lineHeight: 1.55,
              maxHeight: 120, minHeight: 24, padding: '8px 0',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: input.trim() && !busy ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : 'rgba(255,255,255,0.06)',
              color: '#fff', border: 'none', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !busy ? 1 : 0.5,
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </form>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { scrollbar-width: none; }
      `}</style>
    </div>
  );
}

function PlanCard({ plan, accent, icon }: { plan: ExecutionPlan; accent: string; icon: string }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: `${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <div style={{
        flex: 1,
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '4px 18px 18px 18px',
        overflow: 'hidden',
      }}>
        {/* ステップ列 */}
        <div style={{ padding: '10px 12px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {plan.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
              <span style={{ color: accent, fontWeight: 800, flexShrink: 0 }}>✓</span>
              <span style={{ flex: 1 }}>
                <strong style={{ color: '#fff' }}>{s.label}</strong>
                {s.detail && <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{s.detail}</span>}
              </span>
            </div>
          ))}
        </div>
        {/* 成果物 */}
        <div style={{ padding: '10px 12px' }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
            color: accent, marginBottom: 4,
          }}>{plan.deliverable.kind.toUpperCase()}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{plan.deliverable.title}</div>
          <div style={{
            fontSize: 12.5, color: 'rgba(255,255,255,0.85)',
            background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 12px',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            maxHeight: 240, overflow: 'auto',
            lineHeight: 1.7,
          }}>{plan.deliverable.content}</div>
          <button
            onClick={() => navigator.clipboard?.writeText(plan.deliverable.content)}
            style={{
              marginTop: 8, padding: '6px 12px', borderRadius: 999,
              background: accent, color: '#0a0a0f', border: 'none',
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
            }}
          >📋 コピー</button>
        </div>
        {plan.note && (
          <div style={{
            padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)',
            fontSize: 11, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic',
            lineHeight: 1.55,
          }}>💭 {plan.note}</div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IrisBriefSlot — Iris ブランド時のみマウントされる朝ブリーフ
//   localStorage から IgProfile を読み、IrisMorningBrief に渡す
//   PRISM 側は完全に未参照のため tree-shake で除外される
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function IrisBriefSlot({ personaId, personaName }: { personaId: string; personaName: string }) {
  const [Brief, setBrief] = useState<React.ComponentType<any> | null>(null);
  const [igProfile, setIgProfile] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [briefMod, igMod] = await Promise.all([
        import('../iris/IrisMorningBrief'),
        import('../iris/instagramConnect'),
      ]);
      if (!mounted) return;
      setBrief(() => briefMod.default);
      try { setIgProfile(igMod.loadIgProfile()); } catch { /* */ }
    })();
    return () => { mounted = false; };
  }, []);
  if (!Brief) return null;
  return <Brief personaId={personaId} personaName={personaName} igProfile={igProfile} variant="mobile" />;
}
