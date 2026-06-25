import { describe, it, expect } from 'vitest';
import { paginate } from '../src/utils/ApiResponse.js';
import { slugify } from '../src/utils/slug.js';
import { ApiError } from '../src/utils/ApiError.js';

describe('utils/ApiResponse · paginate', () => {
  it('computes page count', () => {
    expect(paginate({ page: 1, limit: 20, total: 45 })).toEqual({ page: 1, limit: 20, total: 45, pages: 3 });
  });
  it('never returns 0 pages', () => {
    expect(paginate({ page: 1, limit: 20, total: 0 }).pages).toBe(1);
  });
});

describe('utils/slug · slugify', () => {
  it('lowercases and hyphenates with a random suffix', () => {
    const s = slugify('Acme Corp!');
    expect(s).toMatch(/^acme-corp-[a-z0-9_-]{6}$/i);
  });
  it('produces unique slugs for the same input', () => {
    expect(slugify('Hello')).not.toBe(slugify('Hello'));
  });
});

describe('utils/ApiError', () => {
  it('factory helpers set the right status codes', () => {
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.conflict().statusCode).toBe(409);
    expect(ApiError.tooMany().statusCode).toBe(429);
  });
  it('marks errors operational and carries details', () => {
    const e = ApiError.badRequest('bad', { details: { x: 1 } });
    expect(e.isOperational).toBe(true);
    expect(e.statusCode).toBe(400);
    expect(e.details).toEqual({ x: 1 });
  });
});
