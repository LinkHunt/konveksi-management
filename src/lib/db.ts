// Client Prisma untuk aplikasi. Prisma 6 lewat driver adapter @prisma/adapter-neon
// karena runtime Cloudflare Workers tidak punya binding native Prisma.
//
// Sengaja TIDAK memakai singleton global: di Workers, instance bisa terbawa
// antar-request sehingga koneksi bisa menumpuk. Pola fungsi-fungsi ini yang
// dipakai README §11.

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

export function getDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}