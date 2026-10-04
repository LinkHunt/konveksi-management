// Format error konsisten untuk semua route: { error: "pesan Indonesia singkat", detail?: ... }
// Stack trace dan pesan Prisma mentah tidak pernah dikirim ke klien.

import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorBody = {
  error: string;
  detail?: unknown;
};

/** Error yang sudah membawa status dan pesan sendiri. */
export class ApiError extends Error {
  status: number;
  detail?: unknown;
  constructor(status: number, error: string, detail?: unknown) {
    super(error);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
  toResponse(): NextResponse {
    return jsonError(this.status, this.message, this.detail);
  }
}

export const badRequest = (msg: string, detail?: unknown) => new ApiError(400, msg, detail);
export const unauthorized = (msg = "Belum login.") => new ApiError(401, msg);
export const forbidden = (msg: string) => new ApiError(403, msg);
export const notFound = (msg = "Data tidak ditemukan.") => new ApiError(404, msg);
export const conflict = (msg: string, detail?: unknown) => new ApiError(409, msg, detail);
export const serverError = (msg = "Terjadi kesalahan di server.") => new ApiError(500, msg);

export function jsonOk<T>(data: T) {
  return NextResponse.json(data as object, { status: 200 });
}

export function jsonError(status: number, error: string, detail?: unknown) {
  const body: ApiErrorBody = detail === undefined ? { error } : { error, detail };
  return NextResponse.json(body, { status });
}

/** Prisma error dipetakan ke status + pesan Indonesia; detail mentah disembunyikan. */
export function fromPrismaError(err: unknown): NextResponse {
  const e = err as { code?: string; meta?: { target?: unknown } };
  switch (e?.code) {
    case "P2002":
      return jsonError(409, "Data sudah ada, nama atau kombinasi field sudah dipakai.", {
        fields: e.meta?.target,
      });
    case "P2003":
      return jsonError(400, "Data masih dipakai transaksi lain, tidak bisa diubah.");
    case "P2025":
      return jsonError(404, "Data tidak ditemukan.");
    default:
      return jsonError(500, "Terjadi kesalahan di server.");
  }
}

/** Pesan validasi zod jadi daftar field yang enak dibaca. */
export function fromZodError(err: ZodError): NextResponse {
  return jsonError(400, "Data yang dikirim tidak valid.", {
    issues: err.issues.map((i) => ({
      field: i.path.join(".") || "(akar)",
      pesan: i.message,
    })),
  });
}

function isPrismaError(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  return typeof code === "string" && /^P\d{4}$/.test(code);
}

/**
 * Bungkus handler. Semua error tak terduga jadi 500 dengan pesan generik;
 * pesan asli hanya ditulis ke log server, tidak pernah ke klien.
 */
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return err.toResponse();
    if (err instanceof ZodError) return fromZodError(err);
    if (err instanceof Response) return new NextResponse(err.body, err);
    if (isPrismaError(err)) return fromPrismaError(err);
    const name = (err as { name?: string })?.name;
    if (name === "SessionRequiredError") return jsonError(401, "Belum login.");
    if (name === "UkuranTidakValidError") {
      return jsonError(400, "Ukuran tidak dikenal. Pilihan: XS, S, M, L, XL, 2L, 3L, 5L, 8L.");
    }
    console.error("[api] error tak tertangani:", err);
    return jsonError(500, "Terjadi kesalahan di server.");
  }
}