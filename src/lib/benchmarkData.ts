// ============================================================
// 業界ベンチマークデータ — 中小企業白書2024・業界推計値ベース
// ============================================================

export interface BenchmarkEntry {
  industry: string;
  key: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  p25: number;
  p50: number;
  p75: number;
  source: string;
  description: string;
}

export const INDUSTRIES = [
  { id: 'food',          label: '飲食・外食',   emoji: '🍽' },
  { id: 'saas',          label: 'SaaS・IT',     emoji: '💻' },
  { id: 'ec',            label: 'EC・通販',      emoji: '🛒' },
  { id: 'retail',        label: '小売',          emoji: '🏪' },
  { id: 'manufacturing', label: '製造業',        emoji: '🏭' },
  { id: 'consulting',    label: 'コンサル',      emoji: '💼' },
  { id: 'advertising',   label: '広告・マーケ', emoji: '📣' },
  { id: 'realestate',    label: '不動産',        emoji: '🏠' },
] as const;

export type IndustryId = typeof INDUSTRIES[number]['id'];

// p25 < p50 < p75 (数値的に昇順)
// lowerIsBetter=true のとき: p25が優秀側、p75が劣後側
export const INDUSTRY_BENCHMARKS: BenchmarkEntry[] = [
  // ─── 飲食・外食 ─────────────────────────────────────────
  {
    industry: 'food', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 55, p50: 63, p75: 72,
    source: '中小企業白書2024',
    description: '売上から原材料費・仕入を引いた比率',
  },
  {
    industry: 'food', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: 2, p50: 5, p75: 9,
    source: '中小企業白書2024',
    description: '人件費・家賃等固定費控除後の利益率',
  },
  {
    industry: 'food', key: 'laborCostRatio', label: '人件費比率 (FL)',
    unit: '%', lowerIsBetter: true, p25: 28, p50: 33, p75: 40,
    source: '中小企業白書2024',
    description: '売上に対する人件費の割合 (低いほど良)',
  },
  {
    industry: 'food', key: 'foodCostRatio', label: '食材費比率',
    unit: '%', lowerIsBetter: true, p25: 25, p50: 30, p75: 38,
    source: '中小企業白書2024',
    description: '売上に対する食材原価の割合 (低いほど良)',
  },
  {
    industry: 'food', key: 'revenueGrowth', label: '売上成長率 (YoY)',
    unit: '%', lowerIsBetter: false, p25: -3, p50: 3, p75: 12,
    source: '中小企業白書2024',
    description: '前年比の売上成長率',
  },
  {
    industry: 'food', key: 'repeatRate', label: 'リピート率',
    unit: '%', lowerIsBetter: false, p25: 25, p50: 40, p75: 60,
    source: '業界推計値',
    description: '一定期間内に再来店した顧客の割合',
  },

  // ─── SaaS・IT ───────────────────────────────────────────
  {
    industry: 'saas', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 60, p50: 72, p75: 82,
    source: 'SaaS Metrics 2024',
    description: 'COGSを除いた粗利の比率',
  },
  {
    industry: 'saas', key: 'monthlyChurn', label: '月次チャーン率',
    unit: '%', lowerIsBetter: true, p25: 0.8, p50: 2.5, p75: 5.0,
    source: 'SaaS Metrics 2024',
    description: '月ごとの解約率 (低いほど良)',
  },
  {
    industry: 'saas', key: 'ltvCacRatio', label: 'LTV / CAC比',
    unit: '倍', lowerIsBetter: false, p25: 1.5, p50: 3.0, p75: 5.0,
    source: 'SaaS Metrics 2024',
    description: '顧客生涯価値÷獲得コスト (3倍以上が健全)',
  },
  {
    industry: 'saas', key: 'arrGrowth', label: 'ARR成長率',
    unit: '%', lowerIsBetter: false, p25: 20, p50: 50, p75: 100,
    source: 'SaaS Metrics 2024',
    description: '年間経常収益の成長率',
  },
  {
    industry: 'saas', key: 'nrr', label: 'NRR (純収益維持率)',
    unit: '%', lowerIsBetter: false, p25: 85, p50: 100, p75: 120,
    source: 'SaaS Metrics 2024',
    description: '既存顧客からの収益維持・拡大率 (100%以上が成長)',
  },
  {
    industry: 'saas', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: -20, p50: -5, p75: 15,
    source: 'SaaS Metrics 2024',
    description: '成長投資後の営業利益率',
  },

  // ─── EC・通販 ───────────────────────────────────────────
  {
    industry: 'ec', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 25, p50: 38, p75: 52,
    source: '経産省EC調査2024',
    description: '売上から商品原価を引いた比率',
  },
  {
    industry: 'ec', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: 2, p50: 6, p75: 12,
    source: '経産省EC調査2024',
    description: '広告費・物流費・人件費控除後の利益率',
  },
  {
    industry: 'ec', key: 'repeatRate', label: 'リピート率',
    unit: '%', lowerIsBetter: false, p25: 20, p50: 35, p75: 55,
    source: '経産省EC調査2024',
    description: '購入者のリピート購入率',
  },
  {
    industry: 'ec', key: 'adCostRatio', label: '広告費比率',
    unit: '%', lowerIsBetter: true, p25: 6, p50: 12, p75: 20,
    source: '経産省EC調査2024',
    description: '売上に対する広告費の割合 (低いほど効率的)',
  },
  {
    industry: 'ec', key: 'revenueGrowth', label: '売上成長率 (YoY)',
    unit: '%', lowerIsBetter: false, p25: 5, p50: 15, p75: 35,
    source: '経産省EC調査2024',
    description: '前年比の売上成長率',
  },
  {
    industry: 'ec', key: 'cartAbandonRate', label: 'カート離脱率',
    unit: '%', lowerIsBetter: true, p25: 60, p50: 70, p75: 78,
    source: '業界推計値',
    description: 'カート追加後に購入しなかった率 (低いほど良)',
  },

  // ─── 小売 ───────────────────────────────────────────────
  {
    industry: 'retail', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 25, p50: 35, p75: 48,
    source: '中小企業白書2024',
    description: '売上から仕入原価を引いた比率',
  },
  {
    industry: 'retail', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: 1, p50: 4, p75: 8,
    source: '中小企業白書2024',
    description: '人件費・家賃等固定費控除後の利益率',
  },
  {
    industry: 'retail', key: 'inventoryTurnover', label: '在庫回転率',
    unit: '回/年', lowerIsBetter: false, p25: 4, p50: 7, p75: 12,
    source: '中小企業白書2024',
    description: '年間で在庫を何回転させたか (高いほど資本効率が良)',
  },
  {
    industry: 'retail', key: 'salesPerEmployee', label: '1人当たり売上',
    unit: '万円/月', lowerIsBetter: false, p25: 100, p50: 180, p75: 280,
    source: '中小企業白書2024',
    description: '月次売上÷従業員数の生産性指標',
  },
  {
    industry: 'retail', key: 'revenueGrowth', label: '売上成長率 (YoY)',
    unit: '%', lowerIsBetter: false, p25: -2, p50: 3, p75: 10,
    source: '中小企業白書2024',
    description: '前年比の売上成長率',
  },
  {
    industry: 'retail', key: 'returnRate', label: '返品率',
    unit: '%', lowerIsBetter: true, p25: 1.5, p50: 4, p75: 8,
    source: '業界推計値',
    description: '販売件数に対する返品率 (低いほど良)',
  },

  // ─── 製造業 ─────────────────────────────────────────────
  {
    industry: 'manufacturing', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 18, p50: 25, p75: 35,
    source: '中小企業白書2024',
    description: '売上から材料費・製造原価を引いた比率',
  },
  {
    industry: 'manufacturing', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: 2, p50: 5, p75: 10,
    source: '中小企業白書2024',
    description: '販管費控除後の利益率',
  },
  {
    industry: 'manufacturing', key: 'materialCostRatio', label: '材料費比率',
    unit: '%', lowerIsBetter: true, p25: 35, p50: 45, p75: 55,
    source: '中小企業白書2024',
    description: '売上に対する材料費の割合 (低いほど良)',
  },
  {
    industry: 'manufacturing', key: 'capacityUtilization', label: '設備稼働率',
    unit: '%', lowerIsBetter: false, p25: 55, p50: 70, p75: 85,
    source: '経産省製造業調査2024',
    description: '設備の理論上限に対する実際の稼働比率',
  },
  {
    industry: 'manufacturing', key: 'salesPerEmployee', label: '1人当たり売上',
    unit: '万円/月', lowerIsBetter: false, p25: 50, p50: 80, p75: 130,
    source: '中小企業白書2024',
    description: '月次売上÷従業員数の生産性指標',
  },
  {
    industry: 'manufacturing', key: 'revenueGrowth', label: '売上成長率 (YoY)',
    unit: '%', lowerIsBetter: false, p25: -3, p50: 3, p75: 10,
    source: '中小企業白書2024',
    description: '前年比の売上成長率',
  },

  // ─── コンサル ────────────────────────────────────────────
  {
    industry: 'consulting', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 45, p50: 60, p75: 75,
    source: '業界推計値',
    description: '売上から人件費等直接原価を引いた比率',
  },
  {
    industry: 'consulting', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: 8, p50: 15, p75: 25,
    source: '業界推計値',
    description: '間接費・管理費控除後の利益率',
  },
  {
    industry: 'consulting', key: 'utilizationRate', label: 'コンサル稼働率',
    unit: '%', lowerIsBetter: false, p25: 55, p50: 68, p75: 80,
    source: '業界推計値',
    description: '有償稼働時間÷総稼働時間の比率',
  },
  {
    industry: 'consulting', key: 'revenuePerConsultant', label: '1人当たり年間売上',
    unit: '万円', lowerIsBetter: false, p25: 800, p50: 1500, p75: 2500,
    source: '業界推計値',
    description: '年間売上÷コンサルタント数',
  },
  {
    industry: 'consulting', key: 'clientRetentionRate', label: '顧客継続率',
    unit: '%', lowerIsBetter: false, p25: 55, p50: 70, p75: 85,
    source: '業界推計値',
    description: '契約更新・継続率',
  },
  {
    industry: 'consulting', key: 'revenueGrowth', label: '売上成長率 (YoY)',
    unit: '%', lowerIsBetter: false, p25: 5, p50: 15, p75: 30,
    source: '業界推計値',
    description: '前年比の売上成長率',
  },

  // ─── 広告・マーケ ────────────────────────────────────────
  {
    industry: 'advertising', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 28, p50: 40, p75: 55,
    source: '業界推計値',
    description: '売上から外注費・媒体費を引いた比率',
  },
  {
    industry: 'advertising', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: 5, p50: 10, p75: 18,
    source: '業界推計値',
    description: '人件費・間接費控除後の利益率',
  },
  {
    industry: 'advertising', key: 'laborCostRatio', label: '人件費比率',
    unit: '%', lowerIsBetter: true, p25: 32, p50: 42, p75: 50,
    source: '業界推計値',
    description: '売上に対する人件費の割合 (低いほど良)',
  },
  {
    industry: 'advertising', key: 'winRate', label: '受注率',
    unit: '%', lowerIsBetter: false, p25: 20, p50: 35, p75: 55,
    source: '業界推計値',
    description: '提案・見積もりに対する成約率',
  },
  {
    industry: 'advertising', key: 'clientRetentionRate', label: '顧客継続率',
    unit: '%', lowerIsBetter: false, p25: 50, p50: 65, p75: 80,
    source: '業界推計値',
    description: '契約更新・継続率',
  },
  {
    industry: 'advertising', key: 'revenueGrowth', label: '売上成長率 (YoY)',
    unit: '%', lowerIsBetter: false, p25: 2, p50: 8, p75: 20,
    source: '業界推計値',
    description: '前年比の売上成長率',
  },

  // ─── 不動産 ─────────────────────────────────────────────
  {
    industry: 'realestate', key: 'grossMargin', label: '粗利率',
    unit: '%', lowerIsBetter: false, p25: 20, p50: 30, p75: 45,
    source: '中小企業白書2024',
    description: '売上から仕入・工事原価を引いた比率',
  },
  {
    industry: 'realestate', key: 'operatingMargin', label: '営業利益率',
    unit: '%', lowerIsBetter: false, p25: 5, p50: 12, p75: 22,
    source: '中小企業白書2024',
    description: '人件費・広告費控除後の利益率',
  },
  {
    industry: 'realestate', key: 'conversionRate', label: '成約率',
    unit: '%', lowerIsBetter: false, p25: 15, p50: 28, p75: 42,
    source: '業界推計値',
    description: '問い合わせ件数に対する成約率',
  },
  {
    industry: 'realestate', key: 'salesPerEmployee', label: '1人当たり売上',
    unit: '万円/月', lowerIsBetter: false, p25: 120, p50: 220, p75: 380,
    source: '業界推計値',
    description: '月次売上÷営業員数の生産性指標',
  },
  {
    industry: 'realestate', key: 'revenueGrowth', label: '売上成長率 (YoY)',
    unit: '%', lowerIsBetter: false, p25: -2, p50: 5, p75: 15,
    source: '業界推計値',
    description: '前年比の売上成長率',
  },
  {
    industry: 'realestate', key: 'listingCycle', label: '物件成約サイクル',
    unit: '日', lowerIsBetter: true, p25: 30, p50: 60, p75: 90,
    source: '業界推計値',
    description: '掲載から成約までの平均日数 (低いほど良)',
  },
];
