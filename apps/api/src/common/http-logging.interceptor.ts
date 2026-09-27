import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { finalize, Observable } from 'rxjs';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; originalUrl: string }>();
    const start = Date.now();
    return next
      .handle()
      .pipe(
        finalize(() => this.logger.log(`${req.method} ${req.originalUrl} ${Date.now() - start}ms`)),
      );
  }
}
