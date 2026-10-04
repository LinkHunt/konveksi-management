// Ganti password satu user.
//
//   npm run ganti-password
//
// Meminta username dan password baru di terminal, hash dengan fungsi yang sama
// dengan login (PBKDF2-HMAC-SHA256), lalu update database.
// Password tidak pernah dicetak, tidak pernah jadi argumen perintah, dan tidak
// disimpan ke file.

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { emitKeypressEvents } from "node:readline";
import { hashPassword, ringkasHash } from "../src/lib/auth-password.ts";

function getDb(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi.");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

type KeyInfo = { name?: string; ctrl?: boolean; meta?: boolean; sequence?: string };

/**
 * Baca satu baris. Kalau sembunyi=true, karakter tidak diketik ke layar
 * (raw mode + suppress echo). Ctrl+C membatalkan.
 */
function tanya(prompt: string, sembunyi: boolean): Promise<string> {
  process.stdout.write(prompt);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const raw = Boolean(stdin.isTTY) && sembunyi;
    if (raw) stdin.setRawMode(true);
    stdin.resume();

    let buf = "";
    const selesai = () => {
      stdin.off("keypress", onKey);
      if (raw) stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(buf);
    };
    const onKey = (str: string | undefined, key: KeyInfo) => {
      if (key.ctrl && key.name === "c") {
        process.stdout.write("\n");
        process.exit(130);
      }
      const enter =
        key.name === "return" || key.name === "enter" || key.sequence === "\r" || key.sequence === "\n";
      if (enter) {
        selesai();
        return;
      }
      if (key.name === "backspace") {
        buf = buf.slice(0, -1);
        if (!sembunyi) process.stdout.write("\b \b");
        return;
      }
      if (str && !key.ctrl && !key.meta) {
        buf += str;
        if (!sembunyi) process.stdout.write(str);
      }
    };

    emitKeypressEvents(stdin);
    stdin.on("keypress", onKey);
  });
}

async function main() {
  const username = (await tanya("Username: ", false)).trim();
  if (!username) {
    console.log("Username wajib diisi. Batal.");
    process.exit(1);
  }

  const password = (await tanya("Password baru: ", true)).trim();
  const konfirmasi = (await tanya("Ulangi password baru: ", true)).trim();

  if (!password) {
    console.log("Password wajib diisi. Batal.");
    process.exit(1);
  }
  if (password !== konfirmasi) {
    console.log("Password tidak sama. Batal.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.log("Password minimal 8 karakter. Batal.");
    process.exit(1);
  }

  const db = getDb();
  const user = await db.user.findUnique({ where: { username } });
  if (!user) {
    console.log(`User "${username}" tidak ada. Password tidak diubah.`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });
  console.log(`Password untuk "${username}" diganti. (${ringkasHash(passwordHash)})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Ganti password gagal:", err instanceof Error ? err.message : err);
    process.exit(1);
  });