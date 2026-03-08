const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_X * 2;

type PdfFont = 'F1' | 'F2' | 'F3';

type RenderState = {
  pages: string[];
  current: string[];
  cursorY: number;
};

/**
 * Mapa de caracteres Unicode > 255 para seus equivalentes WinAnsi (Windows-1252).
 * Cobre os mais comuns como aspas tipográficas, travessão, etc.
 */
const WIN_ANSI_MAP: Record<string, number> = {
  '€': 128,
  '‚': 130,
  'ƒ': 131,
  '„': 132,
  '…': 133,
  '†': 134,
  '‡': 135,
  'ˆ': 136,
  '‰': 137,
  'Š': 138,
  '‹': 139,
  'Œ': 140,
  'Ž': 142,
  '\u2018': 145, // '
  '\u2019': 146, // '
  '\u201C': 147, // "
  '\u201D': 148, // "
  '•': 149,
  '\u2013': 150, // en dash –
  '\u2014': 151, // em dash —
  '˜': 152,
  '™': 153,
  'š': 154,
  '›': 155,
  'œ': 156,
  'ž': 158,
  'Ÿ': 159,
  '\u2026': 133, // ellipsis …
  '\u00A0': 160, // non-breaking space
  '\u00B0': 176, // °
  '\u00B2': 178, // ²
  '\u00B3': 179, // ³
  '\u00B5': 181, // µ
  '\u00B7': 183, // ·
  '\u00BC': 188, // ¼
  '\u00BD': 189, // ½
  '\u00BE': 190, // ¾
  '\u00D7': 215, // ×
  '\u00F7': 247, // ÷
};

/**
 * Converte um caractere para seu byte WinAnsi.
 * Retorna -1 se o caractere não for representável.
 */
function charToWinAnsiByte(char: string): number {
  const code = char.charCodeAt(0);
  // Caracteres 0-255 mapeiam diretamente para WinAnsi
  if (code <= 255) return code;
  // Caracteres especiais acima de 255 com mapeamento manual
  const mapped = WIN_ANSI_MAP[char];
  if (typeof mapped === 'number') return mapped;
  return 63; // '?' como fallback
}

/**
 * Escapa texto para uso dentro de strings PDF literais (entre parênteses).
 * Caracteres não-ASCII são convertidos para octal escape (\nnn) conforme
 * a especificação PDF — isso garante encoding correto independente de
 * qualquer transformação posterior da string.
 *
 * ANTES (bug): caracteres como ã, ç, — eram inseridos crus na string PDF
 * e depois passados por encodeWinAnsi no nível do arquivo inteiro, causando
 * desalinhamento de offsets e bytes incorretos.
 *
 * AGORA (fix): o conteúdo dos streams é puro ASCII com octais explícitos.
 */
function escapePdfText(input: string): string {
  let result = '';
  for (const char of input) {
    // Escapes obrigatórios pelo PDF spec dentro de ()
    if (char === '\\') { result += '\\\\'; continue; }
    if (char === '(')  { result += '\\(';  continue; }
    if (char === ')')  { result += '\\)';  continue; }
    if (char === '\r') { result += '\\r';  continue; }
    if (char === '\n') { result += '\\n';  continue; }

    const code = char.charCodeAt(0);

    // ASCII imprimível — inserir diretamente
    if (code >= 32 && code <= 126) {
      result += char;
      continue;
    }

    // Não-ASCII: converter para byte WinAnsi e representar como octal \nnn
    const byteVal = charToWinAnsiByte(char);
    result += '\\' + byteVal.toString(8).padStart(3, '0');
  }
  return result;
}

/**
 * Remove marcadores de formatação inline do Markdown que não devem aparecer
 * como texto literal no PDF: **negrito**, *itálico*, `código`, ~~tachado~~.
 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')  // bold+italic ***
    .replace(/___(.+?)___/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')       // **bold**
    .replace(/__(.+?)__/g, '$1')            // __bold__
    .replace(/\*(.+?)\*/g, '$1')            // *italic*
    .replace(/_(.+?)_/g, '$1')              // _italic_
    .replace(/~~(.+?)~~/g, '$1')            // ~~strikethrough~~
    .replace(/`([^`]+)`/g, '$1');           // `inline code`
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.52;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let line = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${line} ${words[i]}`;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = words[i];
    }
  }

  lines.push(line);
  return lines;
}

function pushPage(state: RenderState) {
  if (state.current.length > 0) state.pages.push(state.current.join('\n'));
  state.current = [];
  state.cursorY = MARGIN_TOP;
}

function ensureHeight(state: RenderState, neededHeight: number) {
  const remaining = A4_HEIGHT - MARGIN_BOTTOM - state.cursorY;
  if (neededHeight > remaining) pushPage(state);
}

/**
 * Emite um comando de texto PDF.
 * O texto é escapado via escapePdfText — o stream resultante é puro ASCII.
 */
function drawText(
  state: RenderState,
  text: string,
  x: number,
  yTop: number,
  font: PdfFont,
  fontSize: number,
) {
  const yPdf = A4_HEIGHT - yTop - fontSize;
  const escaped = escapePdfText(text);
  state.current.push(
    `BT /${font} ${fontSize} Tf 1 0 0 1 ${x.toFixed(2)} ${yPdf.toFixed(2)} Tm (${escaped}) Tj ET`,
  );
}

function drawRect(
  state: RenderState,
  x: number,
  yTop: number,
  width: number,
  height: number,
  stroke = true,
  fillGray?: number,
) {
  const yPdf = A4_HEIGHT - yTop - height;
  if (typeof fillGray === 'number') {
    state.current.push(
      `${fillGray.toFixed(2)} g ${x.toFixed(2)} ${yPdf.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f 0 g`,
    );
  }
  if (stroke) {
    state.current.push(
      `${x.toFixed(2)} ${yPdf.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`,
    );
  }
}

function renderParagraph(
  state: RenderState,
  text: string,
  options?: { font?: PdfFont; fontSize?: number; indent?: number },
) {
  const font = options?.font || 'F1';
  const fontSize = options?.fontSize || 11;
  const indent = options?.indent || 0;
  const lineHeight = fontSize + 4;
  const maxWidth = CONTENT_WIDTH - indent;
  const lines = wrapText(text, fontSize, maxWidth);

  ensureHeight(state, lines.length * lineHeight + 4);

  for (const line of lines) {
    drawText(state, line, MARGIN_X + indent, state.cursorY, font, fontSize);
    state.cursorY += lineHeight;
  }
  state.cursorY += 4;
}

function normalizeRows(lines: string[]): string[][] {
  return lines.map((line) =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim()),
  );
}

function renderTable(state: RenderState, rows: string[][]) {
  if (!rows.length) return;

  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidth = CONTENT_WIDTH / colCount;
  const header = rows[0];
  const body = rows.slice(1);
  const fontSize = 10;
  const rowHeight = 24;

  const totalHeight = rowHeight * (1 + body.length);
  ensureHeight(state, totalHeight + 10);

  const tableX = MARGIN_X;
  let y = state.cursorY;

  drawRect(state, tableX, y, CONTENT_WIDTH, rowHeight, true, 0.9);
  for (let c = 0; c < colCount; c++) {
    const cellText = stripInlineMarkdown(header[c] || '');
    const clipped = wrapText(cellText, fontSize, colWidth - 12)[0] || '';
    drawText(state, clipped, tableX + c * colWidth + 6, y + 6, 'F2', fontSize);
    if (c > 0) {
      const lineX = tableX + c * colWidth;
      const yPdf = A4_HEIGHT - y - rowHeight;
      state.current.push(
        `${lineX.toFixed(2)} ${yPdf.toFixed(2)} m ${lineX.toFixed(2)} ${(yPdf + rowHeight).toFixed(2)} l S`,
      );
    }
  }
  y += rowHeight;

  body.forEach((row, rowIndex) => {
    drawRect(state, tableX, y, CONTENT_WIDTH, rowHeight, true, rowIndex % 2 === 0 ? 0.97 : undefined);
    for (let c = 0; c < colCount; c++) {
      const cellText = stripInlineMarkdown(row[c] || '');
      const clipped = wrapText(cellText, fontSize, colWidth - 12)[0] || '';
      drawText(state, clipped, tableX + c * colWidth + 6, y + 6, 'F1', fontSize);
      if (c > 0) {
        const lineX = tableX + c * colWidth;
        const yPdf = A4_HEIGHT - y - rowHeight;
        state.current.push(
          `${lineX.toFixed(2)} ${yPdf.toFixed(2)} m ${lineX.toFixed(2)} ${(yPdf + rowHeight).toFixed(2)} l S`,
        );
      }
    }
    y += rowHeight;
  });

  state.cursorY = y + 8;
}

function parseMarkdown(markdown: string): Array<{ type: string; text?: string; rows?: string[][] }> {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const blocks: Array<{ type: string; text?: string; rows?: string[][] }> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (!line.trim()) { i++; continue; }

    // Bloco de código
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'code', text: codeLines.join(' ') });
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: `h${heading[1].length}`, text: stripInlineMarkdown(heading[2].trim()) });
      i++;
      continue;
    }

    // Tabela
    const isTable =
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?\s*[:\-\s|]+\|?\s*$/.test(lines[i + 1]);
    if (isTable) {
      const tableLines = [line];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'table', rows: normalizeRows(tableLines) });
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      blocks.push({
        type: 'bullet',
        text: stripInlineMarkdown(line.replace(/^[-*]\s+/, '').trim()),
      });
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      blocks.push({
        type: 'number',
        text: stripInlineMarkdown(line.replace(/^\d+\.\s+/, '').trim()),
      });
      i++;
      continue;
    }

    // Parágrafo (agrupa linhas consecutivas)
    const paragraphLines = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      if (
        lines[i].includes('|') &&
        i + 1 < lines.length &&
        /^\s*\|?\s*[:\-\s|]+\|?\s*$/.test(lines[i + 1])
      )
        break;
      paragraphLines.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', text: stripInlineMarkdown(paragraphLines.join(' ')) });
  }

  return blocks;
}

/**
 * Constrói o binário PDF a partir dos page streams.
 *
 * Como os streams são puro ASCII (após escapePdfText com octais),
 * usamos TextEncoder para converter a string final — o que é idêntico
 * a um encoding ASCII simples e evita qualquer ambiguidade de encoding.
 */
function buildPdf(pages: string[]): Uint8Array {
  const objects: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageCount = pages.length;
  const firstPageObj = 6;
  const kids = Array.from({ length: pageCount }, (_, idx) => `${firstPageObj + idx * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  // Fontes com WinAnsiEncoding — bytes no range 0-255 mapeiam para glifos corretos
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');

  pages.forEach((stream, idx) => {
    const pageObjNumber = firstPageObj + idx * 2;
    const contentObjNumber = pageObjNumber + 1;

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH.toFixed(2)} ${A4_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjNumber} 0 R >>`,
    );

    // stream é puro ASCII agora; length em bytes == length em chars
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  // Montar o PDF como string ASCII pura
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // Usar TextEncoder (UTF-8) — para string ASCII pura o resultado é idêntico
  // a Latin-1 e evita qualquer problema de encoding de arquivo
  return new TextEncoder().encode(pdf);
}

export function generateStyledPdfFromMarkdown(markdown: string, title: string): Blob {
  const state: RenderState = { pages: [], current: [], cursorY: MARGIN_TOP };

  // Título principal
  renderParagraph(state, stripInlineMarkdown(title), { font: 'F2', fontSize: 20 });
  state.current.push('0.75 w');
  drawRect(state, MARGIN_X, state.cursorY, CONTENT_WIDTH, 1, false, 0.85);
  state.cursorY += 14;

  const blocks = parseMarkdown(markdown);
  for (const block of blocks) {
    switch (block.type) {
      case 'h1':
        renderParagraph(state, block.text || '', { font: 'F2', fontSize: 16 });
        break;
      case 'h2':
        renderParagraph(state, block.text || '', { font: 'F2', fontSize: 14 });
        break;
      case 'h3':
        renderParagraph(state, block.text || '', { font: 'F2', fontSize: 12 });
        break;
      case 'bullet':
        renderParagraph(state, `\u2022 ${block.text || ''}`, { font: 'F1', fontSize: 11, indent: 8 });
        break;
      case 'number':
        renderParagraph(state, `- ${block.text || ''}`, { font: 'F1', fontSize: 11, indent: 8 });
        break;
      case 'code':
        renderParagraph(state, block.text || '', { font: 'F3', fontSize: 10, indent: 8 });
        break;
      case 'table':
        renderTable(state, block.rows || []);
        break;
      default:
        renderParagraph(state, block.text || '', { font: 'F1', fontSize: 11 });
    }
  }

  if (state.current.length > 0) state.pages.push(state.current.join('\n'));

  const bytes = buildPdf(state.pages.length ? state.pages : ['']);
  return new Blob([bytes], { type: 'application/pdf' });
}
