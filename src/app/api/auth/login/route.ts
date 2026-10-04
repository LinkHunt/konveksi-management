// POST /api/auth/login
// Body: { username, password }
// Sukses: 200 { user: { id, username } } + Set-Cookie session
// Gagal: selalu 401 dengan pesan generik (tidak membocorkan apakah username ada)

import { z } from "zod";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handle, jsonOk, jsonError, fromPrismaError } from "@/lib/api";
import { readJson } from "@/lib/request";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi.").max(120),
  password: z.string().min(1, "Password wajib diisi.").max(200),
});

const PESAN_GAGAL = "Username atau password salah.";

export async function POST(request: Request) {
  return handle(async () => {
    const body = loginSchema.safeParse(await readJson(request));
    if (!body.success) {
      return jsonError(400, "Username dan password wajib diisi.");
    }

    const db = getDb();
    let user: { id: number; username: string; passwordHash: string } | null = null;
    try {
      user = await db.user.findUnique({
        where: { username: body.data.username },
        select: { id: true, username: true, passwordHash: true },
      });
    } catch (err) {
      return fromPrismaError(err);
    }

    // Selalu jalankan verifikasi, walau user tidak ada, supaya waktu respons
    // tidak membocorkan username mana yang terdaftar.
    const stored = user?.passwordHash ?? "pbkdf2-sha256$210000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const ok = await verifyPassword(body.data.password, stored);

    if (!user || !ok) {
      return jsonError(401, PESAN_GAGAL);
    }

    await setSessionCookie(user.id, user.username);
    return jsonOk({ user: { id: user.id, username: user.username } });
  });
}