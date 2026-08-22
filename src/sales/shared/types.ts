// ============================================================
// CORE Studio Sales OS — 共有型
//
// このファイルは フロント (src/sales/*) と API (api/sales/*) の両方から
// import される。ブラウザ専用 API / Node 専用 API を絶対に使わないこと。
// (拡張子なし相対 import は Vite / Vercel の双方が解決する。既存 api も
//  '../_lib/masterAudit' のように拡張子なしで書いている)
// ============================================================

// ---- 営業ステージ (CRM) --------------------------------------------------
// 仕様の CALL / EMAIL は「状態」ではなく「行動」なので Activity 側に置く。
// 状態を CALL にすると「電話したあと今どこにいるのか」が消えるため。
export type Stage =
  | 'NEW'        // 登録しただけ
  | 'ANALYZED'   // 企業分析ずみ・弾は出来ている
  | 'CONTACTED'  // 電話 or メールを1回以上打った
  | 'REPLIED'    // 返事が来た
  | 'MEETING'    // 商談が入った / 実施した
  | 'PROPOSAL'   // 提案・見積を出した
  | 'TRIAL'      // 初回1本を受注
  | 'WON'        // 受注 (単発)
  | 'MONTHLY'    // 月額継続契約
  | 'OEM'        // 代理店/OEMパートナー
  | 'LOST';      // 失注

export interface StageMeta {
  id: Stage;
  label: string;
  /** ファネルの段数。LOST は -1 (ファネル外) */
  step: number;
  /** 一覧のドット色 */
  color: string;
  /** この状態の企業に対して「次にやること」の既定文 */
  nextHint: string;
}

// ---- ターゲット区分 ------------------------------------------------------
export type TargetTier = 'A' | 'B' | 'C' | 'X';

// ---- スコア --------------------------------------------------------------
export type ScoreKey =
  | 'videoDemand'      // 動画需要 0-20
  | 'buyingSignal'     // 購買シグナル (求人など) 0-20
  | 'companySize'      // 企業規模 0-15
  | 'productFit'       // 商品との相性 0-20
  | 'continuity'       // 継続性 0-15
  | 'oemPotential';    // OEM可能性 0-10

export interface ScoreItem {
  key: ScoreKey;
  label: string;
  max: number;
  value: number;
  /** なぜその点数なのか。根拠が取れなければ空 = 未確認として 0 点にする */
  evidence: string;
  /** 根拠がサイト等から取れなかった (AI の推測でしかない) */
  unknown: boolean;
}

export interface ScoreResult {
  total: number;              // 0-100
  items: ScoreItem[];
  /** 根拠が取れた項目数 / 全項目数。低いほど「まだ調べ切れていない」 */
  confidence: number;         // 0-1
}

// ---- 企業分析 ------------------------------------------------------------
/** 事実は必ず根拠(evidence)とセットで持つ。根拠が無いものは画面に「未確認」と出す。 */
export interface Fact {
  value: string;
  evidence: string;
}

export interface Analysis {
  summary: string;            // 会社概要
  business: string;           // 事業内容
  products: string[];         // 主要商品
  customers: string;          // 顧客層
  sns: Fact;                  // SNS状況
  videoUsage: Fact;           // 動画活用状況
  ads: Fact;                  // 広告状況
  hiring: Fact;               // 求人状況
  competitors: string[];      // 競合
  aiVideoFit: string;         // AI動画との相性
  painHypothesis: string[];   // 想定課題
  angle: string;              // 営業切り口
  recommendedPlan: string;    // 推奨商品 (catalog の id)
  budgetGuess: string;        // 想定予算
  targetTier: TargetTier;
  industry: string;
  /** サイト本文が取れなかった等、分析が推測に寄っている場合の警告 */
  warnings: string[];
}

// ---- AI動画企画 ----------------------------------------------------------
export type PlanKind = 'A' | 'B' | 'C';

export interface VideoPlan {
  kind: PlanKind;
  purpose: string;            // 売上 / SNSバズ / ブランド
  title: string;
  hook3s: string;             // 冒頭3秒フック
  beats: Array<{ time: string; shot: string; audio: string }>;  // 15〜20秒構成
  story: string;
  visual: string;             // 映像イメージ
  narration: string;          // ナレーション案
  cta: string;
}

// ---- 生成物 --------------------------------------------------------------
export interface EmailDraft {
  subject: string;
  body: string;
  /** 何回目の接触として書いたか (1 = 初回) */
  touch: number;
  /** 追客の切り口 (2回目以降) */
  angle: string;
}

export interface CallScript {
  /** 30秒以内。サービス説明から入らない */
  opening: string;
  question: string;
  bridge: string;
  hook: string;
  close: string;
  objections: Array<{ q: string; a: string }>;
}

// ---- 活動 ----------------------------------------------------------------
export type ActivityKind =
  | 'call' | 'call_no_answer' | 'email' | 'reply' | 'meeting'
  | 'proposal' | 'trial' | 'won' | 'monthly' | 'oem' | 'lost' | 'note';

export interface Activity {
  id: string;
  companyId: string;
  kind: ActivityKind;
  note: string;
  at: string;                 // ISO
}

// ---- 企業 ----------------------------------------------------------------
export interface Company {
  id: string;
  name: string;
  url: string;
  domain: string;
  industry: string;
  targetTier: TargetTier;
  stage: Stage;
  phone: string;
  email: string;
  sns: string;
  contactName: string;
  memo: string;

  score: ScoreResult | null;
  analysis: Analysis | null;
  plans: VideoPlan[] | null;
  email1: EmailDraft | null;
  call: CallScript | null;

  /**
   * これまでに到達した最高段 (stageMeta().step)。
   * 失注すると stage は LOST (step -1) になるので、現在の段だけで率を数えると
   * 「返信も商談もあったのに失注した会社」が返信率・商談率から消える。
   * 古いデータには無いので、読むときは必ず ?? で今の段から補う。
   */
  maxStep: number;
  /** 接触回数 (メール+電話) */
  touches: number;
  lastTouchAt: string | null;
  /** 次にやる日 (ISO 日付)。追客はここで並ぶ */
  nextActionAt: string | null;
  nextActionLabel: string;

  /** 直近に入れた金額。見込み (商談中・提案ずみ) の集計に使う */
  dealYen: number;
  /**
   * 単発で受注した金額の累計。
   * 1つの dealYen に上書きしていると、初回受注した会社が月額に上がった瞬間に
   * 単発の実績が消える (同じ欄を月額で塗りつぶすため)。だから別に積む。
   */
  oneOffYen: number;
  /** 金額を入れて受注した単発の件数。平均単価の分母 (0円のまま数えない) */
  oneOffCount: number;
  /** 現在の月額 (MONTHLY / OEM で更新)。単発とは単位が違うので絶対に足さない */
  mrrYen: number;
  lostReason: string;

  createdAt: string;
  updatedAt: string;
}

/** 一覧・ダッシュボード用の軽い行 (sales:idx ハッシュに入れる) */
export interface CompanyRow {
  id: string;
  name: string;
  url: string;
  industry: string;
  targetTier: TargetTier;
  stage: Stage;
  /** 到達した最高段。失注しても消えない (Company.maxStep と同じ) */
  maxStep: number;
  score: number;
  touches: number;
  nextActionAt: string | null;
  nextActionLabel: string;
  dealYen: number;
  /** 単発受注の累計 / 件数 / 現在の月額 (Company と同じ) */
  oneOffYen: number;
  oneOffCount: number;
  mrrYen: number;
  updatedAt: string;
  hasPlans: boolean;
  hasEmail: boolean;
  hasCall: boolean;
}

// ---- ダッシュボード ------------------------------------------------------
export interface FunnelRow { stage: Stage; label: string; count: number }

export interface TodayLead {
  row: CompanyRow;
  reason: string[];
  action: 'call' | 'email' | 'followup' | 'analyze';
  actionLabel: string;
  recommendedPlan: string;
}

export interface Mission {
  call: number;
  email: number;
  followup: number;
  meeting: number;
  analyze: number;
}

export interface TodayResponse {
  asOf: string;
  leads: TodayLead[];
  mission: Mission;
  kpi: {
    todayTouched: number;
    todayCalls: number;
    todayEmails: number;
    replies: number;
    meetings: number;
    won: number;
    monthly: number;
    oem: number;
    replyRatePct: number;
    winRatePct: number;
    pipelineYen: number;
    /** 単発受注 (TRIAL/WON) の合計。月額とは単位が違うので必ず分けて持つ */
    oneOffYen: number;
    /** 月額継続・OEM の月額合計 (MRR) */
    mrrYen: number;
    /** 単発1件あたりの平均。月額は混ぜない */
    avgOneOffYen: number;
  };
  funnel: FunnelRow[];
  overdue: number;
  total: number;
}

// ---- 学習 / 週次レポート -------------------------------------------------
export interface IndustryStat {
  industry: string;
  companies: number;
  contacted: number;
  replied: number;
  meetings: number;
  won: number;
  replyRatePct: number;
  meetingRatePct: number;
  winRatePct: number;
  /** 単発1件あたりの平均。月額とは単位が違うので混ぜない */
  avgOneOffYen: number;
  /** この区分の月額合計 (MRR) */
  mrrYen: number;
  /** 母数が小さすぎて率を読んではいけない */
  tooSmall: boolean;
}

export interface ReportResponse {
  asOf: string;
  weekFrom: string;
  weekTo: string;
  totals: {
    added: number;
    contacted: number;
    replied: number;
    meetings: number;
    proposals: number;
    won: number;
    monthly: number;
    oem: number;
    lost: number;
    /** 単発受注の合計 (累計) */
    oneOffYen: number;
    /** 月額継続・OEM の月額合計 (MRR・累計) */
    mrrYen: number;
  };
  byIndustry: IndustryStat[];
  byTier: IndustryStat[];
  lostReasons: Array<{ reason: string; count: number }>;
  /** データから機械的に出した「来週ここに寄せる」提案 */
  recommendations: string[];
  /** 母数不足で何も言えないときの正直な断り書き */
  notes: string[];
}
