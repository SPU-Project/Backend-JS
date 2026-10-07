export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, code: string = "INTERNAL_ERROR", details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code: string = "BAD_REQUEST", details?: any): AppError {
    return new AppError(400, message, code, details);
  }

  static unauthorized(message: string = "Akses ditolak: Silakan login terlebih dahulu.", code: string = "UNAUTHORIZED"): AppError {
    return new AppError(401, message, code);
  }

  static forbidden(message: string = "Akses ditolak: Wewenang tidak memadai.", code: string = "FORBIDDEN"): AppError {
    return new AppError(403, message, code);
  }

  static notFound(message: string = "Resource tidak ditemukan.", code: string = "NOT_FOUND"): AppError {
    return new AppError(404, message, code);
  }

  static conflict(message: string, code: string = "CONFLICT", details?: any): AppError {
    return new AppError(409, message, code, details);
  }

  static unprocessable(message: string, code: string = "VALIDATION_ERROR", details?: any): AppError {
    return new AppError(422, message, code, details);
  }

  static internal(message: string = "Terjadi kesalahan pada server.", details?: any): AppError {
    return new AppError(500, message, "INTERNAL_ERROR", details);
  }
}
