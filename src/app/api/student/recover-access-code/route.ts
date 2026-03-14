import { NextRequest, NextResponse } from 'next/server';
import { jsonError, AppError } from '@/app/api/_utils';
import { getSupabaseServerClient } from '@/server/supabase';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

function getSupabase() {
  try {
    return getSupabaseServerClient();
  } catch {
    throw new AppError('Supabase não configurado.', 503);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) throw new AppError('email obrigatório.', 400);
    if (!EMAIL_REGEX.test(normalizedEmail)) throw new AppError('email inválido.', 400);

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('students')
      .select('access_code')
      .eq('email', normalizedEmail)
      .single();

    if (error || !data?.access_code) {
      throw new AppError('Nenhum código encontrado para este e-mail.', 404);
    }

    return NextResponse.json({ access_code: data.access_code });
  } catch (err) {
    return jsonError(err);
  }
}
