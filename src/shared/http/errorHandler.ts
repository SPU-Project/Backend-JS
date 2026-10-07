import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "./AppError";
import { sendError } from "./response";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // If headers already sent, delegate to Express default error handler
  if (res.headersSent) {
    return next(err);
  }

  // 1. Domain/Application Error (AppError)
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.code, err.details);
    return;
  }

  // 2. Zod Validation Error
  if (err instanceof ZodError || err?.name === "ZodError" || Array.isArray(err?.issues)) {
    const issues = err.issues || err.errors || [];
    const formattedErrors = issues.map((e: any) => ({
      field: Array.isArray(e.path) ? e.path.join(".") : String(e.path || ""),
      message: e.message,
    }));
    sendError(
      res,
      422,
      "Validasi data masukan gagal.",
      "VALIDATION_ERROR",
      formattedErrors
    );
    return;
  }

  // 3. Sequelize Specific Errors
  if (err.name === "SequelizeUniqueConstraintError") {
    const fields = err.errors?.map((e: any) => e.path) || [];
    sendError(
      res,
      409,
      `Data duplikat: ${fields.join(", ")} sudah digunakan.`,
      "CONFLICT",
      { fields }
    );
    return;
  }

  if (err.name === "SequelizeValidationError") {
    const errors = err.errors?.map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    sendError(
      res,
      422,
      "Validasi database gagal.",
      "VALIDATION_ERROR",
      errors
    );
    return;
  }

  if (err.name === "SequelizeForeignKeyConstraintError") {
    sendError(
      res,
      400,
      "Relasi data tidak valid atau referensi data tidak ditemukan.",
      "FOREIGN_KEY_VIOLATION",
      { table: err.table, field: err.fields }
    );
    return;
  }

  // 4. Default / Unexpected Error (500)
  console.error("Unhandled Server Error:", err);
  const isDevOrTest = process.env.NODE_ENV !== "production";
  sendError(
    res,
    500,
    "Terjadi kesalahan internal pada server.",
    "INTERNAL_ERROR",
    isDevOrTest ? { message: err?.message, stack: err?.stack } : undefined
  );
};
