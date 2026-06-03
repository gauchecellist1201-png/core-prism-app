// ============================================================
// riskPriority — ナレッジ分析の risks を 重要度順 に並べ替える
//
// オーナー指示 (2026-06-03):
//   ナレッジのリスクが並列に並んでいるのが微妙。優先度順に並べ替えて見やすく。
//
// 設計:
//   - AI 側で重要度タグを返してくれる訳ではないので、文字列から推定
//   - キーワード辞書ベースで「致命的」「重要」「注意」の 3 段階に分類
//   - 致命的 (法的 / 倒産 / 漏洩 等) → 上、注意 (検討 / モニタリング) → 下
//   - 同じ重要度内では、AI が先に書いた順を尊重 (= 重要そうに見える順)
// ============================================================

export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ScoredRisk {
  text: string;
  severity: RiskSeverity;
  /** UI 表示用 (危険度ラベル + 色) */
  label: string;
  color: string;
  /** 並び替え時の重み (高い順) */
  score: number;
  /** 元の配列内インデックス (安定ソート用) */
  originalIndex: number;
}

// ── 重要度別 キーワード辞書 ─────────────────────────
// 1 つでも該当すれば、その重要度に分類。複数該当時は上位を採用。

const CRITICAL_KEYWORDS = [
  // 法的リスク
  '違法', '法令', '法律違反', '訴訟', '裁判', '賠償', '差止', '行政処分', '罰金', '刑事',
  // 事業継続
  '倒産', '廃業', '債務超過', '資金繰り', '資金ショート', '不渡り', '差押', '破産',
  // セキュリティ・情報
  '個人情報', '漏えい', '漏洩', '流出', '不正アクセス', 'なりすまし', '情報漏', 'GDPR',
  // 雇用・人事
  '解雇', 'ハラスメント', '労基', '労災', '違法残業', '未払い賃金',
  // 緊急
  '即時', '至急', '今すぐ', '緊急',
];

const HIGH_KEYWORDS = [
  // 財務
  '赤字', '損失', '減収', '減益', '原価割れ', '採算割れ', '滞納', '入金遅延', '未払',
  // 顧客・売上
  '退会', '解約', '離反', '顧客減', '失注', 'クレーム', '炎上', '評判', '炎',
  // 競合・市場
  '撤退', '競合参入', '価格競争', 'シェア低下',
  // 人材
  '退職', '人手不足', '採用難', '後継', '欠員',
  // オペレ
  '崩壊', 'ボトルネック', '機能停止', '滞り', 'ダウン',
];

const MEDIUM_KEYWORDS = [
  // 注意喚起系
  'リスク', '懸念', '不安', '可能性', 'おそれ', '恐れ', '心配',
  // 効率・コスト
  'コスト', '費用増', '値上げ', '価格高騰', '原材料', '相場',
  // 一般的注意
  'ミス', '失敗', '遅延', '誤', '抜け', '漏れ', '見落と',
  // 競合一般
  '競合', 'ライバル', '他社',
];

const SEVERITY_META: Record<RiskSeverity, { label: string; color: string; score: number }> = {
  critical: { label: '致命的', color: '#DC2626', score: 1000 },
  high:     { label: '重大',   color: '#EA580C', score: 600 },
  medium:   { label: '注意',   color: '#F59E0B', score: 300 },
  low:      { label: '参考',   color: '#9CA3AF', score: 100 },
};

function detectSeverity(text: string): RiskSeverity {
  const t = text.toLowerCase();
  for (const kw of CRITICAL_KEYWORDS) {
    if (text.includes(kw) || t.includes(kw.toLowerCase())) return 'critical';
  }
  for (const kw of HIGH_KEYWORDS) {
    if (text.includes(kw) || t.includes(kw.toLowerCase())) return 'high';
  }
  for (const kw of MEDIUM_KEYWORDS) {
    if (text.includes(kw) || t.includes(kw.toLowerCase())) return 'medium';
  }
  // どれにも該当しないテキストは「参考」
  return 'low';
}

/**
 * risks 配列を 重要度順 に並べ替え + メタ情報を付与
 * 並び順: critical → high → medium → low、同重要度内は元順を保持 (安定ソート)
 */
export function sortRisksByPriority(risks: string[]): ScoredRisk[] {
  if (!risks || risks.length === 0) return [];
  const scored: ScoredRisk[] = risks
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((text, originalIndex) => {
      const severity = detectSeverity(text);
      const meta = SEVERITY_META[severity];
      return {
        text: text.trim(),
        severity,
        label: meta.label,
        color: meta.color,
        score: meta.score,
        originalIndex,
      };
    });
  // 安定ソート: スコア降順 → 元順昇順
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.originalIndex - b.originalIndex;
  });
  return scored;
}

/**
 * insights / strategy / actions 等の他配列も同じロジックで並べ替えたい時用。
 * 「重要度」というよりは「重要度を推定」する汎用版。
 */
export function sortByCriticalKeywords(items: string[]): string[] {
  return sortRisksByPriority(items).map(s => s.text);
}

/**
 * 単一の文字列の重要度だけ知りたい時用。
 */
export function severityOf(text: string): RiskSeverity {
  return detectSeverity(text);
}

export const SEVERITY_LABELS = SEVERITY_META;
