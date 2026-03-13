// src/app/api/student/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsonError, AppError } from '@/app/api/_utils';
import { getLevelFromXp } from '@/types/student';

export const runtime = 'nodejs';

function generateAccessCode(): string {
  return `LB-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError('Supabase não configurado.', 503);
  return createClient(url, key);
}

// GET /api/student/profile?session_key=xxx
export async function GET(req: NextRequest) {
  try {
    const session_key = req.nextUrl.searchParams.get('session_key');
    if (!session_key) throw new AppError('session_key obrigatório.', 400);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('session_key', session_key)
      .single();

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({ student: null });
    }
    if (error) throw new AppError(error.message, 500);

    return NextResponse.json({ student: data });
  } catch (err) {
    return jsonError(err);
  }
}

// POST /api/student/profile — create new student
export async function POST(req: NextRequest) {
  try {
    const { session_key, name, class: cls, gender } = await req.json();
    if (!session_key || !name) throw new AppError('session_key e name são obrigatórios.', 400);
    if (gender && !['M', 'F'].includes(gender)) throw new AppError('gender deve ser M ou F.', 400);

    const supabase = getSupabase();
    const accessCode = generateAccessCode();

    const { data, error } = await supabase
      .from('students')
      .insert({
        session_key,
        access_code: accessCode,
        name: name.trim(),
        class: cls?.trim() || null,
        gender: gender || null,
        course: 'Contabilidade',
        total_xp: 0,
        level: 'bronze',
        quizzes_completed: 0,
        avg_percentage: 0,
      })
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return NextResponse.json({ student: data, access_code: accessCode }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}

// PATCH /api/student/profile — update profile
export async function PATCH(req: NextRequest) {
  try {
    const { session_key, name, class: cls, gender } = await req.json();
    if (!session_key) throw new AppError('session_key obrigatório.', 400);
    if (gender && !['M', 'F'].includes(gender)) throw new AppError('gender deve ser M ou F.', 400);

    const supabase = getSupabase();
    const updates: Record<string, any> = {};
    if (name) updates.name = name.trim();
    if (cls !== undefined) updates.class = cls?.trim() || null;
    if (gender !== undefined) updates.gender = gender || null;

    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('session_key', session_key)
      .select()
      .single();

    if (error) throw new AppError(error.message, 500);
    return NextResponse.json({ student: data });
  } catch (err) {
    return jsonError(err);
  }
}
