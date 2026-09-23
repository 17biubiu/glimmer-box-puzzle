import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

mkdirSync('.tmp', { recursive: true })
const entries = process.argv.includes('--levels') ? ['verify-levels'] : ['engine-check', 'regression-check']
for (const entry of entries) {
  const outfile = `.tmp/${entry}.mjs`
  await build({ entryPoints: [`scripts/${entry}.ts`], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' })
  const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
