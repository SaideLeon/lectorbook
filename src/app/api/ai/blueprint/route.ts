import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';
import { buildRelevantContext } from '@/server/semantic-search';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { contextFiles, context, apiKey } = await req.json();
    const ai = getAIClient(apiKey);
    const { renderedContext: fileContext, selectedChunks } = await buildRelevantContext({
      query: `${context || ''}\nplano de estudo e execução`,
      contextFiles: contextFiles || [],
      apiKey,
      maxChunks: 12,
    });
    const nowInMozambique = new Intl.DateTimeFormat('pt-MZ', {
      dateStyle: 'full',
      timeStyle: 'long',
      timeZone: 'Africa/Maputo',
    }).format(new Date());

    const prompt = `
      Você é o Tutor de Leitura principal chamado "Lector".
      Não atue como analista; atue como professor explicador e orientador.
      Habilidades: contabilidade, inglês, direito e economia.
      Vá direto ao conteúdo solicitado, sem apresentações ou introduções sobre quem você é.

      Gere um PLANO DE ESTUDO E EXECUÇÃO detalhado com base no contexto e materiais.
      Referência temporal obrigatória: a hora atual exata em Moçambique (Africa/Maputo) é ${nowInMozambique}.

      Contexto de entrada:
      ${context}

      Materiais do repositório (recuperados por busca semântica):
      ${fileContext}
      Total de trechos selecionados: ${selectedChunks.length}.

      Inclua com detalhes:
      1) Visão geral dos materiais e objetivos de aprendizagem
      2) Mapeamento de tópicos por área (contabilidade, inglês, direito e economia)
      3) Lacunas de conteúdo e prioridades
      4) Estratégia passo a passo de evolução
      5) Diretrizes práticas de aplicação
      6) Tarefas explícitas para o próximo ciclo de estudo
      7) Riscos, dificuldades previstas e mitigação
      8) Considerações sobre documentos em formato .md e .txt no GitHub, usando apenas os trechos recuperados por busca semântica
      9) Texto direto ao ponto: sem saudações, sem apresentação pessoal e sem explicação da função do assistente
      10) Estruture o conteúdo para exportação em PDF de alta qualidade, usando tabelas quando fizer sentido para organizar dados
      11) Em qualquer menção de prazo, agenda, data e hora, use explicitamente o fuso horário de Moçambique (Africa/Maputo)

      IMPORTANTE: responda em Português (pt-BR) e em Markdown estruturado.
      Se os trechos recuperados forem insuficientes, aponte a limitação antes de sugerir próximos passos.
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
