import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { computed, shallowRef } from 'vue'
import { loadSave, recordClear, saveAll, isLevelUnlocked } from '../game/core/storage'
import { PETS, PACKS } from '../game/core/types'
import { levelsOfPack, findLevel, nextLevel } from '../game/core/levels'
import { parseXsbSetLevels, parseXsb } from '../game/core/xsb-parser'
import { buildPet, posePet, disposeObject } from '../game/render/pets'
import { levelHash } from './levelgen-lib'
import { overallProgress } from '../game/core/achievements'
import { GameScene } from '../game/render/scene'
import { SokobanEngine } from '../game/core/engine'

let passed = 0
function test(name: string, body: () => void) {
  try {
    body()
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
  passed++
  console.log(`PASS ${name}`)
}
let stored: string | null = null
const mockWindow = { localStorage: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value } } }
Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true })

test('legacy save gains independent food balances without losing progress', () => {
  stored = JSON.stringify({ stars: { 'tutorial-1': 3 }, pet: 'dog', muted: true })
  const save = loadSave()
  assert.equal(save.stars['tutorial-1'], 3)
  assert.equal(save.pet, 'dog')
  assert.equal(save.muted, true)
  assert.deepEqual(save.food, { cat: 0, dog: 0, rabbit: 0, lizard: 0 })
})

test('corrupt save fields cannot select an unknown pet or create invalid counters', () => {
  stored = JSON.stringify({ pet: 'dragon', food: { cat: -1, dog: '9' }, stars: { a: 999, b: 2 }, best: { a: null, b: { moves: -1, pushes: 3 } } })
  const save = loadSave()
  assert.equal(save.pet, 'cat')
  assert.equal(save.food.cat, 0)
  assert.equal(save.food.dog, 0)
  assert.deepEqual(save.stars, { b: 2 })
  assert.deepEqual(save.best, {})
})

test('first clear, replay, star upgrade and pet switch reward exactly once', () => {
  stored = null
  const save = loadSave()
  assert.equal(recordClear(save, 'tutorial-1', 'tutorial', 1, 1, 10, 1), 1)
  assert.equal(recordClear(save, 'tutorial-1', 'tutorial', 1, 1, 10, 1), 0)
  assert.equal(recordClear(save, 'tutorial-1', 'tutorial', 1, 3, 1, 1), 2)
  assert.equal(save.food.cat, 3)
  assert.equal(recordClear(save, 'tutorial-1', 'tutorial', 1, 2, 4, 1), 0)
  save.pet = 'rabbit'
  assert.equal(recordClear(save, 'tutorial-1', 'tutorial', 1, 3, 1, 1), 3)
  assert.equal(save.food.rabbit, 3)
  assert.equal(save.food.dog, 0)
  assert.deepEqual(loadSave(), save)
})

test('blocked localStorage getter does not crash load or clear', () => {
  Object.defineProperty(globalThis, 'window', { value: { get localStorage() { throw new Error('SecurityError') } }, configurable: true })
  const save = loadSave()
  assert.doesNotThrow(() => saveAll(save))
  assert.equal(recordClear(save, 'tutorial-1', 'tutorial', 1, 3, 1, 1), 3)
  Object.defineProperty(globalThis, 'window', { value: mockWindow, configurable: true })
})

test('reward receipts repair corrupt balances without accumulating duplicate food', () => {
  stored = JSON.stringify({ food: { cat: Number.MAX_SAFE_INTEGER }, rewarded: { 'cat:tutorial-1': 3 } })
  let save = loadSave()
  assert.equal(save.food.cat, 3)
  assert.equal(recordClear(save, 'tutorial-1', 'tutorial', 1, 3, 1, 1), 0)
  stored = JSON.stringify({ food: { cat: 3 }, rewarded: { 'cat:tutorial-1': '3' } })
  save = loadSave()
  assert.equal(save.food.cat, 0)
  recordClear(save, 'tutorial-1', 'tutorial', 1, 3, 1, 1)
  assert.equal(save.food.cat, 3)
})

test('legacy unlocked boards stay accessible by identity after curriculum reorder', () => {
  stored = JSON.stringify({ unlocked: { easy: 2 }, stars: { 'easy-1': 3 } })
  const save = loadSave()
  const rows = levelsOfPack('easy')
  const oldSecond = rows.find(level => level.id === 'easy-2')!
  assert.notEqual(oldSecond.num, 2)
  assert.equal(isLevelUnlocked(save, 'easy', oldSecond.num, n => rows[n - 1]!.id), true)
  assert.ok(!save.accessible.includes('hard-39-r2'))
  saveAll(save)
  assert.deepEqual(loadSave().accessible, save.accessible)
})

test('retired board scores cannot exceed current total stars', () => {
  stored = null
  const save = loadSave()
  for (const pack of PACKS) {
    for (const level of levelsOfPack(pack.id)) save.stars[level.id] = 3
  }
  for (let n = 39; n <= 50; n++) save.stars[`hard-${n}`] = 3
  const progress = overallProgress(save)
  assert.equal(progress.stars, 465)
  assert.equal(progress.stars, progress.maxStars)
})

test('every pet stays camera-facing across alternating directions and resets its pose', () => {
  for (const info of PETS) {
    const pet = buildPet(info.id)
    for (const vector of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
        posePet(pet, phase, true, vector[0], vector[1])
        assert.equal(pet.rotation.y, 0)
        assert.ok(Math.abs(pet.rotation.x) <= 0.065)
        assert.ok(Math.abs(pet.rotation.z) <= 0.065)
      }
    }
    posePet(pet, 1, false)
    assert.equal(pet.scale.y, 1)
    assert.ok(pet.getObjectByName('head'))
    assert.equal(pet.children.filter(p => p.name.startsWith('paw-')).length, 4)
    disposeObject(pet)
  }
})

test('shared materials and sprite materials are released once', () => {
  const root = new THREE.Group()
  const geometry = new THREE.BoxGeometry()
  const material = new THREE.MeshBasicMaterial()
  const spriteMaterial = new THREE.SpriteMaterial()
  let disposedCount = 0
  for (const resource of [geometry, material, spriteMaterial]) resource.addEventListener('dispose', () => disposedCount++)
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material), new THREE.Sprite(spriteMaterial))
  disposeObject(root)
  assert.equal(disposedCount, 3)
})

test('a delayed box animation settles when the next walking move arrives', () => {
  const level = parseXsb('#######\n#     #\n# @$ .#\n#     #\n#######')
  const engine = new SokobanEngine(level)
  const scene = Object.create(GameScene.prototype)
  Object.assign(scene, {
    level, pet: buildPet('cat'), petFrom: new THREE.Vector3(), petTarget: new THREE.Vector3(),
    reducedMotion: { matches: false }, directionMarker: null,
    boxes: [{
      group: new THREE.Group(), target: new THREE.Vector3(), from: new THREE.Vector3(),
      bodyMat: new THREE.MeshStandardMaterial(), glowMat: new THREE.SpriteMaterial(),
      light: new THREE.PointLight(), hopT: 0,
    }],
  })
  engine.tryMove('right')
  scene.syncEngine(engine, 'right', 0)
  scene.boxes[0].group.position.x = 0.48
  engine.tryMove('up')
  scene.syncEngine(engine, 'up')
  assert.ok(scene.boxes[0].group.position.equals(scene.boxes[0].target))
  disposeObject(scene.pet)
  scene.boxes[0].bodyMat.dispose()
  scene.boxes[0].glowMat.dispose()
})

test('rotation, reflection and equivalent walking starts are duplicate puzzles', () => {
  const text = '######\n#    #\n# @$ #\n#  . #\n######'
  const rows = text.split('\n')
  const rotated = Array.from({ length: rows[0]!.length }, (_, x) => rows.map(row => row[x]).reverse().join('')).join('\n')
  assert.equal(levelHash(parseXsb(text)), levelHash(parseXsb(rotated)))
  assert.equal(levelHash(parseXsb(text)), levelHash(parseXsb(rows.map(row => [...row].reverse().join('')).join('\n'))))
  assert.equal(levelHash(parseXsb(text)), levelHash(parseXsb('######\n#@   #\n#  $ #\n#  . #\n######')))
})

test('curriculum remains unique, ordered and correctly linked after reordering', () => {
  const hashes = new Set<string>()
  const ids = new Set<string>()
  for (const pack of PACKS) {
    const rows = levelsOfPack(pack.id)
    const current = shallowRef(rows[0]!)
    const next = computed(() => nextLevel(current.value))
    assert.equal(next.value?.id, rows[1]?.id)
    current.value = rows[1]!
    assert.equal(next.value?.id, rows[2]?.id)
    for (let i = 0; i < rows.length; i++) {
      const meta = rows[i]!
      assert.equal(meta.num, i + 1)
      assert.equal(findLevel(pack.id, i + 1)?.id, meta.id)
      assert.ok(!ids.has(meta.id))
      ids.add(meta.id)
      const level = parseXsbSetLevels(readFileSync(`public${meta.file}`, 'utf8'))[0]!.level
      const hash = levelHash(level)
      assert.ok(!hashes.has(hash), `duplicate ${meta.id}`)
      hashes.add(hash)
      assert.equal(meta.boxCount, level.boxStarts.length)
      assert.ok(meta.par! >= meta.solutionMoves!)
      if (i) assert.ok(meta.challenge! >= rows[i - 1]!.challenge!)
    }
    stored = null
    const save = loadSave()
    assert.equal(isLevelUnlocked(save, pack.id, 2, n => rows[n - 1]!.id), false)
    recordClear(save, rows[0]!.id, pack.id, 1, 3, 1, 1)
    assert.equal(isLevelUnlocked(save, pack.id, 2, n => rows[n - 1]!.id), true)
    assert.equal(nextLevel(rows.at(-1)!), undefined)
  }
  assert.equal(ids.size, 155)
})
console.log(`\n${passed} regression groups passed`)
