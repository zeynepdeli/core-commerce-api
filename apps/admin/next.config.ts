import path from "node:path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// OWASP A05 – Güvenlik yapılandırması.
// Not: script-src içeren tam bir CSP için Next.js'te nonce gerekir
// (middleware/proxy ile). Buradaki CSP Next'i bozmadan uygulanabilen
// güvenli bir taban seviyedir.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Admin paneli arama motorlarında indekslenmesin
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Docker için küçük, bağımsız çıktı (.next/standalone)
  output: "standalone",
  // Monorepo: bağımlılıklar kök node_modules'ta
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Varsayılan 1 MB. Görsel yükleme için API sınırının (5 MB)
      // biraz üstü; daha büyük istekler sunucuya hiç ulaşmaz.
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
