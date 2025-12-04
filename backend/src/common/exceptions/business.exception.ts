import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errorCode?: string,
  ) {
    super(
      {
        message,
        error: 'BusinessError',
        errorCode,
      },
      statusCode,
    );
  }
}

export class EntityNotFoundException extends HttpException {
  constructor(entity: string, identifier?: string | number) {
    const message = identifier
      ? `${entity} with identifier "${identifier}" not found`
      : `${entity} not found`;
    super(
      {
        message,
        error: 'NotFound',
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class DuplicateEntityException extends HttpException {
  constructor(entity: string, field: string, value: string) {
    super(
      {
        message: `${entity} with ${field} "${value}" already exists`,
        error: 'Conflict',
      },
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidOperationException extends HttpException {
  constructor(message: string) {
    super(
      {
        message,
        error: 'InvalidOperation',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class UnauthorizedAccessException extends HttpException {
  constructor(message: string = 'Unauthorized access') {
    super(
      {
        message,
        error: 'Unauthorized',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class ForbiddenAccessException extends HttpException {
  constructor(message: string = 'Access forbidden') {
    super(
      {
        message,
        error: 'Forbidden',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}






