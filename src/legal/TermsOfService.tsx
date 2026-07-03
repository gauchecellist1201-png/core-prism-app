// ============================================================
// 利用規約 (フルページ)
// /terms, /iris/terms で表示
// お金関係 / 禁止事項 / 免責 / 準拠法 (日本法) を必須項目として収録
// ============================================================
import LegalPageLayout, { type TocItem } from './LegalPageLayout';

const TOC: TocItem[] = [
  { id: 'apply',        label: '第1条 (本規約の適用)' },
  { id: 'account',      label: '第2条 (アカウントの登録)' },
  { id: 'fee',          label: '第3条 (料金とお支払い)' },
  { id: 'cancel',       label: '第4条 (解約・返金)' },
  { id: 'usage',        label: '第5条 (本サービスの利用)' },
  { id: 'prohibited',   label: '第6条 (禁止事項)' },
  { id: 'ai',           label: '第7条 (AI 生成物の取り扱い)' },
  { id: 'ip',           label: '第8条 (知的財産権)' },
  { id: 'ext',          label: '第9条 (Chrome 拡張機能の利用)' },
  { id: 'thirdparty',   label: '第10条 (第三者サービス)' },
  { id: 'suspend',      label: '第11条 (サービスの停止・変更)' },
  { id: 'disclaim',     label: '第12条 (免責事項)' },
  { id: 'liability',    label: '第13条 (損害賠償の範囲)' },
  { id: 'changes',      label: '第14条 (本規約の変更)' },
  { id: 'law',          label: '第15条 (準拠法・管轄)' },
  { id: 'contact',      label: '第16条 (お問い合わせ)' },
];

export default function TermsOfService() {
  return (
    <LegalPageLayout
      eyebrow="CORE PRISM / IRIS"
      title="利用規約"
      updatedAt="2026年5月22日"
      toc={TOC}
    >
      <section id="apply">
        <h2><span className="num">第1条</span>本規約の適用</h2>
        <p>
          本利用規約 (以下「本規約」) は、CORE（運営者: 井出 直毅。以下「当社」） が提供する SaaS「CORE Prism」「CORE Iris」および関連する Chrome 拡張機能 (以下まとめて「本サービス」) の利用条件を定めるものです。
        </p>
        <p>
          お客様 (以下「ユーザー」) は、本サービスをご利用いただくにあたり、本規約および別途定めるプライバシーポリシーに同意したものとみなします。
        </p>
      </section>

      <section id="account">
        <h2><span className="num">第2条</span>アカウントの登録</h2>
        <p>
          本サービスの一部機能の利用には、メールアドレスとお名前による登録が必要です。登録情報は正確かつ最新の状態に保ってください。
        </p>
        <ul>
          <li>1 人につき 1 アカウントの登録を推奨します</li>
          <li>ログイン情報の管理はユーザーご自身の責任となります</li>
          <li>第三者にアカウントを譲渡・貸与することはできません</li>
        </ul>
      </section>

      <section id="fee">
        <h2><span className="num">第3条</span>料金とお支払い</h2>
        <p>
          有料プランの料金は、本サービス内の料金ページに表示する金額 (税込) とします。お支払いは Stripe (米国) を通じたクレジットカード決済で行います。
        </p>
        <ul>
          <li>初回お申し込み時に登録された日を起算日として、毎月 / 毎年同日に自動的に課金されます</li>
          <li>請求の通貨は原則として日本円です</li>
          <li>カード情報は Stripe が保管し、当社サーバーには渡りません</li>
          <li>決済に失敗した場合、当社は本サービスの一部または全部の利用を一時停止することがあります</li>
        </ul>
      </section>

      <section id="cancel">
        <h2><span className="num">第4条</span>解約・返金</h2>
        <p>
          ユーザーは、本サービス内の解約手続きまたはお問い合わせ窓口から、いつでも解約のお申し出ができます。
        </p>
        <ul>
          <li>当社は、解約のお申し出から 24 時間以内に Stripe にて解約処理を行います</li>
          <li>解約後も、すでにお支払いいただいた期間の<strong>残り日数</strong>までは引き続きご利用いただけます</li>
          <li>本サービスはデジタルサービスの性質上、原則として<strong>日割り返金は行いません</strong></li>
          <li>当社の責に帰すべき重大な障害が長期に渡って継続した場合は、個別に返金対応を検討します</li>
        </ul>
      </section>

      <section id="usage">
        <h2><span className="num">第5条</span>本サービスの利用</h2>
        <p>
          ユーザーは、本規約および関連法令を遵守し、自己の責任において本サービスを利用するものとします。
        </p>
        <p>
          本サービスのご利用には、最新版のモダンブラウザ (Chrome / Edge / Safari / Firefox 等) およびインターネット接続環境が必要です。通信費はユーザーのご負担となります。
        </p>
      </section>

      <section id="prohibited">
        <h2><span className="num">第6条</span>禁止事項</h2>
        <p>ユーザーは、本サービスの利用にあたり、以下の行為を行ってはなりません。</p>
        <ul>
          <li>法令または公序良俗に違反する行為</li>
          <li>犯罪行為・反社会的勢力への利益供与に関連する行為</li>
          <li>当社、他のユーザー、または第三者の知的財産権、プライバシー、名誉、その他の権利・利益を侵害する行為</li>
          <li>本サービスのリバースエンジニアリング、逆コンパイル、解読の試み</li>
          <li>不正な手段でアカウントを取得・利用する行為、なりすまし</li>
          <li>本サービスの運営を妨害する行為 (過剰なリクエスト、脆弱性の悪用等)</li>
          <li>AI 生成物を用いた詐欺、誹謗中傷、差別、なりすまし、フェイクニュースの作成・拡散</li>
          <li>商用 API 利用規約 (Anthropic / Google) に違反する形での本サービスの利用</li>
          <li>本サービスを通じて取得した情報を、本サービスの目的を超えて第三者に再販・再配布する行為</li>
          <li>その他、当社が不適切と合理的に判断する行為</li>
        </ul>
      </section>

      <section id="ai">
        <h2><span className="num">第7条</span>AI 生成物の取り扱い</h2>
        <p>
          本サービスは、Anthropic Claude API および Google Gemini API を利用して文章や画像分析を生成します。
        </p>
        <ul>
          <li>AI が生成した文章・分析・提案は<strong>参考情報</strong>であり、正確性・最新性・有用性を保証するものではありません</li>
          <li>医療・法律・税務・金融など、専門的判断が必要な領域では、必ず有資格者にご相談ください</li>
          <li>AI 生成物の最終的な利用は、ユーザーご自身の責任で行ってください</li>
          <li>ユーザーが入力したデータは、AI モデルの学習には使用されません (各 API 提供事業者のポリシーに準拠)</li>
        </ul>
      </section>

      <section id="ip">
        <h2><span className="num">第8条</span>知的財産権</h2>
        <p>
          本サービスに関する著作権、商標権、その他の知的財産権は、当社または正当な権利者に帰属します。
        </p>
        <p>
          ユーザーが本サービスに入力したコンテンツ (テキスト・画像等) の著作権は、引き続きユーザーまたは正当な権利者に帰属します。当社は、本サービスの提供・改善のために必要な範囲で、これらのコンテンツを利用できるものとします。
        </p>
      </section>

      <section id="ext">
        <h2><span className="num">第9条</span>Chrome 拡張機能の利用</h2>
        <p>
          本サービスの Chrome 拡張機能をインストールすることで、ユーザーは以下に同意したものとします。
        </p>
        <ul>
          <li>拡張機能は <code>activeTab</code> / <code>storage</code> / <code>contextMenus</code> / <code>scripting</code> の権限のみを要求し、これら以外の用途には使用しません</li>
          <li>Instagram からの DOM 抽出は行わず、ユーザーが手動で撮影したスクリーンショットのみを処理します</li>
          <li>Chrome Web Store の開発者ポリシーに従って配布されます</li>
        </ul>
      </section>

      <section id="thirdparty">
        <h2><span className="num">第10条</span>第三者サービス</h2>
        <p>
          本サービスは、以下の第三者サービスを利用しています。各サービスの利用規約・プライバシーポリシーも併せてご確認ください。
        </p>
        <ul>
          <li>Anthropic Claude API (Anthropic, PBC)</li>
          <li>Google Gemini API (Google LLC)</li>
          <li>Stripe (Stripe, Inc.)</li>
          <li>Vercel (Vercel, Inc.) — ホスティング</li>
          <li>Supabase (Supabase, Inc.) — データベース</li>
        </ul>
      </section>

      <section id="suspend">
        <h2><span className="num">第11条</span>サービスの停止・変更</h2>
        <p>
          当社は、以下の場合に、事前の通知なく本サービスの全部または一部の提供を停止・中断することができます。
        </p>
        <ul>
          <li>本サービスのメンテナンス・アップデートを行う場合</li>
          <li>システム障害・通信障害が発生した場合</li>
          <li>地震・火災・停電・パンデミック等の不可抗力により提供が困難な場合</li>
          <li>第三者サービス (Stripe / Claude / Gemini 等) の停止または仕様変更により、本サービスの提供が困難になった場合</li>
        </ul>
        <p>
          当社は、本サービスの内容や仕様を、ユーザーの事前承諾なく変更することができます。重要な変更はサービス内またはメールで告知します。
        </p>
      </section>

      <section id="disclaim">
        <h2><span className="num">第12条</span>免責事項</h2>
        <p>
          当社は、本サービスの内容・機能・継続性・特定の目的への適合性について、明示・黙示を問わず、いかなる保証もいたしません。
        </p>
        <p>
          ユーザーが本サービスを利用したことにより発生した損害について、当社の故意または重大な過失による場合を除き、当社は責任を負わないものとします。
        </p>
      </section>

      <section id="liability">
        <h2><span className="num">第13条</span>損害賠償の範囲</h2>
        <p>
          当社の責に帰すべき事由によりユーザーに損害が生じた場合、当社が負う損害賠償の範囲は、<strong>当該損害が発生した時点から遡って 12 か月間にユーザーが当社に実際に支払った利用料金の総額</strong>を上限とします。
        </p>
        <p>
          逸失利益、間接損害、特別損害、機会損失等については、当社は責任を負わないものとします。ただし、ユーザーが消費者契約法上の消費者である場合で、当社に故意または重大な過失がある場合はこの限りではありません。
        </p>
      </section>

      <section id="changes">
        <h2><span className="num">第14条</span>本規約の変更</h2>
        <p>
          当社は、本規約を変更する必要が生じた場合、ユーザーに事前にお知らせした上で、本規約を変更することができます。
        </p>
        <p>
          変更後の本規約は、本サービス内に掲示した日から効力を生じるものとします。変更後にユーザーが本サービスを継続して利用した場合、変更に同意したものとみなします。
        </p>
      </section>

      <section id="law">
        <h2><span className="num">第15条</span>準拠法・管轄</h2>
        <p>
          本規約は<strong>日本法</strong>に準拠して解釈されます。
        </p>
        <p>
          本サービスまたは本規約に関連して当社とユーザーとの間で生じた紛争については、<strong>東京地方裁判所</strong>を第一審の専属的合意管轄裁判所とします。
        </p>
      </section>

      <section id="contact">
        <h2><span className="num">第16条</span>お問い合わせ</h2>
        <p>
          本規約に関するご質問は、下記「お問い合わせ窓口」までご連絡ください。
        </p>
      </section>
    </LegalPageLayout>
  );
}
