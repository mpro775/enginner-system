import { PaginationMeta } from '../interfaces/api-response.interface';
import { PaginationDto } from '../dto/pagination.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export function createPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

export function getSkipAndLimit(pagination: PaginationDto): {
  skip: number;
  limit: number;
} {
  const page = pagination.page || 1;
  const limit = pagination.limit || 10;
  const skip = (page - 1) * limit;
  return { skip, limit };
}

export function getSortOptions(pagination: PaginationDto): Record<string, 1 | -1> {
  const sortBy = pagination.sortBy || 'createdAt';
  const sortOrder = pagination.sortOrder === 'asc' ? 1 : -1;
  return { [sortBy]: sortOrder };
}





