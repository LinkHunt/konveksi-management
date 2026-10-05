import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const DASAR =
  "w-full rounded-lg border border-garis-kuat bg-permukaan px-3 py-2.5 text-sm text-teks outline-none transition-colors placeholder:text-teks-sangat-lembut focus:border-aksen focus:ring-2 focus:ring-aksen-lembut disabled:bg-permukaan-2 disabled:text-teks-lembut";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${DASAR} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${DASAR} appearance-none pr-9 ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${DASAR} resize-y ${className}`} {...rest} />;
}

/** Input angka ringkas, dipakai di tabel ukuran yang sempit. */
export function NumberInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step={1}
      className={`${DASAR} px-2 py-2 text-center tabular-nums ${className}`}
      {...rest}
    />
  );
}

/** Label + elemen + pesan error, satu pola untuk semua form. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-teks">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-bahaya">{error}</p>
      ) : hint ? (
        <p className="text-xs text-teks-lembut">{hint}</p>
      ) : null}
    </div>
  );
}