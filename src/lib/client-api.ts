"use client";

/*
 * Client-side API helper.
 *
 * Server selalu membalas `{ error: "pesan Indonesia" }` dan tidak pernah
 * mengirim pesan asli ke klien (lihat src/lib/api.ts), jadi `error` aman
 * ditampilkan langsung. Isi `detail` sengaja TIDAK ikut ke user; tapi tetap
 * dibawa di objek error supaya bisa diperiksa saat debugging.
 */

export type ApiGagal = Error & {
  status: number;
  detail?: unknown;
};

export type Hasil<T> = { ok: true; data: T } | { ok: false; error: ApiGagal };

/** Bentuk error yang mungkin dikirim server: `{ error, detail? }`. */
type BodyErr = { error?: unknown; detail?: unknown };

function jsonUnknown(v: unknown): BodyErr {
  return typeof v === "object" && v !== null ? (v as BodyErr) : {};
}

async function minta<T>(url: string, init?: RequestInit): Promise<Hasil<T>> {
  try {
    const res = await fetch(url, init);
    // res.json() bertipe any, tapi jsonUnknown() memaksa perlakukan sebagai
    // unknown supaya akses field-nya harus dicek dulu, bukan diandalkan diam-diam.
    const body = jsonUnknown(await res.json().catch(() => null));
    if (!res.ok) {
      const pesan =
        typeof body.error === "string" && body.error
          ? body.error
          : `Terjadi kesalahan (${res.status}).`;
      const err = new Error(pesan) as ApiGagal;
      err.status = res.status;
      err.detail = body.detail;
      return { ok: false, error: err };
    }
    return { ok: true, data: body as unknown as T };
  } catch {
    return {
      ok: false,
      error: Object.assign(new Error("Tidak bisa menghubungi server."), { status: 0 }),
    };
  }
}

function kirim(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function ambil<T>(url: string): Promise<Hasil<T>> {
  return minta<T>(url);
}

export async function buat<T>(url: string, body: unknown): Promise<Hasil<T>> {
  return minta<T>(url, kirim("POST", body));
}

export async function ubah<T>(url: string, method: "PUT" | "PATCH", body: unknown): Promise<Hasil<T>> {
  return minta<T>(url, kirim(method, body));
}

export async function hapus<T>(url: string): Promise<Hasil<T>> {
  return minta<T>(url, { method: "DELETE" });
}

/**
 * Ambil daftar master untuk form. Semua dropdown di app ini memakai sumber
 * yang sama supaya tidak ada fetch yang terduplikasi.
 *
 * `semua: true` ikut mengambil master nonaktif. Ini dibutuhkan form koreksi:
 * kontrak API membolehkan transaksi lama tetap memakai master yang sudah
 * dinonaktifkan selama nilainya tidak berubah, jadi master itu harus tetap
 * selectable. Kalau form edit cuma menampilkan master aktif, transaksi yang
 * memakai master nonaktif jadi tidak bisa disimpan sama sekali.
 */
export type BarisBasic = { id: number; nama: string; aktif: boolean };
export type BarisModel = BarisBasic & { pemilikId: number; pemilik: { id: number; nama: string } };

export async function ambilMaster<T extends BarisBasic>(
  entity: string,
  opts: { semua?: boolean } = {},
): Promise<Hasil<T[]>> {
  const qs = opts.semua ? "?semua=1" : "";
  const r = await minta<{ data: T[] }>(`/api/master/${entity}${qs}`);
  return r.ok ? { ok: true as const, data: r.data.data } : r;
}