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
        corpSier: resolve(__dirname, 'corp-sier.html'),
        crystal: resolve(__dirname, 'crystal.html'),
        continuum: resolve(__dirname, 'continuum.html'),
        keynote: resolve(__dirname, 'keynote.html'),
        studio: resolve(__dirname, 'studio.html'),
        studioFilm: resolve(__dirname, 'studio-film.html'),
      },
      output: {
        // ──────────────────────────────────────────────────────────────
        // 2026-09-03: manualChunks → advancedChunks（rolldown ネイティブ）。
        //   manualChunks（関数）だと rolldown 側で React 本体が chart-vendor、
        //   react/jsx-runtime が markdown-vendor に混ざり、全チャンクがその 2 つ
        //   （gzip 200KB 超）を静的に引きずっていた（/corp の FCP 10 秒の主因）。
        //   priority で React を最優先グループに固定し、重いライブラリは
        //   「使うページだけ」が読む独立チャンクにする。
        // ──────────────────────────────────────────────────────────────
        advancedChunks: {
          groups: [
            // Vite の preload ヘルパー（\0vite/preload-helper）を最優先で独立させる。
            // これが file-vendor に入ると、動的 import を持つ全チャンクが 480KB を静的に引く。
            { name: 'vite-helpers', test: /vite[\\/](preload-helper|modulepreload-polyfill|dynamic-import-helper)/, priority: 200 },
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/, priority: 100 },
            { name: 'motion-vendor', test: /[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/, priority: 90 },
            { name: 'icons-vendor', test: /[\\/]node_modules[\\/]lucide-react[\\/]/, priority: 90 },
            { name: 'file-vendor', test: /[\\/]node_modules[\\/](pdfjs-dist|mammoth|xlsx|jszip|pptxgenjs|underscore|bluebird|xmlbuilder|lop|@xmldom|dingbat-to-unicode)[\\/]/, priority: 80 },
            { name: 'chart-vendor', test: /[\\/]node_modules[\\/](recharts|d3-[a-z-]+|victory-vendor|es-toolkit|internmap|@reduxjs|reselect|immer|redux)[\\/]/, priority: 70 },
            { name: 'markdown-vendor', test: /[\\/]node_modules[\\/](react-markdown|remark[a-z-]*|rehype[a-z-]*|hast[a-z-]*|mdast[a-z-]*|micromark[a-z-]*|unified|unist[a-z-]*|vfile[a-z-]*|property-information|parse5|entities|@ungap|highlight\.js|lowlight|devlop|bail|trough|is-plain-obj|zwitch|longest-streak|ccount|decode-named-character-reference|character-entities[a-z-]*|comma-separated-tokens|space-separated-tokens|trim-lines|html-url-attributes|estree-util-is-identifier-name|style-to-js|style-to-object|inline-style-parser|extend|web-namespaces|html-void-elements|markdown-table|escape-string-regexp)[\\/]/, priority: 60 },
            { name: 'api-vendor', test: /[\\/]node_modules[\\/](@supabase|stripe)[\\/]/, priority: 60 },
          ],
        },
      },
    },
  },
})
