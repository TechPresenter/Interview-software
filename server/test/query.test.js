import { describe, it, expect } from 'vitest';
import { parseListQuery } from '../src/utils/query.js';

describe('utils/query · parseListQuery', () => {
  it('applies defaults', () => {
    const { page, limit, skip, sort } = parseListQuery({});
    expect(page).toBe(1);
    expect(limit).toBe(20);
    expect(skip).toBe(0);
    expect(sort).toBe('-createdAt');
  });

  it('computes skip from page/limit', () => {
    const { skip, limit } = parseListQuery({ page: '3', limit: '10' });
    expect(limit).toBe(10);
    expect(skip).toBe(20);
  });

  it('clamps limit to 100 and floors page at 1', () => {
    expect(parseListQuery({ limit: '999' }).limit).toBe(100);
    expect(parseListQuery({ page: '0' }).page).toBe(1);
    expect(parseListQuery({ page: '-5' }).page).toBe(1);
  });

  it('builds a case-insensitive $or search filter', () => {
    const { filter } = parseListQuery({ q: 'aCme' }, { searchFields: ['name', 'email'] });
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0].name).toBeInstanceOf(RegExp);
    expect('ACME CORP').toMatch(filter.$or[0].name);
  });

  it('escapes regex metacharacters in the query', () => {
    const { filter } = parseListQuery({ q: 'a.b(' }, { searchFields: ['name'] });
    expect('a.b(').toMatch(filter.$or[0].name);
    expect('aXb(').not.toMatch(filter.$or[0].name);
  });

  it('omits search when no q or no fields', () => {
    expect(parseListQuery({ q: 'x' }).filter.$or).toBeUndefined();
    expect(parseListQuery({}, { searchFields: ['name'] }).filter.$or).toBeUndefined();
  });
});
