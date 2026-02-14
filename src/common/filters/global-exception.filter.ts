import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    console.log(
      '🚀 ~ global-exception.filter.ts:15 ~ GlobalExceptionFilter ~ catch ~ exception:',
      exception,
    );

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ??
            exception.message);

      response.status(statusCode).json({
        success: false,
        statusCode,
        message,
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      response.status(statusCode).json({
        success: false,
        statusCode,
        message: 'Database error',
        code: exception.code,
      });
      return;
    }

    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError
    ) {
      const statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      response.status(statusCode).json({
        success: false,
        statusCode,
        message: 'Database error',
      });
      return;
    }

    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    response.status(statusCode).json({
      success: false,
      statusCode,
      message: 'Internal server error',
      path: request.url,
    });
  }
}
