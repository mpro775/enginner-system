import {
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const PASSWORD_HASH_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 8;
export const BCRYPT_MAX_PASSWORD_BYTES = 72;

export function isWithinBcryptPasswordLimit(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= BCRYPT_MAX_PASSWORD_BYTES;
}

export function assertWithinBcryptPasswordLimit(password: string): void {
  if (!isWithinBcryptPasswordLimit(password)) {
    throw new Error(
      `Password must not exceed ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes`,
    );
  }
}

export function IsSystemPassword(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      ...validationOptions,
    })(target, propertyKey);

    registerDecorator({
      name: 'isWithinBcryptPasswordLimit',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: {
        message: `Password must not exceed ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes`,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' && isWithinBcryptPasswordLimit(value)
          );
        },
        defaultMessage(_args: ValidationArguments): string {
          return `Password must not exceed ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes`;
        },
      },
    });
  };
}
