/**
 * HTTP primitives: typed errors, JSON responses, cookies, origin checks.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>) =>
  new ApiError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Sign in to continue.') =>
  new ApiError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this action.') =>
  new ApiError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);
export const conflict = (message: string, details?: Record<string, unknown>) =>
  new ApiError(409, 'conflict', message, details);
export const tooMany = (message: string, retryAfterSeconds: number) =>
  new ApiError(429, 'rate_limited', message, { retryAfterSeconds });

const NO_STORE = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...NO_STORE,
      ...extraHeaders,
    },
  });
}

export function errorResponse(error: unknown, requestId: string): Response {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          requestId,
        },
      },
      error.status
    );
  }

  // Never leak stack traces or database internals to the client.
  console.error(`[${requestId}] unhandled`, error);
  return json(
    {
      error: {
        code: 'internal_error',
        message: 'Something went wrong. Please try again.',
        requestId,
      },
    },
    500
  );
}

/** Read a JSON body with an explicit size ceiling. */
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw badRequest('Expected a JSON request body.');
  }
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > maxBytes) throw new ApiError(413, 'payload_too_large', 'Request body is too large.');

  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, 'payload_too_large', 'Request body is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('Malformed JSON body.');
  }
}

export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get('Cookie');
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const rawValue = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(rawValue);
    } catch {
      // Ignore malformed percent-encoding instead of failing the whole request.
      out[name] = rawValue;
    }
  }
  return out;
}

export interface CookieOptions {
  maxAgeSeconds: number;
  secure: boolean;
}

export function serializeSessionCookie(
  token: string,
  options: CookieOptions,
  name = 'mhomho_session'
): string {
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(secure: boolean, name = 'mhomho_session'): string {
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Reject cross-site mutations. Browsers send Origin on all non-GET requests;
 * a missing Origin is accepted only for same-origin server-side calls.
 */
export function assertSameOrigin(request: Request, appOrigin: string): void {
  const origin = request.headers.get('Origin');
  if (!origin) return;
  const allowed = new Set([appOrigin]);
  try {
    const url = new URL(appOrigin);
    allowed.add(`${url.protocol}//${url.host}`);
  } catch {
    /* ignore malformed config */
  }
  if (!allowed.has(origin)) {
    throw forbidden('Cross-origin request blocked.');
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}

export function requestId(): string {
  return crypto.randomUUID();
}
