import { build } from 'esbuild'

// The published CLI talks to production; local builds talk to the dev servers. BURROW_PUBLISH_API and
// BURROW_PUBLISH_WEB bake the defaults in (env vars and --api/--web still override at run time).
const api = process.env.BURROW_PUBLISH_API ?? 'http://127.0.0.1:8787'
const web = process.env.BURROW_PUBLISH_WEB ?? 'http://localhost:3000'
if (process.env.npm_lifecycle_event === 'prepublishOnly' && (/localhost|127\.0\.0\.1/.test(api + web)))
  throw new Error('refusing to publish with local defaults: set BURROW_PUBLISH_API and BURROW_PUBLISH_WEB')

const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'info' }
await build({
  ...common, entryPoints: ['src/cli.ts'], outfile: 'dist/cli.mjs', banner: { js: '#!/usr/bin/env node' },
  define: { __BURROW_API__: JSON.stringify(api), __BURROW_WEB__: JSON.stringify(web) },
})
await build({ ...common, entryPoints: ['src/hook-entry.ts'], outfile: 'dist/burrow-hook.mjs' })
