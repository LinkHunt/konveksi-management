// Penjaga bersama untuk route handler: session, CSRF, dan parsing body.

import { NextResponse } from "next/server";
import { requireSession, type SessionUser } from "./auth";
import { ApiError, jsonError } from "./api";

/**
 * Pengecekan CSRF sederhana: request yang mengubah data harus punya header
 * Origin yang sama dengan host aplikasi. Request tanpa Origin (mis. curl,
 * tool CLI) diizinkan agar smoke test dan skrip CLI tetap bisa jalan; cookie
 * sudah dilindungi sameSite=lax sehingga browser lintas situs tidak akan
 * mengirimnya pada POST lintas situs.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host");
  if (!host) return;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(400, "Header Origin tidak valid.");
  }
  if (originHost !== host) {
    throw new ApiError(403, "Permintaan ditolak karena asal tidak cocok.");
  }
}

/** Ensure login sudah sah. Lempar ApiError(401) bila belum. */
export async function guardSession(): Promise<SessionUser> {
  try {
    return await requireSession();
  } catch (err) {
    if (err instanceof Error && err.name === "SessionRequiredError") {
      throw new ApiError(401, "Belum login.");
    }
    // SESSION_SECRET belum diisi = kesalahan konfigurasi server, bukan 401.
    throw err;
  }
}

/** Pour route yang butuh session + proteksi CSRF, return user kalau lolos. */
export async function guardMutation(request: Request): Promise<SessionUser> {
  assertSameOrigin(request);
  return guardSession();
}

/** Baca body JSON; kalau tidak valid lempar 400, bukan diam-diam lolos. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Body harus berupa JSON yang valid.");
  }
}

/** Query param integer dengan batas. Return undefined bila tidak ada / tidak valid. */
export function intParam(
  url: URL,
  name: string,
  opts: { min?: number; max?: number } = {},
): number | undefined {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    throw new ApiError(400, `Parameter ${name} harus angka bulat.`);
  }
  if (opts.min !== undefined && n < opts.min) {
    throw new ApiError(400, `Parameter ${name} minimal ${opts.min}.`);
  }
  if (opts.max !== undefined && n > opts.max) {
    throw new ApiError(400, `Parameter ${name} maksimal ${opts.max}.`);
  }
  return n;
}

export { jsonError, NextResponse };