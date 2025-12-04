import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse, PaginationMeta } from '../interfaces/api-response.interface';

export interface ResponseData<T> {
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data): ApiResponse<T> => {
        const statusCode = response.statusCode;

        // Handle already formatted response
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Handle response with meta (pagination)
        if (data && typeof data === 'object' && 'data' in data) {
          const responseData = data as ResponseData<T>;
          return {
            success: true,
            statusCode,
            message: responseData.message || this.getDefaultMessage(statusCode),
            data: responseData.data,
            meta: responseData.meta,
            timestamp: new Date().toISOString(),
          };
        }

        // Handle simple response
        return {
          success: true,
          statusCode,
          message: this.getDefaultMessage(statusCode),
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private getDefaultMessage(statusCode: number): string {
    const messages: Record<number, string> = {
      200: 'Success',
      201: 'Created successfully',
      204: 'Deleted successfully',
    };
    return messages[statusCode] || 'Success';
  }
}






