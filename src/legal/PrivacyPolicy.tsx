// ============================================================
// プライバシーポリシー (フルページ)
// /privacy, /iris/privacy で表示
// 個人情報保護法 (日本) と GDPR の主要ポイントに準拠した正直な開示
// ============================================================
import LegalPageLayout, { type TocItem } from './LegalPageLayout';

const TOC: TocItem[] = [
  { id: 'about',         label: 'はじめに / 対象範囲' },
  { id: 'collect',       label: '取得する情報' },
  { id: 'ai',            label: 'AI による処理 (Claude / Gemini)' },
  { id: 'instagram',     label: 'Instagram スクリーンショットの扱い' },
  { id: 'chrome',        label: 'Chrome 拡張機能の権限と使い方' },
  { id: 'stripe',        label: '決済情報 (Stripe)' },
  { id: 'storage',       label: 'データの保存場所と保管期間' },
  { id: 'cookie',        label: 'Cookie (クッキー) と類似技術' },
  { id: 'analytics',     label: 'アナリティクス (アクセス解析)' },
  { id: 'thirdparty',    label: '第三者への提供' },
  { id: 'rights',        label: 'あなたの権利 (開示・訂正・削除)' },
  { id: 'gdpr',          label: 'EU からご利用の方へ (GDPR)' },
  { id: 'minor',         label: '未成年の方の利用' },
  { id: 'security',      label: '安全管理措置' },
  { id: 'changes',       label: '本ポリシーの変更' },
  { id: 'contact',       label: 'お問い合わせ' },
];

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      eyebrow="CORE PRISM / IRIS"
      title="プライバシーポリシー"
      updatedAt="2026年5月22日"
      toc={TOC}
    >
      <section id="about">
        <h2><span className="num">01</span>はじめに / 対象範囲</h2>
        <p>
          株式会社CORE (以下「当社」) は、当社が提供する SaaS「CORE Prism」「CORE Iris」および Chrome 拡張機能 (以下まとめて「本サービス」) における、お客様の個人情報の取り扱いについて、本プライバシーポリシー (以下「本ポリシー」) で定めます。
        </p>
        <p>
          当社は「個人情報の保護に関する法律」(個人情報保護法) を遵守し、EU 域内からご利用の方には GDPR (一般データ保護規則) の主要な権利を尊重します。
        </p>
      </section>

      <section id="collect">
        <h2><span className="num">02</span>取得する情報</h2>
        <p>本サービスでは、以下の情報を取得します。</p>
        <ul>
          <li><strong>アカウント情報</strong>: メールアドレス、氏名 (任意で表示名)</li>
          <li><strong>決済情報</strong>: 課金プラン、Stripe が発行する顧客 ID およびサブスクリプション ID (カード番号そのものは Stripe 側に保管され、当社サーバーには渡りません)</li>
          <li><strong>サービス利用ログ</strong>: アクセス時刻、IP アドレス、ブラウザ / OS の種類、操作ログ (障害調査・不正検知のため。最長 30 日で削除)</li>
          <li><strong>お客様が入力したコンテンツ</strong>: チャット文・タスク・メモ・アップロード画像など (AI 処理に必要な範囲で送信、サーバー永続保存はしません。詳細は「03 AI による処理」)</li>
          <li><strong>Instagram スクリーンショット</strong>: Iris 機能でお客様が手動でアップロードした画像 (詳細は「04」)</li>
          <li><strong>お問い合わせ内容</strong>: フォーム / メールでいただいた内容と連絡先</li>
        </ul>
        <div className="note">
          当社は、Instagram の DOM スクレイピング (画面から自動でデータを抜き取ること) や、お客様の Cookie を勝手に第三者に渡す行為は<strong>一切行いません</strong>。
        </div>
      </section>

      <section id="ai">
        <h2><span className="num">03</span>AI による処理 (Claude / Gemini)</h2>
        <p>
          本サービスは、お客様が入力したテキストや画像を AI で処理するため、以下の API 提供事業者へ必要な範囲で送信します。
        </p>
        <ul>
          <li><strong>Anthropic Claude API</strong> (米 Anthropic, PBC) — チャット応答・要約・分析</li>
          <li><strong>Google Gemini API</strong> (Google LLC) — 画像理解・補助的なテキスト処理</li>
        </ul>
        <p>
          各事業者は、自社のサービス向上のために送信内容を AI モデルの学習に再利用しないポリシーを公開しており、当社はそれを前提に API を利用しています。
        </p>
        <p>
          当社サーバーでは、AI への送受信内容を<strong>永続的には保存しません</strong>。デバッグ・障害対応のための一時ログのみ最長 30 日で自動削除します。
        </p>
      </section>

      <section id="instagram">
        <h2><span className="num">04</span>Instagram スクリーンショットの扱い</h2>
        <p>
          Iris の Instagram 分析機能では、お客様が<strong>手動で撮影してアップロードした</strong>スクリーンショットのみを処理します。当社が Instagram のアカウントに自動でログインしたり、DOM からデータを抜き取ることはありません。
        </p>
        <p>アップロードされた画像は次のように扱われます。</p>
        <ul>
          <li>Claude Vision API による OCR (画像内の文字読み取り) のために送信</li>
          <li>抽出結果はお客様自身のブラウザ (<code>localStorage</code> = ブラウザの記憶領域) と、当社が利用する Supabase (データベース) に保存</li>
          <li>原本の画像ファイル自体は当社サーバーには永続保存しません</li>
        </ul>
        <p>
          Instagram のアクセストークン連携 (公式 OAuth) は別機能として提供する場合があり、その場合はお客様の明示的な同意のもと、必要最小限のスコープでのみ取得します。
        </p>
      </section>

      <section id="chrome">
        <h2><span className="num">05</span>Chrome 拡張機能の権限と使い方</h2>
        <p>本サービスの Chrome 拡張機能は、以下の権限のみを要求します。</p>
        <ul>
          <li><code>activeTab</code> — お客様が拡張機能のアイコンをクリックしたタブの情報を、その時だけ取得</li>
          <li><code>storage</code> — お客様の設定をブラウザ内に保存</li>
          <li><code>contextMenus</code> — 右クリックメニューに本サービスの項目を追加</li>
          <li><code>scripting</code> — お客様が指示したときだけ、対象タブにスクリプトを差し込み</li>
        </ul>
        <p>
          拡張機能は、お客様が明示的に操作したタイミングでのみ動作します。バックグラウンドでの常時監視・自動収集は行いません。
        </p>
      </section>

      <section id="stripe">
        <h2><span className="num">06</span>決済情報 (Stripe)</h2>
        <p>
          有料プランのお支払いは Stripe, Inc. (米国) のサービスを利用します。クレジットカード番号、有効期限、セキュリティコードなどの<strong>カード情報そのものは Stripe が保管</strong>し、当社サーバーには一切渡りません。
        </p>
        <p>当社が保管するのは、課金状態を把握するための以下の最小限の情報です。</p>
        <ul>
          <li>Stripe の顧客 ID (customer ID)</li>
          <li>サブスクリプション ID と現在のプラン</li>
          <li>請求書 ID と決済の成否ステータス</li>
        </ul>
      </section>

      <section id="storage">
        <h2><span className="num">07</span>データの保存場所と保管期間</h2>
        <p>
          当社サーバーのデータは、Vercel (米国・EU 拠点) および Supabase (シンガポール / 米国リージョン) のクラウドインフラに保管されます。海外のリージョンに保管されるため、お客様には<strong>越境移転に同意いただいたもの</strong>として扱います。
        </p>
        <table>
          <thead>
            <tr><th>データ種別</th><th>保管期間</th></tr>
          </thead>
          <tbody>
            <tr><td>アカウント情報</td><td>退会まで / 退会後 30 日で削除</td></tr>
            <tr><td>AI 入出力ログ</td><td>最長 30 日 (デバッグ目的)</td></tr>
            <tr><td>Instagram 分析結果</td><td>お客様が削除するまで</td></tr>
            <tr><td>決済関連</td><td>法令で定める期間 (会計帳簿は 7 年)</td></tr>
            <tr><td>アクセスログ</td><td>最長 90 日</td></tr>
          </tbody>
        </table>
      </section>

      <section id="cookie">
        <h2><span className="num">08</span>Cookie (クッキー) と類似技術</h2>
        <p>
          Cookie (ブラウザの記憶領域) は、ログイン状態の維持・設定の保存・障害解析のために使用します。第三者の広告 Cookie は使用していません。
        </p>
        <p>
          ブラウザの設定で Cookie を無効にできますが、ログイン状態などの維持ができなくなる場合があります。
        </p>
      </section>

      <section id="analytics">
        <h2><span className="num">09</span>アナリティクス (アクセス解析)</h2>
        <p>
          現時点で、当社は第三者のアクセス解析サービス (Google Analytics 等) を使用していません。将来的に Vercel Analytics (匿名のページビュー計測) を導入することを検討しており、導入時は本ポリシーで告知します。
        </p>
      </section>

      <section id="thirdparty">
        <h2><span className="num">10</span>第三者への提供</h2>
        <p>
          以下の場合を除き、お客様の個人情報を第三者に提供することはありません。
        </p>
        <ul>
          <li>お客様の同意がある場合</li>
          <li>本サービスの提供に必要な業務委託先 (Vercel, Supabase, Stripe, Anthropic, Google 等) に、必要な範囲で取り扱いを委託する場合</li>
          <li>法令に基づき開示が義務付けられる場合 (裁判所・捜査機関からの正式な要請等)</li>
          <li>人の生命・身体・財産の保護のために必要で、本人の同意取得が困難な場合</li>
        </ul>
      </section>

      <section id="rights">
        <h2><span className="num">11</span>あなたの権利 (開示・訂正・削除)</h2>
        <p>
          お客様は、ご自身の個人情報について、開示・訂正・利用停止・削除を当社に請求できます。
        </p>
        <ul>
          <li><strong>退会と全データ削除</strong>: 設定画面から退会いただくか、お問い合わせ窓口にご連絡ください。原則 30 日以内に対応します。</li>
          <li><strong>有料プランの解約</strong>: 24 時間以内に Stripe 経由で解約処理を行います。解約後も、残期間が満了するまでは引き続きご利用いただけます。</li>
        </ul>
      </section>

      <section id="gdpr">
        <h2><span className="num">12</span>EU からご利用の方へ (GDPR)</h2>
        <p>
          EU 域内からご利用の方は、GDPR に基づき以下の権利を有します。当社はこれらの請求に誠実に対応します。
        </p>
        <ul>
          <li>アクセス権 / 訂正権 / 消去権 (「忘れられる権利」)</li>
          <li>処理の制限・異議申し立て・データポータビリティ</li>
          <li>監督機関への申し立ての権利</li>
        </ul>
        <p>
          法的根拠は、契約の履行 (サービス提供) と、お客様の同意、および当社の正当な利益 (不正検知・サービス改善) です。
        </p>
      </section>

      <section id="minor">
        <h2><span className="num">13</span>未成年の方の利用</h2>
        <p>
          本サービスは原則として 18 歳以上の方を対象としています。未成年の方は、保護者の同意のもとでご利用ください。
        </p>
      </section>

      <section id="security">
        <h2><span className="num">14</span>安全管理措置</h2>
        <p>
          当社は、お客様の情報を安全に取り扱うため、以下の措置を実施します。
        </p>
        <ul>
          <li>通信の TLS (HTTPS) 暗号化</li>
          <li>アクセス権限の最小化 (必要なメンバーのみがデータに触れられる)</li>
          <li>パスワードはハッシュ化して保管 (平文では保管しません)</li>
          <li>定期的な脆弱性スキャンと依存ライブラリ更新</li>
        </ul>
      </section>

      <section id="changes">
        <h2><span className="num">15</span>本ポリシーの変更</h2>
        <p>
          法令の改正やサービス内容の変更に伴い、本ポリシーを改定することがあります。重要な変更がある場合は、本サービス内またはメールで事前にお知らせします。
        </p>
      </section>

      <section id="contact">
        <h2><span className="num">16</span>お問い合わせ</h2>
        <p>
          本ポリシーや個人情報の取り扱いに関するご質問・ご請求は、下記「お問い合わせ窓口」までご連絡ください。
        </p>
      </section>
    </LegalPageLayout>
  );
}
