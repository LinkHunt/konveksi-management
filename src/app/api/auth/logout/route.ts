// POST /api/auth/logout
// Menghapus cookie session. Sukses: 200 { ok: true }
// Tidak butuh login: idempotent, logout dari sesi mana pun tetap 200.

import { clearSessionCookie } from "@/lib/auth";
import { handle, jsonOk } from "@/lib/api";
import { assertSameOrigin } from "@/lib/request";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    await clearSessionCookie();
    return jsonOk({ ok: true });
  });
}