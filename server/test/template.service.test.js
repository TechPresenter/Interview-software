import { describe, it, expect } from 'vitest';
import { interpolate } from '../src/services/template.service.js';

describe('template.service · interpolate', () => {
  it('replaces simple variables', () => {
    expect(interpolate('Hi {{name}}', { name: 'Sam' })).toBe('Hi Sam');
  });
  it('supports dotted paths', () => {
    expect(interpolate('{{job.title}}', { job: { title: 'Engineer' } })).toBe('Engineer');
  });
  it('renders missing variables as empty', () => {
    expect(interpolate('Hi {{missing}}!', {})).toBe('Hi !');
  });
  it('tolerates whitespace in braces', () => {
    expect(interpolate('{{ name }}', { name: 'X' })).toBe('X');
  });
  it('handles null/undefined input', () => {
    expect(interpolate(undefined, {})).toBe('');
  });
});
