// ============================================================
// /faq — よくある質問（会社ぜんぶ版）
// JS 不要のアコーディオン (<details> タグ)
// アクセシビリティ重視: キーボード操作・スクリーンリーダー対応
//
// 2026-07-31 全面見直し。/corp（会社サイト）の「よくある質問は FAQ ページで」から
// ここに来るのに、中身が Prism / Iris だけの説明で、しかも実物と違う数字が並んでいた。
//   - 「14 日間の無料お試し」→ 実物は 3 日間（api/trial/claim.ts の TRIAL_DAYS = 3）
//   - 「6/1 までの登録なら +30 日」→ とっくに終わったキャンペーンが出たまま
//   - 料金 4 プランの名前も金額も、実際の /pricing と 1 つも合っていなかった
//   - 連絡先の support@core-prism.com は、ドメイン自体が存在せず届かない
//   - 「領収書を発行」画面は実在しない（作っていない機能を約束していた）
// ここは買う前の人がいちばん不安を確かめに来る場所なので、
// **実物で確認できたことだけ**を書く。書けないことは「まだ無い」と正直に書く。
//
// 数字を触るときの原本:
//   無料お試し日数 … api/trial/claim.ts の TRIAL_DAYS / src/lib/referral.ts
//   料金        … src/corporate/PricingPage.tsx（画面に実際に出ている額）
//   解約の場所   … src/components/SettingsModal.tsx → BillingDashboard.tsx
// ============================================================
import LegalPageLayout from '../legal/LegalPageLayout';
import { REFERRAL_BONUS_DAYS, TRIAL_BASE_DAYS, TRIAL_WITH_REFERRAL_DAYS } from '../lib/referral';

/** 会社が公開している唯一の連絡先（/corp のフッター・お問い合わせと同じもの） */
const CONTACT_MAIL = 'info@core-ai.jp';

/**
 * 解約ボタンの場所は Prism と Iris で違う。このページは /faq と /iris/faq の
 * 両方で出るので、実際にその人の画面に存在する道順だけを書く。
 * （2026-08-08: Iris には「設定」自体が無いのに Prism の道順を書いていた）
 */
const IS_IRIS_FAQ = typeof window !== 'undefined' && window.location.pathname.startsWith('/iris');
const CANCEL_PATH = IS_IRIS_FAQ
  ? '画面下の「全機能」→「お支払い・解約」→「サブスクリプションを解約する」'
  : '設定 → プラン → 「サブスクリプションを解約する」';

interface FaqItem {
  q: string;
  a: React.ReactNode;
  /** 章の見出し。この項目から新しい章が始まるときだけ入れる */
  group?: string;
  /**
   * 目次に出す短い名前（2026-08-18）。
   * 目次の行は質問文そのものだったので、375px では 5 問中 2 問が 2 行に折れて
   * 目次だけで 370px（画面の半分）を使っていた。
   * ここで **質問文は 1 文字も変えずに**、目次側だけ短い名前にする。
   * ※ `line-clamp` で途中を切ると「解約したらデータは消えますか?」が
   *   「解約したらデータは…」になり意味が変わるので、切らずに書き直す。
   * 375px の目次の実効幅は約 257px（番号ぶんを除く）＝日本語で 15 文字までは 1 行に収まる。
   */
  short: string;
}

const FAQS: FaqItem[] = [
  // ─── 会社のこと ───────────────────────────────
  {
    group: '会社のこと',
    q: 'どんな会社が作っているのですか?',
    short: '運営している会社のこと',
    a: (
      <>
        <p>
          <strong>株式会社CORE</strong> が開発・運営しています。運営責任者は <strong>井出 直毅</strong> です。
        </p>
        <p>
          7 つのプロダクト（Prism / Iris / Guild / Resonance / Lume / Crystal / Pulse）は、
          すべて自分たちで作り、自分たちの事業でも毎日使っています。
          自社でも実際に使用したうえで提供することを開発方針としています。
        </p>
        <p>
          会社の情報（所在地・事業内容）は <a href="/corp#about">会社サイトの「わたしたちについて」</a> に載せています。
        </p>
      </>
    ),
  },
  {
    q: '個人でやっているサービスですが、続きますか?',
    short: '個人事業でも続くのか',
    a: (
      <>
        <p>
          <strong>「絶対に継続する」とお約束することはできません。</strong>
          これはどの事業者にも共通する点であり、小規模からのスタートである現状も含めてご説明いたします。
        </p>
        <p>そのため、以下のような仕組みにしています。</p>
        <ul>
          <li><strong>お試しはカード登録なし</strong>で {TRIAL_BASE_DAYS} 日間。ご要望に合わない場合は、手続きなしでいつでも退会いただけます</li>
          <li><strong>解約はいつでも画面から</strong>。電話も引き止めの連絡もしません</li>
          <li><strong>長期の縛りがありません</strong>。年間契約を必須にしていません（月払いで始められます）</li>
        </ul>
      </>
    ),
  },
  {
    q: '導入実績はどれくらいありますか?',
    short: '導入実績はどれくらいか',
    a: (
      <>
        <p>
          <strong>まだ、社外のお客様の導入実績を数字で出せる段階ではありません。</strong>
          現在は 7 プロダクトともベータ公開中で、これから実際の現場に入っていく時期です。
        </p>
        <p>
          「導入 ◯◯ 社」「効果 ◯◯ %」といった数字は、
          <strong>実績として公開できる段階に至るまでは、本ページに記載いたしません</strong>。公開可能になり次第、掲載いたします。
        </p>
        <p>
          いま見ていただけるのは、約束ではなく実物です。
          料金を払う前に、<a href="/corp#products">実際の画面</a>と{TRIAL_BASE_DAYS} 日間のお試しでご判断ください。
        </p>
      </>
    ),
  },
  {
    q: 'サポートは誰が、どれくらいで返してくれますか?',
    short: 'サポート窓口と返信の速さ',
    a: (
      <>
        <p>
          運営者本人がメールで直接お返事します。窓口は <a href={`mailto:${CONTACT_MAIL}`}>{CONTACT_MAIL}</a> の 1 つだけです。
        </p>
        <p>
          <strong>通常 24 時間以内</strong>にご返信します（土日祝にいただいたものは翌営業日になることがあります）。
          電話窓口は設けていません。
        </p>
      </>
    ),
  },

  // ─── 料金・解約 ───────────────────────────────
  {
    group: '料金と解約',
    q: '料金はいくらですか? 無料で試せますか?',
    short: '料金と無料お試し',
    a: (
      <>
        <p>
          <strong>{TRIAL_BASE_DAYS} 日間の無料お試し</strong>があります。
          <strong>クレジットカードの登録は不要</strong>で、お試し期間が終わっても勝手に課金されることはありません。
        </p>
        <p>月額プラン（税込）は次のとおりです。</p>
        <ul>
          <li>
            <strong>CORE Prism</strong>（事業家・経営者向け） —
            Starter ¥2,980 / Standard ¥9,800 / Exclusive ¥29,800
          </li>
          <li>
            <strong>CORE Iris</strong>（クリエイター向け） —
            Lite ¥2,980 / Standard ¥6,980 / Pro ¥12,800 / Agency ¥29,800
          </li>
        </ul>
        <p>
          年払いにすると約 17% お得になります。各プランに何が含まれるかは <a href="/pricing">料金ページ</a> をご覧ください。
          ほかの 5 つのサービスの料金は <a href="/corp#finder">会社サイトの比較</a> で並べて見られます。
        </p>
      </>
    ),
  },
  {
    q: '解約はいつでもできますか?',
    short: '解約のしかた',
    a: (
      <>
        <p>
          はい。アプリの <strong>{CANCEL_PATH}</strong> から、その場で手続きできます。
          電話での確認や、こちらからの引き止めの連絡は一切ありません。
        </p>
        <p>
          解約の途中で「やめる理由を 1 つ選ぶ」画面が出ます。今後の改善に使わせていただくためのもので、
          <strong>選ばずに閉じても構いません</strong>し、答えても手続きは止まりません。
        </p>
        <p>解約したあとも、<strong>お支払い済みの期間が終わるまで</strong>は今までどおりお使いいただけます。</p>
      </>
    ),
  },
  {
    q: '解約したらデータは消えますか?',
    short: '解約したあとのデータ',
    a: (
      <>
        <p>
          いいえ。保存先はお使いの<strong>端末（ブラウザ）の中</strong>が中心なので、
          解約しても、その端末のデータはそのまま残ります。
        </p>
        <p>
          一部のデータは、サービスを動かすために当社が利用するデータベース
          （Supabase / Upstash）にも保存されます。どのデータがどこに保存されるかは
          <a href="/privacy">プライバシーポリシー</a> に書いています。削除のご依頼も同じ窓口で承ります。
        </p>
        <p>
          「どこの国に置いてあるか」「誰が見られるか」「AIの学習に使われないか」まで一枚にまとめたページが
          <a href="/trust">データの取り扱い</a> です。
        </p>
      </>
    ),
  },
  {
    // 2026-08-03 追加: 競合 board は稼働状況を常設ページで持っている。
    // CORE も /status を持っていたのに、どこからもリンクしておらず誰も辿り着けなかった。
    q: 'サービスが止まっていないか、どこで分かりますか?',
    short: 'いまの稼働状況の見かた',
    a: (
      <>
        <p>
          <a href="/status">いまの稼働状況</a> のページで確認できます。
          ページを開くたびに、7 つのサービスの本番ページへ<strong>実際にアクセスして</strong>、
          正常に表示されるかどうかを計測しています。本ページに記載しているのは、その実測結果のみです。
        </p>
        <p>
          不具合が起きたときは、日付と内容を同じページに残していきます。
          記録をとりはじめたのは 2026 年 8 月 3 日なので、それより前の「無事故」は主張していません。
        </p>
      </>
    ),
  },
  {
    q: '領収書は出せますか?',
    short: '領収書の発行',
    a: (
      <>
        <p>
          <strong>アプリの中に「領収書を発行する」画面は、現時点では未実装です。</strong>
        </p>
        <p>
          領収書が必要な方は <a href={`mailto:${CONTACT_MAIL}?subject=%E9%A0%98%E5%8F%8E%E6%9B%B8%E3%81%AE%E7%99%BA%E8%A1%8C`}>{CONTACT_MAIL}</a> までご連絡ください。
          宛名を指定いただければ、個別に発行してお送りします。
        </p>
      </>
    ),
  },
  {
    q: 'カード以外の支払い方法はありますか?',
    short: 'カード以外の支払い',
    a: (
      <>
        <p>現在はクレジットカード決済（Visa / Mastercard / Amex / JCB）のみに対応しています。</p>
        <p>
          銀行振込・請求書払いをご希望の法人様は <a href={`mailto:${CONTACT_MAIL}?subject=%E8%AB%8B%E6%B1%82%E6%9B%B8%E6%89%95%E3%81%84%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87`}>{CONTACT_MAIL}</a> までご相談ください。
          年額一括前払いでの対応が可能です。
        </p>
      </>
    ),
  },
  {
    q: 'チームで使えますか? 法人での導入は?',
    short: 'チーム・法人での導入',
    a: (
      <>
        <p>
          <strong>Exclusive（¥29,800 / 月）</strong>で 5 名までのチーム共有・API アクセス・優先サポートがつきます。
        </p>
        <p>
          6 名以上でのご利用や、社内データとの連携などのご相談は <a href={`mailto:${CONTACT_MAIL}?subject=%E6%B3%95%E4%BA%BA%E5%B0%8E%E5%85%A5%E3%81%AE%E7%9B%B8%E8%AB%87`}>{CONTACT_MAIL}</a> へ。
          必要な内容をうかがったうえでお見積りします。
        </p>
      </>
    ),
  },

  // ─── データと安全 ─────────────────────────────
  {
    group: 'データと安全',
    q: '私の業務データは外部に送られますか?',
    short: '業務データの送り先',
    a: (
      <>
        <p>
          保存の中心は <strong>お使いの端末のブラウザの中</strong>です。
          あわせて、サービスの提供に必要な範囲で、当社が利用するデータベース（Supabase / Upstash）にも保存されます。
        </p>
        <p>
          AI の機能を使うときだけ、必要な部分が Anthropic / OpenAI の API に送られます。
          これらの事業者は、送信内容を AI の学習に再利用しないポリシーを公開しており、当社はそれを前提に利用しています。
          詳しくは <a href="/privacy">プライバシーポリシー</a> をご覧ください。
        </p>
      </>
    ),
  },
  {
    q: 'AI は何を使っていますか?',
    short: '使っている AI',
    a: (
      <>
        <p>
          Anthropic 社の <strong>Claude</strong>（クロード）を中心に使用しています。
          用途に応じて Haiku（速い）/ Sonnet（ちょうどよい）/ Opus（いちばん賢い）を自動で切り替えています。
        </p>
        <p>
          ご自身の Anthropic / OpenAI の API キー（連携キー）を持ち込んで使うこともできます。
          その場合、AI の利用料は提供元から直接ご請求されます。
        </p>
      </>
    ),
  },

  // ─── 使い方 ───────────────────────────────────
  {
    group: '使い方・プロダクト',
    q: '7 つもあって、自分にはどれが合うのか分かりません',
    short: '7 つのどれが合うか',
    a: (
      <>
        <p>
          <a href="/corp#finder">会社サイトの「3 問で選ぶ」</a> をお使いください。
          困りごと・お客様との接点・規模の 3 つに答えると、おすすめの 1 つと、その理由・実際の金額・
          つないだ直後に起きることが出ます。
        </p>
        <p><strong>登録もメールアドレスも要りません。</strong>同じ答えなら、いつ何度やっても同じ結果が出ます。</p>
      </>
    ),
  },
  {
    q: 'Prism と Iris の違いは?',
    short: 'Prism と Iris の違い',
    a: (
      <>
        <p>
          <strong>CORE Prism</strong> は事業家向けの「AI 役員チーム」。経営判断・営業・経理などを、
          役割ごとの AI が伴走します。
        </p>
        <p>
          <strong>CORE Iris</strong> はクリエイター（インフルエンサー / 配信者）向けの姉妹ブランド。
          Instagram のリール作成・分析・案件管理など、影響力を仕事にするための機能に特化しています。
        </p>
        <p>同じアカウントで両方使え、用途に合わせて入口を切り替えられます。</p>
      </>
    ),
  },
  {
    q: 'API キーが無くても使えますか?',
    short: 'API キーが無い場合',
    a: (
      <>
        <p>はい。データを入れる方法は 3 通りあります。</p>
        <ul>
          <li><strong>スクリーンショット</strong> — 画面写真をドラッグすると AI が読み取ります</li>
          <li><strong>ファイル取り込み</strong> — PDF / CSV / Excel をそのまま投入できます</li>
          <li><strong>直接入力</strong> — 数字や案件をフォームで入力できます</li>
        </ul>
        <p>API キー（連携キー）をお持ちの方は、つなぐと自動で最新になります。</p>
      </>
    ),
  },
  {
    q: 'iPhone で使えますか? どのブラウザに対応していますか?',
    short: 'iPhone と対応ブラウザ',
    a: (
      <>
        <p>
          Chrome / Safari / Edge / Firefox の最新版でご利用いただけます。
          スマートフォンでは Safari（iPhone）と Chrome（Android）を推奨しています。
        </p>
        <p>アプリのようにホーム画面から起動するには（iPhone の場合）:</p>
        <ol>
          <li>Safari で <code>core-prism-app.vercel.app</code> を開く</li>
          <li>下メニューの「共有」ボタンをタップ</li>
          <li>「ホーム画面に追加」を選ぶ</li>
        </ol>
        <p>これで通常のアプリと同じように、画面いっぱいで起動できます。</p>
      </>
    ),
  },
  {
    q: '紹介プログラムはありますか?',
    short: '紹介プログラム',
    a: (
      <>
        <p>
          はい。あなたの紹介リンクから新しい方が登録すると、<strong>お互いに +{REFERRAL_BONUS_DAYS} 日</strong>の無料期間がつきます。
        </p>
        <p>
          紹介された方は、通常の {TRIAL_BASE_DAYS} 日と合わせて <strong>合計 {TRIAL_WITH_REFERRAL_DAYS} 日</strong>無料でお試しいただけます。
          紹介リンクは、登録後の設定画面から取得できます。
        </p>
      </>
    ),
  },
];

export default function FAQPage() {
  return (
    <LegalPageLayout
      eyebrow="CORE"
      title="よくある質問"
      updatedAt="2026 年 8 月 3 日"
      toc={FAQS.map((f, i) => ({ id: `q${i + 1}`, label: f.short }))}
    >
      <p>
        買う前に確かめたくなることを {FAQS.length} 項目にまとめました。質問をタップすると答えが開きます。
        <strong>実際にご確認いただける内容のみを記載しております。</strong>現時点で未提供の機能については、その旨を明記しています。
      </p>
      <p>
        ここに無いことは <a href={`mailto:${CONTACT_MAIL}`}>{CONTACT_MAIL}</a> までお気軽にどうぞ。通常 24 時間以内にお返事します。
      </p>

      {FAQS.map((f, i) => (
        <section key={i} id={`q${i + 1}`}>
          {f.group && (
            <h2
              style={{
                fontSize: '0.95rem',
                letterSpacing: '0.08em',
                color: '#A78BFA',
                margin: '2.2rem 0 0.9rem',
                fontWeight: 700,
              }}
            >
              {f.group}
            </h2>
          )}
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
                position: 'relative',
                cursor: 'pointer',
                // 右だけ広げて印の居場所を作る（1.2rem のままだと、いちばん
                // 長い質問と印のすきまが本番実測で 3px しかなく詰まって見える）
                padding: '1rem 1.9rem 1rem 1.2rem',
                fontWeight: 700,
                fontSize: '1rem',
                color: '#E6E9F2',
                listStyle: 'none',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                userSelect: 'none',
                minHeight: 44,
                lineHeight: 1.5,
                overflowWrap: 'break-word',
              }}
            >
              <span style={{ color: '#A78BFA', flexShrink: 0, fontSize: '0.85rem', marginTop: '0.15rem' }}>
                Q{String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>{f.q}</span>
              {/* 印は右余白(1.9rem=30.4px)の中に絶対配置する＝流れに置くより
                  質問文の幅を食わない。1行の質問の余りは最小3pxしかないので、
                  それでも長い3問は2行に折れる（56→80px）。詰まって見えるより
                  そちらを取った。*/}
              <svg className="disclosure-chev" style={{ right: 7, top: 21, color: 'rgba(230,233,242,0.75)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
            </summary>
            <div style={{ padding: '0 1.2rem 1rem 1.2rem' }}>{f.a}</div>
          </details>
        </section>
      ))}

      <p style={{ marginTop: '2rem', fontSize: '0.88rem', color: 'rgba(230,233,242,0.5)' }}>
        ※ 最新の料金・プラン内容は <a href="/pricing">/pricing</a> が正です。食い違いを見つけたら、お手数ですが上のメールでお知らせください。
      </p>
    </LegalPageLayout>
  );
}
