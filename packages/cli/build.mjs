import { build } from 'esbuild'

const common = { bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'info' }
await build({ ...common, entryPoints: ['src/cli.ts'], outfile: 'dist/cli.mjs', banner: { js: '#!/usr/bin/env node' } })
await build({ ...common, entryPoints: ['src/hook-entry.ts'], outfile: 'dist/burrow-hook.mjs' })
