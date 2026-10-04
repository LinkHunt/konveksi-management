// Buat 2 akun awal dari environment.
//   SEED_USER_USERNAME / SEED_USER_PASSWORD   -> pemakai harian
//   SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD -> admin/pengembang
//
// Create-if-missing: user yang sudah ada TIDAK pernah ditimpa. Jalankan ulang
// aman dan hanya menambahkan akun yang belum ada.
//
// Dijalankan lewat:  npm run seed

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hashPassword } from "../src/lib/auth-password.ts";

function getDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

type Akun = { username: string; password: string; peran: string };

async function main() {
  const akun: Akun[] = [
    {
      username: process.env.SEED_USER_USERNAME ?? "",
      password: process.env.SEED_USER_PASSWORD ?? "",
      peran: "pemakai",
    },
    {
      username: process.env.SEED_ADMIN_USERNAME ?? "",
      password: process.env.SEED_ADMIN_PASSWORD ?? "",
      peran: "admin",
    },
  ];

  const db = getDb();
  for (const a of akun) {
    if (!a.username || !a.password) {
      console.log(`- Lewati akun ${a.peran}: SEED_* untuk peran ini belum diisi.`);
      continue;
    }
    const ada = await db.user.findUnique({ where: { username: a.username } });
    if (ada) {
      console.log(`- ${a.username} sudah ada, tidak diubah.`);
      continue;
    }
    const passwordHash = await hashPassword(a.password);
    await db.user.create({ data: { username: a.username, passwordHash } });
    console.log(`- ${a.username} dibuat (peran ${a.peran}).`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed gagal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });