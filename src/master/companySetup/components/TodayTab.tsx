// ============================================================
// 今日タブ — Dashboard の最重要画面。会社情報より先に「今日やること」を出す。
// ============================================================
import { PartyPopper, CheckCircle2, Circle, Clock } from 'lucide-react';
import type { UseCompanySetupReturn } from '../useCompanySetup';
import { Card, TaskStatusBadge, PriorityBadge, WarningBanner, ProgressBar } from '../ui';
import { COLORS, formatDateJa } from '../tokens';

export default function TodayTab({ cs, onOpenTask }: { cs: UseCompanySetupReturn; onOpenTask: (id: string) => void }) {
  const { todayItems, nextAction, allDone, foundingWarnings, capitalWarning, progress, docPrepEstimate, foundingCompletedAt } = cs;
  const restItems = todayItems.slice(1);

  if (allDone) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Card style={{
          textAlign: 'center', padding: '36px 20px',
          background: `linear-gradient(160deg, ${COLORS.card}, rgba(216,168,59,0.10))`,
          border: `1px solid ${COLORS.gold}55`,
        }}>
          <PartyPopper size={34} color={COLORS.gold} />
          <div style={{ fontSize: 11, letterSpacing: '0.24em', color: COLORS.gold, fontWeight: 800, marginTop: 12 }}>COMPLETE</div>
          <h1 style={{ fontSize: 'clamp(1.3rem, 5vw, 1.7rem)', fontWeight: 900, color: COLORS.text, margin: '6px 0 4px' }}>
            株式会社CORE 設立完了
          </h1>
          {foundingCompletedAt && (
            <div style={{ fontSize: 13, color: COLORS.mut }}>設立日: {formatDateJa(foundingCompletedAt)}</div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {foundingWarnings.map((w) => <WarningBanner key={w} text={w} />)}
      {capitalWarning && <WarningBanner text={capitalWarning} tone="danger" />}

      {/* NEXT ACTION */}
      <Card style={{ background: `linear-gradient(160deg, ${COLORS.card}, rgba(216,168,59,0.08))`, border: `1px solid ${COLORS.gold}55` }}>
        <div style={{ fontSize: 10, letterSpacing: '0.28em', color: COLORS.gold, fontWeight: 800 }}>NEXT ACTION</div>
        {nextAction ? (
          <>
            <div style={{ fontSize: 'clamp(1.1rem, 4.5vw, 1.4rem)', fontWeight: 900, color: COLORS.text, margin: '8px 0 6px', lineHeight: 1.35 }}>
              {nextAction.nextAction || nextAction.title}
            </div>
            {nextAction.dueDate && (
              <div style={{ fontSize: 13, color: COLORS.mut, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
                <Clock size={13} /> 期限：{formatDateJa(nextAction.dueDate)}
              </div>
            )}
            <button
              onClick={() => cs.toggleTaskComplete(nextAction.id)}
              style={{
                minHeight: 48, width: '100%', borderRadius: 12, border: 'none',
                background: COLORS.gold, color: '#1A1300', fontWeight: 800, fontSize: 15,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <CheckCircle2 size={18} /> 完了にする
            </button>
            <button
              onClick={() => onOpenTask(nextAction.id)}
              style={{
                marginTop: 8, width: '100%', minHeight: 40, borderRadius: 10,
                background: 'transparent', border: `1px solid ${COLORS.line}`, color: COLORS.mut,
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              詳細を見る
            </button>
          </>
        ) : (
          <div style={{ marginTop: 10, color: COLORS.mut, fontSize: 14, lineHeight: 1.7 }}>
            今すぐできることはありません。次の工程の解放を待っています。
          </div>
        )}
      </Card>

      {restItems.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.mut, letterSpacing: '0.08em', marginBottom: 8 }}>ほかに今日やること</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {restItems.map((t) => (
              <button
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                style={{
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', borderRadius: 12, background: COLORS.card,
                  border: `1px solid ${COLORS.line}`, cursor: 'pointer', minHeight: 44,
                }}
              >
                <Circle size={16} color={COLORS.mut} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    {t.dueDate && <span style={{ fontSize: 11.5, color: COLORS.mut }}>期限 {formatDateJa(t.dueDate)}</span>}
                    <PriorityBadge priority={t.priority} />
                  </div>
                </div>
                <TaskStatusBadge status={t.status} />
              </button>
            ))}
          </div>
        </div>
      )}

      <Card style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 12, color: COLORS.mut, fontWeight: 700 }}>全体の進捗</span>
          <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 800 }}>{progress.completed}/{progress.total}（{progress.percent}%）</span>
        </div>
        <ProgressBar percent={progress.percent} />
        {docPrepEstimate.startDate && (
          <div style={{ fontSize: 12.5, color: COLORS.mut, marginTop: 2 }}>{docPrepEstimate.label}</div>
        )}
      </Card>
    </div>
  );
}
