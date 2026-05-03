import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Persona, KnowledgeItem } from '../types/identity';

interface Props {
  persona: Persona;
  knowledge: KnowledgeItem[];
  onToggleTask: (personaId: string, taskId: string) => void;
  onAcceptAction: (action: string) => void;
  onClose: () => void;
}

type View = 'today' | 'all' | 'sources' | 'kanban';

interface AggregatedTask {
  id: string;            // ユニークキー (実タスクなら id、提案からは action+source で生成)
  title: string;
  source: 'persona' | 'knowledge-action' | 'knowledge-strategy' | 'risk';
  sourceLabel: string;   // 例: "ナレッジ: 〇〇の戦略提案"
  priority: 'high' | 'mid' | 'low';
  done: boolean;
  due?: string;
  /** 取り込めるアクション (未タスク化) */
  isProposal?: boolean;
  /** 元データへの参照 */
  knowledgeId?: string;
  taskId?: string;
}

export default function TaskHub({ persona, knowledge, onToggleTask, onAcceptAction, onClose }: Props) {
  const [view, setView] = useState<View>('today');
  const [filter, setFilter] = useState<'all' | 'high' | 'open' | 'done'>('open');

  // 全タスク集約
  const tasks: AggregatedTask[] = useMemo(() => {
    const out: AggregatedTask[] = [];
    // 1. 人格に紐づく実タスク
    for (const t of persona.tasks) {
      out.push({
        id: `task:${t.id}`,
        title: t.title,
        source: 'persona',
        sourceLabel: '直接登録',
        priority: t.priority,
        done: t.done,
        due: t.due,
        taskId: t.id,
      });
    }
    // 2. ナレッジ分析からのアクション提案 (未タスク化)
    const personaKnowledge = knowledge.filter(k => k.personaId === persona.id);
    for (const k of personaKnowledge) {
      if (k.analysis?.actions) {
        for (const a of k.analysis.actions) {
          out.push({
            id: `kb-action:${k.id}:${a.slice(0, 30)}`,
            title: a,
            source: 'knowledge-action',
            sourceLabel: `📄 ${k.title}`,
            priority: 'mid',
            done: false,
            isProposal: true,
            knowledgeId: k.id,
          });
        }
      }
      if (k.analysis?.strategy) {
        for (const s of k.analysis.strategy) {
          out.push({
            id: `kb-strategy:${k.id}:${s.slice(0, 30)}`,
            title: s,
            source: 'knowledge-strategy',
            sourceLabel: `🎯 ${k.title}`,
            priority: 'mid',
            done: false,
            isProposal: true,
            knowledgeId: k.id,
          });
        }
      }
      if (k.analysis?.risks) {
        for (const r of k.analysis.risks) {
          out.push({
            id: `kb-risk:${k.id}:${r.slice(0, 30)}`,
            title: r,
            source: 'risk',
            sourceLabel: `⚠ ${k.title}`,
            priority: 'high',
            done: false,
            isProposal: true,
            knowledgeId: k.id,
          });
        }
      }
    }
    return out;
  }, [persona.tasks, knowledge, persona.id]);

  const filtered = useMemo(() => {
    let arr = tasks;
    if (filter === 'high') arr = arr.filter(t => t.priority === 'high');
    else if (filter === 'open') arr = arr.filter(t => !t.done);
    else if (filter === 'done') arr = arr.filter(t => t.done);
    return arr;
  }, [tasks, filter]);

  const todayTasks = useMemo(() => {
    const open = filtered.filter(t => !t.done);
    const proposals = open.filter(t => t.isProposal).slice(0, 5);
    const real = open.filter(t => !t.isProposal).slice(0, 8);
    return { real, proposals };
  }, [filtered]);

  const summary = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.done).length;
    const high = tasks.filter(t => t.priority === 'high' && !t.done).length;
    const proposals = tasks.filter(t => t.isProposal).length;
    return { total, done, high, proposals, doneRate: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [tasks]);

  const groupBySource = useMemo(() => {
    const map = new Map<string, AggregatedTask[]>();
    for (const t of filtered) {
      const k = t.sourceLabel;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const groupByPriority = useMemo(() => {
    return {
      high: filtered.filter(t => t.priority === 'high' && !t.done),
      mid: filtered.filter(t => t.priority === 'mid' && !t.done),
      low: filtered.filter(t => t.priority === 'low' && !t.done),
      done: filtered.filter(t => t.done),
    };
  }, [filtered]);

  return (
    <motion.div
      className="cp-modal-bg"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="cp-modal"
        style={{ maxWidth: '1000px' }}
        initial={{ scale: 0.97, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 12 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="cp-modal-header">
          <div className="cp-row min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: persona.accentColorLight, color: persona.accentColor }}>✅</div>
            <div className="min-w-0">
              <p className="cp-h2 truncate">タスクハブ</p>
              <p className="cp-meta truncate">{persona.name} · 実タスク + ナレッジから抽出した提案を一元管理</p>
            </div>
          </div>
          <button onClick={onClose} className="cp-btn cp-btn-ghost cp-btn-sm">✕</button>
        </div>

        <div className="cp-modal-tabs">
          {([
            { id: 'today' as View,  label: '🌅 今日のフォーカス' },
            { id: 'kanban' as View, label: '📊 優先度別' },
            { id: 'sources' as View,label: '📁 ソース別' },
            { id: 'all' as View,    label: `📋 全て (${tasks.length})` },
          ]).map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className="cp-modal-tab" data-active={view === t.id}
              style={{ color: view === t.id ? persona.accentColor : undefined }}
            >{t.label}</button>
          ))}
        </div>

        <div className="cp-modal-body cp-stack">
          {/* サマリーバー */}
          <div className="cp-grid-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[
              { label: '進行中',     value: summary.total - summary.done, color: persona.accentColor },
              { label: '高優先',     value: summary.high, color: '#FF6B6B' },
              { label: '提案中',     value: summary.proposals, color: '#C084FC' },
              { label: '完了率',     value: `${summary.doneRate}%`, color: '#4ADE80' },
            ].map(s => (
              <div key={s.label} className="cp-card text-center">
                <p className="cp-tiny">{s.label}</p>
                <p className="text-fg" style={{ fontSize: '1.6rem', fontWeight: 600, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* フィルタ */}
          {view !== 'today' && (
            <div className="cp-row" style={{ gap: 4, flexWrap: 'wrap' }}>
              {([
                { id: 'open', label: '🌱 未完了' },
                { id: 'high', label: '🔥 高優先' },
                { id: 'done', label: '✓ 完了' },
                { id: 'all',  label: '全部' },
              ] as const).map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className="cp-btn cp-btn-sm"
                  style={filter === f.id ? { background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' } : {}}>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* 今日のフォーカス */}
          {view === 'today' && (
            <>
              <div className="cp-card-section">
                <p className="cp-h3 mb-2">🎯 取り組むべきタスク</p>
                {todayTasks.real.length === 0 ? (
                  <p className="cp-meta">未完了のタスクがありません</p>
                ) : (
                  <div className="cp-stack-sm">
                    {todayTasks.real.map(t => (
                      <TaskRow key={t.id} task={t} persona={persona}
                        onToggle={() => t.taskId && onToggleTask(persona.id, t.taskId)}
                        onAccept={() => t.isProposal && onAcceptAction(t.title)} />
                    ))}
                  </div>
                )}
              </div>

              {todayTasks.proposals.length > 0 && (
                <div className="cp-card-section">
                  <p className="cp-h3 mb-1">💡 ナレッジから AI が提案</p>
                  <p className="cp-meta mb-3">タップでタスクに昇格できます</p>
                  <div className="cp-stack-sm">
                    {todayTasks.proposals.map(t => (
                      <TaskRow key={t.id} task={t} persona={persona}
                        onToggle={() => {}}
                        onAccept={() => onAcceptAction(t.title)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 優先度別 */}
          {view === 'kanban' && (
            <div className="flex gap-3 overflow-x-auto">
              {([
                { id: 'high', label: '🔥 高優先', color: '#FF6B6B', tasks: groupByPriority.high },
                { id: 'mid',  label: '🌟 中', color: '#FACC15', tasks: groupByPriority.mid },
                { id: 'low',  label: '🌱 低', color: '#9088A8', tasks: groupByPriority.low },
                { id: 'done', label: '✓ 完了', color: '#4ADE80', tasks: groupByPriority.done },
              ] as const).map(col => (
                <div key={col.id} className="flex-shrink-0" style={{ width: '240px' }}>
                  <div className="cp-row mb-2" style={{ gap: 6 }}>
                    <span className="cp-h3" style={{ color: col.color }}>{col.label}</span>
                    <span className="cp-meta">{col.tasks.length}</span>
                  </div>
                  <div className="rounded-lg p-2 cp-stack-sm" style={{ background: col.color + '10', border: `1px dashed ${col.color}40`, minHeight: '300px' }}>
                    {col.tasks.length === 0 && <p className="cp-tiny text-center py-4">なし</p>}
                    {col.tasks.map(t => (
                      <TaskRow key={t.id} task={t} persona={persona}
                        onToggle={() => t.taskId && onToggleTask(persona.id, t.taskId)}
                        onAccept={() => t.isProposal && onAcceptAction(t.title)}
                        compact />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ソース別 */}
          {view === 'sources' && (
            <div className="cp-stack">
              {groupBySource.map(([source, list]) => (
                <div key={source} className="cp-card-section">
                  <div className="cp-row-between mb-2">
                    <p className="cp-h3">{source}</p>
                    <span className="cp-meta">{list.length}件</span>
                  </div>
                  <div className="cp-stack-sm">
                    {list.map(t => (
                      <TaskRow key={t.id} task={t} persona={persona}
                        onToggle={() => t.taskId && onToggleTask(persona.id, t.taskId)}
                        onAccept={() => t.isProposal && onAcceptAction(t.title)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 全部 */}
          {view === 'all' && (
            <div className="cp-stack-sm">
              {filtered.length === 0 ? (
                <div className="cp-empty"><p className="cp-empty-icon">📭</p><p>該当するタスクがありません</p></div>
              ) : filtered.map(t => (
                <TaskRow key={t.id} task={t} persona={persona}
                  onToggle={() => t.taskId && onToggleTask(persona.id, t.taskId)}
                  onAccept={() => t.isProposal && onAcceptAction(t.title)} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TaskRow({ task, persona, onToggle, onAccept, compact }: {
  task: AggregatedTask; persona: Persona;
  onToggle: () => void; onAccept: () => void; compact?: boolean;
}) {
  const priColor = task.priority === 'high' ? '#FF6B6B' : task.priority === 'mid' ? '#FACC15' : '#9088A8';
  return (
    <div className="cp-card cp-row" style={{ gap: 10, padding: compact ? '8px 10px' : undefined }}>
      <button onClick={onToggle} disabled={task.isProposal}
        className="flex-shrink-0 rounded-md flex items-center justify-center"
        style={{
          width: 22, height: 22,
          background: task.done ? persona.accentColor : 'transparent',
          border: `1.5px solid ${task.done ? persona.accentColor : priColor}`,
          opacity: task.isProposal ? 0.4 : 1,
          cursor: task.isProposal ? 'default' : 'pointer',
        }}>
        {task.done && <span style={{ color: '#0a0a0f', fontSize: 14 }}>✓</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className="cp-body" style={{
          textDecoration: task.done ? 'line-through' : 'none',
          color: task.done ? 'var(--fg-subtle)' : undefined,
          fontSize: compact ? '0.85rem' : undefined,
          lineHeight: 1.5,
        }}>{task.title}</p>
        {!compact && (
          <p className="cp-meta truncate" style={{ marginTop: 2 }}>
            <span className="cp-pill" style={{ borderColor: priColor + '50', color: priColor }}>{task.priority === 'high' ? '高' : task.priority === 'mid' ? '中' : '低'}</span>
            <span className="ml-2">{task.sourceLabel}</span>
            {task.due && <span className="ml-2 font-mono">{task.due}</span>}
          </p>
        )}
      </div>
      {task.isProposal && (
        <button onClick={onAccept} className="cp-btn cp-btn-sm flex-shrink-0"
          style={{ background: persona.accentColor, color: '#0a0a0f', borderColor: 'transparent' }}>
          + タスク化
        </button>
      )}
    </div>
  );
}
