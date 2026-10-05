"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const DASAR =
  "rounded-lg border border-garis-kuat bg-permukaan px-3 py-2.5 text-base text-teks outline-none transition-colors placeholder:text-teks-sangat-lembut focus:border-aksen focus:ring-2 focus:ring-aksen-lembut";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Login gagal.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-aksen text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 3 3 6l6 6 3-3m6 0 3 3-6 6-3-3m0 0-6 6M9 15l6-6" />
          </svg>
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Management Konveksi</h1>
        <p className="mt-0.5 text-sm text-teks-lembut">Masuk untuk melanjutkan.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>Username</span>
          <input
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            className={DASAR}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span>Password</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className={DASAR}
          />
        </label>

        {error ? (
          <p role="alert" className="rounded-lg bg-bahaya-lembut px-3 py-2.5 text-sm text-bahaya">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-aksen px-3 py-3 text-base font-medium text-white transition-colors hover:bg-aksen-gelap disabled:opacity-60"
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}