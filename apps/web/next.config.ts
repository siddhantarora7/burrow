import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@burrow/core'],
  reactStrictMode: true,
  // a deploy installs apps/web alone, without vitest, so the build skips test/ (npm run typecheck still covers it)
  typescript: { tsconfigPath: 'tsconfig.build.json' },
}
export default config
