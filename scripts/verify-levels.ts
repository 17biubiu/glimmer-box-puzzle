import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LEVELS, levelsOfPack } from '../game/core/levels'
import { PACKS } from '../game/core/types'
import { parseXsbSetLevels } from '../game/core/xsb-parser'
import { levelHash, solveLevel } from './levelgen-lib'

const seen = new Set<string>()
assert.equal(LEVELS.length, 155)
for (const meta of LEVELS) {
  const chunks = parseXsbSetLevels(readFileSync(`public${meta.file}`, 'utf8'))
  assert.equal(chunks.length, 1)
  const level = chunks[0]!.level
  const hash = levelHash(level)
  assert.ok(!seen.has(hash), `equivalent duplicate: ${meta.id}`)
  seen.add(hash)
  const solved = solveLevel(level, 600_000, 15_000)
  assert.ok(solved, `unsolved or over budget: ${meta.id}`)
  assert.equal(solved.pushes, meta.minPushes, meta.id)
  assert.equal(solved.moves, meta.solutionMoves, meta.id)
  assert.ok(meta.par! >= solved.moves, `unreachable three-star target: ${meta.id}`)
}
for (const pack of PACKS) {
  const rows = levelsOfPack(pack.id)
  rows.forEach((row, i) => { if (i) assert.ok(row.challenge! >= rows[i - 1]!.challenge!) })
  console.log(`PASS ${pack.id}: ${rows.length} boards, difficulty ${rows[0]!.challenge}-${rows.at(-1)!.challenge}`)
}
console.log(`PASS all ${seen.size} levels: solvable, unique under rotation/reflection, reachable star targets, ordered difficulty`)
