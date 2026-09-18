const MINIMUM_OTP_SECRET_BYTES = 32;

export function validatePasswordRecoveryOtpSecret(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      'PASSWORD_RESET_OTP_SECRET is required for password recovery.',
    );
  }

  const secret = value.trim();
  const normalized = secret.toLowerCase();
  const obviousPlaceholder =
    /^(change|replace|your[-_]|password|secret|test)/.test(normalized) ||
    new Set(secret).size < 12;

  if (
    Buffer.byteLength(secret, 'utf8') < MINIMUM_OTP_SECRET_BYTES ||
    obviousPlaceholder
  ) {
    throw new Error(
      `PASSWORD_RESET_OTP_SECRET must be an independent, non-placeholder secret with at least ${MINIMUM_OTP_SECRET_BYTES} UTF-8 bytes.`,
    );
  }

  return secret;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  validatePasswordRecoveryOtpSecret(config.PASSWORD_RESET_OTP_SECRET);
  return config;
}
