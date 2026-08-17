// ============================================================
// IrisRealOpenCalls — 本物の公開募集 (実在・今すぐ応募できる)
//
// サンプル案件と明確に区別し、「公式ページで応募」ボタンで実在 URL を開く。
// データは realOpenCalls.ts (HTTP 200 検証済み)。
// ============================================================
import { ExternalLink, BadgeCheck, ArrowUpRight, Sparkles, Clock } from 'lucide-react';
import { getRealOpenCalls, rankOpenCalls, inferPreferredCategories, KIND_META, openCallsBadge, verifiedLabel } from './realOpenCalls';
import { CATEGORY_META } from './brandDeals';
import type { MediaKit } from '../types/influencerDeal';
import { warmFaceBg } from './irisStyle';

interface Bg { accent: string; ink: string; inkSoft: string; card: string; cardBorder: string; }

export default function IrisRealOpenCalls({ bg, mediaKit }: { bg: Bg; mediaKit?: MediaKit }) {
  // 手入力ゼロ: メディアキットの自由記述からジャンルを推定し、合いそうな募集を上へ。
  const prefs = inferPreferredCategories(
    mediaKit?.audienceProfile,
    mediaKit?.brandValues,
    mediaKit?.caseHistory,
    mediaKit?.handleName,
  );
  const calls = prefs.length ? rankOpenCalls(prefs) : getRealOpenCalls().map(c => ({ ...c, matched: false }));
  const matchCount = calls.filter(c => c.matched).length;
  const topPref = prefs[0];
  // 「検証済み」は一度書いたら勝手に古くなる札。何日前に見たのかを毎回言い直す
  const badge = openCallsBadge(calls);

  return (
    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {badge.fresh
          ? <BadgeCheck size={18} color="#10B981" />
          : <Clock size={18} color="#B45309" />}
        <strong style={{ fontSize: 15, color: bg.ink }}>本物の公開募集</strong>
        {/* 文字色 #0E9F6E は薄緑の面の上で 2.7:1 しかなく AA (4.5) に届いていなかった。
            面の色（ブランドの緑）は変えず、文字だけ濃くする */}
        <span style={{
          fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
          background: badge.fresh ? 'rgba(16,185,129,0.14)' : 'rgba(180,83,9,0.14)',
          color: badge.fresh ? '#076046' : '#7C3D05',
        }}>{badge.text}</span>
      </div>
      {matchCount > 0 && topPref ? (
        <p style={{ margin: 0, fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>
          あなたのプロフィールから<strong style={{ color: CATEGORY_META[topPref].color }}>「{CATEGORY_META[topPref].label}」</strong>と読み取り、
          合いそうな募集 <strong>{matchCount} 件</strong>を上に並べました。{badge.note}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: bg.inkSoft, lineHeight: 1.6 }}>
          {badge.note}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.7rem' }}>
        {calls.map(c => {
          const cat = CATEGORY_META[c.category];
          const kind = KIND_META[c.kind];
          return (
            <div key={c.id} style={{
              background: bg.card,
              border: c.matched ? `1.5px solid ${cat.color}66` : `1px solid ${bg.cardBorder}`,
              borderRadius: 16,
              padding: '0.95rem 1rem', display: 'grid', gap: 8,
              boxShadow: c.matched ? `0 4px 16px ${cat.color}22` : '0 2px 10px rgba(0,0,0,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {c.matched && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                    background: warmFaceBg(cat.color), color: '#fff',
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <Sparkles size={10} /> あなたに合いそう
                  </span>
                )}
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
              {/* この画面で唯一「本当にお金につながる」ボタン。
                  以前は高さ 37.9px で、指で押す大きさ (44px) に足りていなかった */}
              <a href={c.applyUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                marginTop: 2, textDecoration: 'none',
                background: warmFaceBg(bg.accent), color: '#fff',
                borderRadius: 999, padding: '0.6rem 1rem', minHeight: 48, fontSize: 12.5, fontWeight: 800,
                boxShadow: '0 6px 16px rgba(225,48,108,0.28)',
              }}>
                公式ページで応募 <ExternalLink size={14} />
              </a>
              <span style={{ fontSize: 9.5, color: bg.inkSoft, opacity: 0.8, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <ArrowUpRight size={11} /> {new URL(c.applyUrl).hostname} ・ {verifiedLabel(c.verifiedAt)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
