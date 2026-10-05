"use client";

import { useEffect } from "react";
import { Button } from "./Button";

/*
 * Dialog konfirmasi untuk aksi yang tidak bisa dibatalkan, terutama hapus
 * transaksi. Menghapus transaksi mengubah angka sisa, jadi harus ada layar
 * konfirmasi yang menyebut efeknya, bukan cuma "Yakin?".
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Hapus",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    // Cegah halaman di belakang ikut geser saat dialog terbuka.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-teks/25 p-4 sm:items-center"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-xl border border-garis bg-permukaan p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-1.5 text-sm text-teks-lembut">{message}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Batal
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Memproses..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}