import { HttpException, HttpStatus } from '@nestjs/common';

export enum PasswordRecoveryErrorCode {
  CHALLENGE_INVALID = 'PASSWORD_RESET_CHALLENGE_INVALID',
  CHALLENGE_EXPIRED = 'PASSWORD_RESET_CHALLENGE_EXPIRED',
  ATTEMPTS_EXCEEDED = 'PASSWORD_RESET_ATTEMPTS_EXCEEDED',
  TOKEN_INVALID = 'PASSWORD_RESET_TOKEN_INVALID',
  RATE_LIMITED = 'PASSWORD_RESET_RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'PASSWORD_RESET_SERVICE_UNAVAILABLE',
}

export function passwordRecoveryException(
  code: PasswordRecoveryErrorCode,
  message: string,
  status: HttpStatus,
  retryAfterSeconds?: number,
): HttpException {
  return new HttpException(
    {
      code,
      message,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    },
    status,
  );
}
