import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';

/**
 * Trả response cho lỗi Prisma/DB. Dùng từ AllExceptionsFilter trước khi rơi vào 500 chung.
 * (Global filter @Catch(Prisma...) dễ bị xử lý sau filter tổng quát nên không đáng tin.)
 */
export function sendPrismaExceptionResponse(
  exception: unknown,
  req: Request,
  res: Response,
): boolean {
  const isProd = process.env.NODE_ENV === 'production';

  if (exception instanceof Prisma.PrismaClientInitializationError) {
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: 503,
      error: 'Service Unavailable',
      message:
        'Không kết nối được cơ sở dữ liệu. Hãy bật MySQL và kiểm tra biến DATABASE_URL (file .env API).',
      path: req.url,
    });
    return true;
  }

  if (exception instanceof Prisma.PrismaClientValidationError) {
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: 400,
      error: 'Bad Request',
      message: isProd
        ? 'Yêu cầu không hợp lệ (Prisma validation). Kiểm tra migration/schema.'
        : exception.message,
      path: req.url,
    });
    return true;
  }

  if (
    exception instanceof Prisma.PrismaClientUnknownRequestError ||
    exception instanceof Prisma.PrismaClientRustPanicError
  ) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: isProd
        ? 'Lỗi truy vấn CSDL (Prisma không xử lý được). Xem nhật ký máy chủ.'
        : exception.message,
      path: req.url,
    });
    return true;
  }

  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  const code = exception.code;
  if (code === 'P1001' || code === 'P1017') {
    res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: 503,
      error: 'Service Unavailable',
      message:
        'Không kết nối được máy chủ cơ sở dữ liệu. Kiểm tra MySQL đang chạy và DATABASE_URL.',
      code,
      path: req.url,
    });
    return true;
  }
  if (code === 'P2002') {
    res.status(HttpStatus.CONFLICT).json({
      statusCode: 409,
      error: 'Conflict',
      message: 'Dữ liệu trùng (unique constraint).',
      code,
      meta: exception.meta,
      path: req.url,
    });
    return true;
  }
  if (code === 'P2021' || code === 'P2022') {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message:
        'Lỗi lược đồ cơ sở dữ liệu. Chạy: npx prisma migrate deploy (hoặc db push) trong thư mục apps/api.',
      code,
      path: req.url,
    });
    return true;
  }
  if (code === 'P2010') {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message:
        'Lỗi câu lệnh SQL/DB. Thường do DB chưa schema đúng hoặc cấp quyền tài khoản MySQL.',
      code,
      path: req.url,
    });
    return true;
  }
  res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
    statusCode: 500,
    error: 'Internal Server Error',
    message: 'Lỗi CSDL (Prisma).',
    code,
    meta: exception.meta,
    path: req.url,
  });
  return true;
}
