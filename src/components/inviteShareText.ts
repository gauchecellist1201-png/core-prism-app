// ─────────────────────────────────────────────────────────────
// 招待でおくる文章 (LINE / X / メール / その他)
//
// ★ここは「あなた以外の人」に届く、このアプリで唯一の文章。
//   画面の中の言い間違いは自分が気づけば済むが、ここの間違いは
//   受け取った友達がそのまま信じてしまうので、実物と違うことは書かない。
//
//   直した嘘 (2026-08-23):
//    - Iris の招待文にも Prism の「AI 役員」の話が入っていた。
//      Iris はリールを作るアプリなので、受け取った人は
//      何のアプリに誘われたのか分からないまま登録画面へ来ていた。
//    - LINE は「AI 13 役員」、X は「14 人の AI 役員」と、
//      同じ画面から送る 2 つの文章で人数が食い違っていた。
//      → 人数はアプリ内でも 13 / 14 が混在しているので、
//        確かめられない数は招待文から外し、「何をしてくれるか」だけ書く。
//
//   日数は src/lib/referral.ts の定数だけを使う (ここに直書きしない)。
//   守っているものは src/components/__tests__/inviteShareText.test.ts。
// ─────────────────────────────────────────────────────────────
import type { Brand } from '../lib/billing';
import {
  REFERRAL_BONUS_DAYS, TRIAL_BASE_DAYS, TRIAL_WITH_REFERRAL_DAYS,
} from '../lib/referral';

/** 製品名 */
export function productName(brand: Brand): string {
  return brand === 'iris' ? 'CORE Iris' : 'CORE Prism';
}

/** その製品が実際にやってくれること (1 行・確かめられない人数は書かない) */
export function productPitch(brand: Brand): string {
  return brand === 'iris'
    ? 'スマホに撮りためた素材を入れるだけで、並べ替え・字幕・投稿文まで AI が仕上げてくれるリール制作アプリ'
    : '請求書・議事録・資料づくり・売上の管理を、AI の役員チームがまとめて引き受けてくれる経営アプリ';
}

export function shareTextLine(url: string, brand: Brand, inviterName: string): string {
  const who = inviterName ? `${inviterName}です。` : '';
  return `【共有】${who}${productName(brand)} というアプリが便利でした。
${productPitch(brand)}です。
このリンクから登録すると ${TRIAL_BASE_DAYS} 日無料 + 招待の ${REFERRAL_BONUS_DAYS} 日で、合計 ${TRIAL_WITH_REFERRAL_DAYS} 日ためせます →
${url}`;
}

export function shareTextX(url: string, brand: Brand, inviterName: string): string {
  const handle = brand === 'iris' ? '@core_iris' : '@core_prism';
  const who = inviterName ? `(${inviterName} の紹介) ` : '';
  return `${productPitch(brand)}、${handle} が良かった。${who}リンクから登録すると ${TRIAL_BASE_DAYS} 日無料 +${REFERRAL_BONUS_DAYS} 日 (合計 ${TRIAL_WITH_REFERRAL_DAYS} 日) →
${url}`;
}

export function shareTextMail(url: string, brand: Brand, inviterName: string): { subject: string; body: string } {
  const product = productName(brand);
  const sender = inviterName || 'わたし';
  return {
    subject: `${product} を試してみてほしい (${TRIAL_WITH_REFERRAL_DAYS} 日無料)`,
    body: `こんにちは、

最近使っている ${product} がとても便利です。
${productPitch(brand)}です。

${sender} からの招待リンクから登録すると ${TRIAL_BASE_DAYS} 日無料に +${REFERRAL_BONUS_DAYS} 日で、合計 ${TRIAL_WITH_REFERRAL_DAYS} 日無料で試せます。

▼ 登録リンク
${url}

カード登録は Stripe の画面で行いますが、期限前に止めれば請求は 0 円です。
よければ触ってみてください。

— ${sender}`,
  };
}

export function shareTextGeneric(url: string, brand: Brand, inviterName: string): string {
  const product = productName(brand);
  const opener = inviterName
    ? `${inviterName} です。${product} を試してます。`
    : `${product} を試してます。`;
  return `${opener}
${productPitch(brand)}です。
このリンクから登録すると ${TRIAL_BASE_DAYS} 日間無料 + さらに ${REFERRAL_BONUS_DAYS} 日延長で、合計 ${TRIAL_WITH_REFERRAL_DAYS} 日無料。
${url}`;
}
