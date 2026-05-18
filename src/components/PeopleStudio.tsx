import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Persona, AppSettings } from '../types/identity';
import type { PersonRecord, PersonInteraction, SentimentType, InteractionType } from '../types/people';
import { usePeople } from '../hooks/usePeople';
import { analyzePerson, type PersonAnalysis } from '../lib/peopleAnalyst';
import SampleDataCTA from './SampleDataCTA';

interface Props {
  persona: Persona;
  settings: AppSettings;
  onClose: () => void;
}

type View = 'list' | 'detail' | 'compose';

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

export default function PeopleStudio({ persona, settings, onClose }: Props) {
  const pp = usePeople();
  const people = useMemo(() => pp.getForPersona(persona.id), [pp.people, persona.id]);

  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
        style={{ maxWidth: '960px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>👥</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">人物ケア</p>
              <p className="cp-meta truncate">{persona.name} · 1on1 履歴 + センチメント分析</p>
            </div>
          </div>
          <div className="cp-row">
            {view !== 'list' && (
              <button onClick={() => { setView('list'); setSelectedId(null); }}
                className="cp-btn cp-btn-ghost cp-btn-sm">← 一覧</button>
            )}
            {view === 'list' && (
              <button onClick={() => setView('compose')}
                className="cp-btn cp-btn-primary cp-btn-sm"
                style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                ＋ 人物を追加
              </button>
            )}
            <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
          </div>
        </div>

        <div className="cp-modal-body">
          <AnimatePresence mode="wait">
            {/* ─── 人物一覧 ─── */}
            {view === 'list' && (
              <motion.div key="list"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="cp-stack">
                  <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="名前・会社・タグで検索…"
                    className="cp-input"
                  />
                  {filtered.length === 0 ? (
                    <div className="cp-empty">
                      <p className="cp-empty-icon">👥</p>
                      <p>人物がまだ登録されていません</p>
                      <button onClick={() => setView('compose')}
                        className="cp-btn cp-btn-primary mt-3"
                        style={{ background: persona.accentColor, color: '#0a0a0f' }}>
                        ＋ 最初の人物を登録
                      </button>
                      <SampleDataCTA accent={persona.accentColor} hint="サンプルの人物と面談記録が入り、ケア機能をすぐ試せます" />
                    </div>
                  ) : (
                    <div className="cp-stack-sm">
                      {filtered.map(p => {
                        const pInteractions = pp.getInteractionsForPerson(p.id);
                        const lastSentiment = pInteractions.find(i => i.sentiment)?.sentiment;
                        return (
                          <button key={p.id} onClick={() => openDetail(p.id)}
                            className="cp-card cp-row-between text-left w-full hover:scale-[1.005] transition-transform">
                            <div className="cp-row min-w-0">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0"
                                style={{ background: persona.accentColorLight, color: persona.accentColor }}>
                                {p.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="cp-row" style={{ gap: 6 }}>
                                  <p className="cp-h3 truncate">{p.name}</p>
                                  {lastSentiment && (
                                    <span className="text-xs" style={{ color: SENTIMENT_COLOR[lastSentiment] }}>
                                      {SENTIMENT_LABEL[lastSentiment].split(' ')[0]}
                                    </span>
                                  )}
                                </div>
                                <p className="cp-meta truncate">
                                  {p.role && `${p.role} `}{p.company && `· ${p.company}`}
                                </p>
                                {p.lastInteraction && (
                                  <p className="cp-tiny">最終接触: {p.lastInteraction}</p>
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
                onUpdate={(patch) => pp.upsertPerson({ ...selected, ...patch })}
                onDelete={() => { if (confirm('削除しますか?')) { pp.removePerson(selected.id); setView('list'); } }}
                onAddInteraction={(inter) => pp.addInteraction({ ...inter, personId: selected.id })}
                onRemoveInteraction={pp.removeInteraction}
              />
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
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── 詳細コンポーネント ──────────────────────────────────────
function PersonDetail({ person, interactions, persona, settings, onUpdate, onDelete, onAddInteraction, onRemoveInteraction }: {
  person: PersonRecord;
  interactions: PersonInteraction[];
  persona: Persona;
  settings: AppSettings;
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

  return (
    <div className="cp-stack">
      {/* プロフィールヘッダー */}
      <div className="cp-row-between">
        <div className="cp-row">
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: persona.accentColorLight, color: persona.accentColor }}>
            {person.name.charAt(0)}
          </div>
          <div>
            <p className="cp-h2">{person.name}</p>
            <p className="cp-meta">{person.role && `${person.role}`}{person.company && ` · ${person.company}`}</p>
            {(person.tags || []).length > 0 && (
              <div className="cp-row mt-1" style={{ gap: 4 }}>
                {person.tags!.map(t => (
                  <span key={t} className="cp-pill text-[10px]"
                    style={{ color: persona.accentColor, borderColor: persona.accentColor + '40' }}>{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="cp-row">
          <button onClick={handleAnalyze} disabled={analyzing}
            className="cp-btn cp-btn-primary cp-btn-sm"
            style={{ background: persona.accentColor, color: '#0a0a0f' }}>
            {analyzing ? '分析中…' : '🤖 AI 分析'}
          </button>
          <button onClick={onDelete} className="cp-btn cp-btn-ghost cp-btn-sm" style={{ color: '#f87171' }}>削除</button>
        </div>
      </div>

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
              <p className="cp-h3">🤖 AI 分析結果</p>
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

      {/* センチメントチャート */}
      {chartData.length > 0 && (
        <div className="cp-card">
          <p className="cp-h3 mb-2">センチメント分布</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--fg-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <rect key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 交流記録追加 */}
      <div className="cp-card-section cp-stack-sm">
        <p className="cp-h3">交流記録を追加</p>
        <div className="cp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {(Object.keys(INTERACTION_LABEL) as InteractionType[]).map(t => (
            <button key={t} onClick={() => setInterType(t)}
              className="cp-btn cp-btn-sm text-xs"
              style={interType === t ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' } : {}}>
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
          style={{ background: persona.accentColor, color: '#0a0a0f' }}>
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
                    <div className="cp-row" style={{ gap: 6 }}>
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
                      style={{ color: '#f87171', padding: '0 4px' }}>✕</button>
                  </div>
                  <p className="cp-body">{i.summary}</p>
                  {i.highlights && i.highlights.length > 0 && (
                    <ul className="mt-1" style={{ paddingLeft: 14, listStyle: 'disc' }}>
                      {i.highlights.map((h, idx) => <li key={idx} className="cp-tiny" style={{ color: '#4ade80' }}>{h}</li>)}
                    </ul>
                  )}
                  {i.nextTopics && i.nextTopics.length > 0 && (
                    <div className="cp-row mt-1" style={{ gap: 4 }}>
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
          className="cp-btn cp-btn-ghost cp-btn-sm mt-1">メモを保存</button>
      </div>
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
          <button onClick={onCancel} className="cp-btn cp-btn-ghost">キャンセル</button>
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
            style={{ background: persona.accentColor, color: '#0a0a0f' }}>
            登録
          </button>
        </div>
      </div>
    </motion.div>
  );
}
