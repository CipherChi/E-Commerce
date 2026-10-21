export class HttpError extends Error {
  readonly response: unknown;
  constructor(readonly status: number, readonly body: unknown, message: string) {
    super(message);
    this.response = body;
    this.name = new.target.name;
  }
  getStatus() { return this.status; }
  getResponse() { return this.body; }
}

function createException(name: string, status: number, label: string) {
  return class extends HttpError {
    constructor(response?: string | object) {
      const body = typeof response === 'string'
        ? { statusCode: status, message: response, error: label }
        : response ?? { statusCode: status, message: label, error: label };
      super(status, body, typeof response === 'string' ? response : label);
      this.name = name;
    }
  };
}

export const BadRequestException = createException('BadRequestException', 400, 'Bad Request');
export const UnauthorizedException = createException('UnauthorizedException', 401, 'Unauthorized');
export const ForbiddenException = createException('ForbiddenException', 403, 'Forbidden');
export const NotFoundException = createException('NotFoundException', 404, 'Not Found');
export const ConflictException = createException('ConflictException', 409, 'Conflict');
export const UnprocessableEntityException = createException('UnprocessableEntityException', 422, 'Unprocessable Entity');
export const ServiceUnavailableException = createException('ServiceUnavailableException', 503, 'Service Unavailable');
