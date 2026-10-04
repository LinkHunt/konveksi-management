// Session cookie bertanda tangan HMAC-SHA256 (crypto.subtle) memakai
// SESSION_SECRET. Isi token: base64url(payload JSON) + "." + base64url(signature).
// httpOnly, sameSite=lax, secure saat production, masa berlaku 7 hari.
//
// Modul password ada terpisah di auth-password.ts supaya skrip CLI tidak ikut
// menarik next/headers.

import { cookies } from "next/headers";
import { getDb } from "./db";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari
const COOKIE_NAME = "konveksi_session";

export { hashPassword, verifyPassword, ringkasHash } from "./auth-password";

type SessionPayload = {
  uid: number;
  username: string;
  exp: number; // detik sejak epoch
};

export type SessionUser = { id: number; username: string };

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(b64url: string): Uint8Array {
  const s = atob(b64url.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET belum diisi di environment.");
  return new TextEncoder().encode(secret);
}

async function hmac(data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    getSecret() as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data as BufferSource));
}

export async function createSessionToken(uid: number, username: string): Promise<string> {
  const payload: SessionPayload = {
    uid,
    username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmac(new TextEncoder().encode(body));
  return `${body}.${bytesToB64url(sig)}`;
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  try {
    const expected = await hmac(new TextEncoder().encode(body));
    const actual = b64urlToBytes(token.slice(dot + 1));
    if (actual.length !== expected.length) return null;
    let diff = 0; // constant-time
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
    if (diff !== 0) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as SessionPayload;
    if (typeof payload?.uid !== "number" || typeof payload?.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Baca cookie session. Null bila tidak ada, rusak, atau kedaluwarsa. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await readSessionToken(token);
  return payload ? { id: payload.uid, username: payload.username } : null;
}

export class SessionRequiredError extends Error {
  constructor() {
    super("Belum login.");
    this.name = "SessionRequiredError";
  }
}

/** Session yang sudah diverifikasi terhadap database. Lempar SessionRequiredError bila tidak sah. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new SessionRequiredError();
  const user = await getDb().user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true },
  });
  if (!user) throw new SessionRequiredError();
  return user;
}

export async function setSessionCookie(uid: number, username: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, await createSessionToken(uid, username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}