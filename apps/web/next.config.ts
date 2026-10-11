import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@burrow/core'],
  reactStrictMode: true,
}
export default config
