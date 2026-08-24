// ============================================================
// タスク詳細シート — メモ / 費用 / 期限 / 次アクションの編集と完了操作。
// ============================================================
import { X, CheckCircle2, RotateCcw, Lock } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { UseCompanySetupReturn } from '../useCompanySetup';
import { TaskStatusBadge } from '../ui';
import { COLORS, FONT, formatYen } from '../tokens';
import { CAPITAL_TASK_ID, DOCS_ARRIVED_TASK_ID } from '../constants';
import type { TaskPriority, TaskStatus } from '../types';

const inputStyle: CSSProperties = {
  width: '100%', minHeight: 40, borderRadius: 10, padding: '8px 10px',
  background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLORS.line}`,
  color: COLORS.text, fontSize: 14, fontFamily: FONT, boxSizing: 'border-box',
};

const labelStyle: CSSProperties = {
  fontSize: 11.5, fontWeight: 700, color: COLORS.mut, marginBottom: 5, display: 'block',
};

export default function TaskDetailSheet({ cs, taskId, onClose }: { cs: UseCompanySetupReturn; taskId: string; onClose: () => void }) {
  const task = cs.byId[taskId];
  if (!task) return null;

  const unlocked = cs.isUnlocked(taskId);
  const blockedByTitles = task.dependencies
    .map((depId) => cs.byId[depId])
    .filter((d) => d && d.status !== 'completed')
    .map((d) => d!.title);

  const isCapitalTask = taskId === CAPITAL_TASK_ID;
  const docsArrivedDone = cs.byId[DOCS_ARRIVED_TASK_ID]?.status === 'completed';
  const capitalHardLocked = isCapitalTask && !docsArrivedDone;

  const activeDependents = cs.tasks.filter((t) => t.dependencies.includes(taskId) && t.status !== 'not_started');

  const linkedDocs = task.documents.map((id) => cs.documents.find((d) => d.id === id)).filter(Boolean);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto',
          background: COLORS.ink, borderTop: `1px solid ${COLORS.line}`,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '18px 18px calc(24px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} aria-label="閉じる" style={{
            width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.06)',
            border: 'none', color: COLORS.mut, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <TaskStatusBadge status={task.status} />
          {!unlocked && task.status !== 'completed' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: COLORS.lock }}>
              <Lock size={11} /> ロック中
            </span>
          )}
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: COLORS.text, margin: '2px 0 4px', lineHeight: 1.35 }}>{task.title}</h2>
        {task.description && <p style={{ fontSize: 13, color: COLORS.mut, lineHeight: 1.6, margin: '0 0 14px' }}>{task.description}</p>}

        {blockedByTitles.length > 0 && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(100,116,139,0.12)', border: `1px solid ${COLORS.lock}44`, fontSize: 12.5, color: COLORS.mut, marginBottom: 14 }}>
            先に完了が必要: {blockedByTitles.join(' / ')}
          </div>
        )}
        {capitalHardLocked && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: COLORS.dangerSoft, border: `1px solid ${COLORS.danger}44`, fontSize: 12.5, color: COLORS.danger, marginBottom: 14, fontWeight: 700 }}>
            ⚠️ 設立書類到着前に資本金を払い込まない — 「設立書類が到着する」を先に完了にしてください
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>次にやること</label>
            <input
              style={inputStyle}
              value={task.nextAction}
              onChange={(e) => cs.updateTask(task.id, { nextAction: e.target.value })}
              placeholder="次に何をするか"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>状態</label>
              <select
                style={inputStyle}
                value={task.status === 'completed' ? 'not_started' : task.status}
                disabled={task.status === 'completed'}
                onChange={(e) => cs.updateTask(task.id, { status: e.target.value as TaskStatus })}
              >
                <option value="not_started">未着手</option>
                <option value="in_progress">進行中</option>
                <option value="blocked">停滞</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>優先度</label>
              <select
                style={inputStyle}
                value={task.priority}
                onChange={(e) => cs.updateTask(task.id, { priority: e.target.value as TaskPriority })}
              >
                <option value="critical">最優先</option>
                <option value="high">優先</option>
                <option value="normal">通常</option>
                <option value="low">低</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>期限</label>
              <input
                type="date" style={inputStyle}
                value={task.dueDate ?? ''}
                onChange={(e) => cs.updateTask(task.id, { dueDate: e.target.value || null })}
              />
            </div>
            <div>
              <label style={labelStyle}>待ち事項</label>
              <input
                style={inputStyle}
                value={task.waitingFor ?? ''}
                onChange={(e) => cs.updateTask(task.id, { waitingFor: e.target.value || null })}
                placeholder="例: 井坂事務所からの返送"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>予定費用</label>
              <input
                type="number" style={inputStyle}
                value={task.cost ?? ''}
                onChange={(e) => cs.updateTask(task.id, { cost: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="円"
              />
            </div>
            <div>
              <label style={labelStyle}>実績費用</label>
              <input
                type="number" style={inputStyle}
                value={task.actualCost ?? ''}
                onChange={(e) => cs.updateTask(task.id, { actualCost: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="円"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>メモ</label>
            <textarea
              style={{ ...inputStyle, minHeight: 72, resize: 'vertical', paddingTop: 8 }}
              value={task.memo}
              onChange={(e) => cs.updateTask(task.id, { memo: e.target.value })}
              placeholder="メモを残す"
            />
          </div>

          {linkedDocs.length > 0 && (
            <div>
              <label style={labelStyle}>関連書類</label>
              <div style={{ fontSize: 13, color: COLORS.mut }}>{linkedDocs.map((d) => d!.name).join(' / ')}</div>
            </div>
          )}

          {(task.cost != null || task.actualCost != null) && (
            <div style={{ fontSize: 12, color: COLORS.mut }}>
              予定 {formatYen(task.cost)} ／ 実績 {formatYen(task.actualCost)}
            </div>
          )}
        </div>

        {task.status === 'completed' ? (
          <>
            {activeDependents.length > 0 && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(100,116,139,0.12)', border: `1px solid ${COLORS.lock}44`, fontSize: 12.5, color: COLORS.mut, marginBottom: 10 }}>
                後続タスクが着手済みのため取り消せません: {activeDependents.map((d) => d.title).join(' / ')}
              </div>
            )}
            <button
              onClick={() => cs.toggleTaskComplete(task.id)}
              disabled={activeDependents.length > 0}
              style={{
                width: '100%', minHeight: 48, borderRadius: 12,
                cursor: activeDependents.length > 0 ? 'not-allowed' : 'pointer',
                background: 'transparent', border: `1px solid ${COLORS.line}`,
                color: activeDependents.length > 0 ? 'rgba(154,166,178,0.4)' : COLORS.mut,
                fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            ><RotateCcw size={16} /> 完了を取り消す</button>
          </>
        ) : (
          <button
            onClick={() => cs.toggleTaskComplete(task.id)}
            disabled={!unlocked || capitalHardLocked}
            style={{
              width: '100%', minHeight: 48, borderRadius: 12, border: 'none',
              background: (!unlocked || capitalHardLocked) ? 'rgba(255,255,255,0.08)' : COLORS.gold,
              color: (!unlocked || capitalHardLocked) ? COLORS.mut : '#1A1300',
              fontSize: 15, fontWeight: 800, cursor: (!unlocked || capitalHardLocked) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          ><CheckCircle2 size={18} /> 完了にする</button>
        )}
      </div>
    </div>
  );
}
