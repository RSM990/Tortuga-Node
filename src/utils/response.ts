// src/utils/response.ts
import type { Response } from 'express';

/**
 * Standard pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard API response structure
 * ALL endpoints return this format for consistency
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: PaginationMeta;
}

/**
 * Standard error response structure
 */
export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Parse pagination parameters from query string
 * Provides safe defaults and validation
 *
 * @example
 * const { page, limit, skip } = parsePaginationParams(req.query);
 */
export function parsePaginationParams(query: any): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(query.limit as string) || 20)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Create a successful response
 * Use this for ALL successful responses (single resources and lists)
 *
 * @example
 * // Single resource
 * return res.json(successResponse(movie));
 *
 * @example
 * // Paginated list
 * return res.json(successResponse(movies, pagination));
 */
export function successResponse<T>(
  data: T,
  pagination?: PaginationMeta,
  message?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    ...(message && { message }),
    ...(pagination && { pagination }),
  };
}

/**
 * Create an error response
 * Use this for ALL error responses
 *
 * @example
 * return res.status(404).json(errorResponse('Movie not found'));
 *
 * @example
 * // With validation errors
 * return res.status(400).json(errorResponse(
 *   'Validation failed',
 *   validationErrors
 * ));
 */
export function errorResponse(
  message: string,
  errors?: Array<{ field?: string; message: string; code?: string }>
): ApiError {
  return {
    success: false,
    message,
    ...(errors && { errors }),
  };
}

/**
 * Helper to send paginated response
 * Calculates totalPages automatically
 *
 * @example
 * sendPaginatedResponse(res, movies, { page: 1, limit: 20, total: 100 });
 */
export function sendPaginatedResponse<T>(
  res: Response,
  data: T[],
  meta: Omit<PaginationMeta, 'totalPages'>
): Response {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.limit));
  return res.json(
    successResponse(data, {
      ...meta,
      totalPages,
    })
  );
}

/**
 * Helper to send single resource response
 *
 * @example
 * sendSuccessResponse(res, movie);
 */
export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  message?: string
): Response {
  return res.json(successResponse(data, undefined, message));
}

/**
 * Helper to send error response
 *
 * @example
 * sendErrorResponse(res, 404, 'Movie not found');
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  message: string,
  errors?: Array<{ field?: string; message: string; code?: string }>
): Response {
  return res.status(statusCode).json(errorResponse(message, errors));
}

/**
 * Common HTTP status codes for reference
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;
