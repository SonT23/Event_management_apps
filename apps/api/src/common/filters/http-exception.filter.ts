import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendPrismaExceptionResponse } from './prisma-exception.filter';

/**
 * Bắt mọi ngoại lệ chưa xử lý: trả JSON thống nhất, không lộ stack ra client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isProd = process.env.NODE_ENV === 'production';

    if (sendPrismaExceptionResponse(exception, req, res)) {
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const errBody = exception.getResponse();
      const message =
        typeof errBody === 'string'
          ? errBody
          : typeof errBody === 'object' &&
              errBody !== null &&
              'message' in errBody
            ? (errBody as { message: string | string[] }).message
            : errBody;
      const msg = Array.isArray(message) ? message.join(', ') : String(message);
      return res.status(status).json({
        statusCode: status,
        error: exception.name,
        message: msg,
        path: req.url,
        timestamp: new Date().toISOString(),
      });
    }

    this.log.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception),
    );
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: isProd
        ? 'An unexpected error occurred'
        : (exception as Error).message,
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
