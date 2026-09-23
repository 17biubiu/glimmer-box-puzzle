// Reintroduce known faults in an isolated bundle, never edit the working sources.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const cases = [
  {
    name: 'legacy access migration',
    file: 'game/core/storage.ts',
    before: 'if (original && Number(original[2]) <= Math.max(1, unlocked[level.pack] ?? 1)) accessible.add(level.id)',
    after: 'if (false) accessible.add(level.id)',
    assertion: 'legacy unlocked boards stay accessible',
  },
  {
    name: 'retired scores included',
    file: 'game/core/achievements.ts',
    before: "stars += levelsOfPack(p.id).reduce((acc, level) => acc + (save.stars[level.id] ?? 0), 0)",
    after: "stars += Object.entries(save.stars).filter(([id]) => id.startsWith(p.id + '-')).reduce((acc, [, value]) => acc + value, 0)",
    assertion: 'retired board scores',
  },
  {
    name: 'interrupted box tween',
    file: 'game/render/scene.ts',
    before: 'if (i !== pushedIndex) vis.group.position.copy(vis.target)',
    after: 'if (!movedDir) vis.group.position.copy(vis.target)',
    assertion: 'delayed box animation',
  },
  {
    name: 'unsafe storage getter',
    file: 'game/core/storage.ts',
    before: "return typeof window !== 'undefined'",
    after: "return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'",
    assertion: 'SecurityError',
  },
]
for (const fault of cases) {
  const source = readFileSync(fault.file, 'utf8')
  if (!source.includes(fault.before)) throw new Error(`Mutation target missing: ${fault.name}`)
  const outfile = '.tmp/regression-red.mjs'
  await build({
    entryPoints: ['scripts/regression-check.ts'], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
    plugins: [{
      name: 'regression-fault',
      setup(build) {
        build.onLoad({ filter: /\.ts$/ }, args => {
          if (!args.path.replaceAll('\\', '/').endsWith(fault.file)) return
          return { contents: source.replace(fault.before, fault.after), loader: 'ts' }
        })
      },
    }],
  })
  const result = spawnSync(process.execPath, [outfile], { encoding: 'utf8' })
  if (result.status === 0 || !result.stderr.includes(fault.assertion)) {
    console.error(result.stdout, result.stderr)
    throw new Error(`Regression did not reject the intended fault: ${fault.name}`)
  }
  console.log(`EXPECTED FAIL: ${fault.name}`)
}
