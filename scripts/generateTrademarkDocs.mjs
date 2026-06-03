#!/usr/bin/env node
/**
 * generateTrademarkDocs.mjs — 商標出願 弁理士提出用 下書き 自動生成
 *
 * オーナー指示 (2026-06-04 第 15 波 III):
 *   弁理士 (Toreru / Cotobox / 個人事務所) に そのまま渡せる出願書類の
 *   Markdown を 4 商標分 生成して ~/Desktop/商標出願下書き/<日付>/ に保存。
 *
 * 4 商標:
 *   1. CORE Prism   (英字 / 標準文字)
 *   2. CORE Iris    (英字 / 標準文字)
 *   3. コアプリズム (カナ / 標準文字)
 *   4. コアアイリス (カナ / 標準文字)
 *
 * 指定区分: 第 9 類 + 第 42 類 (SaaS 標準。状況により第 35 / 41 類追加検討)
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const today = new Date().toISOString().slice(0, 10);
const outDir = join(homedir(), 'Desktop', '商標出願下書き', today);
mkdirSync(outDir, { recursive: true });

// ─── 共通情報 ────────────────────────────────
const APPLICANT = {
  type: '法人',
  name: '株式会社 CORE',
  representative: '代表取締役 井出 直毅',
  address: '(出願時に住民票/登記住所を記入)',
  phone: '(出願時に記入)',
  email: 'gauche.cellist1201@gmail.com',
};

// ─── 指定商品 / 役務 (第 9 類 + 第 42 類 共通) ────
const GOODS_CLASS_9 = [
  '電子計算機用プログラム',
  'インターネット用ダウンロード可能なソフトウェア',
  '電子出版物',
  'ダウンロード可能な携帯用電話機用画像 / 動画 / 音楽 / 電子出版物',
];

const SERVICES_CLASS_42 = [
  'ダウンロードしないで使うコンピュータソフトウェアの提供 (SaaS)',
  '電子計算機のプログラムの設計・作成又は保守',
  'コンピュータ用プログラムの提供',
  'インターネットを用いて行うコンピュータプログラムの提供',
  '電子計算機を用いた情報処理の代行',
  'クラウドコンピューティング',
  '人工知能に関する技術の提供',
  'IT 関連コンサルティング',
];

// Iris 特化追加 (任意): クリエイター支援なら 第 35 / 41 類も視野
const SERVICES_CLASS_35_IRIS = [
  '広告業',
  'インターネットによる広告',
  '事業の管理 / 運営に関する助言',
  'マーケットリサーチ',
];

const SERVICES_CLASS_41_IRIS = [
  'オンラインによる教育情報の提供',
  'セミナーの企画 / 運営 / 開催',
  '電子出版物の提供 / 編集',
];

// ─── 商標定義 ────────────────────────────────
const MARKS = [
  {
    id: 1,
    mark: 'CORE Prism',
    style: '標準文字',
    type: 'alphabetic',
    classes: [9, 42, 35], // 35 は「経営助言」の機能カバー目的
    description: 'CORE Prism は AI 役員 13 名が経営判断・営業・財務・マーケ等を補助する SaaS の商標',
    notes: '英字大文字「CORE」+ 英字「Prism」を半角スペース区切り。書体指定なし (標準文字)。',
  },
  {
    id: 2,
    mark: 'CORE Iris',
    style: '標準文字',
    type: 'alphabetic',
    classes: [9, 42, 41], // 41 は Iris クリエイター教育機能カバー
    description: 'CORE Iris はクリエイター向け AI マネージャー SaaS の商標',
    notes: '英字大文字「CORE」+ 英字「Iris」を半角スペース区切り。書体指定なし。',
  },
  {
    id: 3,
    mark: 'コアプリズム',
    style: '標準文字',
    type: 'katakana',
    classes: [9, 42],
    description: '上記 CORE Prism のカタカナ表記。検索可視性 / 海外発音差吸収のため併願。',
    notes: '全角カタカナ 6 字。書体指定なし。',
  },
  {
    id: 4,
    mark: 'コアアイリス',
    style: '標準文字',
    type: 'katakana',
    classes: [9, 42],
    description: '上記 CORE Iris のカタカナ表記。同上の理由で併願。',
    notes: '全角カタカナ 6 字。書体指定なし。',
  },
];

// ─── テンプレ レンダリング ───────────────────
function renderClassBlock(cls) {
  if (cls === 9) {
    return [
      '### 第 9 類 (Class 9)',
      '指定商品:',
      ...GOODS_CLASS_9.map(g => `- ${g}`),
    ].join('\n');
  }
  if (cls === 42) {
    return [
      '### 第 42 類 (Class 42)',
      '指定役務 (サービス):',
      ...SERVICES_CLASS_42.map(s => `- ${s}`),
    ].join('\n');
  }
  if (cls === 35) {
    return [
      '### 第 35 類 (Class 35)',
      '指定役務 (サービス):',
      ...SERVICES_CLASS_35_IRIS.map(s => `- ${s}`),
    ].join('\n');
  }
  if (cls === 41) {
    return [
      '### 第 41 類 (Class 41)',
      '指定役務 (サービス):',
      ...SERVICES_CLASS_41_IRIS.map(s => `- ${s}`),
    ].join('\n');
  }
  return `### 第 ${cls} 類 — (指定商品 / 役務は別途確認)`;
}

function renderMark(m) {
  const classesBlock = m.classes.map(renderClassBlock).join('\n\n');
  return `# 商標出願 下書き — ${m.mark}

> 弁理士提出用 下書き / 生成日: ${today}

## 1. 商標 (Mark)
- **商標**: ${m.mark}
- **書体**: ${m.style}
- **種別**: ${m.type === 'alphabetic' ? '欧文字商標 (Latin)' : 'カタカナ商標'}
- **メモ**: ${m.notes}

## 2. 説明
${m.description}

## 3. 出願人 (Applicant)
| 項目 | 内容 |
|---|---|
| 種別 | ${APPLICANT.type} |
| 名称 | ${APPLICANT.name} |
| 代表者 | ${APPLICANT.representative} |
| 住所 | ${APPLICANT.address} |
| 電話 | ${APPLICANT.phone} |
| メール | ${APPLICANT.email} |

## 4. 指定区分 / 指定商品・指定役務
出願区分: ${m.classes.map(c => `第 ${c} 類`).join(' + ')}

${classesBlock}

## 5. 早期審査の要否
- 推奨: **早期審査 (FA TRACK) 申請可** — 実利用開始 + 同類商品/役務が明示できる場合
- 通常審査 6-8 ヶ月 → 早期審査 3-4 ヶ月に短縮可

## 6. 費用 概算 (1 商標あたり)
| 項目 | 金額 |
|---|---|
| 弁理士 出願手数料 (Toreru 等) | ¥34,800 |
| 印紙代 (1 区分) | ¥12,000 |
| 印紙代 (区分追加 × ${m.classes.length - 1}) | ¥${(m.classes.length - 1) * 8800} (区分追加分 ¥8,800/区分) |
| **小計 (出願時)** | **約 ¥${(34800 + 12000 + (m.classes.length - 1) * 8800).toLocaleString()}** |
| 登録料 (10 年保護 / 登録確定後) | ¥${m.classes.length * 32200} (区分 × ¥32,200) |

## 7. リスク評価 (公開情報スクリーニング)
${(
  m.mark === 'CORE Prism'  ? '🟡 「CORE」単体は Intel Core 等で多数登録。複合 (CORE Prism) であれば衝突可能性は低い。' :
  m.mark === 'CORE Iris'   ? '🟡 「Iris」は Intel Iris (GPU)。SaaS 第 42 類 では公開情報で衝突未確認。複合で識別性 OK。' :
  m.mark === 'コアプリズム' ? '🟢 公開情報では同一登録は確認できず。登録可能性は高い。' :
  m.mark === 'コアアイリス' ? '🟢 アイリスオーヤマは第 7-21 類中心で第 9/42 類は未確認。複合で識別性 OK。' :
  '— 弁理士判定を要確認 —'
)}

## 8. 添付 / 補強資料 (任意)
- [ ] 商標使用例のスクリーンショット (LP / アプリ画面)
- [ ] 既存ロゴ (PRISM ポリゴン / Iris アイリス花)
- [ ] 事業計画書または会社概要 (経営助言区分時)
- [ ] 商標調査結果 (上記 7 の根拠資料)

## 9. 次のステップ
1. 上記「住所」「電話」を出願時の実情報で埋める
2. 弁理士 (Toreru / Cotobox / 個人事務所) にこの md ファイルを送る
3. 早期審査希望の旨を伝える (実利用 + 業務範囲がそろっていれば取得可)
4. 出願完了後、出願番号 / 出願日 を本ファイルに追記
`;
}

// ─── 出力 ─────────────────────────────────
for (const m of MARKS) {
  const fname = `${String(m.id).padStart(2, '0')}_${m.type === 'alphabetic' ? m.mark.toLowerCase().replace(/\s+/g, '-') : m.mark}.md`;
  writeFileSync(join(outDir, fname), renderMark(m), 'utf-8');
  console.log(`✓ ${fname}`);
}

// 全体一覧 README
const summary = `# 商標出願 下書き 一覧

生成日: ${today}

出願人: ${APPLICANT.name} (${APPLICANT.representative})

## 4 商標 サマリ

| # | 商標 | 種別 | 区分 | 概算費用 (出願時) |
|---|---|---|---|---|
${MARKS.map(m => `| ${m.id} | ${m.mark} | ${m.style} | ${m.classes.map(c => `第${c}類`).join('+')} | ¥${(34800 + 12000 + (m.classes.length - 1) * 8800).toLocaleString()} |`).join('\n')}

**合計 (出願時)**: 約 ¥${MARKS.reduce((a, m) => a + 34800 + 12000 + (m.classes.length - 1) * 8800, 0).toLocaleString()}
**合計 (登録料 / 10 年)**: 約 ¥${MARKS.reduce((a, m) => a + m.classes.length * 32200, 0).toLocaleString()}
**10 年 総額**: 約 ¥${MARKS.reduce((a, m) => a + 34800 + 12000 + (m.classes.length - 1) * 8800 + m.classes.length * 32200, 0).toLocaleString()}

## 弁理士 推奨

- **Toreru** (toreru.jp) — オンライン弁理士、固定価格、最速
- **Cotobox** (cotobox.com) — AI 商標検索 + 弁理士手配
- 個人事務所 (商標専門)

## 推奨スケジュール

1. 今週中: 弁理士に 4 件の見積依頼 → 1 件に絞る
2. 来週中: 出願実行 (申請書類は弁理士が作成)
3. 4-8 週間後: 出願公開 (J-PlatPat に反映)
4. 3-8 ヶ月後: 審査結果 → 登録 or 拒絶理由通知

## 注記

本下書きは公開情報からの初期スクリーニングです。最終出願内容は弁理士の専門意見に従ってください。

ファイル一覧:
${MARKS.map(m => `- ${String(m.id).padStart(2, '0')}_${m.type === 'alphabetic' ? m.mark.toLowerCase().replace(/\s+/g, '-') : m.mark}.md`).join('\n')}
`;

writeFileSync(join(outDir, 'README.md'), summary, 'utf-8');
console.log(`✓ README.md`);
console.log('');
console.log(`保存先: ${outDir}`);
console.log(`合計 ${MARKS.length} 商標、推定 ¥${MARKS.reduce((a, m) => a + 34800 + 12000 + (m.classes.length - 1) * 8800 + m.classes.length * 32200, 0).toLocaleString()} で 10 年保護`);
