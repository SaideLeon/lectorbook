import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { contextFiles, context, apiKey } = await req.json();
    const ai = getAIClient(apiKey);
    const fileContext = (contextFiles || []).map((f: any) => `--- ${f.path} ---\n${f.content}\n`).join('\n');

    const prompt = `
      Você é o Docente principal chamado "Lector".
      Não atue como analista; atue como professor explicador e orientador.
      Habilidades: contabilidade, inglês, direito e economia.

      Gere um PLANO DE ESTUDO E EXECUÇÃO detalhado com base no contexto e materiais.

      Contexto de entrada:
      ${context}

      Materiais do repositório:
      ${fileContext}

      Inclua com detalhes:
      1) Visão geral dos materiais e objetivos de aprendizagem
      2) Mapeamento de tópicos por área (contabilidade, inglês, direito e economia)
      3) Lacunas de conteúdo e prioridades
      4) Estratégia passo a passo de evolução
      5) Diretrizes práticas de aplicação
      6) Tarefas explícitas para o próximo ciclo de estudo
      7) Riscos, dificuldades previstas e mitigação
      8) Considerações sobre documentos em formato .md e .txt no GitHub, com foco em explicação para alunos

      IMPORTANTE: responda em Português (pt-BR) e em Markdown.
    `;

    try {
      const response = await ai.models.generateContent({
        model: ANALYST_MODEL,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      return NextResponse.json(response);
    } catch (error: any) {
      if (error.status === 429 || error.message?.includes('429')) {
        const response = await ai.models.generateContent({
          model: FALLBACK_MODEL,
          contents: prompt,
        });
        return NextResponse.json(response);
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
