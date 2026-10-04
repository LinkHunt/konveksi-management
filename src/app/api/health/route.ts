// GET /api/health
//
// Pemeriksaan kesehatan publik (tanpa login) supaya uptime monitor bisa mem cek.
// Demi keamanan tidak membocorkan jumlah data, jadi hanya mengembalikan
// { ok: true } atau { ok: false }.

import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    // Query paling ringan untuk memastikan koneksi hidup.
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    // Pesan error sengaja tidak dikirim ke klien.
    return Response.json({ ok: false }, { status: 503 });
  }
}