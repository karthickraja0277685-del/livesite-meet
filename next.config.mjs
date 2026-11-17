/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode to catch common React bugs early during development.
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["adm-zip"]
  }
};

export default nextConfig;