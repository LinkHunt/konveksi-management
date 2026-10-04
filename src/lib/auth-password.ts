// Hash dan verifikasi password. Sengaja dipisah dari auth.ts supaya skrip CLI
// (prisma/seed.ts, prisma/ganti-password.ts) tidak ikut menarik next/headers.
//
// PBKDF2-HMAC-SHA256 lewat Web Crypto. Dipilih, bukan bcrypt, karena bcrypt
// butuh native binding yang tidak tersedia di Cloudflare Workers.
// 210.000 iterasi = rekomendasi OWASP untuk PBKDF2-HMAC-SHA256.
//
// Format: pbkdf2-sha256$<iterasi>$<base64 salt>$<base64 hash>

const PBKDF2_ITERASI = 210_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERASI,
      hash: "SHA-256",
    },
    key,
    HASH_BYTES * 8,
  );
  return `pbkdf2-sha256$${PBKDF2_ITERASI}$${bytesToB64(salt)}$${bytesToB64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const [algo, iterStr, saltB64, hashB64] = parts;
  if (algo !== "pbkdf2-sha256") return false;
  const iterations = Number.parseInt(iterStr, 10);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  try {
    const salt = b64ToBytes(saltB64);
    const expected = b64ToBytes(hashB64);
    if (expected.length === 0) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password) as BufferSource,
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
      key,
      expected.length * 8,
    );
    const actual = new Uint8Array(bits);
    if (actual.length !== expected.length) return false;
    let diff = 0; // perbandingan constant-time
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

/** Gambaran bentuk hash untuk log/tes. Tidak pernah mengembalikan sandi asli. */
export function ringkasHash(stored: string): string {
  const parts = stored.split("$");
  if (parts.length !== 4) return "format-tidak-dikenal";
  return `algo=${parts[0]} iterasi=${parts[1]} panjang=${stored.length}`;
}