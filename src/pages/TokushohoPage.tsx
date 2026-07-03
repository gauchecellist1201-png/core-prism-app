// ============================================================
// /tokushoho — 特定商取引法に基づく表記 (フルページ)
// 法令上の表示義務に対応する 12 項目をテーブル形式で記載
// ============================================================
import LegalPageLayout from '../legal/LegalPageLayout';

interface Row {
  label: string;
  value: React.ReactNode;
}

const ROWS: Row[] = [
  { label: '販売事業者名', value: '井出 直毅（屋号: CORE）' },
  { label: '代表者名', value: '井出 直毅' },
  {
    label: '所在地',
    value: (
      <>
        請求があった場合は遅滞なく開示します (
        <a href="mailto:support@core-prism.com">support@core-prism.com</a>
        {' '}までご連絡ください)
      </>
    ),
  },
  {
    label: '連絡先',
    value: <a href="mailto:support@core-prism.com">support@core-prism.com</a>,
  },
  {
    label: '販売価格',
    value: (
      <>
        各プランの <a href="/pricing">料金ページ</a> をご覧ください (税込表示)
      </>
    ),
  },
  { label: '商品代金以外の必要料金', value: 'なし (通信費はお客様負担)' },
  {
    label: '支払方法',
    value: 'クレジットカード (Visa / Mastercard / American Express / JCB)',
  },
  {
    label: '支払時期',
    value: '申込み時 (月額プランは毎月、年額プランは年 1 回の自動更新)',
  },
  {
    label: '引渡時期',
    value: '決済完了後、即時アプリ内で機能が解放されます',
  },
  {
    label: '返品・キャンセル',
    value: (
      <>
        デジタルサービスのため <strong>原則返品不可</strong> です。サブスクリプション (継続課金) は次回更新前にいつでも解約可能で、解約後は次回更新日まで引き続きご利用いただけます。
      </>
    ),
  },
  {
    label: '動作環境',
    value: 'モダンブラウザ (Chrome / Safari / Edge / Firefox の最新版)',
  },
  {
    label: 'その他',
    value: (
      <>
        アプリ内の <a href="/terms">利用規約</a> および <a href="/privacy">プライバシーポリシー</a> もあわせてご確認ください。
      </>
    ),
  },
];

export default function TokushohoPage() {
  return (
    <LegalPageLayout
      eyebrow="CORE PRISM / IRIS"
      title="特定商取引法に基づく表記"
      updatedAt="2026 年 5 月 27 日"
      toc={[{ id: 'tokushoho-table', label: '事業者情報・販売条件' }]}
    >
      <section id="tokushoho-table">
        <h2><span className="num">01</span>事業者情報・販売条件</h2>
        <p>
          特定商取引に関する法律 第 11 条 (通信販売の広告) に基づき、本サービスの販売事業者および販売条件を以下のとおり表示します。
        </p>
        <table>
          <tbody>
            {ROWS.map((r, i) => (
              <tr key={i}>
                <th>{r.label}</th>
                <td>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">
          ご不明な点は <a href="mailto:support@core-prism.com">support@core-prism.com</a> までお問い合わせください。法人契約や請求書払いのご相談も同じ窓口で承ります。
        </p>
      </section>
    </LegalPageLayout>
  );
}
