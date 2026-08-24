// ============================================================
// タスクタブ — フェーズ別に全タスクを一覧表示。ロック中のタスクは鍵アイコンで示す。
// ============================================================
import { CheckCircle2, Circle, Lock, ChevronRight } from 'lucide-react';
import type { UseCompanySetupReturn } from '../useCompanySetup';
import { TaskStatusBadge } from '../ui';
import { COLORS, formatDateJa } from '../tokens';

export default function TasksTab({ cs, onOpenTask }: { cs: UseCompanySetupReturn; onOpenTask: (id: string) => void }) {
  const { phases, tasks, isUnlocked } = cs;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {[...phases].sort((a, b) => a.order - b.order).map((phase) => {
        const phaseTasks = tasks.filter((t) => t.phaseId === phase.id);
        if (phaseTasks.length === 0) return null;
        const done = phaseTasks.filter((t) => t.status === 'completed').length;
        return (
          <div key={phase.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, padding: '0 2px' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.mut, letterSpacing: '0.06em' }}>{phase.title}</span>
              <span style={{ fontSize: 11.5, color: COLORS.mut }}>{done}/{phaseTasks.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {phaseTasks.map((t) => {
                const unlocked = isUnlocked(t.id);
                const locked = !unlocked && t.status !== 'completed';
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTask(t.id)}
                    style={{
                      textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 12,
                      background: COLORS.card, border: `1px solid ${COLORS.line}`,
                      cursor: 'pointer', minHeight: 44, opacity: locked ? 0.55 : 1,
                    }}
                  >
                    {t.status === 'completed'
                      ? <CheckCircle2 size={18} color={COLORS.teal} style={{ flexShrink: 0 }} />
                      : locked
                        ? <Lock size={16} color={COLORS.lock} style={{ flexShrink: 0 }} />
                        : <Circle size={18} color={COLORS.mut} style={{ flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: t.status === 'completed' ? COLORS.mut : COLORS.text,
                        textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{t.title}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                        {t.dueDate && <span style={{ fontSize: 11.5, color: COLORS.mut }}>期限 {formatDateJa(t.dueDate)}</span>}
                        {locked && <span style={{ fontSize: 11.5, color: COLORS.lock }}>ロック中</span>}
                      </div>
                    </div>
                    <TaskStatusBadge status={t.status} />
                    <ChevronRight size={16} color={COLORS.mut} style={{ flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
