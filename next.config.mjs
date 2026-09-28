import { withPayload } from "@payloadcms/next/withPayload";
export default withPayload({
  experimental: {
    serverActions: { bodySizeLimit: "14mb" },
    webpackMemoryOptimizations: true,
  },
  // Resolve status/redirect metadata before streaming an HTML response.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
});
