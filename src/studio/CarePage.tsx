// ============================================================
// CORE Studio — 運用 (/studio/care) 2026-09-04 全面刷新
// 旧: 白い1段組にカード2枚。「公開はスタート」と言いながら、運用が何をどの頻度でやるのかが
//     箇条書き以上に伝わらなかった。
// 新: 運用サイクルの環を立てたヒーロー → 2プランを並べる → 常時/随時/毎月の内訳 → こんなご相談も → 相談。
// 内訳の文言は CARE_PLANS.includes から拾う (ここに書き写さない。書き写すと片方だけ古くなる)。
// ============================================================
import { CARE_PLANS, CONTACT, STUDIO_FAQ } from './plans';
import { C, D } from './theme';
import { Band, H2, Note, IconCheck, LineCta } from './ui';
import { PageStyle, PageHero, ClosingCta } from './PageHero';
import type { Go } from './tabs';

const RING = [
  { b: '監視', s: '常時', x: 50, y: 6 },
  { b: '更新', s: '随時', x: 94, y: 50 },
  { b: 'レポート', s: '毎月', x: 50, y: 94 },
  { b: '改善', s: '継続', x: 6, y: 50 },
];

// 全プランの includes から、キーワードで該当行をそのまま拾う (見つからなければ出さない)
const allIncludes = CARE_PLANS.flatMap(p => p.includes);
const pick = (...kws: string[]) => kws.map(k => allIncludes.find(s => s.includes(k))).filter((s): s is string => !!s);
const CADENCE = [
  { en: 'Always', when: '常時', lead: '止まらない。', items: pick('稼働監視', 'セキュリティ') },
  { en: 'On request', when: '随時', lead: '頼めば、動く。', items: pick('更新代行', '軽微な機能追加', 'AI生成') },
  { en: 'Monthly', when: '毎月', lead: '数字で、次を決める。', items: pick('月次レポート', '改善サイクル') },
];

export default function CarePage({ go }: { go: Go }) {
  const other = STUDIO_FAQ.find(f => f.q.includes('他社'));
  const subsc = CARE_PLANS.find(p => p.id === 'ai-subsc');
  return (
    <div>
      <PageStyle />
      <PageHero
        en="Maintenance"
        size="compact"
        title={<>公開はゴールではなく、<br />スタートです。</>}
        lead="公開後の稼働監視・更新代行・セキュリティ更新から、月次レポートと改善提案まで。アクセスデータをもとに、貴社サイトの成果を継続的に高めます。"
        facts={[
          { v: `月 ¥${CARE_PLANS[0].minMonthly}万〜`, l: CARE_PLANS[0].name },
          { v: '月次', l: 'レポート・改善提案' },
          { v: '他社制作', l: 'のサイトも対象' },
          { v: 'いつでも', l: '買い取りへ移行可' },
        ]}
        cta={<><LineCta label="運用についてLINEで相談する" where="care-hero" /><button className="st-btn st-btn-dark" onClick={() => go('plans')}>サイト制作から見る</button></>}
        note="他社で制作されたサイトの運用のみのご依頼も承ります。"
        visual={
          <div className="sp-ring-wrap">
            <div className="sp-ring" aria-label="運用のサイクル: 監視・更新・レポート・改善">
              <svg viewBox="0 0 200 200" aria-hidden>
                <circle cx="100" cy="100" r="88" fill="none" stroke={D.line} strokeWidth="1" />
                <g className="sp-ring-spin">
                  <circle cx="100" cy="100" r="88" fill="none" stroke={D.gold} strokeWidth="1.5" strokeDasharray="3 9" strokeLinecap="round" opacity="0.8" />
                  <circle cx="100" cy="100" r="66" fill="none" stroke={D.goldLine} strokeWidth="1" strokeDasharray="1 6" strokeLinecap="round" />
                </g>
                <circle cx="100" cy="100" r="44" fill="rgba(212,169,79,0.06)" stroke={D.goldLine} strokeWidth="1" />
              </svg>
              {RING.map(n => (
                <div key={n.b} className="sp-ring-node" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
                  <i aria-hidden /><b>{n.b}</b><span>{n.s}</span>
                </div>
              ))}
              <div className="sp-ring-center">
                <div className="st-label" style={{ color: D.gold, fontSize: 10 }}>Cycle</div>
                <div className="st-serif" style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginTop: 6, lineHeight: 1.5 }}>公開後も、<br />回り続ける。</div>
              </div>
            </div>
          </div>
        }
      />

      {/* 2プラン */}
      <Band wide pad="clamp(56px, 6vw, 88px) 0">
        <H2 en="Plans" sub="公開後の保守・運用と、初期費用を抑えて月額で始める構成の2つです。">運用 — 月額プラン</H2>
        <div className="sp-grid2">
          {CARE_PLANS.map((cp, i) => (
            <div key={cp.id} className="sp-col" data-featured={i === 0}>
              {i === 0 && <span className="sp-col-tag">STANDARD</span>}
              <div className="sp-col-name">{cp.name}</div>
              <div className="sp-col-price">{cp.price}</div>
              <div className="sp-col-lead">{cp.lead}</div>
              <div className="sp-col-sub">含まれるもの</div>
              <ul className="sp-list">
                {cp.includes.map(x => <li key={x}><IconCheck />{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <LineCta label="運用についてLINEで相談する" where="care" />
          <Note>{CONTACT.lineNote}</Note>
        </div>
      </Band>

      {/* 常時 / 随時 / 毎月 */}
      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="What happens" sub="運用の中身を、起きる頻度で3つに分けています。">1か月の運用で、起きること</H2>
        <div className="sp-cad">
          {CADENCE.map(c => (
            <div key={c.en} className="st-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="st-label" style={{ fontSize: 10.5 }}>{c.en}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span className="st-serif" style={{ fontSize: 26, fontWeight: 700, color: C.ink }}>{c.when}</span>
                <span className="st-serif" style={{ fontSize: 15, fontWeight: 700, color: C.goldText }}>{c.lead}</span>
              </div>
              <ul className="sp-list" style={{ marginTop: 4 }}>
                {c.items.map(x => <li key={x}><IconCheck />{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Band>

      {/* こんなご相談も */}
      <Band wide pad="clamp(52px, 6vw, 84px) 0">
        <H2 en="Also" sub="当社で制作していないサイトでも、いまの状態を確認したうえで範囲をご提案します。">こんなご相談も承ります</H2>
        <div className="sp-grid2">
          {other && (
            <div className="st-card">
              <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>{other.q}</div>
              <p style={{ fontSize: 14, lineHeight: 2, color: C.body, margin: '10px 0 0' }}>{other.a}</p>
            </div>
          )}
          {subsc && (
            <div className="st-card">
              <div className="st-serif" style={{ fontSize: 18, fontWeight: 700, color: C.ink, lineHeight: 1.6 }}>初期費用を抑えて、月額で始めたい</div>
              <p style={{ fontSize: 14, lineHeight: 2, color: C.body, margin: '10px 0 0' }}>{subsc.lead} {subsc.includes[subsc.includes.length - 1]}。</p>
            </div>
          )}
        </div>
      </Band>

      <Band alt wide pad="clamp(52px, 6vw, 84px) 0">
        <ClosingCta title="いまのサイトのURLだけ、お送りください。" body="現行サイトの状態を確認したうえで、保守・更新代行・改善提案の範囲と月額をご提案します。">
          <LineCta label="運用についてLINEで相談する" where="care-bottom" />
          <Note>{CONTACT.lineNote}</Note>
        </ClosingCta>
      </Band>
    </div>
  );
}
