// Kesalahan aplikasi + pembungkus pesan Indonesia, tanpa Next/server.
// Semua mutasi bisnis melempar error dengan `pesan` yang aman ditampilkan ke
// user. Tidak ada stack mentah/Prisma ke UI.

export class ApiError extends Error {
  status: number;
  detail?: unknown;
  constructor(status: number, error: string, detail?: unknown) {
    super(error);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export const badRequest = (msg: string, detail?: unknown) => new ApiError(400, msg, detail);
export const notFound = (msg = "Data tidak ditemukan.") => new ApiError(404, msg);
export const conflict = (msg: string, detail?: unknown) => new ApiError(409, msg, detail);

/** Ambil pesan error yang aman ditampilkan; default pesan generik. */
export function pesanError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Terjadi kesalahan.";
}