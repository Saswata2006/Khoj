import type { NextConfig } from "next";

const rawCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const configuredCloudName =
  rawCloudName && /^[a-z0-9_-]+$/i.test(rawCloudName) ? rawCloudName : null;

const activeAssetEnv =
  process.env.VERCEL_ENV === "preview"
    ? "preview"
    : process.env.NODE_ENV === "production"
      ? "production"
      : "development";

const cloudinaryRemotePatterns = configuredCloudName
  ? [
      {
        protocol: "https" as const,
        hostname: "res.cloudinary.com",
        port: "",
        pathname: `/${configuredCloudName}/image/upload/*/khoj/${activeAssetEnv}/listings/**`,
        search: "",
      },
      {
        protocol: "https" as const,
        hostname: "res.cloudinary.com",
        port: "",
        pathname: `/${configuredCloudName}/image/upload/khoj/${activeAssetEnv}/listings/**`,
        search: "",
      },
    ]
  : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  serverExternalPackages: ["sharp"],
  images: {
    remotePatterns: cloudinaryRemotePatterns,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
