import {
  BCRYPT_MAX_PASSWORD_BYTES,
  isWithinBcryptPasswordLimit,
} from './password-policy';

describe('password policy bcrypt boundary', () => {
  it('accepts an ASCII password at the 72-byte boundary', () => {
    expect(isWithinBcryptPasswordLimit('a'.repeat(BCRYPT_MAX_PASSWORD_BYTES))).toBe(
      true,
    );
  });

  it('rejects an ASCII password beyond 72 bytes', () => {
    expect(
      isWithinBcryptPasswordLimit('a'.repeat(BCRYPT_MAX_PASSWORD_BYTES + 1)),
    ).toBe(false);
  });

  it('rejects Unicode with fewer than 72 characters but more than 72 bytes', () => {
    const unicodePassword = '😀'.repeat(19);
    expect(unicodePassword.length).toBeLessThanOrEqual(72);
    expect(Buffer.byteLength(unicodePassword, 'utf8')).toBeGreaterThan(72);
    expect(isWithinBcryptPasswordLimit(unicodePassword)).toBe(false);
  });
});
