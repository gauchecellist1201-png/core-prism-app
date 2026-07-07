// ============================================================
// IRIS — Reel Director (リール監督モード) UI
//
// AI 台本を、カット単位で仕上げてそのまま撮影・編集に渡せる
// 「Canva の文字入れ × CapCut のタイムライン × Edits の書き出し」体験。
//   ① 構成テンプレ (2025-26 に伸びている型・なぜ伸びるか付き)
//   ② カット横並びタイムライン (秒数/画角/セリフ/テロップ/切替)
//   ③ 9:16 見え方プレビュー + テロップスタイル (完成イメージの確認)
//   ④ 書き出しハブ (SRT/テロップ/カット表/本文) + 貼り方手順
//   ⑤ ルールベース仕上げチェック (AI 演出の嘘なし)
// モバイル最優先: 375px・タップ44px・入力16px。
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp, Clapperboard, Clock,
  Copy, FileText, Layers, ListChecks, MessageSquare, Plus, Smartphone,
  Sparkles, Trash2, Type as TypeIcon, X,
} from 'lucide-react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { notifyInApp } from '../lib/inAppNotify';
import type { ProductionScript, ScriptShot } from './scriptStudio';
import {
  scriptToProject, projectToShots, totalDuration, cutUid,
  REEL_TEMPLATES, applyTemplate,
  TELOP_STYLES, loadTelopFont, type TelopStyleId,
  TRANSITIONS, type TransitionId,
  runReelChecks,
  projectToSrt, projectTelopText, projectToCutSheet, projectCaptionBlock,
  type ReelCut, type ReelProject,
} from './reelDirector';

interface Props {
  bg: IrisBackgroundDef;
  script: ProductionScript;
  clientName?: string;
  /** カット編集を台本へ書き戻す (既存のコピー動線も最新化される) */
  onShotsChange?: (shots: ScriptShot[], durationSec: number) => void;
}

const IRIS_GRADIENT = 'linear-gradient(135deg, #E1306C 0%, #F77737 50%, #FBBF24 100%)';

/** クリップボードへ (silent fail 禁止: 成功も失敗も必ず通知) */
function copyText(text: string, okTitle: string, okBody: string): void {
  if (!text.trim()) {
    notifyInApp({ kind: 'info', title: 'コピーする内容がありません', body: 'テロップやセリフを入れてからお試しください' });
    return;
  }
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => notifyInApp({ kind: 'success', title: okTitle, body: okBody }))
      .catch(() => notifyInApp({ kind: 'warn', title: 'コピーできませんでした', body: 'ブラウザのコピー権限をご確認ください' }));
  } else {
    notifyInApp({ kind: 'info', title: 'コピー未対応のブラウザ', body: 'テキストを手動で選択してください' });
  }
}

export default function IrisReelDirector({ bg, script, clientName, onShotsChange }: Props) {
  const [project, setProject] = useState<ReelProject>(() => scriptToProject(script));
  const [selectedId, setSelectedId] = useState<string | null>(() => scriptToProject(script).cuts[0]?.id ?? null);
  const [telopStyleId, setTelopStyleId] = useState<TelopStyleId>('subtitle');
  const [guideOpen, setGuideOpen] = useState<'capcut' | 'edits' | null>(null);
  const initRef = useRef(false);

  // 選択中カット (無ければ先頭)
  const selected = project.cuts.find(c => c.id === selectedId) || project.cuts[0] || null;
  const selectedIdx = selected ? project.cuts.findIndex(c => c.id === selected.id) : -1;
  const telopStyle = TELOP_STYLES.find(s => s.id === telopStyleId) || TELOP_STYLES[1];
  const total = totalDuration(project.cuts);
  const durationOk = total >= 15 && total <= 30;
  const checks = useMemo(() => runReelChecks(project), [project]);
  const passCount = checks.filter(c => c.pass).length;

  // テロップスタイルのフォントをオンデマンド読込
  useEffect(() => { loadTelopFont(telopStyle); }, [telopStyle]);

  // 編集を親の台本へ書き戻し (初回マウント時は書き戻さない)
  useEffect(() => {
    if (!initRef.current) { initRef.current = true; return; }
    onShotsChange?.(projectToShots(project), Math.round(total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // ─── カット操作 ───
  const updateCut = (id: string, patch: Partial<ReelCut>) => {
    setProject(p => ({ ...p, cuts: p.cuts.map(c => c.id === id ? { ...c, ...patch } : c) }));
  };
  const moveCut = (id: string, dir: -1 | 1) => {
    setProject(p => {
      const idx = p.cuts.findIndex(c => c.id === id);
      const ni = idx + dir;
      if (idx < 0 || ni < 0 || ni >= p.cuts.length) return p;
      const next = p.cuts.slice();
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return { ...p, cuts: next };
    });
  };
  const removeCut = (id: string) => {
    setProject(p => {
      const next = p.cuts.filter(c => c.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id ?? null);
      return { ...p, cuts: next };
    });
  };
  const addCut = () => {
    const c: ReelCut = { id: cutUid(), durationSec: 2, shot: '', line: '', telop: '', transition: 'cut', editNote: '' };
    setProject(p => ({ ...p, cuts: [...p.cuts, c] }));
    setSelectedId(c.id);
  };
  const applyTpl = (tplId: string) => {
    const tpl = REEL_TEMPLATES.find(t => t.id === tplId);
    if (!tpl) return;
    setProject(p => ({ ...p, templateId: tplId, cuts: applyTemplate(p.cuts, tpl) }));
  };

  // ─── styles ───
  const card: React.CSSProperties = {
    background: bg.card, backdropFilter: 'blur(10px)',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 20, padding: '1.2rem',
  };
  const sectionLabel: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6,
    fontFamily: IRIS_FONTS.serif, fontStyle: 'italic', fontSize: '0.76rem',
    letterSpacing: '0.2em', textTransform: 'uppercase', color: bg.accent, marginBottom: '0.6rem',
  };
  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.94)', border: `1px solid ${bg.cardBorder}`,
    color: '#1F1A2E', padding: '0.55rem 0.75rem', borderRadius: 10,
    fontSize: 16, // iOS Safari 自動ズーム回避
    fontFamily: IRIS_FONTS.body, outline: 'none', width: '100%', minHeight: 44,
  };
  const chip = (on: boolean): React.CSSProperties => ({
    flexShrink: 0, minHeight: 44, padding: '8px 14px', borderRadius: 999,
    border: `1px solid ${on ? 'transparent' : bg.cardBorder}`,
    background: on ? IRIS_GRADIENT : 'rgba(255,255,255,0.75)',
    color: on ? '#fff' : bg.ink,
    fontSize: '0.82rem', fontFamily: IRIS_FONTS.body, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
    boxShadow: on ? '0 6px 16px rgba(225,48,108,0.3)' : 'none',
    transition: 'all 0.15s',
  });
  const iconBtn = (disabled = false): React.CSSProperties => ({
    width: 44, height: 44, borderRadius: 12,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: disabled ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.92)',
    color: bg.ink, border: `1px solid ${bg.cardBorder}`,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, padding: 0,
  });
  const copyBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    minHeight: 52, padding: '0.7rem 0.9rem',
    background: 'rgba(255,255,255,0.85)', color: bg.ink,
    border: `1px solid ${bg.cardBorder}`, borderRadius: 14,
    fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer',
    fontFamily: IRIS_FONTS.body, textAlign: 'left',
  };

  if (!project.cuts.length) {
    return (
      <div style={card}>
        <p style={{ color: bg.inkSoft, fontSize: '0.86rem', lineHeight: 1.6, margin: 0 }}>
          カットがありません。台本を作り直すか、下の「カットを足す」から始めてください。
        </p>
        <button onClick={addCut} style={{ ...copyBtn, marginTop: 10, justifyContent: 'center' }}>
          <Plus size={15} /> カットを足す
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.1rem' }}>

      {/* ── ① 構成テンプレ (今伸びている型) ── */}
      <div style={card}>
        <p style={sectionLabel}><Sparkles size={13} /> 今伸びている構成に整える</p>
        <p style={{ fontSize: '0.78rem', color: bg.inkSoft, lineHeight: 1.55, margin: '0 0 10px' }}>
          型を選ぶと<strong style={{ color: bg.ink }}>秒数のリズム</strong>を今の台本に合わせ直します（書いたセリフ・テロップは消しません）。
        </p>
        <div className="iris-rd-row" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none' }}>
          {REEL_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => applyTpl(t.id)} style={chip(project.templateId === t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {project.templateId && (() => {
          const t = REEL_TEMPLATES.find(x => x.id === project.templateId);
          if (!t) return null;
          return (
            <div style={{
              marginTop: 8, padding: '0.55rem 0.75rem',
              background: `${bg.accent}0E`, border: `1px solid ${bg.accent}33`,
              borderRadius: 10, fontSize: '0.78rem', color: bg.ink, lineHeight: 1.55,
            }}>
              <strong style={{ color: bg.accent }}>なぜ伸びる:</strong> {t.why}
            </div>
          );
        })()}
      </div>

      {/* ── ② カット・タイムライン ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <p style={{ ...sectionLabel, marginBottom: 0 }}><Clapperboard size={13} /> カット編集</p>
          {/* 合計秒数 (常時表示・正直な警告) */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.8rem', fontWeight: 800,
            color: durationOk ? '#047857' : '#B45309',
            background: durationOk ? 'rgba(16,185,129,0.13)' : 'rgba(245,158,11,0.14)',
            border: `1px solid ${durationOk ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.4)'}`,
            padding: '5px 11px', borderRadius: 999,
          }}>
            <Clock size={13} /> 合計 {total.toFixed(1)}秒
          </span>
        </div>
        {!durationOk && (
          <p style={{ fontSize: '0.75rem', color: '#B45309', margin: '4px 0 8px', lineHeight: 1.5 }}>
            {total < 15
              ? `リールは 15〜30秒 が最適です。あと ${(15 - total).toFixed(1)}秒 足りません。`
              : `リールは 15〜30秒 が最適です。${(total - 30).toFixed(1)}秒 オーバーしています。`}
          </p>
        )}

        {/* カットの横並びサムネ (タップで選択) */}
        <div className="iris-rd-row" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 2px 8px', scrollbarWidth: 'none' }}>
          {project.cuts.map((c, i) => {
            const on = selected?.id === c.id;
            return (
              <React.Fragment key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  style={{
                    flexShrink: 0, width: 76, minHeight: 96,
                    padding: '8px 6px', borderRadius: 12,
                    background: on ? IRIS_GRADIENT : 'rgba(255,255,255,0.8)',
                    color: on ? '#fff' : bg.ink,
                    border: `1.5px solid ${on ? 'transparent' : bg.cardBorder}`,
                    cursor: 'pointer', fontFamily: IRIS_FONTS.body,
                    boxShadow: on ? '0 6px 16px rgba(225,48,108,0.32)' : '0 1px 4px rgba(0,0,0,0.05)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 900, opacity: 0.85 }}>カット{i + 1}</span>
                  <span style={{ fontSize: 15, fontWeight: 900 }}>{c.durationSec.toFixed(1)}s</span>
                  <span style={{
                    fontSize: 9.5, fontWeight: 700, lineHeight: 1.25,
                    opacity: 0.9, textAlign: 'center',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', wordBreak: 'break-all',
                  }}>
                    {(c.telop || c.shot || '未入力').slice(0, 14)}
                  </span>
                </button>
                {/* カット間の切替バッジ */}
                {i < project.cuts.length - 1 && (
                  <span style={{
                    alignSelf: 'center', flexShrink: 0,
                    fontSize: 8.5, fontWeight: 800, color: bg.accent,
                    background: `${bg.accent}14`, border: `1px solid ${bg.accent}33`,
                    borderRadius: 6, padding: '2px 4px', maxWidth: 44,
                    textAlign: 'center', lineHeight: 1.2,
                  }}>
                    {TRANSITIONS.find(t => t.id === c.transition)?.label || 'カット'}
                  </span>
                )}
              </React.Fragment>
            );
          })}
          <button onClick={addCut} title="カットを足す" style={{
            ...iconBtn(false), flexShrink: 0, alignSelf: 'center',
            width: 44, height: 96, borderRadius: 12, borderStyle: 'dashed',
            color: bg.accent,
          }}>
            <Plus size={18} />
          </button>
        </div>

        {/* 選択中カットの編集パネル */}
        {selected && (
          <div style={{
            marginTop: 6, padding: '0.9rem',
            background: 'rgba(255,255,255,0.7)', border: `1px solid ${bg.accent}44`,
            borderRadius: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 900, color: bg.accent }}>カット {selectedIdx + 1}</span>
              <span style={{ fontSize: '0.72rem', color: bg.inkSoft }}>並べ替え:</span>
              <button onClick={() => moveCut(selected.id, -1)} disabled={selectedIdx === 0} title="左へ" style={iconBtn(selectedIdx === 0)}>
                <ArrowLeft size={15} />
              </button>
              <button onClick={() => moveCut(selected.id, 1)} disabled={selectedIdx === project.cuts.length - 1} title="右へ" style={iconBtn(selectedIdx === project.cuts.length - 1)}>
                <ArrowRight size={15} />
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={() => removeCut(selected.id)} title="このカットを削除" style={{ ...iconBtn(false), color: '#DC2626', borderColor: '#FCA5A5' }}>
                <Trash2 size={15} />
              </button>
            </div>

            {/* (a) 秒数 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: bg.inkSoft, minWidth: 34 }}>秒数</span>
              <button
                onClick={() => updateCut(selected.id, { durationSec: Math.max(0.5, Math.round((selected.durationSec - 0.5) * 10) / 10 ) })}
                style={iconBtn(selected.durationSec <= 0.5)} disabled={selected.durationSec <= 0.5} title="0.5秒短く"
              ><ChevronDown size={15} /></button>
              <input
                type="range" min={0.5} max={10} step={0.1}
                value={selected.durationSec}
                onChange={e => updateCut(selected.id, { durationSec: Number(e.target.value) })}
                style={{ flex: 1, minHeight: 44, accentColor: bg.accent }}
              />
              <button
                onClick={() => updateCut(selected.id, { durationSec: Math.min(10, Math.round((selected.durationSec + 0.5) * 10) / 10) })}
                style={iconBtn(selected.durationSec >= 10)} disabled={selected.durationSec >= 10} title="0.5秒長く"
              ><ChevronUp size={15} /></button>
              <span style={{ fontSize: '0.86rem', fontWeight: 900, color: bg.ink, minWidth: 40, textAlign: 'right' }}>
                {selected.durationSec.toFixed(1)}s
              </span>
            </div>

            {/* (b) 画角・撮り方 */}
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.inkSoft, display: 'block', marginBottom: 4 }}>画角・撮り方</label>
            <input
              style={{ ...inp, marginBottom: 10 }}
              value={selected.shot}
              onChange={e => updateCut(selected.id, { shot: e.target.value })}
              placeholder="例: 顔寄り / 手元アップ / 全身引き / 俯瞰"
            />

            {/* (c) セリフ */}
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.inkSoft, display: 'block', marginBottom: 4 }}>セリフ・ナレーション</label>
            <textarea
              style={{ ...inp, marginBottom: 10, resize: 'none', lineHeight: 1.5 }}
              rows={2}
              value={selected.line}
              onChange={e => updateCut(selected.id, { line: e.target.value })}
              placeholder="話す内容 (無ければ空でOK)"
            />

            {/* (d) テロップ + 文字数カウント */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.inkSoft }}>テロップ (画面に載せる文字)</label>
              <span style={{
                fontSize: '0.72rem', fontWeight: 800,
                color: (selected.telop || '').replace(/\s/g, '').length > 13 ? '#DC2626' : bg.inkSoft,
              }}>
                {(selected.telop || '').replace(/\s/g, '').length}/13字
              </span>
            </div>
            <input
              style={{
                ...inp, marginBottom: 10,
                borderColor: (selected.telop || '').replace(/\s/g, '').length > 13 ? '#FCA5A5' : bg.cardBorder,
              }}
              value={selected.telop}
              onChange={e => updateCut(selected.id, { telop: e.target.value })}
              placeholder="一瞬で読める短さに (13字以内)"
            />

            {/* (e) 次のカットへの切替効果 */}
            {selectedIdx < project.cuts.length - 1 ? (
              <>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: bg.inkSoft, display: 'block', marginBottom: 4 }}>
                  次のカットへの切り替え
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {TRANSITIONS.map(t => {
                    const on = selected.transition === t.id;
                    return (
                      <button key={t.id} onClick={() => updateCut(selected.id, { transition: t.id as TransitionId })} style={chip(on)}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, margin: '2px 0 0', lineHeight: 1.5 }}>
                  {TRANSITIONS.find(t => t.id === selected.transition)?.desc}
                </p>
              </>
            ) : (
              <p style={{ fontSize: '0.72rem', color: bg.inkSoft, margin: 0 }}>最後のカットです (切替効果はありません)</p>
            )}
          </div>
        )}
      </div>

      {/* ── ③ 見え方プレビュー + テロップスタイル ── */}
      <div style={card}>
        <p style={sectionLabel}><Smartphone size={13} /> 見え方プレビュー</p>
        <p style={{
          fontSize: '0.72rem', color: bg.inkSoft, lineHeight: 1.55,
          margin: '0 0 12px', padding: '0.45rem 0.65rem',
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8,
        }}>
          これは<strong style={{ color: bg.ink }}>完成イメージの確認</strong>です (動画そのものの編集ではありません)。
          このスタイルを CapCut / Edits で再現する手順は下の「書き出し」にあります。
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* 9:16 スマホ枠 */}
          <div style={{ width: 'min(200px, 52vw)', margin: '0 auto' }}>
            <div style={{
              position: 'relative', paddingTop: '177.7%',
              background: 'linear-gradient(160deg, #201428 0%, #101016 60%, #1c0f1a 100%)',
              borderRadius: 24, overflow: 'hidden',
              boxShadow: '0 20px 44px rgba(225,48,108,0.16), 0 0 0 6px rgba(255,255,255,0.85), 0 0 0 7px rgba(225,48,108,0.18)',
            }}>
              {selected ? (
                <>
                  {/* 撮る画の説明 (素材のかわり・正直表示) */}
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 6, padding: '1.4rem 1rem 30%',
                    textAlign: 'center',
                  }}>
                    <span style={{
                      fontSize: 9, letterSpacing: '0.25em', fontWeight: 800,
                      color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase',
                    }}>カット{selectedIdx + 1} ・ {selected.durationSec.toFixed(1)}s</span>
                    <span style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5,
                      fontFamily: IRIS_FONTS.body, fontWeight: 600,
                    }}>
                      {selected.shot ? `ここに「${selected.shot}」の映像` : 'ここに映像が入ります'}
                    </span>
                    {selected.line && (
                      <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, fontStyle: 'italic' }}>
                        セリフ:「{selected.line.slice(0, 40)}{selected.line.length > 40 ? '…' : ''}」
                      </span>
                    )}
                  </div>
                  {/* テロップ (選択スタイルで重ねる) */}
                  {(selected.telop || '').trim() && (
                    <div style={{
                      position: 'absolute', left: 10, right: 10, bottom: '16%',
                      display: 'flex', justifyContent: 'center', pointerEvents: 'none',
                    }}>
                      <span style={{
                        fontFamily: telopStyle.fontFamily,
                        fontWeight: telopStyle.fontWeight,
                        fontSize: `clamp(11px, ${telopStyle.fontSize * 0.075}vw + ${telopStyle.fontSize * 0.55}px, ${telopStyle.fontSize}px)`,
                        color: telopStyle.color,
                        textShadow: telopStyle.textShadow,
                        background: telopStyle.background,
                        padding: telopStyle.padding,
                        borderRadius: telopStyle.borderRadius,
                        letterSpacing: telopStyle.letterSpacing,
                        textAlign: 'center', lineHeight: 1.3, wordBreak: 'break-all',
                      }}>
                        {selected.telop}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)', fontSize: 12,
                }}>カットを選んでください</div>
              )}
            </div>
          </div>

          {/* テロップスタイル (Canva 風プリセット) */}
          <div style={{ flex: 1, minWidth: 180 }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.74rem', fontWeight: 800, color: bg.ink, margin: '0 0 8px' }}>
              <TypeIcon size={13} color={bg.accent} /> テロップのスタイル
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {TELOP_STYLES.map(s => {
                const on = telopStyleId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setTelopStyleId(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      minHeight: 48, padding: '0.5rem 0.75rem',
                      background: on ? `${bg.accent}14` : 'rgba(255,255,255,0.75)',
                      border: `1.5px solid ${on ? bg.accent : bg.cardBorder}`,
                      borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                      fontFamily: IRIS_FONTS.body,
                    }}
                  >
                    {/* スタイル見本 (そのスタイル自身で描く) */}
                    <span style={{
                      flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 58, height: 30, borderRadius: 6,
                      background: s.background ? '#2A2230' : 'linear-gradient(140deg, #33203a, #191420)',
                    }}>
                      <span style={{
                        fontFamily: s.fontFamily, fontWeight: s.fontWeight,
                        fontSize: Math.min(13, s.fontSize * 0.55),
                        color: s.color, textShadow: s.textShadow,
                        background: s.background, padding: s.background ? '1px 5px' : undefined,
                        borderRadius: s.borderRadius ? 3 : undefined,
                        letterSpacing: s.letterSpacing,
                      }}>Aa</span>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: bg.ink }}>{s.label}</span>
                      <span style={{ display: 'block', fontSize: '0.68rem', color: bg.inkSoft, lineHeight: 1.4 }}>{s.desc}</span>
                    </span>
                    {on && <Check size={16} color={bg.accent} style={{ flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── ⑤ 仕上げチェック (ルールベース・正直) ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <p style={{ ...sectionLabel, marginBottom: 0 }}><ListChecks size={13} /> 仕上げチェック</p>
          <span style={{
            fontSize: '0.78rem', fontWeight: 900,
            color: passCount === checks.length ? '#047857' : bg.ink,
          }}>{passCount}/{checks.length} クリア</span>
        </div>
        <p style={{ fontSize: '0.7rem', color: bg.inkSoft, margin: '4px 0 10px' }}>
          伸びるリールの定石をルールで機械判定します (AI の推測ではありません)。
        </p>
        <div style={{ display: 'grid', gap: 6 }}>
          {checks.map(c => (
            <div key={c.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '0.55rem 0.7rem',
              background: c.pass ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.09)',
              border: `1px solid ${c.pass ? 'rgba(16,185,129,0.28)' : 'rgba(245,158,11,0.32)'}`,
              borderRadius: 10,
            }}>
              {c.pass
                ? <Check size={15} color="#047857" strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />
                : <X size={15} color="#B45309" strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: bg.ink, lineHeight: 1.45 }}>{c.label}</p>
                {!c.pass && c.fix && (
                  <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#92600A', lineHeight: 1.5 }}>{c.fix}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ④ 書き出し (CapCut / Edits へ) ── */}
      <div style={card}>
        <p style={sectionLabel}><Layers size={13} /> 書き出し — CapCut / Edits へ</p>
        <div style={{ display: 'grid', gap: 8 }}>
          <button
            onClick={() => copyText(projectToSrt(project), '字幕 (SRT) をコピーしました', 'CapCut / Edits の字幕読み込みに貼れます')}
            style={{ ...copyBtn, background: IRIS_GRADIENT, color: '#fff', border: 'none', boxShadow: '0 8px 22px rgba(225,48,108,0.3)' }}
          >
            <FileText size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 800 }}>字幕 (SRT) をコピー</span>
              <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.9 }}>タイミング付き字幕。編集アプリに読み込むだけ</span>
            </span>
            <Copy size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
          </button>
          <button onClick={() => copyText(projectTelopText(project), 'テロップ全文をコピーしました', '1行=1カット。テキスト機能に順に貼れます')} style={copyBtn}>
            <TypeIcon size={16} color={bg.accent} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block' }}>テロップ全文をコピー</span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: bg.inkSoft }}>1行=1カット (手貼り用)</span>
            </span>
            <Copy size={14} color={bg.inkSoft} style={{ flexShrink: 0 }} />
          </button>
          <button onClick={() => copyText(projectToCutSheet(project, clientName), '撮影指示書をコピーしました', '撮影・編集担当にそのまま渡せます')} style={copyBtn}>
            <Clapperboard size={16} color={bg.accent} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block' }}>撮影指示書 (カット表) をコピー</span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: bg.inkSoft }}>秒数・画角・セリフ・切替の全部入り</span>
            </span>
            <Copy size={14} color={bg.inkSoft} style={{ flexShrink: 0 }} />
          </button>
          <button onClick={() => copyText(projectCaptionBlock(project), '投稿本文をコピーしました', 'Instagram の投稿欄にそのまま貼れます')} style={copyBtn}>
            <MessageSquare size={16} color={bg.accent} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block' }}>投稿本文 + ハッシュタグをコピー</span>
              <span style={{ display: 'block', fontSize: '0.7rem', color: bg.inkSoft }}>投稿するときの本文</span>
            </span>
            <Copy size={14} color={bg.inkSoft} style={{ flexShrink: 0 }} />
          </button>
        </div>

        {/* 貼り方手順 (その場に表示) */}
        <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          {([
            {
              id: 'capcut' as const,
              title: 'CapCut / CapCut Web への貼り方',
              steps: [
                '素材 (撮った動画) を読み込み、カット表どおりの順・秒数に並べる',
                'テキスト → 「自動キャプション」の隣にある「ローカル字幕をインポート」で SRT を貼る (Web 版は「字幕」→「ファイル/テキストから」)',
                'SRT が使えない場合は「テキスト追加」にテロップ全文を1行ずつ貼る',
                'カットの間をタップ → 「トランジション」から指示書と同名の効果 (ズームイン・スライド等) を選ぶ',
                '書き出しは 1080×1920 (9:16)・30fps でOK',
              ],
            },
            {
              id: 'edits' as const,
              title: 'Edits (Meta 公式) への貼り方',
              steps: [
                '新規プロジェクト → クリップを読み込み、カット表の順・秒数に整える',
                '「キャプション」で自動生成 → 内容をテロップ全文に合わせて直す (Edits は SRT 直接読込に非対応のため手貼り)',
                'クリップの間の「切り替え」から指示書と同名の効果を選ぶ',
                'Edits からそのまま Instagram に下書き共有できます (投稿本文はコピーして貼る)',
              ],
            },
          ]).map(g => (
            <div key={g.id} style={{ border: `1px solid ${bg.cardBorder}`, borderRadius: 12, overflow: 'hidden' }}>
              <button
                onClick={() => setGuideOpen(guideOpen === g.id ? null : g.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  minHeight: 48, padding: '0.6rem 0.85rem',
                  background: 'rgba(255,255,255,0.7)', border: 'none',
                  fontSize: '0.8rem', fontWeight: 800, color: bg.ink,
                  cursor: 'pointer', fontFamily: IRIS_FONTS.body, textAlign: 'left',
                }}
              >
                <span style={{ flex: 1 }}>{g.title}</span>
                {guideOpen === g.id ? <ChevronUp size={15} color={bg.inkSoft} /> : <ChevronDown size={15} color={bg.inkSoft} />}
              </button>
              {guideOpen === g.id && (
                <ol style={{
                  margin: 0, padding: '0.7rem 0.9rem 0.85rem 2rem',
                  background: 'rgba(255,255,255,0.5)',
                  color: bg.ink, fontSize: '0.78rem', lineHeight: 1.7,
                  display: 'grid', gap: 4,
                }}>
                  {g.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`.iris-rd-row::-webkit-scrollbar{display:none}`}</style>
    </div>
  );
}
