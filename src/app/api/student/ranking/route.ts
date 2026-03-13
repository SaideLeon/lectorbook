// src/app/api/student/ranking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jsonError, AppError } from '@/app/api/_utils';
import { getSupabaseServerClient } from '@/server/supabase';

export const runtime = 'nodejs';

function getSupabase() {
  try {
    return getSupabaseServerClient();
  } catch {
    throw new AppError('Supabase não configurado.', 503);
  }
}

// GET /api/student/ranking?class=xxx&limit=20
export async function GET(req: NextRequest) {
  try {
    const classFilter = req.nextUrl.searchParams.get('class');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '20'), 50);

    const supabase = getSupabase();

    let query = supabase
      .from('student_ranking')
      .select('*')
      .limit(limit);

    if (classFilter) query = query.eq('class', classFilter);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500);

    return NextResponse.json({ ranking: data || [] });
  } catch (err) {
    return jsonError(err);
  }
}
