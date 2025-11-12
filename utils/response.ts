// src/utils/response.ts
/**
 * Standardized API response helpers
 * All paginated endpoints should return this shape consistently
 */

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
};

/**
 * Create a standardized paginated response
 * Use this in all controllers that return lists
 */
export function paginatedResponse<T>(
  items: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    data: items,
    page,
    limit,
    total,
  };
}

/**
 * Calculate total pages from total items and page size
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.max(1, Math.ceil(total / limit));
}

/**
 * Validate and sanitize pagination params from query string
 */
export function parsePaginationParams(query: {
  page?: string | number;
  limit?: string | number;
}): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(String(query.page ?? 1), 10));
  const limit = Math.max(
    1,
    Math.min(100, parseInt(String(query.limit ?? 20), 10))
  ); // cap at 100
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
