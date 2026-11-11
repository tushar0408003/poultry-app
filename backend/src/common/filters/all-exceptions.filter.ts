import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { DecimalFormatError } from '../money';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Converts every error into one predictable JSON shape and never leaks stack
 * traces or driver internals to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const { status, message } = this.resolve(exception);
    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception));
    }

    const body: ErrorBody = {
      statusCode: status,
      error: HttpStatus[status] ?? 'ERROR',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }

  private resolve(exception: unknown): { status: number; message: string | string[] } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      return { status: exception.getStatus(), message };
    }
    if (exception instanceof DecimalFormatError || exception instanceof RangeError) {
      return { status: HttpStatus.BAD_REQUEST, message: exception.message };
    }
    if (exception instanceof MongooseError.CastError) {
      return { status: HttpStatus.BAD_REQUEST, message: `Invalid value for ${exception.path}` };
    }
    if (exception instanceof MongooseError.ValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: Object.values(exception.errors).map((e) => e.message) };
    }
    if (isDuplicateKeyError(exception)) {
      const field = Object.keys(exception.keyPattern ?? {})[0] ?? 'value';
      return { status: HttpStatus.CONFLICT, message: `A record with this ${field} already exists` };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Something went wrong. Please try again.' };
  }
}

function isDuplicateKeyError(e: unknown): e is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 11000;
}
