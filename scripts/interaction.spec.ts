import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { LEVELS } from '../game/core/levels'
import { parseXsbSetLevels } from '../game/core/xsb-parser'
import { SokobanEngine } from '../game/core/engine'
import { DIR_VECTORS, type Direction } from '../game/core/types'

const moves = (page: Page) => page.locator('.hud-stat').first()
async function ready(page: Page) {
  await expect(page.locator('.loading-tip')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '右', exact: true })).toBeEnabled()
}
async function move(page: Page, direction: string, count: number) {
  await page.keyboard.press(direction)
  await expect(moves(page)).toContainText(`步数 ${count}`)
}
async function settled(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
    await new Promise(requestAnimationFrame)
  })
}
function solution(id: string): Direction[] {
  const meta = LEVELS.find(level => level.id === id)!
  const level = parseXsbSetLevels(readFileSync(`public${meta.file}`, 'utf8'))[0]!.level
  const initial = new SokobanEngine(level)
  const queue = [{ player: initial.player, boxes: initial.boxes, path: [] as Direction[] }]
  const visited = new Set([initial.key()])
  for (let head = 0; head < queue.length && head < 50_000; head++) {
    const node = queue[head]!
    for (const direction of Object.keys(DIR_VECTORS) as Direction[]) {
      const engine = new SokobanEngine(level)
      engine.player = { ...node.player }
      engine.boxes = node.boxes.map(box => ({ ...box }))
      const result = engine.tryMove(direction)
      if (!result.moved) continue
      const path = [...node.path, direction]
      if (result.won) return path
      if (visited.has(engine.key())) continue
      visited.add(engine.key())
      queue.push({ player: engine.player, boxes: engine.boxes, path })
    }
  }
  throw new Error(`No small-board solution for ${id}`)
}

test('home keyboard selection, all pack tabs, locked routes and return navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.pet-card')).toHaveCount(4)
  const rabbit = page.getByRole('button', { name: /兔子/ })
  await rabbit.focus()
  await page.keyboard.press('Space')
  await expect(rabbit).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: /兔子/ })).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: '.tmp/home-desktop.png', fullPage: true })
  await page.getByRole('button', { name: /教程/ }).click()
  for (const [name, count] of [['简单', 40], ['中等', 55], ['困难', 50], ['教程', 10]] as const) {
    await page.getByRole('button', { name: new RegExp(name) }).click()
    await expect(page.locator('.level-tile')).toHaveCount(count)
    await expect(page.locator('.level-tile').nth(1)).toBeDisabled()
  }
  await page.goto('/play?pack=hard&num=50')
  await expect(page).toHaveURL(/select\?pack=hard/)
  await page.getByRole('link', { name: '← 返回首页' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('all pets receive their own food, reload persists it and replay grants no duplicate', async ({ page }) => {
  for (const [pet, food] of [['小猫', '鱼肉零食'], ['小狗', '狗狗饼干'], ['兔子', '提摩西草'], ['蜥蜴', '昆虫零食']]) {
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(pet!) }).click()
    await page.getByRole('button', { name: /教程/ }).click()
    await page.getByRole('button', { name: /第 1 关 / }).click()
    await ready(page)
    await page.getByRole('button', { name: '右', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '通关奖励' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(`${pet}获得 3 份${food}`)
    await expect(dialog.getByRole('button', { name: '下一关 →' })).toBeVisible()
    await page.keyboard.press('ArrowLeft')
    await expect(moves(page)).toContainText('步数 1')
    if (pet === '小猫') {
      await settled(page)
      await page.screenshot({ path: '.tmp/reward-desktop.png' })
    }
    await dialog.getByRole('button', { name: '重玩本关' }).click()
    await ready(page)
    await page.keyboard.press('ArrowRight')
    await expect(dialog).toContainText('本关奖励已领取')
    await page.reload()
    await ready(page)
    await expect(page.locator('.food-balance')).toContainText(`${food} 3 份`)
  }
})

test('successive next-level metadata, undo, restart confirmation, paused dialog and mute', async ({ page }) => {
  await page.goto('/play?pack=tutorial&num=1')
  await ready(page)
  await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: '下一关 →' }).click()
  await ready(page)
  await expect(page.locator('.hud-title')).toContainText('教程 · 第 2 关')
  await move(page, 'ArrowUp', 1)
  await page.getByRole('button', { name: /撤销/ }).click()
  await expect(moves(page)).toContainText('步数 0')
  await move(page, 'ArrowUp', 1)
  await page.getByRole('button', { name: /重新开始/ }).click()
  const restart = page.getByRole('dialog', { name: '重新开始本关' })
  await expect(restart).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(moves(page)).toContainText('步数 1')
  await page.keyboard.press('Escape')
  await expect(restart).not.toBeVisible()
  await expect(page.getByRole('button', { name: /重新开始/ })).toBeFocused()
  await page.getByRole('button', { name: /重新开始/ }).click()
  await restart.getByRole('button', { name: '确认重开' }).click()
  await expect(moves(page)).toContainText('步数 0')
  await page.getByRole('button', { name: '小贴士' }).click()
  const tip = page.getByRole('dialog', { name: '纪念知识小卡' })
  await expect(tip).toBeVisible()
  await page.keyboard.press('ArrowUp')
  await expect(moves(page)).toContainText('步数 0')
  await expect(tip.getByRole('link')).toHaveAttribute('href', /ref=box-puzzle&level=tutorial-2/)
  await tip.getByRole('button', { name: '继续游戏' }).click()
  await page.getByRole('button', { name: '静音', exact: true }).click()
  await expect(page.getByRole('button', { name: '开启声音' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: '开启声音' }).click()
  await move(page, 'ArrowUp', 1)
  await move(page, 'ArrowRight', 2)
  await move(page, 'ArrowDown', 3)
  await page.getByRole('button', { name: '下一关 →' }).click()
  await ready(page)
  await expect(page.locator('.hud-title')).toContainText('第 3 关「风车」')
  await move(page, 'ArrowDown', 1)
  await move(page, 'ArrowDown', 2)
  await page.getByRole('button', { name: '下一关 →' }).click()
  await ready(page)
  await expect(page.locator('.hud-title')).toContainText('第 4 关「两个宝盒」')
})

test('failed and delayed loads block controls, retry succeeds and navigation cancels stale loads', async ({ page }) => {
  let fail = true
  await page.route('**/levels/tutorial/1.xsb', async route => {
    await route.fulfill({ status: fail ? 503 : 200, body: fail ? 'Unavailable' : readFileSync('public/levels/tutorial/1.xsb', 'utf8') })
  })
  await page.goto('/play?pack=tutorial&num=1')
  await expect(page.getByRole('alert')).toContainText('HTTP 503')
  await expect(page.getByRole('button', { name: '右', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: /重新开始/ })).toBeDisabled()
  fail = false
  await page.getByRole('button', { name: '重新加载' }).click()
  await ready(page)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: '通关奖励' })).toBeVisible()
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/levels/tutorial/2.xsb', async route => {
    await held
    await route.fulfill({ status: 200, body: readFileSync('public/levels/tutorial/2.xsb', 'utf8') }).catch(() => {})
  })
  await page.getByRole('button', { name: '下一关 →' }).click()
  await expect(page.locator('.loading-tip')).toBeVisible()
  await expect(page.getByRole('button', { name: /重新开始/ })).toBeDisabled()
  await page.getByRole('button', { name: /选关/ }).click()
  release()
  await expect(page).toHaveURL(/select/)
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('mobile canvas swipe, direction pad separation and 375px layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/play?pack=tutorial&num=1')
  await ready(page)
  await page.screenshot({ path: '.tmp/play-mobile.png' })
  const canvas = await page.locator('.canvas-wrap').boundingBox()
  const controls = await page.locator('.game-controls').boundingBox()
  expect(canvas!.y + canvas!.height).toBeLessThanOrEqual(controls!.y + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator('.canvas-wrap canvas').evaluate(canvas => {
    const touch = (x: number) => new Touch({ identifier: 1, target: canvas, clientX: x, clientY: 300 })
    canvas.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(100)], bubbles: true }))
    canvas.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(180)], bubbles: true }))
  })
  await expect(page.getByRole('dialog', { name: '通关奖励' })).toBeVisible()
  await settled(page)
  await page.screenshot({ path: '.tmp/reward-mobile.png' })
  await expect(page.getByRole('button', { name: '下一关 →' })).toBeInViewport()
  await page.getByRole('button', { name: '下一关 →' }).click()
  await ready(page)
  await page.getByRole('button', { name: '上', exact: true }).click()
  await expect(moves(page)).toContainText('步数 1')
})

test('all tutorial clears are playable and last level offers no dead next button', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/play?pack=tutorial&num=1')
  const rows = LEVELS.filter(meta => meta.pack === 'tutorial')
  for (const [index, meta] of rows.entries()) {
    await ready(page)
    let count = 0
    for (const direction of solution(meta.id)) {
      await move(page, `Arrow${direction[0]!.toUpperCase()}${direction.slice(1)}`, ++count)
    }
    await expect(page.getByRole('dialog', { name: '通关奖励' })).toBeVisible()
    if (index < rows.length - 1) await page.getByRole('button', { name: '下一关 →' }).click()
  }
  await expect(page.getByRole('button', { name: '下一关 →' })).toHaveCount(0)
  await page.getByRole('dialog').getByRole('button', { name: /选关/ }).click()
  await expect(page.locator('.pack-tab.active')).toContainText('🏆')
  await expect(page.locator('.level-tile:disabled')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('malformed tips never pause the board and restarting cancels a late tip', async ({ page }) => {
  await page.route('**/data/knowledge.json', route => route.fulfill({ json: [null] }))
  await page.goto('/play?pack=tutorial&num=1')
  await ready(page)
  await page.getByRole('button', { name: '小贴士' }).click()
  await expect(page.locator('.game-status')).toContainText('小贴士暂时无法加载')
  await expect(page.getByRole('button', { name: '右', exact: true })).toBeEnabled()
  await page.unroute('**/data/knowledge.json')
  let release!: () => void
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/data/knowledge.json', async route => {
    await held
    await route.fulfill({ json: [{ title: 'late', text: 'late tip' }] }).catch(() => {})
  })
  const requested = page.waitForRequest('**/data/knowledge.json')
  await page.getByRole('button', { name: '小贴士' }).click()
  await requested
  await page.getByRole('button', { name: /重新开始/ }).click()
  release()
  await expect(page.getByRole('button', { name: '小贴士' })).toBeEnabled()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: '通关奖励' })).toBeVisible()
})

test('real WebGL scene keeps facing stable, settles pushes and releases sprite listeners', async ({ page }) => {
  await page.goto('/play?pack=tutorial&num=1')
  await ready(page)
  const result = await page.evaluate(async () => {
    const scenePath = '/_nuxt/game/render/scene.ts'
    const enginePath = '/_nuxt/game/core/engine.ts'
    const parserPath = '/_nuxt/game/core/xsb-parser.ts'
    const { GameScene } = await import(scenePath)
    const { SokobanEngine } = await import(enginePath)
    const { parseXsb } = await import(parserPath)
    const level = parseXsb('#######\n#     #\n# @$ .#\n#     #\n#######')
    const counts: number[] = []
    const rotations: number[] = []
    let settledBox = false
    for (let cycle = 0; cycle < 3; cycle++) {
      const canvas = document.createElement('canvas')
      canvas.style.cssText = 'width:240px;height:240px;position:fixed;left:0;top:0'
      document.body.append(canvas)
      const scene = new GameScene(canvas)
      const engine = new SokobanEngine(level)
      scene.setLevel(level, 'cat')
      engine.tryMove('right')
      scene.syncEngine(engine, 'right', 0)
      await new Promise(requestAnimationFrame)
      scene.boxes[0].group.position.x = 0.48
      engine.tryMove('up')
      scene.syncEngine(engine, 'up')
      settledBox = scene.boxes[0].group.position.equals(scene.boxes[0].target)
      for (let frame = 0; frame < 12; frame++) {
        await new Promise(requestAnimationFrame)
        rotations.push(scene.pet.rotation.y)
      }
      const geometry = scene.sharedSpriteGeometry
      scene.dispose()
      counts.push(geometry._listeners?.dispose?.length ?? 0)
      canvas.remove()
    }
    return { counts, rotations, settledBox }
  })
  expect(result.settledBox).toBe(true)
  expect(result.rotations.every(value => value === 0)).toBe(true)
  expect(new Set(result.counts).size).toBe(1)
  expect(result.counts[0]).toBe(0)
})

test('compact homepage and reduced motion remain operable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.pet-card')).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const firstPet = await page.locator('.pet-card').nth(0).boundingBox()
  const secondPet = await page.locator('.pet-card').nth(1).boundingBox()
  expect(firstPet!.y).toBe(secondPet!.y)
  await page.screenshot({ path: '.tmp/home-mobile.png', fullPage: true })
  await page.getByRole('button', { name: /教程/ }).click()
  await page.getByRole('button', { name: /第 1 关 / }).click()
  await ready(page)
  await page.keyboard.press('ArrowRight')
  const dialog = page.getByRole('dialog', { name: '通关奖励' })
  await expect(dialog).toBeVisible()
  expect(await dialog.locator('.dialog').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
  await expect(dialog.getByRole('button', { name: '下一关 →' })).toBeInViewport()
})
