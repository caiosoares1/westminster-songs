import { hashPassword, safeEqual, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('louvor123');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('louvor123');
    await expect(verifyPassword('louvor123', hash)).resolves.toBe(true);
    await expect(verifyPassword('louvor124', hash)).resolves.toBe(false);
  });

  it('uses a different salt each time', async () => {
    expect(await hashPassword('x')).not.toEqual(await hashPassword('x'));
  });

  it('rejects malformed hashes', async () => {
    await expect(verifyPassword('x', 'plain-text')).resolves.toBe(false);
  });

  it('compares invite codes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
