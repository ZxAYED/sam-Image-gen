import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        if (body && typeof body === 'object' && 'success' in body) {
          return body;
        }

        if (
          body &&
          typeof body === 'object' &&
          ('data' in body || 'meta' in body)
        ) {
          return { success: true, ...(body as Record<string, unknown>) };
        }

        return { success: true, data: body };
      }),
    );
  }
}
