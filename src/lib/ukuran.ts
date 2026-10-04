export const UKURAN_LIST = ['XS', 'S', 'M', 'L', 'XL', '2L', '3L', '5L', '8L'] as const;

export type Ukuran = (typeof UKURAN_LIST)[number];
