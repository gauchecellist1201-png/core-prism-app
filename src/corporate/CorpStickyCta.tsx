// ============================================================
// CorpStickyCta — /corp の画面下の追従CTA。
//
// 3問診断がまだ終わっていない人には「3問で選ぶ」を出し、
// 答え終わって結果を見ている人には、その人の一手（例：「Iris を見る →」）に切り替える。
//
// 2026-08-08 に本番の375pxで実測したところ、結果を見ている画面でも
// 「3問で選ぶ」が出続けており、もう終わった作業への案内が
// 決断にいちばん近い67pxを占有していた（さらに結果カードの2本目のボタンを覆っていた）。
// ============================================================
import LpStickyCta from '../components/LpStickyCta';
import { useFinderPick } from './finderStore';
import { useCorpTab } from './corpRouteStore';
import { rememberSource, track } from './roai/track';

export default function CorpStickyCta() {
  const pick = useFinderPick();
  const tab = useCorpTab();

  // 2026-09-03: 診断（/roai-score）の中では出さない。質問の選択肢と結果の CTA を覆うだけで、
  // 「診断を受ける」を診断中の人に勧めることになる。
  if (tab === 'score') return null;

  // 部品は1つのまま props だけ差し替える（作り直すと出現アニメが巻き戻るため）。
  return (
    <LpStickyCta
      /* 見出しにサービス名を入れると、名前が長い回（Resonance）だけ375pxで2行に折れ、
         バーが67px→75pxに伸びて本文を覆う面積が増えた（2026-08-08 本番実測）。
         名前はボタン側が必ず持っているので、見出しは名前の長さに左右されない固定文にする。 */
      /* 2026-08-21: 会社サイトの一番の出口は「AI・DXの相談」に変わった。
         3問診断は自社プロダクトを選ぶ道具で、製品タブの中にある。
         まだ何も選んでいない人には相談、選び終えた人にはその製品を出す。 */
      /* 375px で2行に折れるとバーが 91px まで伸び、本文を覆う面積が増える
         （2026-08-21 実測）。見出しも副題も1行で収まる長さに切る。 */
      /* 2026-09-03 MASTER PROMPT: 会社サイトの Primary CTA は「ROAIを無料診断する」。
         まだ製品を選んでいない人は診断へ、選び終えた人はその製品へ。 */
      title={pick ? 'あなたには、これ' : '次にAI投資すべき場所は'}
      /* 決断の直前なので、不安を消す1点だけを置く。 */
      sub={pick ? '税込・いつでも解約できます' : '約3分・無料・連絡先不要'}
      cta={pick ? `${pick.name} を見る →` : 'ROAIを無料診断する'}
      href={pick ? pick.url : '/roai-score'}
      onClick={pick ? undefined : () => { rememberSource('sticky'); track('corp_cta_click', 'sticky'); }}
      accent1="#E0F2FE"
      accent2="#38BDF8"
    />
  );
}
