import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, CheckSquare, Flag, Lightbulb, AlertTriangle,
  PlusCircle, ArrowRight, type LucideIcon,
} from 'lucide-react';
import type { KnowledgeItem, Persona } from '../types/identity';
import { severityOf, SEVERITY_LABELS, type RiskSeverity } from '../lib/riskPriority';

interface Props {
  persona: Persona;
  items: KnowledgeItem[];
  onAcceptAction: (action: string) => void;
  onOpenKnowledge: () => void;
}

type Tab = 'insights' | 'strategy' | 'actions' | 'risks';

// 待っている間に出す「いま何をしているか」。
// KnowledgeBase の STAGE_LABEL は社内語 (タグ生成 / 抽出) なので、
// 初見の人にそのまま見せず、やさしい言葉に置き換えたものをここに持つ。
const WORKING_LABEL: Record<NonNullable<KnowledgeItem['analysisStatus']>, string> = {
  pending:     'AI が資料を読みはじめています',
  parsing:     'AI が資料を読んでいます',
  tagging:     'AI が話題ごとに仕分けています',
  summarizing: 'AI が要点をまとめています',
  extracting:  'AI が数字と、やる事を取り出しています',
  done:        'まとめ終わりました',
  error:       '読み取れませんでした',
};

interface Bucket {
  text: string;
  source: string; // タイトル
  sourceId: string;
  severity?: RiskSeverity;        // risks 専用
  severityScore?: number;          // ソート用
}

export default function InsightsStream({ persona, items, onAcceptAction, onOpenKnowledge }: Props) {
  const [tab, setTab] = useState<Tab>('actions');

  const buckets = useMemo(() => {
    const ins: Bucket[] = [];
    const str: Bucket[] = [];
    const act: Bucket[] = [];
    const rsk: Bucket[] = [];
    for (const item of items) {
      if (!item.analysis) continue;
      for (const x of item.analysis.insights) ins.push({ text: x, source: item.title, sourceId: item.id });
      for (const x of item.analysis.strategy) str.push({ text: x, source: item.title, sourceId: item.id });
      for (const x of item.analysis.actions) act.push({ text: x, source: item.title, sourceId: item.id });
      for (const x of item.analysis.risks) {
        const sev = severityOf(x);
        rsk.push({
          text: x,
          source: item.title,
          sourceId: item.id,
          severity: sev,
          severityScore: SEVERITY_LABELS[sev].score,
        });
      }
    }
    // risks のみ重要度順に並べ替え (オーナー指示 2026-06-03)
    rsk.sort((a, b) => (b.severityScore || 0) - (a.severityScore || 0));
    return { insights: ins, strategy: str, actions: act, risks: rsk };
  }, [items]);

  // 4 つのタブは「言葉」だけだと何が入っているか分からない (洞察? 戦略? の違いが伝わらない)。
  // 絵文字をやめて線画アイコンに統一し、タブごとに 1 行の説明と、
  // 空だったときの「ここに何が出るはずか」までセットで持たせる。(2026-08-12 わかりやすさ回)
  const TABS: {
    id: Tab; label: string; Icon: LucideIcon; color: string; data: Bucket[];
    hint: string; emptyHint: string;
  }[] = [
    {
      id: 'actions', label: 'やる事', Icon: CheckSquare, color: '#34d399', data: buckets.actions,
      hint: '資料の中から見つけた「今すぐ動けること」。押すと、やる事リストに入ります。',
      emptyHint: '「やる事」は、資料に期限や担当が書かれていると見つかります。',
    },
    {
      id: 'strategy', label: '打ち手', Icon: Flag, color: persona.accentColor, data: buckets.strategy,
      hint: 'すぐには終わらないけれど、長い目で効いてくる打ち手です。',
      emptyHint: '「打ち手」は、事業計画や提案書のような、先の話が書かれた資料から出ます。',
    },
    {
      id: 'insights', label: '気づき', Icon: Lightbulb, color: '#c9a96e', data: buckets.insights,
      hint: '資料を読んで分かった事実です。まず現状を掴みたいときに見ます。',
      emptyHint: '「気づき」は、数字や実績が書かれた資料から出ます。',
    },
    {
      id: 'risks', label: '危ないところ', Icon: AlertTriangle, color: '#f87171', data: buckets.risks,
      hint: '先に気づいておきたい所です。危険度の高い順に並べています。',
      emptyHint: '「危ないところ」は、契約書や見積のような、約束事が書かれた資料から出ます。',
    },
  ];

  const total = buckets.insights.length + buckets.strategy.length + buckets.actions.length + buckets.risks.length;

  if (items.length === 0) {
    return null;
  }

  if (total === 0) {
    const working = items.find(i =>
      i.analysisStatus === 'pending' ||
      i.analysisStatus === 'parsing' ||
      i.analysisStatus === 'tagging' ||
      i.analysisStatus === 'summarizing' ||
      i.analysisStatus === 'extracting'
    );
    return (
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      >
        {working ? (
          // 待っている間、「今 AI が何をしているか」を必ず出す。
          // 「分析しています」だけだと、固まったのか動いているのか分からず離脱する。
          <div className="flex items-start gap-2.5">
            <span
              className="flex-shrink-0 mt-0.5 rounded-full animate-spin"
              style={{
                width: 14, height: 14,
                border: `2px solid ${persona.accentColor}`,
                borderTopColor: 'transparent',
              }}
            />
            <div className="min-w-0">
              <p className="text-fg text-sm font-medium">{WORKING_LABEL[working.analysisStatus || 'pending']}</p>
              <p className="text-fg-muted text-xs mt-1 leading-relaxed">
                いま読んでいるのは「{working.title}」です。<br />
                だいたい 30 秒ほどで、やる事・打ち手・気づき・危ないところに分けて出します。
              </p>
            </div>
          </div>
        ) : (
          // 読み終わったのに何も出なかった時。ここで終わると行き止まりになるので、
          // 「なぜ出なかったか」と「次にどうするか」を必ず置く。
          <div>
            <p className="text-fg text-sm font-medium">取り出せることが見つかりませんでした</p>
            <p className="text-fg-muted text-xs mt-1.5 leading-relaxed">
              いまの資料は、写真だけ・文字がとても少ない、といった内容かもしれません。<br />
              数字や日付、決めごとが書かれた資料をもう 1 つ足すと、ここに中身が出ます。
            </p>
            <button
              onClick={onOpenKnowledge}
              className="mt-3 text-sm rounded-lg inline-flex items-center gap-1.5 px-4"
              style={{
                minHeight: 44,
                background: `${persona.accentColor}22`,
                color: persona.accentColor,
                border: `1px solid ${persona.accentColor}55`,
              }}
            >
              <PlusCircle size={15} strokeWidth={2.2} />資料をもう 1 つ足す
            </button>
          </div>
        )}
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === tab)!;
  const currentData = currentTab.data;

  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        {/* 「ナレッジから抽出」だけでは、何が起きた結果なのか分からない。
            どこから来た情報かを 1 行で言い切る。 */}
        <div className="min-w-0">
          <p className="text-fg text-sm font-medium flex items-center gap-1.5">
            <BookOpen size={15} strokeWidth={2.1} style={{ color: '#5BA8FF' }} />
            読ませた資料から、AI が取り出したこと
          </p>
          <p className="text-fg-muted text-xs mt-0.5">
            {items.length} 件の資料を読んで、{total} 件見つけました
          </p>
        </div>
        <button
          onClick={onOpenKnowledge}
          className="text-fg-muted hover:text-fg text-xs flex-shrink-0 inline-flex items-center gap-1 px-2"
          style={{ minHeight: 44 }}
        >
          もとの資料を見る<ArrowRight size={12} strokeWidth={2.2} />
        </button>
      </div>

      {/* タブ */}
      <div className="flex gap-1 px-3 pb-1.5 overflow-x-auto">
        {TABS.map(t => {
          const active = tab === t.id;
          const TabIcon = t.Icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 rounded-md text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{
                minHeight: 44,
                background: active ? `${t.color}25` : 'var(--surface)',
                color: active ? t.color : 'var(--fg-muted)',
                border: `1px solid ${active ? t.color + '50' : 'var(--border)'}`,
              }}
            >
              <TabIcon size={14} strokeWidth={2.2} />
              <span>{t.label}</span>
              <span className="opacity-60">{t.data.length}</span>
            </button>
          );
        })}
      </div>

      {/* 選んでいるタブが「何のことか」を 1 行で言う。
          タブ名だけだと、打ち手と気づきの違いが初見の人には分からない。 */}
      <p className="px-3 pb-2 text-fg-muted text-xs leading-relaxed">{currentTab.hint}</p>

      {/* 内容 */}
      <div className="px-3 pb-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="grid grid-cols-1 md:grid-cols-2 gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {currentData.length === 0 && (
              // このタブだけ空のとき。ここで終わると「壊れている」ように見えるので、
              // 何が出るはずかを言い、中身が入っている隣のタブへ必ず逃がす。
              <div className="col-span-full py-3">
                <p className="text-fg text-sm font-medium">この中には、まだ何もありません</p>
                <p className="text-fg-muted text-xs mt-1 leading-relaxed">{currentTab.emptyHint}</p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {TABS.filter(t => t.id !== tab && t.data.length > 0).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className="text-xs rounded-lg inline-flex items-center gap-1.5 px-3"
                      style={{
                        minHeight: 44,
                        background: `${t.color}20`,
                        color: t.color,
                        border: `1px solid ${t.color}50`,
                      }}
                    >
                      <t.Icon size={13} strokeWidth={2.2} />
                      {t.label}なら {t.data.length} 件あります
                    </button>
                  ))}
                  <button
                    onClick={onOpenKnowledge}
                    className="text-xs rounded-lg inline-flex items-center gap-1.5 px-3 text-fg-muted"
                    style={{ minHeight: 44, background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <PlusCircle size={13} strokeWidth={2.2} />資料を足す
                  </button>
                </div>
              </div>
            )}
            {currentData.slice(0, 12).map((b, i) => {
              const isAction = tab === 'actions';
              const isRisk = tab === 'risks' && b.severity;
              const sevMeta = isRisk ? SEVERITY_LABELS[b.severity!] : null;
              const borderColor = sevMeta ? sevMeta.color : currentTab.color;
              return (
                <motion.div
                  key={`${b.sourceId}-${i}`}
                  className="rounded-lg p-2.5 flex items-start gap-2 group"
                  style={{
                    background: sevMeta ? `${sevMeta.color}10` : 'var(--surface)',
                    border: `1px solid ${borderColor}${sevMeta ? '40' : '25'}`,
                    borderLeftWidth: sevMeta ? 3 : 1,
                    borderLeftColor: borderColor,
                  }}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  {sevMeta ? (
                    <span
                      className="flex-shrink-0 rounded font-bold tracking-wider"
                      style={{
                        background: sevMeta.color,
                        color: '#fff',
                        fontSize: 9,
                        padding: '2px 6px',
                        lineHeight: 1.4,
                        minWidth: 40,
                        textAlign: 'center',
                      }}
                    >
                      {sevMeta.label}
                    </span>
                  ) : (
                    <span className="flex-shrink-0 mt-0.5" style={{ color: currentTab.color }}>
                      <currentTab.Icon size={15} strokeWidth={2.1} />
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-fg text-sm leading-snug">{b.text}</p>
                    <p className="text-fg-muted text-xs mt-1 truncate">— {b.source}</p>
                  </div>
                  {isAction && (
                    // 以前は opacity-0 + group-hover で、ホバーの無い iPhone では
                    // 「見えないのに押せるボタン」になっていた。常に見せる。
                    // 文言も「＋追加」では何に追加されるか分からないので言い切る。
                    <button
                      onClick={() => onAcceptAction(b.text)}
                      className="text-xs px-2.5 rounded transition-all flex-shrink-0 inline-flex items-center gap-1 whitespace-nowrap"
                      style={{
                        minHeight: 44,
                        background: `${currentTab.color}25`,
                        color: currentTab.color,
                        border: `1px solid ${currentTab.color}50`,
                      }}
                    >
                      <PlusCircle size={12} strokeWidth={2.4} />やる事に入れる
                    </button>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {currentData.length > 12 && (
          // 「資料画面で詳細を見る」と書いてあるのに押せない文字だった。押せるようにする。
          <div className="text-center mt-2">
            <button
              onClick={onOpenKnowledge}
              className="text-fg-muted hover:text-fg text-xs inline-flex items-center gap-1 px-3"
              style={{ minHeight: 44 }}
            >
              残り {currentData.length - 12} 件を資料画面で見る<ArrowRight size={12} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
