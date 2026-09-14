export type ChoiceOption = { value: number; label: string };

export type WorkflowQuestion =
  | { id: 'context'; type: 'context'; title: string; hint: string }
  | { id: 'frequency' | 'minutes' | 'people' | 'hourly'; type: 'number'; title: string; hint: string; label: string; min: number; max: number; unit: string; defaultValue?: number }
  | { id: 'repeatability' | 'digital' | 'rules' | 'exceptions' | 'approval'; type: 'choice'; title: string; hint?: string; options: ChoiceOption[] };

export type WorkflowAnswers = Partial<Record<WorkflowQuestion['id'], string | number>> & {
  industry?: string;
  workflow?: string;
};

export const WORKFLOW_QUESTIONS: WorkflowQuestion[] = [
  { id: 'context', type: 'context', title: '診断する業務を選んでください。', hint: '業種を選ぶと、よく発生する業務候補が表示されます。' },
  { id: 'frequency', type: 'number', title: 'その業務は、月に何回発生しますか。', hint: 'おおよそで構いません。', label: '月間の発生回数', min: 1, max: 100000, unit: '回' },
  { id: 'minutes', type: 'number', title: '1回あたり、何分かかりますか。', hint: '作業だけでなく、確認待ちや転記も含めます。', label: '1回あたりの時間', min: 1, max: 10000, unit: '分' },
  { id: 'people', type: 'number', title: '毎回、何人が関わりますか。', hint: '承認だけをする人も含めます。', label: '関わる人数', min: 1, max: 1000, unit: '人' },
  { id: 'hourly', type: 'number', title: '1時間の人件費を、いくらで見ますか。', hint: '給与だけでなく、会社負担分を含む概算をおすすめします。', label: '時間単価', min: 500, max: 100000, unit: '円', defaultValue: 3500 },
  { id: 'repeatability', type: 'choice', title: '毎回の進め方は、どのくらい同じですか。', options: [{ value: 4, label: 'ほぼ同じ手順で進む' }, { value: 3, label: '8割ほどは同じ' }, { value: 2, label: '半分ほどは同じ' }, { value: 1, label: '案件ごとに大きく違う' }] },
  { id: 'digital', type: 'choice', title: '必要な情報は、どこにありますか。', options: [{ value: 4, label: 'ひとつのクラウドやシステムに揃っている' }, { value: 3, label: '複数のサービスやExcelに分かれている' }, { value: 2, label: 'メール・チャット・個人PCにも分散している' }, { value: 1, label: '紙や口頭が中心で、記録が揃わない' }] },
  { id: 'rules', type: 'choice', title: '正しい処理のルールを、説明できますか。', options: [{ value: 4, label: '条件と例外を文書で説明できる' }, { value: 3, label: '担当者なら説明できる' }, { value: 2, label: '人によって判断が違う' }, { value: 1, label: '経験や勘に大きく依存する' }] },
  { id: 'exceptions', type: 'choice', title: '例外や差し戻しは、どのくらい起きますか。', options: [{ value: 4, label: 'ほとんど起きない' }, { value: 3, label: '10件に1件ほど' }, { value: 2, label: '3件に1件ほど' }, { value: 1, label: '毎回のように個別対応がある' }] },
  { id: 'approval', type: 'choice', title: '人の確認を、どこに残すべきですか。', hint: '人の承認が必要なことは、実装の失敗ではありません。', options: [{ value: 4, label: '記録だけ残せば自動処理できる' }, { value: 3, label: '最後の送信・確定だけ人が承認する' }, { value: 2, label: '途中に複数の承認が必要' }, { value: 1, label: '法務・医療・安全など、人の専門判断が中心' }] },
];

export const INDUSTRIES = ['製造', '建設・不動産', '医療・介護', '士業・コンサル', '小売・EC', '飲食・宿泊・サービス', 'IT・ソフトウェア', '教育', 'その他'];

export const WORKFLOWS: Record<string, string[]> = {
  '製造': ['見積・受注処理', '生産計画・工程調整', '検査記録・品質報告', '日報・作業実績の集計', '在庫確認・発注', '設備保全・点検記録', '顧客からの問い合わせ対応'],
  '建設・不動産': ['見積書・提案書の作成', '物件・案件への問い合わせ対応', '工程・日程調整', '現場写真・報告書の整理', '契約書類の作成・確認', '請求・入金確認', '物件・案件情報の登録'],
  '医療・介護': ['予約・受付対応', '記録・申し送りの要約', '請求内容の確認', 'シフト・訪問予定の調整', '問い合わせ対応', '帳票・報告書の作成', '物品・在庫管理'],
  '士業・コンサル': ['初回相談・ヒアリング整理', '調査・情報収集', '議事録・面談記録の作成', '提案書・報告書の下書き', '期限・案件進行の管理', '請求・稼働集計', '既存文書の検索'],
  '小売・EC': ['商品情報の登録・更新', '受注・発送処理', '在庫確認・発注', '問い合わせ・返品対応', '売上・店舗日報の集計', '広告・SNS原稿の作成', 'レビューの整理・返信'],
  '飲食・宿泊・サービス': ['予約・問い合わせ対応', 'シフト・勤務調整', '仕入れ・在庫管理', '売上・日報の集計', '多言語案内の作成', '口コミの整理・返信', '請求・入金確認'],
  'IT・ソフトウェア': ['要件・ヒアリングの整理', '見積書・提案書の作成', '問い合わせ・チケット対応', 'テスト結果・障害報告の整理', '案件進捗・工数の集計', '仕様書・社内文書の検索', '議事録・タスクの作成'],
  '教育': ['問い合わせ・入会対応', '授業・研修計画の作成', '出欠・受講状況の集計', '成績・進捗レポートの作成', '教材・問題の下書き', '請求・入金確認', '保護者・受講者への連絡'],
  'その他': ['見積書・提案書の作成', 'データ入力・転記', '議事録・記録の作成', '問い合わせ・顧客対応', '日報・月次報告の集計', '請求・経費処理', '日程・進行調整', '社内文書の検索'],
};

export type WorkflowScanResult = {
  annualHours: number;
  suitability: number;
  low: number;
  high: number;
  valueLow: number;
  valueHigh: number;
  title: string;
  body: string;
  plan: string[];
};

export function calculateWorkflowScan(answers: WorkflowAnswers): WorkflowScanResult {
  const n = (id: string) => Number(answers[id as keyof WorkflowAnswers]);
  const annualHours = n('frequency') * n('minutes') / 60 * n('people') * 12;
  const suitability = Math.round(((n('repeatability') * .28 + n('digital') * .24 + n('rules') * .22 + n('exceptions') * .16 + n('approval') * .10) / 4) * 100);
  if (suitability >= 78) return result(annualHours, suitability, n('hourly'), [.30, .55], '限定した範囲から、自動化を試す。', '定型部分を機械へ移し、最後の確認を人に残せる可能性があります。正常系ひとつで受入条件を決めます。', ['現在の処理時間とミス件数を10件分記録する', '正常系ひとつと、人が承認する地点を決める', '実データで小さく動かし、元の処理と比較する', '時間・品質・例外を見て、拡大か中止を決める']);
  if (suitability >= 58) return result(annualHours, suitability, n('hourly'), [.20, .40], '人の判断を残し、AIで下書きする。', '情報の収集・整理・下書きをAIへ移す形が向いています。承認前後の記録を残し、品質を比較します。', ['完成例と修正履歴を10件集める', 'AIが作る下書きと、人が決める部分を分ける', '同じ10件を現行手順とAI支援で比較する', '修正時間と品質が改善した部分だけ残す']);
  if (suitability >= 38) return result(annualHours, suitability, n('hourly'), [.10, .25], '先に、手順とデータを整える。', 'AIを入れる前に、正しい処理と例外を言葉にし、データの置き場を絞る必要があります。', ['担当者から正しい手順と例外を聞く', '必要なデータの置き場をひとつに決める', '開始・完了・差し戻し時刻を10件記録する', '標準化できた部分だけ、AI支援を再診断する']);
  return result(annualHours, suitability, n('hourly'), [.05, .15], 'この業務は、人の判断を中心に残す。', '周辺の記録・検索・転記だけを切り出し、専門判断は人が担う設計から始めます。', ['専門判断の前後にある転記・検索・記録を分ける', '判断の責任者と、AIへ渡さない情報を決める', '周辺作業だけ10件の時間を計測する', '人の判断を変えずに減らせる作業だけ試す']);
}

function result(annualHours: number, suitability: number, hourly: number, range: [number, number], title: string, body: string, plan: string[]): WorkflowScanResult {
  const low = annualHours * range[0];
  const high = annualHours * range[1];
  return { annualHours, suitability, low, high, valueLow: low * hourly, valueHigh: high * hourly, title, body, plan };
}
