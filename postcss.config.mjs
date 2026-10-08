import tailwindcss from "@tailwindcss/postcss";

// Tailwind v4: plugin dirujuk sebagai modul (bukan string supaya aman di
// runtime ESM/PostCSS). Vite 7 menolak string plugin.
const config = {
	plugins: [tailwindcss()],
};

export default config;