// ============================================================
// 利用規約 / プライバシーポリシー / 特定商取引法に基づく表記 モーダル
//
// HHH (2026-06-04): v3 改定 — Push 通知 / 端末 ID / VAPID / Upstash 永続化
//   等の最近の機能を反映。本文は markdown ファイル (privacy-v3.md /
//   terms-v3.md) からインポート。
// ============================================================
import { motion } from 'framer-motion';
import PRIVACY_V3 from '../legal/privacy-v3.md?raw';
import TERMS_V3 from '../legal/terms-v3.md?raw';

interface Props {
  kind: 'terms' | 'privacy' | 'tokushou';
  onClose: () => void;
}

const COMPANY = 'CORE 株式会社';
const REP = '井出 直毅';
const EMAIL = 'core.guild.inc@gmail.com';
const URL = 'https://core-prism-app.vercel.app/';

const TERMS = `
## 第 1 条 (適用)
本規約は、${COMPANY} (以下「当社」) が提供する CORE Prism (以下「本サービス」) の利用に関する条件を定めるものです。利用者 (以下「ユーザー」) は本規約に同意の上、本サービスを利用するものとします。

## 第 2 条 (アカウント)
本サービスは、ユーザーの端末 (ブラウザ localStorage 等) にデータを保存します。アカウント登録は任意であり、登録しない場合でも本サービスの一部機能をご利用いただけます。

## 第 3 条 (料金および支払い)
有料プランの料金は、本サービス内およびウェブサイトに表示する金額とします。お支払いは、当社が定める方法により行うものとします。

## 第 4 条 (禁止事項)
ユーザーは以下の行為を行ってはなりません。
- 法令または公序良俗に違反する行為
- 当社、他のユーザー、または第三者の知的財産権、プライバシー権、その他の権利を侵害する行為
- 本サービスのリバースエンジニアリング、不正アクセス、または運営の妨害行為
- AI 生成物を利用した詐欺・誹謗中傷・差別的内容の作成および拡散
- その他、当社が不適切と判断する行為

## 第 5 条 (本サービスの提供の停止等)
当社は、本サービスのメンテナンス、システム障害、その他やむを得ない事由がある場合、事前の通知なく本サービスの全部または一部の提供を停止することができます。

## 第 6 条 (免責事項)
本サービスにおける AI 生成物は、最終的にユーザーの責任において利用するものとします。当社は、AI 生成物の正確性・完全性・有用性を保証しません。本サービスの利用に関連して生じた損害について、当社の故意または重過失による場合を除き、当社は責任を負わないものとします。

## 第 7 条 (規約の変更)
当社は、必要と判断した場合、ユーザーへの事前通知の上、本規約を変更することができます。

## 第 8 条 (準拠法・管轄裁判所)
本規約は日本法に準拠し、本サービスに関する紛争については、東京地方裁判所を専属的合意管轄裁判所とします。

最終更新: 2026 年 5 月
`.trim();

const PRIVACY = `
## 1. 取得する情報
当社は、本サービスの提供にあたり、以下の情報を取得することがあります。
- お名前、メールアドレス (お問い合わせ・お申込み時)
- 利用ログ (アクセス時刻、IP アドレス、ブラウザ情報)
- ユーザーが本サービスに保存するデータ (ナレッジ・タスク・CRM 情報など)

## 2. データの保存場所
ユーザーが本サービスに保存するデータは、原則としてユーザーの端末 (ブラウザ localStorage) に保存されます。当社サーバーには送信されません。ただし、AI 機能 (Claude API / OpenAI API) を利用する際は、必要な範囲で API 提供事業者にデータを送信します。

## 3. AI 学習への使用
ユーザーが入力したデータは、AI モデルの学習には使用されません。Anthropic / OpenAI の各 API 利用ポリシーに準拠します。

## 4. データの利用目的
- 本サービスの提供・改善
- お問い合わせへの対応
- 統計情報の作成 (個人を特定しない形で)

## 5. 第三者提供
法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。

## 6. クッキー
本サービスは、利便性向上およびアクセス解析のためにクッキーを使用することがあります。ブラウザの設定でクッキーを無効にすることができます。

## 7. お問い合わせ
個人情報の開示・訂正・削除等のご請求は、以下までご連絡ください。
${EMAIL}

最終更新: 2026 年 5 月
`.trim();

const TOKUSHOU = `
| 項目 | 内容 |
| --- | --- |
| 販売事業者名 | ${COMPANY} |
| 代表者 | ${REP} |
| 所在地 | 東京都 (請求があれば遅滞なく開示) |
| 連絡先 | ${EMAIL} |
| サービス名 | CORE Prism (AI セールス OS) |
| 販売価格 | 各プランページに表示の月額・年額 (税込) |
| 商品代金以外の必要料金 | 通信費 (お客様負担) |
| お支払い方法 | クレジットカード決済 (Stripe 経由 / 予定) |
| 商品の引渡時期 | 決済完了後、即時に Web 上で利用可能 |
| 返品・キャンセル | デジタルサービスの性質上、決済完了後の返品はお受けしておりません。ただし、当社の責に帰すべき事由がある場合はこの限りではありません。月額契約は次回更新日の前日までに解約手続きを行うことで、次月以降の課金を停止できます。 |
| 動作環境 | モダンブラウザ (Chrome / Edge / Safari 最新版) |

最終更新: 2026 年 5 月
`.trim();

export default function LegalModal({ kind, onClose }: Props) {
  const titles = {
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    tokushou: '特定商取引法に基づく表記',
  };
  const bodies = {
    // HHH (2026-06-04): v3 を採用 — Push / DAU / VAPID / Upstash 反映
    terms: TERMS_V3 || TERMS,
    privacy: PRIVACY_V3 || PRIVACY,
    tokushou: TOKUSHOU,
  };

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
      style={{ background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-3xl rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: '#fff',
          border: '1px solid #D8DDE8',
          maxHeight: 'calc(100dvh - 2rem)',
        }}
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <header style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #D8DDE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFBFD' }}>
          <div>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: '#FF6B35', fontWeight: 700, marginBottom: '0.2rem' }}>CORE PRISM</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0033A0', margin: 0 }}>
              {titles[kind]}
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: '#4B5566',
            padding: '0.5rem',
          }}>
            ✕
          </button>
        </header>

        <div style={{
          padding: '2rem',
          overflowY: 'auto',
          flex: 1,
          fontSize: '0.9rem',
          lineHeight: 1.8,
          color: '#2D3142',
          fontFamily: '"游ゴシック", "Hiragino Kaku Gothic ProN", sans-serif',
          whiteSpace: 'pre-wrap',
        }}>
          {bodies[kind]}
        </div>

        <footer style={{ padding: '1rem 2rem', borderTop: '1px solid #D8DDE8', background: '#FAFBFD', textAlign: 'right' }}>
          <button onClick={onClose} style={{
            background: '#0033A0',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.5rem',
            borderRadius: 8,
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}>
            閉じる
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

export const LEGAL_KINDS = ['terms', 'privacy', 'tokushou'] as const;
export type LegalKind = typeof LEGAL_KINDS[number];

export { COMPANY, REP, EMAIL, URL };
