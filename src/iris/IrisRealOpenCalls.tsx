// ============================================================
// IrisRealOpenCalls — 本物の公開募集 (実在・今すぐ応募できる)
//
// サンプル案件と明確に区別し、「公式ページで応募」ボタンで実在 URL を開く。
// データは realOpenCalls.ts (HTTP 200 検証済み)。
// ============================================================
import { ExternalLink, BadgeCheck, ArrowUpRight } from 'lucide-react';
import { getRealOpenCalls, KIND_META } from './realOpenCalls';
import { CATEGORY_META } from './brandDeals';

interface Bg { accent: string; ink: string; inkSoft: string; card: string; cardBorder: string; }

export default function IrisRealOpenCalls({ bg }: { bg: Bg }) {
  const calls = getRealOpenCalls();

  return (
    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <BadgeCheck size={18} color="#10B981" />
        <strong style={{ fontSize: 15, color: bg.ink }}>本物の公開募集</strong>
        <span style={{
          fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
          background: 'rgba(16,185,129,0.14)', color: '#0E9F6E',
        }}>実在・検証済み {calls.length} 件</span>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>
        公式ページから<strong>今すぐ応募できる</strong>恒常募集です（応募先 URL は実在を確認済み）。下のサンプル案件は応募文の練習用です。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.7rem' }}>
        {calls.map(c => {
          const cat = CATEGORY_META[c.category];
          const kind = KIND_META[c.kind];
          return (
            <div key={c.id} style={{
              background: bg.card, border: `1px solid ${bg.cardBorder}`, borderRadius: 16,
              padding: '0.95rem 1rem', display: 'grid', gap: 8,
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, background: `${kind.color}1A`, color: kind.color }}>{kind.label}</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: `${cat.color}14`, color: cat.color }}>{cat.label}</span>
              </div>
              <div>
                <strong style={{ fontSize: 14, color: bg.ink, lineHeight: 1.3, display: 'block' }}>{c.name}</strong>
                <span style={{ fontSize: 11, color: bg.inkSoft }}>{c.org}</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: bg.inkSoft, lineHeight: 1.55 }}>{c.summary}</p>
              <div style={{ display: 'grid', gap: 3, fontSize: 11.5 }}>
                <div style={{ color: bg.inkSoft }}><span style={{ color: bg.ink, fontWeight: 700 }}>報酬:</span> {c.reward}</div>
                <div style={{ color: bg.inkSoft }}><span style={{ color: bg.ink, fontWeight: 700 }}>条件:</span> {c.requirement}</div>
              </div>
              <a href={c.applyUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                marginTop: 2, textDecoration: 'none',
                background: `linear-gradient(135deg, ${bg.accent}, #F77737)`, color: '#fff',
                borderRadius: 999, padding: '0.6rem 1rem', fontSize: 12.5, fontWeight: 800,
                boxShadow: '0 6px 16px rgba(225,48,108,0.28)',
              }}>
                公式ページで応募 <ExternalLink size={14} />
              </a>
              <span style={{ fontSize: 9.5, color: bg.inkSoft, opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <ArrowUpRight size={11} /> {new URL(c.applyUrl).hostname} ・ {c.verifiedAt} 確認
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
