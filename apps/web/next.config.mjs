/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile the workspace shared package.
  transpilePackages: ['@ai-board/shared'],
};

export default nextConfig;
