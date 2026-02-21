import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    constructor(private readonly metrics: MetricsService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const { method, url } = req;
        const start = Date.now();

        return next.handle().pipe(
            tap({
                next: () => {
                    const duration = Date.now() - start;
                    this.logger.log(`${method} ${url} ${duration}ms`);
                    this.metrics.incrementRequest(url, duration);
                },
                error: (err) => {
                    const duration = Date.now() - start;
                    this.logger.error(`${method} ${url} ${duration}ms — ERROR: ${err.message}`);
                    this.metrics.incrementRequest(url, duration);
                    this.metrics.incrementError();
                },
            }),
        );
    }
}
