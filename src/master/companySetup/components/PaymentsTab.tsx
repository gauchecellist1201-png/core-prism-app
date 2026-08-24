// ============================================================
// 支払いタブ — 予定費用 / 実支払額 / 残り予定額 と、支払い一覧 (タップで詳細編集)。
// 資本金は費用集計から除外し、別枠で表示する。
// ============================================================
import { useState } from 'react';
import { ChevronDown, ChevronUp, Landmark } from 'lucide-react';
import type { UseCompanySetupReturn } from '../useCompanySetup';
import { Card, PaymentStatusBadge } from '../ui';
import { COLORS, FONT, formatYen, formatDateJa } from '../tokens';
import type { PaymentStatus } from '../types';

export default function PaymentsTab({ cs }: { cs: UseCompanySetupReturn }) {
  const { payments, costs } = cs;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const costItems = payments.filter((p) => !p.isCapital);
  const capital = payments.find((p) => p.isCapital) ?? null;

  return (
    <div style={{ display: 'grid', gap: 16, fontFamily: FONT }}>
      <Card style={{ display: 'grid', gap: 10 }}>
        <Row label="予定費用" value={formatYen(costs.plannedTotal)} />
        <Row label="実支払額" value={formatYen(costs.actualPaid)} color={COLORS.teal} />
        <Row label="残り予定額" value={formatYen(costs.remainingPlanned)} color={costs.remainingPlanned > 0 ? COLORS.warn : COLORS.mut} />
      </Card>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.mut, letterSpacing: '0.06em', marginBottom: 8 }}>支払い予定</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {costItems.map((p) => (
            <PaymentRow key={p.id} cs={cs} paymentId={p.id} expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} />
          ))}
        </div>
      </div>

      {capital && (
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: COLORS.mut, letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Landmark size={13} /> 資本金 (費用には含まない)
          </div>
          <PaymentRow cs={cs} paymentId={capital.id} expanded={expandedId === capital.id} onToggle={() => setExpandedId(expandedId === capital.id ? null : capital.id)} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, color: COLORS.mut, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color: color ?? COLORS.text }}>{value}</span>
    </div>
  );
}

function PaymentRow({ cs, paymentId, expanded, onToggle }: {
  cs: UseCompanySetupReturn; paymentId: string; expanded: boolean; onToggle: () => void;
}) {
  const p = cs.payments.find((x) => x.id === paymentId);
  if (!p) return null;
  const inputStyle = {
    width: '100%', minHeight: 38, borderRadius: 9, padding: '7px 9px',
    background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLORS.line}`,
    color: COLORS.text, fontSize: 13.5, fontFamily: FONT, boxSizing: 'border-box' as const,
  };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: COLORS.mut, marginBottom: 4, display: 'block' as const };

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        disabled={p.status === 'locked'}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'transparent', border: 'none', cursor: p.status === 'locked' ? 'default' : 'pointer',
          textAlign: 'left', minHeight: 44,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{p.label}</div>
          <div style={{ fontSize: 12.5, color: COLORS.mut, marginTop: 2 }}>
            {formatYen(p.status === 'paid' ? (p.actualAmount ?? p.plannedAmount) : p.plannedAmount)}
            {p.dueDate && p.status !== 'paid' && ` ・ 期限 ${formatDateJa(p.dueDate)}`}
          </div>
        </div>
        <PaymentStatusBadge status={p.status} />
        {p.status !== 'locked' && (expanded ? <ChevronUp size={16} color={COLORS.mut} /> : <ChevronDown size={16} color={COLORS.mut} />)}
      </button>

      {expanded && p.status !== 'locked' && (
        <div style={{ padding: '0 14px 14px', display: 'grid', gap: 10, borderTop: `1px solid ${COLORS.line}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            <div>
              <label style={labelStyle}>状態</label>
              <select
                style={inputStyle}
                value={p.status}
                onChange={(e) => {
                  const status = e.target.value as PaymentStatus;
                  cs.updatePayment(p.id, {
                    status,
                    paidAt: status === 'paid' ? (p.paidAt ?? new Date().toISOString()) : null,
                    actualAmount: status === 'paid' ? (p.actualAmount ?? p.plannedAmount) : p.actualAmount,
                  });
                }}
              >
                <option value="unpaid">未払い</option>
                <option value="paid">支払済み</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>実際の金額</label>
              <input
                type="number" style={inputStyle}
                value={p.actualAmount ?? ''}
                onChange={(e) => cs.updatePayment(p.id, { actualAmount: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="円"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>期限</label>
            <input
              type="date" style={inputStyle}
              value={p.dueDate ?? ''}
              onChange={(e) => cs.updatePayment(p.id, { dueDate: e.target.value || null })}
            />
          </div>
          <div>
            <label style={labelStyle}>メモ</label>
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const, paddingTop: 7 }}
              value={p.memo}
              onChange={(e) => cs.updatePayment(p.id, { memo: e.target.value })}
              placeholder="支払日・振込名義など"
            />
          </div>
          {p.paidAt && <div style={{ fontSize: 11.5, color: COLORS.mut }}>支払日: {formatDateJa(p.paidAt)}</div>}
        </div>
      )}
    </Card>
  );
}
