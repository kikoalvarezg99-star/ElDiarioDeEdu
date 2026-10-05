// Sitio estático (se publica en GitHub Pages y se empaqueta como APK).
// NEXT_PUBLIC_BASE_PATH lo pone el workflow de GitHub (p. ej. /ElDiarioDeEdu).
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: base,
};

export default nextConfig;
