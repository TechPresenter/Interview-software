import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { savePrivateBuffer, privateFilePath, deletePrivateFile, PRIVATE_DIR } from '../src/services/file.service.js';

/**
 * Applicant files must not be reachable without a login.
 *
 * `uploads/` is handed to express.static at app.js:69 — no auth, no expiry — so
 * anything written there is fetchable forever by whoever ends up holding the
 * link, and links travel. That is a fine trade for a company logo and a bad one
 * for a stranger's passport photo and CV. Application's fileSchema deliberately
 * has no `url` field, but that only means anything if the bytes are somewhere
 * nothing serves — which is what these pin. The first version of the apply
 * module stored them via saveBuffer() and the auth gate was decorative.
 */

const PUBLIC_DIR = path.resolve(process.cwd(), 'uploads');

describe('private uploads are not in the public directory', () => {
  it('writes outside the express.static mount', async () => {
    const { filename } = await savePrivateBuffer(Buffer.from('a resume'), 'cv.pdf');
    try {
      const resolved = privateFilePath(filename);
      expect(resolved).toBeTruthy();
      await expect(fs.access(resolved)).resolves.toBeUndefined();
      // The whole point: not where express.static is looking.
      await expect(fs.access(path.join(PUBLIC_DIR, filename))).rejects.toThrow();
      expect(resolved.startsWith(PRIVATE_DIR)).toBe(true);
    } finally {
      await deletePrivateFile(filename);
    }
  });

  it('returns no url — there is no address for the file', async () => {
    // saveBuffer returns { url, filename }; a caller that copies that habit here
    // would put the path back in the database and invite someone to serve it.
    const out = await savePrivateBuffer(Buffer.from('x'), 'a.pdf');
    try {
      expect(out.url).toBeUndefined();
      expect(Object.keys(out)).toEqual(['filename']);
    } finally {
      await deletePrivateFile(out.filename);
    }
  });

  it('keeps the extension, and nothing of the original name', async () => {
    // The applicant's filename is attacker-controlled and often their own name;
    // the stored name must reveal neither.
    const { filename } = await savePrivateBuffer(Buffer.from('x'), 'Asha Rao - Resume 2026.pdf');
    try {
      expect(filename).toMatch(/^[0-9a-f]{24}\.pdf$/);
      expect(filename.toLowerCase()).not.toContain('asha');
    } finally {
      await deletePrivateFile(filename);
    }
  });
});

describe('privateFilePath refuses to leave its directory', () => {
  // The name comes from our own database today. That is an argument about
  // today's writers, not tomorrow's importer, migration, or bug.
  it.each([
    ['posix traversal', path.join('..', '..', '.env')],
    ['windows traversal', '..\\..\\secret'],
    ['mixed separators', '..\\../.env'],
    ['absolute posix', '/etc/passwd'],
    ['absolute windows', 'C:\\Windows\\System32\\config\\SAM'],
    ['climbs then returns', path.join('..', 'uploads', 'x.png')],
    ['empty', ''],
    ['not a string', null],
    ['a number', 42],
  ])('rejects %s', (_label, input) => {
    expect(privateFilePath(input)).toBeNull();
  });

  it('rejects a sibling directory that shares the prefix', () => {
    // Without the trailing separator, startsWith(PRIVATE_DIR) would pass
    // '/app/private-uploads-backup/x' — a real directory someone will create.
    expect(privateFilePath(path.join('..', 'private-uploads-backup', 'x.pdf'))).toBeNull();
  });

  it.each([
    ['a stored filename', 'a1b2c3d4e5f6a7b8c9d0e1f2.pdf'],
    // Containment, not a basename test: a future layout that files uploads under
    // a subdirectory must keep working.
    ['a subdirectory', path.join('2026', 'a1b2.pdf')],
  ])('allows %s', (_label, input) => {
    const r = privateFilePath(input);
    expect(r).toBeTruthy();
    expect(r.startsWith(PRIVATE_DIR + path.sep)).toBe(true);
  });
});

describe('deletePrivateFile', () => {
  it('removes the file', async () => {
    const { filename } = await savePrivateBuffer(Buffer.from('x'), 'a.pdf');
    expect(await deletePrivateFile(filename)).toBe(true);
    await expect(fs.access(privateFilePath(filename))).rejects.toThrow();
  });

  it('is quiet about a file that is already gone', async () => {
    // Deleting is called on cleanup paths; a missing file is the goal, not a fault.
    expect(await deletePrivateFile('does-not-exist.pdf')).toBe(false);
  });

  it('will not delete outside its directory', async () => {
    expect(await deletePrivateFile(path.join('..', '..', '.env'))).toBe(false);
  });
});
