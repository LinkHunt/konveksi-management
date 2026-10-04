import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const total = await db.boss.count();
  return Response.json({ ok: true, boss: total });
}
