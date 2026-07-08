import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, CartesianGrid } from 'recharts';
import type { Persona, AppSettings } from '../types/identity';
import type { PersonRecord, PersonInteraction, SentimentType, InteractionType } from '../types/people';
import { usePeople } from '../hooks/usePeople';
import { usePeopleMood, MOOD_LABEL, MOOD_COLOR, type MoodKind } from '../hooks/usePeopleMood';
import { useAgentTaskQueue } from '../hooks/useAgentTaskQueue';
import {
  analyzePerson, buildOneOnOneAgenda, buildReopenScript,
  type PersonAnalysis, type OneOnOneAgenda, type ReopenScript,
} from '../lib/peopleAnalyst';
import EmptyState from './EmptyState';
import { StudioIntro } from './StudioIntro';
import { LoaderDots } from './MicroLoader';
import { confirmAction } from '../lib/confirmDialog';
import { copyText } from '../lib/clipboard';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type View = 'list' | 'detail' | 'compose' | 'interview';

interface InterviewQuestion {
  q: string;
  intent: string;          // 何を見るための質問か
  followUp: string;        // 深掘り (1 文)
  redFlag: string;         // この答えだと危険
  greenFlag: string;       // この答えだと有望
}

interface InterviewPack {
  role: string;
  questions: InterviewQuestion[];
  evalRubric: string[];    // 評価軸 3 つ
}

const SENTIMENT_COLOR: Record<SentimentType, string> = {
  positive: '#4ade80',
  neutral:  '#60a5fa',
  negative: '#f87171',
  mixed:    '#f59e0b',
};

const SENTIMENT_LABEL: Record<SentimentType, string> = {
  positive: '😊 良好',
  neutral:  '😐 普通',
  negative: '😟 懸念',
  mixed:    '🌗 混在',
};

const INTERACTION_LABEL: Record<InteractionType, string> = {
  meeting: '🤝 商談',
  '1on1':  '👥 1on1',
  email:   '📧 メール',
  call:    '📞 電話',
  note:    '📝 メモ',
};

const TRUST_LABEL: Record<string, string> = {
  improving: '📈 改善中',
  stable:    '➡ 安定',
  declining: '📉 低下中',
  unknown:   '❓ 不明',
};

// ─── 連絡頻度チップの判定 ─────────────────────────────────────
type ContactStatus = 'fresh' | 'warm' | 'cold' | 'silent';
function getContactStatus(lastDateISO?: string): { status: ContactStatus; daysSince: number | null } {
  if (!lastDateISO) return { status: 'silent', daysSince: null };
  const last = new Date(lastDateISO);
  if (isNaN(last.getTime())) return { status: 'silent', daysSince: null };
  const now = new Date();
  const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7)   return { status: 'fresh', daysSince: days };
  if (days < 30)  return { status: 'warm',  daysSince: days };
  return            { status: 'cold',  daysSince: days };
}
const CONTACT_CHIP: Record<ContactStatus, { label: string; bg: string; fg: string }> = {
  fresh:  { label: '最近やり取り済み', bg: '#1f3a2a', fg: '#4ade80' },
  warm:   { label: '連絡しましょう', bg: '#3a2f1a', fg: '#fbbf24' },
  cold:   { label: '久しぶりに連絡', bg: '#3a1f1f', fg: '#f87171' },
  silent: { label: '未接触',            bg: '#2a2a3a', fg: '#9ca3af' },
};

// ─── Markdown エクスポート ─────────────────────────────────────
function buildMarkdownExport(
  person: PersonRecord,
  interactions: PersonInteraction[],
  moods: { date: string; mood: MoodKind; note?: string }[],
): string {
  const lines: string[] = [];
  lines.push(`# 👤 ${person.name}`);
  if (person.role || person.company) {
    lines.push(`> ${person.role || ''}${person.role && person.company ? ' · ' : ''}${person.company || ''}`);
  }
  lines.push('');
  if (person.tags && person.tags.length > 0) lines.push(`**タグ**: ${person.tags.join(', ')}  `);
  if (person.lastInteraction)                lines.push(`**最終接触**: ${person.lastInteraction}  `);
  if (person.notes)                          lines.push(`\n**メモ**\n\n${person.notes}\n`);
  lines.push('');

  lines.push(`## 🤝 やり取り履歴 (${interactions.length}件)`);
  lines.push('');
  if (interactions.length === 0) lines.push('_記録なし_\n');
  for (const i of interactions) {
    lines.push(`### ${i.date} ${INTERACTION_LABEL[i.type] || i.type}`);
    if (i.sentiment) lines.push(`**センチメント**: ${SENTIMENT_LABEL[i.sentiment]}  `);
    lines.push(i.summary);
    if (i.highlights && i.highlights.length > 0) {
      lines.push('\n**良かった点**');
      i.highlights.forEach(h => lines.push(`- ${h}`));
    }
    if (i.nextTopics && i.nextTopics.length > 0) {
      lines.push('\n**次回の話題**');
      i.nextTopics.forEach(t => lines.push(`- ${t}`));
    }
    lines.push('');
  }

  if (moods.length > 0) {
    lines.push('## 🪶 感情ジャーナル');
    lines.push('');
    for (const m of moods) {
      lines.push(`- **${m.date}** ${MOOD_LABEL[m.mood]}${m.note ? ` — ${m.note}` : ''}`);
    }
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`*CORE Prism PeopleStudio で書き出し — ${new Date().toISOString().slice(0, 10)}*`);
  return lines.join('\n');
}

export default function PeopleStudio({ persona, settings, onClose }: Props) {
  const pp = usePeople();
  const mood = usePeopleMood();
  const queue = useAgentTaskQueue();
  const people = useMemo(() => pp.getForPersona(persona.id), [pp.people, persona.id]);

  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // ─── 採用面接シミュレーター (オーナー指示 2026-06-02) ───
  const [interviewRole, setInterviewRole] = useState('');
  const [interviewPack, setInterviewPack] = useState<InterviewPack | null>(null);
  const [interviewBusy, setInterviewBusy] = useState(false);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const generateInterviewPack = useCallback(async () => {
    if (!interviewRole.trim()) { setInterviewError('募集職種や候補者の状況を 1 行入れてください'); return; }
    setInterviewBusy(true); setInterviewError(null);
    try {
      const sys = `あなたは経験豊富な採用面接官です。日本の中小企業の社長が候補者と向き合う場面で
使える、刺さる質問セットを作ります。

返答は JSON のみ (コードブロックなし):
{
  "role": "想定した職種・状況",
  "questions": [
    {
      "q": "質問本文 (具体的で答えやすい、1 文)",
      "intent": "この質問で見たいこと (1 文)",
      "followUp": "想定回答が薄かった時の深掘り質問 (1 文)",
      "redFlag": "この答え方だと採用見送り基準 (1 文)",
      "greenFlag": "この答え方だと採用前向き基準 (1 文)"
    }
  ],
  "evalRubric": ["評価軸 1 (例: 課題を自分ごと化できるか)", "評価軸 2", "評価軸 3"]
}

ルール:
- 質問は 5 つきっかり。深掘りまで揃える
- やさしい日本語、専門用語禁止、押しつけがましくない
- 経歴を聞くだけの面接にしない。考え方・行動パターンを引き出す
- 評価軸は具体的で、面接後に〇△× がつけられるもの`;
      const userMsg = `## 募集 / 候補者の状況\n${interviewRole}\n\n## 事業\n${persona.name} (${persona.subtitle || ''})\n\n上記の状況で使える面接質問セットを JSON で。`;
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.preferredModel,
          max_tokens: 2400,
          system: sys,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message || `面接 AI エラー: ${res.status}`);
      }
      const data = await res.json();
      const text = data?.content?.[0]?.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI の返答を読み取れませんでした');
      const p = JSON.parse(m[0]);
      const questions: InterviewQuestion[] = Array.isArray(p.questions)
        ? p.questions.slice(0, 5).map((q: any) => ({
            q: String(q.q || '').trim(),
            intent: String(q.intent || '').trim(),
            followUp: String(q.followUp || '').trim(),
            redFlag: String(q.redFlag || '').trim(),
            greenFlag: String(q.greenFlag || '').trim(),
          }))
        : [];
      if (questions.length === 0) throw new Error('質問を生成できませんでした');
      setInterviewPack({
        role: String(p.role || interviewRole).slice(0, 80),
        questions,
        evalRubric: Array.isArray(p.evalRubric) ? p.evalRubric.slice(0, 3).map(String) : [],
      });
    } catch (e) {
      setInterviewError(e instanceof Error ? e.message : '面接パックを作れませんでした');
    } finally {
      setInterviewBusy(false);
    }
  }, [interviewRole, persona, settings.preferredModel]);

  const selected = useMemo(() => people.find(p => p.id === selectedId) || null, [people, selectedId]);
  const interactions = useMemo(() =>
    selectedId ? pp.getInteractionsForPerson(selectedId) : [],
    [pp.interactions, selectedId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    const q = search.toLowerCase();
    return people.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.company || '').toLowerCase().includes(q) ||
      (p.role || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [people, search]);

  const openDetail = useCallback((id: string) => {
    setSelectedId(id);
    setView('detail');
  }, []);

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '960px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header" style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}>
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>👥</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">人物ケア</p>
              <p className="cp-meta truncate">{persona.name} · 1on1 アジェンダ + 連絡頻度 + 感情ジャーナル</p>
            </div>
          </div>
          <div className="cp-row">
            {view !== 'list' && (
              <button onClick={() => { setView('list'); setSelectedId(null); }}
                className="cp-btn cp-btn-ghost cp-btn-sm" style={{ minHeight: 44, minWidth: 44 }}>← 一覧</button>
            )}
            {view === 'list' && (
              <>
                <button onClick={() => setView('interview')}
                  className="cp-btn cp-btn-ghost cp-btn-sm"
                  style={{ minHeight: 44, color: persona.accentColor, border: `1px solid ${persona.accentColor}55` }}>
                  🎤 採用面接
                </button>
                <button onClick={() => setView('compose')}
                  className="cp-btn cp-btn-primary cp-btn-sm"
                  style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 44 }}>
                  ＋ 人物を追加
                </button>
              </>
            )}
            <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm" style={{ minHeight: 44, minWidth: 44 }}>✕</button>
          </div>
        </div>

        <div className="cp-modal-body">
          <StudioIntro
            id="people"
            accent={persona.accentColor}
            iconKey="people"
            what="関わる人 1 人 1 人の「いま元気か / 何を考えているか」を 1 画面で見守る場所です。"
            tryThis="人物カードを開いて「🗒 1on1 アジェンダを作る」を押す → 雑談・進捗・課題・次の一歩・フィードバックの 5 ブロックが揃います。"
            example="チームメンバーの過去 1on1 5 件 → 信頼トレンド・リスクフラグ・次の話題 3 案を 30 秒で。"
            sampleLabel="出来上がる人物カード"
            samplePreview={
              <div
                style={{
                  width: 160,
                  background: 'var(--surface-1)',
                  borderRadius: 6,
                  padding: '7px 8px',
                  fontSize: 7,
                  lineHeight: 1.4,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  boxShadow: 'var(--cp-elev-3)',
                  border: `1px solid ${persona.accentColor}30`,
                }}
                aria-label="人物分析のサンプル"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: persona.accentColor, color: '#0a0a0f',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 7, fontWeight: 800, flexShrink: 0,
                    }}
                  >
                    田
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 7, color: 'var(--fg)' }}>田中 さん</div>
                    <div style={{ fontSize: 5, opacity: 0.65, color: 'var(--fg)' }}>営業部 リーダー</div>
                  </div>
                  <span style={{ fontSize: 7 }}>😊</span>
                </div>
                <div
                  style={{
                    background: `${persona.accentColor}14`,
                    borderLeft: `2px solid ${persona.accentColor}`,
                    padding: '3px 4px', marginBottom: 3, fontSize: 5.5, color: 'var(--fg)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 1 }}>
                    <span style={{ opacity: 0.7 }}>信頼</span>
                    <span style={{ color: '#4ade80', fontWeight: 700 }}>📈 改善中</span>
                  </div>
                  <div style={{ opacity: 0.9 }}>業績の自信が戻りつつある</div>
                </div>
                <div style={{ fontSize: 5.5, color: 'var(--fg)', marginBottom: 2 }}>
                  <span style={{ color: '#4ade80' }}>✓</span> 数字の責任感が強い
                </div>
                <div style={{ fontSize: 5.5, color: 'var(--fg)', marginBottom: 3 }}>
                  <span style={{ color: '#f59e0b' }}>⚠</span> 部下への共有量が少ない
                </div>
                <div
                  style={{
                    borderTop: `1px dashed ${persona.accentColor}30`,
                    paddingTop: 3, fontSize: 5, color: 'var(--fg)',
                  }}
                >
                  <div style={{ opacity: 0.6, marginBottom: 1 }}>次の 1on1 で話すと良いこと</div>
                  <div style={{ color: persona.accentColor, fontWeight: 600 }}>① 部下への期待値の言語化</div>
                </div>
              </div>
            }
          />

          {/* 退場アニメ待ち禁止(rAF停止環境でビュー切替が凍結する)・キー切替入場のみ */}
          <>
            {/* ─── 人物一覧 ─── */}
            {view === 'list' && (
              <motion.div key="list"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="cp-stack">
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="名前・会社・タグで検索…"
                    className="cp-input"
                  />
                  {filtered.length === 0 ? (
                    <EmptyState
                      iconKey="people"
                      title="まだ「人物カルテ」はありません"
                      description={'家族・取引先・恩人を 1 人ずつカルテにすると、AI が「最近連絡してない人」を教えてくれます。\n誕生日・好み・前回の会話メモも全部 1 箇所に。'}
                      ctaLabel="最初の人物を登録"
                      onCta={() => setView('compose')}
                      accent={persona.accentColor}
                      preview="🌸 森川美咲　最終接触: 12 日前　好み: 抹茶ラテ　次の一手: 来月の展示会に誘う"
                    />
                  ) : (
                    <div className="cp-stack-sm">
                      {filtered.map(p => {
                        const pInteractions = pp.getInteractionsForPerson(p.id);
                        const lastSentiment = pInteractions.find(i => i.sentiment)?.sentiment;
                        const cs = getContactStatus(p.lastInteraction);
                        const chip = CONTACT_CHIP[cs.status];
                        return (
                          <button key={p.id} onClick={() => openDetail(p.id)}
                            className="cp-card cp-row-between text-left w-full hover:scale-[1.005] transition-transform"
                            style={{ minHeight: 56 }}>
                            <div className="cp-row min-w-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                                style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                                {p.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                                  <p className="cp-h3 truncate">{p.name}</p>
                                  {lastSentiment && (
                                    <span className="text-xs" style={{ color: SENTIMENT_COLOR[lastSentiment] }}>
                                      {SENTIMENT_LABEL[lastSentiment].split(' ')[0]}
                                    </span>
                                  )}
                                  {(cs.status === 'warm' || cs.status === 'cold') && (
                                    <span className="cp-pill" style={{
                                      color: chip.fg, background: chip.bg, borderColor: chip.fg + '40',
                                      fontSize: 10, fontWeight: 600,
                                    }}>
                                      {chip.label}{cs.daysSince != null ? ` (${cs.daysSince}日)` : ''}
                                    </span>
                                  )}
                                </div>
                                <p className="cp-meta truncate">
                                  {p.role && `${p.role} `}{p.company && `· ${p.company}`}
                                </p>
                                {p.lastInteraction && (
                                  <p className="cp-tiny">最終接触: {p.lastInteraction}{cs.daysSince != null ? ` (${cs.daysSince}日前)` : ''}</p>
                                )}
                              </div>
                            </div>
                            <div className="cp-row flex-shrink-0">
                              <span className="cp-pill">{pInteractions.length}件の履歴</span>
                              {(p.tags || []).slice(0, 2).map(t => (
                                <span key={t} className="cp-pill text-[10px]"
                                  style={{ color: persona.accentColor, borderColor: persona.accentColor + '40' }}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ─── 人物詳細 ─── */}
            {view === 'detail' && selected && (
              <PersonDetail
                key={selected.id}
                person={selected}
                interactions={interactions}
                persona={persona}
                settings={settings}
                moods={mood.getMoodsForPerson(selected.id)}
                monthlyTrend={mood.getMonthlyTrend(selected.id, 6)}
                onAddMood={(m, note) => mood.addMood(selected.id, m, note)}
                onRemoveMood={mood.removeMood}
                recentAgentTaskTitles={queue.tasks.slice(0, 6).map(t => t.title)}
                onProposeAgentTask={(draft) => queue.propose(draft)}
                onUpdate={(patch) => pp.upsertPerson({ ...selected, ...patch })}
                onDelete={async () => { if (await confirmAction({ title: 'この人物を削除しますか?', body: 'やり取りの履歴も一緒に消えます。', tone: 'danger' })) { pp.removePerson(selected.id); setView('list'); } }}
                onAddInteraction={(inter) => pp.addInteraction({ ...inter, personId: selected.id })}
                onRemoveInteraction={pp.removeInteraction}
              />
            )}

            {/* ─── 採用面接シミュレーター (オーナー指示 2026-06-02) ─── */}
            {view === 'interview' && (
              <div className="cp-stack-sm" key="interview">
                <div className="cp-card-section cp-stack-sm" style={{
                  background: `${persona.accentColor}10`,
                  border: `1px solid ${persona.accentColor}40`,
                }}>
                  <p className="cp-h3">🎤 採用面接シミュレーター</p>
                  <p className="cp-meta">
                    募集職種や候補者の状況を 1 行入れると、AI が面接質問 5 つと「採用・見送り基準」を作ります。
                    経歴を聞くだけにならない、考え方を引き出す質問セットです。
                  </p>
                  <textarea
                    value={interviewRole}
                    onChange={e => setInterviewRole(e.target.value)}
                    placeholder={`例: 営業マネージャー候補、業界経験 5 年以上、来週 1 次面接\n例: 副業デザイナー、月 20 時間稼働、Iris のブランド統一を任せたい`}
                    rows={3}
                    className="cp-textarea"
                  />
                  <button
                    onClick={generateInterviewPack}
                    disabled={interviewBusy || !interviewRole.trim()}
                    className="cp-btn cp-btn-primary"
                    style={{
                      background: persona.accentColor,
                      color: '#0a0a0f',
                      opacity: (interviewBusy || !interviewRole.trim()) ? 0.5 : 1,
                    }}
                  >
                    {interviewBusy ? '🧠 面接パックを組み立て中…' : '🎤 面接パックを作る'}
                  </button>
                  {interviewError && (
                    <div className="cp-banner-error">⚠ {interviewError}</div>
                  )}
                </div>

                {interviewPack && !interviewBusy && (
                  <>
                    <div className="cp-card-section">
                      <p className="cp-tiny" style={{ color: persona.accentColor, fontWeight: 800, letterSpacing: '0.06em', marginBottom: 4 }}>
                        想定 · {interviewPack.role}
                      </p>
                      {interviewPack.evalRubric.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <p className="cp-tiny" style={{ color: 'var(--fg-muted)', marginBottom: 4 }}>📋 評価軸 (面接後に〇△× をつける)</p>
                          <ul style={{ paddingLeft: 18, margin: 0, fontSize: '0.9rem' }}>
                            {interviewPack.evalRubric.map((r, i) => (
                              <li key={i} style={{ marginBottom: 3 }}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {interviewPack.questions.map((q, i) => (
                      <div key={i} className="cp-card-section" style={{ borderLeft: `3px solid ${persona.accentColor}` }}>
                        <p className="cp-tiny" style={{ color: persona.accentColor, fontWeight: 800, marginBottom: 6 }}>
                          質問 {i + 1}
                        </p>
                        <p className="cp-body" style={{ fontWeight: 700, lineHeight: 1.6, marginBottom: 8 }}>
                          「{q.q}」
                        </p>
                        <div style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div>🎯 <span style={{ color: 'var(--fg)' }}>狙い:</span> {q.intent}</div>
                          <div>↪ <span style={{ color: 'var(--fg)' }}>深掘り:</span> {q.followUp}</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                          <div className="cp-chip-success">
                            ✓ <strong>OK:</strong> {q.greenFlag}
                          </div>
                          <div className="cp-chip-danger">
                            ⚠ <strong>NG:</strong> {q.redFlag}
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        const text = `【採用面接パック】 想定: ${interviewPack.role}\n\n■ 評価軸\n${interviewPack.evalRubric.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n${interviewPack.questions.map((q, i) => `■ 質問 ${i + 1}\n「${q.q}」\n  狙い: ${q.intent}\n  深掘り: ${q.followUp}\n  ✓ OK の答え: ${q.greenFlag}\n  ⚠ NG の答え: ${q.redFlag}`).join('\n\n')}`;
                        void copyText(text, '面接パック');
                      }}
                      className="cp-btn cp-btn-sm"
                    >📋 面接パックを全部コピー</button>
                  </>
                )}
              </div>
            )}

            {/* ─── 新規追加フォーム ─── */}
            {view === 'compose' && (
              <PersonForm
                key="compose"
                persona={persona}
                onSave={(partial) => {
                  pp.newPerson(persona.id, partial);
                  setView('list');
                }}
                onCancel={() => setView('list')}
              />
            )}
          </>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── 詳細コンポーネント ──────────────────────────────────────
function PersonDetail({
  person, interactions, persona, settings,
  moods, monthlyTrend,
  onAddMood, onRemoveMood,
  recentAgentTaskTitles, onProposeAgentTask,
  onUpdate, onDelete, onAddInteraction, onRemoveInteraction,
}: {
  person: PersonRecord;
  interactions: PersonInteraction[];
  persona: Persona;
  settings: AppSettings;
  moods: ReturnType<ReturnType<typeof usePeopleMood>['getMoodsForPerson']>;
  monthlyTrend: ReturnType<ReturnType<typeof usePeopleMood>['getMonthlyTrend']>;
  onAddMood: (m: MoodKind, note?: string) => void;
  onRemoveMood: (id: string) => void;
  recentAgentTaskTitles: string[];
  onProposeAgentTask: (draft: Parameters<ReturnType<typeof useAgentTaskQueue>['propose']>[0]) => void;
  onUpdate: (patch: Partial<PersonRecord>) => void;
  onDelete: () => void;
  onAddInteraction: (i: Omit<PersonInteraction, 'id' | 'personId'>) => void;
  onRemoveInteraction: (id: string) => void;
}) {
  const [interType, setInterType] = useState<InteractionType>('1on1');
  const [interDate, setInterDate] = useState(new Date().toISOString().slice(0, 10));
  const [interSummary, setInterSummary] = useState('');
  const [interSentiment, setInterSentiment] = useState<SentimentType>('neutral');
  const [analysis, setAnalysis] = useState<PersonAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState(person.notes || '');

  // 1on1 アジェンダ
  const [agenda, setAgenda] = useState<OneOnOneAgenda | null>(null);
  const [agendaBusy, setAgendaBusy] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);

  // 久しぶり連絡スクリプト
  const [reopen, setReopen] = useState<ReopenScript | null>(null);
  const [reopenBusy, setReopenBusy] = useState(false);

  // エクスポート / 委任
  const [exportToast, setExportToast] = useState<string | null>(null);
  const [delegateToast, setDelegateToast] = useState<string | null>(null);

  // 連絡頻度ステータス
  const cs = useMemo(() => getContactStatus(person.lastInteraction), [person.lastInteraction]);

  // センチメントチャートデータ
  const chartData = useMemo(() => {
    const map: Record<SentimentType, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    for (const i of interactions) {
      if (i.sentiment) map[i.sentiment]++;
    }
    return Object.entries(map).map(([k, v]) => ({
      name: SENTIMENT_LABEL[k as SentimentType],
      count: v,
      color: SENTIMENT_COLOR[k as SentimentType],
    })).filter(d => d.count > 0);
  }, [interactions]);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyzePerson(settings, person, interactions);
      setAnalysis(result);
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }, [settings, person, interactions]);

  const handleBuildAgenda = useCallback(async () => {
    setAgendaBusy(true);
    setAgendaError(null);
    try {
      const a = await buildOneOnOneAgenda(settings, person, interactions, {
        daysSinceContact: cs.daysSince ?? undefined,
        personaName: persona.name,
        recentAgentTaskTitles,
      });
      setAgenda(a);
    } catch (e) {
      setAgendaError(e instanceof Error ? e.message : String(e));
    } finally {
      setAgendaBusy(false);
    }
  }, [settings, person, interactions, cs.daysSince, persona.name, recentAgentTaskTitles]);

  const handleBuildReopen = useCallback(async () => {
    if (cs.daysSince == null) return;
    setReopenBusy(true);
    try {
      const r = await buildReopenScript(settings, person, interactions, cs.daysSince);
      setReopen(r);
    } catch (e) {
      setReopen({ subject: '生成に失敗しました', body: e instanceof Error ? e.message : String(e) });
    } finally {
      setReopenBusy(false);
    }
  }, [settings, person, interactions, cs.daysSince]);

  const handleExport = useCallback(async () => {
    const md = buildMarkdownExport(person, interactions, moods);
    const ok = await copyText(md, 'Markdown', { silentSuccess: true });
    setExportToast(ok ? '📋 Markdown をコピーしました' : 'コピーできませんでした');
    setTimeout(() => setExportToast(null), 2200);
  }, [person, interactions, moods]);

  // ─── AgentTaskQueue 連携 ─────────────────────────────
  // 個人特定情報 (氏名 / 連絡先) を AI 会社のキューに送らない設計
  // → タイトルは「あの方」、内部に必要な質問テキストのみ要約
  const handleDelegateNextCheckIn = useCallback(() => {
    const latest = interactions[0];
    const topic = latest?.nextTopics?.[0]
      || latest?.summary?.slice(0, 40)
      || '次回 1on1 で確認したいテーマ';
    onProposeAgentTask({
      title: `[人物ケア] 次回 1on1 で確認するテーマを整える`,
      summary: `担当の方 (${person.role || '対象人物'}) と次に話すべきテーマを COO が議題化、CSO が問いの設計まで仕上げます。テーマ候補: ${topic}`,
      why: `関係を継続的に深め、約束したことをやり残さないため。`,
      expected: `次回 1on1 用の議題 3 本 + 確認ポイント 5 個`,
      dueDays: 7,
      steps: [
        { cxo: 'COO', label: '前回の next-topics と現状を棚卸し' },
        { cxo: 'CSO', label: '相手起点の問いを 3 本に整える' },
        { cxo: 'CPO', label: '次回までに自分側がやることを 1 件決める' },
      ],
    });
    setDelegateToast('🤖 AI 会社 (COO + CSO) に委任しました');
    setTimeout(() => setDelegateToast(null), 2400);
  }, [interactions, person.role, onProposeAgentTask]);

  const handleDelegateReopen = useCallback(() => {
    onProposeAgentTask({
      title: `[人物ケア] 久しぶりの方に連絡する文面を整える`,
      summary: `${cs.daysSince ?? '?'} 日連絡のない方へ、押し付けない再開メッセージを CMO が 1 通仕上げます。`,
      why: `関係が冷える前に、軽やかな一声で温め直すため。`,
      expected: `メッセージ 1 通 (件名 + 本文 / 質問 1 つ)`,
      dueDays: 3,
      steps: [
        { cxo: 'CSO', label: '相手の状況と前回トピックを踏まえた切り口を 1 つ決める' },
        { cxo: 'CMO', label: '60-140 字の温かい再開メッセージを書く' },
      ],
    });
    setDelegateToast('🤖 AI 会社 (CSO + CMO) に委任しました');
    setTimeout(() => setDelegateToast(null), 2400);
  }, [cs.daysSince, onProposeAgentTask]);

  const chip = CONTACT_CHIP[cs.status];

  return (
    <div className="cp-stack">
      {/* プロフィールヘッダー */}
      <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="cp-row">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: persona.accentColorLight, color: persona.accentColor }}>
            {person.name.charAt(0)}
          </div>
          <div>
            <p className="cp-h2">{person.name}</p>
            <p className="cp-meta">{person.role && `${person.role}`}{person.company && ` · ${person.company}`}</p>
            <div className="cp-row mt-1" style={{ gap: 4, flexWrap: 'wrap' }}>
              {(person.tags || []).map(t => (
                <span key={t} className="cp-pill text-[10px]"
                  style={{ color: persona.accentColor, borderColor: persona.accentColor + '40' }}>{t}</span>
              ))}
              <span className="cp-pill" style={{
                color: chip.fg, background: chip.bg, borderColor: chip.fg + '40', fontSize: 11, fontWeight: 600,
              }}>
                {chip.label}{cs.daysSince != null ? ` (${cs.daysSince}日)` : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="cp-row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button onClick={handleBuildAgenda} disabled={agendaBusy}
            className="cp-btn cp-btn-primary cp-btn-sm"
            style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 44 }}>
            {agendaBusy ? <LoaderDots label="話す論点を選んでます" /> : '🗒 1on1 アジェンダを作る'}
          </button>
          <button onClick={handleAnalyze} disabled={analyzing}
            className="cp-btn cp-btn-sm"
            style={{ minHeight: 44 }}>
            {analyzing ? <LoaderDots label="関係性を読み解き中" /> : '🤖 AI 関係性分析'}
          </button>
          <button onClick={handleExport} className="cp-btn cp-btn-ghost cp-btn-sm" style={{ minHeight: 44 }}>
            📋 Markdown 書き出し
          </button>
          <button onClick={onDelete} className="cp-btn cp-btn-ghost cp-btn-sm" style={{ color: '#f87171', minHeight: 44 }}>削除</button>
        </div>
      </div>

      {/* 連絡頻度リマインドカード (warm / cold のとき) */}
      <AnimatePresence>
        {(cs.status === 'warm' || cs.status === 'cold') && (
          <motion.div
            className="cp-card cp-stack-sm"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ borderColor: chip.fg + '60', background: chip.bg + '40' }}
          >
            <div className="cp-row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
              <div>
                <p className="cp-h3" style={{ color: chip.fg }}>
                  {cs.status === 'cold' ? '🚨 30 日以上 連絡が空いています' : '⚠ 1 週間 連絡していません'}
                </p>
                <p className="cp-meta">
                  最終接触: {person.lastInteraction || '記録なし'}
                  {cs.daysSince != null ? ` (${cs.daysSince}日前)` : ''}
                </p>
              </div>
              <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {cs.status === 'cold' && (
                  <button onClick={handleBuildReopen} disabled={reopenBusy}
                    className="cp-btn cp-btn-primary cp-btn-sm"
                    style={{ background: chip.fg, color: '#0a0a0f', minHeight: 44 }}>
                    {reopenBusy ? <LoaderDots label="送る言葉を選んでます" /> : '✍ 再開メッセージを書く'}
                  </button>
                )}
                <button onClick={handleDelegateReopen}
                  className="cp-btn cp-btn-sm" style={{ minHeight: 44 }}>
                  🤖 AI 会社に委任
                </button>
              </div>
            </div>
            {reopen && (
              <div className="cp-card-section cp-stack-sm" style={{ background: 'var(--surface-1)' }}>
                <div className="cp-row-between">
                  <p className="cp-section-head">件名: {reopen.subject}</p>
                  <button
                    onClick={async () => {
                      const ok = await copyText(`件名: ${reopen.subject}\n\n${reopen.body}`, 'メッセージ', { silentSuccess: true });
                      setExportToast(ok ? '📋 メッセージをコピーしました' : 'コピーできませんでした');
                      setTimeout(() => setExportToast(null), 2000);
                    }}
                    className="cp-btn cp-btn-ghost cp-btn-sm" style={{ minHeight: 36 }}>📋 コピー</button>
                </div>
                <p className="cp-body" style={{ whiteSpace: 'pre-wrap' }}>{reopen.body}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* トースト — .cp-toast 統一スタイル (export=persona アクセント / delegate=紫) */}
      <AnimatePresence>
        {exportToast && (
          <motion.div
            key={`export-${exportToast}`}
            className="cp-toast cp-toast--success"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              ['--cp-toast-accent' as any]: persona.accentColor,
              ['--cp-toast-glow' as any]: `${persona.accentColor}55`,
            }}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden style={{ color: persona.accentColor, fontWeight: 800, fontSize: 14 }}>✓</span>
            <span>{exportToast}</span>
            <span className="cp-toast__bar" aria-hidden />
          </motion.div>
        )}
        {delegateToast && (
          <motion.div
            key={`delegate-${delegateToast}`}
            className="cp-toast cp-toast--info"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            role="status"
            aria-live="polite"
          >
            <span aria-hidden style={{ color: '#a78bfa', fontWeight: 800, fontSize: 14 }}>🤖</span>
            <span>{delegateToast}</span>
            <span className="cp-toast__bar" aria-hidden />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1on1 アジェンダ結果 */}
      <AnimatePresence>
        {agendaError && (
          <motion.div className="cp-card" style={{ borderColor: '#f87171' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="cp-meta" style={{ color: '#f87171' }}>{agendaError}</p>
            <button onClick={handleBuildAgenda} className="cp-btn cp-btn-sm mt-2">再試行</button>
          </motion.div>
        )}
        {agenda && (
          <motion.div className="cp-card cp-stack-sm"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ borderColor: persona.accentColor + '60' }}>
            <div className="cp-row-between">
              <p className="cp-h3">🗒 次回 1on1 アジェンダ</p>
              <div className="cp-row" style={{ gap: 6 }}>
                <button
                  onClick={async () => {
                    const lines = [
                      `# 1on1 アジェンダ — ${person.name}`,
                      '', '## ☕ 冒頭の雑談', ...agenda.smallTalk.map(s => `- ${s}`),
                      '', '## 📈 進捗確認', ...agenda.progressCheck.map(s => `- ${s}`),
                      '', '## 🧩 課題 / 困りごと', ...agenda.challenges.map(s => `- ${s}`),
                      '', '## 👣 次の一歩', ...agenda.nextSteps.map(s => `- ${s}`),
                      '', '## 💬 フィードバック', ...agenda.feedback.map(s => `- ${s}`),
                    ];
                    if (agenda.reopenScript) lines.push('', '## 🌱 久しぶり用オープニング', agenda.reopenScript);
                    const ok = await copyText(lines.join('\n'), 'アジェンダ', { silentSuccess: true });
                    setExportToast(ok ? '📋 アジェンダをコピーしました' : 'コピーできませんでした');
                    setTimeout(() => setExportToast(null), 2000);
                  }}
                  className="cp-btn cp-btn-ghost cp-btn-sm" style={{ minHeight: 36 }}>📋 コピー</button>
                <button onClick={handleDelegateNextCheckIn}
                  className="cp-btn cp-btn-sm" style={{ minHeight: 36 }}>
                  🤖 確認事項を AI 会社へ
                </button>
              </div>
            </div>
            <AgendaBlock title="☕ 冒頭の雑談"      items={agenda.smallTalk}     accent="#fbbf24" />
            <AgendaBlock title="📈 進捗確認"        items={agenda.progressCheck} accent="#60a5fa" />
            <AgendaBlock title="🧩 課題 / 困りごと" items={agenda.challenges}    accent="#f87171" />
            <AgendaBlock title="👣 次の一歩"         items={agenda.nextSteps}     accent={persona.accentColor} />
            <AgendaBlock title="💬 フィードバック"   items={agenda.feedback}      accent="#a78bfa" />
            {agenda.reopenScript && (
              <div className="cp-card-section" style={{ background: 'var(--surface-1)' }}>
                <p className="cp-section-head">🌱 久しぶり用オープニング</p>
                <p className="cp-body" style={{ whiteSpace: 'pre-wrap' }}>{agenda.reopenScript}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI 分析結果 */}
      <AnimatePresence>
        {analyzeError && (
          <motion.div className="cp-card" style={{ borderColor: '#f87171' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="cp-meta" style={{ color: '#f87171' }}>{analyzeError}</p>
          </motion.div>
        )}
        {analysis && (
          <motion.div className="cp-card cp-stack-sm"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="cp-row-between">
              <p className="cp-h3">🤖 AI 関係性分析</p>
              <span className="cp-pill" style={{
                color: analysis.trustTrend === 'improving' ? '#4ade80' : analysis.trustTrend === 'declining' ? '#f87171' : '#60a5fa',
              }}>{TRUST_LABEL[analysis.trustTrend]}</span>
            </div>
            <p className="cp-body" style={{ whiteSpace: 'pre-wrap' }}>{analysis.summary}</p>
            {analysis.strengths.length > 0 && (
              <div>
                <p className="cp-section-head">強み</p>
                <ul className="cp-stack-sm" style={{ paddingLeft: 16, listStyle: 'disc' }}>
                  {analysis.strengths.map((s, i) => <li key={i} className="cp-body" style={{ color: '#4ade80' }}>{s}</li>)}
                </ul>
              </div>
            )}
            {analysis.concerns.length > 0 && (
              <div>
                <p className="cp-section-head">懸念点</p>
                <ul className="cp-stack-sm" style={{ paddingLeft: 16, listStyle: 'disc' }}>
                  {analysis.concerns.map((c, i) => <li key={i} className="cp-body" style={{ color: '#f87171' }}>{c}</li>)}
                </ul>
              </div>
            )}
            {analysis.riskFlags.length > 0 && (
              <div>
                <p className="cp-section-head">⚠ リスクフラグ</p>
                <ul className="cp-stack-sm" style={{ paddingLeft: 16, listStyle: 'disc' }}>
                  {analysis.riskFlags.map((r, i) => <li key={i} className="cp-body" style={{ color: '#f59e0b' }}>{r}</li>)}
                </ul>
              </div>
            )}
            {analysis.suggestedTopics.length > 0 && (
              <div>
                <p className="cp-section-head">次の 1on1 でのトピック提案</p>
                <ol className="cp-stack-sm" style={{ paddingLeft: 16, listStyle: 'decimal' }}>
                  {analysis.suggestedTopics.map((t, i) => (
                    <li key={i} className="cp-body" style={{ color: persona.accentColor }}>{t}</li>
                  ))}
                </ol>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 感情ジャーナル — 1on1 後の 1 タップ記録 + 月次トレンド */}
      <div className="cp-card cp-stack-sm">
        <p className="cp-h3">🪶 感情ジャーナル</p>
        <p className="cp-meta">1on1 のあとに、自分の気持ちを 1 タップで残せます。月次トレンドで自分の関わり方を振り返れます。</p>
        <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {(['positive', 'hopeful', 'anxious'] as MoodKind[]).map(m => (
            <button key={m} onClick={() => onAddMood(m)}
              className="cp-btn cp-btn-sm"
              style={{
                background: MOOD_COLOR[m] + '20',
                borderColor: MOOD_COLOR[m] + '60',
                color: MOOD_COLOR[m],
                minHeight: 44, minWidth: 44, fontSize: 14,
              }}>
              {MOOD_LABEL[m]}
            </button>
          ))}
        </div>
        {monthlyTrend.some(b => b.total > 0) && (
          <div style={{ height: 160, marginTop: 4 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="positive" name="😊" stroke={MOOD_COLOR.positive} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="hopeful"  name="🌱" stroke={MOOD_COLOR.hopeful}  strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="anxious"  name="😟" stroke={MOOD_COLOR.anxious}  strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {moods.length > 0 && (
          <div className="cp-stack-sm" style={{ maxHeight: 160, overflowY: 'auto' }}>
            {moods.slice(0, 12).map(m => (
              <div key={m.id} className="cp-row-between" style={{ fontSize: 13 }}>
                <span>
                  <span className="cp-meta font-mono" style={{ marginRight: 6 }}>{m.date}</span>
                  <span style={{ color: MOOD_COLOR[m.mood] }}>{MOOD_LABEL[m.mood]}</span>
                  {m.note && <span className="cp-meta" style={{ marginLeft: 6 }}>— {m.note}</span>}
                </span>
                <button onClick={() => onRemoveMood(m.id)}
                  className="cp-btn cp-btn-ghost cp-btn-sm" style={{ color: '#f87171', minHeight: 28, padding: '0 8px' }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* センチメント分布チャートは撤去 (オーナー指示 2026-05-28:
          黒帯バグ + そもそも不要)。代わりに気持ちの内訳を簡潔なチップ表示に。 */}
      {chartData.length > 0 && (
        <div className="cp-card">
          <p className="cp-h3 mb-2">気持ちの内訳 (これまでのやり取り)</p>
          <div className="cp-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {chartData.map((d) => (
              <span key={d.name} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 999,
                background: `${d.color}18`, border: `1px solid ${d.color}44`,
                fontSize: 12, fontWeight: 700, color: 'var(--fg)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: d.color }} />
                {d.name} <strong style={{ color: d.color }}>{d.count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 交流記録追加 */}
      <div className="cp-card-section cp-stack-sm">
        <p className="cp-h3">交流記録を追加</p>
        <div className="cp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {(Object.keys(INTERACTION_LABEL) as InteractionType[]).map(t => (
            <button key={t} onClick={() => setInterType(t)}
              className="cp-btn cp-btn-sm text-xs"
              style={interType === t
                ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent', minHeight: 40 }
                : { minHeight: 40 }}>
              {INTERACTION_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="cp-grid-2">
          <div>
            <label className="cp-label">日付</label>
            <input type="date" value={interDate} onChange={e => setInterDate(e.target.value)} className="cp-input" />
          </div>
          <div>
            <label className="cp-label">センチメント</label>
            <select value={interSentiment} onChange={e => setInterSentiment(e.target.value as SentimentType)} className="cp-select">
              {(Object.keys(SENTIMENT_LABEL) as SentimentType[]).map(s => (
                <option key={s} value={s}>{SENTIMENT_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <input value={interSummary} onChange={e => setInterSummary(e.target.value)}
          placeholder="例: 四半期 KPI レビュー。進捗は良好、次回は予算について話し合う"
          className="cp-input" />
        <button onClick={() => {
          if (!interSummary.trim()) return;
          onAddInteraction({ date: interDate, type: interType, summary: interSummary, sentiment: interSentiment });
          setInterSummary('');
        }} className="cp-btn cp-btn-primary cp-btn-sm"
          style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 44 }}>
          記録を追加
        </button>
      </div>

      {/* 履歴タイムライン */}
      <div className="cp-card-section cp-stack-sm">
        <p className="cp-h3">交流タイムライン ({interactions.length}件)</p>
        {interactions.length === 0 ? (
          <p className="cp-meta text-center py-4">交流記録がまだありません</p>
        ) : (
          <div className="cp-stack-sm" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {interactions.map(i => (
              <div key={i.id} className="cp-row" style={{ alignItems: 'flex-start', gap: 10 }}>
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: 20 }}>
                  <div className="w-2 h-2 rounded-full mt-1.5"
                    style={{ background: i.sentiment ? SENTIMENT_COLOR[i.sentiment] : 'var(--fg-muted)' }} />
                  <div className="flex-1 w-px" style={{ background: 'var(--border)', minHeight: 16 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="cp-row-between mb-0.5">
                    <div className="cp-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <span className="cp-meta font-mono">{i.date}</span>
                      <span className="cp-pill text-[10px]">{INTERACTION_LABEL[i.type]}</span>
                      {i.sentiment && (
                        <span className="text-xs" style={{ color: SENTIMENT_COLOR[i.sentiment] }}>
                          {SENTIMENT_LABEL[i.sentiment]}
                        </span>
                      )}
                    </div>
                    <button onClick={() => onRemoveInteraction(i.id)}
                      className="cp-btn cp-btn-ghost cp-btn-sm text-xs flex-shrink-0"
                      style={{ color: '#f87171', padding: '0 4px', minHeight: 32, minWidth: 32 }}>✕</button>
                  </div>
                  <p className="cp-body">{i.summary}</p>
                  {i.highlights && i.highlights.length > 0 && (
                    <ul className="mt-1" style={{ paddingLeft: 14, listStyle: 'disc' }}>
                      {i.highlights.map((h, idx) => <li key={idx} className="cp-tiny" style={{ color: '#4ade80' }}>{h}</li>)}
                    </ul>
                  )}
                  {i.nextTopics && i.nextTopics.length > 0 && (
                    <div className="cp-row mt-1" style={{ gap: 4, flexWrap: 'wrap' }}>
                      <span className="cp-tiny">次回:</span>
                      {i.nextTopics.map((t, idx) => (
                        <span key={idx} className="cp-pill text-[10px]">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* メモ編集 */}
      <div>
        <label className="cp-label">メモ</label>
        <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
          className="cp-textarea" rows={3} placeholder="自由メモ…" />
        <button onClick={() => onUpdate({ notes: editNotes })}
          className="cp-btn cp-btn-ghost cp-btn-sm mt-1" style={{ minHeight: 40 }}>メモを保存</button>
      </div>
    </div>
  );
}

// アジェンダ 1 ブロックの表示
function AgendaBlock({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="cp-card-section" style={{ background: 'var(--surface-1)', borderLeft: `3px solid ${accent}` }}>
      <p className="cp-section-head" style={{ color: accent }}>{title}</p>
      <ul className="cp-stack-sm" style={{ paddingLeft: 16, listStyle: 'disc' }}>
        {items.map((t, i) => <li key={i} className="cp-body">{t}</li>)}
      </ul>
    </div>
  );
}

// ─── 新規追加フォーム ─────────────────────────────────────────
function PersonForm({ persona, onSave, onCancel }: {
  persona: Persona;
  onSave: (p: Partial<PersonRecord>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <motion.div key="compose"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
      <div className="cp-stack">
        <p className="cp-h3">新規人物を登録</p>
        <div className="cp-grid-2">
          <div>
            <label className="cp-label">名前 *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="例: 田中 一郎" className="cp-input" />
          </div>
          <div>
            <label className="cp-label">役職</label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="例: 事業部長" className="cp-input" />
          </div>
          <div>
            <label className="cp-label">会社</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="例: 株式会社サンプル" className="cp-input" />
          </div>
          <div>
            <label className="cp-label">メール</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="例: tanaka@example.com" className="cp-input" />
          </div>
          <div className="col-span-2">
            <label className="cp-label">タグ (カンマ区切り)</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="例: 重要顧客, 投資家, メンター" className="cp-input" />
          </div>
          <div className="col-span-2">
            <label className="cp-label">メモ</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="cp-textarea" rows={2} />
          </div>
        </div>
        <div className="cp-row-between pt-2">
          <button onClick={onCancel} className="cp-btn cp-btn-ghost" style={{ minHeight: 44 }}>キャンセル</button>
          <button
            onClick={() => {
              if (!name.trim()) return;
              onSave({
                name: name.trim(),
                role: role.trim() || undefined,
                company: company.trim() || undefined,
                contactInfo: email ? { email: email.trim() } : undefined,
                tags: tags.trim() ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
                notes: notes.trim() || undefined,
              });
            }}
            className="cp-btn cp-btn-primary"
            style={{ background: persona.accentColor, color: '#0a0a0f', minHeight: 44 }}>
            登録
          </button>
        </div>
      </div>
    </motion.div>
  );
}
