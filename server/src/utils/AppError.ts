export interface FieldError {
  field: string;
  message: string;
}

/**
 * An "expected" error with an HTTP status code.
 *   throw new AppError('Property not found', 404)
 * The error handler turns it into a clean JSON response.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly errors?: FieldError[];
  readonly code?: string;

  constructor(message: string, statusCode = 500, options: { errors?: FieldError[]; code?: string } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = options.errors;
    this.code = options.code;
  }
}
