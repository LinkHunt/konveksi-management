import type { ReactNode } from "react";

/*
 * Tabel responsif yang bisa dibungkus scroll di layar sempit.
 *
 * Transaksi punya 9 ukuran, jadi di layar HP tabel tidak muat. Alih-alih
 * memampatkan semua kolom (bikin Medianya 20px dan tidak terklik), tabel tetap
 * punya lebar natural dan wadahnya yang bisa digeser ke samping.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="min-w-max">{children}</div>
    </div>
  );
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <table className={`w-full border-collapse text-sm ${className}`}>{children}</table>
  );
}

export function Th({
  children,
  className = "",
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-garis-kuat px-3 py-2 text-xs font-semibold uppercase tracking-wide text-teks-lembut ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
  align = "left",
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-garis px-3 py-2.5 align-middle ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <Td colSpan={colSpan} align="center" className="py-10 text-teks-lembut">
        {message}
      </Td>
    </tr>
  );
}