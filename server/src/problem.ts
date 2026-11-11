import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { z } from 'zod';
import type { Problem } from '../../shared/contract.ts';

/** Throw from any handler; the app's error handler turns it into an RFC 7807 response. */
export class HttpProblem extends Error {
  readonly status: ContentfulStatusCode;
  readonly title: string;
  readonly detail: string | undefined;
  readonly errors: Problem['errors'];
  /** Extra response headers, e.g. Retry-After on 429. */
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    status: ContentfulStatusCode,
    title: string,
    detail?: string,
    errors?: Problem['errors'],
    headers: Readonly<Record<string, string>> = {},
  ) {
    super(detail ?? title);
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.errors = errors;
    this.headers = headers;
  }
}

export function problemResponse(c: Context, problem: Problem, headers: Readonly<Record<string, string>> = {}): Response {
  return c.body(JSON.stringify(problem), problem.status as ContentfulStatusCode, {
    ...headers,
    'Content-Type': 'application/problem+json',
  });
}

export function toProblem(err: HttpProblem): Problem {
  return {
    type: 'about:blank',
    title: err.title,
    status: err.status,
    ...(err.detail ? { detail: err.detail } : {}),
    ...(err.errors ? { errors: err.errors } : {}),
  };
}

export async function readJson<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HttpProblem(400, 'Geçersiz istek', 'İstek gövdesi geçerli JSON değil');
  }
  return validate(schema, body);
}

export function validate<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    throw new HttpProblem(400, 'Doğrulama hatası', 'Bazı alanlar geçersiz', errors);
  }
  return parsed.data;
}
