// ============================================================
// あらゆる形式のファイルからテキストを抽出
// ============================================================
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type ParsedKind =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'csv'
  | 'text'
  | 'image'
  | 'unknown';

export interface ParseResult {
  text: string;
  kind: ParsedKind;
  pages?: number;
  imageBase64?: string;
  warning?: string;
}

const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'json', 'html', 'htm', 'xml', 'yaml', 'yml',
  'log', 'rtf', 'tsv', 'js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java',
  'kt', 'swift', 'c', 'cpp', 'h', 'css', 'scss', 'sql', 'sh', 'bat', 'env',
]);

function ext(name: string): string {
  const m = name.toLowerCase().match(/\.([^.]+)$/);
  return m ? m[1] : '';
}

async function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

async function readText(file: File, encoding = 'UTF-8'): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) ?? '');
    reader.onerror = reject;
    reader.readAsText(file, encoding);
  });
}

async function readDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── PDF ───────────────────────────────────────────────────
async function parsePdf(file: File): Promise<ParseResult> {
  const buf = await readArrayBuffer(file);
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => ('str' in it ? it.str : ''))
      .join(' ');
    parts.push(`--- Page ${i} ---\n${pageText}`);
  }
  return { text: parts.join('\n\n'), kind: 'pdf', pages: pdf.numPages };
}

// ── DOCX ──────────────────────────────────────────────────
async function parseDocx(file: File): Promise<ParseResult> {
  const buf = await readArrayBuffer(file);
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return { text: value, kind: 'docx' };
}

// ── XLSX/XLS/CSV ──────────────────────────────────────────
async function parseSpreadsheet(file: File, kind: 'xlsx' | 'csv'): Promise<ParseResult> {
  const buf = await readArrayBuffer(file);
  const wb = XLSX.read(buf, { type: 'array' });
  const sheets: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    sheets.push(`### Sheet: ${name}\n${csv}`);
  }
  return { text: sheets.join('\n\n'), kind };
}

// ── PPTX (Open XML — ZIPの中の ppt/slides/slideN.xml をパース) ─
async function parsePptx(file: File): Promise<ParseResult> {
  const buf = await readArrayBuffer(file);
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const ai = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] ?? '0', 10);
      const bi = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] ?? '0', 10);
      return ai - bi;
    });

  const noteFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort();

  const slideTexts: string[] = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('string');
    const text = extractTextFromOoxml(xml);
    slideTexts.push(`--- Slide ${i + 1} ---\n${text}`);
  }

  if (noteFiles.length > 0) {
    const notes: string[] = [];
    for (let i = 0; i < noteFiles.length; i++) {
      const xml = await zip.files[noteFiles[i]].async('string');
      const text = extractTextFromOoxml(xml);
      if (text.trim()) notes.push(`--- Note ${i + 1} ---\n${text}`);
    }
    if (notes.length > 0) {
      slideTexts.push('\n=== ノート ===\n' + notes.join('\n\n'));
    }
  }

  return { text: slideTexts.join('\n\n'), kind: 'pptx', pages: slideFiles.length };
}

// OOXML(<a:t>...</a:t>) からテキスト抽出
function extractTextFromOoxml(xml: string): string {
  const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
  return matches
    .map(m => m.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, ''))
    .map(s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    .filter(s => s.trim().length > 0)
    .join('\n');
}

// ── 画像 ─────────────────────────────────────────────────
async function parseImage(file: File): Promise<ParseResult> {
  const dataUrl = await readDataUrl(file);
  return {
    text: `[画像ファイル: ${file.name}]\nこの画像はAIが内容を解釈します。`,
    kind: 'image',
    imageBase64: dataUrl,
  };
}

// ── メインエントリ ────────────────────────────────────────
export async function parseFile(file: File): Promise<ParseResult> {
  const e = ext(file.name);
  const mime = file.type || '';

  try {
    if (e === 'pdf' || mime === 'application/pdf') {
      return await parsePdf(file);
    }
    if (e === 'docx' || mime.includes('wordprocessingml')) {
      return await parseDocx(file);
    }
    if (e === 'xlsx' || e === 'xls' || mime.includes('spreadsheetml')) {
      return await parseSpreadsheet(file, 'xlsx');
    }
    if (e === 'csv' || mime === 'text/csv') {
      return await parseSpreadsheet(file, 'csv');
    }
    if (e === 'pptx' || mime.includes('presentationml')) {
      return await parsePptx(file);
    }
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(e)) {
      return await parseImage(file);
    }
    if (TEXT_EXT.has(e) || mime.startsWith('text/')) {
      const text = await readText(file);
      return { text, kind: 'text' };
    }

    // Unknown — try as text with warning
    const text = await readText(file);
    const looksBinary = /[\x00-\x08\x0E-\x1F]/.test(text.slice(0, 200));
    if (looksBinary) {
      return {
        text: `[未対応の形式: ${file.name}]\nこの形式は現在テキスト抽出に対応していません。PDF/DOCX/XLSX/PPTX/CSV/画像/テキスト系をご利用ください。`,
        kind: 'unknown',
        warning: '未対応の形式',
      };
    }
    return { text, kind: 'text' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      text: `[読み込みエラー: ${file.name}]\n${msg}`,
      kind: 'unknown',
      warning: msg,
    };
  }
}
