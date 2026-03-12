import { NextRequest, NextResponse } from 'next/server';
import { ANALYST_MODEL, FALLBACK_MODEL, getAIClient } from '@/server/gemini.service';
import { jsonError } from '@/app/api/_utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { contextFiles, apiKey, questionCount = 10 } = await req.json();

    if (!contextFiles || contextFiles.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo de aulas disponível para gerar questionário.' },
        { status: 400 },
      );
    }

    const ai = getAIClient(apiKey);

    const combinedContent = (contextFiles as { path: string; content: string }[])
      .map((f) => `### Arquivo: ${f.path}\n\n${f.content.trim()}`)
      .join('\n\n---\n\n')
      .slice(0, 18000);

    const prompt = `
Você é um avaliador educacional especializado. Sua tarefa é criar um questionário de avaliação com base EXCLUSIVAMENTE nos documentos fornecidos.

REGRAS ABSOLUTAS — não podem ser violadas:
1. Crie EXATAMENTE ${questionCount} perguntas.
2. Cada pergunta deve ser baseada em informação EXPLICITAMENTE presente nos documentos abaixo.
3. NUNCA invente conceitos, definições, datas, nomes ou factos que não estejam nos documentos.
4. Se o conteúdo for insuficiente para ${questionCount} perguntas distintas, crie menos perguntas com "as únicas possíveis" do conteúdo.
5. Cada pergunta tem EXATAMENTE 4 opções de resposta (options[0] a options[3]).
6. Apenas 1 opção é correcta (correctIndex: 0, 1, 2 ou 3).
7. As 3 opções incorrectas devem ser plausíveis mas claramente erradas perante o conteúdo.
8. A explicação deve referenciar um trecho concreto do documento.
9. Varie os tipos: definição (30%), aplicação (40%), interpretação (30%).

Documentos do repositório:
${combinedContent}

Responda APENAS com JSON válido. Sem markdown. Sem texto antes ou depois. Sem \`\`\`json.
Formato obrigatório:
{
  "questions": [
    {
      "id": "q1",
      "question": "Texto da pergunta?",
      "options": ["Opção A", "Opção B", "Opção C", "Opção D"],
      "correctIndex": 0,
      "explanation": "Conforme o documento [nome do arquivo]: '...'",
      "source": "caminho/do/arquivo.md"
    }
  ]
}
`;

    const callGemini = async (model: string) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.2 },
      });

      const raw = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

      // Extrai JSON mesmo que haja texto extra antes/depois
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('A IA não retornou JSON válido.');

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error('A IA não gerou perguntas válidas.');
      }

      // Normaliza e valida cada questão
      parsed.questions = parsed.questions.map((q: any, idx: number) => ({
        id: q.id ?? `q${idx + 1}`,
        question: String(q.question ?? ''),
        options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : ['A', 'B', 'C', 'D'],
        correctIndex: typeof q.correctIndex === 'number' ? Math.min(3, Math.max(0, q.correctIndex)) : 0,
        explanation: String(q.explanation ?? ''),
        source: String(q.source ?? ''),
      })).filter((q: any) => q.question.trim().length > 0);

      return parsed;
    };

    try {
      return NextResponse.json(await callGemini(ANALYST_MODEL));
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes('429')) {
        return NextResponse.json(await callGemini(FALLBACK_MODEL));
      }
      throw err;
    }
  } catch (error) {
    return jsonError(error);
  }
}
