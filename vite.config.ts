import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Multi-page 構成:
// - / → index.html (Prism LP)
// - /iris → iris.html (Iris LP)  ※ Vercel rewrite で /iris → /iris.html
//
// public/ に置いていた iris.html はビルド変換されず <script src="/src/main.tsx">
// が残ってしまうため、ルートに移動してビルド対象に含める必要がある。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // main bundle を 1 MB (gzip 300 KB) 以下に抑えるため、警告閾値を 600 KB に。
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        iris: resolve(__dirname, 'iris.html'),
        corp: resolve(__dirname, 'corp.html'),
        keynote: resolve(__dirname, 'keynote.html'),
      },
      output: {
        // ──────────────────────────────────────────────────────────────
        // manualChunks: ベンダー (node_modules) を機能別に分割し、
        //   - 初回表示で必要なものだけ main に残す
        //   - 重いライブラリは別チャンク (キャッシュ効率↑)
        // ──────────────────────────────────────────────────────────────
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // React 本体 (どこでも使うので独立チャンク)
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          // framer-motion (アニメ全般で使うが、main から切り出すと初回が軽くなる)
          if (id.includes('framer-motion')) return 'motion-vendor';
          // lucide-react (アイコン)
          if (id.includes('lucide-react')) return 'icons-vendor';
          // recharts + d3 系 (PnL / Benchmark / Health などで使用)
          if (id.includes('recharts') || /[\\/]d3-/.test(id) || id.includes('victory-vendor')) {
            return 'chart-vendor';
          }
          // file 処理系 (pdfjs, mammoth, xlsx, jszip) — fileParser から動的 import
          if (
            id.includes('pdfjs-dist') ||
            id.includes('mammoth') ||
            id.includes('xlsx') ||
            id.includes('jszip')
          ) {
            return 'file-vendor';
          }
          // pptxgenjs (スライド生成) も file 処理寄りの重さ
          if (id.includes('pptxgenjs')) return 'file-vendor';
          // markdown レンダラー (Studio 系で必要なときに使う)
          if (
            id.includes('react-markdown') ||
            id.includes('remark') ||
            id.includes('rehype') ||
            id.includes('hast') ||
            id.includes('mdast') ||
            id.includes('micromark') ||
            id.includes('unified') ||
            id.includes('unist')
          ) {
            return 'markdown-vendor';
          }
          // supabase / stripe (バックエンド連携)
          if (id.includes('@supabase') || id.includes('stripe')) return 'api-vendor';
          return undefined;
        },
      },
    },
  },
})
