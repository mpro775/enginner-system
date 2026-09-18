import { ValidationOptions, MinLength } from 'class-validator';

export const PASSWORD_HASH_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 8;

export function IsSystemPassword(validationOptions?: ValidationOptions) {
  return MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    ...validationOptions,
  });
}
