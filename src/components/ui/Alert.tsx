import type { ReactNode } from "react";

type Tone = "info" | "error" | "success" | "warning";

const TONE: Record<Tone, string> = {
  info: "bg-aksen-lembut border-aksen-garis text-aksen-gelap",
  error: "bg-bahaya-lembut border-bahaya/25 text-bahaya",
  success: "bg-sukses-lembut border-sukses/25 text-sukses",
  warning: "bg-peringatan-lembut border-peringatan/25 text-peringatan",
};

/*
 * Pesan error dari server sudah berbahasa Indonesia dan aman ditampilkan
 * langsung ke user (lihat docs/API.md). Yang TIDAK pernah ditampilkan adalah
 * isi `detail` mentah.
 */
export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2.5 text-sm ${TONE[tone]}`}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-garis bg-permukaan p-4 ${className}`}>{children}</section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-teks-lembut">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}