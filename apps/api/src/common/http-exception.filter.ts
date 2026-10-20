import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = (request as Request & { requestId?: string }).requestId;
    const routePath = (request as Request & { route?: { path?: string | RegExp } }).route?.path;
    const logPath =
      typeof routePath === 'string' ? `${request.baseUrl}${routePath}` : 'unmatched';
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    if (status >= 500)
      this.logger.error(
        JSON.stringify({
          event: 'http_exception',
          requestId: requestId ?? null,
          method: request.method,
          path: logPath,
          statusCode: status,
        }),
        exception instanceof Error ? exception.stack : undefined,
      );
    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: requestId ?? null,
    });
  }
}
