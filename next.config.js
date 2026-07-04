/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Use relative asset paths for static export so Electron file:// can load assets
  assetPrefix: './',
  // Ensure exported files use trailing slash where appropriate
  trailingSlash: true,
};

module.exports = nextConfig;
