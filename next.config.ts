import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          // camera=(self): the /scanner surface captures QR codes through the
          // device camera (same-origin). A blanket camera=() would deny the
          // scanner's own getUserMedia at the browser policy layer.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" }
        ]
      }
    ]
  }
}

export default nextConfig
