/**
 * Minimal, explicit request validation.
 *
 * Every mutating endpoint validates its body against a declared shape. We do
 * not pass arbitrary objects through to the database, and we never trust a
 * browser-supplied amount, role, status or identifier.
 */

import { badRequest } from './http.ts';

type FieldType = 'string' | 'email' | 'int' | 'number' | 'boolean' | 'array' | 'object';

export interface FieldRule {
  type: FieldType;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  values?: readonly string[];
  items?: FieldRule;
  nullable?: boolean;
}

export type Schema = Record<string, FieldRule>;

export function validate<T = Record<string, unknown>>(body: unknown, schema: Schema): T {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Expected an object request body.');
  }
  const input = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, rule] of Object.entries(schema)) {
    const raw = input[key];

    if (raw === undefined || raw === null || raw === '') {
      if (rule.required) throw badRequest(`\`${key}\` is required.`);
      if (rule.nullable) out[key] = null;
      continue;
    }

    switch (rule.type) {
      case 'string': {
        if (typeof raw !== 'string') throw badRequest(`\`${key}\` must be text.`);
        const value = raw.trim();
        if (!value) throw badRequest(`\`${key}\` cannot be empty.`);
        if (rule.min !== undefined && value.length < rule.min) {
          throw badRequest(`\`${key}\` is too short.`);
        }
        if (rule.max !== undefined && value.length > rule.max) {
          throw badRequest(`\`${key}\` is too long.`);
        }
        if (rule.pattern && !rule.pattern.test(value)) {
          throw badRequest(`\`${key}\` has an invalid format.`);
        }
        if (rule.values && !rule.values.includes(value)) {
          throw badRequest(`\`${key}\` has an unsupported value.`);
        }
        out[key] = value;
        break;
      }
      case 'email': {
        if (typeof raw !== 'string') throw badRequest(`\`${key}\` must be an email address.`);
        const value = raw.trim().toLowerCase();
        if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          throw badRequest('Enter a valid email address.');
        }
        out[key] = value;
        break;
      }
      case 'int': {
        const value = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isInteger(value)) throw badRequest(`\`${key}\` must be a whole number.`);
        if (rule.min !== undefined && value < rule.min) throw badRequest(`\`${key}\` is too small.`);
        if (rule.max !== undefined && value > rule.max) throw badRequest(`\`${key}\` is too large.`);
        out[key] = value;
        break;
      }
      case 'number': {
        const value = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(value)) throw badRequest(`\`${key}\` must be a number.`);
        if (rule.min !== undefined && value < rule.min) throw badRequest(`\`${key}\` is too small.`);
        if (rule.max !== undefined && value > rule.max) throw badRequest(`\`${key}\` is too large.`);
        out[key] = value;
        break;
      }
      case 'boolean': {
        if (typeof raw !== 'boolean') throw badRequest(`\`${key}\` must be true or false.`);
        out[key] = raw;
        break;
      }
      case 'array': {
        if (!Array.isArray(raw)) throw badRequest(`\`${key}\` must be a list.`);
        if (rule.max !== undefined && raw.length > rule.max) {
          throw badRequest(`\`${key}\` has too many entries.`);
        }
        out[key] = raw.map((item) => {
          if (!rule.items) return item;
          return validate({ value: item }, { value: rule.items }).value;
        });
        break;
      }
      case 'object': {
        if (typeof raw !== 'object' || Array.isArray(raw)) {
          throw badRequest(`\`${key}\` must be an object.`);
        }
        out[key] = raw;
        break;
      }
    }
  }

  return out as T;
}

export function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`\`${field}\` must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

/** Normalise an email for uniqueness checks. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalise a social handle: lower-case, no leading @, no whitespace. */
export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');
}
