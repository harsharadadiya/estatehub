// Checks req.body / req.query with a Zod schema. Bad data stops here with a 400 and a list of problems.
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import type { ZodType, z } from 'zod';
import { AppError, type FieldError } from '../utils/AppError.js';

export function toFieldErrors(issues: z.core.$ZodIssue[]): FieldError[] {
  return issues.map((issue) => ({ field: issue.path.map(String).join('.') || 'value', message: issue.message }));
}

/** Parse data with a schema or throw a 400 AppError with field errors */
export function parseOrThrow<T extends ZodType>(schema: T, data: unknown, message = 'Please fix the highlighted fields'): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new AppError(message, 400, { errors: toFieldErrors(result.error.issues) });
  return result.data;
}

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.body = parseOrThrow(schema, req.body ?? {});
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.validatedQuery = parseOrThrow(schema, req.query ?? {}, 'Invalid search options');
    next();
  };
}

/** Makes sure :id (or another route param) is a valid MongoDB ObjectId */
export function validateObjectId(param = 'id') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!mongoose.isValidObjectId(req.params[param])) throw new AppError(`Invalid ${param}`, 400);
    next();
  };
}
