// ============================================================
// 書類タブ — 未取得 / 取得済み / 送付済み のステータス管理。
// ファイルアップロードは未対応 (初期版はステータス管理のみ)。
// ============================================================
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { UseCompanySetupReturn } from '../useCompanySetup';
import { Card, DocStatusBadge } from '../ui';
import { COLORS, FONT } from '../tokens';
import type { DocumentStatus } from '../types';

export default function DocumentsTab({ cs }: { cs: UseCompanySetupReturn }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const inputStyle = {
    width: '100%', minHeight: 38, borderRadius: 9, padding: '7px 9px',
    background: 'rgba(255,255,255,0.05)', border: `1px solid ${COLORS.line}`,
    color: COLORS.text, fontSize: 13.5, fontFamily: FONT, boxSizing: 'border-box' as const,
  };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: COLORS.mut, marginBottom: 4, display: 'block' as const };

  return (
    <div style={{ display: 'grid', gap: 8, fontFamily: FONT }}>
      {cs.documents.map((d) => {
        const expanded = expandedId === d.id;
        return (
          <Card key={d.id} style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedId(expanded ? null : d.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minHeight: 44,
              }}
            >
              <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: COLORS.text }}>{d.name}</div>
              <DocStatusBadge status={d.status} />
              {expanded ? <ChevronUp size={16} color={COLORS.mut} /> : <ChevronDown size={16} color={COLORS.mut} />}
            </button>
            {expanded && (
              <div style={{ padding: '0 14px 14px', display: 'grid', gap: 10, borderTop: `1px solid ${COLORS.line}` }}>
                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>状態</label>
                  <select
                    style={inputStyle}
                    value={d.status}
                    onChange={(e) => cs.updateDocument(d.id, { status: e.target.value as DocumentStatus })}
                  >
                    <option value="not_acquired">未取得</option>
                    <option value="acquired">取得済み</option>
                    <option value="sent">送付済み</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>メモ</label>
                  <textarea
                    style={{ ...inputStyle, minHeight: 56, resize: 'vertical' as const, paddingTop: 7 }}
                    value={d.memo}
                    onChange={(e) => cs.updateDocument(d.id, { memo: e.target.value })}
                    placeholder="取得場所・保管場所など"
                  />
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
