import { NextResponse } from 'next/server';

export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, details: error.details, code: error.statusCode },
      { status: error.statusCode },
    );
  }

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  console.error('[API Error]', error);
  return NextResponse.json({ error: message, code: 500 }, { status: 500 });
}
