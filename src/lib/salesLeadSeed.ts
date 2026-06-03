// ============================================================
// salesLeadSeed — 業界別 サンプル営業先リスト 6 セット (~115 件)
//
// オーナー指示 (2026-06-03 自律): T. 営業先リスト 1 タップ取込
//
// 使い方:
//   import { SAMPLE_LEAD_INDUSTRIES, addLeadsToCrm } from '../lib/salesLeadSeed';
//   addLeadsToCrm(personaId, 'sme'); // SME 25 件を CRM の lead として追加
//
// 設計:
//   - 全件 stage='lead' (リード = 最初の段階)
//   - 想定金額 = 推奨プランの年額 (BtoB スタンダードなら ¥360,000)
//   - source='sample' (フィルタしやすく)
//   - id prefix 'sample-' で識別、削除も楽に
// ============================================================
import type { CRMDeal } from '../types/crm';

export type LeadIndustry = 'sme' | 'realestate-finance' | 'consulting' | 'solo' | 'creator' | 'freelance-pro';

interface LeadSeed {
  title: string;        // 案件タイトル (例: 「製造業 — 工務店 2 代目社長」)
  contactName: string;  // 担当者名 (架空のペルソナ)
  company?: string;     // 会社名 (架空 or 業種)
  notes: string;        // メモ
  source: string;       // 接触経路
}

const SME_LEADS: LeadSeed[] = [
  { title: '工務店 2 代目社長 (12 名)', contactName: '田中健太', company: '◯◯工務店', notes: '図面/見積で残業, 父越え目指す', source: '工務店経営者 FB グループ' },
  { title: '金属加工 中小社長 (25 名)', contactName: '佐藤剛', company: '◯◯精機', notes: '新人提案書のバラつき', source: '製造業勉強会' },
  { title: '食品製造 女性社長 (8 名)', contactName: '小林咲', company: '◯◯食品', notes: 'バックオフィス疲弊, 海外展開', source: '女性起業家会' },
  { title: '印刷会社 3 代目 (15 名)', contactName: '田中誠', company: '◯◯印刷', notes: '業界縮小, 新規事業相談相手不在', source: '印刷経済新聞' },
  { title: '木材工芸メーカー (5 名)', contactName: '山本玲', company: '◯◯クラフト', notes: 'D2C 移行を一人で', source: 'クラフト系メディア' },
  { title: 'カフェ 3 店舗オーナー', contactName: '加藤翔', company: '◯◯カフェ', notes: '数字管理, 採用面接', source: '飲食店オーナー交流会' },
  { title: '美容室 5 店舗オーナー', contactName: '高橋彩', company: '◯◯美容室', notes: '店舗長育成, 経営の孤独', source: '美容業界経営者会' },
  { title: '整骨院グループ 8 店舗', contactName: '渡辺豊', company: '◯◯整骨院', notes: 'スタッフ定着, 院長教育', source: '業界紙' },
  { title: 'クリーニング店 2 代目', contactName: '伊藤美香', company: '◯◯クリーニング', notes: '業界縮小, 新サービス開発', source: '地元商工会議所' },
  { title: '個別指導塾 オーナー (10 講師)', contactName: '中村正樹', company: '◯◯塾', notes: '採用 / 教材 / マーケ全部', source: '教育業界勉強会' },
  { title: '受託開発 (15 エンジニア)', contactName: '吉田優', company: '◯◯テック', notes: '営業文 / 提案書品質', source: 'Forkwell 登壇者' },
  { title: 'Web 制作 (8 名)', contactName: '森美咲', company: '◯◯デザイン', notes: '顧客提案 + 議事録', source: 'Web 業界交流会' },
  { title: 'SaaS スタートアップ (10 名)', contactName: '林大輔', company: '◯◯ SaaS', notes: '取締役会資料, IR 対応', source: 'VC 主催経営者会' },
  { title: '広告代理店 (12 名)', contactName: '岡崎拓也', company: '◯◯広告', notes: '提案資料品質, 競合分析', source: '広告業界勉強会' },
  { title: 'EC 運営代行 (6 名)', contactName: '清水雅美', company: '◯◯ EC', notes: '案件管理, 月次レポート', source: 'EC 系イベント' },
  { title: '食品商社 2 代目 (18 名)', contactName: '松本一郎', company: '◯◯商事', notes: '後継育成, 海外展開', source: '商工会議所' },
  { title: '化粧品卸 (12 名)', contactName: '橋本千尋', company: '◯◯コスメ', notes: 'D2C 化, 営業マネージャー教育', source: '美容業界経営者会' },
  { title: 'アパレル商社 (20 名)', contactName: '木村哲', company: '◯◯アパレル', notes: '業界縮小, 海外展開, デジタル化', source: 'アパレル業界勉強会' },
  { title: '歯科医院 3 院グループ', contactName: '齋藤亮', company: '◯◯歯科', notes: '院長育成, 顧客満足度', source: '医療経営フォーラム' },
  { title: '訪問看護 (12 名)', contactName: '藤田美和', company: '◯◯訪問看護', notes: '採用, スタッフケア, 加算管理', source: '医療介護業界誌' },
  { title: '介護施設 4 ヶ所', contactName: '近藤将史', company: '◯◯介護', notes: '採用難, 加算改善', source: '介護経営フォーラム' },
  { title: '動物病院 (6 名)', contactName: '長谷川さくら', company: '◯◯動物病院', notes: '経営の数字, 採用', source: '獣医師会' },
  { title: '不動産仲介 中小 (10 名)', contactName: '坂本和也', company: '◯◯不動産', notes: '提案資料の質, 営業マネージャー教育', source: '不動産業界勉強会' },
  { title: '建設業 専門工事 (30 名)', contactName: '安田正樹', company: '◯◯建設', notes: '後継育成, 業界デジタル化', source: '建設業協会' },
  { title: '物流 小規模運送 (15 名)', contactName: '内田豊', company: '◯◯運送', notes: '採用難, 燃料費高騰', source: '物流業界経営者会' },
];

const REALESTATE_FINANCE_LEADS: LeadSeed[] = [
  { title: '大手仲介 支店長 (営業 30 名)', contactName: '宮本健一', company: '◯◯不動産', notes: '新人育成コスト, 提案書品質', source: 'LinkedIn DM' },
  { title: '中小仲介 社長 (営業 12 名)', contactName: '富田賢', company: '◯◯リアル', notes: '提案準備時間削減', source: '紹介' },
  { title: '投資不動産 営業マネージャー', contactName: '東大輔', company: '◯◯投資不動産', notes: '反論対応の標準化', source: 'PROPTECH イベント' },
  { title: '賃貸管理 (物件 200 / 営業 8)', contactName: '森下太一', company: '◯◯賃貸管理', notes: '重要事項説明書作成効率化', source: '不動産業協会' },
  { title: '企業向け仲介 (法人営業)', contactName: '宮田尚樹', company: '◯◯コーポレート不動産', notes: '提案書品質, 競合差別化', source: 'LinkedIn' },
  { title: 'コインパーキング (営業 15)', contactName: '柳田博', company: '◯◯パーキング', notes: '地主提案資料, 競合比較', source: '業界誌' },
  { title: '収益物件アドバイザー (フリー)', contactName: '川口慎一', company: 'フリーランス', notes: '高単価営業の提案時間', source: 'X DM' },
  { title: 'REIT 投資コンサル (富裕層)', contactName: '小川真理', company: '◯◯ REIT', notes: '提案資料の高品質化', source: '金融業界誌' },
  { title: '保険外交員 生保 (富裕層)', contactName: '川島舞', company: '◯◯生命', notes: '提案カスタマイズ, 反論対応', source: 'FB グループ' },
  { title: '金融商品仲介 (IFA)', contactName: '熊田俊', company: '◯◯ IFA', notes: '顧客向け提案, リスク説明', source: 'FIN/SUM' },
  { title: '証券営業 中小証券', contactName: '深井雄太', company: '◯◯証券', notes: '提案準備, 反論対応', source: '日本証券業協会' },
  { title: '銀行法人営業 中堅', contactName: '島田直也', company: '◯◯銀行', notes: '提案書品質, 業界知識スピード', source: 'LinkedIn' },
  { title: 'FP 独立 (高単価)', contactName: '富永桃子', company: '独立 FP', notes: '提案資料, 顧客管理', source: 'FP 業界誌' },
  { title: '相続税理士法人', contactName: '青木宏', company: '◯◯税理士法人', notes: '提案資料 + 法的リスク説明', source: '紹介' },
  { title: '大手不動産 営業 M (50 名)', contactName: '矢野大悟', company: '◯◯ホールディングス', notes: '部下育成, ROI', source: 'LinkedIn' },
  { title: '保険 営業推進部 (全国 200)', contactName: '小池千鶴', company: '◯◯損保', notes: '営業マニュアル更新, 新人教育', source: 'エンタープライズ問合せ' },
  { title: '証券 支店長 (営業 25)', contactName: '荒木拓未', company: '◯◯証券', notes: '部下教育, 顧客満足度', source: '日本証券業協会' },
  { title: '不動産投資ファンド', contactName: '原田倫太郎', company: '◯◯ファンド', notes: '大口顧客向け提案資料', source: 'VC 紹介' },
  { title: '住宅メーカー 営業部 (20 名)', contactName: '芳賀繁', company: '◯◯ハウス', notes: '提案準備時間, 新人成約率', source: '展示会' },
  { title: '太陽光発電 法人営業 (10)', contactName: '河合篤司', company: '◯◯ソーラー', notes: '提案資料, 補助金最新化', source: '業界紙' },
];

const CONSULTING_LEADS: LeadSeed[] = [
  { title: '大手税理士法人 パートナー', contactName: '津田賢', company: '◯◯税理士法人', notes: '月次レビュー時間', source: '紹介' },
  { title: '中小税理士法人 代表 (80 顧客)', contactName: '杉浦圭', company: '◯◯総合税理士', notes: '申告期の超過残業', source: '月刊税理' },
  { title: '個人税理士 (30 顧客)', contactName: '本田千秋', company: '個人事務所', notes: '1 人で全部', source: 'X DM' },
  { title: '相続専門税理士', contactName: '広川厳', company: '◯◯相続税理士', notes: '高単価案件の提案書品質', source: '業界誌' },
  { title: '国際税務税理士', contactName: '吉野剛史', company: '◯◯国際税務', notes: '法令調査, レポート作成', source: 'LinkedIn' },
  { title: '企業法務 弁護士法人 (50 顧問)', contactName: '坂田裕之', company: '◯◯法律', notes: '案件レビュー, 報告書品質', source: '弁護士会名簿' },
  { title: '個人弁護士 一般民事', contactName: '大野理沙', company: '個人事務所', notes: '案件管理, クライアント対応', source: '紹介' },
  { title: '企業 IPO 弁護士 (5 件同時)', contactName: '岩崎慧', company: '◯◯コーポレート法律', notes: '案件管理, 各種書類', source: 'VC 紹介' },
  { title: '特許事務所 (200 件/年)', contactName: '長田高志', company: '◯◯特許', notes: '出願書類作成, 案件管理', source: '弁理士会' },
  { title: '離婚専門弁護士 (100 件/年)', contactName: '柏木茉莉', company: '◯◯法律', notes: '案件管理, クライアント感情ケア', source: 'ジュリスト' },
  { title: '戦略コンサル独立 (1 人 5 社)', contactName: '田畑龍之介', company: '独立コンサル', notes: '分析作業時間, 提案書品質', source: 'BCN' },
  { title: '中小企業診断士', contactName: '榎本和久', company: '個人', notes: '補助金申請書作成', source: '診断士会' },
  { title: 'マーケコンサル法人 (30 社)', contactName: '小山真', company: '◯◯マーケ', notes: '月次レポート, データ分析', source: '紹介' },
  { title: 'DX コンサル法人', contactName: '丸山秀和', company: '◯◯ DX', notes: '提案書, レポート, 議事録', source: 'LinkedIn' },
  { title: 'M&A 仲介 中小 (10 件同時)', contactName: '住吉裕一', company: '◯◯ M&A', notes: '案件管理, 資料作成', source: '紹介' },
  { title: '社労士法人 (50 社)', contactName: '吉田俊明', company: '◯◯社労士', notes: '助成金申請, 顧客対応', source: '社労士会' },
  { title: '個人社労士 ソロ', contactName: '佐久間久美子', company: '個人', notes: '1 人で全部', source: '紹介' },
  { title: '建設業許可 行政書士 (100 件)', contactName: '橘竜也', company: '◯◯行政書士', notes: '申請書作成時間', source: '行政書士会' },
  { title: '司法書士 登記案件', contactName: '岸田正人', company: '◯◯司法書士', notes: '書類作成効率化', source: '司法書士会' },
  { title: '公認会計士独立 (20 社顧問)', contactName: '保科宏輔', company: '個人', notes: '月次レビュー, 顧客対応', source: '紹介' },
];

const SOLO_LEADS: LeadSeed[] = [
  { title: 'コーチング (一人会社・年商 ¥800 万)', contactName: '黒田麻里', company: '◯◯コーチング', notes: '事務処理時間, 営業', source: '起業家会' },
  { title: 'デザインスタジオ 一人 (¥1,200 万)', contactName: '前野悠', company: '◯◯デザイン', notes: '提案書 / 請求書 / 議事録', source: 'X DM' },
  { title: 'コンサル 一人 (¥1,500 万)', contactName: '上原靖', company: '個人', notes: '案件管理, 月次レポート', source: 'note 記事' },
  { title: 'オンライン教室 一人 (受講 200)', contactName: '池田綾乃', company: '個人', notes: '受講生対応, 教材作成', source: '起業家会' },
  { title: 'YouTube クリエイター 一人 (5 万登録)', contactName: '澤田賢治', company: '個人事務所', notes: '企画 / 編集 / スポンサー', source: 'X DM' },
  { title: '整体師 個人開業', contactName: '高田勝己', company: '◯◯整体院', notes: '集客, 顧客管理, 会計', source: '地域商工会' },
  { title: 'オンラインカウンセラー', contactName: '東山華蓮', company: '個人', notes: '予約管理, 経理', source: 'note' },
  { title: 'フォトグラファー (結婚式)', contactName: '田島祥子', company: '個人', notes: '案件管理, 見積, 請求', source: 'Instagram DM' },
  { title: '書道家 (教室経営)', contactName: '今野好江', company: '◯◯書道教室', notes: '生徒管理, 月謝請求', source: '紹介' },
  { title: '個人栄養士 (訪問・オンライン)', contactName: '篠原麻奈美', company: '個人', notes: '顧客管理, 提案書', source: 'X DM' },
  { title: 'イラストレーター (30 件/年)', contactName: '住谷千夏', company: '個人', notes: '見積, 契約書, 著作権', source: 'X DM' },
  { title: '作家 個人 (¥500 万)', contactName: '松山宏二', company: '個人', notes: '出版社対応, 確定申告', source: 'note' },
  { title: '作曲家 / 音楽プロデューサー', contactName: '黒沢敦士', company: '個人スタジオ', notes: '案件管理, 契約書', source: 'X DM' },
  { title: '翻訳家 フリー (¥800 万)', contactName: '志田美紀', company: '個人', notes: '案件管理, 見積', source: 'LinkedIn' },
  { title: '動画編集者 (¥40 万/月)', contactName: '若林徹', company: '個人', notes: '案件管理, 単価交渉', source: 'X DM' },
];

const CREATOR_LEADS: LeadSeed[] = [
  { title: 'コスメインフルエンサー (IG 30K)', contactName: '@cosme_yui_official', company: '個人', notes: 'DM 返信, 案件単価交渉', source: 'Instagram DM' },
  { title: 'ファッション TikToker (50K)', contactName: '@fashion_aki', company: '個人', notes: 'ネタ切れ, 案件管理', source: 'TikTok' },
  { title: 'メンズビューティ YouTuber (20K)', contactName: '@menbeauty_ken', company: '個人', notes: '動画企画, スポンサー対応', source: 'YouTube コミュニティ' },
  { title: 'ヘアスタイリスト IG (15K)', contactName: '@hair_chiaki', company: '個人', notes: '撮影スケジュール, 案件', source: 'Instagram' },
  { title: 'マイクロ美容 (IG 8K)', contactName: '@beauty_micro_haru', company: '個人', notes: '案件取りこぼし', source: 'Toridori 登録' },
  { title: 'グルメ系 IG (40K)', contactName: '@gourmet_yumi', company: '個人', notes: '店舗との交渉, 投稿管理', source: 'Instagram' },
  { title: '旅行系 YouTuber (30K)', contactName: '@travel_so', company: '個人', notes: '案件管理, 動画編集', source: 'YouTube' },
  { title: 'ライフスタイル IG (25K)', contactName: '@life_natsumi', company: '個人', notes: '案件単価, ネタ切れ', source: 'LIDDELL' },
  { title: '暮らし系 TikToker (18K)', contactName: '@home_yuna', company: '個人', notes: '投稿頻度, 案件管理', source: 'TikTok' },
  { title: 'トレーナー IG (20K)', contactName: '@train_kenji', company: '個人', notes: 'オンライン指導, 案件', source: 'Instagram' },
  { title: 'ヨガインストラクター (15K)', contactName: '@yoga_mio', company: '個人スタジオ', notes: '生徒管理, 案件', source: 'Instagram' },
  { title: 'ダイエット TikToker (35K)', contactName: '@diet_aya', company: '個人', notes: '商品 PR 案件管理', source: 'TikTok' },
  { title: '歌い手 (50K)', contactName: '@uta_ren', company: '個人', notes: 'スポンサー対応, グッズ販売', source: 'YouTube' },
  { title: 'ゲーム実況 (100K)', contactName: '@game_taku', company: '個人', notes: 'スポンサー, ファンクラブ', source: 'YouTube' },
  { title: 'コスプレイヤー (30K)', contactName: '@cos_rina', company: '個人', notes: '案件管理, 撮影スケジュール', source: 'X DM' },
  { title: '声優志望 / 個人配信者 (8K)', contactName: '@voice_souta', company: '個人', notes: 'ファン管理, 投げ銭', source: '配信プラットフォーム' },
  { title: '副業インフルエンサー (20K)', contactName: '@fukugyo_eri', company: '個人', notes: '案件, 教材販売', source: 'note' },
  { title: '起業家系 YouTuber (40K)', contactName: '@biz_takashi', company: '個人法人', notes: 'スポンサー, セミナー集客', source: 'YouTube' },
  { title: 'マネー系 IG (30K)', contactName: '@money_kanae', company: '個人', notes: '案件, アフィリ管理', source: 'Instagram' },
  { title: 'キャリア系 TikToker (50K)', contactName: '@career_haruna', company: '個人', notes: 'スポンサー, 講演依頼', source: 'TikTok' },
];

const FREELANCE_PRO_LEADS: LeadSeed[] = [
  { title: 'フリーバックエンド (¥120 万/月)', contactName: '橋本良太', company: 'フリー', notes: '単価交渉, 確定申告', source: 'レバテック' },
  { title: 'フリー iOS (¥100 万/月)', contactName: '徳田佳奈', company: 'フリー', notes: '案件単価, 契約書', source: 'X DM' },
  { title: 'フリーフルスタック (¥150 万/月)', contactName: '武藤健一郎', company: 'フリー', notes: 'クライアント管理, 議事録', source: 'ITプロパートナーズ' },
  { title: 'フリー機械学習 (¥130 万/月)', contactName: '篠田康介', company: 'フリー', notes: '案件提案, 確定申告', source: '勉強会' },
  { title: 'フリーセキュリティ (¥150 万/月)', contactName: '里見浩之', company: 'フリー', notes: '案件管理, NDA', source: 'LinkedIn' },
  { title: 'フリー UI/UX デザイナー (¥100 万/月)', contactName: '高瀬未来', company: 'フリー', notes: '案件管理, 提案書', source: 'X DM' },
  { title: 'フリー Web デザイナー D2C (¥80 万/月)', contactName: '宮内蓮', company: 'フリー', notes: '案件管理, 単価交渉', source: 'X DM' },
  { title: 'フリーブランディング (案件 ¥200 万)', contactName: '永田千夏', company: 'フリー', notes: '提案書, 議事録, 契約書', source: '紹介' },
  { title: 'フリー 3D (建築) (¥120 万/月)', contactName: '中原一', company: 'フリー', notes: '案件管理, 提案書', source: 'LinkedIn' },
  { title: 'フリー Web ライター 技術系 (¥80 万/月)', contactName: '池本真理', company: 'フリー', notes: '案件管理, 経理', source: 'note' },
  { title: 'フリー編集者 出版 (¥100 万/月)', contactName: '塚本健太', company: 'フリー', notes: 'クライアント管理, 確定申告', source: '紹介' },
  { title: 'フリー脚本家 (¥120 万/月)', contactName: '本郷美咲', company: 'フリー', notes: '案件管理, 著作権交渉', source: 'X' },
  { title: 'フリーコンサル 戦略 (¥150 万/月)', contactName: '森田哲也', company: 'フリー', notes: '案件管理, 提案書', source: 'BCN' },
  { title: 'フリー動画クリエイター (¥100 万/月)', contactName: '安藤直人', company: 'フリー', notes: '案件管理, 編集効率', source: 'X' },
  { title: 'フリー写真家 商業 (¥80 万/月)', contactName: '藤川由衣', company: 'フリー', notes: '案件管理, 単価交渉', source: '紹介' },
];

const PLAN_INFO = {
  'sme':                 { label: '中小企業',         recommended: 'v2-btoB-standard', annualValue: 360_000 },
  'realestate-finance':  { label: '不動産・金融',     recommended: 'v2-btoB-standard', annualValue: 360_000 },
  'consulting':          { label: 'コンサル・士業',   recommended: 'v2-btoB-pro',      annualValue: 600_000 },
  'solo':                { label: '一人社長',         recommended: 'v2-btoC-standard', annualValue: 60_000 },
  'creator':             { label: 'クリエイター',     recommended: 'v2-btoC-standard', annualValue: 60_000 },
  'freelance-pro':       { label: '上位フリーランス', recommended: 'v2-btoC-pro',      annualValue: 180_000 },
} as const;

const ALL_LEADS: Record<LeadIndustry, LeadSeed[]> = {
  'sme': SME_LEADS,
  'realestate-finance': REALESTATE_FINANCE_LEADS,
  'consulting': CONSULTING_LEADS,
  'solo': SOLO_LEADS,
  'creator': CREATOR_LEADS,
  'freelance-pro': FREELANCE_PRO_LEADS,
};

export const SAMPLE_LEAD_INDUSTRIES: Array<{ key: LeadIndustry; label: string; count: number; recommendedPlan: string }> =
  (Object.keys(ALL_LEADS) as LeadIndustry[]).map(k => ({
    key: k,
    label: PLAN_INFO[k].label,
    count: ALL_LEADS[k].length,
    recommendedPlan: PLAN_INFO[k].recommended,
  }));

/** リード一括取込: CRMDeal 配列を生成 */
export function buildSampleLeads(personaId: string, industry: LeadIndustry): CRMDeal[] {
  const now = new Date().toISOString();
  const info = PLAN_INFO[industry];
  return ALL_LEADS[industry].map((l, i) => ({
    id: `sample-${industry}-${Date.now()}-${i}`,
    personaId,
    title: l.title,
    contact: {
      id: `sample-c-${industry}-${i}`,
      name: l.contactName,
      company: l.company,
      notes: l.notes,
    },
    amount: info.annualValue,
    probability: 10,                      // 初期のリード = 10%
    stage: 'lead',
    source: `sample:${industry}:${l.source}`,
    description: `${l.notes}\n\n推奨プラン: ${info.recommended}`,
    activities: [],
    createdAt: now,
    updatedAt: now,
  }));
}

/** localStorage の CRM ストアに追記 */
const CRM_STORE = 'core_crm_deals_v1';

export function addLeadsToCrm(personaId: string, industry: LeadIndustry): number {
  const newLeads = buildSampleLeads(personaId, industry);
  try {
    const raw = localStorage.getItem(CRM_STORE);
    const existing: CRMDeal[] = raw ? JSON.parse(raw) : [];
    // 既存の同じ industry の sample は削除して上書き (re-import 対応)
    const cleaned = existing.filter(d => !d.source?.startsWith(`sample:${industry}:`));
    const merged = [...newLeads, ...cleaned];
    localStorage.setItem(CRM_STORE, JSON.stringify(merged));
    return newLeads.length;
  } catch {
    return 0;
  }
}

/** 取込済みかチェック (UI でボタン表示制御) */
export function hasSampleLeads(industry: LeadIndustry): boolean {
  try {
    const raw = localStorage.getItem(CRM_STORE);
    if (!raw) return false;
    const existing: CRMDeal[] = JSON.parse(raw);
    return existing.some(d => d.source?.startsWith(`sample:${industry}:`));
  } catch { return false; }
}
