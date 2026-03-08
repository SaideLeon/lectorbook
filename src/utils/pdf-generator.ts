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

function escapePdfText(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.52;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let line = words[0];

  for (let i = 1; i < words.length; i += 1) {
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

function drawText(state: RenderState, text: string, x: number, yTop: number, font: PdfFont, fontSize: number) {
  const yPdf = A4_HEIGHT - yTop - fontSize;
  state.current.push(`BT /${font} ${fontSize} Tf 1 0 0 1 ${x.toFixed(2)} ${yPdf.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
}

function drawRect(state: RenderState, x: number, yTop: number, width: number, height: number, stroke = true, fillGray?: number) {
  const yPdf = A4_HEIGHT - yTop - height;
  if (typeof fillGray === 'number') {
    state.current.push(`${fillGray.toFixed(2)} g ${x.toFixed(2)} ${yPdf.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f 0 g`);
  }
  if (stroke) state.current.push(`${x.toFixed(2)} ${yPdf.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
}

function renderParagraph(state: RenderState, text: string, options?: { font?: PdfFont; fontSize?: number; indent?: number }) {
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
  return lines.map((line) => line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim()));
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
  for (let c = 0; c < colCount; c += 1) {
    const cellText = header[c] || '';
    const clipped = wrapText(cellText, fontSize, colWidth - 12)[0] || '';
    drawText(state, clipped, tableX + c * colWidth + 6, y + 6, 'F2', fontSize);
    if (c > 0) {
      const lineX = tableX + c * colWidth;
      const yPdf = A4_HEIGHT - y - rowHeight;
      state.current.push(`${lineX.toFixed(2)} ${yPdf.toFixed(2)} m ${lineX.toFixed(2)} ${(yPdf + rowHeight).toFixed(2)} l S`);
    }
  }
  y += rowHeight;

  body.forEach((row, rowIndex) => {
    drawRect(state, tableX, y, CONTENT_WIDTH, rowHeight, true, rowIndex % 2 === 0 ? 0.97 : undefined);
    for (let c = 0; c < colCount; c += 1) {
      const cellText = row[c] || '';
      const clipped = wrapText(cellText, fontSize, colWidth - 12)[0] || '';
      drawText(state, clipped, tableX + c * colWidth + 6, y + 6, 'F1', fontSize);
      if (c > 0) {
        const lineX = tableX + c * colWidth;
        const yPdf = A4_HEIGHT - y - rowHeight;
        state.current.push(`${lineX.toFixed(2)} ${yPdf.toFixed(2)} m ${lineX.toFixed(2)} ${(yPdf + rowHeight).toFixed(2)} l S`);
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

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', text: codeLines.join(' ') });
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: `h${heading[1].length}`, text: heading[2].trim() });
      i += 1;
      continue;
    }

    const isTable = line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*[:\-\s|]+\|?\s*$/.test(lines[i + 1]);
    if (isTable) {
      const tableLines = [line];
      i += 2;
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'table', rows: normalizeRows(tableLines) });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      blocks.push({ type: 'bullet', text: line.replace(/^[-*]\s+/, '').trim() });
      i += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      blocks.push({ type: 'number', text: line.replace(/^\d+\.\s+/, '').trim() });
      i += 1;
      continue;
    }

    const paragraphLines = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s+/.test(lines[i]) && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      if (lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?\s*[:\-\s|]+\|?\s*$/.test(lines[i + 1])) break;
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'p', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function buildPdf(pages: string[]): Uint8Array {
  const objects: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageCount = pages.length;
  const firstPageObj = 6;
  const kids = Array.from({ length: pageCount }, (_, idx) => `${firstPageObj + idx * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);

  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

  pages.forEach((stream, idx) => {
    const pageObjNumber = firstPageObj + idx * 2;
    const contentObjNumber = pageObjNumber + 1;

    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH.toFixed(2)} ${A4_HEIGHT.toFixed(2)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjNumber} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

export function generateStyledPdfFromMarkdown(markdown: string, title: string): Blob {
  const state: RenderState = { pages: [], current: [], cursorY: MARGIN_TOP };

  renderParagraph(state, title, { font: 'F2', fontSize: 20 });
  state.current.push('0.75 w');
  drawRect(state, MARGIN_X, state.cursorY, CONTENT_WIDTH, 1, false, 0.85);
  state.cursorY += 14;

  const blocks = parseMarkdown(markdown);
  for (const block of blocks) {
    if (block.type === 'h1') {
      renderParagraph(state, block.text || '', { font: 'F2', fontSize: 16 });
      continue;
    }
    if (block.type === 'h2') {
      renderParagraph(state, block.text || '', { font: 'F2', fontSize: 14 });
      continue;
    }
    if (block.type === 'h3') {
      renderParagraph(state, block.text || '', { font: 'F2', fontSize: 12 });
      continue;
    }
    if (block.type === 'bullet') {
      renderParagraph(state, `• ${block.text || ''}`, { font: 'F1', fontSize: 11, indent: 8 });
      continue;
    }
    if (block.type === 'number') {
      renderParagraph(state, `- ${block.text || ''}`, { font: 'F1', fontSize: 11, indent: 8 });
      continue;
    }
    if (block.type === 'code') {
      renderParagraph(state, block.text || '', { font: 'F3', fontSize: 10, indent: 8 });
      continue;
    }
    if (block.type === 'table') {
      renderTable(state, block.rows || []);
      continue;
    }
    renderParagraph(state, block.text || '', { font: 'F1', fontSize: 11 });
  }

  if (state.current.length > 0) state.pages.push(state.current.join('\n'));
  const bytes = buildPdf(state.pages.length ? state.pages : ['']);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Blob([arrayBuffer], { type: 'application/pdf' });
}
