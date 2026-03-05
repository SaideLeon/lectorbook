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

function serializeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  return { value: error };
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    console.error('[API AppError]', {
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    });

    return NextResponse.json(
      { error: error.message, details: error.details, code: error.statusCode },
      { status: error.statusCode },
    );
  }

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  const debugId = `api_${Date.now().toString(36)}`;

  console.error('[API Error]', {
    debugId,
    ...serializeUnknownError(error),
  });

  return NextResponse.json({ error: message, code: 500, debugId }, { status: 500 });
}
