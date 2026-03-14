// src/app/api/student/quiz-result/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jsonError, AppError } from '@/app/api/_utils';
import { getSupabaseServerClient } from '@/server/supabase';
import { calcQuizXp, getLevelFromXp } from '@/types/student';

export const runtime = 'nodejs';

function getSupabase() {
  try {
    return getSupabaseServerClient();
  } catch {
    throw new AppError('Supabase não configurado.', 503);
  }
}

// POST /api/student/quiz-result
export async function POST(req: NextRequest) {
  try {
    const {
      session_key,
      repo_full_name,
      score,
      total_questions,
      percentage,
      answers, // QuizAnswerPayload[] — optional, for detailed review
    } = await req.json();

    if (!session_key) throw new AppError('session_key obrigatório.', 400);
    if (score == null || total_questions == null || percentage == null) {
      throw new AppError('score, total_questions e percentage são obrigatórios.', 400);
    }

    const supabase = getSupabase();

    // Busca aluno
    const { data: student, error: fetchErr } = await supabase
      .from('students')
      .select('id, total_xp, quizzes_completed, avg_percentage, level')
      .eq('session_key', session_key)
      .single();

    if (fetchErr || !student) {
      throw new AppError('Aluno não encontrado.', 404);
    }

    // Calcula XP ganho
    const xp_earned = calcQuizXp(percentage, total_questions);
    const new_total_xp = student.total_xp + xp_earned;
    const level_before = student.level;
    const level_after = getLevelFromXp(new_total_xp);

    // Rolling average de percentagem
    const completed = student.quizzes_completed;
    const new_avg =
      completed === 0
        ? percentage
        : Math.round(
            ((student.avg_percentage * completed + percentage) / (completed + 1)) * 100,
          ) / 100;

    // Salva resultado do quiz
    const { data: result, error: insertErr } = await supabase
      .from('quiz_results')
      .insert({
        student_id: student.id,
        repo_full_name: repo_full_name || null,
        score,
        total_questions,
        percentage,
        xp_earned,
        level_before,
        level_after,
      })
      .select()
      .single();

    if (insertErr || !result) throw new AppError(insertErr?.message ?? 'Falha ao salvar resultado.', 500);

    // Salva respostas individuais (se enviadas)
    if (Array.isArray(answers) && answers.length > 0) {
      const rows = answers.map((a: any, idx: number) => ({
        quiz_result_id:  result.id,
        question_index:  idx,
        question_text:   String(a.question_text ?? ''),
        options:         Array.isArray(a.options) ? a.options : [],
        correct_index:   Number(a.correct_index ?? 0),
        selected_index:  a.selected_index != null ? Number(a.selected_index) : null,
        is_correct:      Boolean(a.is_correct),
        explanation:     a.explanation ? String(a.explanation) : null,
        source:          a.source ? String(a.source) : null,
      }));

      const { error: answerErr } = await supabase.from('quiz_answers').insert(rows);
      if (answerErr) {
        // Não falha — o resultado já foi salvo; respostas são bônus
        console.warn('[quiz-result] Falha ao salvar respostas:', answerErr.message);
      }
    }

    // Atualiza perfil do aluno
    const { data: updated, error: updateErr } = await supabase
      .from('students')
      .update({
        total_xp:           new_total_xp,
        level:              level_after,
        quizzes_completed:  completed + 1,
        avg_percentage:     new_avg,
        last_study_at:      new Date().toISOString(),
      })
      .eq('session_key', session_key)
      .select()
      .single();

    if (updateErr) throw new AppError(updateErr.message, 500);

    // Registra sessão de estudo
    await supabase.from('study_sessions').insert({
      student_id:     student.id,
      repo_full_name: repo_full_name || null,
    });

    return NextResponse.json({
      xp_earned,
      new_total_xp,
      level_before,
      level_after,
      leveled_up: level_before !== level_after,
      student:    updated,
      result,
    });
  } catch (err) {
    return jsonError(err);
  }
}

// GET /api/student/quiz-result?session_key=xxx&limit=20&repo=xxx
export async function GET(req: NextRequest) {
  try {
    const session_key = req.nextUrl.searchParams.get('session_key');
    const repo        = req.nextUrl.searchParams.get('repo');
    const limit       = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 50);

    if (!session_key) throw new AppError('session_key obrigatório.', 400);

    const supabase = getSupabase();

    // Busca o ID do aluno
    const { data: student, error: sErr } = await supabase
      .from('students')
      .select('id')
      .eq('session_key', session_key)
      .single();

    if (sErr || !student) throw new AppError('Aluno não encontrado.', 404);

    // Busca resultados
    let query = supabase
      .from('quiz_results')
      .select('*, quiz_answers(*)')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (repo) query = query.eq('repo_full_name', repo);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);

    return NextResponse.json({ results: data || [] });
  } catch (err) {
    return jsonError(err);
  }
}
