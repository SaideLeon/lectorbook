import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsonError, AppError } from '@/app/api/_utils';

export const runtime = 'nodejs';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError('Supabase não configurado.', 503);
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { access_code, session_key } = await req.json();
    if (!access_code || !session_key) {
      throw new AppError('access_code e session_key são obrigatórios.', 400);
    }

    const supabase = getSupabase();

    const { data: existing, error: findErr } = await supabase
      .from('students')
      .select('*')
      .eq('access_code', String(access_code).trim().toUpperCase())
      .single();

    if (findErr || !existing) throw new AppError('Código de acesso inválido.', 401);

    const { data: updated, error: updateErr } = await supabase
      .from('students')
      .update({ session_key })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateErr || !updated) throw new AppError(updateErr?.message || 'Falha ao iniciar sessão.', 500);

    return NextResponse.json({ student: updated });
  } catch (err) {
    return jsonError(err);
  }
}
