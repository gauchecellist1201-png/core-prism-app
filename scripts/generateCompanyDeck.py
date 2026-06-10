#!/usr/bin/env python3
# ============================================================
# 株式会社コア — 4事業 紹介＆営業資料 (1ファイル HTML デッキ)
# デザインシステム: ベース=オフホワイト70% / メイン=ディープネイビー25% / アクセント=テックブルー5%
# 各プロダクト 5枚 (章扉 / 課題 / 解決 / できること+効果 / 料金) で綿密に。
# 価格: 全4サービス 7日間無料トライアル (Resonance/Lume も Free廃止→7日トライアル)。
# 出力: ~/Desktop/CORE 営業資料/_html/CORE_会社紹介_営業資料.html
# ============================================================
import os

OUT = os.path.expanduser('~/Desktop/CORE 営業資料/_html/CORE_会社紹介_営業資料.html')

PRODUCTS = [
  dict(key='prism', name='Prism', role='全事業の司令塔・経営AI OS', acc='#4B57B0', tint='#EEF0FA',
    target='一人〜数十名の経営者・個人事業主・士業・スタートアップ',
    promise='経営の「自分でなくてもいい仕事」を、13名のAI役員に。',
    problems=[
      ('時間が、判断に使えない','社長の時間は組織で最も希少な資産。なのに議事録・提案書・契約レビュー・経理・日程調整など「作業」に奪われ、本来の意思決定や戦略に向き合えない。'),
      ('専門機能の外注は、高くつく','顧問弁護士・税理士・秘書・各種SaaSを別々に契約すると月数十万円。しかも窓口がバラバラで、管理コストと連携の手間が積み上がる。'),
      ('判断材料が、社内に散らばる','商談メモ・数字・契約・ナレッジが各ツールに分散。必要なときに探せず、意思決定が遅れ、機会を逃す。'),
    ],
    pain_stat=('月¥30万+','顧問・秘書・各種SaaSを個別契約した場合の概算コスト'),
    mechanism='Prism は、経営に必要な役割を 7つの専属AIエージェントに分解し、13名のAI役員が並走する「経営OS」です。話す・渡すだけで、議事録も提案も契約レビューも下書きまで仕上がる。あなたは確認して送り出すだけ。',
    steps=[('話す・渡す','音声・ファイル・画像を、そのまま投げる'),('AIが仕上げる','議事録・提案・契約レビューを下書きまで自動化'),('確認して送る','人は最終確認と意思表明だけ')],
    caps=[('七つの役割・七人の専属AI','経営・営業・財務・創造を、役割ごとに専門エージェントが担当'),
          ('商談から契約まで一気通貫','メール・議事録・提案・財務・契約レビューを一続きで'),
          ('ひとつの横断検索','散在する全文脈に、ひとことでアクセス'),
          ('朝晩の能動提案','「次にやるべきこと」をAIの方から差し出す')],
    diff='「AIツール」ではなく「AI役員」。自分で操作するのではなく、任せて確認する。',
    before=('複数SaaS＋外注で月数十万円。判断材料は手作業で集め、意思決定は後手に。'),
    after=('ひとつのOSで月¥4,800〜。下調べと作業はAIが終わらせ、社長は判断に集中。'),
    metric=('1/7','コンサル・秘書・各種SaaSを置換した時の実質コスト'),
    plans=[('7日間無料','¥0','7日間','全機能を7日間おためし・カード登録不要',False),
           ('Starter','¥4,800','/月','基本AI機能・1人格1ユーザー・ナレッジ100件',False),
           ('Standard','¥9,800','/月','全AI（商談AI含む）・人格無制限・音声秘書',True),
           ('Exclusive','¥29,800','/月','専任CS・優先サポート・カスタム連携・導入伴走',False)],
    url='core-prism-app.vercel.app'),

  dict(key='iris', name='Iris', role='Instagram 運用 AI', acc='#A8497B', tint='#F8EEF3',
    target='インフルエンサー・クリエイター・SNS運用担当者',
    promise='「いいね」を「案件」に変える、6人のAIチーム。',
    problems=[
      ('運用が、一人に集中する','投稿制作・分析・案件管理・DM返信・交渉。クリエイターはこの6業務を全部一人で抱え、肝心の創作時間が削られる。'),
      ('フォロワー ≠ 収益','フォロワーは増えても案件や売上につながらない。「数字」と「稼ぎ」の間に大きな溝があり、努力が報われない。'),
      ('分析ツールが、答えをくれない','既存ツールは数字を見せるだけ。「次に何を投稿すべきか」までは教えてくれず、結局は勘と経験頼り。'),
    ],
    pain_stat=('6つの仕事','投稿・分析・案件・DM・交渉・美容相談を、一人で'),
    mechanism='Iris は、Instagram運用の6業務をひとつのAIアプリに束ねます。投稿AIが構成〜キャプション〜ハッシュタグを下書きし、解析が数字を踏まえて次の一手を提案。案件はスクショ3秒で入力、交渉文もAIが生成します。',
    steps=[('ネタを渡す','スクショ・写真・思いつきを、そのまま'),('AIが下書き','投稿も返信も戦略も、AIが先に書く'),('確認して投稿','整えて、投稿・送信するだけ')],
    caps=[('投稿AI','構成・テロップ・キャプション・ハッシュタグを丸ごと下書き'),
          ('Instagram解析 → 次の一手','数字を見せるだけで終わらせず、打ち手まで提案'),
          ('案件管理 3秒入力','スクショを渡せば、AIが案件情報を自動入力'),
          ('交渉文AI','返信・断り・カウンターオファーをAIが生成')],
    diff='数字を見せるだけの分析ツールと違い、Iris は「次の一手」まで決める。',
    before=('投稿も分析も案件も手作業。フォロワーは増えても、稼ぎにつながらない。'),
    after=('6人のAIチームが運用を担い、「いいね」を「案件」に。創作に集中できる。'),
    metric=('6→1','六つの仕事を、ひとつのアプリに'),
    plans=[('7日間無料','¥0','7日間','全機能を7日間おためし・カード登録不要',False),
           ('Lite','¥2,980','/月','AI相談50回/月・案件管理無制限・キャプション月30',False),
           ('Standard','¥6,980','/月','リール自動生成・AI相談/解析ほぼ無制限・Instagram解析',True),
           ('Pro','¥12,800','/月','連携アカウント5・ブランドマッチ・運用代行',False)],
    url='core-prism-app.vercel.app/iris'),

  dict(key='resonance', name='Resonance', role='LINE 個別配信 SaaS', acc='#2E8B6F', tint='#EAF4F0',
    target='店舗・サロン・教室・アーティスト（LINE公式アカウント運用者）',
    promise='一斉配信なのに、一人ひとりに。再来店を、AIが育てる。',
    problems=[
      ('一斉配信は、刺さらない','全員に同じ文面のLINEは「自分ごと」にならず、開封されないどころかブロック・離脱を招く。'),
      ('再来店が、育たない','店舗・サロン・教室の生命線は新規より再来店（LTV）。しかし一度きりの来店で関係が途切れてしまう。'),
      ('個別対応は、続かない','一人ひとりに合わせた連絡は手間が大きく、忙しい現場では現実的に続けられない。'),
    ],
    pain_stat=('再来店 = 生命線','新規獲得コストの数倍の価値を持つ、店舗のLTV'),
    mechanism='Resonance は、名簿の一人ひとりにAIが文面を書き分け、LINEで手紙のように届ける個別配信SaaS。送信前に全件を確認できる承認制で、既存のLINE公式アカウントにそのまま接続。BYOK（自分の鍵）でAI原価はほぼ0です。',
    steps=[('LINEをつなぐ','お持ちのLINE公式アカウントを接続'),('AIが書き分け','名簿ごとに、最適な文面を下書き'),('全件確認して送る','一人ひとりに、手紙のように届く')],
    caps=[('個別文面AI','一人ひとりに、その人のための言葉を書き分ける'),
          ('承認制で、安心','送る前に必ず全件を確認。AIが勝手に送らない'),
          ('LINE公式に接続','お持ちのアカウントに、そのまま。新規移行不要'),
          ('AIレター','会話履歴を読み、一人ずつ個別の下書きを用意')],
    diff='セグメント配信（全員同じ文）と違い、一人ひとり別文面＋送信前の全件確認。',
    before=('全員に同じお知らせ。開封されず、ブロックされ、関係が切れていく。'),
    after=('一人ひとりに別の手紙。「また会いたい」が育ち、再来店とLTVが伸びる。'),
    metric=('LTV ↑','再来店を育て、顧客生涯価値を伸ばす'),
    plans=[('7日間無料','¥0','7日間','全機能を7日間おためし・カード登録不要',False),
           ('Solo','¥1,980','/月','AI個別配信・1アカウント・月2,000通',False),
           ('Pro','¥4,980','/月','AIレター・1アカウント・月8,000通・全件確認',True),
           ('Business','¥9,800','/月','3アカウント・月30,000通・設定代行',False)],
    url='resonancebot-ivory.vercel.app'),

  dict(key='lume', name='Lume', role='リンクハブ＋クリック解析', acc='#FFA42A', tint='#FFF3E0',
    target='クリエイター・店舗・あらゆる発信者（プロフィールリンク運用者）',
    promise='散らばるリンクを、ひとつに。そして「測れる資産」に。',
    problems=[
      ('プロフィールは、一行だけ','SNSのプロフィールに置けるリンクは基本ひとつ。複数の発信先へ誘導できず、機会を逃している。'),
      ('効果が、見えない','リンクを並べても「誰が・どこから・何を踏んだか」が分からず、施策の良し悪しを判断できない。'),
      ('導線が、バラバラ','各SNS・予約・販売の導線が分断され、どの発信が成果を生んだのか追えない。'),
    ],
    pain_stat=('見えない導線','誰が・どこから・何を踏んだか分からないまま'),
    mechanism='Lume は、全リンクを美しいプロフィールに30秒で集約し、クリックをヒートマップ・流入元・時間帯で可視化するリンクハブ。導線を「ただの入口」から「測れる資産」へと変えます。',
    steps=[('リンクを並べる','すべてのリンクをひとつに集約'),('美しく仕上がる','5つのテーマで、プロフィール完成'),('色で、分かる','誰がどこを踏んだかを熱で可視化')],
    caps=[('30秒で、美しく集約','全リンクをひとつのプロフィールに。5つのテーマ'),
          ('クリックヒートマップ','押された比率を、色と熱で可視化'),
          ('流入元クロス分析','どこから来て、何を踏んだかが分かる'),
          ('時間帯・傾向','踏まれる時間帯まで、ひと目で見える')],
    diff='ただ並べるだけのリンクまとめと違い、Lume はクリックを熱で可視化する。',
    before=('リンクは散在し、効果は不明。どの発信が成果を生んだのか追えない。'),
    after=('ひとつに集約し、クリックを可視化。導線が「測れる資産」になる。'),
    metric=('見える化','リンクを「ただの入口」から「測れる資産」へ'),
    plans=[('7日間無料','¥0','7日間','全機能を7日間おためし・カード登録不要',False),
           ('Pro','¥1,480','/月','ヒートマップ・流入元クロス分析・時間帯の可視化',True),
           ('Business','¥3,480','/月','Pro全機能・複数プロフィール管理',False)],
    url='lume-deploy-five.vercel.app'),
]

CSS = """
:root{
  --ink:#0F1B33; --ink-2:#5A6478; --ink-3:#8A93A6;
  --paper:#FFFFFF; --hair:#E5E9F1;
  --accent:#2B54E6; --accent-ink:#1C3DB0; --accent-soft:#EEF2FE;
  --warn:#B0544F; --warn-soft:#F8F0EF;
  --sans:"Inter","Noto Sans JP",-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN",sans-serif;
  --shadow:0 30px 80px -30px rgba(15,27,51,.30), 0 4px 14px -8px rgba(15,27,51,.14);
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#D9DEE8;font-family:var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  padding:30px 0;display:flex;flex-direction:column;align-items:center;gap:26px}
.slide{position:relative;width:1280px;height:720px;flex:none;background:linear-gradient(180deg,#FFFFFF,#FAFBFD);
  border:1px solid var(--hair);border-radius:16px;overflow:hidden;box-shadow:var(--shadow);
  padding:48px 64px 42px;display:flex;flex-direction:column}
.slide.dark{background:radial-gradient(120% 130% at 50% -20%,#1B2A4A 0%,#0F1B33 60%);border-color:#1d2c4d;color:#fff}
.chrome{display:flex;align-items:center;justify-content:space-between;padding-bottom:14px;border-bottom:1px solid var(--hair)}
.dark .chrome{border-color:rgba(255,255,255,.12)}
.brand{display:flex;align-items:center;gap:11px}
.brand .wm{font-weight:700;letter-spacing:.32em;font-size:15px;color:var(--ink);padding-left:.1em}
.dark .brand .wm{color:#fff}.brand svg{width:26px;height:26px}
.sec{font-family:"Inter";font-size:10.5px;letter-spacing:.2em;color:var(--ink-3);font-weight:600;text-transform:uppercase}
.dark .sec{color:#9fb0d6}
.foot{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:12px;
  border-top:1px solid var(--hair);font-family:"Inter";font-size:10.5px;letter-spacing:.05em;color:var(--ink-3)}
.dark .foot{border-color:rgba(255,255,255,.12);color:#8aa0cf}
.foot .pg{font-weight:700;color:var(--ink)} .dark .foot .pg{color:#fff}
.conf{display:inline-flex;align-items:center;gap:7px}.conf i{width:6px;height:6px;border-radius:50%;background:var(--accent)}
.eyebrow{display:inline-flex;align-items:center;gap:10px;font-family:"Inter";font-size:11.5px;font-weight:700;
  letter-spacing:.18em;text-transform:uppercase;color:var(--accent-ink);margin-bottom:14px}
.eyebrow .tick{width:20px;height:1.5px;background:currentColor;opacity:.8}
.h1{font-size:60px;line-height:1.12;letter-spacing:-.02em;font-weight:800;color:var(--ink)}
.h2{font-size:34px;line-height:1.22;letter-spacing:-.01em;font-weight:800;color:var(--ink)}
.dark .h1,.dark .h2{color:#fff} .em{color:var(--accent)}
.lead{font-size:15.5px;line-height:1.8;color:var(--ink-2);font-weight:400;max-width:780px}
.dark .lead{color:#c7d2ea}
.body{flex:1;display:flex;flex-direction:column;justify-content:center}
.center{align-items:center;text-align:center}
.target{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--ink-2);
  background:#F2F4F9;border:1px solid var(--hair);border-radius:30px;padding:6px 14px;margin-bottom:14px}
.target b{color:var(--ink);font-weight:700}
.grid{display:grid;gap:14px;margin-top:20px}
.g3{grid-template-columns:repeat(3,1fr)} .g4{grid-template-columns:repeat(4,1fr)} .g2{grid-template-columns:1fr 1fr}
.card{background:var(--paper);border:1px solid var(--hair);border-radius:13px;padding:20px}
.card .ic{width:30px;height:30px;border-radius:8px;background:var(--accent-soft);color:var(--accent-ink);
  display:flex;align-items:center;justify-content:center;font-family:"Inter";font-weight:700;font-size:13px;margin-bottom:12px}
.card h4{font-size:16px;font-weight:700;color:var(--ink);margin-bottom:7px;line-height:1.4}
.card p{font-size:12.5px;line-height:1.65;color:var(--ink-2)}
.pain{background:var(--warn-soft);border:1px solid #EEDDDB;border-radius:13px;padding:20px}
.pain .tag{display:inline-block;font-family:"Inter";font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--warn);
  background:#fff;border:1px solid #EAD3D1;border-radius:20px;padding:3px 9px;margin-bottom:11px}
.pain h4{font-size:15.5px;font-weight:700;color:#3A2A29;margin-bottom:7px;line-height:1.4}
.pain p{font-size:12px;line-height:1.65;color:#6E5A58}
.divider .num{font-family:"Inter";font-size:150px;font-weight:800;color:var(--hair);line-height:.9;letter-spacing:-.04em}
.divider .pname{font-size:54px;font-weight:800;color:var(--ink);letter-spacing:-.01em;margin-top:4px}
.divider .prole{font-size:16px;color:var(--ink-2);margin-top:10px;font-weight:500}
.divider .promise{font-size:18px;color:var(--ink);font-weight:600;margin-top:20px;max-width:680px;line-height:1.6}
.acc-bar{width:54px;height:4px;border-radius:3px;margin:20px 0 0}
.stat{display:flex;align-items:baseline;gap:16px;margin-top:4px}
.stat .big{font-family:"Inter";font-size:60px;font-weight:800;letter-spacing:-.02em;line-height:1}
.stat .lbl{font-size:13.5px;color:var(--ink-2);line-height:1.55;max-width:420px}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:8px}
.step{position:relative;padding:0 18px}
.step:not(:last-child)::after{content:"";position:absolute;top:16px;right:-2px;width:13px;height:13px;
  border-top:2px solid var(--hair);border-right:2px solid var(--hair);transform:rotate(45deg)}
.step .n{width:36px;height:36px;border-radius:50%;background:var(--accent-soft);color:var(--accent-ink);
  display:flex;align-items:center;justify-content:center;font-family:"Inter";font-weight:700;font-size:14px;margin-bottom:12px}
.step h4{font-size:15.5px;font-weight:700;color:var(--ink);margin-bottom:6px} .step p{font-size:12px;line-height:1.6;color:var(--ink-2)}
.ba{display:grid;grid-template-columns:1fr auto 1fr;gap:18px;align-items:center;margin-top:20px}
.ba .box{border-radius:13px;padding:16px 18px} .ba .b-before{background:var(--warn-soft);border:1px solid #EEDDDB}
.ba .b-after{background:var(--accent-soft);border:1px solid #D6E0FB}
.ba .lab{font-family:"Inter";font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px}
.ba .b-before .lab{color:var(--warn)} .ba .b-after .lab{color:var(--accent-ink)}
.ba .box p{font-size:12.5px;line-height:1.6;color:var(--ink)} .ba .arrow{font-size:26px;color:var(--ink-3)}
.ptable{width:100%;border-collapse:separate;border-spacing:0;margin-top:14px;border:1px solid var(--hair);border-radius:13px;overflow:hidden}
.ptable th,.ptable td{text-align:left;padding:12px 18px;border-bottom:1px solid var(--hair);vertical-align:middle}
.ptable thead th{font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--ink-3);background:#FAFBFD;text-transform:uppercase}
.ptable tbody tr:last-child td{border-bottom:none}
.ptable .pn{font-size:15px;font-weight:700;color:var(--ink)}
.ptable .pr{font-family:"Inter";font-size:17px;font-weight:700;color:var(--ink);white-space:nowrap}
.ptable .pr small{font-size:11px;color:var(--ink-3);font-weight:600;margin-left:4px}
.ptable .ft{font-size:12px;color:var(--ink-2);line-height:1.45}
.ptable tr.hot td{background:var(--accent-soft)} .ptable tr.hot .pr{color:var(--accent-ink)}
.hotbadge{display:inline-block;font-size:9.5px;font-weight:700;color:#fff;background:var(--accent);border-radius:20px;padding:2px 8px;margin-left:8px;letter-spacing:.06em;vertical-align:middle}
.pnote{margin-top:13px;font-size:13px;font-weight:600;color:var(--accent-ink)}
.hub{position:relative;height:360px;margin-top:6px}
.node{position:absolute;background:var(--paper);border:1px solid var(--hair);border-radius:13px;padding:14px 18px;
  box-shadow:0 12px 26px -18px rgba(15,27,51,.4);text-align:center;width:200px}
.node .nm{font-size:18px;font-weight:700;color:var(--ink)} .node .rl{font-size:11.5px;color:var(--ink-2);margin-top:3px}
.node.core{border-color:#C9D4F6;box-shadow:0 16px 34px -16px rgba(43,84,230,.5)}
.node.core::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;border-radius:13px 13px 0 0;background:var(--accent)}
.eco-row{margin-top:28px;display:grid;grid-template-columns:repeat(4,1fr);gap:13px}
.cta-mail{font-family:"Inter";font-size:18px;font-weight:600;color:#fff;background:var(--accent);display:inline-block;padding:14px 30px;border-radius:12px;margin-top:8px}
.agenda{display:grid;grid-template-columns:1fr 1fr;gap:12px 40px;margin-top:22px;max-width:920px}
.ag{display:flex;gap:16px;align-items:flex-start;padding:13px 0;border-bottom:1px solid var(--hair)}
.ag .no{font-family:"Inter";font-size:13px;font-weight:700;color:var(--accent);min-width:28px}
.ag .tt{font-size:15px;font-weight:600;color:var(--ink)} .ag .ds{font-size:12px;color:var(--ink-2);margin-top:3px}
@media print{ @page{size:1280px 720px;margin:0} body{background:#fff;padding:0;gap:0;display:block}
  .slide{box-shadow:none;border:none;border-radius:0;page-break-after:always;break-after:page} }
"""

MARK = ('<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="#0F1B33" stroke-width="1.6"/>'
        '<circle cx="16" cy="16" r="5" fill="none" stroke="#2B54E6" stroke-width="1.6"/><circle cx="16" cy="16" r="1.6" fill="#2B54E6"/></svg>')
MARK_W = MARK.replace('#0F1B33', '#FFFFFF')
PAGE = 0
def chrome(sec, dark): return f'<header class="chrome"><div class="brand">{MARK_W if dark else MARK}<span class="wm">CORE</span></div><div class="sec">{sec}</div></header>'
def foot():
    global PAGE; PAGE += 1
    return f'<footer class="foot"><span class="conf"><i></i>株式会社コア — CORE Inc.　/　Confidential</span><span class="pg">{PAGE:02d}</span><span>2026.06</span></footer>'
def slide(inner, sec, dark=False): return f'<section class="slide {"dark" if dark else ""}">{chrome(sec,dark)}{inner}{foot()}</section>'
def ptable(plans):
    rows=''
    for nm,pr,per,ft,hot in plans:
        per_s=f'<small>{per}</small>' if per else ''
        badge='<span class="hotbadge">人気</span>' if hot else ''
        rows+=f'<tr class="{"hot" if hot else ""}"><td class="pn">{nm}{badge}</td><td class="pr">{pr}{per_s}</td><td class="ft">{ft}</td></tr>'
    return f'<table class="ptable"><thead><tr><th style="width:22%">プラン</th><th style="width:20%">月額</th><th>主なできること</th></tr></thead><tbody>{rows}</tbody></table>'

SL=[]
# 1 COVER
SL.append(slide(
 '<div class="body"><span class="eyebrow"><span class="tick"></span>Company Overview — 4 Services, One Ecosystem</span>'
 '<div class="h1">仕事も、SNSも、<br><span class="em">ひとつのAI</span>に。</div>'
 '<p class="lead" style="margin-top:20px">株式会社コアは、4つの専門サービスが<b style="color:#fff">ひとつの頭脳でつながる</b> AIエージェント・エコシステム。'
 '経営の司令塔 Prism に、Instagramの Iris・LINEの Resonance・リンクの Lume が連携し、あなたの事業を一気通貫で動かします。</p>'
 '<div class="eco-row">'+''.join(
   f'<div class="card" style="border-color:#33406b;background:rgba(255,255,255,.05)"><div style="font-family:Inter;font-size:11px;font-weight:700;color:#9fb0ff;letter-spacing:.1em">0{i+1}</div>'
   f'<div style="font-size:19px;font-weight:700;color:#fff;margin-top:8px">{n}</div><div style="font-size:12px;color:#aab8da;margin-top:4px">{r}</div></div>'
   for i,(n,r) in enumerate([('Prism','全事業の司令塔'),('Iris','Instagram 運用'),('Resonance','LINE 個別配信'),('Lume','リンク・解析')]))+
 '</div></div>','AI Agent Ecosystem · 2026',dark=True))
# 2 AGENDA
ag=[('01','本日の結論','4つの専門 × ひとつの頭脳で、事業を一気通貫に'),('02','市場と課題','個人・中小が抱える「分断」と「時間の枯渇」'),
    ('03','エコシステム全体像','司令塔Prism＋3つのSNSチャネル'),('04','Prism','経営の司令塔 — 課題・解決・効果・料金'),
    ('05','Iris','Instagram運用 — 課題・解決・効果・料金'),('06','Resonance','LINE個別配信 — 課題・解決・効果・料金'),
    ('07','Lume','リンク・解析 — 課題・解決・効果・料金'),('08','シナジー・料金・次の一歩','一気通貫の流れ／全製品の料金一覧')]
SL.append(slide('<div class="body"><span class="eyebrow"><span class="tick"></span>Agenda</span><div class="h2">本日のご提案</div>'
 '<div class="agenda">'+''.join(f'<div class="ag"><span class="no">{n}</span><div><div class="tt">{t}</div><div class="ds">{d}</div></div></div>' for n,t,d in ag)+'</div></div>','Agenda'))
# 3 BIG IDEA
SL.append(slide('<div class="body center"><span class="eyebrow" style="justify-content:center"><span class="tick"></span>The Big Idea</span>'
 '<div class="h1" style="max-width:1000px">バラバラの道具では、ない。<br><span class="em">ひとつのエコシステム</span>です。</div>'
 '<p class="lead" style="margin:22px auto 0;text-align:center">Coreが提供するのは、単体ツールの寄せ集めではありません。経営判断・Instagram・LINE・リンクの4領域を、'
 '<b>ひとつの核（データと顧客）でつなぐ</b>AIエージェント・エコシステム。だから、使うほど一気通貫で強くなります。</p></div>','The Big Idea'))
# 4 COMPANY PROBLEM
SL.append(slide('<div class="body"><span class="eyebrow"><span class="tick" style="background:#B0544F"></span><span style="color:#B0544F">The Problem</span></span>'
 '<div class="h2">いま、個人・中小はこの「分断」に苦しんでいる。</div>'
 '<p class="lead" style="margin-top:12px">本業の傍ら、営業も経理もSNS集客も顧客対応も一人で。ツールは増える一方で互いに連携せず、時間と判断力が枯渇していく。'
 '「AIが大事」とは聞くが、結局使いこなせない——。</p>'
 '<div class="grid g3">'+''.join(f'<div class="pain"><span class="tag">課題</span><h4>{t}</h4><p>{d}</p></div>' for t,d in [
   ('時間が、奪われ続ける','「自分でなくてもいい作業」に追われ、本来の意思決定や創作に向き合えない。'),
   ('ツールが、つながらない','SNS・配信・分析・経理がバラバラ。データも顧客情報も分断され、成果が追えない。'),
   ('AIが、武器にならない','話題のAIも単体では「結局自分で操作」。現場の成果まで踏み込めない。')])+'</div></div>','Market & Problem'))
# 5 ECOSYSTEM
SL.append(slide('<div class="body"><span class="eyebrow"><span class="tick"></span>The Solution — Ecosystem</span>'
 '<div class="h2">司令塔 Prism に、3つのSNSがつながる。</div>'
 '<div class="hub">'
 '<div class="node core" style="left:50%;top:6px;transform:translateX(-50%)"><div class="nm">Prism</div><div class="rl">全事業の司令塔・13 AI役員</div></div>'
 '<div class="node" style="left:6%;bottom:6px"><div class="nm">Iris</div><div class="rl">Instagram 運用</div></div>'
 '<div class="node" style="left:50%;bottom:6px;transform:translateX(-50%)"><div class="nm">Resonance</div><div class="rl">LINE 個別配信</div></div>'
 '<div class="node" style="right:6%;bottom:6px"><div class="nm">Lume</div><div class="rl">リンク・解析</div></div>'
 '<svg style="position:absolute;inset:0;width:100%;height:100%;z-index:-1"><line x1="50%" y1="58" x2="16%" y2="312" stroke="#D4DAEA" stroke-width="1.5" stroke-dasharray="3 4"/>'
 '<line x1="50%" y1="58" x2="50%" y2="312" stroke="#D4DAEA" stroke-width="1.5" stroke-dasharray="3 4"/>'
 '<line x1="50%" y1="58" x2="84%" y2="312" stroke="#D4DAEA" stroke-width="1.5" stroke-dasharray="3 4"/></svg></div>'
 '<p class="lead" style="text-align:center;margin:4px auto 0">Instagram・LINE・リンクが集めたお客様の動きは、すべて司令塔 Prism に流れ込み、13名のAIエージェントが「次の一手」まで動かします。</p></div>','The Solution — Ecosystem'))

# ── PRODUCT SECTIONS (5 slides each) ──
SECN={'prism':'04 / Prism','iris':'05 / Iris','resonance':'06 / Resonance','lume':'07 / Lume'}
for idx,p in enumerate(PRODUCTS):
    n=idx+1; sec=SECN[p['key']]; acc=p['acc']; tint=p['tint']
    # (a) divider
    SL.append(slide(f'<div class="body divider"><div class="num">0{n}</div><div class="pname">{p["name"]}</div>'
      f'<div class="prole">{p["role"]}</div><div class="acc-bar" style="background:{acc}"></div>'
      f'<div class="promise">{p["promise"]}</div></div>',sec))
    # (b) 課題
    SL.append(slide('<div class="body"><span class="eyebrow"><span class="tick" style="background:#B0544F"></span><span style="color:#B0544F">課題 — The Problem</span></span>'
      f'<div class="target">対象　<b>{p["target"]}</b></div>'
      f'<div class="h2">{p["name"]} が解く、3つの課題。</div>'
      '<div class="grid g3">'+''.join(f'<div class="pain"><span class="tag">課題 0{i+1}</span><h4>{t}</h4><p>{d}</p></div>' for i,(t,d) in enumerate(p["problems"]))+'</div>'
      f'<div class="stat" style="margin-top:22px"><span class="big" style="color:#B0544F;font-size:46px">{p["pain_stat"][0]}</span><span class="lbl">{p["pain_stat"][1]}</span></div></div>',sec))
    # (c) 解決 (mechanism + steps)
    SL.append(slide('<div class="body"><span class="eyebrow" style="color:'+acc+'"><span class="tick" style="background:'+acc+'"></span>解決 — Our Solution</span>'
      f'<div class="h2">{p["promise"]}</div>'
      f'<p class="lead" style="margin-top:12px">{p["mechanism"]}</p>'
      '<div class="steps" style="margin-top:24px">'+''.join(
        f'<div class="step"><div class="n" style="background:{tint};color:{acc}">0{i+1}</div><h4>{t}</h4><p>{d}</p></div>'
        for i,(t,d) in enumerate(p["steps"]))+'</div></div>',sec))
    # (d) できること + 効果(before/after + metric)
    SL.append(slide('<div class="body"><span class="eyebrow" style="color:'+acc+'"><span class="tick" style="background:'+acc+'"></span>できること & 効果</span>'
      f'<div class="h2">{p["name"]} で、できること。</div>'
      '<div class="grid g4" style="margin-top:16px">'+''.join(
        f'<div class="card"><div class="ic" style="background:{tint};color:{acc}">0{i+1}</div><h4>{t}</h4><p>{d}</p></div>'
        for i,(t,d) in enumerate(p["caps"]))+'</div>'
      '<div class="ba"><div class="box b-before"><div class="lab">Before</div><p>'+p["before"]+'</p></div>'
      '<div class="arrow">→</div><div class="box b-after" style="border-color:'+acc+'44;background:'+tint+'"><div class="lab" style="color:'+acc+'">After</div><p>'+p["after"]+'</p></div></div></div>',sec))
    # (e) 料金
    SL.append(slide('<div class="body"><span class="eyebrow" style="color:'+acc+'"><span class="tick" style="background:'+acc+'"></span>料金 — Pricing</span>'
      f'<div class="h2">{p["name"]} の料金プラン</div>'+ptable(p["plans"])+
      '<div class="pnote" style="color:'+acc+'">全プラン 7日間無料・クレジットカード登録不要'
      +('（BYOKでAI原価ほぼ0）' if p["key"]=="resonance" else '')+'　／　'+p["url"]+'</div></div>',sec))

# 8 SYNERGY
SL.append(slide('<div class="body"><span class="eyebrow"><span class="tick"></span>Synergy — One Flow</span>'
 '<div class="h2">つながると、何が変わるか。</div>'
 '<div class="steps" style="grid-template-columns:repeat(4,1fr);margin-top:24px">'
 '<div class="step"><div class="n">01</div><h4>Lume</h4><p>ファンが、どのリンクを踏んだかが分かる。</p></div>'
 '<div class="step"><div class="n">02</div><h4>Iris</h4><p>その人のInstagramの反応を、AIが解析する。</p></div>'
 '<div class="step"><div class="n">03</div><h4>Resonance</h4><p>いま響く一文を、LINEでその人だけに届ける。</p></div>'
 '<div class="step" style="padding-right:0"><div class="n">04</div><h4>Prism</h4><p>すべてを記録し、13名のAI役員が次の一手を出す。</p></div></div>'
 '<p class="lead" style="text-align:center;margin:30px auto 0">機能の足し算ではなく、掛け合わせて、ひとつの知性へ。'
 '<b style="color:var(--ink)">あなたは、最後に確認するだけ。</b></p></div>','Synergy'))
# 9 PRICING ALL
SUMMARY=[('Prism','全事業の司令塔','¥4,800〜','¥29,800','#4B57B0'),('Iris','Instagram 運用','¥2,980〜','¥12,800','#A8497B'),
         ('Resonance','LINE 個別配信','¥1,980〜','¥9,800','#2E8B6F'),('Lume','リンク・解析','¥1,480〜','¥3,480','#FFA42A')]
allrows=''.join(f'<tr><td class="pn"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:{a};margin-right:9px;vertical-align:middle"></span>{nm}</td>'
  f'<td class="ft">{r}</td><td class="ft">7日間無料（その後課金）</td><td class="pr">{e}</td><td class="pr">{t}</td></tr>' for nm,r,e,t,a in SUMMARY)
SL.append(slide('<div class="body"><span class="eyebrow"><span class="tick"></span>Pricing — All Services</span><div class="h2">4サービスの料金一覧</div>'
 '<table class="ptable" style="margin-top:14px"><thead><tr><th style="width:20%">サービス</th><th style="width:22%">役割</th>'
 '<th>無料</th><th>有料の入口</th><th>最上位</th></tr></thead><tbody>'+allrows+'</tbody></table>'
 '<div class="pnote">全4サービス共通：7日間無料トライアル・クレジットカード登録不要（8日目以降に課金）。'
 'Prism / Iris は年額（月額×10＝約17%off）も選択可。</div></div>','Pricing'))
# 10 CREED
SL.append(slide('<div class="body"><span class="eyebrow"><span class="tick"></span>Our Creed</span><div class="h2">わたしたちが守る、3つの約束。</div>'
 '<div class="grid g3">'+''.join(f'<div class="card"><div class="ic">0{i+1}</div><h4>{t}</h4><p>{d}</p></div>' for i,(t,d) in enumerate([
   ('偽りの数字は、載せない','まだ実績がないものには「—」と記す。架空・水増しの数字は最大の不誠実だと考えます。'),
   ('やさしい言葉で、語る','専門用語や横文字は、できるかぎり日常の言葉に。すべての人のために。'),
   ('使ったぶんだけ、いただく','上限を設け、超えた分は買い足し方式。気づかぬうちに高額にならない料金設計。')]))+'</div></div>','Our Creed'))
# 11 CTA
SL.append(slide('<div class="body center"><span class="eyebrow" style="justify-content:center"><span class="tick"></span>Next Step</span>'
 '<div class="h1">まずは、7日間 無料で。</div>'
 '<p class="lead" style="margin:20px auto 6px;text-align:center">4サービスすべてに7日間の無料トライアルをご用意。クレジットカード登録は不要です。'
 'まずは触れてから、ご判断ください。</p><div class="cta-mail">hello@core-inc.jp</div>'
 '<p style="font-family:Inter;font-size:13px;color:#aab8da;margin-top:18px">core-prism-app.vercel.app　·　/iris　·　resonancebot-ivory.vercel.app　·　lume-deploy-five.vercel.app</p></div>','Next Step',dark=True))

doc=('<!doctype html><html lang="ja"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>'
 '<title>株式会社コア — 4事業 紹介＆営業資料</title><link rel="preconnect" href="https://fonts.googleapis.com"/>'
 '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap"/>'
 f'<style>{CSS}</style></head><body>'+''.join(SL)+'</body></html>')
os.makedirs(os.path.dirname(OUT),exist_ok=True); open(OUT,'w').write(doc)
print('wrote',OUT); print('slides:',len(SL))
