import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';

function normalizeMessage(message: unknown): string | string[] {
  if (Array.isArray(message)) return message.map((m) => String(m));
  if (typeof message === 'string') return message;
  if (message == null) return 'Error';
  if (typeof message === 'number' || typeof message === 'boolean') {
    return String(message);
  }
  if (message instanceof Error) return message.message || 'Error';
  try {
    return JSON.stringify(message);
  } catch {
    return 'Error';
  }
}

function mapPrismaKnownError(error: Prisma.PrismaClientKnownRequestError) {
  switch (error.code) {
    case 'P2002':
      return { statusCode: HttpStatus.CONFLICT, code: 'DB_UNIQUE_CONSTRAINT' };
    case 'P2003':
      return {
        statusCode: HttpStatus.CONFLICT,
        code: 'DB_FOREIGN_KEY_CONSTRAINT',
      };
    case 'P2014':
      return { statusCode: HttpStatus.CONFLICT, code: 'DB_RELATION_VIOLATION' };
    case 'P2025':
    case 'P2001':
      return { statusCode: HttpStatus.NOT_FOUND, code: 'DB_RECORD_NOT_FOUND' };
    case 'P2000':
      return { statusCode: HttpStatus.BAD_REQUEST, code: 'DB_VALUE_TOO_LONG' };
    case 'P2011':
      return { statusCode: HttpStatus.BAD_REQUEST, code: 'DB_NULL_CONSTRAINT' };
    default:
      return { statusCode: HttpStatus.BAD_REQUEST, code: 'DB_REQUEST_ERROR' };
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    const timestamp = new Date().toISOString();
    const path = request.url;

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      let message: unknown = exception.message ?? 'Error';
      let code: string | undefined;
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const rec = res as Record<string, unknown>;
        if ('message' in rec) message = rec.message;
        if (typeof rec.code === 'string') code = rec.code;
      }

      httpAdapter.reply(
        ctx.getResponse(),
        {
          success: false,
          statusCode,
          code: code ?? `HTTP_${statusCode}`,
          timestamp,
          path,
          message: normalizeMessage(message),
        },
        statusCode,
      );
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = mapPrismaKnownError(exception);

      httpAdapter.reply(
        ctx.getResponse(),
        {
          success: false,
          statusCode: mapped.statusCode,
          timestamp,
          path,
          message: 'Database error',
          code: mapped.code,
          prismaCode: exception.code,
        },
        mapped.statusCode,
      );
      return;
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      httpAdapter.reply(
        ctx.getResponse(),
        {
          success: false,
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'DB_VALIDATION_ERROR',
          timestamp,
          path,
          message: 'Database validation error',
        },
        HttpStatus.BAD_REQUEST,
      );
      return;
    }

    if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      httpAdapter.reply(
        ctx.getResponse(),
        {
          success: false,
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: 'DB_UNAVAILABLE',
          timestamp,
          path,
          message: 'Database unavailable',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      return;
    }

    httpAdapter.reply(
      ctx.getResponse(),
      {
        success: false,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        timestamp,
        path,
        message: 'Internal server error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
