// ============================================================
// CORE Prism — 統合ナレッジ脳 ビュー (knowledge-brain)
//
// フォルダを丸ごと取り込み → 全資料を横断して「統合して考える」。
// 最上位プラン (Studio) 限定。それ未満はアップグレード案内を表示。
// ============================================================
import { useCallback, useRef, useState } from 'react';
import type { SVGProps } from 'react';
import type { Persona, KnowledgeItem, AppSettings, PersonaId } from '../types/identity';
import { checkFeature, type PlanId } from '../lib/billing';
import { filterIngestible, synthesizeKnowledge, generateBrainInsights } from './knowledgeBrain';

const GRAD = 'linear-gradient(135deg, #A78BFA, #6366F1)';
const INK = '#1e1b3a';
const SUB = '#6b6890';

// ── Lucide 風ラインアイコン (絵文字不使用) ──────────────────
const svgBase = (size: number): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round',
});
function BrainIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg {...svgBase(size)} style={{ color, flex: 'none' }} aria-hidden>
      <path d="M9.5 3.5A2.5 2.5 0 0 0 7 6a2.5 2.5 0 0 0-1.5 4.5A2.5 2.5 0 0 0 7 15a2.5 2.5 0 0 0 2.5 2.5V3.5Z" />
      <path d="M14.5 3.5A2.5 2.5 0 0 1 17 6a2.5 2.5 0 0 1 1.5 4.5A2.5 2.5 0 0 1 17 15a2.5 2.5 0 0 1-2.5 2.5V3.5Z" />
      <path d="M12 3.5v14" />
    </svg>
  );
}
function FolderIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg {...svgBase(size)} style={{ color, flex: 'none' }} aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}
function SparkIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg {...svgBase(size)} style={{ color, flex: 'none' }} aria-hidden>
      <path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z" />
    </svg>
  );
}

interface Props {
  persona: Persona;
  plan: PlanId;
  knowledgeItems: KnowledgeItem[];
  settings: AppSettings;
  addFilesBulk: (
    personaId: PersonaId,
    files: File[],
    onProgress?: (done: number, total: number, currentName: string) => void,
  ) => Promise<{ added: number; skipped: number; failed: number }>;
  onClose: () => void;
  onUpgrade: () => void;
}

export default function KnowledgeBrainView({ persona, plan, knowledgeItems, settings, addFilesBulk, onClose, onUpgrade }: Props) {
  const gate = checkFeature(plan, 'knowledge-brain');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [ingestResult, setIngestResult] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [thinking, setThinking] = useState(false);
  const [stepModel, setStepModel] = useState('');
  const [insights, setInsights] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);
  const [error, setError] = useState('');

  // 取り込んだ資料の件数 (この人格 + 全体)
  const myItems = knowledgeItems.filter(i => i.personaId === persona.id);

  // ── フォルダ取り込み ──────────────────────────────
  const onPickFolder = useCallback(() => fileInputRef.current?.click(), []);

  const onFilesPicked = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = filterIngestible(fileList);
    if (files.length === 0) {
      setIngestResult('読み取れる資料 (md / txt / pdf / Word / Excel / CSV など) が見つかりませんでした。');
      return;
    }
    setIngesting(true);
    setIngestResult(null);
    setError('');
    try {
      const res = await addFilesBulk(persona.id, files, (done, total, name) => setProgress({ done, total, name }));
      const parts = [`${res.added}件を取り込みました`];
      if (res.skipped) parts.push(`${res.skipped}件はスキップ (取り込み済み/空)`);
      if (res.failed) parts.push(`${res.failed}件は読み取り失敗`);
      setIngestResult(parts.join(' / '));
    } catch {
      setError('取り込み中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setIngesting(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addFilesBulk, persona.id]);

  // ── 統合して考える ────────────────────────────────
  const onAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || thinking) return;
    setThinking(true);
    setAnswer('');
    setError('');
    setStepModel('');
    try {
      const res = await synthesizeKnowledge(myItems, q, settings, { onStep: (m) => setStepModel(m) });
      setAnswer(res.answer);
    } catch {
      setError('AI が混雑しています。少し待って再度お試しください。右上の歯車から無料の Gemini キーを登録すると安定します。');
    } finally {
      setThinking(false);
      setStepModel('');
    }
  }, [question, thinking, myItems, settings]);

  const onInsights = useCallback(async () => {
    if (insightLoading || myItems.length === 0) return;
    setInsightLoading(true);
    setInsights('');
    setError('');
    try {
      setInsights(await generateBrainInsights(myItems, settings));
    } catch {
      setError('要約の生成に失敗しました。もう一度お試しください。');
    } finally {
      setInsightLoading(false);
    }
  }, [insightLoading, myItems, settings]);

  // ── 共通レイアウト枠 ──────────────────────────────
  const shell = (children: React.ReactNode) => (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(20,18,40,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 680, maxHeight: '92svh', overflowY: 'auto',
          background: '#fff', color: INK,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderBottomLeftRadius: 'min(22px, env(safe-area-inset-bottom, 0px))',
          padding: '0 0 calc(env(safe-area-inset-bottom, 0px) + 20px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* ヘッダー */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2, background: GRAD, color: '#fff',
          padding: '16px 18px', borderTopLeftRadius: 22, borderTopRightRadius: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrainIcon size={26} color="#fff" />
            <div>
              <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: '0.01em' }}>統合ナレッジ脳</div>
              <div style={{ fontSize: 11.5, opacity: 0.9 }}>取り込んだ全資料を横断して、まとめて考えます</div>
            </div>
          </div>
          <button onClick={onClose} aria-label="閉じる" style={{
            width: 44, height: 44, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 20, fontWeight: 700,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );

  // ── 最上位プラン未満: アップグレード案内 ──────────
  if (gate.unavailable) {
    return shell(
      <div style={{ padding: '22px 20px' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>この機能は Studio プラン限定です</div>
        <p style={{ fontSize: 13.5, lineHeight: 1.75, color: SUB, margin: '0 0 16px' }}>
          「統合ナレッジ脳」は、あなたのフォルダを<strong style={{ color: INK }}>丸ごと取り込み</strong>、
          事業計画・収支・議事録・メモなど<strong style={{ color: INK }}>すべての資料を横断して統合的に考える</strong>、最上位プランの中核機能です。
        </p>
        <ul style={{ fontSize: 13, lineHeight: 1.9, color: INK, paddingLeft: 18, margin: '0 0 18px' }}>
          <li>デスクトップのフォルダを選ぶだけで全資料を自動ナレッジ化</li>
          <li>「この事業の弱点は?」と聞けば、全資料を突き合わせて回答</li>
          <li>複数資料をまたいだ相乗効果・矛盾・抜け漏れを自動抽出</li>
        </ul>
        <button onClick={onUpgrade} style={{
          width: '100%', minHeight: 52, borderRadius: 14, border: 'none', cursor: 'pointer',
          background: GRAD, color: '#fff', fontWeight: 900, fontSize: 16,
        }}>Studio プランを見る</button>
      </div>,
    );
  }

  // ── 本体 ──────────────────────────────────────────
  return shell(
    <div style={{ padding: '18px 18px 8px' }}>
      {/* 取り込みカード */}
      <div style={{ border: '1px solid #ece9fb', borderRadius: 16, padding: 16, marginBottom: 16, background: '#faf9ff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5 }}>① フォルダを取り込む</div>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#6366F1' }}>資料 {myItems.length} 件</span>
        </div>
        <p style={{ fontSize: 12.5, color: SUB, margin: '0 0 12px', lineHeight: 1.65 }}>
          デスクトップのフォルダを選ぶと、中の資料 (md / txt / PDF / Word / Excel / CSV / JSON) を自動で読み取りナレッジに追加します。中身は端末内に保存され、勝手に外部送信しません。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          // @ts-expect-error — webkitdirectory はフォルダ選択用の非標準属性 (Chrome/Safari 対応)
          webkitdirectory=""
          directory=""
          style={{ display: 'none' }}
          onChange={(e) => onFilesPicked(e.target.files)}
        />
        <button onClick={onPickFolder} disabled={ingesting} style={{
          width: '100%', minHeight: 50, borderRadius: 13, cursor: ingesting ? 'default' : 'pointer',
          border: 'none', background: ingesting ? '#cfcae8' : GRAD, color: '#fff', fontWeight: 800, fontSize: 15,
        }}>
          {ingesting ? '取り込み中…' : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><FolderIcon size={18} color="#fff" />フォルダを丸ごと取り込む</span>
          )}
        </button>
        {progress && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 6, borderRadius: 6, background: '#e7e3fb', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: GRAD, transition: 'width .2s' }} />
            </div>
            <div style={{ fontSize: 11.5, color: SUB, marginTop: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {progress.done}/{progress.total}　{progress.name}
            </div>
          </div>
        )}
        {ingestResult && <div style={{ fontSize: 12.5, color: '#16a34a', marginTop: 10, fontWeight: 700 }}>✓ {ingestResult}</div>}
      </div>

      {/* 統合して考える */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 8 }}>② 全部を統合して考える</div>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例: 全資料を踏まえて、今月いちばん優先すべき打ち手は? / この事業計画の弱点と抜け漏れは?"
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box', borderRadius: 13, border: '1px solid #ddd7f3',
            padding: '12px 14px', fontSize: 16, lineHeight: 1.6, resize: 'vertical', color: INK,
            fontFamily: 'inherit',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button onClick={onAsk} disabled={thinking || !question.trim()} style={{
            flex: 1, minWidth: 160, minHeight: 50, borderRadius: 13, border: 'none',
            cursor: thinking || !question.trim() ? 'default' : 'pointer',
            background: thinking || !question.trim() ? '#cfcae8' : GRAD, color: '#fff', fontWeight: 800, fontSize: 15,
          }}>
            {thinking ? (stepModel ? `${stepModel} で考え中…` : '統合して考え中…') : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><BrainIcon size={18} color="#fff" />統合して答える</span>
            )}
          </button>
          <button onClick={onInsights} disabled={insightLoading || myItems.length === 0} style={{
            minHeight: 50, padding: '0 16px', borderRadius: 13, border: '1px solid #c7bff0',
            cursor: insightLoading || myItems.length === 0 ? 'default' : 'pointer',
            background: '#fff', color: '#6366F1', fontWeight: 800, fontSize: 14,
          }}>
            {insightLoading ? '抽出中…' : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SparkIcon size={15} color="#6366F1" />重要点を自動抽出</span>
            )}
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: 12.5, color: '#dc2626', background: '#fef2f2', borderRadius: 10, padding: '10px 12px', marginBottom: 12, lineHeight: 1.6 }}>{error}</div>}

      {answer && (
        <div style={{ border: '1px solid #ece9fb', borderRadius: 14, padding: 16, marginBottom: 14, background: '#fff' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#6366F1', marginBottom: 8 }}>統合した答え</div>
          <div style={{ fontSize: 14, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{answer}</div>
        </div>
      )}

      {insights && (
        <div style={{ border: '1px solid #ece9fb', borderRadius: 14, padding: 16, marginBottom: 14, background: 'linear-gradient(180deg,#faf9ff,#fff)' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#6366F1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><SparkIcon size={14} color="#6366F1" />全資料からの重要点</div>
          <div style={{ fontSize: 14, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{insights}</div>
        </div>
      )}

      {/* 空状態を“触れる入口”に：何をすれば効くか＋貯める→効くループを伝える（白紙を見せない） */}
      {myItems.length === 0 && !ingesting && (
        <div style={{ border: '1px dashed #d8d2f5', borderRadius: 14, padding: 16, background: '#faf9ff', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>まだ知識がありません</div>
          <div style={{ fontSize: 12.5, color: SUB, lineHeight: 1.8 }}>
            上の<strong style={{ color: '#6366F1' }}>「フォルダを丸ごと取り込む」</strong>で会議メモや資料を入れると、Prismがそれを
            <strong style={{ color: '#6366F1' }}>根拠に</strong>提案・回答します。入れるほど賢くなります（貯める→効く）。
          </div>
        </div>
      )}

      {/* 取り込み済み一覧 */}
      {myItems.length > 0 && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: 12.5, color: SUB, cursor: 'pointer', padding: '6px 0' }}>取り込み済みの資料 {myItems.length} 件を見る</summary>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 6 }}>
            {myItems.slice(0, 200).map(it => (
              <div key={it.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f1eefb', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                <span style={{ color: SUB, flexShrink: 0 }}>{it.tags.slice(0, 2).join('/') || it.fileKind || ''}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>,
  );
}
