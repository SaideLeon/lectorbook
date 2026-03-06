import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { AppError, jsonError } from '@/app/api/_utils';
import { Article } from '@/types';

export const runtime = 'nodejs';

const TTL_MS = 12 * 60 * 60 * 1000;
const urlCache = new Map<string, { createdAt: number; article: Article }>();

function extractTextFromHtml(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|footer|header|aside)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutScripts;
}

function computeMetadata(content: string) {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return { wordCount, readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 200)) };
}

export async function POST(req: NextRequest) {
  try {
    const { url, text, pdfBase64, title } = await req.json();

    if (!url && !text && !pdfBase64) {
      throw new AppError('Informe url, text ou pdfBase64.', 400);
    }

    if (url) {
      const cached = urlCache.get(url);
      if (cached && Date.now() - cached.createdAt < TTL_MS) {
        return NextResponse.json({ article: cached.article });
      }

      const response = await fetch(url);
      if (!response.ok) throw new AppError('Falha ao buscar URL do artigo.', 400);
      const html = await response.text();
      const extracted = extractTextFromHtml(html);
      const pageTitle = (html.match(/<title>(.*?)<\/title>/i)?.[1] || 'Artigo via URL').trim();
      const article: Article = {
        id: crypto.createHash('sha1').update(url).digest('hex'),
        title: pageTitle,
        url,
        source: new URL(url).hostname,
        abstract: extracted.slice(0, 280),
        content: extracted,
        addedAt: Date.now(),
        ...computeMetadata(extracted)
      };
      urlCache.set(url, { createdAt: Date.now(), article });
      return NextResponse.json({ article });
    }

    if (text) {
      const content = String(text).trim();
      const article: Article = {
        id: crypto.createHash('sha1').update(content.slice(0, 200)).digest('hex'),
        title: title || 'Texto colado',
        source: 'Entrada manual',
        abstract: content.slice(0, 280),
        content,
        addedAt: Date.now(),
        ...computeMetadata(content)
      };
      return NextResponse.json({ article });
    }

    const raw = Buffer.from(String(pdfBase64), 'base64').toString('latin1');
    const extractedText = raw.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
    const content = extractedText.length > 100 ? extractedText : 'Não foi possível extrair texto rico deste PDF neste ambiente.';
    const article: Article = {
      id: crypto.createHash('sha1').update(content.slice(0, 200)).digest('hex'),
      title: title || 'PDF carregado',
      source: 'PDF Upload',
      abstract: content.slice(0, 280),
      content,
      addedAt: Date.now(),
      ...computeMetadata(content)
    };
    return NextResponse.json({ article });
  } catch (error) {
    return jsonError(error);
  }
}
