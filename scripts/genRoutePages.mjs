// ============================================================================
// genRoutePages.mjs — ルートごとの入口HTMLを作る（SEO / LLMO）
//
// なぜ必要か（2026-09-06 実測）:
//   /studio/plans も /studio/dev も /return-on-ai も、返ってくる静的HTMLは
//   ハブ（studio.html / corp.html）そのものだった。つまり
//     ・canonical が全部ハブを指す      → 下層ページは検索結果に単独で出られない
//     ・title / description が全部同じ  → 何のページか外から分からない
//     ・JSを実行しない相手（GPTBot / ClaudeBot / PerplexityBot）にはハブの本文しか見えない
//   ＝ 8ページ分の中身が、1ページ分としてしか扱われていなかった。
//
//   ここで1ルート1ファイルの入口HTMLを作り、そのルートの
//   title / description / canonical / OG / 構造化データ / 静的コンテンツ層 を持たせる。
//   中身のReactは今までどおり同じ（パスから画面を決めている）ので、閲覧者の見え方は変わらない。
//
// 使い方: node scripts/genRoutePages.mjs  （npm run prebuild から自動で走る）
// 生成物は git に入れる（Vite の入口として build 時に必要なため）。
// ★このファイルが正本。生成されたHTMLを直接編集しても次の build で消える。
// ============================================================================
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = '2026-09-06';
const CORP = 'https://www.core-ai.jp';
const STUDIO = 'https://studio.core-ai.jp';
const ORG = `${CORP}/#org`;

const FONTS_CORP = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;800;900&display=swap';
const FONTS_STUDIO = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Noto+Serif+JP:wght@400;500;600;700;900&family=Noto+Sans+JP:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap';

const THEMES = {
  corp:       { bg: '#050505', appTitle: 'CORE',        site: 'CORE',        entry: '/src/corpMain.tsx', fonts: FONTS_CORP,   dark: true,  gaSite: 'corp' },
  studio:     { bg: '#FFFFFF', appTitle: 'CORE Studio', site: 'CORE Studio', entry: '/src/main.tsx',     fonts: FONTS_STUDIO, dark: false, gaSite: 'studio' },
  studioDark: { bg: '#0B0B0C', appTitle: 'CORE Studio', site: 'CORE Studio', entry: '/src/main.tsx',     fonts: FONTS_STUDIO, dark: true,  gaSite: 'studio' },
};

/** 静的コンテンツ層の体裁。Reactがマウントするまでの一瞬だけ見える面でもあるので、
 *  素の白背景で本文が消えないように必ず色を持たせる。 */
const preCss = (dark) => dark ? `
      #pre{max-width:820px;margin:0 auto;padding:56px 20px 80px;color:#e8e8ea;background:${'${BG}'};font-family:'Noto Sans JP',system-ui,-apple-system,'Hiragino Sans',sans-serif;line-height:1.9;font-size:16px}
      #pre h1{font-size:clamp(28px,5.4vw,46px);line-height:1.22;letter-spacing:-.02em;margin:10px 0 22px;font-weight:800;color:#fff}
      #pre h2{font-size:clamp(19px,3.2vw,26px);margin:46px 0 12px;font-weight:700;letter-spacing:-.01em;color:#fff}
      #pre h3{font-size:16.5px;margin:24px 0 6px;font-weight:700;color:#fff}
      #pre p,#pre li,#pre dd,#pre td{color:#b9bcc4;margin:0 0 14px}
      #pre .k{font-size:11px;letter-spacing:.22em;color:#8a8f9a;margin:0}
      #pre .lead{font-size:18px;color:#d6d8de}
      #pre strong{color:#fff;font-weight:600}
      #pre a{color:#fff}
      #pre ul,#pre ol{padding-left:1.25em;margin:0 0 18px}
      #pre dt{color:#8a8f9a;font-size:13px;margin-top:14px}
      #pre dd{margin:0}
      #pre table{border-collapse:collapse;width:100%;font-size:14.5px;margin:8px 0 16px}
      #pre caption{text-align:left;color:#8a8f9a;font-size:13px;padding-bottom:8px}
      #pre th,#pre td{border:1px solid #23262c;padding:9px 10px;text-align:left;vertical-align:top;margin:0}
      #pre th{background:#101216;font-weight:600;color:#fff}
      #pre footer{margin-top:64px;padding-top:24px;border-top:1px solid #23262c;font-size:13px;color:#8a8f9a}` : `
      #pre{max-width:820px;margin:0 auto;padding:56px 20px 80px;color:#1b1b1f;background:${'${BG}'};font-family:'Noto Sans JP',system-ui,-apple-system,'Hiragino Sans',sans-serif;line-height:1.9;font-size:16px}
      #pre h1{font-size:clamp(28px,5.4vw,46px);line-height:1.22;letter-spacing:-.02em;margin:10px 0 22px;font-weight:800}
      #pre h2{font-size:clamp(19px,3.2vw,26px);margin:46px 0 12px;font-weight:700;letter-spacing:-.01em}
      #pre h3{font-size:16.5px;margin:24px 0 6px;font-weight:700}
      #pre p,#pre li,#pre dd,#pre td{color:#43464e;margin:0 0 14px}
      #pre .k{font-size:11px;letter-spacing:.22em;color:#8a8f9a;margin:0}
      #pre .lead{font-size:18px;color:#2b2e35}
      #pre strong{color:#000;font-weight:600}
      #pre a{color:#0b57d0}
      #pre ul,#pre ol{padding-left:1.25em;margin:0 0 18px}
      #pre dt{color:#71757e;font-size:13px;margin-top:14px}
      #pre dd{margin:0}
      #pre table{border-collapse:collapse;width:100%;font-size:14.5px;margin:8px 0 16px}
      #pre caption{text-align:left;color:#71757e;font-size:13px;padding-bottom:8px}
      #pre th,#pre td{border:1px solid #e3e5ea;padding:9px 10px;text-align:left;vertical-align:top;margin:0}
      #pre th{background:#f6f7f9;font-weight:600;color:#1b1b1f}
      #pre footer{margin-top:64px;padding-top:24px;border-top:1px solid #e3e5ea;font-size:13px;color:#71757e}`;

const crumbs = (id, items) => ({
  '@type': 'BreadcrumbList', '@id': id + '#crumbs',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: it[1] })),
});
const faq = (id, qa) => ({
  '@type': 'FAQPage', '@id': id + '#faq', inLanguage: 'ja',
  mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
});

export const PAGES = [
  // ──────────────────────────────── CORE 本体 ────────────────────────────────
  {
    file: 'return-on-ai.html', theme: 'corp', url: `${CORP}/return-on-ai`,
    title: 'Return on AI（ROAI）とは — AI投資を経営成果で測る指標 | 株式会社CORE',
    description: 'Return on AI（ROAI）とは、AIへの投資額ではなく、AIが返した経営成果で投資を評価する指標です。ROAI＝AIが生んだ経済価値÷AI投資総額。売上・コスト削減・時間・損失回避・新しい価値の5つのReturnで測ります。AI投資が成果にならない5つの理由、期待損失の数え方、投資余力の逆算、CORE Transformation Loop（8段）まで、株式会社COREが実務で使っている考え方を公開します。',
    keywords: 'Return on AI,ROAI,AI投資,ROI,AI導入 効果測定,AI 投資対効果,DX 効果測定,AI KPI,株式会社CORE',
    og: `${CORP}/og-core-v7.png`,
    ld: [
      { '@type': 'Article', '@id': `${CORP}/return-on-ai#article`, headline: 'Return on AI（ROAI）とは — AI投資を経営成果で測る指標',
        author: { '@id': `${CORP}/#founder` }, publisher: { '@id': ORG }, inLanguage: 'ja',
        datePublished: '2026-09-03', dateModified: TODAY, image: `${CORP}/og-core-v7.png`,
        about: { '@id': `${CORP}/return-on-ai#term` }, mainEntityOfPage: `${CORP}/return-on-ai` },
      { '@type': 'DefinedTerm', '@id': `${CORP}/return-on-ai#term`, name: 'Return on AI', alternateName: ['ROAI', 'リターン・オン・AI'],
        url: `${CORP}/return-on-ai`, inDefinedTermSet: `${CORP}/return-on-ai`,
        description: 'AIへの投資額ではなく、AIが返した経営成果で投資を評価する指標。ROAI＝AIが生んだ経済価値÷AI投資総額。会計基準の公式指標ではなく、AI投資を経営判断できる形にするための戦略KPI。' },
      crumbs(`${CORP}/return-on-ai`, [['株式会社CORE', `${CORP}/corp`], ['Return on AI', `${CORP}/return-on-ai`]]),
      faq(`${CORP}/return-on-ai`, [
        ['Return on AI（ROAI）とは何ですか。', 'AIへの投資額ではなく、AIが返した経営成果で投資を評価する指標です。ROAI＝AIが生んだ経済価値÷AI投資総額で表します。会計基準の公式指標ではなく、AI投資を経営判断できる形にするための戦略KPIとして扱います。'],
        ['ROAIはどう計算しますか。', '分子は「AIが生んだ経済価値」＝売上の増加＋コスト削減＋時間の回復（人件費換算）＋損失の回避＋リスクの低減＋新しい価値。分母は「AI投資総額」＝開発＋導入＋ライセンス/API利用料＋インフラ＋教育＋運用保守です。分子と分母に何を入れるかを先に決めることが計測の第一歩です。'],
        ['AI投資が成果にならないのはなぜですか。', '多くは技術ではなく始め方と終わり方が原因です。(1)ツールを配って導入した事にする (2)導入前のベースラインを測っていない (3)技術から始める (4)データと手順が整っていない (5)納品がゴールになっている、の5つです。'],
        ['売上に出ない価値はどう数えますか。', '期待損失＝発生確率×想定損失額 を置き、AIで減らせる分を Loss Avoidance として数えます。確定した損害額のようには見せず、必ず幅と前提を添えます。CORE ROAI SCORE では年間発生確率（点検・監査あり3%／基本対策のみ8%／担当者まかせ15%）と削減率40%を仮定として明示します。'],
        ['AIにいくらまで投資してよいか、どう決めますか。', '年間の潜在経済価値÷目標ROAIで投資余力の目安を出します。例えば年間の潜在経済価値3,000万円・目標ROAI5.0倍なら、投資余力の目安は600万円です。金額の妥当性は相見積もりではなくリターンで判断します。'],
        ['CORE Transformation Loop とは何ですか。', '納品をゴールにせず回し続ける8段の進め方です。理解→定義→再設計→構築→導入→計測→改善→拡大。Build and Leave ではなく Build, Measure and Evolve を原則にしています。'],
      ]),
    ],
    body: `
          <p class="k">RETURN ON AI</p>
          <h1>問うべきは「AIを導入したか」ではない。「AIが何を生み出したか」だ。</h1>
          <p class="lead">1億円を投資した。100個のAIエージェントを作った。全社員に生成AIを配った。それ自体は成功ではありません。売上・利益・時間・速度・リスク・新しい価値として、AIが何を返したか。それを経営指標として扱うのが <strong>Return on AI（ROAI）</strong> です。</p>

          <section>
            <h2>Return on AI（ROAI）の定義</h2>
            <p><strong>Return on AI とは、AIへの投資額ではなく、AIが返した経営成果で投資を評価する指標です。</strong>株式会社COREが提唱し、診断・設計・開発・運用のすべての工程で一貫して使っています。会計基準の公式指標ではなく、AI投資を経営判断できる形にするための戦略KPIとして扱います。</p>
            <p><strong>ROAI ＝ AIが生んだ経済価値 ÷ AI投資総額</strong></p>
            <table>
              <caption>分子と分母に何を入れるかを先に決めることが、計測の第一歩です。</caption>
              <thead><tr><th>分子：AIが生んだ経済価値</th><th>分母：AI投資総額</th></tr></thead>
              <tbody>
                <tr><td>売上の増加（Revenue Gain）</td><td>開発（Development）</td></tr>
                <tr><td>コスト削減（Cost Savings）</td><td>導入（Implementation）</td></tr>
                <tr><td>時間の回復・人件費換算（Productivity Value）</td><td>ライセンス・API利用料</td></tr>
                <tr><td>損失の回避（Loss Avoidance）</td><td>インフラ（Infrastructure）</td></tr>
                <tr><td>リスクの低減（Risk Reduction）</td><td>教育（Training）</td></tr>
                <tr><td>新しい価値（Innovation Value）</td><td>運用・保守（Operation / Maintenance）</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>AI投資が成果にならない5つの理由</h2>
            <p>失敗の多くは技術ではなく、始め方と終わり方にあります。COREはこの5つを最初に潰します。</p>
            <ol>
              <li><strong>ツール導入で終わる。</strong> ChatGPTやCopilotを配って「導入した」ことにする。業務も組織も変わらないので、成果が数字に出ない。</li>
              <li><strong>ベースラインが無い。</strong> 導入前の時間・コスト・売上を測っていないので、後から「返った」と言えない。</li>
              <li><strong>技術から始める。</strong> 「AIで何ができるか」から始めると、使われない仕組みができる。「どこで価値が失われているか」から始める。</li>
              <li><strong>データと手順が整っていない。</strong> Excelと紙と担当者の頭の中に散らばったまま作ると、AIは動かない。先に整えるほうが速い。</li>
              <li><strong>納品がゴールになる。</strong> 作って納めて終わり。運用・計測・改善が無いので、初期の効果が薄れていく。</li>
            </ol>
          </section>

          <section>
            <h2>CORE ROAI MODEL — AIが返すものを5つのReturnで測る</h2>
            <p>すべてのAI案件を、Before → 変革 → After → 計測 → ROAI まで追いかけるための分類です。売上とコスト削減だけでなく、速度・損失回避・新しい価値も経済価値として数えます。</p>
            <table>
              <thead><tr><th>#</th><th>Return</th><th>何を増やす／減らすか</th><th>内容</th></tr></thead>
              <tbody>
                <tr><td>01</td><td><strong>GROW</strong></td><td>売上・利益・顧客価値を増やす</td><td>営業の時間を商談へ戻し、見込み客への返答を速め、既存顧客からの売上を増やす。</td></tr>
                <tr><td>02</td><td><strong>SAVE</strong></td><td>コスト・工数を減らす</td><td>転記・チェック・定型文書・メール対応など、人がやる必要のない仕事をAIと自動化へ移す。</td></tr>
                <tr><td>03</td><td><strong>ACCELERATE</strong></td><td>企業の速度を上げる</td><td>意思決定・承認・調査・提案・開発のリードタイムを縮め、機会を逃さない会社にする。</td></tr>
                <tr><td>04</td><td><strong>PROTECT</strong></td><td>損失・リスクを減らす</td><td>情報漏洩・人的ミス・不正・属人化・品質事故を、起きる前に検知して減らす。</td></tr>
                <tr><td>05</td><td><strong>CREATE</strong></td><td>新しい価値を生む</td><td>自社のデータと業務を、新しいサービス・顧客体験・事業へ変える。</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>売上に出ない価値も、経済価値として数える（Loss Avoidance）</h2>
            <p>サイバー攻撃を防ぐ。障害を防ぐ。情報漏洩を防ぐ。契約リスクを見つける。人的ミスを防ぐ。売上として表示されなくても、大きな経済価値があります。</p>
            <p><strong>期待損失（Expected Loss）＝ 発生確率（Probability of Event）× 想定損失額（Estimated Impact）</strong></p>
            <p>発生確率×想定損失額で「期待損失」を置き、AIで減らせる分を Loss Avoidance として数えます。確定した損害額のようには見せず、必ず幅と前提を添えて出します。CORE ROAI SCORE では対策段階に応じた年間発生確率（点検・監査あり 3%／基本対策のみ 8%／担当者まかせ 15%）と削減率 40% を仮定として明示します。</p>
          </section>

          <section>
            <h2>投資の上限は、価格ではなくリターンから逆算する</h2>
            <p>年間に見込める経済価値と目標ROAIから、合理的な投資規模を導きます。金額の妥当性は、相見積もりではなくリターンで判断すべきものです。</p>
            <p><strong>年間の潜在経済価値 ÷ 目標ROAI ＝ 投資余力の目安</strong>（例：年間3,000万円 ÷ 5.0倍 ＝ 600万円）</p>
            <p>上記は前提を置いた試算例です。実際の投資規模は、貴社の現状データに基づく <a href="/roai-score">CORE ROAI SCORE</a> の診断結果から算出します。</p>
          </section>

          <section>
            <h2>CORE TRANSFORMATION LOOP — Build and Leave ではなく、Build, Measure and Evolve.</h2>
            <p>納品をゴールにしません。次の8段を回し続けます。</p>
            <ol>
              <li><strong>UNDERSTAND 理解する</strong>：事業・業務・数字・データ・リスクを読む。どこで価値が失われているかを特定する。</li>
              <li><strong>DEFINE 定義する</strong>：経営目標・ベースライン・KPI・目標ROAIを決める。ここで「作るもの」はまだ決めない。</li>
              <li><strong>REDESIGN 再設計する</strong>：人・AI・エージェント・ソフトウェア・データの役割分担で、業務と組織を組み直す。</li>
              <li><strong>BUILD 作る</strong>：最適な技術を選んで作る。AIが不要なら使わない。自動化で足りるなら自動化にする。</li>
              <li><strong>DEPLOY 導入する</strong>：現場に入れて、使われる状態にする。教育・運用ルール・セキュリティを含めて配備する。</li>
              <li><strong>MEASURE 測る</strong>：BeforeとAfterを同じKPIで測る。時間・コスト・売上・リスク・速度の変化を数字にする。</li>
              <li><strong>OPTIMIZE 改善する</strong>：測った結果から、プロンプト・業務・モデル・コストを改善する。</li>
              <li><strong>SCALE 広げる</strong>：効いたものを他部門・他拠点・他事業へ広げる。次の投資判断へつなぐ。</li>
            </ol>
            <p>Technology follows Strategy. 最適ならOpenAI、Claude、Gemini、オープンソース。AIエージェントが不要なら使わない。自動化で十分ならAIすら使わない。COREは技術を売る会社ではなく、経営成果のために最適な技術を選ぶ会社です。</p>
          </section>

          <section>
            <h2>AI投資の前に、Returnを測る</h2>
            <p>約3分で、あなたの会社のAI投資優先順位と潜在的な経済価値を診断します。無料・連絡先の入力は不要です。</p>
            <p><a href="/roai-score">CORE ROAI SCORE を受ける</a>　／　ご相談：<a href="mailto:info@core-ai.jp">info@core-ai.jp</a></p>
            <p>CORE ROAI SCORE・CORE ROAI MODEL は株式会社COREの独自名称です。</p>
          </section>`,
    footer: `<p>株式会社CORE — 〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号 ／ info@core-ai.jp</p>
          <p><a href="/corp">会社について</a>　<a href="/roai-score">CORE ROAI SCORE</a>　<a href="https://studio.core-ai.jp/studio">CORE Studio</a></p>`,
  },
  {
    file: 'roai-score.html', theme: 'corp', url: `${CORP}/roai-score`,
    title: 'CORE ROAI SCORE — 約3分・無料のAI投資優先順位診断 | 株式会社CORE',
    description: '約3分・選択式で、あなたの会社の次にAI投資すべき場所、削減できる時間、経済価値の概算、売上・コスト・リスクの改善余地、AI Readiness、投資余力の目安を可視化する無料診断。連絡先の入力は不要。数字は入力と公開された仮定から決定論的に計算し、算定根拠を画面上で確かめられます。',
    keywords: 'AI診断 無料,AI投資 優先順位,DX診断,AI Readiness,ROAI診断,AI導入 診断,無料 診断 AI,株式会社CORE',
    og: `${CORP}/og-core-v7.png`,
    ld: [
      { '@type': 'WebApplication', '@id': `${CORP}/roai-score#app`, name: 'CORE ROAI SCORE',
        url: `${CORP}/roai-score`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'ja',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' }, provider: { '@id': ORG },
        description: '約3分で、AI投資の優先領域・削減可能時間・経済価値の概算・AI Readiness・投資余力の目安を可視化する無料診断。連絡先の入力は不要。' },
      crumbs(`${CORP}/roai-score`, [['株式会社CORE', `${CORP}/corp`], ['CORE ROAI SCORE', `${CORP}/roai-score`]]),
      faq(`${CORP}/roai-score`, [
        ['CORE ROAI SCORE は無料ですか。', '無料です。連絡先の入力も不要で、メールアドレスや会社名を登録せずに最後まで受けられます。'],
        ['どれくらい時間がかかりますか。', '約3分です。選択式で答えていく形式です。'],
        ['何が分かりますか。', 'AI投資の優先領域、削減できる時間、経済価値の概算、売上改善余地、コスト削減余地、リスク削減余地、AI Readiness、投資余力の目安の8点です。'],
        ['出てくる数字はどうやって計算していますか。', '入力値と公開された仮定から決定論的に計算しています。推測をブラックボックスで出さず、算定根拠を画面上で開いて確かめられます。'],
        ['診断のあとに営業されますか。', '連絡先を入力しない形式なので、こちらから連絡することはできません。ご相談されたい場合のみ info@core-ai.jp までご連絡ください。'],
      ]),
    ],
    body: `
          <p class="k">CORE ROAI SCORE</p>
          <h1>あなたの会社の、次にAI投資すべき場所はどこか。</h1>
          <p class="lead">約3分・選択式の診断で、どこへAI投資すると最も大きな経営Returnが生まれる可能性があるかを可視化します。<strong>料金は無料、連絡先の入力も不要</strong>です。</p>

          <section>
            <h2>分かること（8項目）</h2>
            <ul>
              <li>AI投資の優先領域 — どの業務から手を付けると効果が大きいか</li>
              <li>削減できる時間 — 年間で人に返せる時間の概算</li>
              <li>経済価値の概算 — 時間・コスト・売上・リスクを金額に換算した目安</li>
              <li>売上改善余地（GROW）</li>
              <li>コスト削減余地（SAVE）</li>
              <li>リスク削減余地（PROTECT）</li>
              <li>AI Readiness — いまAIを入れられる状態かどうか</li>
              <li>投資余力の目安 — 年間の潜在経済価値 ÷ 目標ROAI で逆算した金額</li>
            </ul>
          </section>

          <section>
            <h2>数字の作り方（ブラックボックスにしない）</h2>
            <p>診断結果の数字はすべて、入力と<strong>公開された仮定</strong>から決定論的に計算しています。画面上で算定根拠を開き、どの仮定でその金額になったのかを確かめられます。たとえばリスクの項目では、対策段階に応じた年間発生確率（点検・監査あり 3%／基本対策のみ 8%／担当者まかせ 15%）と削減率 40% を仮定として明示しています。</p>
            <p>考え方の全体は <a href="/return-on-ai">Return on AI（ROAI）とは</a> にまとめています。</p>
          </section>

          <section>
            <h2>こんな方に</h2>
            <ul>
              <li>AIを入れたいが、どこから手を付けるべきか決めきれていない経営者・事業責任者</li>
              <li>すでにAIツールを配ったが、成果が数字に出ていない会社</li>
              <li>AI投資にいくらまで出してよいのか、判断の根拠がほしい方</li>
            </ul>
            <p>診断のあと、より詳しくご相談されたい場合は <a href="mailto:info@core-ai.jp">info@core-ai.jp</a> へ。初回のご相談は無料です。</p>
          </section>`,
    footer: `<p>株式会社CORE — 〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号 ／ info@core-ai.jp</p>
          <p><a href="/corp">会社について</a>　<a href="/return-on-ai">Return on AI とは</a></p>`,
  },
];

// ──────────────────────────────── CORE Studio ────────────────────────────────
const studioFooter = `<p>CORE Studio ／ 株式会社CORE — 〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号 ／ info@core-ai.jp</p>
          <p><a href="/studio">ホーム</a>　<a href="/studio/film">映像制作</a>　<a href="/studio/plans">サイト制作</a>　<a href="/studio/dev">受託開発</a>　<a href="/studio/care">運用</a>　<a href="/studio/works">実績</a>　<a href="/studio/about">会社案内</a>　<a href="/studio/contact">お問い合わせ</a>　<a href="https://www.core-ai.jp/corp">株式会社CORE</a></p>`;
const sCrumb = (slug, name) => crumbs(`${STUDIO}/studio/${slug}`, [['株式会社CORE', `${CORP}/corp`], ['CORE Studio', `${STUDIO}/studio`], [name, `${STUDIO}/studio/${slug}`]]);
const offer = (name, price, url, extra = {}) => ({ '@type': 'Offer', name, priceCurrency: 'JPY', url, availability: 'https://schema.org/InStock', seller: { '@id': ORG }, ...extra });

PAGES.push(
  {
    file: 'studio-film.html', theme: 'studioDark', url: `${STUDIO}/studio/film`,
    title: 'AI動画制作・ショートドラマ制作代行 — CORE Studio',
    description: 'ショートドラマ、ブランドムービー、SNS縦型動画、CMまで。企画・脚本・映像制作・編集・字幕・SNS最適化までを一貫制作するAIクリエイティブスタジオ。15秒1本は通常¥89,800、初めてのお取引にかぎり¥49,800。撮影費・出演費・ロケ費・機材費は0円。初期費用0円・最低契約期間なし。神戸の株式会社COREが制作します。',
    keywords: 'AI動画制作,AI動画生成,AIショートドラマ,ショート動画制作,ブランドムービー制作,TikTok動画制作,Instagram Reels制作,AI CM制作,縦型動画,採用動画,CORE Studio,神戸',
    og: `${STUDIO}/og-studio-film-v5.png`,
    ld: [
      { '@type': 'Service', '@id': `${STUDIO}/studio/film#service`, name: 'AI映像制作（CORE Studio）', serviceType: 'Video production',
        provider: { '@id': `${STUDIO}/#studio` }, areaServed: { '@type': 'Country', name: '日本' }, inLanguage: 'ja',
        description: '撮影を伴わないAI映像制作。企画・脚本・ディレクション・仕上げまで一貫。撮影費・出演費・ロケ費・機材費はかからない。',
        hasOfferCatalog: { '@type': 'OfferCatalog', name: '映像制作の料金（税込・初稿まで約1週間）', itemListElement: [
          offer('商品・サービス紹介（15秒・3〜5カット）', '89800', `${STUDIO}/studio/film`, { price: '89800', description: '見せ場だけを15秒に。そのまま広告に出せる形で納品。初めてのお取引は ¥49,800。' }),
          offer('採用・会社紹介（30秒・8〜12カット）', '128000', `${STUDIO}/studio/film`, { price: '128000', description: '働く場所と人の空気を、応募前の候補者に先に届ける。' }),
          offer('イベント告知（30秒・8〜12カット）', '128000', `${STUDIO}/studio/film`, { price: '128000', description: '開催前に、当日の熱量を先に見せる告知映像。' }),
          offer('ブランドフィルム（60秒・15カット以上）', '298000', `${STUDIO}/studio/film`, { price: '298000', description: '会社・商品の思想を1本に。商談や展示会で流す顔になる。' }),
          offer('SNSの継続発信（20〜30秒 × 月1〜12本）', '74800', `${STUDIO}/studio/film`, { price: '74800', description: 'TikTok・Reels・Shorts用の縦型を毎月まとめて。1本あたり ¥45,667〜。', priceSpecification: { '@type': 'UnitPriceSpecification', price: '74800', priceCurrency: 'JPY', unitCode: 'MON' } }),
          offer('ショートドラマ（20〜30秒 × 月1〜12本）', '74800', `${STUDIO}/studio/film`, { price: '74800', description: '人物を主役にした連続もの。毎月1話ずつ積み上げる。', priceSpecification: { '@type': 'UnitPriceSpecification', price: '74800', priceCurrency: 'JPY', unitCode: 'MON' } }),
        ] } },
      sCrumb('film', '映像制作'),
      faq(`${STUDIO}/studio/film`, [
        ['AI動画制作はいくらからですか。', '商品・サービス紹介（15秒・3〜5カット）が通常¥89,800、初めてのお取引にかぎり¥49,800です。採用・会社紹介とイベント告知が¥128,000、ブランドフィルム（60秒）が¥298,000、SNSの継続発信とショートドラマは月¥74,800からです。'],
        ['撮影費や出演費は別にかかりますか。', 'かかりません。撮影費・出演費・ロケ費・機材費は0円です。初期費用も0円です。'],
        ['納品までどれくらいですか。', 'どのメニューも初稿のお渡しまで約1週間です。'],
        ['修正は何回までですか。', 'STANDARD以上は無制限です。初回限定のTRIAL（15秒1本 ¥49,800）は修正2回まで、3回目以降は1回¥5,500です。'],
        ['納品した映像の権利はどうなりますか。', '貴社へ譲渡します。広告への二次利用もSTANDARD以上は込みです。'],
        ['本当に撮影せずに作れるのですか。', 'はい。掲載している映像はすべてAIで制作しており、撮影はしていません。企画・脚本・ディレクション・仕上げまで当社が一貫して担当します。'],
      ]),
    ],
    body: `
          <p class="k">FILM &amp; MOTION</p>
          <h1>撮影せずに、広告に出せる映像を。</h1>
          <p class="lead">企画・脚本・ディレクション・仕上げまで、株式会社CORE（CORE Studio）が一貫して制作します。掲載している映像は<strong>すべてAIで制作しており、撮影はしていません</strong>。15秒1本 ¥89,800（初めてのお取引は ¥49,800）、初稿のお渡しまで約1週間。</p>

          <section>
            <h2>何が、いくらで作れるか</h2>
            <table>
              <caption>ご依頼の多い6つ。金額はすべて税込で、初稿のお渡しまではどれも約1週間です。撮影費・出演費・ロケ費・機材費はかかりません。</caption>
              <thead><tr><th>メニュー</th><th>尺・構成</th><th>料金</th><th>内容</th></tr></thead>
              <tbody>
                <tr><td>商品・サービス紹介</td><td>15秒・3〜5カット</td><td><strong>¥89,800</strong>（初めてのお取引は ¥49,800）</td><td>見せ場だけを15秒に。そのまま広告に出せる形で納品します。</td></tr>
                <tr><td>採用・会社紹介</td><td>30秒・8〜12カット</td><td><strong>¥128,000</strong></td><td>働く場所と人の空気を、応募前の候補者に先に届けます。</td></tr>
                <tr><td>イベント告知</td><td>30秒・8〜12カット</td><td><strong>¥128,000</strong></td><td>開催前に、当日の熱量を先に見せる告知映像です。</td></tr>
                <tr><td>ブランドフィルム</td><td>60秒・15カット以上</td><td><strong>¥298,000</strong></td><td>会社・商品の思想を1本に。商談や展示会で流す顔になります。</td></tr>
                <tr><td>SNSの継続発信</td><td>20〜30秒 × 月1〜12本</td><td><strong>月 ¥74,800〜</strong>（1本あたり ¥45,667〜）</td><td>TikTok・Reels・Shorts 用の縦型を、毎月まとめて。</td></tr>
                <tr><td>ショートドラマ</td><td>20〜30秒 × 月1〜12本</td><td><strong>月 ¥74,800〜</strong>（1本あたり ¥45,667〜）</td><td>人物を主役にした連続もの。毎月1話ずつ積み上げます。</td></tr>
              </tbody>
            </table>
            <p>金額は目安で、確定金額はヒアリングの上でお見積りとしてご提示します。</p>
          </section>

          <section>
            <h2>どの金額にも共通して含まれるもの</h2>
            <ul>
              <li>撮影費・出演費・ロケ費 … <strong>0円</strong></li>
              <li>初期費用 … <strong>0円</strong></li>
              <li>修正 … 無制限（STANDARD以上）</li>
              <li>納品物の権利 … <strong>貴社へ譲渡</strong></li>
              <li>広告への二次利用 … 込み（STANDARD以上）</li>
              <li>最低契約期間 … なし（月額プラン）</li>
            </ul>
          </section>

          <section>
            <h2>制作実績</h2>
            <p>すべて当社が制作し、実際に納品した映像です。掲載は貴社の許可をいただいたもののみで、非公開のご希望があれば一切掲載しません。</p>
            <ul>
              <li><strong>Laguna Beauté（ラグナボーテ）</strong>／PRODUCT — 百貨店の化粧品売場に店舗を構える神戸のエイジングケアブランド様の商品広告。化粧水「LAGUNA DERMA WATER」の透明感と水の質感を軸に、ブランドの世界観を保ったまま縦型1本に収めました。</li>
              <li><strong>株式会社CORE（自社）</strong>／BRAND FILM — 社是「いつの時代も、変わらない核を。」を軸にした企業紹介映像。</li>
              <li><strong>ライブイベント主催者様</strong>／EVENT BRANDING — 開催前に当日の熱量を見せる告知映像。</li>
              <li><strong>株式会社グローバルジョイントコミットメント</strong>／BRAND FILM — 北海道旭川に建つヴィラの紹介映像。竣工間近のヴィラを舞台に、当事者目線のドラマ仕立てで制作。</li>
              <li><strong>JRC 日本記録協会</strong>／<strong>GAUCHE（チェリスト）</strong></li>
            </ul>
          </section>

          <section>
            <h2>ご相談</h2>
            <p>ご相談からお見積りのご提示までは無料です。NDAの締結・請求書払いにも対応します。メール：<a href="mailto:info@core-ai.jp">info@core-ai.jp</a></p>
          </section>`,
    footer: studioFooter,
  },
  {
    file: 'studio-plans.html', theme: 'studio', url: `${STUDIO}/studio/plans`,
    title: 'ホームページ制作の料金 — 1ページ¥5万から4プラン | CORE Studio（神戸）',
    description: '1ページのLPから、予約・決済を備えた企業サイトまで。Spark ¥5万（1ページ・2週間）／Core ¥10〜30万（5〜10ページ）／Pro ¥50〜100万（予約・決済・会員機能）／Signature ¥100万〜（ブランド戦略から統合）の4プラン。原稿と写真がなくても始められます。お見積り時に金額を確定し、以後の追加費用はいただきません。神戸の株式会社COREが制作します。',
    keywords: 'ホームページ制作 料金,LP制作,ウェブサイト制作 神戸,企業サイト 制作,予約システム 制作,Stripe 決済 サイト,コーポレートサイト 費用,CORE Studio',
    og: `${STUDIO}/og-studio-v4.png`,
    ld: [
      { '@type': 'Service', '@id': `${STUDIO}/studio/plans#service`, name: 'ウェブサイト制作（CORE Studio）', serviceType: 'Web design',
        provider: { '@id': `${STUDIO}/#studio` }, areaServed: { '@type': 'Country', name: '日本' }, inLanguage: 'ja',
        hasOfferCatalog: { '@type': 'OfferCatalog', name: 'サイト制作 4プラン', itemListElement: [
          offer('Spark — 1ページ完結のランディングページ', null, `${STUDIO}/studio/plans`, { price: '50000', description: '構成設計・原稿ライティング・オリジナルデザイン・お問い合わせ導線・公開作業・公開後1週間の修正対応。納期2週間。' }),
          offer('Core — 企業サイトの標準形（5〜10ページ）', null, `${STUDIO}/studio/plans`, { priceSpecification: { '@type': 'PriceSpecification', minPrice: '100000', maxPrice: '300000', priceCurrency: 'JPY' }, description: 'トップ+下層5〜10ページ、ブランド設計、お知らせ更新機能（CMS）、フォーム、基本SEO・OGP設定、公開後1ヶ月サポート。納期2〜4週間。' }),
          offer('Pro — 予約・決済・会員機能つき', null, `${STUDIO}/studio/plans`, { priceSpecification: { '@type': 'PriceSpecification', minPrice: '500000', maxPrice: '1000000', priceCurrency: 'JPY' }, description: 'Coreの全内容＋予約システム（カレンダー連携）、オンライン決済（Stripe）、会員・ログイン機能、AI接客、多言語対応（希望時）、公開後3ヶ月サポート。納期1〜2ヶ月。' }),
          offer('Signature — ブランド戦略からデジタル全体を統合', null, `${STUDIO}/studio/plans`, { priceSpecification: { '@type': 'PriceSpecification', minPrice: '1000000', priceCurrency: 'JPY' }, description: 'ブランド戦略の策定支援、サイト+LP群+SNS設計の統合、独自機能の開発、撮影・コピーのディレクション、公開後6ヶ月の専任サポート。納期2ヶ月〜。' }),
        ] } },
      sCrumb('plans', 'サイト制作'),
      faq(`${STUDIO}/studio/plans`, [
        ['ホームページ制作はいくらからですか。', '1ページ完結のSparkが¥50,000（納期2週間）です。企業サイトの標準形Coreが¥10〜30万（5〜10ページ・2〜4週間）、予約・決済・会員機能を備えたProが¥50〜100万（1〜2ヶ月）、ブランド戦略から統合するSignatureが¥100万〜（2ヶ月〜）です。'],
        ['原稿や写真がなくても依頼できますか。', 'できます。ヒアリングをもとに当社で原稿を作成します。写真も素材選定から対応しますので、お手元に何もない状態からで問題ありません。'],
        ['見積り後に追加費用は発生しますか。', '発生しません。お見積り時に金額を確定し、以後の追加費用はいただきません。'],
        ['既存サイトのリニューアルにも対応できますか。', '対応します。現行サイトの状態を確認したうえで、構成とプランをご提案します。'],
        ['自社で更新できますか。', 'Coreプラン以上はお知らせ更新機能（CMS）が含まれるため、貴社側で更新できます。'],
        ['予約や決済を自社サイトに載せられますか。', 'Proプランで対応します。予約システム（カレンダー連携）とStripeによるオンライン決済を実装し、外部予約サービスへの手数料を貴社の利益に取り戻します。'],
        ['どのプランを選べばよいか分かりません。', 'まず1ページを最短で公開したいならSpark、古くなった会社の顔を作り直したいならCore、予約・決済を自社サイトに移して手数料を減らしたいならPro、ブランドからデジタル全体を統合したいならSignatureです。判断がつかない場合はそのままご相談ください。'],
      ]),
    ],
    body: `
          <p class="k">WEBSITE</p>
          <h1>事業の顔を、成果から逆算してつくる。</h1>
          <p class="lead">1ページのLPから、予約・決済を備えた企業サイトまで。<strong>原稿と写真がなくても始められます。</strong>金額はご契約時に確定し、以後の追加費用はいただきません。最短公開は2週間、公開中の実績は8件です。</p>

          <section>
            <h2>4つのプラン</h2>
            <p>規模と目的で4段に分けています。いずれも、構成設計・原稿・デザイン・実装・公開作業までを含みます。</p>
            <table>
              <thead><tr><th>プラン</th><th>料金</th><th>規模・納期</th><th>含まれるもの</th></tr></thead>
              <tbody>
                <tr><td><strong>Spark</strong></td><td>¥5万</td><td>1ページ／2週間</td><td>構成設計・原稿ライティング／オリジナルデザイン（スマートフォン最適化）／お問い合わせ導線（メール・LINE）／公開作業・サーバー設定（維持費0円構成）／公開後1週間の修正対応</td></tr>
                <tr><td><strong>Core</strong>（推奨）</td><td>¥10〜30万</td><td>5〜10ページ／2〜4週間</td><td>トップ+下層5〜10ページ／ブランド設計（配色・タイポグラフィ）／お知らせ更新機能（CMS）／お問い合わせフォーム／基本SEO・OGP設定／公開後1ヶ月のサポート</td></tr>
                <tr><td><strong>Pro</strong></td><td>¥50〜100万</td><td>10〜20ページ+機能開発／1〜2ヶ月</td><td>Coreの全内容／予約システム（カレンダー連携）／オンライン決済（Stripe）／会員・ログイン機能／AI接客・自動応対の組み込み／多言語対応（ご希望時）／公開後3ヶ月のサポート</td></tr>
                <tr><td><strong>Signature</strong></td><td>¥100万〜</td><td>20ページ〜+独自機能／2ヶ月〜</td><td>ブランド戦略の策定支援／サイト+LP群+SNS設計の統合／独自機能の開発（AI活用を含む）／撮影・コピーのディレクション／公開後6ヶ月の専任サポート</td></tr>
              </tbody>
            </table>
            <p>規模の近い実例：Spark＝ヘッドスパ「天国」／Core＝株式会社クロスオーバー／Pro＝朝日館／Signature＝RAD HOOKAH</p>
          </section>

          <section>
            <h2>どれを選べばよいか</h2>
            <ul>
              <li>まず1ページを、最短で公開したい → <strong>Spark</strong></li>
              <li>古くなった会社の顔を、作り直したい → <strong>Core</strong></li>
              <li>予約・決済を自社サイトに移し、手数料を減らしたい → <strong>Pro</strong></li>
              <li>ブランドからデジタル全体を、ひとつの世界観で統合したい → <strong>Signature</strong></li>
            </ul>
          </section>

          <section>
            <h2>ご契約から公開まで、6つの工程</h2>
            <ol>
              <li><strong>お問い合わせ</strong> — フォームまたはメールでご連絡ください。1営業日以内にご返信します。</li>
              <li><strong>ヒアリング・ご提案</strong> — 貴社の事業目標と課題を伺い、最適な構成とプランをご提案します。</li>
              <li><strong>お見積り・ご契約</strong> — この時点で金額を確定します。以後の追加費用はありません。</li>
              <li><strong>設計・デザイン</strong> — 情報設計とデザイン案を作成し、貴社に確認いただきながら進めます。</li>
              <li><strong>実装・検証</strong> — 全ページを実装し、スマートフォン実機を含む動作検証を行います。</li>
              <li><strong>公開・運用改善</strong> — 公開後もアクセスデータをもとに、継続的な改善をご提案します。</li>
            </ol>
            <p>ご相談からお見積りのご提示までは無料です。NDAの締結・請求書払いにも対応します。メール：<a href="mailto:info@core-ai.jp">info@core-ai.jp</a></p>
          </section>`,
    footer: studioFooter,
  },
  {
    file: 'studio-dev.html', theme: 'studio', url: `${STUDIO}/studio/dev`,
    title: 'システム受託開発の料金 — MVP ¥50万から4Tier | CORE Studio（神戸）',
    description: '業務システムからSaaSまで。MVP ¥50〜150万（2週間〜1.5ヶ月）／Product ¥150〜500万（1.5〜3ヶ月）／Scale ¥500〜1,500万（3〜6ヶ月）／Enterprise ¥1,500〜3,000万（6ヶ月〜）の4Tier。自社で8つのAIプロダクトを開発・運営する体制で、構想の段階からご相談いただけます。神戸の株式会社CORE。',
    keywords: 'システム開発 費用,受託開発 料金,MVP開発,SaaS開発,業務システム 開発,AI開発 会社,ラボ型開発,神戸 システム開発,CORE Studio',
    og: `${STUDIO}/og-studio-v4.png`,
    ld: [
      { '@type': 'Service', '@id': `${STUDIO}/studio/dev#service`, name: 'システム受託開発（CORE Studio）', serviceType: 'Software development',
        provider: { '@id': `${STUDIO}/#studio` }, areaServed: { '@type': 'Country', name: '日本' }, inLanguage: 'ja',
        hasOfferCatalog: { '@type': 'OfferCatalog', name: '受託開発 4Tier', itemListElement: [
          offer('MVP — 仮説検証のための最小プロダクト', null, `${STUDIO}/studio/dev`, { priceSpecification: { '@type': 'PriceSpecification', minPrice: '500000', maxPrice: '1500000', priceCurrency: 'JPY' }, description: '期間の目安2週間〜1.5ヶ月。ログイン+コア機能1つのWebアプリ、AIチャットボット、社内業務の自動化ツール、予約・マッチングの原型。' }),
          offer('Product — 商用運営が可能な完成品', null, `${STUDIO}/studio/dev`, { priceSpecification: { '@type': 'PriceSpecification', minPrice: '1500000', maxPrice: '5000000', priceCurrency: 'JPY' }, description: '期間の目安1.5〜3ヶ月。サブスク課金つきSaaS、多店舗対応の予約・顧客管理、AIを組み込んだ業務システム、モバイル対応PWA。' }),
          offer('Scale — 事業のシステム基盤を設計から再構築', null, `${STUDIO}/studio/dev`, { priceSpecification: { '@type': 'PriceSpecification', minPrice: '5000000', maxPrice: '15000000', priceCurrency: 'JPY' }, description: '期間の目安3〜6ヶ月。複数事業を統合する業務システム、大量データの分析・ダッシュボード、既存システムからの移行、API公開・パートナー連携基盤。要件定義フェーズは別途50万円〜。' }),
          offer('Enterprise — 基幹システム級の開発', null, `${STUDIO}/studio/dev`, { priceSpecification: { '@type': 'PriceSpecification', minPrice: '15000000', maxPrice: '30000000', priceCurrency: 'JPY' }, description: '期間の目安6ヶ月〜。基幹業務システムの刷新、医療・金融など規制領域、複数拠点・多言語の統合基盤、専任体制での継続開発。月額の専任契約（ラボ型）またはフェーズ分割の請負契約。' }),
        ] } },
      sCrumb('dev', '受託開発'),
      faq(`${STUDIO}/studio/dev`, [
        ['システム開発はいくらからですか。', 'MVP（仮説検証のための最小プロダクト）が¥50〜150万、期間の目安は2週間〜1.5ヶ月です。商用運営できるProductが¥150〜500万、事業基盤を再構築するScaleが¥500〜1,500万、基幹システム級のEnterpriseが¥1,500〜3,000万です。'],
        ['要件が固まっていない段階でも相談できますか。', 'できます。構想の段階からのご相談を承ります。Scale以上では要件定義フェーズ（別途50万円〜）で全体像を確定してから、マイルストーン単位で契約します。'],
        ['なぜ従来の開発会社より安くできるのですか。', 'AI-nativeな開発体制により工数を大幅に圧縮しているためです。金額は画面数と外部サービス連携の数で確定します。'],
        ['どんなものを作れますか。', 'ログイン+コア機能のWebアプリ、AIチャットボット・自動応対、社内業務の自動化ツール、サブスク課金つきSaaS、多店舗対応の予約・顧客管理システム、AIを組み込んだ業務システム、モバイル対応PWAアプリ、大量データの分析ダッシュボード、API公開・パートナー連携基盤などです。'],
        ['ラボ型（月額の専任契約）には対応していますか。', 'Enterprise Tierで対応しています。月額の専任契約、またはフェーズ分割の請負契約からお選びいただけます。'],
      ]),
    ],
    body: `
          <p class="k">DEVELOPMENT</p>
          <h1>構想を、動くかたちにする。</h1>
          <p class="lead">業務システムからSaaSまで。<strong>自社で8つのAIプロダクトを開発・運営する開発力</strong>で、構想を動くかたちにします。MVPは¥50〜150万、最短の着手〜納品は2週間から。要件が固まっていない段階からのご相談も承ります。</p>

          <section>
            <h2>4つのTier — 金額と期間の関係</h2>
            <table>
              <thead><tr><th>Tier</th><th>金額</th><th>期間の目安</th><th>開発例</th></tr></thead>
              <tbody>
                <tr><td><strong>MVP</strong></td><td>¥50〜150万</td><td>2週間〜1.5ヶ月</td><td>ログイン+コア機能1つのWebアプリ／AIチャットボット・自動応対／社内業務の自動化ツール／予約・マッチングの原型</td></tr>
                <tr><td><strong>Product</strong></td><td>¥150〜500万</td><td>1.5〜3ヶ月</td><td>サブスクリプション課金つきSaaS／多店舗対応の予約・顧客管理システム／AIを組み込んだ業務システム／モバイル対応PWAアプリ</td></tr>
                <tr><td><strong>Scale</strong></td><td>¥500〜1,500万</td><td>3〜6ヶ月</td><td>複数事業を統合する業務システム／大量データの分析・ダッシュボード／既存システムからの移行・刷新／API公開・パートナー連携基盤</td></tr>
                <tr><td><strong>Enterprise</strong></td><td>¥1,500〜3,000万</td><td>6ヶ月〜</td><td>基幹業務システムの刷新／医療・金融など規制領域の開発／複数拠点・多言語の統合基盤／専任体制での継続開発</td></tr>
              </tbody>
            </table>
            <h3>価格の考え方</h3>
            <ul>
              <li><strong>MVP</strong> — AI-nativeの開発体制により、従来の開発会社に比べ工数を大幅に圧縮しています。画面数と外部サービス連携の数で確定します。</li>
              <li><strong>Product</strong> — ユーザー種別（一般／管理者／オーナー）の数と、決済・通知・外部連携の本数でお見積りします。</li>
              <li><strong>Scale</strong> — 要件定義フェーズ（別途50万円〜）で全体像を確定した上で、マイルストーン単位で契約します。</li>
              <li><strong>Enterprise</strong> — 月額の専任契約（ラボ型）、またはフェーズ分割の請負契約からお選びいただけます。まずは要件整理からご相談ください。</li>
            </ul>
          </section>

          <section>
            <h2>自分たちの事業で、毎日検証している</h2>
            <p>受託だけの会社と違い、当社は自社のプロダクトを毎日運営しています。そこで検証した設計と技術を、そのまま貴社の案件に投入します。ヒアリングで貴社の事業目標から逆算し、情報設計・デザイン・実装・公開後の改善までを一気通貫で担当するため、分業の伝言ゲームで意図が薄まることがありません。</p>
            <p>ご相談からお見積りのご提示までは無料です。NDAの締結・請求書払いにも対応します。メール：<a href="mailto:info@core-ai.jp">info@core-ai.jp</a></p>
          </section>`,
    footer: studioFooter,
  },
  {
    file: 'studio-care.html', theme: 'studio', url: `${STUDIO}/studio/care`,
    title: 'サイト保守・運用代行 月¥1万から — 他社制作サイトも対象 | CORE Studio',
    description: '公開後の稼働監視・更新代行・セキュリティ更新から、月次レポートと改善提案まで。保守・運用は月¥1〜10万。初期費用を抑えたい方には、AI接客を標準搭載したサイトを月¥2〜5万から（初期費用0円プランあり・買い取りへの移行はいつでも可能）。他社で制作されたサイトの運用のみのご依頼も承ります。神戸の株式会社CORE。',
    keywords: 'ホームページ 保守,サイト運用代行,更新代行,月額 ホームページ,サブスク ホームページ,他社制作 サイト 保守,月次レポート,CORE Studio',
    og: `${STUDIO}/og-studio-v4.png`,
    ld: [
      { '@type': 'Service', '@id': `${STUDIO}/studio/care#service`, name: 'サイト保守・運用（CORE Studio）', serviceType: 'Website maintenance',
        provider: { '@id': `${STUDIO}/#studio` }, areaServed: { '@type': 'Country', name: '日本' }, inLanguage: 'ja',
        hasOfferCatalog: { '@type': 'OfferCatalog', name: '運用 月額プラン', itemListElement: [
          offer('STANDARD 保守・運用', null, `${STUDIO}/studio/care`, { priceSpecification: { '@type': 'UnitPriceSpecification', minPrice: '10000', maxPrice: '100000', priceCurrency: 'JPY', unitCode: 'MON' }, description: '稼働監視・障害対応／テキスト・写真の更新代行／セキュリティ・依存関係の更新／月次レポート（アクセス解析・改善提案）／軽微な機能追加。' }),
          offer('サイト × AI サブスクリプション', null, `${STUDIO}/studio/care`, { priceSpecification: { '@type': 'UnitPriceSpecification', minPrice: '20000', maxPrice: '50000', priceCurrency: 'JPY', unitCode: 'MON' }, description: 'サイト制作費を月額に分散（初期費用0円プランあり）／AI接客・自動応対を標準搭載／毎月の改善サイクル／文章・バナーのAI生成サポート／買い取りへの移行はいつでも可能。' }),
        ] } },
      sCrumb('care', '運用'),
      faq(`${STUDIO}/studio/care`, [
        ['サイトの保守・運用はいくらですか。', '保守・運用（STANDARD）は月¥1〜10万です。稼働監視・障害対応、テキストや写真の更新代行、セキュリティ更新、月次レポート、軽微な機能追加が含まれます。'],
        ['他社で作ったサイトの運用だけ頼めますか。', '承ります。現行サイトの状態を確認したうえで、保守・更新代行・改善提案の範囲をご提案します。'],
        ['初期費用を抑えて月額で始められますか。', 'できます。「サイト × AI サブスクリプション」は月¥2〜5万からで、サイト制作費を月額に分散します（初期費用0円プランあり）。AI接客・自動応対を標準搭載し、買い取りへの移行はいつでも可能です。'],
        ['毎月どんな報告がありますか。', '月次レポートとして、アクセス解析と改善提案をお渡しします。データに基づく改善サイクルを毎月回します。'],
        ['相談するとき何を送ればいいですか。', 'いまのサイトのURLだけお送りください。現行サイトの状態を確認したうえで、保守・更新代行・改善提案の範囲と月額をご提案します。'],
      ]),
    ],
    body: `
          <p class="k">MAINTENANCE</p>
          <h1>公開はゴールではなく、スタートです。</h1>
          <p class="lead">公開後の稼働監視・更新代行・セキュリティ更新から、月次レポートと改善提案まで。アクセスデータをもとに、貴社サイトの成果を継続的に高めます。<strong>他社で制作されたサイトの運用のみのご依頼も承ります。</strong></p>

          <section>
            <h2>月額プラン</h2>
            <table>
              <thead><tr><th>プラン</th><th>月額</th><th>含まれるもの</th></tr></thead>
              <tbody>
                <tr><td><strong>STANDARD 保守・運用</strong></td><td>月 ¥1〜10万</td><td>稼働監視・障害発生時の対応／テキスト・写真の更新代行／セキュリティ・依存関係の更新／月次レポート（アクセス解析・改善提案）／軽微な機能追加（プラン内）</td></tr>
                <tr><td><strong>サイト × AI サブスクリプション</strong></td><td>月 ¥2〜5万〜</td><td>サイト制作費を月額に分散（初期費用0円プランあり）／AI接客・自動応対を標準搭載／毎月の改善サイクル（データに基づく継続改善）／文章・バナーのAI生成サポート／買い取りへの移行はいつでも可能</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>1か月の運用で、起きること</h2>
            <ul>
              <li><strong>ALWAYS（常時）— 止まらない。</strong> 稼働監視・障害発生時の対応／セキュリティ・依存関係の更新</li>
              <li><strong>ON REQUEST（随時）— 頼めば、動く。</strong> テキスト・写真の更新代行／軽微な機能追加（プラン内）／文章・バナーのAI生成サポート</li>
              <li><strong>MONTHLY（毎月）— 数字で、次を決める。</strong> 月次レポート（アクセス解析・改善提案）／毎月の改善サイクル</li>
            </ul>
            <p>ご相談の際は、いまのサイトのURLだけお送りください。メール：<a href="mailto:info@core-ai.jp">info@core-ai.jp</a>。ご相談からお見積りのご提示までは無料です。</p>
          </section>`,
    footer: studioFooter,
  },
  {
    file: 'studio-works.html', theme: 'studio', url: `${STUDIO}/studio/works`,
    title: '制作実績 — 映像・ウェブ・システム 8件（すべて公開中） | CORE Studio',
    description: 'CORE Studio が制作し、実際に公開されている実績の一覧。映像はLaguna Beauté（商品広告）、株式会社CORE（ブランドフィルム）、ライブイベント告知、株式会社グローバルジョイントコミットメント、JRC 日本記録協会。ウェブ・システムはヘッドスパ「天国」、株式会社クロスオーバー、GAUCHEチェロ音楽教室、朝日館、RAD HOOKAH、ANIMA、SOMA、モデル個人サイト。',
    keywords: '制作実績,ホームページ制作 事例,動画制作 事例,ウェブ制作 実績,システム開発 実績,CORE Studio,神戸',
    og: `${STUDIO}/og-studio-v4.png`,
    ld: [
      { '@type': 'CollectionPage', '@id': `${STUDIO}/studio/works#page`, name: 'CORE Studio 制作実績', url: `${STUDIO}/studio/works`,
        isPartOf: { '@id': `${STUDIO}/#site` }, inLanguage: 'ja', dateModified: TODAY,
        about: { '@id': `${STUDIO}/#studio` } },
      sCrumb('works', '実績'),
    ],
    body: `
          <p class="k">WORKS</p>
          <h1>制作実績</h1>
          <p class="lead">いずれも CORE Studio（株式会社CORE）が制作し、<strong>実際に公開されているもの</strong>です。掲載は貴社の許可をいただいたもののみで、非公開のご希望があれば一切掲載しません。</p>

          <section>
            <h2>映像の制作実績</h2>
            <ul>
              <li><strong>Laguna Beauté（ラグナボーテ）</strong>／PRODUCT — 神戸のエイジングケアブランド様の商品広告。化粧水「LAGUNA DERMA WATER」の透明感と水の質感を軸に縦型1本に。</li>
              <li><strong>株式会社CORE（自社）</strong>／BRAND FILM — 社是「いつの時代も、変わらない核を。」を軸にした企業紹介映像。</li>
              <li><strong>ライブイベント主催者様</strong>／EVENT BRANDING — 開催前に当日の熱量を見せる告知映像。</li>
              <li><strong>株式会社グローバルジョイントコミットメント</strong>／BRAND FILM — 北海道旭川のヴィラ紹介映像。当事者目線のドラマ仕立て。</li>
              <li><strong>JRC 日本記録協会</strong>／<strong>GAUCHE（チェリスト）</strong></li>
            </ul>
          </section>

          <section>
            <h2>ウェブサイト・システムの制作実績</h2>
            <ul>
              <li><strong>ヘッドスパ「天国」</strong> — 1ページ構成（Spark 規模）</li>
              <li><strong>株式会社クロスオーバー</strong> — 企業サイト（Core 規模）</li>
              <li><strong>GAUCHE チェロ音楽教室</strong></li>
              <li><strong>朝日館</strong> — 予約・決済つき（Pro 規模）</li>
              <li><strong>RAD HOOKAH</strong> — ブランド統合（Signature 規模）</li>
              <li><strong>ANIMA</strong>／<strong>SOMA</strong> — アプリ</li>
              <li><strong>モデル個人サイト</strong></li>
            </ul>
            <p>同じ規模のものをご希望の場合は、いちばん近い実績をお知らせください。構成と金額をご提案します。メール：<a href="mailto:info@core-ai.jp">info@core-ai.jp</a></p>
          </section>`,
    footer: studioFooter,
  },
  {
    file: 'studio-about.html', theme: 'studio', url: `${STUDIO}/studio/about`,
    title: '会社案内 — 神戸の映像・ウェブ・システム制作会社 | CORE Studio（株式会社CORE）',
    description: 'CORE Studio は、兵庫県神戸市の株式会社CORE（設立2026年・代表取締役 井出直毅）が運営する制作スタジオです。企画から公開後の運用まで、代表が一貫して窓口を担当します。自社でAIプロダクトを8つ開発・運営していることが、受託専業の制作会社との違いです。',
    keywords: '制作会社 神戸,映像制作会社 兵庫,ウェブ制作会社 神戸,システム開発会社 神戸,株式会社CORE,会社概要,CORE Studio',
    og: `${STUDIO}/og-studio-v4.png`,
    ld: [
      { '@type': 'AboutPage', '@id': `${STUDIO}/studio/about#page`, name: 'CORE Studio 会社案内', url: `${STUDIO}/studio/about`,
        isPartOf: { '@id': `${STUDIO}/#site` }, about: { '@id': ORG }, inLanguage: 'ja', dateModified: TODAY },
      sCrumb('about', '会社案内'),
      faq(`${STUDIO}/studio/about`, [
        ['CORE Studio の運営会社はどこですか。', '兵庫県神戸市の株式会社CORE（CORE Inc.、設立2026年、代表取締役 井出直毅）です。本社は〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号です。'],
        ['担当者は途中で変わりますか。', '変わりません。ご相談から企画・構成、撮影・編集、公開後の運用まで、代表が一貫して窓口を担当します。最初にお聞きした意図が、そのまま最終形まで残ります。'],
        ['他の制作会社と何が違いますか。', '自社でAIプロダクトを8つ開発・運営している点です。日々自分たちの事業で検証を重ねた設計と技術を、そのまま貴社の案件に投入します。'],
        ['納品したら終わりですか。', '終わりません。公開から2週間後に、再生数や反応をご一緒に確認する時間をいただき、何が伝わり何が伝わらなかったかを整理します。'],
      ]),
    ],
    body: `
          <p class="k">WHO MAKES IT</p>
          <h1>企画から公開後の運用まで、ひとつの窓口で担当します。</h1>
          <p class="lead">株式会社COREは、神戸を拠点に、映像制作・Webサイト制作・システム開発を行う制作会社です。ご相談から企画・構成、撮影・編集、公開後の運用まで、<strong>代表が一貫して窓口を担当します</strong>。途中で担当者が変わらないため、最初にお聞きした意図が、そのまま最終形まで残ります。</p>

          <section>
            <h2>会社概要</h2>
            <dl>
              <dt>会社名</dt><dd>株式会社CORE（CORE Inc.）</dd>
              <dt>事業ブランド</dt><dd>CORE Studio（映像制作・ウェブ制作・受託開発・運用）</dd>
              <dt>設立</dt><dd>2026年</dd>
              <dt>資本金</dt><dd>200万円</dd>
              <dt>代表取締役</dt><dd>井出 直毅（Naoki Ide）</dd>
              <dt>本社所在地</dt><dd>〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号</dd>
              <dt>連絡先</dt><dd><a href="mailto:info@core-ai.jp">info@core-ai.jp</a></dd>
            </dl>
          </section>

          <section>
            <h2>納品で終わりにしない</h2>
            <p>制作は納品で終わりではありません。公開から2週間後に、再生数や反応をご一緒に確認する時間をいただき、何が伝わり、何が伝わらなかったかを整理します。その結果が、次の一手を決める材料になります。</p>
          </section>

          <section>
            <h2>選ばれる理由</h2>
            <ol>
              <li><strong>自社プロダクトを持つ制作会社です。</strong> 受託だけの会社と違い、当社はAIエージェントをはじめとする8つの自社サービスを開発・運営しています。</li>
              <li><strong>戦略から運用まで、一貫体制。</strong> 情報設計・デザイン・実装・公開後の改善までを一気通貫で担当します。</li>
              <li><strong>AI活用による速度と品質の両立。</strong> AI-nativeな制作フローにより、従来の制作会社の数分の一の期間で、妥協のない品質を実現します。</li>
            </ol>
            <p>AI変革・AI開発の事業については <a href="https://www.core-ai.jp/corp">株式会社CORE 公式サイト</a> をご覧ください。</p>
          </section>`,
    footer: studioFooter,
  },
  {
    file: 'studio-contact.html', theme: 'studio', url: `${STUDIO}/studio/contact`,
    title: 'お問い合わせ・お見積り — 相談は無料、1営業日以内に返信 | CORE Studio',
    description: '映像制作・ウェブサイト制作・システム受託開発・運用のご相談窓口。ご相談からお見積りのご提示までは無料で、1営業日以内にご返信します。NDAの締結・請求書払いにも対応。メールは info@core-ai.jp。神戸の株式会社CORE（CORE Studio）。',
    keywords: 'お問い合わせ,見積り 無料,制作依頼,NDA,請求書払い,CORE Studio,株式会社CORE',
    og: `${STUDIO}/og-studio-v4.png`,
    ld: [
      { '@type': 'ContactPage', '@id': `${STUDIO}/studio/contact#page`, name: 'CORE Studio お問い合わせ', url: `${STUDIO}/studio/contact`,
        isPartOf: { '@id': `${STUDIO}/#site` }, about: { '@id': `${STUDIO}/#studio` }, inLanguage: 'ja', dateModified: TODAY },
      sCrumb('contact', 'お問い合わせ'),
      faq(`${STUDIO}/studio/contact`, [
        ['相談や見積りは有料ですか。', '無料です。ご相談からお見積りのご提示までは費用をいただきません。'],
        ['どれくらいで返信がありますか。', '1営業日以内にご返信します。'],
        ['NDAの締結や請求書払いには対応していますか。', 'どちらも対応しています。'],
        ['まだ内容が固まっていなくても相談できますか。', 'できます。何を作るか決まっていない段階、要件が固まっていない段階からのご相談を承ります。'],
      ]),
    ],
    body: `
          <p class="k">CONTACT</p>
          <h1>まずは、いまの状況と目標をお聞かせください。</h1>
          <p class="lead">映像制作・ウェブサイト制作・システム受託開発・運用のご相談窓口です。<strong>ご相談からお見積りのご提示までは無料</strong>で、1営業日以内にご返信します。</p>

          <section>
            <h2>連絡先</h2>
            <dl>
              <dt>メール</dt><dd><a href="mailto:info@core-ai.jp">info@core-ai.jp</a></dd>
              <dt>運営</dt><dd>株式会社CORE（CORE Studio）／代表取締役 井出 直毅</dd>
              <dt>所在地</dt><dd>〒658-0025 兵庫県神戸市東灘区魚崎南町7丁目11番7号</dd>
              <dt>初回返信</dt><dd>1営業日以内</dd>
            </dl>
          </section>

          <section>
            <h2>お取引の条件</h2>
            <ul>
              <li>ご相談・お見積りのご提示までは無料</li>
              <li>お見積り時に金額を確定し、以後の追加費用はいただきません</li>
              <li>NDA（秘密保持契約）の締結に対応</li>
              <li>請求書払いに対応</li>
              <li>要件が固まっていない段階からのご相談も歓迎します</li>
            </ul>
            <p>料金の目安は <a href="/studio/film">映像制作</a>（¥49,800〜）、<a href="/studio/plans">サイト制作</a>（¥5万〜）、<a href="/studio/dev">受託開発</a>（¥50万〜）、<a href="/studio/care">運用</a>（月¥1万〜）をご覧ください。</p>
          </section>`,
    footer: studioFooter,
  },
);

// ──────────────────────────────── 書き出し ────────────────────────────────
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function render(page) {
  const t = THEMES[page.theme];
  const css = preCss(t.dark).replaceAll('${BG}', t.bg);
  const graph = [
    { '@type': 'WebPage', '@id': page.url + '#page', url: page.url, name: page.title,
      isPartOf: { '@id': (page.theme === 'corp' ? `${CORP}/#site` : `${STUDIO}/#site`) },
      inLanguage: 'ja', dateModified: TODAY, primaryImageOfPage: page.og,
      publisher: { '@id': ORG } },
    ...page.ld,
  ];
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <!-- ★このファイルは scripts/genRoutePages.mjs が作っています。直接編集しても次の build で消えます。 -->
    <link rel="icon" type="image/svg+xml" href="/core-icon-v2.svg" />
    <link rel="icon" type="image/png" sizes="192x192" href="/core-192-v2.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/core-512-v2.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/core-180-v2.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${t.bg}" />
    <style>html, body { margin: 0; background: ${t.bg}; }</style>
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="${t.appTitle}" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="mobile-web-app-capable" content="yes" />

    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${t.fonts}" />

    <!-- SEO -->
    <title>${esc(page.title)}</title>
    <meta name="description" content="${esc(page.description)}" />
    <meta name="keywords" content="${esc(page.keywords)}" />
    <meta name="author" content="CORE" />
    <link rel="canonical" href="${page.url}" />

    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${page.url}" />
    <meta property="og:title" content="${esc(page.title)}" />
    <meta property="og:description" content="${esc(page.description)}" />
    <meta property="og:locale" content="ja_JP" />
    <meta property="og:site_name" content="${t.site}" />
    <meta property="og:image" content="${page.og}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(page.title)}" />
    <meta name="twitter:description" content="${esc(page.description)}" />
    <meta name="twitter:image" content="${page.og}" />

    <!-- 構造化データ -->
    <script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 1)}
    </script>

    <!-- 静的コンテンツ層の体裁 -->
    <style>${css}
    </style>

    <!-- Google Analytics 4。測定IDは public/ga.js の GA_ID 1か所だけ -->
    <script defer src="/ga.js" data-ga-site="${t.gaSite}"></script>
  </head>
  <body>
    <div id="root">
      <!-- 静的コンテンツ層。JS を実行しないクローラー・AI検索向け。
           React の createRoot().render() が最初の描画で入れ替えるので、閲覧者には見えない。
           ★書いてある内容は React 側の表示と必ず一致させること（別内容を出すのは cloaking）。 -->
      <div id="pre">
        <main>${page.body}
        </main>
        <footer>
          ${page.footer}
        </footer>
      </div>
    </div>
    <script type="module" src="${t.entry}"></script>
  </body>
</html>
`;
}

let n = 0;
for (const page of PAGES) {
  writeFileSync(resolve(ROOT, page.file), render(page), 'utf8');
  n++;
}
console.log(`OK  ルート別の入口HTMLを ${n} 枚生成しました（scripts/genRoutePages.mjs）`);
