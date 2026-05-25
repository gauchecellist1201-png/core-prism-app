import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { KnowledgeItem, Persona, Proposal, Task } from '../types/identity';

interface Props {
  persona: Persona;
  knowledge: KnowledgeItem[];
  proposals: Proposal[];
}

interface Event {
  id: string;
  at: number;
  emoji: string;
  title: string;
  body?: string;
  tint: string;
}

export default function ActivityTimeline({ persona, knowledge, proposals }: Props) {
  const events: Event[] = useMemo(() => {
    const out: Event[] = [];

    for (const k of knowledge) {
      out.push({
        id: 'kb-' + k.id,
        at: new Date(k.createdAt).getTime(),
        emoji: k.fileKind === 'image' ? '🖼' : k.fileKind === 'pdf' ? '📕' : k.fileKind === 'pptx' ? '📊' : k.fileKind === 'docx' ? '📝' : k.fileKind === 'xlsx' ? '📈' : '📄',
        title: `資料を取り込み: ${k.title}`,
        body: k.analysis?.summary?.slice(0, 100),
        tint: persona.accentColor,
      });
      if (k.analysis) {
        out.push({
          id: 'an-' + k.id,
          at: new Date(k.analysis.generatedAt).getTime(),
          emoji: '🧠',
          title: `AI分析完了: ${k.title}`,
          body: `${k.analysis.actions.length}件のアクション・${k.analysis.strategy.length}件の戦略を抽出`,
          tint: '#34d399',
        });
      }
    }

    for (const p of proposals) {
      out.push({
        id: 'pr-' + p.id,
        at: new Date(p.generatedAt).getTime(),
        emoji: '💡',
        title: p.title,
        body: p.message.slice(0, 100),
        tint: persona.accentColor,
      });
    }

    for (const t of persona.tasks as Task[]) {
      if (t.done) {
        out.push({
          id: 'tk-' + t.id,
          at: Date.now() - Math.random() * 86400000,
          emoji: '✓',
          title: `タスク完了: ${t.title}`,
          tint: '#34d399',
        });
      }
    }

    return out.sort((a, b) => b.at - a.at).slice(0, 8);
  }, [knowledge, proposals, persona]);

  if (events.length === 0) {
    return (
      <motion.div
        className="rounded-2xl p-4"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <p className="text-fg text-base font-medium mb-2">📜 最近の動き</p>
        <p className="text-fg-muted text-sm leading-relaxed">
          ここはあなたの「足跡」が積もる場所です。<br />
          資料の取り込み、タスクの完了、AI 提案の受け入れ、3 つのどれかで線が伸びます。
        </p>
        <div className="mt-3 px-3 py-2 rounded-lg text-xs"
          style={{ background: `${persona.accentColor}10`, border: `1px dashed ${persona.accentColor}40`, color: persona.accentColor }}>
          ⏳ まず 1 つ動くと、ここがあなた専用の歴史になります
        </div>
      </motion.div>
    );
  }

  const fmt = (ms: number) => {
    const diff = Date.now() - ms;
    if (diff < 60_000) return 'たった今';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}時間前`;
    return new Date(ms).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <p className="text-fg text-base font-medium">📜 最近の動き</p>
        <p className="text-fg-muted text-xs">{events.length}件</p>
      </div>
      <div className="px-3 pb-3 relative">
        <div className="absolute left-[22px] top-2 bottom-2 w-px" style={{ background: 'var(--border)' }} />
        <div className="space-y-2">
          {events.map((e, i) => (
            <motion.div
              key={e.id}
              className="relative flex items-start gap-3 pl-1"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 z-10"
                style={{
                  background: 'var(--surface)',
                  border: `1.5px solid ${e.tint}`,
                  color: e.tint,
                }}
              >
                {e.emoji}
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-fg text-sm font-medium truncate">{e.title}</p>
                  <p className="text-fg-muted text-xs flex-shrink-0">{fmt(e.at)}</p>
                </div>
                {e.body && (
                  <p className="text-fg-muted text-sm leading-snug mt-0.5 line-clamp-2">{e.body}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
