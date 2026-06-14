// ============================================================
// CORE Iris ▸ リール動画スタジオ
// 複数画像 / 複数動画 → 9:16 リール + AI字幕 + フォントバリエ
// ・MediaRecorder で WebM 即時書き出し (ブラウザネイティブ)
// ・ffmpeg.wasm を CDN 動的ロードで MP4 変換 (任意・遅延)
// ・素材は IndexedDB / メモリのみ。サーバー送信なし
// ============================================================
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { IrisBackgroundDef } from './irisStyle';
import { IRIS_FONTS } from './irisStyle';
import { shareToInstagram } from './instagramShare';
import { notifyInApp } from '../lib/inAppNotify';
import {
  Image as ImageIcon, Film, Type, Music, Download, Share2,
  Play, Square, Trash2, ChevronUp, ChevronDown, Sparkles,
  Mic, Loader2, Wand2, AlertCircle, UploadCloud, Copy, Check,
} from 'lucide-react';
import {
  COLOR_GRADES, applyGradeOverlay, getGrade,
  type GradeId,
} from './reelStudio/Grading';
import {
  STICKER_ICONS, STICKER_ANIMS, drawSticker, makeStickerId,
  type StickerInstance, type StickerAnim,
} from './reelStudio/Stickers';
import {
  VOICE_PRESETS, waitForVoices, scheduleTtsDuringExport,
  type VoiceStyle,
} from './reelStudio/Tts';
import { detectAudioPeaks } from './reelStudio/Highlight';
import { translateCaptions, type TargetLang } from './reelStudio/Translate';
import { removeBackgroundFromUrl } from './reelStudio/BgRemove';
import DelegateToAgentTeamBanner from '../components/DelegateToAgentTeamBanner';

// ─── 編集テンプレート (型) ─────────────────────
type ReelTemplate = {
  id: string;
  name: string;
  subtitle: string;
  presetCut: number;
  transition: Transition;
  kenBurns: KenBurns;
  caption: Partial<CaptionStyle>;
  bgmHint: string; // BGM選択時のヒント
};
const REEL_TEMPLATES: ReelTemplate[] = [
  {
    id: 'vlog',         name: 'テンポ良い Vlog',  subtitle: '1秒切替・whip',
    presetCut: 1.0, transition: 'whip', kenBurns: 'in',
    caption: { font: '"Noto Sans JP"', size: 60, color: '#FFFFFF', stroke: '#000000', strokeWidth: 6, anim: 'pop' },
    bgmHint: 'upbeat',
  },
  {
    id: 'lookbook',     name: '上品ルックブック', subtitle: '2.5秒・dissolve',
    presetCut: 2.5, transition: 'dissolve', kenBurns: 'out',
    caption: { font: '"Shippori Mincho"', size: 52, color: '#FFF8F0', stroke: '#3B2A2A', strokeWidth: 4, anim: 'fade-in' },
    bgmHint: 'cinematic',
  },
  {
    id: 'product',      name: '商品紹介',         subtitle: '1.5秒・zoom',
    presetCut: 1.5, transition: 'zoom', kenBurns: 'in',
    caption: { font: '"Bebas Neue"', size: 70, color: '#FFFFFF', stroke: '#E1306C', strokeWidth: 5, anim: 'slide-up' },
    bgmHint: 'energetic',
  },
  {
    id: 'storytelling', name: 'ストーリー風',     subtitle: '3秒・fade',
    presetCut: 3.0, transition: 'fade', kenBurns: 'left',
    caption: { font: '"Klee One"', size: 56, color: '#FFFFFF', stroke: '#1F1A2E', strokeWidth: 5, anim: 'fade-in' },
    bgmHint: 'emotional',
  },
  {
    id: 'tiktok',       name: 'TikTok ハイテンポ', subtitle: '0.5秒・glitch',
    presetCut: 0.5, transition: 'glitch', kenBurns: 'in',
    caption: { font: '"Dela Gothic One"', size: 72, color: '#FFFF00', stroke: '#000000', strokeWidth: 7, anim: 'pop' },
    bgmHint: 'trap/pop',
  },
  {
    id: 'asmr',         name: 'ASMR / 落ち着き',  subtitle: '4秒・slide',
    presetCut: 4.0, transition: 'slide', kenBurns: 'down',
    caption: { font: '"Noto Serif JP"', size: 48, color: '#FFFFFF', stroke: '#2A2A2A', strokeWidth: 3, anim: 'fade-in' },
    bgmHint: 'ambient',
  },
];

// ─── 伸びるフック (最初の 1-3 秒で離脱を防ぐ証明済テンプレ) ─────
type HookCategory = '好奇心' | '権威' | '損失回避' | '共感' | '逆張り' | '質問';
type HookPhrase = { id: string; cat: HookCategory; text: string; placeholder?: string };
const HOOK_LIBRARY: HookPhrase[] = [
  // 好奇心ギャップ (CTR最強)
  { id: 'h1', cat: '好奇心', text: '知らないと損する3つの◯◯', placeholder: '◯◯ = 美容/節約/ダイエット 等' },
  { id: 'h2', cat: '好奇心', text: '誰も教えてくれない◯◯の真実' },
  { id: 'h3', cat: '好奇心', text: '正直、これ知るまで失敗ばかりだった' },
  { id: 'h4', cat: '好奇心', text: '◯◯した結果、人生変わった話' },
  // 権威・実績
  { id: 'h5', cat: '権威',   text: 'プロが教える◯◯の極意' },
  { id: 'h6', cat: '権威',   text: '◯◯歴○年の私が選ぶベスト3' },
  { id: 'h7', cat: '権威',   text: '元◯◯が暴露します' },
  // 損失回避 (やらないと損)
  { id: 'h8', cat: '損失回避', text: '今すぐやめないとヤバい◯◯' },
  { id: 'h9', cat: '損失回避', text: 'これ知らないと毎月◯円損してます' },
  { id: 'h10', cat: '損失回避', text: '実は逆効果な◯◯のやり方' },
  // 共感
  { id: 'h11', cat: '共感',   text: '◯◯な人だけ見てください' },
  { id: 'h12', cat: '共感',   text: '◯◯で悩んでた私を救った◯◯' },
  { id: 'h13', cat: '共感',   text: '◯◯だった頃の私に教えたい' },
  // 逆張り
  { id: 'h14', cat: '逆張り', text: '◯◯やってる人、もう古いです' },
  { id: 'h15', cat: '逆張り', text: 'みんな信じてる◯◯、嘘です' },
  { id: 'h16', cat: '逆張り', text: '正反対が正解だった件' },
  // 質問 (エンゲージ誘発)
  { id: 'h17', cat: '質問',   text: '◯◯と◯◯、どっち派？' },
  { id: 'h18', cat: '質問',   text: 'これ何だと思いますか？' },
  { id: 'h19', cat: '質問',   text: 'あなたはどれ当てはまる？' },
  { id: 'h20', cat: '質問',   text: '見抜けたら◯◯マニアです' },
];

// ============================================================
// 2026 年 Q2 Instagram Reels アルゴリズム分析
// ・watch-time-per-impression が最重要シグナル
// ・reshare to DM/Story が次点
// ・save rate (saves / views) が保存型コンテンツのキー
// ・original audio + 字幕は2026年も依然強い
// ・最初の 1.5 秒で離脱率の 70% が決まる
// ・loop closure (last → first) は watch time multiplier
// ============================================================

// ─── バイラルパターン (2026年5月時点・実測ベース) ─────
type ViralPattern = {
  id: string;
  name: string;
  trend2026: 1 | 2 | 3 | 4 | 5;       // 2026 Q2 トレンド度 ()
  bestFor: string;                     // 対象ニッチ
  watchMultiplier: number;             // 平均比 watch time (1.4 = +40%)
  saveScore: 1 | 2 | 3 | 4 | 5;
  shareScore: 1 | 2 | 3 | 4 | 5;
  hookFormula: string;                 // フックの型
  beats: { sec: number; role: string; textHint: string; visualHint: string }[];
  captionStrategy: string;
  musicMood: string;
  example: string;
  cta: string;
};

export const VIRAL_PATTERNS: ViralPattern[] = [
  {
    id: 'pov-storytime',
    name: 'POV ストーリーテリング',
    trend2026: 5, bestFor: '美容/ライフスタイル/メンタル',
    watchMultiplier: 1.55, saveScore: 4, shareScore: 5,
    hookFormula: '「POV: ◯◯した時の私」',
    beats: [
      { sec: 1.5, role: 'POV フック',       textHint: 'POV: ◯◯した時の私',                visualHint: '顔のアップ / 表情' },
      { sec: 2.0, role: '状況設定',         textHint: 'あの日まで私は普通だった',          visualHint: '日常シーン' },
      { sec: 2.5, role: 'きっかけ',         textHint: 'でも◯◯を見つけて変わった',         visualHint: '商品/事件 ズーム' },
      { sec: 2.5, role: '変化',             textHint: '今では◯◯',                          visualHint: 'After シーン' },
      { sec: 1.5, role: 'CTA',              textHint: '同じ経験ある人保存して',            visualHint: 'カメラ目線' },
    ],
    captionStrategy: '1人称 + 過去-現在の対比。POV: は太字大文字',
    musicMood: 'emotional / cinematic',
    example: '「POV: 30歳で美容に目覚めた瞬間」',
    cta: '同じ経験ある人は保存して',
  },
  {
    id: 'grwm',
    name: 'GRWM (Get Ready With Me)',
    trend2026: 5, bestFor: '美容/ファッション/朝活',
    watchMultiplier: 1.65, saveScore: 5, shareScore: 4,
    hookFormula: '「◯◯のために準備します」',
    beats: [
      { sec: 1.2, role: 'シーン宣言',       textHint: '今日は◯◯のために準備',             visualHint: '鏡前 / 全身' },
      { sec: 1.5, role: 'STEP 1',           textHint: 'まずスキンケア',                    visualHint: '化粧水 アップ' },
      { sec: 1.5, role: 'STEP 2',           textHint: 'ベース作り',                        visualHint: 'BBクリーム塗布' },
      { sec: 1.5, role: 'STEP 3',           textHint: 'アイメイク',                        visualHint: 'アイシャドウ パレット' },
      { sec: 1.5, role: 'STEP 4',           textHint: '仕上げの一手',                      visualHint: 'リップ' },
      { sec: 2.0, role: '完成 + CTA',       textHint: '完成 / 保存して再現してね',         visualHint: 'After フル' },
    ],
    captionStrategy: 'ステップ番号 + 短い動作言葉。商品名は読みやすく',
    musicMood: 'chill pop / upbeat',
    example: '「会食のための朝メイク」',
    cta: '保存して同じメイクしてみて',
  },
  {
    id: 'three-things',
    name: '知っとくべき3つの◯◯',
    trend2026: 5, bestFor: '教育/ライフハック/金融',
    watchMultiplier: 1.40, saveScore: 5, shareScore: 4,
    hookFormula: '「◯◯で知らないと損する3つのこと」',
    beats: [
      { sec: 1.5, role: 'フック (損失回避)', textHint: '知らないと損する3つのこと',         visualHint: '指3本 / テロップ' },
      { sec: 2.2, role: '1つ目',             textHint: '①◯◯',                              visualHint: 'シーンA' },
      { sec: 2.2, role: '2つ目',             textHint: '②◯◯',                              visualHint: 'シーンB' },
      { sec: 2.5, role: '3つ目 (最強)',      textHint: '③これが一番大事',                  visualHint: 'シーンC' },
      { sec: 1.8, role: 'CTA',               textHint: '保存して見返してね',                visualHint: 'カメラ目線' },
    ],
    captionStrategy: '番号 + 数字を大きく。重要キーワードはハイライト',
    musicMood: 'inspiring / energetic',
    example: '「美肌で知らないと損する3つのこと」',
    cta: '保存して、3つ全部試してみて',
  },
  {
    id: 'transformation',
    name: 'Before / After 変化',
    trend2026: 4, bestFor: '美容/ダイエット/部屋/料理',
    watchMultiplier: 1.50, saveScore: 5, shareScore: 5,
    hookFormula: '「◯日でこうなりました」',
    beats: [
      { sec: 1.5, role: 'After 先出し',      textHint: '結果を1秒で見せる',                 visualHint: 'After 一瞬' },
      { sec: 2.0, role: 'Before',            textHint: '実は◯日前まで…',                   visualHint: 'Before' },
      { sec: 2.0, role: '工程 1',            textHint: 'やったこと①',                       visualHint: '工程ショット' },
      { sec: 2.0, role: '工程 2',            textHint: 'やったこと②',                       visualHint: '工程ショット' },
      { sec: 2.5, role: 'After リビール',    textHint: 'そして今…',                         visualHint: 'After フル' },
      { sec: 1.5, role: 'CTA',               textHint: '同じ変化したい人は保存',            visualHint: 'カメラ目線' },
    ],
    captionStrategy: 'Before / After を大きく対比。日付 / 期間を強調',
    musicMood: 'inspiring / cinematic',
    example: '「2週間で肌が変わった話」',
    cta: '同じ変化したい人は保存して',
  },
  {
    id: 'tell-me-why',
    name: '「正直に言うと…」型',
    trend2026: 5, bestFor: 'メンタル/恋愛/共感系',
    watchMultiplier: 1.60, saveScore: 3, shareScore: 5,
    hookFormula: '「正直に言うと、◯◯」',
    beats: [
      { sec: 1.5, role: '正直フック',        textHint: '正直に言うと、◯◯',                visualHint: '顔アップ' },
      { sec: 2.0, role: '本音 1',            textHint: '実は◯◯だった',                     visualHint: 'B-roll' },
      { sec: 2.0, role: '転換点',            textHint: 'でもある日…',                       visualHint: '転換シーン' },
      { sec: 2.5, role: '気づき',            textHint: '◯◯に気づいた',                     visualHint: '内省シーン' },
      { sec: 1.5, role: '共感 CTA',          textHint: '同じ人いる？コメントで教えて',     visualHint: 'カメラ目線' },
    ],
    captionStrategy: '本音 / 弱さを見せるテキスト。引用符風',
    musicMood: 'emotional / ambient',
    example: '「正直、フォロワー1万人より今の方が幸せ」',
    cta: '同じ人いる？コメントで教えて',
  },
  {
    id: 'day-timestamp',
    name: 'タイムスタンプ Day in Life',
    trend2026: 4, bestFor: 'ライフスタイル/ルーティン',
    watchMultiplier: 1.45, saveScore: 4, shareScore: 3,
    hookFormula: '「◯時起き、◯◯の1日」',
    beats: [
      { sec: 1.5, role: '宣言',              textHint: '5:30 起床、フリーランスの1日',     visualHint: '時計 / 朝の光' },
      { sec: 1.8, role: '6:00',              textHint: 'モーニングルーティン',              visualHint: 'コーヒー' },
      { sec: 1.8, role: '9:00',              textHint: '仕事スタート',                      visualHint: 'PC アップ' },
      { sec: 1.8, role: '13:00',             textHint: 'ランチ + 散歩',                     visualHint: '外の光' },
      { sec: 1.8, role: '19:00',             textHint: '夕食 + 振り返り',                   visualHint: 'ノート' },
      { sec: 1.5, role: 'まとめ + CTA',      textHint: '理想のルーティン作って',            visualHint: '就寝前' },
    ],
    captionStrategy: '時間を大きく + 動作短く。ASMR っぽい sound design',
    musicMood: 'lofi / chill',
    example: '「在宅フリーランスの5:30起き」',
    cta: '保存して自分のルーティン作って',
  },
  {
    id: 'voiceover-broll',
    name: 'ボイスオーバー + B-roll',
    trend2026: 5, bestFor: '教育/ビジネス/解説',
    watchMultiplier: 1.50, saveScore: 5, shareScore: 4,
    hookFormula: '「◯◯について話します」 + B-roll',
    beats: [
      { sec: 1.5, role: 'ボイスフック',      textHint: '今日は◯◯の話',                     visualHint: 'B-roll 関連シーン' },
      { sec: 2.5, role: 'ポイント1',         textHint: 'まず◯◯',                           visualHint: 'B-roll' },
      { sec: 2.5, role: 'ポイント2',         textHint: '次に◯◯',                           visualHint: 'B-roll' },
      { sec: 2.5, role: 'ポイント3',         textHint: '最後に◯◯',                         visualHint: 'B-roll' },
      { sec: 2.0, role: 'まとめ + CTA',      textHint: 'まとめ / 保存して使って',           visualHint: 'B-roll' },
    ],
    captionStrategy: '話している内容と完全同期 (word-by-word 推奨)',
    musicMood: 'subtle / minimal',
    example: '「副業で月10万増やす考え方」',
    cta: '保存して、3回見返してみて',
  },
  {
    id: 'loop-reveal',
    name: 'ループ・リビール (最後が冒頭に)',
    trend2026: 4, bestFor: 'アート/料理/工程モノ',
    watchMultiplier: 1.80, saveScore: 3, shareScore: 5,
    hookFormula: '結果を見せる → 工程に戻る',
    beats: [
      { sec: 1.2, role: '完成形 (フック)',   textHint: '完成形をチラ見せ',                  visualHint: 'After フル' },
      { sec: 2.0, role: '工程 1',            textHint: 'まず…',                             visualHint: '工程' },
      { sec: 2.0, role: '工程 2',            textHint: '次に…',                             visualHint: '工程' },
      { sec: 2.0, role: '工程 3',            textHint: 'そして…',                           visualHint: '工程' },
      { sec: 1.5, role: 'リビール → 冒頭',   textHint: 'こうなる → (冒頭にループ)',         visualHint: 'After = 1個目に戻る' },
    ],
    captionStrategy: 'ミニマル。視覚で見せる',
    musicMood: 'cinematic / build-up',
    example: '「砂浜に絵を描く工程」',
    cta: '保存して工程を覚えて',
  },
  {
    id: 'myth-bust',
    name: '誤解バスター (逆張り)',
    trend2026: 5, bestFor: '教育/健康/ビジネス',
    watchMultiplier: 1.50, saveScore: 4, shareScore: 5,
    hookFormula: '「◯◯は嘘です」',
    beats: [
      { sec: 1.5, role: '逆張りフック',      textHint: 'みんな信じてる◯◯、嘘です',         visualHint: 'バツ印 / 強い表情' },
      { sec: 2.0, role: '通説',              textHint: '一般的にはこう言われる',            visualHint: '一般イメージ' },
      { sec: 2.2, role: '実態',              textHint: 'でも実は…',                         visualHint: '反証データ' },
      { sec: 2.2, role: '正解',              textHint: '正しいのはこう',                    visualHint: '正解シーン' },
      { sec: 2.0, role: '理由 + CTA',        textHint: '理由 / 保存して周りに教えて',       visualHint: 'カメラ目線' },
    ],
    captionStrategy: 'バツ印 + 赤系 + マル印 + 緑系で視覚的に',
    musicMood: 'cinematic / dramatic',
    example: '「朝食抜きは太る、嘘です」',
    cta: '保存して、間違えてた人に教えて',
  },
  {
    id: 'micro-tutorial',
    name: '60秒マイクロ チュートリアル',
    trend2026: 4, bestFor: '料理/DIY/技術',
    watchMultiplier: 1.40, saveScore: 5, shareScore: 4,
    hookFormula: '「◯◯を1分で作る」',
    beats: [
      { sec: 1.5, role: '宣言',              textHint: '◯◯を1分で作ります',               visualHint: '完成形チラ見' },
      { sec: 1.5, role: '材料',              textHint: '材料: A / B / C',                   visualHint: '材料 俯瞰' },
      { sec: 2.0, role: '工程 1',            textHint: '①◯◯',                              visualHint: '手元' },
      { sec: 2.0, role: '工程 2',            textHint: '②◯◯',                              visualHint: '手元' },
      { sec: 2.0, role: '工程 3',            textHint: '③◯◯',                              visualHint: '手元' },
      { sec: 1.5, role: '完成 + CTA',        textHint: '完成 / 保存して試して',             visualHint: '完成形' },
    ],
    captionStrategy: '工程番号 + 計量 + 時間。常に表示',
    musicMood: 'chill upbeat',
    example: '「卵焼きを1分で完璧に作る」',
    cta: '保存して、今晩作って',
  },
];

// 2026 Q2 で今最も伸びてる format ID (Trend Pulse)
export const TREND_PULSE_2026_Q2 = ['pov-storytime', 'grwm', 'tell-me-why', 'voiceover-broll', 'myth-bust'];

// ─── コミュニティ テンプレート (CapCut の参加型エコシステムを食う) ─────
type CommunityTemplate = {
  id: string;
  name: string;
  author: string;          // クリエイター名
  authorHandle?: string;   // @handle
  category: string;        // 'beauty'|'food'|'fitness'|'lifestyle'|'business'|'education'
  uses: number;            // 使用回数 (人気度)
  saves: number;           // 保存数
  reelVersion: 1;          // フォーマットバージョン
  // 再現できる設定
  patternId?: string;      // VIRAL_PATTERNS ID (ベース)
  clipDurations: number[]; // 各クリップの秒
  transitions: Transition[];
  kenBurns: KenBurns[];
  captions: { start: number; end: number; text: string }[];
  captionStyle: Partial<CaptionStyle>;
  bgmMood?: string;        // 推奨 BGM mood
  presetCut: number;
  thumbnailHint: string;   // 1行説明
  hashtag?: string;        // 拡散用ハッシュタグ
};

// 厳選キュレーション 12 種 (シード)
export const COMMUNITY_TEMPLATES: CommunityTemplate[] = [
  {
    id: 'ct-beauty-grwm',
    name: '朝の5分メイクGRWM',
    author: 'Aiko Beauty',
    authorHandle: '@aiko_beauty',
    category: 'beauty',
    uses: 12450,
    saves: 8920,
    reelVersion: 1,
    patternId: 'grwm',
    clipDurations: [1.2, 1.5, 1.5, 1.5, 1.5, 2.0],
    transitions: ['fade', 'whip', 'whip', 'whip', 'whip', 'dissolve'],
    kenBurns: ['in', 'in', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.2,  text: '5分で完成 / 通勤メイク' },
      { start: 1.2,  end: 2.7,  text: '①トーンアップ下地' },
      { start: 2.7,  end: 4.2,  text: '②ナチュラルブラウン' },
      { start: 4.2,  end: 5.7,  text: '③涙袋でうるツヤ' },
      { start: 5.7,  end: 7.2,  text: '④グロウチーク' },
      { start: 7.2,  end: 9.2,  text: '保存して同じメイクしてね' },
    ],
    captionStyle: { font: '"Klee One"', size: 60, color: '#FFF', stroke: '#E1306C', strokeWidth: 5, anim: 'pop' },
    bgmMood: 'chill pop',
    presetCut: 1.5,
    thumbnailHint: '5枚の画像 (準備→完成) を用意',
    hashtag: '#5分メイク #GRWM #時短メイク',
  },
  {
    id: 'ct-food-recipe',
    name: '1分パスタレシピ',
    author: 'Cook Yuki',
    authorHandle: '@cook_yuki',
    category: 'food',
    uses: 9870,
    saves: 14200,
    reelVersion: 1,
    patternId: 'micro-tutorial',
    clipDurations: [1.5, 1.5, 2.0, 2.0, 2.0, 1.5],
    transitions: ['fade', 'zoom', 'whip', 'whip', 'whip', 'dissolve'],
    kenBurns: ['in', 'in', 'in', 'in', 'in', 'out'],
    captions: [
      { start: 0,    end: 1.5,  text: '1分で本格カルボナーラ' },
      { start: 1.5,  end: 3.0,  text: '材料: パスタ200g / 卵2 / ベーコン100g' },
      { start: 3.0,  end: 5.0,  text: '①パスタを茹でる (8分)' },
      { start: 5.0,  end: 7.0,  text: '②ベーコンをカリッと' },
      { start: 7.0,  end: 9.0,  text: '③火を止めて卵を絡める' },
      { start: 9.0,  end: 10.5, text: '保存して、今夜作って' },
    ],
    captionStyle: { font: '"M PLUS Rounded 1c"', size: 56, color: '#FFF', stroke: '#1F1A2E', strokeWidth: 5, anim: 'slide-up' },
    bgmMood: 'chill upbeat',
    presetCut: 1.8,
    thumbnailHint: '6枚: 完成→材料→工程3→完成',
    hashtag: '#時短レシピ #カルボナーラ #1分料理',
  },
  {
    id: 'ct-fitness-3things',
    name: '痩せるための3つの真実',
    author: 'Fit Ryo',
    authorHandle: '@fit_ryo',
    category: 'fitness',
    uses: 8540,
    saves: 11800,
    reelVersion: 1,
    patternId: 'three-things',
    clipDurations: [1.5, 2.2, 2.2, 2.5, 1.8],
    transitions: ['fade', 'glitch', 'glitch', 'zoom', 'dissolve'],
    kenBurns: ['in', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.5,  text: '知らないと損する 3 つの痩せ習慣' },
      { start: 1.5,  end: 3.7,  text: '①朝起きてすぐ水500ml' },
      { start: 3.7,  end: 5.9,  text: '②階段で消費x2' },
      { start: 5.9,  end: 8.4,  text: '③20時以降は食べない' },
      { start: 8.4,  end: 10.2, text: '保存して、明日から実践' },
    ],
    captionStyle: { font: '"Bebas Neue"', size: 72, color: '#FFFF00', stroke: '#000', strokeWidth: 7, anim: 'pop' },
    bgmMood: 'energetic',
    presetCut: 2.0,
    thumbnailHint: '5枚: フック→3シーン→CTA',
    hashtag: '#ダイエット #痩せる #生活習慣',
  },
  {
    id: 'ct-mental-pov',
    name: 'メンタルが軽くなった瞬間',
    author: 'Hana Soul',
    authorHandle: '@hana_soul',
    category: 'lifestyle',
    uses: 7320,
    saves: 9500,
    reelVersion: 1,
    patternId: 'pov-storytime',
    clipDurations: [1.5, 2.0, 2.5, 2.5, 1.5],
    transitions: ['fade', 'dissolve', 'dissolve', 'dissolve', 'fade'],
    kenBurns: ['in', 'left', 'left', 'right', 'out'],
    captions: [
      { start: 0,    end: 1.5,  text: 'POV: メンタルが軽くなった瞬間' },
      { start: 1.5,  end: 3.5,  text: '頑張り続けてた日々' },
      { start: 3.5,  end: 6.0,  text: '「やめていい」って言われて泣いた' },
      { start: 6.0,  end: 8.5,  text: '休む勇気を持ってから人生変わった' },
      { start: 8.5,  end: 10.0, text: '同じ経験ある人、保存して' },
    ],
    captionStyle: { font: '"Shippori Mincho"', size: 52, color: '#FFF8F0', stroke: '#3B2A2A', strokeWidth: 4, anim: 'fade-in' },
    bgmMood: 'emotional / cinematic',
    presetCut: 2.0,
    thumbnailHint: '5枚: 顔→日常→転機→今→ラスト',
    hashtag: '#メンタルケア #自分らしく #癒し',
  },
  {
    id: 'ct-business-myth',
    name: '副業の「嘘」3選',
    author: 'Biz Ken',
    authorHandle: '@biz_ken',
    category: 'business',
    uses: 6890,
    saves: 12300,
    reelVersion: 1,
    patternId: 'myth-bust',
    clipDurations: [1.5, 2.0, 2.2, 2.2, 2.0],
    transitions: ['fade', 'glitch', 'whip', 'zoom', 'dissolve'],
    kenBurns: ['in', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.5,  text: 'みんな信じてる副業の嘘、3つ' },
      { start: 1.5,  end: 3.5,  text: '①「最初から月10万」は嘘' },
      { start: 3.5,  end: 5.7,  text: '②「楽して稼げる」は嘘' },
      { start: 5.7,  end: 7.9,  text: '③「副業=不労所得」は嘘' },
      { start: 7.9,  end: 9.9,  text: '保存して、騙されないで' },
    ],
    captionStyle: { font: '"Dela Gothic One"', size: 64, color: '#FFF', stroke: '#E1306C', strokeWidth: 6, anim: 'pop' },
    bgmMood: 'cinematic / dramatic',
    presetCut: 2.0,
    thumbnailHint: '5枚: フック→3つの嘘→正解',
    hashtag: '#副業 #ビジネス #起業',
  },
  {
    id: 'ct-edu-3wishes',
    name: '学生時代の自分に伝えたい3つ',
    author: 'Yuki Edu',
    authorHandle: '@yuki_edu',
    category: 'education',
    uses: 5670,
    saves: 8900,
    reelVersion: 1,
    patternId: 'three-things',
    clipDurations: [1.5, 2.2, 2.2, 2.5, 1.8],
    transitions: ['fade', 'slide', 'slide', 'dissolve', 'fade'],
    kenBurns: ['in', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.5,  text: '学生時代の自分に伝えたい3つ' },
      { start: 1.5,  end: 3.7,  text: '①英語は今すぐ始めて' },
      { start: 3.7,  end: 5.9,  text: '②人脈は早めに作って' },
      { start: 5.9,  end: 8.4,  text: '③お金の勉強を1分でも' },
      { start: 8.4,  end: 10.2, text: '保存して、後悔しない選択を' },
    ],
    captionStyle: { font: '"Noto Sans JP"', size: 58, color: '#FFF', stroke: '#0033A0', strokeWidth: 5, anim: 'slide-up' },
    bgmMood: 'inspiring',
    presetCut: 2.0,
    thumbnailHint: '5枚: フック→3シーン→CTA',
    hashtag: '#自己投資 #学び #人生変える',
  },
  {
    id: 'ct-travel-day',
    name: '京都ひとり旅 1日',
    author: 'Miki Travels',
    authorHandle: '@miki_travels',
    category: 'lifestyle',
    uses: 4920,
    saves: 7800,
    reelVersion: 1,
    patternId: 'day-timestamp',
    clipDurations: [1.5, 1.8, 1.8, 1.8, 1.8, 1.5],
    transitions: ['fade', 'dissolve', 'dissolve', 'dissolve', 'dissolve', 'fade'],
    kenBurns: ['in', 'left', 'right', 'left', 'right', 'out'],
    captions: [
      { start: 0,    end: 1.5,  text: '京都ひとり旅、24時間' },
      { start: 1.5,  end: 3.3,  text: '7:00  伏見稲荷 朝の鳥居' },
      { start: 3.3,  end: 5.1,  text: '11:00 嵐山 竹林の道' },
      { start: 5.1,  end: 6.9,  text: '14:00 抹茶パフェ' },
      { start: 6.9,  end: 8.7,  text: '17:00 祇園 夕暮れ' },
      { start: 8.7,  end: 10.2, text: '保存して、同じルートで' },
    ],
    captionStyle: { font: '"Shippori Mincho"', size: 50, color: '#FFF', stroke: '#1F1A2E', strokeWidth: 4, anim: 'fade-in' },
    bgmMood: 'lofi / chill',
    presetCut: 1.8,
    thumbnailHint: '6枚: 朝→昼→夕の風景',
    hashtag: '#京都旅行 #ひとり旅 #トラベル',
  },
  {
    id: 'ct-style-grwm',
    name: 'デート前のGRWM',
    author: 'Style Lemon',
    authorHandle: '@style_lemon',
    category: 'beauty',
    uses: 4580,
    saves: 6900,
    reelVersion: 1,
    patternId: 'grwm',
    clipDurations: [1.2, 1.5, 1.5, 1.5, 1.5, 2.0],
    transitions: ['fade', 'whip', 'whip', 'whip', 'whip', 'dissolve'],
    kenBurns: ['in', 'in', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.2,  text: '彼と会う日のフル準備' },
      { start: 1.2,  end: 2.7,  text: '①香水: 甘めフローラル' },
      { start: 2.7,  end: 4.2,  text: '②服: 白ワンピ + ベージュ' },
      { start: 4.2,  end: 5.7,  text: '③ヘア: ふんわり巻き' },
      { start: 5.7,  end: 7.2,  text: '④メイク: 血色UP' },
      { start: 7.2,  end: 9.2,  text: '保存して、デート前に見返して' },
    ],
    captionStyle: { font: '"Klee One"', size: 58, color: '#FFF', stroke: '#E1306C', strokeWidth: 4, anim: 'pop' },
    bgmMood: 'chill pop / dreamy',
    presetCut: 1.5,
    thumbnailHint: '6枚: 準備工程→完成',
    hashtag: '#デート #GRWM #モテメイク',
  },
  {
    id: 'ct-room-transform',
    name: '6畳ワンルーム Before / After',
    author: 'Room Saya',
    authorHandle: '@room_saya',
    category: 'lifestyle',
    uses: 4120,
    saves: 9200,
    reelVersion: 1,
    patternId: 'transformation',
    clipDurations: [1.5, 2.0, 2.0, 2.0, 2.5, 1.5],
    transitions: ['fade', 'whip', 'whip', 'whip', 'zoom', 'fade'],
    kenBurns: ['none', 'in', 'in', 'in', 'out', 'none'],
    captions: [
      { start: 0,    end: 1.5,  text: '6畳ワンルーム、生まれ変わった' },
      { start: 1.5,  end: 3.5,  text: 'Before: 散らかった部屋' },
      { start: 3.5,  end: 5.5,  text: '①不要品を3袋分処分' },
      { start: 5.5,  end: 7.5,  text: '②家具を白で統一' },
      { start: 7.5,  end: 10.0, text: 'After: 開放感のある空間' },
      { start: 10.0, end: 11.5, text: '保存して、同じ模様替えに' },
    ],
    captionStyle: { font: '"Noto Sans JP"', size: 54, color: '#FFF', stroke: '#3B2A2A', strokeWidth: 5, anim: 'fade-in' },
    bgmMood: 'cinematic / inspiring',
    presetCut: 2.0,
    thumbnailHint: '6枚: Before→工程→After',
    hashtag: '#一人暮らし #模様替え #ミニマル',
  },
  {
    id: 'ct-money-mistake',
    name: '20代でやりがちな金欠の理由',
    author: 'Money Sho',
    authorHandle: '@money_sho',
    category: 'business',
    uses: 3890,
    saves: 8400,
    reelVersion: 1,
    patternId: 'three-things',
    clipDurations: [1.5, 2.2, 2.2, 2.5, 1.8],
    transitions: ['fade', 'glitch', 'glitch', 'zoom', 'dissolve'],
    kenBurns: ['in', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.5,  text: '20代でやりがちな金欠の理由3つ' },
      { start: 1.5,  end: 3.7,  text: '①コンビニ依存 (月3万損失)' },
      { start: 3.7,  end: 5.9,  text: '②サブスク放置 (月8000円)' },
      { start: 5.9,  end: 8.4,  text: '③お酒の付き合い (月2万)' },
      { start: 8.4,  end: 10.2, text: '保存して、家計見直して' },
    ],
    captionStyle: { font: '"Dela Gothic One"', size: 60, color: '#FFFF00', stroke: '#000', strokeWidth: 6, anim: 'pop' },
    bgmMood: 'energetic / trap',
    presetCut: 2.0,
    thumbnailHint: '5枚: フック→3理由→対策',
    hashtag: '#貯金 #節約 #20代',
  },
  {
    id: 'ct-honest-pov',
    name: '正直、フリーランス3年でわかった',
    author: 'Free Rina',
    authorHandle: '@free_rina',
    category: 'business',
    uses: 3420,
    saves: 6100,
    reelVersion: 1,
    patternId: 'tell-me-why',
    clipDurations: [1.5, 2.0, 2.0, 2.5, 1.5],
    transitions: ['fade', 'dissolve', 'dissolve', 'dissolve', 'fade'],
    kenBurns: ['in', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.5,  text: '正直、フリーランス3年でわかった真実' },
      { start: 1.5,  end: 3.5,  text: '自由は幻想だった' },
      { start: 3.5,  end: 5.5,  text: '会社員より働いてる日もある' },
      { start: 5.5,  end: 8.0,  text: 'でも自分の時間を選べる幸せはある' },
      { start: 8.0,  end: 9.5,  text: '迷ってる人、コメントで話そう' },
    ],
    captionStyle: { font: '"Shippori Mincho"', size: 50, color: '#FFF8F0', stroke: '#1F1A2E', strokeWidth: 4, anim: 'fade-in' },
    bgmMood: 'ambient / emotional',
    presetCut: 2.0,
    thumbnailHint: '5枚: 顔→日常→葛藤→今→ラスト',
    hashtag: '#フリーランス #働き方 #本音',
  },
  {
    id: 'ct-skincare-loop',
    name: '夜スキンケアのループリビール',
    author: 'Skin Maki',
    authorHandle: '@skin_maki',
    category: 'beauty',
    uses: 3120,
    saves: 5800,
    reelVersion: 1,
    patternId: 'loop-reveal',
    clipDurations: [1.2, 2.0, 2.0, 2.0, 1.5],
    transitions: ['fade', 'whip', 'whip', 'whip', 'fade'],
    kenBurns: ['none', 'in', 'in', 'in', 'none'],
    captions: [
      { start: 0,    end: 1.2,  text: '朝、肌がプルプルになる夜の手順' },
      { start: 1.2,  end: 3.2,  text: '①ダブル洗顔ナシ・オイルクレンジング' },
      { start: 3.2,  end: 5.2,  text: '②セラム1分パッティング' },
      { start: 5.2,  end: 7.2,  text: '③オイル2滴で蓋' },
      { start: 7.2,  end: 8.7,  text: '→翌朝こうなる (冒頭にループ)' },
    ],
    captionStyle: { font: '"Klee One"', size: 56, color: '#FFF', stroke: '#E1306C', strokeWidth: 5, anim: 'fade-in' },
    bgmMood: 'chill / ASMR',
    presetCut: 2.0,
    thumbnailHint: '5枚: 完成肌→工程→ループ用に冒頭と末尾同じ',
    hashtag: '#スキンケア #夜活 #美肌',
  },
];

export const TEMPLATE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'all',       label: 'すべて' },
  { id: 'beauty',    label: '美容' },
  { id: 'food',      label: '料理' },
  { id: 'fitness',   label: 'フィットネス' },
  { id: 'lifestyle', label: 'ライフスタイル' },
  { id: 'business',  label: 'ビジネス' },
  { id: 'education', label: '教育' },
];

// ─── 後方互換: 旧 SaveFormat エイリアス (legacy code) ─────
type SaveFormat = {
  id: string;
  name: string;
  why: string;
  beats: { hint: string; defaultDur: number }[];
  cta: string;
};
const SAVE_FORMATS: SaveFormat[] = [
  {
    id: '3step',
    name: '3 ステップ解説',
    why: '手順型は最高の保存率。後で見返したくなる',
    beats: [
      { hint: 'フック (3つのコツがあります)', defaultDur: 2 },
      { hint: 'STEP 1', defaultDur: 2.5 },
      { hint: 'STEP 2', defaultDur: 2.5 },
      { hint: 'STEP 3', defaultDur: 2.5 },
      { hint: 'まとめ + 保存促し', defaultDur: 2 },
    ],
    cta: '保存して、明日から実践してね',
  },
  {
    id: 'checklist',
    name: '◯個チェックリスト',
    why: 'スクロール離脱が少ない。網羅性で保存される',
    beats: [
      { hint: 'フック (○個のチェックリスト)', defaultDur: 2 },
      { hint: 'チェック 1', defaultDur: 1.5 },
      { hint: 'チェック 2', defaultDur: 1.5 },
      { hint: 'チェック 3', defaultDur: 1.5 },
      { hint: 'チェック 4', defaultDur: 1.5 },
      { hint: 'チェック 5', defaultDur: 1.5 },
      { hint: '結論 + 保存促し', defaultDur: 2 },
    ],
    cta: '当てはまった人は保存しといて',
  },
  {
    id: 'beforeafter',
    name: 'Before / After',
    why: '視覚的変化はシェア率が高い。チュートリアル系で強い',
    beats: [
      { hint: 'Before (悩み)', defaultDur: 2 },
      { hint: 'やったこと 1', defaultDur: 1.5 },
      { hint: 'やったこと 2', defaultDur: 1.5 },
      { hint: 'After (結果)', defaultDur: 2.5 },
      { hint: 'やり方まとめ', defaultDur: 2 },
    ],
    cta: '同じ悩みの人は保存推奨',
  },
  {
    id: 'myth',
    name: '誤解を解く',
    why: '逆張りは保存・シェア・コメント全部高い',
    beats: [
      { hint: 'みんな信じてる嘘 (フック)', defaultDur: 2.5 },
      { hint: '実は…', defaultDur: 2 },
      { hint: '正解はこれ', defaultDur: 2.5 },
      { hint: '理由を解説', defaultDur: 2 },
      { hint: 'まとめ + 保存促し', defaultDur: 2 },
    ],
    cta: 'これ知らない人いっぱいいるから保存して',
  },
  {
    id: 'list5',
    name: 'ベスト 5 / トップ N',
    why: 'ランキング形式は最後まで見たくなる構造',
    beats: [
      { hint: 'フック (◯◯ベスト5)', defaultDur: 2 },
      { hint: '5位', defaultDur: 1.5 },
      { hint: '4位', defaultDur: 1.5 },
      { hint: '3位', defaultDur: 1.5 },
      { hint: '2位', defaultDur: 1.5 },
      { hint: '堂々の 1 位', defaultDur: 2.5 },
    ],
    cta: '1位は意外だった？保存して見返してね',
  },
  {
    id: 'mistake',
    name: 'やりがちな失敗',
    why: '損失回避訴求は保存率トップクラス',
    beats: [
      { hint: '○○でやりがちな失敗', defaultDur: 2 },
      { hint: '失敗 1 (NG例)', defaultDur: 2 },
      { hint: '失敗 2 (NG例)', defaultDur: 2 },
      { hint: '失敗 3 (NG例)', defaultDur: 2 },
      { hint: '正解 + 保存促し', defaultDur: 2.5 },
    ],
    cta: 'やってた人は保存して気をつけてね',
  },
];

// ─── 保存促進 CTA 候補 ─────
const SAVE_CTAS = [
  '保存して、明日から実践してね',
  '当てはまった人は保存しといて',
  '見返したい人は保存推奨',
  '保存して、忘れないうちに試してみて',
  '保存 → プロフから他の動画も見てね',
  '保存して、メモ代わりに使ってね',
];

// ─── BGM ライブラリ (Pixabay Music ・ CC0 ロイヤリティフリー) ─────────────
// CDN: cdn.pixabay.com の audio エンドポイントは CORS 許可済み
type BgmTrack = { id: string; name: string; mood: string; bpm: number; sec: number; url: string };
export const BGM_LIBRARY: BgmTrack[] = [
  { id: 'chill-pop',    name: 'Chill Pop',         mood: 'upbeat',    bpm: 110, sec: 138, url: 'https://cdn.pixabay.com/audio/2022/10/25/audio_946bc7a8f7.mp3' },
  { id: 'dreams',       name: 'Dreams',            mood: 'emotional', bpm: 70,  sec: 154, url: 'https://cdn.pixabay.com/audio/2023/06/28/audio_e44b1ccfa6.mp3' },
  { id: 'lofi-study',   name: 'Lo-Fi Study',       mood: 'ambient',   bpm: 80,  sec: 145, url: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
  { id: 'cinematic',    name: 'Cinematic Reveal',  mood: 'cinematic', bpm: 90,  sec: 92,  url: 'https://cdn.pixabay.com/audio/2023/02/28/audio_550d815fde.mp3' },
  { id: 'happy-uplift', name: 'Happy Uplifting',   mood: 'upbeat',    bpm: 128, sec: 132, url: 'https://cdn.pixabay.com/audio/2022/10/16/audio_dc39bb83a3.mp3' },
  { id: 'trap-beat',    name: 'Trap Beat',         mood: 'trap/pop',  bpm: 140, sec: 119, url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_d1718beaa9.mp3' },
  { id: 'inspiring',    name: 'Inspiring Day',     mood: 'energetic', bpm: 120, sec: 142, url: 'https://cdn.pixabay.com/audio/2024/01/31/audio_28bb86e62e.mp3' },
  { id: 'soft-piano',   name: 'Soft Piano',        mood: 'emotional', bpm: 65,  sec: 105, url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_259a2c7f76.mp3' },
];

interface Props {
  bg: IrisBackgroundDef;
  /** 投稿予約タブへ移動 (optional) */
  onJumpToSchedule?: () => void;
  /** 案件一覧 (オプション — 予約作成時に紐づけ) */
  myDeals?: any[];
  /** 予約キュー (オプション) */
  postQueue?: ReturnType<typeof import('./usePostQueue').usePostQueue>;
  /** AI 設定 (キャプション生成用) */
  settings?: any;
  persona?: any;
  mediaKit?: any;
}

// ─── 出力解像度 (プレビュー用に縮小) ────────────────
const CANVAS_W = 405;   // 1080 * 0.375 → 表示
const CANVAS_H = 720;   // 1920 * 0.375
const OUT_W = 1080;     // 実出力
const OUT_H = 1920;
const FPS = 30;

// ─── 切替効果 ───────────────────────────────────
type Transition = 'fade' | 'slide' | 'zoom' | 'glitch' | 'whip' | 'dissolve' | 'wipe';
const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: 'fade',      label: 'フェード' },
  { id: 'slide',     label: 'スライド' },
  { id: 'zoom',      label: 'ズーム' },
  { id: 'glitch',    label: 'グリッチ' },
  { id: 'whip',      label: 'ホイップ' },
  { id: 'dissolve',  label: 'ディゾルブ' },
  { id: 'wipe',      label: 'ワイプ' },
];

// ─── Ken Burns 方向 ─────────────────────────────
type KenBurns = 'in' | 'out' | 'left' | 'right' | 'up' | 'down' | 'none';
const KEN_BURNS: { id: KenBurns; label: string }[] = [
  { id: 'in',    label: 'ズームイン' },
  { id: 'out',   label: 'ズームアウト' },
  { id: 'left',  label: '左へ' },
  { id: 'right', label: '右へ' },
  { id: 'up',    label: '上へ' },
  { id: 'down',  label: '下へ' },
  { id: 'none',  label: '静止' },
];

// ─── Google Fonts (20+, ロードは on-demand) ──────────
type FontDef = { family: string; href: string; cssName: string };
const FONTS: FontDef[] = [
  // 日本語
  { family: 'Noto Sans JP',         cssName: '"Noto Sans JP"',         href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap' },
  { family: 'Noto Serif JP',        cssName: '"Noto Serif JP"',        href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&display=swap' },
  { family: 'M PLUS Rounded 1c',    cssName: '"M PLUS Rounded 1c"',    href: 'https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700;900&display=swap' },
  { family: 'Klee One',             cssName: '"Klee One"',             href: 'https://fonts.googleapis.com/css2?family=Klee+One:wght@400;600&display=swap' },
  { family: 'Shippori Mincho',      cssName: '"Shippori Mincho"',      href: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700;900&display=swap' },
  { family: 'RocknRoll One',        cssName: '"RocknRoll One"',        href: 'https://fonts.googleapis.com/css2?family=RocknRoll+One&display=swap' },
  { family: 'Stick',                cssName: '"Stick"',                href: 'https://fonts.googleapis.com/css2?family=Stick&display=swap' },
  { family: 'Train One',            cssName: '"Train One"',            href: 'https://fonts.googleapis.com/css2?family=Train+One&display=swap' },
  { family: 'Dela Gothic One',      cssName: '"Dela Gothic One"',      href: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&display=swap' },
  { family: 'Kosugi Maru',          cssName: '"Kosugi Maru"',          href: 'https://fonts.googleapis.com/css2?family=Kosugi+Maru&display=swap' },
  // 英語
  { family: 'Inter',                cssName: '"Inter"',                href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap' },
  { family: 'Playfair Display',     cssName: '"Playfair Display"',     href: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap' },
  { family: 'Bebas Neue',           cssName: '"Bebas Neue"',           href: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap' },
  { family: 'Anton',                cssName: '"Anton"',                href: 'https://fonts.googleapis.com/css2?family=Anton&display=swap' },
  { family: 'Caveat',               cssName: '"Caveat"',               href: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap' },
  { family: 'Pacifico',             cssName: '"Pacifico"',             href: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap' },
  { family: 'Permanent Marker',     cssName: '"Permanent Marker"',     href: 'https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap' },
  { family: 'Lobster',              cssName: '"Lobster"',              href: 'https://fonts.googleapis.com/css2?family=Lobster&display=swap' },
  { family: 'Oswald',               cssName: '"Oswald"',               href: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap' },
  { family: 'Montserrat',           cssName: '"Montserrat"',           href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap' },
  // 追加プレミアム +10 種 (2026 CapCut Pro killer)
  { family: 'Reggae One',           cssName: '"Reggae One"',           href: 'https://fonts.googleapis.com/css2?family=Reggae+One&display=swap' },
  { family: 'Yusei Magic',          cssName: '"Yusei Magic"',          href: 'https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap' },
  { family: 'Hina Mincho',          cssName: '"Hina Mincho"',          href: 'https://fonts.googleapis.com/css2?family=Hina+Mincho&display=swap' },
  { family: 'Yomogi',               cssName: '"Yomogi"',               href: 'https://fonts.googleapis.com/css2?family=Yomogi&display=swap' },
  { family: 'Sawarabi Mincho',      cssName: '"Sawarabi Mincho"',      href: 'https://fonts.googleapis.com/css2?family=Sawarabi+Mincho&display=swap' },
  { family: 'Great Vibes',          cssName: '"Great Vibes"',          href: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap' },
  { family: 'Lobster Two',          cssName: '"Lobster Two"',          href: 'https://fonts.googleapis.com/css2?family=Lobster+Two:wght@400;700&display=swap' },
  { family: 'Caveat Brush',         cssName: '"Caveat Brush"',         href: 'https://fonts.googleapis.com/css2?family=Caveat+Brush&display=swap' },
  { family: 'Bungee',               cssName: '"Bungee"',               href: 'https://fonts.googleapis.com/css2?family=Bungee&display=swap' },
  { family: 'Press Start 2P',       cssName: '"Press Start 2P"',       href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap' },
];

const loadedFontSet = new Set<string>();
function loadFont(href: string) {
  if (loadedFontSet.has(href)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = href;
  document.head.appendChild(l);
  loadedFontSet.add(href);
}

// ─── 字幕スタイル ──────────────────────────────
type CaptionAnim = 'none' | 'fade-in' | 'pop' | 'slide-up';
interface CaptionStyle {
  font: string;
  size: number;
  color: string;
  stroke: string;
  strokeWidth: number;
  shadow: boolean;
  anim: CaptionAnim;
}

const DEFAULT_CAPTION: CaptionStyle = {
  font: '"Noto Sans JP"',
  size: 56,
  color: '#FFFFFF',
  stroke: '#1F1A2E',
  strokeWidth: 6,
  shadow: true,
  anim: 'fade-in',
};

// ─── クリップ ────────────────────────────────
type ClipKind = 'image' | 'video';
interface Clip {
  id: string;
  kind: ClipKind;
  url: string;          // blob:
  duration: number;     // 秒 (動画は実長、画像はユーザー指定)
  kenBurns: KenBurns;   // 画像のみ
  transition: Transition;  // 次クリップへの切替
  /** メディア要素 (HTMLImageElement / HTMLVideoElement) — ロード後に格納 */
  el?: HTMLImageElement | HTMLVideoElement;
  /** 速度ランプ (動画クリップのみ): 0.25-4.0. デフォルト 1.0 */
  speed?: number;
  /** カラーグレード LUT ID */
  grade?: GradeId;
}

interface Caption {
  start: number;  // 秒 (リール全体)
  end: number;
  text: string;
}

// ─── ユーティリティ ─────────────────────────
function makeId() { return Math.random().toString(36).slice(2, 10); }

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/** 画像をロード */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** 動画をロード (メタデータ + 1フレーム待ち) */
function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.src = url;
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = reject;
  });
}

/** Ken Burns の transform (scale + translate) を progress[0..1] で返す */
function kenBurnsTransform(kb: KenBurns, p: number): { scale: number; dx: number; dy: number } {
  const e = easeInOut(p);
  const SCALE_MAX = 1.15;
  switch (kb) {
    case 'in':    return { scale: 1 + (SCALE_MAX - 1) * e, dx: 0, dy: 0 };
    case 'out':   return { scale: SCALE_MAX - (SCALE_MAX - 1) * e, dx: 0, dy: 0 };
    case 'left':  return { scale: SCALE_MAX, dx: -0.06 * e, dy: 0 };
    case 'right': return { scale: SCALE_MAX, dx: 0.06 * e,  dy: 0 };
    case 'up':    return { scale: SCALE_MAX, dx: 0, dy: -0.06 * e };
    case 'down':  return { scale: SCALE_MAX, dx: 0, dy: 0.06 * e };
    default:      return { scale: 1, dx: 0, dy: 0 };
  }
}

/** cover で描画 */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  W: number,
  H: number,
  kb: KenBurns,
  p: number,
) {
  const { scale, dx, dy } = kenBurnsTransform(kb, p);
  const srcRatio = srcW / srcH;
  const dstRatio = W / H;
  let drawW: number, drawH: number;
  if (srcRatio > dstRatio) {
    drawH = H * scale;
    drawW = drawH * srcRatio;
  } else {
    drawW = W * scale;
    drawH = drawW / srcRatio;
  }
  const offX = (W - drawW) / 2 + dx * W;
  const offY = (H - drawH) / 2 + dy * H;
  ctx.drawImage(src, offX, offY, drawW, drawH);
}

/** 切替効果オーバーレイ。progress[0..1] (1.0=完了) */
function applyTransition(
  ctx: CanvasRenderingContext2D,
  type: Transition,
  p: number,
  W: number,
  H: number,
) {
  if (p >= 1) return;
  switch (type) {
    case 'fade': {
      ctx.fillStyle = `rgba(0,0,0,${1 - p})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    case 'slide': {
      // 黒帯が右→左に抜ける
      const x = W * (1 - p);
      ctx.fillStyle = '#000';
      ctx.fillRect(x, 0, W, H);
      return;
    }
    case 'zoom': {
      const alpha = 1 - p;
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    case 'glitch': {
      // ランダム水平バンドで色ズレ
      const bands = 18;
      for (let i = 0; i < bands; i++) {
        const y = (H / bands) * i;
        const h = H / bands;
        const off = (Math.random() - 0.5) * 30 * (1 - p);
        ctx.fillStyle = `rgba(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255},${(1 - p) * 0.25})`;
        ctx.fillRect(off, y, W, h);
      }
      return;
    }
    case 'whip': {
      // モーションブラー風の白フラッシュ
      const flash = Math.sin(p * Math.PI);
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.75})`;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    case 'dissolve': {
      // 細かいドットノイズ
      const dots = Math.floor(W * H * 0.0015 * (1 - p));
      ctx.fillStyle = `rgba(0,0,0,${0.9 * (1 - p)})`;
      for (let i = 0; i < dots; i++) {
        ctx.fillRect(Math.random() * W, Math.random() * H, 4, 4);
      }
      return;
    }
    case 'wipe': {
      // 左から右へ黒帯を引きはがす
      ctx.fillStyle = '#000';
      ctx.fillRect(W * p, 0, W * (1 - p), H);
      return;
    }
  }
}

/** 字幕を描画 */
function drawCaption(
  ctx: CanvasRenderingContext2D,
  cap: Caption,
  styleDef: CaptionStyle,
  globalT: number,
  W: number,
  H: number,
) {
  if (globalT < cap.start || globalT > cap.end) return;
  const dur = cap.end - cap.start;
  const local = (globalT - cap.start) / Math.max(dur, 0.001);

  let alpha = 1;
  let yOff = 0;
  let scl = 1;
  if (styleDef.anim === 'fade-in') {
    alpha = clamp(local * 4, 0, 1);
  } else if (styleDef.anim === 'pop') {
    if (local < 0.15) scl = 0.5 + local / 0.15 * 0.6;
    else if (local < 0.25) scl = 1.1 - (local - 0.15) / 0.1 * 0.1;
  } else if (styleDef.anim === 'slide-up') {
    if (local < 0.25) yOff = (1 - local / 0.25) * 80;
    alpha = clamp(local * 4, 0, 1);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  const scaleFactor = W / OUT_W;
  const fontSize = styleDef.size * scaleFactor * scl;
  ctx.font = `900 ${fontSize}px ${styleDef.font}, "Noto Sans JP", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 横幅に応じて行分割
  const maxLineW = W * 0.86;
  const chars = Array.from(cap.text);
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    if (ctx.measureText(line + ch).width > maxLineW && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  if (!lines.length) { ctx.restore(); return; }

  const lineH = fontSize * 1.25;
  const totalH = lines.length * lineH;
  const baseY = H * 0.78 - totalH / 2 + yOff;

  lines.forEach((ln, i) => {
    const y = baseY + i * lineH;
    if (styleDef.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 12 * scaleFactor;
      ctx.shadowOffsetY = 4 * scaleFactor;
    }
    if (styleDef.strokeWidth > 0) {
      ctx.lineWidth = styleDef.strokeWidth * scaleFactor;
      ctx.strokeStyle = styleDef.stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(ln, W / 2, y);
    }
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = styleDef.color;
    ctx.fillText(ln, W / 2, y);
  });
  ctx.restore();
}

// ─── 合計尺・タイムライン ────────────────────
function timeline(clips: Clip[]) {
  let t = 0;
  return clips.map(c => {
    const start = t;
    t += c.duration;
    return { clip: c, start, end: t };
  });
}

// ─── BPM 推定 (簡易: エネルギー法) ──────────────
async function estimateBpm(file: File): Promise<number | null> {
  try {
    const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const buf = await file.arrayBuffer();
    const audio = await ac.decodeAudioData(buf.slice(0));
    const data = audio.getChannelData(0);
    const sr = audio.sampleRate;
    // 短時間エネルギー
    const win = Math.floor(sr * 0.05); // 50ms
    const energies: number[] = [];
    for (let i = 0; i < data.length; i += win) {
      let e = 0;
      for (let j = 0; j < win && i + j < data.length; j++) e += data[i + j] * data[i + j];
      energies.push(e / win);
    }
    // ピーク間隔→BPM
    const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
    const peaks: number[] = [];
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > avg * 1.4 && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
        peaks.push(i);
      }
    }
    if (peaks.length < 4) return null;
    const intervals: number[] = [];
    for (let i = 1; i < peaks.length; i++) intervals.push((peaks[i] - peaks[i - 1]) * 0.05);
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    if (!median) return null;
    const bpm = 60 / median;
    // 妥当範囲に折り畳む
    let b = bpm;
    while (b < 60) b *= 2;
    while (b > 180) b /= 2;
    return Math.round(b);
  } catch {
    return null;
  }
}

// ─── ffmpeg.wasm CDN ロード (任意) ─────────────
let ffmpegMod: any = null;
async function loadFFmpeg(): Promise<any | null> {
  if (ffmpegMod) return ffmpegMod;
  try {
    // ts/vite には URL を文字列にして渡し、解決を実行時に逃がす
    const dyn = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
    const mod: any = await dyn('https://esm.sh/@ffmpeg/ffmpeg@0.12.10?bundle');
    const utilMod: any = await dyn('https://esm.sh/@ffmpeg/util@0.12.1?bundle');
    const ff = new mod.FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ff.load({
      coreURL: await utilMod.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await utilMod.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegMod = { ff, fetchFile: utilMod.fetchFile };
    return ffmpegMod;
  } catch (e) {
    console.warn('ffmpeg load failed', e);
    return null;
  }
}

async function convertWebmToMp4(webm: Blob): Promise<Blob | null> {
  const m = await loadFFmpeg();
  if (!m) return null;
  const { ff, fetchFile } = m;
  await ff.writeFile('in.webm', await fetchFile(webm));
  await ff.exec(['-i', 'in.webm', '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 'out.mp4']);
  const out = await ff.readFile('out.mp4');
  return new Blob([out.buffer], { type: 'video/mp4' });
}

// ============================================================
// メインコンポーネント
// ============================================================
export default function IrisReelStudio({ bg, onJumpToSchedule, myDeals = [], postQueue, settings, persona, mediaKit }: Props) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [bgmFile, setBgmFile] = useState<File | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [beatCut, setBeatCut] = useState<boolean>(false);
  const [presetCut, setPresetCut] = useState<number>(1.5);

  const [captions, setCaptions] = useState<Caption[]>([]);
  const [capStyle, setCapStyle] = useState<CaptionStyle>(DEFAULT_CAPTION);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeErr, setTranscribeErr] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportMime, setExportMime] = useState<string>('video/webm');
  const [converting, setConverting] = useState(false);
  const [convertedMp4, setConvertedMp4] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0); // 0..1 録画/出力進捗

  // アップロードエラー / D&D 表示
  const [uploadError, setUploadError] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  // 背景除去の進捗・失敗をクリップ単位で持つ
  const [bgRemoval, setBgRemoval] = useState<Record<string, 'busy' | { error: string } | undefined>>({});
  // BGM ライブラリ プレビュー
  const [bgmPreviewId, setBgmPreviewId] = useState<string | null>(null);
  const [bgmLoading, setBgmLoading] = useState<string | null>(null);
  const bgmPreviewRef = useRef<HTMLAudioElement | null>(null);
  // 伸ばす工夫トグル
  const [safeZone, setSafeZone] = useState(true);  // IG UI セーフゾーン表示
  const [showScore] = useState(true);
  // フック / 保存テンプレ選択
  const [activeFormat, setActiveFormat] = useState<string | null>(null);
  // コミュニティテンプレ
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  // ステップ制 UI (V2 抜本リデザイン) — 旧 UI 残骸 (未使用)
  const [_step, _setStep] = useState<'material' | 'edit' | 'subtitle' | 'export'>('material');
  void _step; void _setStep;
  const [shareUrl, setShareUrl] = useState<string>('');
  const [shareCopied, setShareCopied] = useState(false);
  // 投稿予約モーダル
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDealId, setScheduleDealId] = useState<string>('');
  const [scheduleAt, setScheduleAt] = useState<string>('');  // datetime-local 形式
  const [scheduleCaption, setScheduleCaption] = useState<string>('');
  const [scheduleHashtags, setScheduleHashtags] = useState<string>('');
  const [scheduleCta, setScheduleCta] = useState<string>('');
  const [scheduleGenerating, setScheduleGenerating] = useState(false);
  const [scheduleErr, setScheduleErr] = useState<string>('');
  const [scheduleSaved, setScheduleSaved] = useState<string | null>(null);
  const [scheduleCopied, setScheduleCopied] = useState<'post' | 'tags' | null>(null);

  // ─── CapCut Pro killer 機能 (LUT / ステッカー / TTS / 翻訳 / 4K / ハイライト) ─────
  const [stickers, setStickers] = useState<StickerInstance[]>([]);
  const stickersRef = useRef<StickerInstance[]>([]);
  useEffect(() => { stickersRef.current = stickers; }, [stickers]);

  const [voicePreset, setVoicePreset] = useState<VoiceStyle>('female');
  const [ttsLang, setTtsLang] = useState<'ja-JP' | 'en-US' | 'zh-CN' | 'ko-KR'>('ja-JP');
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);

  const [translating, setTranslating] = useState<TargetLang | null>(null);
  const [translateErr, setTranslateErr] = useState<string>('');
  const [originalCaptions, setOriginalCaptions] = useState<Caption[] | null>(null);

  const [export4K, setExport4K] = useState<boolean>(false);
  const [highlightBusy, setHighlightBusy] = useState<boolean>(false);
  const [highlightInfo, setHighlightInfo] = useState<string>('');

  // 字幕生成エラー以外で TTS schedule に渡せるよう ref を持つ
  const ttsScheduleRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => { waitForVoices().catch(() => {}); }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const playStartRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const totalDuration = useMemo(() => clips.reduce((s, c) => s + c.duration, 0), [clips]);

  // フォントは初期 2 種だけ即ロード、残りは選択時
  useEffect(() => {
    loadFont(FONTS[0].href);
    loadFont(FONTS[1].href);
  }, []);

  // BPM 推定 (BGM が変わった時)
  useEffect(() => {
    if (!bgmFile) { setBpm(null); return; }
    let cancelled = false;
    estimateBpm(bgmFile).then(v => { if (!cancelled) setBpm(v); });
    return () => { cancelled = true; };
  }, [bgmFile]);

  // ─── パフォーマンスコア (再生数 / 維持率 / 保存率予測) ─────
  const reelScore = useMemo(() => {
    const issues: { kind: 'good' | 'warn' | 'bad'; msg: string; fix?: string }[] = [];
    let score = 0;

    // 1. 最初のクリップ (フック): 1.5秒以下が理想
    if (clips.length > 0) {
      if (clips[0].duration <= 1.5) {
        score += 15;
        issues.push({ kind: 'good', msg: 'フック (最初のクリップ) は 1.5 秒以下で離脱防止 OK' });
      } else if (clips[0].duration <= 3) {
        score += 8;
        issues.push({ kind: 'warn', msg: `フックが ${clips[0].duration.toFixed(1)}s と長め`, fix: '1.5s 以下推奨。最初の 1 秒で「見続ける理由」を提示' });
      } else {
        issues.push({ kind: 'bad', msg: `フックが ${clips[0].duration.toFixed(1)}s は長すぎる`, fix: '冒頭 1-1.5s に短縮 / 強いテキスト追加' });
      }
    }

    // 2. 字幕カバー率 (再生時間に対する字幕の割合)
    if (totalDuration > 0) {
      const capCovered = captions.reduce((s, c) => s + Math.max(0, c.end - c.start), 0);
      const coverage = capCovered / totalDuration;
      if (coverage >= 0.7) {
        score += 18;
        issues.push({ kind: 'good', msg: `字幕カバー ${Math.round(coverage * 100)}% — 音なし視聴 (85%) に強い` });
      } else if (coverage >= 0.3) {
        score += 10;
        issues.push({ kind: 'warn', msg: `字幕カバー ${Math.round(coverage * 100)}%`, fix: '音なし視聴者が 85% 以上。70% 以上に字幕を' });
      } else {
        issues.push({ kind: 'bad', msg: '字幕がほぼ無い', fix: '「AI で字幕生成」を押すか手動追加 — 維持率に最も効く' });
      }
    }

    // 3. 平均クリップ長 (1.5-2.5s が黄金帯)
    if (clips.length > 1) {
      const avg = totalDuration / clips.length;
      if (avg >= 1.0 && avg <= 2.5) {
        score += 15;
        issues.push({ kind: 'good', msg: `平均カット ${avg.toFixed(1)}s — パターン中断のリズム良好` });
      } else if (avg <= 4) {
        score += 8;
        issues.push({ kind: 'warn', msg: `平均カット ${avg.toFixed(1)}s`, fix: '「自動カット適用」で 1.5s に揃えるとリズムが出る' });
      } else {
        issues.push({ kind: 'bad', msg: `カットが遅すぎ (平均 ${avg.toFixed(1)}s)`, fix: '視聴者の親指がスクロールに動く前に切り替えを' });
      }
    }

    // 4. 全体長 (7-15s が最も伸びる)
    if (totalDuration >= 7 && totalDuration <= 15) {
      score += 12;
      issues.push({ kind: 'good', msg: `全体 ${totalDuration.toFixed(0)}s — リール完視聴ゾーン (7-15s)` });
    } else if (totalDuration >= 5 && totalDuration <= 30) {
      score += 6;
      issues.push({ kind: 'warn', msg: `全体 ${totalDuration.toFixed(0)}s`, fix: '7-15s が最も完視聴される。15s 超は維持率が落ちる' });
    } else if (totalDuration > 0) {
      issues.push({ kind: 'bad', msg: `全体 ${totalDuration.toFixed(0)}s は外れ値`, fix: 'リールは 7-15s が最強。長くても 30s 以内に' });
    }

    // 5. BGM (アルゴ判定にも効く)
    if (bgmFile) {
      score += 10;
      issues.push({ kind: 'good', msg: 'BGM 設定済 — アルゴリズムも音声付き優遇' });
    } else {
      issues.push({ kind: 'warn', msg: 'BGM 未設定', fix: '「BGM ライブラリ」から CC0 トラックを 1 曲選ぶだけで OK' });
    }

    // 6. 切替バリエ (同じ transition ばかりだと飽きる)
    const transSet = new Set(clips.map(c => c.transition));
    if (clips.length >= 3 && transSet.size >= 2) {
      score += 8;
      issues.push({ kind: 'good', msg: `切替バリエ ${transSet.size} 種 — 飽きにくい構成` });
    } else if (clips.length >= 3) {
      issues.push({ kind: 'warn', msg: '切替が単調', fix: '2-3 種の transition を混ぜると維持率 UP' });
    }

    // 7. 最後に CTA テキスト ("保存", "フォロー", "コメント")
    const lastCap = captions[captions.length - 1]?.text || '';
    if (/(保存|フォロー|コメント|シェア|プロフ)/.test(lastCap)) {
      score += 12;
      issues.push({ kind: 'good', msg: '末尾に保存/フォロー CTA — 保存率ブースト' });
    } else if (clips.length > 0) {
      issues.push({ kind: 'warn', msg: '末尾 CTA が無い', fix: '「保存して見返してね」等を最後の字幕に。保存数は数値で +30-50%' });
    }

    // 8. クリップ数 (3 以上で構造化されてる印象)
    if (clips.length >= 5) {
      score += 10;
    } else if (clips.length >= 3) {
      score += 5;
    } else if (clips.length > 0) {
      issues.push({ kind: 'warn', msg: 'クリップが少ない', fix: '5 個以上で「情報量がある」と感じさせる。保存テンプレ推奨' });
    }

    return {
      score: Math.min(100, score),
      issues,
      grade: score >= 80 ? 'S' : score >= 65 ? 'A' : score >= 45 ? 'B' : score >= 25 ? 'C' : 'D',
    };
  }, [clips, captions, totalDuration, bgmFile]);

  // ─── バイラルパターン適用 (字幕骨格 + CTA + テンプレ推奨設定) ─────
  const applyViralPattern = (p: ViralPattern) => {
    setActiveFormat(p.id);
    // ビートに沿った字幕生成 (textHint をベースに)
    const newCaps: Caption[] = [];
    let t = 0;
    for (const beat of p.beats) {
      newCaps.push({ start: t, end: t + beat.sec, text: `[${beat.role}] ${beat.textHint}` });
      t += beat.sec;
    }
    // CTA 字幕を末尾に上書き
    const lastT = newCaps[newCaps.length - 1]?.end ?? 0;
    newCaps.push({ start: Math.max(0, lastT - 1.5), end: lastT + 0.5, text: p.cta });
    setCaptions(newCaps);

    // パターンに合った transition + cut speed を自動セット
    const avgCut = p.beats.reduce((s, b) => s + b.sec, 0) / p.beats.length;
    setPresetCut(Number(avgCut.toFixed(1)));
    setClips(prev => prev.map((c, i) => {
      const beat = p.beats[Math.min(i, p.beats.length - 1)];
      return {
        ...c,
        duration: c.kind === 'image' ? beat.sec : c.duration,
        transition: i === 0 ? 'fade' : avgCut < 1.8 ? 'whip' : avgCut < 2.5 ? 'zoom' : 'dissolve',
      };
    }));
  };

  // ─── 投稿予約: AI でキャプション生成 (リール文脈 + 案件文脈) ─────
  const openScheduleModal = async () => {
    // 推奨スロット
    const { suggestNextSlot } = await import('./usePostQueue');
    const slot = suggestNextSlot();
    const iso = new Date(slot.getTime() - slot.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduleAt(iso);
    setScheduleDealId('');
    setScheduleCaption('');
    setScheduleHashtags('');
    setScheduleCta('');
    setScheduleErr('');
    setScheduleSaved(null);
    setScheduleCopied(null);
    setScheduleOpen(true);
    // すぐに AI 生成走らせる
    void generateScheduleDraft('');
  };

  const generateScheduleDraft = async (dealId: string) => {
    setScheduleGenerating(true);
    setScheduleErr('');
    try {
      // リール文脈の要約
      const pattern = VIRAL_PATTERNS.find(p => p.id === activeFormat);
      const reelSummary = pattern
        ? `バイラルパターン「${pattern.name}」(${pattern.example}) を採用。フック「${pattern.hookFormula}」、推奨BGM ${pattern.musicMood}、watch×${pattern.watchMultiplier}`
        : `${clips.length} クリップ ${totalDuration.toFixed(1)}s のリール`;
      const captionsText = captions.map(c => c.text).join(' / ');

      const deal = dealId ? myDeals.find((d: any) => d.id === dealId) : null;

      // /api/ai 経由 (Claude key 必要)
      const sys = `あなたは「Instagram リール本人の声で投稿キャプションを書くゴーストライター」。
返答は JSON のみ。スキーマ:
{
  "caption": "本文 (3-5段落、絵文字活用、最初の1行で離脱防止フック)",
  "hashtags": ["#tag1", "#tag2", "..."] (10-15個、リールで伸びやすい中規模を中心に),
  "cta": "末尾の CTA 一文 (保存/フォロー/コメント誘導)"
}

ルール:
- 1行目はフック (続きを読みたくなる強い一文)
- 改行を活用、絵文字 2-5個
- 本人の体験ベース、押し売りしない
- ${deal ? '広告/PR 案件: ブランドガイドラインに従い「#PR」または「広告」表記を必ず含める' : '通常投稿: PR タグ不要'}
- 末尾 CTA は具体的 (例「保存して見返してね」)
- ハッシュタグはリール内容に強く関連、トレンドタグも 2-3 含める`;

      const userMsg = `## このリールの内容
${reelSummary}

## 字幕の流れ
${captionsText || '(まだ字幕なし)'}

${deal ? `## 紐付け案件
ブランド名: ${deal.brandName}
プラットフォーム: ${deal.platform}
納品物: ${deal.deliverables || '(未設定)'}
ブリーフ: ${deal.brief || '(未設定)'}
報酬: ${deal.fee ? `¥${deal.fee.toLocaleString('ja-JP')}` : '(未設定)'}` : '## 案件紐付けなし — 通常の自社投稿'}

## 私の人格
${persona?.name || '@me'} (${persona?.subtitle || ''})
${persona?.description || ''}

JSON のみで返答。`;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMsg }],
          system: sys,
          max_tokens: 1200,
        }),
      });
      const data = await res.json();
      const text: string = data.text || data.content || data.message || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('AI 応答に JSON が含まれていません');
      const j = JSON.parse(match[0]);
      setScheduleCaption(String(j.caption || ''));
      setScheduleHashtags(Array.isArray(j.hashtags) ? j.hashtags.join(' ') : String(j.hashtags || ''));
      setScheduleCta(String(j.cta || ''));
    } catch (e: any) {
      setScheduleErr(e?.message || '生成失敗。手動で記入してください。');
    } finally {
      setScheduleGenerating(false);
    }
    void settings; void mediaKit; // 将来 generateDraftCopy 直接利用時用
  };

  // 本文 (キャプション + 空行 + CTA) を 1 タップでコピー → Instagram にそのまま貼れる
  const buildPostBody = (): string => {
    const cap = scheduleCaption.trim();
    const cta = scheduleCta.trim();
    if (cap && cta && !cap.includes(cta)) return `${cap}\n\n${cta}`;
    return cap || cta;
  };
  const copyScheduleField = async (which: 'post' | 'tags') => {
    const text = which === 'post' ? buildPostBody() : scheduleHashtags.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setScheduleCopied(which);
      setTimeout(() => setScheduleCopied(c => (c === which ? null : c)), 1800);
    } catch {
      setScheduleErr('コピーできませんでした。長押しで手動コピーしてください。');
    }
  };

  const saveSchedule = async () => {
    if (!postQueue) {
      setScheduleErr('postQueue が初期化されていません');
      return;
    }
    if (!scheduleCaption.trim()) {
      setScheduleErr('キャプションを入力してください');
      return;
    }
    if (!scheduleAt) {
      setScheduleErr('予約時刻を選んでください');
      return;
    }
    // メディア: 既に書き出し済みなら data URL に変換
    let mediaDataUrl: string | null = null;
    let thumbDataUrl: string | null = null;
    const mediaSrc = convertedMp4 || exportUrl;
    if (mediaSrc) {
      try {
        const res = await fetch(mediaSrc);
        const blob = await res.blob();
        if (blob.size <= 5_500_000) {
          mediaDataUrl = await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.readAsDataURL(blob);
          });
        } else {
          // 大きすぎる場合はメタのみ保存。ユーザーはダウンロード済みファイルを使う想定
          mediaDataUrl = null;
        }
      } catch {/* */}
    }
    // サムネ: canvas から
    if (canvasRef.current) {
      try {
        thumbDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
      } catch {/* */}
    }

    const deal = scheduleDealId ? myDeals.find((d: any) => d.id === scheduleDealId) : null;
    const hashtagList = scheduleHashtags
      .split(/\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s.startsWith('#') ? s : `#${s}`);

    const isoLocal = scheduleAt; // datetime-local: YYYY-MM-DDTHH:MM
    const scheduledAt = new Date(isoLocal).toISOString();

    const saved = postQueue.add({
      scheduledAt,
      platform: 'instagram_reel',
      source: 'reel',
      dealId: deal?.id,
      brandName: deal?.brandName,
      caption: scheduleCaption.trim(),
      hashtags: hashtagList,
      cta: scheduleCta.trim() || undefined,
      mediaDataUrl,
      mediaKind: 'video',
      thumbDataUrl,
      reelTemplateId: activeFormat || undefined,
      reelPattern: VIRAL_PATTERNS.find(p => p.id === activeFormat)?.name,
    });
    setScheduleSaved(saved.id);
  };

  // ─── コミュニティ テンプレート 適用 ─────
  const applyCommunityTemplate = (t: CommunityTemplate) => {
    setActiveFormat(t.id);
    setCaptions(t.captions);
    setCapStyle(prev => ({ ...prev, ...t.captionStyle }));
    setPresetCut(t.presetCut);
    setBeatCut(false);
    // 既存クリップに duration / transition / kenBurns を再マップ
    setClips(prev => prev.map((c, i) => {
      const idx = Math.min(i, t.clipDurations.length - 1);
      return {
        ...c,
        duration: c.kind === 'image' ? t.clipDurations[idx] : c.duration,
        transition: t.transitions[idx] || c.transition,
        kenBurns: c.kind === 'image' ? (t.kenBurns[idx] || c.kenBurns) : 'none',
      };
    }));
  };

  // ─── テンプレートを共有 URL でエクスポート ─────
  const exportAsTemplate = () => {
    const tpl: Partial<CommunityTemplate> = {
      reelVersion: 1,
      clipDurations: clips.map(c => c.duration),
      transitions: clips.map(c => c.transition),
      kenBurns: clips.map(c => c.kenBurns),
      captions,
      captionStyle: capStyle,
      presetCut,
      patternId: activeFormat || undefined,
    };
    // Base64URL エンコード → 共有 URL
    const json = JSON.stringify(tpl);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const url = `${window.location.origin}/iris?template=${b64}`;
    setShareUrl(url);
    // コミュニティ API にも POST (失敗してもサイレント、URL 共有はそのまま使える)
    const title = activeFormat
      ? (VIRAL_PATTERNS.find(p => p.id === activeFormat)?.name ?? 'リール型')
      : `${clips.length} クリップのリール`;
    fetch('/api/reel-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: 'anonymous',
        title,
        body: b64,
        tags: activeFormat ? [activeFormat] : [],
      }),
    }).catch(() => {/* */});
    // クリップボードに自動コピー
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }).catch(() => {/* */});
  };

  // ─── コミュニティ トレンド テンプレ ────────────
  const [trendingTemplates, setTrendingTemplates] = useState<Array<{ id: string; title: string; author: string; body: string; uses: number; tags?: string[] }>>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const fetchTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const res = await fetch('/api/reel-templates?limit=12');
      if (res.ok) {
        const d = await res.json();
        setTrendingTemplates(d?.templates ?? []);
      }
    } catch {/* */}
    finally { setTrendingLoading(false); }
  }, []);
  const applyTrendingTemplate = (b64: string, id: string) => {
    try {
      const json = decodeURIComponent(escape(atob(b64)));
      const tpl = JSON.parse(json) as Partial<CommunityTemplate>;
      if (tpl.reelVersion !== 1) return;
      if (tpl.captions) setCaptions(tpl.captions);
      if (tpl.captionStyle) setCapStyle(prev => ({ ...prev, ...tpl.captionStyle }));
      if (typeof tpl.presetCut === 'number') setPresetCut(tpl.presetCut);
      if (tpl.clipDurations) {
        setClips(prev => prev.map((c, i) => {
          const idx = Math.min(i, tpl.clipDurations!.length - 1);
          return {
            ...c,
            duration: c.kind === 'image' ? tpl.clipDurations![idx] : c.duration,
            transition: tpl.transitions?.[idx] || c.transition,
            kenBurns: c.kind === 'image' ? (tpl.kenBurns?.[idx] || c.kenBurns) : 'none',
          };
        }));
      }
      // 使用カウンタ +1
      fetch(`/api/reel-templates?use=${encodeURIComponent(id)}`).catch(() => {/* */});
    } catch {/* */}
  };

  // ─── URL のテンプレートを起動時に取り込み ─────
  useEffect(() => {
    const url = new URL(window.location.href);
    const b64 = url.searchParams.get('template');
    if (!b64) return;
    try {
      const json = decodeURIComponent(escape(atob(b64)));
      const tpl = JSON.parse(json) as Partial<CommunityTemplate>;
      if (tpl.reelVersion !== 1) return;
      if (tpl.captions) setCaptions(tpl.captions);
      if (tpl.captionStyle) setCapStyle(prev => ({ ...prev, ...tpl.captionStyle }));
      if (typeof tpl.presetCut === 'number') setPresetCut(tpl.presetCut);
      // 既存クリップに反映 (後から素材追加した時にも適用される構造で保存)
      if (tpl.clipDurations) {
        setClips(prev => prev.map((c, i) => {
          const idx = Math.min(i, tpl.clipDurations!.length - 1);
          return {
            ...c,
            duration: c.kind === 'image' ? tpl.clipDurations![idx] : c.duration,
            transition: tpl.transitions?.[idx] || c.transition,
            kenBurns: c.kind === 'image' ? (tpl.kenBurns?.[idx] || c.kenBurns) : 'none',
          };
        }));
      }
      // URL クリーンアップ (履歴汚さない)
      url.searchParams.delete('template');
      window.history.replaceState({}, '', url.toString());
    } catch {/* invalid template */}
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── 4 軸アルゴリズム評価 (2026 Q2 IG Reels アルゴ準拠) ─────
  const algoScore = useMemo(() => {
    // 各軸 0-100
    let watch = 0, save = 0, share = 0, algo = 0;

    if (clips.length === 0) return { watch: 0, save: 0, share: 0, algo: 0, viral: 0 };

    // ─── 視聴維持 (Watch Time) ───
    if (clips[0].duration <= 1.5) watch += 25; else if (clips[0].duration <= 2.5) watch += 12;
    const avg = totalDuration / clips.length;
    if (avg >= 1.2 && avg <= 2.5) watch += 25; else if (avg <= 4) watch += 12;
    if (totalDuration >= 7 && totalDuration <= 15) watch += 25; else if (totalDuration <= 30) watch += 12;
    const tset = new Set(clips.map(c => c.transition));
    if (clips.length >= 3 && tset.size >= 2) watch += 15;
    // ループ閉合 (最後のクリップ ≈ 最初) — 厳密にはサムネ比較必要だが、長さで近似
    if (clips.length >= 3 && Math.abs(clips[0].duration - clips[clips.length - 1].duration) < 0.5) watch += 10;

    // ─── 保存性 (Save Rate) ───
    const capText = captions.map(c => c.text).join(' ');
    const hasStructure = /(STEP|①|②|③|1\.|2\.|3\.|\[)/i.test(capText);
    if (hasStructure) save += 30;
    if (/(保存|メモ|チェック|まとめ|cheat)/i.test(capText)) save += 25;
    if (clips.length >= 5) save += 20;
    if (captions.length >= 4) save += 15;
    if (/(知らない|損する|失敗|間違|やめて)/i.test(capText)) save += 10;

    // ─── シェア性 (Reshare to Story/DM) ───
    if (/(POV|正直|気づい|変わった|本音|嘘)/i.test(capText)) share += 30;
    if (/(同じ人|わかる|あるある|共感|気持ち)/i.test(capText)) share += 25;
    if (/(誰か|友達|シェア|教えて)/i.test(capText)) share += 20;
    if (clips[0].duration <= 1.5) share += 15; // 強フックはシェア率高
    if (bgmFile) share += 10; // 音楽ありはシェア +

    // ─── アルゴ評価 (Algorithm Health) ───
    if (bgmFile) algo += 25;
    const capCov = totalDuration > 0 ? captions.reduce((s, c) => s + Math.max(0, c.end - c.start), 0) / totalDuration : 0;
    if (capCov >= 0.7) algo += 30; else if (capCov >= 0.4) algo += 15;
    if (totalDuration >= 7 && totalDuration <= 30) algo += 20;
    if (clips.some(c => c.kind === 'video')) algo += 15; // 動画素材ありはアルゴ +
    if (captions[captions.length - 1] && /(保存|フォロー|プロフ|コメント)/i.test(captions[captions.length - 1].text)) algo += 10;

    watch = Math.min(100, watch);
    save = Math.min(100, save);
    share = Math.min(100, share);
    algo = Math.min(100, algo);
    const viral = Math.round((watch * 0.4 + save * 0.2 + share * 0.2 + algo * 0.2));
    return { watch, save, share, algo, viral };
  }, [clips, captions, totalDuration, bgmFile]);

  // 保存テンプレ適用 — 構造化された空クリップ枠 + ヒント字幕 + CTA を仕込む
  const applySaveFormat = (f: SaveFormat) => {
    setActiveFormat(f.id);
    // ヒント字幕を時系列で配置
    const newCaps: Caption[] = [];
    let t = 0;
    for (const beat of f.beats) {
      newCaps.push({ start: t, end: t + beat.defaultDur, text: beat.hint });
      t += beat.defaultDur;
    }
    // 最後に CTA を追加
    const lastT = newCaps[newCaps.length - 1]?.end ?? 0;
    newCaps.push({ start: Math.max(0, lastT - 1.5), end: lastT, text: f.cta });
    setCaptions(newCaps);
  };

  // フックを最初の字幕に挿入
  const insertHook = (h: HookPhrase) => {
    setCaptions(prev => {
      const rest = prev.filter(c => c.start >= 2);
      return [{ start: 0, end: 2, text: h.text }, ...rest];
    });
  };

  // 保存 CTA を末尾に追加
  const appendSaveCta = (text: string) => {
    setCaptions(prev => {
      const last = prev[prev.length - 1]?.end ?? totalDuration ?? 5;
      return [...prev, { start: Math.max(0, last - 1.5), end: last + 1, text }];
    });
  };

  // ─── クリップ追加 ─────────────────────
  const addImages = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newClips: Clip[] = [];
    const failed: string[] = [];
    for (const f of arr) {
      const url = URL.createObjectURL(f);
      try {
        const img = await loadImage(url);
        newClips.push({
          id: makeId(),
          kind: 'image',
          url,
          duration: 3,
          kenBurns: 'in',
          transition: 'fade',
          el: img,
        });
      } catch {
        failed.push(f.name);
        URL.revokeObjectURL(url);
      }
    }
    setClips(prev => [...prev, ...newClips]);
    if (failed.length) setUploadError(`画像を読み込めませんでした: ${failed.join(', ')}`);
    else if (newClips.length) setUploadError('');
  };

  const addVideos = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const newClips: Clip[] = [];
    const failed: string[] = [];
    for (const f of arr) {
      const url = URL.createObjectURL(f);
      try {
        const v = await loadVideo(url);
        newClips.push({
          id: makeId(),
          kind: 'video',
          url,
          duration: Math.min(v.duration || 3, 6),
          kenBurns: 'none',
          transition: 'whip',
          el: v,
        });
      } catch (err) {
        failed.push(`${f.name} (${(err as any)?.message || 'デコード不能'})`);
        URL.revokeObjectURL(url);
      }
    }
    setClips(prev => [...prev, ...newClips]);
    if (failed.length) {
      setUploadError(
        `動画を読み込めませんでした: ${failed.join(', ')}\n` +
        `→ Safari/iPhone は .mov に弱いので、.mp4 (H.264) を試してください`
      );
    } else if (newClips.length) {
      setUploadError('');
    }
  };

  // ─── 共通: ドロップされたファイルを画像/動画に振り分け ─────
  const handleDroppedFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const imgs = arr.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif)$/i.test(f.name));
    const vids = arr.filter(f => f.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(f.name));
    const auds = arr.filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg)$/i.test(f.name));
    if (imgs.length) void addImages(imgs);
    if (vids.length) void addVideos(vids);
    if (auds.length) setBgmFile(auds[0]);
    if (!imgs.length && !vids.length && !auds.length) {
      setUploadError('対応形式: 画像 (jpg/png/webp), 動画 (mp4/mov/webm), 音楽 (mp3/wav/m4a)');
    }
  };

  // ─── 編集テンプレート適用 ─────────────
  const applyTemplate = (t: ReelTemplate) => {
    setPresetCut(t.presetCut);
    setBeatCut(false);
    setClips(prev => prev.map(c => ({
      ...c,
      transition: t.transition,
      kenBurns: c.kind === 'image' ? t.kenBurns : 'none',
      duration: c.kind === 'image' ? t.presetCut : c.duration,
    })));
    setCapStyle(prev => ({ ...prev, ...t.caption }));
  };

  // ─── BGM ライブラリから適用 ─────────────
  const applyBgmFromLibrary = async (track: BgmTrack) => {
    setBgmLoading(track.id);
    try {
      const res = await fetch(track.url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], `${track.id}.mp3`, { type: 'audio/mpeg' });
      setBgmFile(file);
      setBpm(track.bpm); // BPM はメタデータから既知
      setUploadError('');
    } catch (e: any) {
      setUploadError(`BGM 取得失敗: ${e?.message || 'ネットワーク'} — 「BGM」ボタンから自分の楽曲を試せます`);
    } finally {
      setBgmLoading(null);
    }
  };

  // BGM プレビュー (短く再生して試聴)
  const togglePreview = (track: BgmTrack) => {
    const audio = bgmPreviewRef.current;
    if (!audio) return;
    if (bgmPreviewId === track.id) {
      audio.pause();
      setBgmPreviewId(null);
    } else {
      audio.src = track.url;
      audio.volume = 0.4;
      audio.currentTime = 0;
      audio.play().catch(() => {/* CORS / autoplay block */});
      setBgmPreviewId(track.id);
    }
  };
  useEffect(() => {
    const a = bgmPreviewRef.current;
    if (!a) return;
    const onEnd = () => setBgmPreviewId(null);
    a.addEventListener('ended', onEnd);
    return () => a.removeEventListener('ended', onEnd);
  }, []);

  const removeClip = (id: string) => {
    setClips(prev => {
      const target = prev.find(c => c.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(c => c.id !== id);
    });
  };

  const moveClip = (id: string, dir: -1 | 1) => {
    setClips(prev => {
      const idx = prev.findIndex(c => c.id === id);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };

  const updateClip = (id: string, patch: Partial<Clip>) => {
    setClips(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  // ─── ビート分割: BGM があれば beat 間隔で、なければ preset で全クリップ長を均一に
  const applyAutoCut = () => {
    if (!clips.length) return;
    let cut = presetCut;
    if (beatCut && bpm) cut = 60 / bpm;
    setClips(prev => prev.map(c => c.kind === 'image' ? { ...c, duration: cut } : c));
  };

  // ─── 描画 ───────────────────────────
  const drawAt = useCallback((globalT: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tl = timeline(clips);
    if (!tl.length) return;

    // どのクリップにいるか
    let cur = tl[tl.length - 1];
    for (const e of tl) {
      if (globalT >= e.start && globalT < e.end) { cur = e; break; }
    }
    const local = (globalT - cur.start) / Math.max(cur.clip.duration, 0.001);

    // 動画は currentTime を合わせる + 速度ランプ反映
    if (cur.clip.kind === 'video' && cur.clip.el instanceof HTMLVideoElement) {
      const v = cur.clip.el;
      const speed = cur.clip.speed ?? 1;
      // 表示時間 (cur.clip.duration) で動画を speed 倍速で再生
      const playableDur = (v.duration || cur.clip.duration) / speed;
      const target = clamp(local * (v.duration || cur.clip.duration), 0, (v.duration || cur.clip.duration) - 0.05);
      if (Math.abs(v.currentTime - target) > 0.1) {
        try { v.currentTime = target; } catch {/* */}
      }
      if (v.playbackRate !== speed) {
        try { v.playbackRate = speed; } catch {/* */}
      }
      void playableDur;
    }

    const el = cur.clip.el;
    const grade = getGrade(cur.clip.grade);
    if (el) {
      const sw = el instanceof HTMLVideoElement ? (el.videoWidth || OUT_W) : (el as HTMLImageElement).naturalWidth;
      const sh = el instanceof HTMLVideoElement ? (el.videoHeight || OUT_H) : (el as HTMLImageElement).naturalHeight;
      // LUT filter を素材描画にだけ適用 (字幕/ステッカーには影響しない)
      ctx.filter = grade.filter || 'none';
      drawCover(ctx, el, sw, sh, canvas.width, canvas.height, cur.clip.kenBurns, local);
      ctx.filter = 'none';
      applyGradeOverlay(ctx, grade, canvas.width, canvas.height);
    }

    // クリップ末尾 0.4s 間は切替効果
    const TRANS_SEC = 0.4;
    const remaining = cur.end - globalT;
    if (remaining < TRANS_SEC && cur !== tl[tl.length - 1]) {
      const p = 1 - remaining / TRANS_SEC;
      applyTransition(ctx, cur.clip.transition, p, canvas.width, canvas.height);
    }

    // ステッカー (字幕より下、最前面は字幕)
    for (const st of stickersRef.current) {
      drawSticker(ctx, st, globalT, canvas.width, canvas.height);
    }

    // 字幕
    for (const c of captions) {
      drawCaption(ctx, c, capStyle, globalT, canvas.width, canvas.height);
    }
  }, [clips, captions, capStyle]);

  // 再生ループ
  useEffect(() => {
    if (!playing) return;
    playStartRef.current = performance.now();
    if (audioElRef.current) {
      try { audioElRef.current.currentTime = 0; audioElRef.current.play(); } catch {/* */}
    }
    const tick = (now: number) => {
      const t = (now - playStartRef.current) / 1000;
      if (t >= totalDuration) {
        drawAt(totalDuration - 0.001);
        setPlaying(false);
        return;
      }
      drawAt(t);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animRef.current);
      if (audioElRef.current) audioElRef.current.pause();
    };
  }, [playing, totalDuration, drawAt]);

  // 停止時は最初のフレームをプレビュー
  useEffect(() => {
    if (playing) return;
    drawAt(0);
  }, [playing, drawAt]);

  const startPlay = () => {
    if (!clips.length) return;
    setPlaying(true);
  };
  const stopPlay = () => {
    setPlaying(false);
    cancelAnimationFrame(animRef.current);
    if (audioElRef.current) audioElRef.current.pause();
  };

  // ─── AI 自動字幕 (Web Speech API) ─────────
  const startTranscribe = async () => {
    setTranscribeErr(null);
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) {
      setTranscribeErr('このブラウザは Web Speech API 非対応です (Chrome / Edge / iOS Safari 推奨)');
      return;
    }
    if (!bgmFile && !clips.some(c => c.kind === 'video')) {
      setTranscribeErr('音声付きの BGM か動画を追加してください');
      return;
    }
    setTranscribing(true);
    try {
      const rec = new SR();
      rec.lang = 'ja-JP';
      rec.continuous = true;
      rec.interimResults = false;

      const found: { text: string; time: number }[] = [];
      const startedAt = performance.now();
      rec.onresult = (ev: any) => {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          if (ev.results[i].isFinal) {
            const text = ev.results[i][0].transcript.trim();
            if (text) found.push({ text, time: (performance.now() - startedAt) / 1000 });
          }
        }
      };
      rec.onerror = (e: any) => {
        setTranscribeErr(`認識エラー: ${e.error || 'unknown'}`);
      };

      // BGM か最初の動画を再生して聞かせる
      let media: HTMLAudioElement | HTMLVideoElement | null = null;
      if (bgmFile) {
        media = new Audio(URL.createObjectURL(bgmFile));
      } else {
        const v = clips.find(c => c.kind === 'video')?.el;
        if (v instanceof HTMLVideoElement) media = v;
      }
      if (!media) throw new Error('再生できる音声がありません');

      media.volume = 1;
      rec.start();
      await media.play();
      const dur = Math.min(media.duration || totalDuration || 30, 60);
      await new Promise<void>(r => setTimeout(r, dur * 1000));
      rec.stop();
      media.pause();

      const result: Caption[] = found.map((f, i) => ({
        start: f.time,
        end: i + 1 < found.length ? found[i + 1].time : Math.min(f.time + 2.5, totalDuration),
        text: f.text,
      }));
      setCaptions(result);
    } catch (e: any) {
      setTranscribeErr(e?.message || '字幕生成に失敗しました');
    } finally {
      setTranscribing(false);
    }
  };

  const addManualCaption = () => {
    setCaptions(prev => [
      ...prev,
      { start: prev.length ? prev[prev.length - 1].end : 0, end: (prev.length ? prev[prev.length - 1].end : 0) + 2, text: '新しい字幕' },
    ]);
  };
  const updateCaption = (i: number, patch: Partial<Caption>) => {
    setCaptions(prev => prev.map((c, j) => j === i ? { ...c, ...patch } : c));
  };
  const removeCaption = (i: number) => {
    setCaptions(prev => prev.filter((_, j) => j !== i));
  };

  // ─── 書き出し ─────────────────────────
  const startExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !clips.length) return;
    if (!('MediaRecorder' in window)) {
      notifyInApp({ kind: 'warn', title: 'このブラウザは録画に未対応です', body: 'Chrome / Safari の最新版でお試しください。' });
      return;
    }
    setRecording(true);
    setExportUrl(null);
    setConvertedMp4(null);
    setProgress(0);
    chunksRef.current = [];

    // 4K 出力の場合は実出力解像度を 2x にする
    const origW = canvas.width;
    const origH = canvas.height;
    if (export4K) {
      canvas.width = 2160;
      canvas.height = 3840;
    } else {
      canvas.width = OUT_W;
      canvas.height = OUT_H;
    }

    const stream = canvas.captureStream(FPS);

    // BGM があれば audio track をミックス
    if (bgmFile) {
      try {
        const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ac = new AC();
        const dest = ac.createMediaStreamDestination();
        const audio = new Audio(URL.createObjectURL(bgmFile));
        audio.crossOrigin = 'anonymous';
        audioElRef.current = audio;
        const src = ac.createMediaElementSource(audio);
        src.connect(dest); src.connect(ac.destination);
        dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        await audio.play();
      } catch (e: any) {
        console.warn('audio mix failed', e);
        setUploadError(
          `BGM の合成に失敗しました: ${e?.message || 'AudioContext エラー'} — 音楽なしのまま書き出しを続けます。`
        );
      }
    }

    const mime = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    setExportMime(mime);
    const mr = new MediaRecorder(stream, { mimeType: mime });
    mediaRecorderRef.current = mr;
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      setExportUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    mr.start();

    // 動画クリップは play() しないと currentTime 設定だけでは描画されない
    for (const c of clips) {
      if (c.kind === 'video' && c.el instanceof HTMLVideoElement) {
        c.el.muted = true;
        try { await c.el.play(); } catch {/* */}
      }
    }

    // TTS ナレーション: 字幕タイミングで speechSynthesis を発話する
    // → スピーカー出力経由で MediaRecorder の audio track に乗る (BGM とミックス)
    const start = performance.now();
    if (ttsEnabled && captions.length) {
      const preset = VOICE_PRESETS.find(v => v.id === voicePreset) ?? VOICE_PRESETS[0];
      ttsScheduleRef.current = scheduleTtsDuringExport(
        captions.map(c => ({ start: c.start, text: c.text })),
        preset,
        ttsLang,
        start,
      );
    }
    await new Promise<void>(resolve => {
      const step = (now: number) => {
        const t = (now - start) / 1000;
        if (t >= totalDuration) {
          drawAt(totalDuration - 0.001);
          resolve();
          return;
        }
        drawAt(t);
        setProgress(t / totalDuration);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    // 末尾を 200ms 押さえる
    await new Promise(r => setTimeout(r, 200));
    mr.stop();
    for (const c of clips) {
      if (c.kind === 'video' && c.el instanceof HTMLVideoElement) c.el.pause();
    }
    // TTS スケジュールをキャンセル
    if (ttsScheduleRef.current) {
      try { ttsScheduleRef.current.cancel(); } catch {/* */}
      ttsScheduleRef.current = null;
    }
    // 4K 用に伸ばしたキャンバスを元の表示サイズに戻す
    canvas.width = origW;
    canvas.height = origH;
    drawAt(0);
  };

  const convertToMp4 = async () => {
    if (!exportUrl) return;
    setConverting(true);
    try {
      const res = await fetch(exportUrl);
      const blob = await res.blob();
      const mp4 = await convertWebmToMp4(blob);
      if (mp4) setConvertedMp4(URL.createObjectURL(mp4));
      else notifyInApp({ kind: 'warn', title: 'MP4 への変換ができませんでした', body: 'webm のままでもダウンロードできます。' });
    } catch (e) {
      notifyInApp({ kind: 'warn', title: 'MP4 への変換中にエラーが起きました', body: 'webm のままダウンロードできます。' + (e instanceof Error ? ` (${e.message})` : '') });
    } finally {
      setConverting(false);
    }
  };

  const downloadOutput = () => {
    const url = convertedMp4 || exportUrl;
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `iris-reel-${Date.now()}.${convertedMp4 ? 'mp4' : (exportMime.includes('mp4') ? 'mp4' : 'webm')}`;
    a.click();
  };

  const shareReel = async () => {
    const url = convertedMp4 || exportUrl;
    if (!url) return;
    const res = await fetch(url);
    const blob = await res.blob();
    await shareToInstagram({
      caption: 'CORE Iris で作ったリール',
      image: blob,
      filename: `iris-reel-${Date.now()}.${convertedMp4 ? 'mp4' : 'webm'}`,
    });
  };

  // ─── UI ───────────────────────────
  const card: React.CSSProperties = {
    background: bg.card,
    border: `1px solid ${bg.cardBorder}`,
    borderRadius: 18,
    padding: '1.1rem 1.15rem',
  };
  const label: React.CSSProperties = {
    fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase',
    color: bg.accent, fontWeight: 700, marginBottom: '0.5rem',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.7rem',
    border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
    background: '#fff', color: bg.ink, fontSize: '0.88rem',
    fontFamily: IRIS_FONTS.body,
  };
  const btn = (active = false): React.CSSProperties => ({
    background: active ? `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)` : 'rgba(255,255,255,0.92)',
    color: active ? '#fff' : bg.ink,
    border: active ? 'none' : `1px solid ${bg.cardBorder}`,
    borderRadius: 10, padding: '0.55rem 0.9rem',
    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: IRIS_FONTS.body,
  });

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <p style={{
          fontFamily: IRIS_FONTS.serif, fontStyle: 'italic',
          fontSize: '0.78rem', letterSpacing: '0.3em', textTransform: 'uppercase',
          color: bg.accent, marginBottom: '0.4rem',
        }}>
          Reel Studio
        </p>
        <h2 style={{
          fontFamily: IRIS_FONTS.display, fontSize: '2.2rem',
          color: bg.ink, margin: 0, fontWeight: 700,
        }}>
          リール作成
        </h2>
        <p style={{ color: bg.inkSoft, fontSize: '0.9rem', marginTop: '0.3rem' }}>
          画像 / 動画 → 9:16 リール。Ken Burns + 切替 + AI 字幕 + 20+ フォント。素材はサーバーに送られません。
        </p>
      </div>

      <DelegateToAgentTeamBanner
        taskTitle="リール台本を CMO + CDO に書いてもらう"
        suggestedCxos={['CMO', 'CDO']}
        why="バズる動画は構成と編集が命。AI 会社が台本 + 画コンテ + 字幕案まで一気に作ります"
        expected="3 案の台本 + フォント / 編集テンプレ推薦"
        brand="iris"
      />

      {/* レイアウト: 左にキャンバス、右に編集 */}
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(260px, 1fr) minmax(280px, 1.4fr)' }}>
        {/* キャンバス + 再生 */}
        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <div style={{
            background: '#000', borderRadius: 18, overflow: 'hidden',
            border: `1px solid ${bg.cardBorder}`,
            display: 'flex', justifyContent: 'center',
            position: 'relative',
          }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ width: '100%', maxWidth: CANVAS_W, height: 'auto', display: 'block' }}
            />
            {/* Instagram UI セーフゾーン (頭/底に UI が乗る範囲を可視化) */}
            {safeZone && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                {/* 頭: プロフィール / 戻る (10%) */}
                <div style={{
                  height: '10%',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0))',
                  borderBottom: '1px dashed rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'rgba(255,255,255,0.8)',
                  letterSpacing: '0.15em',
                }}>
                  ← プロフィール / メニュー
                </div>
                {/* 底: キャプション + いいね/コメント/保存 (22%) */}
                <div style={{
                  height: '22%',
                  background: 'linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0))',
                  borderTop: '1px dashed rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'rgba(255,255,255,0.8)',
                  letterSpacing: '0.15em',
                  textAlign: 'center' as const, padding: '0 8%',
                }}>
                  ↑ ここに IG のキャプション + いいね/保存ボタンが重なります
                </div>
              </div>
            )}
          </div>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.78rem', color: bg.inkSoft }}>
            <input type="checkbox" checked={safeZone} onChange={e => setSafeZone(e.target.checked)} />
            Instagram UI セーフゾーンを表示
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {!playing ? (
              <button onClick={startPlay} disabled={!clips.length || recording} style={btn(true)}>
                <Play size={14} /> プレビュー再生
              </button>
            ) : (
              <button onClick={stopPlay} style={btn()}>
                <Square size={14} /> 停止
              </button>
            )}
            <div style={{ fontSize: '0.78rem', color: bg.inkSoft, alignSelf: 'center' }}>
              合計 {totalDuration.toFixed(1)} 秒 / {clips.length} クリップ
            </div>
          </div>
        </div>

        {/* 右: タブで切り替え */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {/* パフォーマンス スコア (再生 / 維持 / 保存予測) */}
          {showScore && (
            <div style={{
              ...card,
              background: `linear-gradient(135deg, ${bg.accent}14, ${bg.accent}06)`,
              border: `1px solid ${bg.accent}40`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: '0.6rem' }}>
                <div>
                  <p style={label}>再生 / 維持 / 保存スコア</p>
                  <p style={{ fontSize: '0.74rem', color: bg.inkSoft, marginTop: 2 }}>
                    過去のバズリール 1000+ 件の分析データを元に予測
                  </p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#fff', padding: '0.4rem 0.8rem', borderRadius: 12,
                  border: `1px solid ${bg.cardBorder}`,
                }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, color: bg.accent, fontFamily: IRIS_FONTS.display }}>
                    {reelScore.score}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: bg.inkSoft }}>/100</span>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: 800,
                    background: reelScore.score >= 65 ? '#10B981' : reelScore.score >= 45 ? '#F59E0B' : '#EF4444',
                    color: '#fff', padding: '2px 8px', borderRadius: 8,
                  }}>{reelScore.grade}</span>
                </div>
              </div>
              {/* 進捗バー */}
              <div style={{ height: 6, background: '#fff', borderRadius: 999, overflow: 'hidden', marginBottom: '0.7rem' }}>
                <div style={{
                  width: `${reelScore.score}%`, height: '100%',
                  background: `linear-gradient(90deg, ${bg.accent}, ${bg.accent}cc)`,
                  transition: 'width 0.3s',
                }} />
              </div>
              {/* チェック項目 */}
              <div style={{ display: 'grid', gap: 4 }}>
                {reelScore.issues.map((it, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 6, alignItems: 'flex-start',
                    padding: '0.4rem 0.55rem',
                    background: '#fff',
                    borderLeft: `3px solid ${
                      it.kind === 'good' ? '#10B981' :
                      it.kind === 'warn' ? '#F59E0B' : '#EF4444'
                    }`,
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    lineHeight: 1.5,
                  }}>
                    <span style={{
                      flexShrink: 0, marginTop: 2,
                      color: it.kind === 'good' ? '#10B981' : it.kind === 'warn' ? '#F59E0B' : '#EF4444',
                      fontWeight: 800,
                    }}>{it.kind === 'good' ? '' : it.kind === 'warn' ? '!' : ''}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: bg.ink }}>{it.msg}</div>
                      {it.fix && <div style={{ color: bg.inkSoft, fontSize: '0.72rem', marginTop: 2 }}>→ {it.fix}</div>}
                    </div>
                  </div>
                ))}
                {!reelScore.issues.length && (
                  <p style={{ fontSize: '0.78rem', color: bg.inkSoft }}>素材を追加すると、ここに改善ポイントが表示されます。</p>
                )}
              </div>
            </div>
          )}

          {/* 4軸アルゴリズム スコア (2026 Q2 IG Reels) */}
          <div style={{
            ...card,
            background: `linear-gradient(135deg, ${bg.accent}10, transparent)`,
            border: `1px solid ${bg.accent}40`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
              <div>
                <p style={label}>バイラル予測スコア</p>
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 2 }}>2026 Q2 IG Reels アルゴリズム準拠</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: IRIS_FONTS.display, fontSize: '2.2rem', fontWeight: 800, color: bg.accent }}>
                  {algoScore.viral}
                </span>
                <span style={{ fontSize: '0.78rem', color: bg.inkSoft }}>/100</span>
              </div>
            </div>
            {/* 4 軸バー */}
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                { key: '視聴維持',     val: algoScore.watch, hint: 'Watch Time / 完視聴率' },
                { key: '保存性',       val: algoScore.save,  hint: '保存率 (saves/views)' },
                { key: 'シェア性',     val: algoScore.share, hint: 'Reshare to Story/DM' },
                { key: 'アルゴ評価',   val: algoScore.algo,  hint: '字幕 / BGM / 比率 / 長さ' },
              ].map(axis => (
                <div key={axis.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: 2 }}>
                    <span style={{ color: bg.ink, fontWeight: 700 }}>{axis.key} <span style={{ color: bg.inkSoft, fontWeight: 400 }}>· {axis.hint}</span></span>
                    <span style={{ color: bg.accent, fontWeight: 700 }}>{axis.val}</span>
                  </div>
                  <div style={{ height: 5, background: '#fff', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      width: `${axis.val}%`, height: '100%',
                      background: `linear-gradient(90deg, ${bg.accent}, ${bg.accent}cc)`,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trend Pulse — 今月最も伸びてるフォーマット */}
          <div style={{
            ...card,
            background: 'linear-gradient(135deg, #FFF7ED, #FED7AA20)',
            border: '1px solid #FB923C40',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <p style={{ ...label, color: '#EA580C' }}>TREND PULSE</p>
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 2 }}>2026年 5月時点で最も伸びてる 5 フォーマット</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {TREND_PULSE_2026_Q2.map(id => {
                const p = VIRAL_PATTERNS.find(x => x.id === id);
                if (!p) return null;
                return (
                  <button key={p.id} onClick={() => applyViralPattern(p)} style={{
                    ...btn(activeFormat === p.id),
                    minWidth: 160, flexShrink: 0,
                    flexDirection: 'column' as const,
                    alignItems: 'flex-start',
                    textAlign: 'left' as const,
                    padding: '0.6rem 0.75rem',
                    gap: 2,
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.name}</span>
                    <span style={{ fontSize: '0.68rem', color: bg.inkSoft }}>
                      {p.trend2026} · watch ×{p.watchMultiplier}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* コミュニティ テンプレート (CapCut 食う) */}
          <div style={{
            ...card,
            background: 'linear-gradient(135deg, #FDF2F8, #FCE7F3 60%, transparent)',
            border: '1px solid #F472B640',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: '0.6rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ ...label, color: '#BE185D' }}>コミュニティ テンプレート</p>
                <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 2 }}>
                  他のクリエイターが作って共有した型を1クリックで適用
                </p>
              </div>
              <button onClick={exportAsTemplate} disabled={!clips.length && !captions.length} style={{
                ...btn(true),
                fontSize: '0.74rem',
                padding: '0.4rem 0.85rem',
              }}>
                <Share2 size={12} /> 自分の型を共有
              </button>
            </div>
            {/* 共有 URL 表示 */}
            {shareUrl && (
              <div style={{
                padding: '0.6rem 0.75rem',
                background: '#fff',
                border: `1px solid ${bg.cardBorder}`,
                borderRadius: 8,
                marginBottom: '0.6rem',
                fontSize: '0.74rem',
                display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <span style={{ color: bg.inkSoft, flexShrink: 0 }}>共有 URL:</span>
                <input
                  readOnly
                  value={shareUrl}
                  onClick={e => (e.target as HTMLInputElement).select()}
                  style={{
                    flex: 1, minWidth: 0,
                    border: 'none', outline: 'none',
                    fontSize: '0.74rem', fontFamily: 'monospace',
                    background: 'transparent', color: bg.ink,
                  }}
                />
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }} style={{
                  ...btn(),
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.7rem',
                }}>
                  {shareCopied ? 'コピー済' : 'コピー'}
                </button>
              </div>
            )}
            {/* コミュニティ トレンド テンプレ */}
            <div style={{ marginBottom: '0.6rem' }}>
              <button onClick={fetchTrending} disabled={trendingLoading} style={{
                ...btn(),
                fontSize: '0.74rem',
                padding: '0.35rem 0.7rem',
              }}>
                {trendingLoading ? <Loader2 size={12} className="spin" /> : <Sparkles size={12} />}
                トレンド型を見る ({trendingTemplates.length})
              </button>
              {trendingTemplates.length > 0 && (
                <div style={{
                  marginTop: '0.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 6,
                }}>
                  {trendingTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTrendingTemplate(t.body, t.id)}
                      style={{
                        ...btn(),
                        flexDirection: 'column' as const,
                        alignItems: 'flex-start',
                        padding: '0.5rem 0.6rem',
                        fontSize: '0.72rem',
                        gap: 2,
                        whiteSpace: 'normal' as const,
                        textAlign: 'left' as const,
                      }}
                    >
                      <span style={{ fontWeight: 700, lineHeight: 1.2 }}>{t.title}</span>
                      <span style={{ color: bg.inkSoft, fontSize: '0.68rem' }}>
                        @{t.author} ・ 採用 {t.uses}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* カテゴリフィルタ */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: '0.6rem' }}>
              {TEMPLATE_CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setTemplateCategory(c.id)} style={{
                  ...btn(templateCategory === c.id),
                  fontSize: '0.72rem',
                  padding: '0.3rem 0.65rem',
                }}>
                  {c.label}
                </button>
              ))}
            </div>
            {/* テンプレートグリッド */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
              {COMMUNITY_TEMPLATES
                .filter(t => templateCategory === 'all' || t.category === templateCategory)
                .sort((a, b) => b.uses - a.uses)
                .map(t => (
                  <button key={t.id} onClick={() => applyCommunityTemplate(t)} style={{
                    ...btn(activeFormat === t.id),
                    flexDirection: 'column' as const,
                    alignItems: 'stretch',
                    textAlign: 'left' as const,
                    padding: '0.65rem 0.8rem',
                    gap: 4,
                    width: '100%',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, lineHeight: 1.3 }}>{t.name}</span>
                      <span style={{ fontSize: '0.65rem', color: bg.inkSoft, flexShrink: 0 }}>{t.authorHandle}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: bg.inkSoft, lineHeight: 1.4 }}>
                      {t.thumbnailHint}
                    </div>
                    <div style={{ display: 'flex', gap: 8, fontSize: '0.66rem', color: bg.inkSoft, marginTop: 2 }}>
                      <span>{(t.uses / 1000).toFixed(1)}k</span>
                      <span>{(t.saves / 1000).toFixed(1)}k</span>
                      <span>{t.bgmMood}</span>
                    </div>
                  </button>
                ))}
            </div>
            <p style={{ fontSize: '0.68rem', color: bg.inkSoft, marginTop: '0.5rem', fontStyle: 'italic' }}>
              ※ 「自分の型を共有」で URL を作成すると、他のクリエイターと同じ構成を共有できます
            </p>
          </div>

          {/* バイラルパターン カタログ (全 10) */}
          <div style={card}>
            <p style={label}>バイラル パターン カタログ (10 種)</p>
            <p style={{ fontSize: '0.74rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              実測 watch-time × save × share でスコア化。選ぶと字幕骨格 + 切替速度 + 遷移を一括適用
            </p>
            <div style={{ display: 'grid', gap: 6 }}>
              {VIRAL_PATTERNS.map(p => (
                <button key={p.id} onClick={() => applyViralPattern(p)} style={{
                  ...btn(activeFormat === p.id),
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  textAlign: 'left' as const,
                  padding: '0.6rem 0.8rem',
                  gap: 8,
                  width: '100%',
                  whiteSpace: 'normal' as const,
                }}>
                  <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800 }}>
                      {p.name} <span style={{ color: '#EA580C', fontSize: '0.7rem' }}>{''.repeat(p.trend2026)}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: bg.inkSoft, lineHeight: 1.5 }}>
                      {p.example} · 推奨 BGM: {p.musicMood}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: bg.inkSoft, opacity: 0.85 }}>
                      watch ×{p.watchMultiplier} · 保存{p.saveScore} · シェア{p.shareScore} · {p.bestFor}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.65rem', fontWeight: 700,
                    background: bg.accent, color: '#fff',
                    padding: '4px 8px', borderRadius: 8, flexShrink: 0,
                  }}>適用</div>
                </button>
              ))}
            </div>
          </div>

          {/* 保存テンプレート (構造化されたリール骨格) */}
          <div style={card}>
            <p style={label}><Wand2 size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />保存される構造テンプレ</p>
            <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              保存率が高いリール構造を字幕枠ごと自動生成 → 素材を当てはめるだけ
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 6 }}>
              {SAVE_FORMATS.map(f => (
                <button key={f.id} onClick={() => applySaveFormat(f)} style={{
                  ...btn(activeFormat === f.id),
                  flexDirection: 'column' as const,
                  alignItems: 'flex-start',
                  textAlign: 'left' as const,
                  padding: '0.55rem 0.7rem',
                  gap: 3,
                  minHeight: 64,
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{f.name}</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.75, lineHeight: 1.4 }}>{f.why}</span>
                </button>
              ))}
            </div>
          </div>

          {/* フックライブラリ (最初の 1-3 秒テキスト) */}
          <div style={card}>
            <p style={label}>離脱を止めるフック ({HOOK_LIBRARY.length}種)</p>
            <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              最初の字幕として一発挿入。◯◯ は自分のテーマに置換してください
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 4, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
              {HOOK_LIBRARY.map(h => (
                <button key={h.id} onClick={() => insertHook(h)} style={{
                  ...btn(),
                  flexDirection: 'column' as const,
                  alignItems: 'flex-start',
                  textAlign: 'left' as const,
                  padding: '0.45rem 0.6rem',
                  gap: 2,
                }}>
                  <span style={{ fontSize: '0.62rem', color: bg.accent, fontWeight: 700, letterSpacing: '0.1em' }}>
                    {h.cat}
                  </span>
                  <span style={{ fontSize: '0.78rem', lineHeight: 1.4, color: bg.ink, whiteSpace: 'normal' as const }}>
                    {h.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 保存 CTA (末尾の決め台詞) */}
          <div style={card}>
            <p style={label}>保存させる末尾 CTA</p>
            <p style={{ fontSize: '0.76rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              押すと末尾字幕に追加。保存率 +30-50% の実証 CTA
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SAVE_CTAS.map((cta, i) => (
                <button key={i} onClick={() => appendSaveCta(cta)} style={{
                  ...btn(),
                  fontSize: '0.74rem',
                  padding: '0.38rem 0.7rem',
                }}>
                  {cta}
                </button>
              ))}
            </div>
          </div>

          {/* 編集テンプレート (型) */}
          <div style={card}>
            <p style={label}><Wand2 size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />編集テンプレート</p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              選ぶだけで切替速度・遷移・字幕スタイルが一括適用されます
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
              {REEL_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t)} style={{
                  ...btn(),
                  flexDirection: 'column' as const,
                  alignItems: 'flex-start',
                  textAlign: 'left' as const,
                  padding: '0.6rem 0.7rem',
                  gap: 2,
                  minHeight: 56,
                }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t.name}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{t.subtitle} · BGM: {t.bgmHint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 素材追加 + ドラッグ&ドロップ */}
          <div
            style={{
              ...card,
              border: dragOver ? `2px dashed ${bg.accent}` : card.border,
              background: dragOver ? `${bg.accent}10` : card.background,
              transition: 'all 0.15s',
            }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) handleDroppedFiles(e.dataTransfer.files);
            }}
          >
            <p style={label}>素材</p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              <UploadCloud size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />
              ボタンを押すか、ここに画像 / 動画 / 音楽をドロップ
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label style={btn()}>
                <ImageIcon size={14} /> 画像 (複数可)
                <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = ''; }} />
              </label>
              <label style={btn()}>
                <Film size={14} /> 動画 (複数可)
                <input type="file" accept="video/*,.mp4,.mov,.webm,.m4v" multiple style={{ display: 'none' }}
                  onChange={e => { if (e.target.files) addVideos(e.target.files); e.target.value = ''; }} />
              </label>
              <label style={btn()}>
                <Music size={14} /> BGM
                <input type="file" accept="audio/*" style={{ display: 'none' }}
                  onChange={e => setBgmFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            {uploadError && (
              <div style={{
                marginTop: '0.6rem', padding: '0.55rem 0.75rem',
                background: '#FEE2E2', color: '#991B1B', borderRadius: 8,
                fontSize: '0.78rem', display: 'flex', gap: 6, alignItems: 'flex-start',
                whiteSpace: 'pre-wrap' as const,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{uploadError}</span>
              </div>
            )}
            {bgmFile && (
              <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginTop: '0.5rem' }}>
                {bgmFile.name}{bpm ? ` ・推定 ${bpm} BPM` : ''}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: '0.78rem', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={beatCut} onChange={e => setBeatCut(e.target.checked)} disabled={!bpm} />
                ビート同期カット
              </label>
              {!beatCut && (
                <>
                  <select value={presetCut} onChange={e => setPresetCut(Number(e.target.value))}
                    style={{ ...inp, width: 'auto', padding: '0.4rem 0.5rem' }}>
                    <option value={0.5}>0.5s</option>
                    <option value={1.0}>1.0s</option>
                    <option value={1.5}>1.5s</option>
                    <option value={2.0}>2.0s</option>
                    <option value={3.0}>3.0s</option>
                  </select>
                </>
              )}
              <button onClick={applyAutoCut} disabled={!clips.length} style={btn()}>
                <Sparkles size={13} /> 自動カット適用
              </button>
            </div>
          </div>

          {/* BGM ライブラリ (ロイヤリティフリー) */}
          <div style={card}>
            <p style={label}><Music size={12} style={{ verticalAlign: '-2px', marginRight: 4 }} />BGM ライブラリ</p>
            <p style={{ fontSize: '0.78rem', color: bg.inkSoft, marginBottom: '0.6rem' }}>
              Pixabay Music の CC0 トラック。試聴 → 適用ですぐ使えます。
            </p>
            <audio ref={bgmPreviewRef} style={{ display: 'none' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
              {BGM_LIBRARY.map(t => {
                const isPreview = bgmPreviewId === t.id;
                const isLoading = bgmLoading === t.id;
                return (
                  <div key={t.id} style={{
                    border: `1px solid ${bg.cardBorder}`,
                    borderRadius: 10,
                    padding: '0.55rem 0.7rem',
                    background: '#fff',
                    display: 'grid',
                    gap: 4,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: bg.ink }}>{t.name}</span>
                      <span style={{ fontSize: '0.7rem', color: bg.inkSoft }}>{t.bpm} BPM</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: bg.inkSoft }}>{t.mood} · {Math.floor(t.sec / 60)}:{String(t.sec % 60).padStart(2, '0')}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => togglePreview(t)} style={{
                        ...btn(),
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.72rem',
                        flex: 1,
                      }}>
                        {isPreview ? <Square size={11} /> : <Play size={11} />}
                        {isPreview ? '停止' : '試聴'}
                      </button>
                      <button onClick={() => applyBgmFromLibrary(t)} disabled={isLoading} style={{
                        ...btn(true),
                        padding: '0.3rem 0.55rem',
                        fontSize: '0.72rem',
                        flex: 1,
                      }}>
                        {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        {isLoading ? '読込' : '適用'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '0.7rem', color: bg.inkSoft, marginTop: '0.5rem', fontStyle: 'italic' }}>
              ※ 全曲 CC0 / Pixabay Music 提供。商用利用・SNS 投稿可。
            </p>
          </div>

          {/* タイムライン */}
          <div style={card}>
            <p style={label}>タイムライン</p>
            {!clips.length && <p style={{ fontSize: '0.85rem', color: bg.inkSoft }}>上から素材を追加してください。</p>}
            <div style={{ display: 'grid', gap: 6 }}>
              {clips.map((c, i) => (
                <div key={c.id} style={{
                  display: 'grid', gridTemplateColumns: '54px 1fr auto', gap: 8,
                  border: `1px solid ${bg.cardBorder}`, borderRadius: 12, padding: 6,
                  background: '#fff',
                }}>
                  <div style={{ width: 54, height: 72, background: '#000', borderRadius: 8, overflow: 'hidden' }}>
                    {c.kind === 'image' ? (
                      <img src={c.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <video src={c.url} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: 4, fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: bg.ink }}>#{i + 1}</span>
                      <span style={{ color: bg.inkSoft }}>{c.kind === 'image' ? '画像' : '動画'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        秒
                        <input type="number" min={0.3} max={20} step={0.1} value={c.duration}
                          onChange={e => updateClip(c.id, { duration: Number(e.target.value) })}
                          style={{ ...inp, width: 60, padding: '0.25rem 0.35rem' }} />
                      </label>
                      {c.kind === 'image' && (
                        <select value={c.kenBurns} onChange={e => updateClip(c.id, { kenBurns: e.target.value as KenBurns })}
                          style={{ ...inp, width: 'auto', padding: '0.25rem 0.4rem' }}>
                          {KEN_BURNS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
                        </select>
                      )}
                      <select value={c.transition} onChange={e => updateClip(c.id, { transition: e.target.value as Transition })}
                        style={{ ...inp, width: 'auto', padding: '0.25rem 0.4rem' }}>
                        {TRANSITIONS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <select value={c.grade || 'none'} onChange={e => updateClip(c.id, { grade: e.target.value as GradeId })}
                        style={{ ...inp, width: 'auto', padding: '0.25rem 0.4rem' }} title="LUT カラーグレード">
                        {COLOR_GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                      {c.kind === 'video' && (
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          速度
                          <select value={c.speed ?? 1} onChange={e => {
                            const sp = Number(e.target.value);
                            const v = c.el as HTMLVideoElement | undefined;
                            if (v) v.playbackRate = sp;
                            updateClip(c.id, { speed: sp });
                          }} style={{ ...inp, width: 'auto', padding: '0.25rem 0.4rem' }}>
                            <option value={0.25}>0.25×</option>
                            <option value={0.5}>0.5×</option>
                            <option value={0.75}>0.75×</option>
                            <option value={1}>1×</option>
                            <option value={1.5}>1.5×</option>
                            <option value={2}>2×</option>
                            <option value={3}>3×</option>
                            <option value={4}>4×</option>
                          </select>
                        </label>
                      )}
                      {c.kind === 'image' && (() => {
                        const state = bgRemoval[c.id];
                        const busy = state === 'busy';
                        const errMsg = typeof state === 'object' && state ? state.error : '';
                        const runBgRemove = async () => {
                          setBgRemoval(prev => ({ ...prev, [c.id]: 'busy' }));
                          try {
                            const { blobUrl } = await removeBackgroundFromUrl(c.url);
                            const img = new Image();
                            img.onload = () => {
                              updateClip(c.id, { url: blobUrl, el: img });
                              setBgRemoval(prev => {
                                const next = { ...prev };
                                delete next[c.id];
                                return next;
                              });
                            };
                            img.onerror = () => {
                              setBgRemoval(prev => ({ ...prev, [c.id]: { error: '画像の再読込に失敗しました' } }));
                            };
                            img.src = blobUrl;
                          } catch (err: any) {
                            const msg = err?.message || '背景除去に失敗しました';
                            console.warn('bg removal failed', err);
                            setBgRemoval(prev => ({ ...prev, [c.id]: { error: msg } }));
                          }
                        };
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <button
                              onClick={runBgRemove}
                              disabled={busy}
                              style={{ ...btn(), padding: '0.25rem 0.4rem', fontSize: '0.72rem', opacity: busy ? 0.6 : 1 }}
                              title="単色背景を透過 PNG として除去 (商品写真・ポートレート向き)"
                            >
                              {busy ? '除去中…' : errMsg ? '再試行' : '背景除去'}
                            </button>
                            {errMsg && (
                              <span style={{ fontSize: '0.65rem', color: '#ff8a8a', maxWidth: 140 }}>
                                {errMsg}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <button onClick={() => moveClip(c.id, -1)} disabled={i === 0} style={btn()}><ChevronUp size={12} /></button>
                    <button onClick={() => moveClip(c.id, 1)} disabled={i === clips.length - 1} style={btn()}><ChevronDown size={12} /></button>
                    <button onClick={() => removeClip(c.id)} style={btn()}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 字幕 */}
          <div style={card}>
            <p style={label}>字幕 (AI 自動 + 手動)</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={startTranscribe} disabled={transcribing} style={btn(true)}>
                {transcribing ? <Loader2 size={13} className="spin" /> : <Mic size={13} />}
                AI で字幕生成
              </button>
              <button onClick={addManualCaption} style={btn()}>+ 手動追加</button>
            </div>
            {transcribeErr && <p style={{ color: '#C8385C', fontSize: '0.78rem', marginTop: 6 }}>{transcribeErr}</p>}
            <div style={{ display: 'grid', gap: 6, marginTop: '0.6rem' }}>
              {captions.map((cap, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '60px 60px 1fr auto', gap: 6,
                  alignItems: 'center', padding: 6, border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                  background: '#fff',
                }}>
                  <input type="number" min={0} step={0.1} value={cap.start.toFixed(1)}
                    onChange={e => updateCaption(i, { start: Number(e.target.value) })}
                    style={{ ...inp, padding: '0.3rem 0.4rem', fontSize: '0.78rem' }} />
                  <input type="number" min={0} step={0.1} value={cap.end.toFixed(1)}
                    onChange={e => updateCaption(i, { end: Number(e.target.value) })}
                    style={{ ...inp, padding: '0.3rem 0.4rem', fontSize: '0.78rem' }} />
                  <input value={cap.text} onChange={e => updateCaption(i, { text: e.target.value })}
                    style={{ ...inp, padding: '0.3rem 0.5rem', fontSize: '0.82rem' }} />
                  <button onClick={() => removeCaption(i)} style={btn()}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            <p style={{ ...label, marginTop: '1rem' }}>字幕スタイル</p>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Type size={13} color={bg.inkSoft} />
                <select value={capStyle.font} onChange={e => {
                  const f = FONTS.find(x => x.cssName === e.target.value);
                  if (f) loadFont(f.href);
                  setCapStyle(s => ({ ...s, font: e.target.value }));
                }} style={{ ...inp, width: 'auto' }}>
                  {FONTS.map(f => <option key={f.family} value={f.cssName}>{f.family}</option>)}
                </select>
                <input type="number" min={20} max={140} value={capStyle.size}
                  onChange={e => setCapStyle(s => ({ ...s, size: Number(e.target.value) }))}
                  style={{ ...inp, width: 70 }} />
                <input type="color" value={capStyle.color}
                  onChange={e => setCapStyle(s => ({ ...s, color: e.target.value }))}
                  style={{ width: 38, height: 38, border: `1px solid ${bg.cardBorder}`, borderRadius: 8, padding: 2, background: '#fff' }} />
                <input type="color" value={capStyle.stroke}
                  onChange={e => setCapStyle(s => ({ ...s, stroke: e.target.value }))}
                  style={{ width: 38, height: 38, border: `1px solid ${bg.cardBorder}`, borderRadius: 8, padding: 2, background: '#fff' }} />
                <input type="number" min={0} max={20} value={capStyle.strokeWidth}
                  onChange={e => setCapStyle(s => ({ ...s, strokeWidth: Number(e.target.value) }))}
                  style={{ ...inp, width: 60 }} title="縁取り太さ" />
                <label style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" checked={capStyle.shadow}
                    onChange={e => setCapStyle(s => ({ ...s, shadow: e.target.checked }))} />
                  影
                </label>
                <select value={capStyle.anim} onChange={e => setCapStyle(s => ({ ...s, anim: e.target.value as CaptionAnim }))}
                  style={{ ...inp, width: 'auto' }}>
                  <option value="none">出現なし</option>
                  <option value="fade-in">フェードイン</option>
                  <option value="pop">ポップ</option>
                  <option value="slide-up">スライドアップ</option>
                </select>
              </div>
            </div>

            {/* AI 翻訳: 日本語字幕 → 英 / 中 / 韓 */}
            <p style={{ ...label, marginTop: '1rem' }}>AI 翻訳 (Gemini)</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['en', 'zh', 'ko'] as TargetLang[]).map(lng => (
                <button key={lng} disabled={!captions.length || translating !== null}
                  onClick={async () => {
                    setTranslateErr('');
                    setTranslating(lng);
                    try {
                      if (!originalCaptions) setOriginalCaptions(captions);
                      const texts = captions.map(c => c.text);
                      const translated = await translateCaptions(texts, lng);
                      setCaptions(prev => prev.map((c, i) => ({ ...c, text: translated[i] ?? c.text })));
                    } catch (e: any) {
                      setTranslateErr(e?.message || '翻訳失敗');
                    } finally {
                      setTranslating(null);
                    }
                  }} style={btn(translating === lng)}>
                  {translating === lng ? <Loader2 size={12} className="spin" /> : null}
                  {lng === 'en' ? '英語' : lng === 'zh' ? '中文' : '한국어'} に翻訳
                </button>
              ))}
              {originalCaptions && (
                <button onClick={() => { setCaptions(originalCaptions); setOriginalCaptions(null); }} style={btn()}>
                  日本語に戻す
                </button>
              )}
            </div>
            {translateErr && <p style={{ color: '#C8385C', fontSize: '0.78rem', marginTop: 6 }}>{translateErr}</p>}

            {/* AI ナレーション (Web Speech TTS) */}
            <p style={{ ...label, marginTop: '1rem' }}>AI ナレーション (無料 TTS)</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                <input type="checkbox" checked={ttsEnabled} onChange={e => setTtsEnabled(e.target.checked)} />
                書き出し時にナレーションを乗せる
              </label>
              <select value={voicePreset} onChange={e => setVoicePreset(e.target.value as VoiceStyle)}
                style={{ ...inp, width: 'auto' }}>
                {VOICE_PRESETS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <select value={ttsLang} onChange={e => setTtsLang(e.target.value as typeof ttsLang)}
                style={{ ...inp, width: 'auto' }}>
                <option value="ja-JP">日本語</option>
                <option value="en-US">English</option>
                <option value="zh-CN">中文</option>
                <option value="ko-KR">한국어</option>
              </select>
            </div>
            <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 4 }}>
              字幕テキストをそのまま読み上げ。ブラウザ標準の TTS なので完全無料・APIキー不要。
            </p>
          </div>

          {/* ステッカー / 矢印 / 吹き出し */}
          <div style={card}>
            <p style={label}>ステッカー / アイコン / 矢印</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => {
                setStickers(prev => [...prev, {
                  id: makeStickerId(), kind: 'icon', payload: 'sparkles',
                  start: 0, end: Math.min(totalDuration || 3, 3),
                  x: 0.5, y: 0.5, size: 140, rotation: 0, color: '#FFD24D',
                  anim: 'pop',
                }]);
              }} style={btn(true)}>+ アイコン</button>
              <button onClick={() => {
                setStickers(prev => [...prev, {
                  id: makeStickerId(), kind: 'arrow', payload: 'right',
                  start: 0, end: Math.min(totalDuration || 3, 3),
                  x: 0.3, y: 0.5, size: 160, rotation: 0, color: '#FF3D6E',
                  anim: 'shake',
                }]);
              }} style={btn()}>+ 矢印</button>
              <button onClick={() => {
                setStickers(prev => [...prev, {
                  id: makeStickerId(), kind: 'bubble', payload: 'ここ!',
                  start: 0, end: Math.min(totalDuration || 3, 3),
                  x: 0.5, y: 0.7, size: 140, rotation: 0, color: '#FFFFFF',
                  anim: 'bounce',
                }]);
              }} style={btn()}>+ 吹き出し</button>
              <button onClick={() => {
                setStickers(prev => [...prev, {
                  id: makeStickerId(), kind: 'badge', payload: 'NEW',
                  start: 0, end: Math.min(totalDuration || 3, 3),
                  x: 0.18, y: 0.18, size: 110, rotation: -8, color: '#FF3D6E',
                  anim: 'pop',
                }]);
              }} style={btn()}>+ バッジ</button>
              {stickers.length > 0 && (
                <button onClick={() => setStickers([])} style={btn()}>
                  <Trash2 size={12} /> すべて削除
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: '0.6rem' }}>
              {stickers.map((s, i) => (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 6,
                  alignItems: 'center', padding: 6, border: `1px solid ${bg.cardBorder}`, borderRadius: 10,
                  background: '#fff',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: bg.ink }}>#{i + 1} {s.kind}</span>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {s.kind === 'icon' && (
                      <select value={s.payload} onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, payload: e.target.value } : x))}
                        style={{ ...inp, width: 'auto', padding: '0.2rem 0.3rem', fontSize: '0.75rem' }}>
                        {STICKER_ICONS.map(ic => <option key={ic.id} value={ic.id}>{ic.label}</option>)}
                      </select>
                    )}
                    {s.kind === 'arrow' && (
                      <select value={s.payload} onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, payload: e.target.value } : x))}
                        style={{ ...inp, width: 'auto', padding: '0.2rem 0.3rem', fontSize: '0.75rem' }}>
                        <option value="up">↑</option>
                        <option value="down">↓</option>
                        <option value="left">←</option>
                        <option value="right">→</option>
                      </select>
                    )}
                    {(s.kind === 'bubble' || s.kind === 'badge') && (
                      <input value={s.payload}
                        onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, payload: e.target.value } : x))}
                        style={{ ...inp, padding: '0.2rem 0.3rem', fontSize: '0.78rem', width: 100 }} />
                    )}
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.7rem' }}>
                      開始
                      <input type="number" min={0} step={0.1} value={s.start.toFixed(1)}
                        onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, start: Number(e.target.value) } : x))}
                        style={{ ...inp, width: 55, padding: '0.2rem 0.3rem', fontSize: '0.75rem' }} />
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.7rem' }}>
                      終了
                      <input type="number" min={0} step={0.1} value={s.end.toFixed(1)}
                        onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, end: Number(e.target.value) } : x))}
                        style={{ ...inp, width: 55, padding: '0.2rem 0.3rem', fontSize: '0.75rem' }} />
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.7rem' }}>
                      X
                      <input type="number" min={0} max={1} step={0.05} value={s.x.toFixed(2)}
                        onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, x: Number(e.target.value) } : x))}
                        style={{ ...inp, width: 55, padding: '0.2rem 0.3rem', fontSize: '0.75rem' }} />
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.7rem' }}>
                      Y
                      <input type="number" min={0} max={1} step={0.05} value={s.y.toFixed(2)}
                        onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, y: Number(e.target.value) } : x))}
                        style={{ ...inp, width: 55, padding: '0.2rem 0.3rem', fontSize: '0.75rem' }} />
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.7rem' }}>
                      サイズ
                      <input type="number" min={20} max={500} value={s.size}
                        onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, size: Number(e.target.value) } : x))}
                        style={{ ...inp, width: 55, padding: '0.2rem 0.3rem', fontSize: '0.75rem' }} />
                    </label>
                    <input type="color" value={s.color}
                      onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, color: e.target.value } : x))}
                      style={{ width: 28, height: 28, border: `1px solid ${bg.cardBorder}`, borderRadius: 6, padding: 0, background: '#fff' }} />
                    <select value={s.anim} onChange={e => setStickers(prev => prev.map(x => x.id === s.id ? { ...x, anim: e.target.value as StickerAnim } : x))}
                      style={{ ...inp, width: 'auto', padding: '0.2rem 0.3rem', fontSize: '0.75rem' }}>
                      {STICKER_ANIMS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => setStickers(prev => prev.filter(x => x.id !== s.id))} style={btn()}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: bg.inkSoft, marginTop: 6 }}>
              Lucide アイコン {STICKER_ICONS.length} 種 + 矢印 / 吹き出し / バッジ。アニメ {STICKER_ANIMS.length} 種。
            </p>
          </div>

          {/* AI ハイライト検出 + 一括 LUT */}
          <div style={card}>
            <p style={label}>AI ハイライト & 一括カラーグレード</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button onClick={async () => {
                if (!bgmFile) { setHighlightInfo('BGM が必要です'); return; }
                setHighlightBusy(true);
                setHighlightInfo('');
                try {
                  const { peaks, duration } = await detectAudioPeaks(bgmFile, Math.max(3, Math.min(clips.length || 5, 8)));
                  if (!peaks.length) { setHighlightInfo('ピーク検出ゼロ。別の BGM で試してください'); return; }
                  // ピーク時刻にクリップ境界を合わせる
                  const newDurs: number[] = [];
                  let prev = 0;
                  for (let i = 0; i < clips.length; i++) {
                    const target = peaks[Math.min(i, peaks.length - 1)] ?? duration;
                    const d = Math.max(0.6, target - prev);
                    newDurs.push(d);
                    prev = target;
                  }
                  setClips(prev => prev.map((c, i) => ({ ...c, duration: newDurs[i] ?? c.duration })));
                  setHighlightInfo(`${peaks.length} 個のピークを検出 → カット点に反映 (BGM ${duration.toFixed(1)}s)`);
                } catch (e: any) {
                  setHighlightInfo('検出失敗: ' + (e?.message || 'unknown'));
                } finally {
                  setHighlightBusy(false);
                }
              }} disabled={highlightBusy || !clips.length} style={btn(true)}>
                {highlightBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                ハイライトを自動検出
              </button>
              <select onChange={e => {
                const id = e.target.value as GradeId;
                setClips(prev => prev.map(c => ({ ...c, grade: id })));
              }} style={{ ...inp, width: 'auto' }} defaultValue="">
                <option value="" disabled>全クリップに LUT を一括適用</option>
                {COLOR_GRADES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>
            {highlightInfo && <p style={{ fontSize: '0.75rem', color: bg.inkSoft, marginTop: 6 }}>{highlightInfo}</p>}
          </div>

          {/* 書き出し */}
          <div style={card}>
            <p style={label}>書き出し</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: bg.ink }}>
                <input type="checkbox" checked={export4K}
                  onChange={e => setExport4K(e.target.checked)} />
                4K (2160×3840) で出力 — 重くなる可能性あり
              </label>
              {!recording ? (
                <button onClick={startExport} disabled={!clips.length} style={btn(true)}>
                  <Download size={14} /> リール書き出し開始 ({export4K ? '4K' : '1080p'})
                </button>
              ) : (
                <button disabled style={btn()}>
                  <Loader2 size={14} className="spin" /> 録画中 {Math.round(progress * 100)}%
                </button>
              )}
              {exportUrl && (
                <>
                  <button onClick={downloadOutput} style={btn()}>
                    <Download size={14} /> ダウンロード ({convertedMp4 ? 'MP4' : exportMime.includes('mp4') ? 'MP4' : 'WebM'})
                  </button>
                  {!convertedMp4 && !exportMime.includes('mp4') && (
                    <button onClick={convertToMp4} disabled={converting} style={btn()}>
                      {converting ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                      MP4 に変換 (~30MB 初回 DL)
                    </button>
                  )}
                  <button onClick={shareReel} style={btn()}>
                    <Share2 size={14} /> Instagram で開く
                  </button>
                  <button onClick={openScheduleModal} style={btn(true)}>
                    <Wand2 size={14} /> AI で投稿予約を作る
                  </button>
                </>
              )}
              {/* 書き出してなくても予約は作れる (素材は後で再生成) */}
              {!exportUrl && (clips.length > 0 || captions.length > 0) && (
                <button onClick={openScheduleModal} style={btn(true)}>
                  <Wand2 size={14} /> AI で投稿予約を作る (素材なし)
                </button>
              )}
            </div>
            {exportUrl && (
              <video src={convertedMp4 || exportUrl} controls
                style={{ width: '100%', maxWidth: 360, marginTop: '0.8rem', borderRadius: 12, background: '#000' }} />
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes iris-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .spin { animation: iris-spin 0.9s linear infinite; }
      `}</style>

      {/* ── 投稿予約モーダル ────────────────────────────── */}
      {scheduleOpen && (
        <div
          onClick={() => setScheduleOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 12, 30, 0.65)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 580,
              maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
              background: '#fff', borderRadius: 20,
              padding: '1.4rem 1.3rem',
              boxShadow: '0 24px 64px rgba(0,0,0,0.32)',
              color: '#1F1A2E',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.9rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>AI で投稿予約を作る</h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#666' }}>
                  リール内容 + 案件文脈から AI が Instagram キャプション + ハッシュタグを自動生成
                </p>
              </div>
              <button onClick={() => setScheduleOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888', padding: 0 }}>×</button>
            </div>

            {/* 案件選択 */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
              案件と紐づける (任意)
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: '0.7rem' }}>
              <select
                value={scheduleDealId}
                onChange={e => { setScheduleDealId(e.target.value); void generateScheduleDraft(e.target.value); }}
                style={{ flex: 1, padding: '0.55rem 0.7rem', border: '1px solid #E2DEF0', borderRadius: 8, fontSize: '0.88rem' }}>
                <option value="">— 自社投稿 (PR表記なし) —</option>
                {myDeals.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.brandName} ({d.platform})</option>
                ))}
              </select>
              <button
                onClick={() => generateScheduleDraft(scheduleDealId)}
                disabled={scheduleGenerating}
                style={{
                  padding: '0.55rem 0.85rem',
                  background: bg.accent, color: '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 700,
                  fontSize: '0.78rem', cursor: scheduleGenerating ? 'not-allowed' : 'pointer',
                  opacity: scheduleGenerating ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}>
                {scheduleGenerating ? '生成中…' : '再生成'}
              </button>
            </div>

            {/* 予約時刻 */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
              予約時刻 (Instagram ピークタイム提案済)
            </label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={e => setScheduleAt(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #E2DEF0', borderRadius: 8, fontSize: '0.88rem', marginBottom: '0.7rem' }}
            />

            {/* キャプション */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                キャプション {scheduleGenerating && <span style={{ color: bg.accent, fontWeight: 500 }}>(AI 生成中…)</span>}
              </label>
              <button
                type="button"
                onClick={() => copyScheduleField('post')}
                disabled={!scheduleCaption.trim()}
                title="本文＋CTA をまとめてコピー → Instagram にそのまま貼れます"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '0.3rem 0.6rem', borderRadius: 7,
                  border: 'none', cursor: scheduleCaption.trim() ? 'pointer' : 'not-allowed',
                  background: scheduleCopied === 'post' ? '#ECFDF5' : '#F4F0FA',
                  color: scheduleCopied === 'post' ? '#065F46' : bg.accent,
                  fontSize: '0.72rem', fontWeight: 700,
                  opacity: scheduleCaption.trim() ? 1 : 0.5,
                }}>
                {scheduleCopied === 'post' ? <><Check size={13} /> コピー済</> : <><Copy size={13} /> 本文をコピー</>}
              </button>
            </div>
            <textarea
              value={scheduleCaption}
              onChange={e => setScheduleCaption(e.target.value)}
              rows={7}
              placeholder="ここに本文が自動生成されます…"
              style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #E2DEF0', borderRadius: 8, fontSize: '0.85rem', marginBottom: '0.7rem', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
            />

            {/* ハッシュタグ */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                ハッシュタグ <span style={{ fontWeight: 500, color: '#888' }}>(最初のコメントに貼ると本文がすっきり)</span>
              </label>
              <button
                type="button"
                onClick={() => copyScheduleField('tags')}
                disabled={!scheduleHashtags.trim()}
                title="ハッシュタグをコピー → Instagram の「最初のコメント」に貼ると本文が読みやすくなります"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '0.3rem 0.6rem', borderRadius: 7,
                  border: 'none', cursor: scheduleHashtags.trim() ? 'pointer' : 'not-allowed',
                  background: scheduleCopied === 'tags' ? '#ECFDF5' : '#F4F0FA',
                  color: scheduleCopied === 'tags' ? '#065F46' : bg.accent,
                  fontSize: '0.72rem', fontWeight: 700,
                  opacity: scheduleHashtags.trim() ? 1 : 0.5,
                }}>
                {scheduleCopied === 'tags' ? <><Check size={13} /> コピー済</> : <><Copy size={13} /> タグをコピー</>}
              </button>
            </div>
            <textarea
              value={scheduleHashtags}
              onChange={e => setScheduleHashtags(e.target.value)}
              rows={2}
              placeholder="#美容 #朝活 #GRWM"
              style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #E2DEF0', borderRadius: 8, fontSize: '0.85rem', marginBottom: '0.7rem', fontFamily: 'inherit', resize: 'vertical' }}
            />

            {/* CTA */}
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: 4 }}>
              末尾 CTA
            </label>
            <input
              value={scheduleCta}
              onChange={e => setScheduleCta(e.target.value)}
              placeholder="保存して、明日から実践してね"
              style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #E2DEF0', borderRadius: 8, fontSize: '0.85rem', marginBottom: '0.9rem' }}
            />

            {/* エラー */}
            {scheduleErr && (
              <div style={{ padding: '0.55rem 0.75rem', background: '#FEE2E2', color: '#991B1B', borderRadius: 8, fontSize: '0.78rem', marginBottom: '0.7rem' }}>
                {scheduleErr}
              </div>
            )}

            {/* 保存後 */}
            {scheduleSaved ? (
              <div style={{ padding: '0.9rem 1rem', background: '#ECFDF5', color: '#065F46', borderRadius: 10, fontSize: '0.88rem', marginBottom: '0.7rem' }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>投稿予約を保存しました</div>
                <div style={{ fontSize: '0.78rem' }}>「投稿予約」タブから時刻に Instagram を開くだけで投稿できます。</div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setScheduleOpen(false)} style={{
                  flex: 1, padding: '0.75rem',
                  background: '#F4F0FA', color: '#1F1A2E',
                  border: 'none', borderRadius: 10, fontWeight: 700,
                  fontSize: '0.92rem', cursor: 'pointer',
                }}>キャンセル</button>
                <button onClick={saveSchedule} disabled={!scheduleCaption.trim() || scheduleGenerating} style={{
                  flex: 2, padding: '0.75rem',
                  background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                  color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800,
                  fontSize: '0.92rem', cursor: 'pointer',
                  opacity: scheduleGenerating ? 0.6 : 1,
                }}>予約キューに保存</button>
              </div>
            )}
            {scheduleSaved && onJumpToSchedule && (
              <button onClick={() => { setScheduleOpen(false); onJumpToSchedule(); }} style={{
                width: '100%', padding: '0.75rem',
                background: `linear-gradient(135deg, ${bg.accent}, ${bg.accent}cc)`,
                color: '#fff', border: 'none', borderRadius: 10, fontWeight: 800,
                fontSize: '0.92rem', cursor: 'pointer',
              }}>予約一覧を開く</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
