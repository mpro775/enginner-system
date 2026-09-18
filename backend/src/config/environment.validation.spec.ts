import {
  validateEnvironment,
  validatePasswordRecoveryOtpSecret,
} from './environment.validation';

describe('password recovery environment validation', () => {
  it('rejects a missing OTP secret', () => {
    expect(() => validatePasswordRecoveryOtpSecret(undefined)).toThrow(
      'PASSWORD_RESET_OTP_SECRET is required',
    );
  });

  it.each([
    'short-secret',
    'replace-with-a-long-random-secret-that-is-not-real',
    'a'.repeat(64),
  ])('rejects a weak or obvious OTP secret: %s', (secret) => {
    expect(() => validatePasswordRecoveryOtpSecret(secret)).toThrow();
  });

  it('accepts an independent strong secret and preserves the config', () => {
    const config = {
      PASSWORD_RESET_OTP_SECRET:
        '9vK7@qL2#sP8!xR4$wN6&cM3*zT5+fH1-independent',
    };
    expect(validateEnvironment(config)).toBe(config);
  });
});
