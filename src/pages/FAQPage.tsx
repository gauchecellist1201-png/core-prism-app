// ============================================================
// /faq — よくある質問 (15 問)
// JS 不要のアコーディオン (<details> タグ)
// アクセシビリティ重視: キーボード操作・スクリーンリーダー対応
// ============================================================
import LegalPageLayout from '../legal/LegalPageLayout';

interface FaqItem {
  q: string;
  a: React.ReactNode;
}

const FAQS: FaqItem[] = [
  {
    q: 'Prism と Iris の違いは?',
    a: (
      <>
        <p>
          <strong>CORE Prism</strong> は事業家向けの「AI 役員チーム」。13 名の CXO (役員) が経営判断・営業・経理などを伴走します。
        </p>
        <p>
          <strong>CORE Iris</strong> はクリエイター (インフルエンサー / 配信者) 向けの姉妹ブランド。Instagram 分析・案件管理・キャプション生成など、影響力を仕事にするための機能に特化しています。
        </p>
        <p>同じアカウントで両方使え、用途に合わせて入口を切り替えられます。</p>
      </>
    ),
  },
  {
    q: '料金はいくら? 無料お試し期間は?',
    a: (
      <>
        <p>
          月額プラン (Lite ¥2,800 / Standard ¥6,800 / Pro ¥9,800 / Studio ¥29,800) からお選びいただけます。詳細は <a href="/pricing">料金ページ</a> をご覧ください。
        </p>
        <p>
          <strong>14 日間の無料お試し</strong> をご用意しています。クレジットカード登録なしで開始でき、6/1 までの登録なら <strong>+30 日延長 (合計 44 日)</strong> されます。
        </p>
      </>
    ),
  },
  {
    q: '解約はいつでもできますか?',
    a: (
      <p>
        はい、いつでも 1 タップで解約できます。設定 → 課金 → 「解約する」から手続きいただけます。引き止めや電話確認は一切ありません。
      </p>
    ),
  },
  {
    q: '解約したらデータは消えますか?',
    a: (
      <>
        <p>
          解約後も <strong>90 日間</strong> はデータを保持しますので、その間に再開すれば元の状態に戻せます。
        </p>
        <p>
          保存先はお使いの端末 (ブラウザ) が中心です。設定 → データから JSON ファイルとして書き出して、お手元に保管することもできます。
        </p>
      </>
    ),
  },
  {
    q: 'Stripe を連携するとどんな数字が見えますか?',
    a: (
      <>
        <p>Stripe (決済サービス) と繋ぐと、以下が自動でダッシュボードに反映されます。</p>
        <ul>
          <li>今月の売上 (確定済み + 見込み)</li>
          <li>累計売上 (直近 12 ヶ月)</li>
          <li>サブスク (継続課金) の MRR / 解約率</li>
          <li>顧客一人あたり単価 (ARPU)</li>
        </ul>
        <p>連携は OAuth で 30 秒、解除もワンクリックです。</p>
      </>
    ),
  },
  {
    q: 'API キーが無くても使えますか?',
    a: (
      <>
        <p>はい。データを入れる方法は 3 通り用意しています。</p>
        <ul>
          <li><strong>スクリーンショット</strong> — 画面写真をドラッグして AI が読み取り</li>
          <li><strong>ファイル取り込み</strong> — PDF / CSV / Excel をそのまま投入</li>
          <li><strong>直接入力</strong> — 数字や案件をフォームで入力</li>
        </ul>
        <p>API キー (連携キー) を持っている方は、連携することで自動更新になります。</p>
      </>
    ),
  },
  {
    q: 'どのブラウザで使えますか?',
    a: (
      <p>
        Chrome / Safari / Edge / Firefox の最新版でご利用いただけます。スマホでは Safari (iPhone) と Chrome (Android) を推奨しています。
      </p>
    ),
  },
  {
    q: 'iPhone で使えますか? PWA インストールの方法は?',
    a: (
      <>
        <p>はい、iPhone Safari で問題なくご利用いただけます。アプリのようにホーム画面から起動するには:</p>
        <ol>
          <li>Safari で <code>core-prism-app.vercel.app</code> を開く</li>
          <li>下メニューの「共有」ボタンをタップ</li>
          <li>「ホーム画面に追加」を選ぶ</li>
        </ol>
        <p>これで通常のアプリと同じように、フルスクリーンで起動できます。</p>
      </>
    ),
  },
  {
    q: 'AI は何を使っていますか?',
    a: (
      <>
        <p>
          Anthropic 社の <strong>Claude</strong> (クロード) を中心に使用しています。用途に応じて Haiku (速くて安い) / Sonnet (バランス) / Opus (賢い) を自動で切り替えています。
        </p>
        <p>ご自身の Anthropic / OpenAI の API キーを持ち込んで使うこともできます (持ち込みの場合は料金は AI 提供元から直接請求されます)。</p>
      </>
    ),
  },
  {
    q: '私の業務データは外部に送られますか?',
    a: (
      <>
        <p>
          保存場所は基本的に <strong>お使いの端末のブラウザの中</strong> です。当社のサーバーには送られません。
        </p>
        <p>
          AI 機能を使うときだけ、必要な範囲で Anthropic / OpenAI の API に送られます。これらの API ではユーザー入力を AI 学習に使わない契約になっています。詳しくは <a href="/privacy">プライバシーポリシー</a> をご覧ください。
        </p>
      </>
    ),
  },
  {
    q: 'カード以外の支払い方法は?',
    a: (
      <>
        <p>現在はクレジットカード決済 (Visa / Mastercard / Amex / JCB) のみ対応しています。</p>
        <p>銀行振込・請求書払いをご希望の法人様は、<a href="mailto:support@core-prism.com">support@core-prism.com</a> までご相談ください。年額一括前払いで対応可能です。</p>
      </>
    ),
  },
  {
    q: '領収書はどこで出せますか?',
    a: (
      <p>
        設定 → 課金 → 「領収書を発行」から、PDF をダウンロードいただけます。宛名 (会社名・部署名) も画面で編集できます。年度末のまとめ発行 (1 年分一括) にも対応しています。
      </p>
    ),
  },
  {
    q: 'お問い合わせ先は?',
    a: (
      <>
        <p>
          メール: <a href="mailto:support@core-prism.com">support@core-prism.com</a>
        </p>
        <p>営業時間: 平日 10:00 - 18:00 (土日祝休) / 通常 1 営業日以内に返信いたします。</p>
      </>
    ),
  },
  {
    q: '法人での導入は可能ですか?',
    a: (
      <>
        <p>
          はい、Studio プラン (¥29,800 / 月) で API アクセス・ホワイトラベル・専任コンサルがつきます。チームメンバー無制限・SSO 対応・監査ログもご用意できます。
        </p>
        <p>カスタム導入 (社内データ連携・独自モデルなど) は <a href="mailto:support@core-prism.com">support@core-prism.com</a> へお問い合わせください。</p>
      </>
    ),
  },
  {
    q: '紹介プログラムはありますか?',
    a: (
      <>
        <p>
          はい。あなたの紹介リンクから新規登録があると、紹介した方・された方の両方に <strong>+30 日無料</strong> が付与されます。
        </p>
        <p>3 名紹介で 1 ヶ月無料、10 名紹介で 1 年無料の特典もあります。紹介リンクは登録後の設定画面から取得できます。</p>
      </>
    ),
  },
];

export default function FAQPage() {
  return (
    <LegalPageLayout
      eyebrow="CORE PRISM / IRIS"
      title="よくある質問"
      updatedAt="2026 年 5 月 27 日"
      toc={FAQS.map((f, i) => ({ id: `q${i + 1}`, label: f.q }))}
    >
      <p>
        ご質問の多い 15 項目をまとめました。それぞれの質問をタップすると答えが開きます。お探しの内容が見つからない場合は <a href="mailto:support@core-prism.com">support@core-prism.com</a> までご連絡ください。
      </p>

      {FAQS.map((f, i) => (
        <section key={i} id={`q${i + 1}`}>
          <details
            style={{
              background: '#10162A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '0.2rem 0',
              marginBottom: '0.8rem',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                padding: '1rem 1.2rem',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#E6E9F2',
                listStyle: 'none',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                userSelect: 'none',
              }}
            >
              <span style={{ color: '#A78BFA', flexShrink: 0, fontSize: '0.85rem', marginTop: '0.15rem' }}>
                Q{String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ flex: 1 }}>{f.q}</span>
            </summary>
            <div style={{ padding: '0 1.2rem 1rem 1.2rem' }}>{f.a}</div>
          </details>
        </section>
      ))}

      <p style={{ marginTop: '2rem', fontSize: '0.88rem', color: 'rgba(230,233,242,0.5)' }}>
        ※ 内容は予告なく更新されることがあります。最新の料金・機能は <a href="/pricing">/pricing</a> をご確認ください。
      </p>
    </LegalPageLayout>
  );
}
