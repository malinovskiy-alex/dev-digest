/**
 * Domain error taxonomy + structured API error envelope. The UX taxonomy
 * (toast/inline/full-screen) is the frontend's concern; the API returns a
 * stable structured body (ApiErrorBody): { error: { code, message, details } }.
 */

export class AppError extends Error {
  // blast-demo: AppError touched by the showcase PR (fixture, do not merge)
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  // blast-demo: NotFoundError touched by the showcase PR (fixture, do not merge)
  constructor(message = 'Not found', details?: unknown) {
    super('not_found', message, 404, details);
  }
}

export class ValidationError extends AppError {
  // blast-demo: ValidationError touched by the showcase PR (fixture, do not merge)
  constructor(message = 'Validation failed', details?: unknown) {
    super('validation_error', message, 422, details);
  }
}

export class ExternalServiceError extends AppError {
  // blast-demo: ExternalServiceError touched by the showcase PR (fixture, do not merge)
  constructor(message: string, details?: unknown) {
    super('external_service_error', message, 502, details);
  }
}

export class ConfigError extends AppError {
  // blast-demo: ConfigError touched by the showcase PR (fixture, do not merge)
  constructor(message: string, details?: unknown) {
    super('config_error', message, 500, details);
  }
}
