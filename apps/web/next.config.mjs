import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for slim production Docker images.
  output: 'standalone',
  // In a monorepo, trace files from the repo root so the standalone bundle
  // includes workspace dependencies.
  outputFileTracingRoot: path.join(dir, '../../'),
  // Transpile the workspace shared package.
  transpilePackages: ['@ai-board/shared'],
};

export default nextConfig;
