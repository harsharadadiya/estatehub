// Every error ends up here and is turned into a clean JSON response.
// Express 5 catches errors thrown in async route handlers automatically.
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError, type FieldError } from '../utils/AppError.js';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

interface ErrorLike {
  name?: string;
  message?: string;
  code?: number | string;
  statusCode?: number;
  status?: number;
  type?: string;
  path?: string;
  keyValue?: Record<string, unknown>;
  keyPattern?: Record<string, unknown>;
  errors?: unknown;
  stack?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(rawError: unknown, _req: Request, res: Response, _next: NextFunction) {
  const err = (rawError ?? {}) as ErrorLike;
  let statusCode = err instanceof AppError ? err.statusCode : (err.statusCode ?? err.status ?? 500);
  let message = err.message || 'Something went wrong';
  let errors: FieldError[] | undefined = err instanceof AppError ? err.errors : undefined;
  let code = err instanceof AppError ? err.code : undefined;

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path ?? 'a field'}`;
  } else if (err.name === 'ValidationError' && err.errors && typeof err.errors === 'object') {
    statusCode = 400;
    message = 'Please fix the highlighted fields';
    errors = Object.values(err.errors as Record<string, { path: string; message: string }>).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyPattern ?? err.keyValue ?? {});
    if (fields.includes('email')) message = 'An account with this email already exists';
    else if (fields.includes('time')) {
      message = 'Sorry, this time slot was just booked. Please choose another time.';
      code = 'SLOT_TAKEN';
    } else message = 'This item already exists';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Your session is not valid. Please log in again.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body is not valid JSON';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request is too large';
  } else if (rawError instanceof multer.MulterError) {
    statusCode = 400;
    const multerMessages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'Each image must be 5 MB or smaller',
      LIMIT_FILE_COUNT: 'You can upload up to 4 images',
      LIMIT_UNEXPECTED_FILE: 'You can upload up to 4 images (field name must be "images")',
    };
    message = multerMessages[rawError.code] ?? rawError.message;
  }

  if (statusCode >= 500) {
    console.error('💥 Unexpected error:', rawError);
    if (env.isProduction) message = 'Something went wrong on our side. Please try again.';
  }

  res.status(statusCode).json({
    message,
    ...(code && { code }),
    ...(errors?.length && { errors }),
    ...(!env.isProduction && statusCode >= 500 && err.stack && { stack: err.stack }),
  });
}
