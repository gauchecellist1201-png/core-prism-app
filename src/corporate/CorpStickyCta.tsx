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

export default function CorpStickyCta() {
  const pick = useFinderPick();

  // 部品は1つのまま props だけ差し替える（作り直すと出現アニメが巻き戻るため）。
  return (
    <LpStickyCta
      title={pick ? `あなたには ${pick.name}` : '8つのうち、あなたにはどれ？'}
      /* 説明文は1行に収まる長さにする（375pxで2行に折れるとバーが67px→73pxに伸び、
         その分だけ本文を覆う面積が増えるため）。決断の直前なのでお金の不安を消す2点だけを置く。 */
      sub={pick ? '税込・いつでも解約できます' : '3問でわかります・登録もメールも不要'}
      cta={pick ? `${pick.name} を見る →` : '3問で選ぶ'}
      href={pick ? pick.url : '#finder'}
      accent1="#e9cd8a"
      accent2="#c9a24b"
    />
  );
}
