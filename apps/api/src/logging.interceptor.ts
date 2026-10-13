import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(`${method} ${url} ${duration}ms`);
          this.metrics.incrementRequest(url, duration);
        },
        error: (err: unknown) => {
          const duration = Date.now() - start;
          this.logger.error(
            `${method} ${url} ${duration}ms — ERROR: ${err instanceof Error ? err.message : String(err)}`,
          );
          this.metrics.incrementRequest(url, duration);
          this.metrics.incrementError();
        },
      }),
    );
  }
}
