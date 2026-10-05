import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
};

/*
 * Aksen biru hanya dipakai varian `primary`, dan hanya untuk satu aksi utama
 * per halaman. Kalau semua tombol biru, tidak ada yang menonjol.
 */
const VARIANT: Record<Variant, string> = {
  primary: "bg-aksen text-white hover:bg-aksen-gelap border-transparent",
  secondary: "bg-permukaan text-teks hover:bg-permukaan-2 border-garis-kuat",
  ghost: "bg-transparent text-teks-lembut hover:bg-permukaan-2 border-transparent",
  danger: "bg-permukaan text-bahaya hover:bg-bahaya-lembut border-garis-kuat",
};

const SIZE: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm rounded-lg gap-1.5",
  md: "px-3.5 py-2.5 text-sm rounded-lg gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center border font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-aksen focus-visible:ring-offset-2 focus-visible:ring-offset-latar disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}