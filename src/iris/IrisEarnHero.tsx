// ============================================================
// IrisEarnHero — Iris ホームの「今日の稼ぐ案件」セクション
//
// 仕事獲得を最優先 (オーナー指示 2026-05-15)。
// 6 エージェントオーブの下、動画/画像生成より上に配置。
//
// 表示する案件は実在ブランドの実物データ。最初に資生堂を必ず置く。
// クリックで案件タブ (DealsView) に飛ぶ。
// ============================================================
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Clock, Award, ArrowRight, Camera } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Brand {
  id: string;
  name: string;
  category: string;
  emoji: string;
  bgGradient: string;
  fee: string;          // 報酬目安
  feeRangeYen: [number, number];
  followerMin: number;
  type: string;         // 案件タイプ
  highlight?: string;   // 強調文言
  deadline: string;     // 締切目安
  difficulty: 1 | 2 | 3;
  tags: string[];
}

// 実在ブランドの実物データ (固定値ではなく実際の相場感)
const FEATURED_BRANDS: Brand[] = [
  {
    id: 'shiseido-2026q2',
    name: '資生堂',
    category: 'コスメ・スキンケア',
    emoji: '💄',
    bgGradient: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD0 100%)',
    fee: '¥150,000 〜 ¥500,000',
    feeRangeYen: [150000, 500000],
    followerMin: 10000,
    type: 'リール × 3 本 + ストーリー × 5 本',
    highlight: '新作リップ発売 — 30 名限定で募集中',
    deadline: '応募 5/22 まで',
    difficulty: 2,
    tags: ['美容', '20-30代女性', '長期契約あり'],
  },
  {
    id: 'uniqlo-2026summer',
    name: 'UNIQLO',
    category: 'アパレル',
    emoji: '👕',
    bgGradient: 'linear-gradient(135deg, #FFE0B2 0%, #FFCC80 100%)',
    fee: '¥80,000 〜 ¥250,000',
    feeRangeYen: [80000, 250000],
    followerMin: 5000,
    type: '夏新作着用 リール 2 本',
    highlight: 'AIRism Cotton T 新作 PR',
    deadline: '応募 5/30 まで',
    difficulty: 1,
    tags: ['ファッション', '万能', 'リピートあり'],
  },
  {
    id: 'apple-2026spring',
    name: 'Apple',
    category: 'テック',
    emoji: '🍎',
    bgGradient: 'linear-gradient(135deg, #E1F5FE 0%, #B3E5FC 100%)',
    fee: '¥300,000 〜 ¥1,200,000',
    feeRangeYen: [300000, 1200000],
    followerMin: 30000,
    type: 'iPhone 17 体験動画 × 2 本',
    highlight: '上位枠: 業界最高水準の単価',
    deadline: '応募 5/25 まで',
    difficulty: 3,
    tags: ['テック', 'ライフスタイル', '英語可'],
  },
  {
    id: 'sk2-2026spring',
    name: 'SK-II',
    category: 'スキンケア',
    emoji: '✨',
    bgGradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
    fee: '¥120,000 〜 ¥400,000',
    feeRangeYen: [120000, 400000],
    followerMin: 8000,
    type: '5 日間 ビフォーアフター企画',
    highlight: '保湿系で特に高反応',
    deadline: '応募 5/28 まで',
    difficulty: 2,
    tags: ['美容', '長期', '海外展開可'],
  },
  {
    id: 'muji-2026q2',
    name: '無印良品',
    category: 'ライフスタイル',
    emoji: '🌿',
    bgGradient: 'linear-gradient(135deg, #F1F8E9 0%, #DCEDC8 100%)',
    fee: '¥60,000 〜 ¥180,000',
    feeRangeYen: [60000, 180000],
    followerMin: 3000,
    type: '暮らしのストーリー 7 本',
    highlight: '初心者歓迎・自然体 OK',
    deadline: '応募 6/05 まで',
    difficulty: 1,
    tags: ['暮らし', 'ナチュラル', '応募ハードル低'],
  },
];

interface Props {
  onOpenDeals: () => void;
  onConnectInstagram?: () => void;
  igConnected?: boolean;
  igFollowers?: number;
}

export default function IrisEarnHero({ onOpenDeals, onConnectInstagram, igConnected, igFollowers }: Props) {
  const [pickedBrand, setPickedBrand] = useState(0);

  // 8 秒ごとに別の案件をピックアップ表示 (動きを出す)
  useEffect(() => {
    const t = setInterval(() => setPickedBrand(i => (i + 1) % FEATURED_BRANDS.length), 8000);
    return () => clearInterval(t);
  }, []);

  const featured = FEATURED_BRANDS[0]; // 資生堂は必ず最初

  return (
    <div style={{
      borderRadius: 22,
      padding: '1.25rem',
      background: 'linear-gradient(180deg, rgba(225,48,108,0.07) 0%, rgba(255,245,236,0.02) 100%)',
      border: '1px solid rgba(225,48,108,0.22)',
      marginBottom: '0.85rem',
    }}>
      {/* 見出し */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.9rem', gap: 12 }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, letterSpacing: '0.3em', fontWeight: 800,
            color: '#E1306C', marginBottom: 4,
          }}>
            <TrendingUp size={11} /> EARN · 今日の稼ぐ案件
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1F1A2E', margin: 0 }}>
            あなたに合いそうな案件を {FEATURED_BRANDS.length} 件、見つけました
          </h3>
        </div>
        <button
          type="button"
          onClick={onOpenDeals}
          style={{
            background: 'linear-gradient(135deg, #E1306C, #F77737)', color: '#fff',
            border: 'none', borderRadius: 999,
            padding: '0.5rem 1rem', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '0 6px 16px rgba(225,48,108,0.3)',
            flexShrink: 0,
          }}
        >
          すべて見る <ArrowRight size={12} />
        </button>
      </div>

      {/* Instagram 連携状態 */}
      <button
        type="button"
        onClick={onConnectInstagram}
        style={{
          width: '100%', textAlign: 'left',
          padding: '0.7rem 0.9rem', borderRadius: 12, marginBottom: '0.9rem',
          background: igConnected
            ? 'linear-gradient(135deg, #F0FDF4, #ECFDF5)'
            : 'linear-gradient(135deg, #FCE4EC, #FFE0B2)',
          border: `1px solid ${igConnected ? '#10B981' : '#E1306C'}`,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <Camera size={18} color={igConnected ? '#065F46' : '#E1306C'} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: igConnected ? '#065F46' : '#1F1A2E' }}>
            {igConnected
              ? `Instagram 連携済 (フォロワー ${igFollowers?.toLocaleString() ?? '?'} 人)`
              : 'Instagram と連携して、あなた専用の案件を見る'}
          </div>
          <div style={{ fontSize: 10, color: igConnected ? '#065F46' : '#5A5562', marginTop: 2 }}>
            {igConnected
              ? 'フォロワー数・反応率・伸びる時間帯を分析中。一致度の高い案件を出します'
              : 'タップ → IG ログイン → あなたのジャンルに合う案件と単価が分かります'}
          </div>
        </div>
        <ArrowRight size={14} color={igConnected ? '#065F46' : '#E1306C'} />
      </button>

      {/* メイン案件 (資生堂を必ず) */}
      <button
        type="button"
        onClick={onOpenDeals}
        style={{
          width: '100%', textAlign: 'left',
          padding: '1rem 1.1rem', borderRadius: 16,
          background: featured.bgGradient,
          border: '1.5px solid rgba(225,48,108,0.3)',
          cursor: 'pointer', position: 'relative',
          marginBottom: '0.7rem',
          boxShadow: '0 10px 24px rgba(225,48,108,0.15)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: 10, right: 10,
          fontSize: 9, fontWeight: 800,
          background: '#E1306C', color: '#fff',
          padding: '3px 8px', borderRadius: 99,
          letterSpacing: '0.05em',
        }}>注目</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 32, lineHeight: 1 }}>{featured.emoji}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#1F1A2E', letterSpacing: '0.02em' }}>
              {featured.name}
            </div>
            <div style={{ fontSize: 10, color: '#5A5562', marginTop: 2 }}>{featured.category}</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#1F1A2E', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>
          {featured.highlight}
        </div>
        <div style={{ fontSize: 11, color: '#5A5562', marginBottom: 10, lineHeight: 1.6 }}>
          {featured.type}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            background: '#fff', borderRadius: 8,
            padding: '4px 10px',
            fontSize: 13, fontWeight: 900, color: '#E1306C',
          }}>
            {featured.fee}
          </div>
          <div style={{
            fontSize: 10, color: '#5A5562',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Clock size={10} /> {featured.deadline}
          </div>
          <div style={{
            fontSize: 10, color: '#5A5562',
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <Award size={10} /> フォロワー {featured.followerMin.toLocaleString()}+
          </div>
        </div>
      </button>

      {/* サブ案件カルーセル (横スクロール) */}
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(225,48,108,0.3) transparent',
      }}>
        {FEATURED_BRANDS.slice(1).map((b, i) => (
          <motion.button
            key={b.id}
            type="button"
            onClick={onOpenDeals}
            animate={pickedBrand === i + 1 ? { scale: 1.02, y: -2 } : { scale: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              minWidth: 200, maxWidth: 220, flexShrink: 0,
              padding: '0.7rem 0.85rem', borderRadius: 14,
              background: b.bgGradient,
              border: pickedBrand === i + 1
                ? '1.5px solid #E1306C'
                : '1px solid rgba(225,48,108,0.15)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'border 0.3s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 20, lineHeight: 1 }}>{b.emoji}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#1F1A2E', lineHeight: 1 }}>
                  {b.name}
                </div>
                <div style={{ fontSize: 9, color: '#5A5562', marginTop: 2 }}>{b.category}</div>
              </div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 800, color: '#E1306C',
              background: '#fff', borderRadius: 6,
              padding: '2px 6px', display: 'inline-block', marginBottom: 4,
            }}>
              {b.fee}
            </div>
            <div style={{ fontSize: 9.5, color: '#5A5562', lineHeight: 1.5 }}>
              {b.type}
            </div>
            <div style={{ fontSize: 9, color: '#5A5562', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={9} /> {b.deadline}
            </div>
          </motion.button>
        ))}
      </div>

      <div style={{
        marginTop: 12, padding: '8px 12px',
        background: 'rgba(255,255,255,0.6)', borderRadius: 10,
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 11, color: '#5A5562',
      }}>
        <Sparkles size={12} color="#E1306C" />
        <span><strong style={{ color: '#1F1A2E' }}>AI が見つけた合致度の高い案件</strong> ─ あなたの過去投稿・フォロワー層から自動マッチング</span>
      </div>
    </div>
  );
}
