// ============================================================
// CORE Studio → NERI の橋 (2026-09-06 新設)
//
// なぜ要るか:
//   CORE の営業は「映像で接点を作り、NERI で業務に入り、CORE が会社を変える」という
//   段の設計になっている。ところが CORE Studio には NERI という言葉が 1 回も出ていなかった
//   (grep -rni "neri" src/studio/ = 0 件)。
//   制作を頼んでくれた人が、次の段へ進む道が、サイト上に 1 本も無い状態だった。
//
// 置き方の約束:
//   ・第 5 の制作メニューとして並べない。NERI は「作ったあとに残る仕事」の話なので、
//     制作の流れ (PROCESS 06 公開・運用改善) の直後に、別の章として置く。
//   ・Studio の見た目 (明朝・金・線画) のまま出す。NERI の青は持ち込まない。
//     ここは Studio のページであって、NERI の LP ではない。
//   ・数字は coreLinks.ts の NERI_FACTS からだけ取る (ここに書き写さない)。
//   ・CSS は自前で持つ。ホームは PageStyle (sp-*) を読み込まないので、
//     下層ページのクラスを借りると、ホームでだけ箇条書きが素の黒丸になる。
// ============================================================
import { NERI_FACTS, ROAI_SCORE, neriLpUrl } from '../lib/coreLinks';
import { C, D } from './theme';
import { Band, H2, IconCheck, IconArrow } from './ui';
import { track } from './track';

/** 「話しかけると、画面が動く」を線だけで表す。写真も絵文字も使わない。 */
const Waveform = () => (
  <svg viewBox="0 0 120 40" width="100%" height="46" aria-hidden style={{ display: 'block', maxWidth: 220 }}>
    {[6, 14, 22, 30, 38, 46, 54].map((x, i) => {
      const h = [10, 20, 30, 24, 34, 16, 8][i];
      return <line key={x} x1={x} y1={20 - h / 2} x2={x} y2={20 + h / 2} stroke={D.gold} strokeWidth="2.2" strokeLinecap="round" opacity={0.5 + i * 0.07} />;
    })}
    <path d="M64 20h14" stroke={D.gold} strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 4" opacity="0.6" />
    <rect x="84" y="6" width="31" height="28" rx="3" fill="none" stroke={D.gold} strokeWidth="1.5" />
    <path d="M89 14h21M89 20h15M89 26h18" stroke={D.gold} strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
  </svg>
);

const POINTS = [
  '話しかけるだけで、予定・メール・売上・記録が動きます',
  '答えながら画面に描くので、読み返さずに、見ながら口で直せます',
  '送信や決済など、外へ出る操作の前には必ず確認を挟みます',
];

/** @param where 計測とリンクに乗る場所名 (home / care)。 */
export default function NeriHandoff({ where }: { where: 'home' | 'care' }) {
  return (
    <Band dark wide pad="clamp(52px, 6vw, 84px) 0">
      {/* 基本ルールを先に、@media を後に書く (逆にすると狭い画面の指定が一度も効かない) */}
      <style>{`
        .st-neri { display: grid; grid-template-columns: 1fr; gap: 26px; align-items: start; }
        .st-neri-list { list-style: none; padding: 0; margin: 18px 0 0; display: grid; gap: 9px; }
        .st-neri-list li { display: flex; gap: 9px; font-size: 14px; line-height: 1.85; color: ${D.body}; }
        /* 狭い画面では飾りを出さない。出すと CTA の下に置かれ、
           章の最後が「押す所」ではなく飾りになる。 */
        .st-neri-art { display: none; }
        .st-neri-btn { background: #FFFFFF; color: ${C.ink}; border: 1px solid #FFFFFF; font-weight: 700; }
        .st-neri-btn:hover { background: ${D.gold}; border-color: ${D.gold}; color: #0B0B0C; }
        @media (min-width: 900px) {
          .st-neri { grid-template-columns: minmax(0, 1fr) 240px; gap: 40px; }
          .st-neri-art { display: flex; justify-content: flex-end; padding-top: 6px; opacity: 0.9; }
        }
      `}</style>
      <H2
        dark
        en="After launch"
        sub="映像やサイトが動き始めると、問い合わせが増えます。返信、見積り、日程の調整、記録。増えた分は、たいてい社長の手元に戻ってきます。CORE は、そこから先も引き受けます。"
      >
        公開したあとに増えるのは、<br />社長自身の仕事です。
      </H2>

      <div className="st-neri">
        <div>
          <div className="st-serif" style={{ fontSize: 20, fontWeight: 700, color: D.ink, lineHeight: 1.7 }}>
            CORE NERI — 話すだけで、会社が動く。
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 2.05, color: D.body, margin: '12px 0 0', maxWidth: 560 }}>
            当社が開発・運営している、経営者のための AI です。答えるだけの AI ではなく、聞いたことをその場で仕事にします。
            制作でお預かりした「何のために作るか」を、公開したあとの毎日にも引き継げます。
          </p>
          <ul className="st-neri-list">
            {POINTS.map(x => <li key={x}><IconCheck color={D.gold} />{x}</li>)}
          </ul>
          <p style={{ fontSize: 14, lineHeight: 1.95, color: D.ink, margin: '20px 0 0', fontWeight: 700 }}>
            {NERI_FACTS.from}
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: D.mute, margin: '4px 0 0' }}>
            {NERI_FACTS.free}。まず 1 回、話しかけてみてください。
          </p>
          <div style={{ marginTop: 22, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <a
              className="st-btn st-neri-btn"
              href={neriLpUrl(`studio-${where}`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('studio_neri_cta', { where })}
            >
              NERI を見る <IconArrow color={C.goldText} />
            </a>
            <a
              className="st-btn"
              href={ROAI_SCORE}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('studio_roai_cta', { where })}
              style={{ background: 'transparent', color: D.ink, border: `1px solid ${D.gold}` }}
            >
              約3分で、どこから AI 化すべきか診る
            </a>
          </div>
          <p style={{ fontSize: 12.5, lineHeight: 1.9, color: D.mute, margin: '10px 0 0' }}>
            映像の次に手を付ける場所が分からないときは、先に診断を。連絡先は要りません。
          </p>
        </div>
        <div className="st-neri-art">
          <Waveform />
        </div>
      </div>
    </Band>
  );
}
