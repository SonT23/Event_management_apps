import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';

/**
 * Nhiều lỗi Prisma/DB bị gói thành 500 chung. Filter này trả mã 503/400 rõ hơn cho client & dev.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientInitializationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientInitializationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message:
          'Không kết nối được cơ sở dữ liệu. Hãy bật MySQL và kiểm tra biến DATABASE_URL (file .env API).',
        path: req.url,
      });
    }

    const code = exception.code;
    if (code === 'P1001' || code === 'P1017') {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: 503,
        error: 'Service Unavailable',
        message:
          'Không kết nối được máy chủ cơ sở dữ liệu. Kiểm tra MySQL đang chạy và DATABASE_URL.',
        code,
        path: req.url,
      });
    }
    if (code === 'P2002') {
      return res.status(HttpStatus.CONFLICT).json({
        statusCode: 409,
        error: 'Conflict',
        message: 'Dữ liệu trùng (unique constraint).',
        code,
        meta: (exception as Prisma.PrismaClientKnownRequestError).meta,
        path: req.url,
      });
    }
    if (code === 'P2021' || code === 'P2022') {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: 500,
        error: 'Internal Server Error',
        message:
          'Lỗi lược đồ cơ sở dữ liệu. Chạy: npx prisma migrate deploy (hoặc db push) trong thư mục apps/api.',
        code,
        path: req.url,
      });
    }
    if (code === 'P2010') {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: 500,
        error: 'Internal Server Error',
        message:
          'Lỗi câu lệnh SQL/DB. Thường do DB chưa schema đúng hoặc cấp quyền tài khoản MySQL.',
        code,
        path: req.url,
      });
    }
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Lỗi CSDL (Prisma).',
      code,
      meta: (exception as Prisma.PrismaClientKnownRequestError).meta,
      path: req.url,
    });
  }
}
