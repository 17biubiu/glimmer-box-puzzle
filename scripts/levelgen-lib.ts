// 关卡生成/求解库（无副作用，可被 CLI 与诊断脚本安全导入）
//
// 求解器（两段式）：
//   阶段 1 —— 区域归一化的推箱 BFS：状态 = (箱子集合, 玩家可达区代表格)，
//             求出精确的最少推箱数；极快，能快速炸掉过难/异常的候选。
//   阶段 2 —— 精确步数 Dijkstra：状态 = (箱子集合, 玩家格子)，代价 = 步数，
//             限制推箱数 ≤ 阶段1结果（字典序最优：先推箱后步数），死角剪枝 + 双上限。
// 生成器：从完成态反向拉箱（保证可解倾向），落点避开死角。

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseXsb } from '../game/core/xsb-parser'
import type { LevelMeta, PackId, ParsedLevel, Point } from '../game/core/types'

const DIRS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
]

function idxOf(level: ParsedLevel, x: number, y: number): number {
  return y * level.width + x
}

function walkableCell(level: ParsedLevel, i: number): boolean {
  const c = level.cells[i]
  return c === 'floor' || c === 'goal'
}

/** 死角预计算：箱子一旦落入且不在目标点上就永远无法归位的格子 */
export function computeDeadSquares(level: ParsedLevel): boolean[] {
  const { width, height } = level
  const live = new Array<boolean>(width * height).fill(false)
  for (const g of level.goals) live[idxOf(level, g.x, g.y)] = true
  let changed = true
  while (changed) {
    changed = false
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = idxOf(level, x, y)
        if (live[i] || !walkableCell(level, i)) continue
        for (const d of DIRS) {
          const fwd = idxOf(level, x + d.x, y + d.y)
          const back = idxOf(level, x - d.x, y - d.y)
          if (walkableCell(level, fwd) && live[fwd] && walkableCell(level, back)) {
            live[i] = true
            changed = true
            break
          }
        }
      }
    }
  }
  return live.map((v, i) => !v && walkableCell(level, i))
}

export interface SolveResult {
  pushes: number
  moves: number
  states: number
}

/**
 * 两段式求解（优化版：预分配缓冲 + 代数标记，避免热循环分配）。
 * 阶段 1：区域归一化推箱 BFS → 精确最少推箱数（快速炸掉过难候选）。
 * 阶段 2：推箱数 ≤ minPushes 的步数 Dijkstra → 字典序精确最少步数。
 * stateCap 限制各阶段展开数；timeCapMs 限制总耗时。返回 null = 不可解/超预算。
 */
export function solveLevel(level: ParsedLevel, stateCap = 300_000, timeCapMs = 8_000): SolveResult | null {
  const deadline = Date.now() + timeCapMs
  const { width, height } = level
  const n = width * height
  const dead = computeDeadSquares(level)
  const isGoal = (i: number) => level.cells[i] === 'goal'
  const startBoxes = level.boxStarts.map((b) => idxOf(level, b.x, b.y)).sort((a, b) => a - b)
  const startPlayer = idxOf(level, level.playerStart.x, level.playerStart.y)
  const boxMark = new Uint8Array(n)
  const walk = new Uint8Array(n)
  for (let i = 0; i < n; i++) walk[i] = walkableCell(level, i) ? 1 : 0

  // 推箱距离场：多源反向 BFS（从所有目标点沿推箱图反向扩展），
  // pushDist[c] = 箱子从 c 推到任一目标点的最少推数（忽略其他箱子）。
  // 作为 A* 的可采纳启发：h(状态) = Σ pushDist[box]（每次推箱至多让和减 1，一致）。
  const INF = 0x3fffffff
  const pushDist = new Int32Array(n).fill(INF)
  {
    let qh = 0
    let qt = 0
    const q = new Int32Array(n)
    for (const g of level.goals) {
      const gi = idxOf(level, g.x, g.y)
      pushDist[gi] = 0
      q[qt++] = gi
    }
    while (qh < qt) {
      const c = q[qh++]!
      const cx = c % width
      const cy = (c / width) | 0
      const cd = pushDist[c]!
      for (const d of DIRS) {
        // 前向：箱子 p → c（p = c - d），要求站位 p - d 可走
        const px = cx - d.x
        const py = cy - d.y
        const sx = cx - d.x * 2
        const sy = cy - d.y * 2
        if (px < 0 || py < 0 || px >= width || py >= height) continue
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
        const pi = py * width + px
        const si = sy * width + sx
        if (!walk[pi] || !walk[si]) continue
        if (pushDist[pi] !== INF) continue
        pushDist[pi] = cd + 1
        q[qt++] = pi
      }
    }
  }
  const heuristic = (boxes: number[]): number => {
    let s = 0
    for (const b of boxes) {
      const d = pushDist[b]!
      if (d >= INF) return INF
      s += d
    }
    return s
  }

  // 预分配 BFS 缓冲（代数标记避免重复清零）
  const seenStamp = new Int32Array(n)
  const distBuf = new Int32Array(n)
  const queueBuf = new Int32Array(n)
  const regionBuf = new Uint8Array(n) // 当前 pop 的可达区快照（内层 BFS 会覆盖 seenStamp）
  let stamp = 0

  /** 从 from 做可达区 BFS（绕开 boxMark）；needDist 时写 distBuf（不可达 -1）。返回代表格 */
  const bfsRegion = (from: number, needDist: boolean): number => {
    stamp++
    let qh = 0
    let qt = 0
    queueBuf[qt++] = from
    seenStamp[from] = stamp
    if (needDist) distBuf[from] = 0
    let rep = from
    while (qh < qt) {
      const c = queueBuf[qh++]!
      if (c < rep) rep = c
      const cx = c % width
      const cy = (c / width) | 0
      const cd = needDist ? distBuf[c]! : 0
      // 四邻
      if (cy > 0) {
        const ni = c - width
        if (seenStamp[ni] !== stamp && walk[ni] && !boxMark[ni]) {
          seenStamp[ni] = stamp
          if (needDist) distBuf[ni] = cd + 1
          queueBuf[qt++] = ni
        }
      }
      if (cy < height - 1) {
        const ni = c + width
        if (seenStamp[ni] !== stamp && walk[ni] && !boxMark[ni]) {
          seenStamp[ni] = stamp
          if (needDist) distBuf[ni] = cd + 1
          queueBuf[qt++] = ni
        }
      }
      if (cx > 0) {
        const ni = c - 1
        if (seenStamp[ni] !== stamp && walk[ni] && !boxMark[ni]) {
          seenStamp[ni] = stamp
          if (needDist) distBuf[ni] = cd + 1
          queueBuf[qt++] = ni
        }
      }
      if (cx < width - 1) {
        const ni = c + 1
        if (seenStamp[ni] !== stamp && walk[ni] && !boxMark[ni]) {
          seenStamp[ni] = stamp
          if (needDist) distBuf[ni] = cd + 1
          queueBuf[qt++] = ni
        }
      }
    }
    return rep
  }

  const mark = (boxes: number[]) => {
    boxMark.fill(0)
    for (const b of boxes) boxMark[b] = 1
  }

  // ---------- 阶段 1：最少推箱数（区域归一化 A*，h = Σ 推箱距离） ----------
  const keyOf1 = (boxes: number[], rep: number) => `${boxes.join(',')}|${rep}`
  interface N1 {
    boxes: number[]
    rep: number
    g: number // 已用推数
    f: number // g + h
  }
  const bestG = new Map<string, number>()
  const heap1: N1[] = []
  const push1 = (nd: N1) => {
    heap1.push(nd)
    let i = heap1.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap1[p]!.f <= heap1[i]!.f) break
      ;[heap1[p], heap1[i]] = [heap1[i]!, heap1[p]!]
      i = p
    }
  }
  const pop1 = (): N1 => {
    const top = heap1[0]!
    const last = heap1.pop()!
    if (heap1.length) {
      heap1[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < heap1.length && heap1[l]!.f < heap1[m]!.f) m = l
        if (r < heap1.length && heap1[r]!.f < heap1[m]!.f) m = r
        if (m === i) break
        ;[heap1[m], heap1[i]] = [heap1[i]!, heap1[m]!]
        i = m
      }
    }
    return top
  }
  if (heuristic(startBoxes) >= INF) return null // 有箱子结构上到不了任何目标点
  mark(startBoxes)
  const rep0 = bfsRegion(startPlayer, false)
  push1({ boxes: startBoxes, rep: rep0, g: 0, f: heuristic(startBoxes) })
  bestG.set(keyOf1(startBoxes, rep0), 0)
  let minPushes = -1
  let states1 = 0
  const stage1Cap = Math.min(stateCap, 150_000)
  while (heap1.length) {
    if ((states1 & 0x1ff) === 0 && Date.now() > deadline) return null
    if (++states1 > stage1Cap) return null
    const cur = pop1()
    const ck = keyOf1(cur.boxes, cur.rep)
    if (bestG.get(ck)! < cur.g) continue // 过期堆项
    if (process.env.SOLVE_DEBUG) console.error(`[dbg] pop#${states1} boxes=[${cur.boxes}] rep=${cur.rep} g=${cur.g} f=${cur.f}`)
    if (cur.boxes.every((b) => isGoal(b))) {
      minPushes = cur.g // 一致启发 → 首次弹出目标态即最优
      break
    }
    mark(cur.boxes)
    bfsRegion(cur.rep, true) // distBuf = 可达区距离
    // 可达区快照（内层试探性 bfsRegion 会推进 stamp 覆盖 seenStamp）
    for (let i = 0; i < n; i++) regionBuf[i] = seenStamp[i] === stamp ? 1 : 0
    for (let bi = 0; bi < cur.boxes.length; bi++) {
      const b = cur.boxes[bi]!
      const bx = b % width
      const by = (b / width) | 0
      for (let di = 0; di < 4; di++) {
        const d = DIRS[di]!
        const sx = bx - d.x
        const sy = by - d.y
        const dx = bx + d.x
        const dy = by + d.y
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
        if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue
        const stand = sy * width + sx
        const dest = dy * width + dx
        if (!regionBuf[stand]) continue // 玩家够不到推动位（阶段1用快照）
        if (!walk[dest] || boxMark[dest]) continue
        if (dead[dest]) continue
        const nboxes = cur.boxes.slice()
        nboxes[bi] = dest
        nboxes.sort((a, z) => a - z)
        boxMark[b] = 0
        boxMark[dest] = 1
        const nrep = bfsRegion(b, false)
        boxMark[b] = 1
        boxMark[dest] = 0
        const nk = keyOf1(nboxes, nrep)
        const ng = cur.g + 1
        const prev = bestG.get(nk)
        if (prev !== undefined && prev <= ng) continue
        bestG.set(nk, ng)
        push1({ boxes: nboxes, rep: nrep, g: ng, f: ng + heuristic(nboxes) })
      }
    }
  }
  if (minPushes < 0) {
    if (process.env.SOLVE_DEBUG) console.error(`[dbg] stage1 失败 states=${states1} heap=${heap1.length}`)
    return null
  }
  if (process.env.SOLVE_DEBUG) console.error(`[dbg] stage1 minPushes=${minPushes} states=${states1}`)

  // ---------- 阶段 2：推箱数受限的精确最少步数 A*（h = Σ 推箱距离，对步数同样可采纳） ----------
  interface N2 {
    boxes: number[]
    player: number
    pushes: number
    moves: number
    f: number // moves + Σ pushDist
  }
  const keyOf2 = (boxes: number[], player: number, pushes: number) => `${boxes.join(',')}|${player}|${pushes}`
  const best = new Map<string, number>()
  const heap: N2[] = []
  const push2 = (nd: N2) => {
    heap.push(nd)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p]!.f <= heap[i]!.f) break
      ;[heap[p], heap[i]] = [heap[i]!, heap[p]!]
      i = p
    }
  }
  const pop2 = (): N2 => {
    const top = heap[0]!
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l]!.f < heap[m]!.f) m = l
        if (r < heap.length && heap[r]!.f < heap[m]!.f) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i]!, heap[m]!]
        i = m
      }
    }
    return top
  }
  push2({ boxes: startBoxes, player: startPlayer, pushes: 0, moves: 0, f: heuristic(startBoxes) })
  best.set(keyOf2(startBoxes, startPlayer, 0), 0)
  let states2 = 0
  while (heap.length) {
    if ((states2 & 0x1ff) === 0 && Date.now() > deadline) return null
    if (++states2 > stateCap) return null
    const cur = pop2()
    if (best.get(keyOf2(cur.boxes, cur.player, cur.pushes))! < cur.moves) continue
    if (cur.boxes.every((b) => isGoal(b))) {
      return { pushes: minPushes, moves: cur.moves, states: states1 + states2 }
    }
    if (cur.pushes >= minPushes) continue
    mark(cur.boxes)
    bfsRegion(cur.player, true)
    for (let bi = 0; bi < cur.boxes.length; bi++) {
      const b = cur.boxes[bi]!
      const bx = b % width
      const by = (b / width) | 0
      for (let di = 0; di < 4; di++) {
        const d = DIRS[di]!
        const sx = bx - d.x
        const sy = by - d.y
        const dx = bx + d.x
        const dy = by + d.y
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue
        if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue
        const stand = sy * width + sx
        const dest = dy * width + dx
        if (seenStamp[stand] !== stamp) continue
        if (!walk[dest] || boxMark[dest]) continue
        if (dead[dest]) continue
        const nboxes = cur.boxes.slice()
        nboxes[bi] = dest
        nboxes.sort((a, z) => a - z)
        const nk = keyOf2(nboxes, b, cur.pushes + 1)
        const nm = cur.moves + distBuf[stand]! + 1
        const prev = best.get(nk)
        if (prev !== undefined && prev <= nm) continue
        best.set(nk, nm)
        push2({ boxes: nboxes, player: b, pushes: cur.pushes + 1, moves: nm, f: nm + heuristic(nboxes) })
      }
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// 生成器
// ---------------------------------------------------------------------------

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface GenParams {
  w: number
  h: number
  boxes: number
  interiorWalls: number
  pulls: number
  seed: number
}

function reachMapCells(level: ParsedLevel, boxes: Point[], from: Point): boolean[] {
  const seen = new Array<boolean>(level.width * level.height).fill(false)
  const q: Point[] = [from]
  seen[from.y * level.width + from.x] = true
  const boxAt = (x: number, y: number) => boxes.some((b) => b.x === x && b.y === y)
  while (q.length) {
    const p = q.pop()!
    for (const d of DIRS) {
      const nx = p.x + d.x
      const ny = p.y + d.y
      if (nx < 0 || ny < 0 || nx >= level.width || ny >= level.height) continue
      const i = ny * level.width + nx
      if (seen[i]) continue
      const c = level.cells[i]
      if (c !== 'floor' && c !== 'goal') continue
      if (boxAt(nx, ny)) continue
      seen[i] = true
      q.push({ x: nx, y: ny })
    }
  }
  return seen
}

/** 反向拉箱生成一关；结构不合理时返回 null */
export function generate(p: GenParams): string | null {
  const rnd = mulberry32(p.seed)
  const { w, h } = p
  const grid: string[][] = []
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) row.push(x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : ' ')
    grid.push(row)
  }

  // 随机内部墙（保持连通）
  let placed = 0
  let guard = 0
  while (placed < p.interiorWalls && guard++ < 200) {
    const px = 1 + Math.floor(rnd() * (w - 2))
    const py = 1 + Math.floor(rnd() * (h - 2))
    if (grid[py]![px] === '#') continue
    grid[py]![px] = '#'
    const cells = grid.flat().map((c) => (c === '#' ? 'wall' : 'floor'))
    const startIdx = cells.findIndex((c) => c === 'floor')
    const seen = new Array<boolean>(w * h).fill(false)
    const q = [startIdx]
    seen[startIdx] = true
    while (q.length) {
      const i = q.pop()!
      const cx = i % w
      const cy = (i / w) | 0
      for (const d of DIRS) {
        const nx = cx + d.x
        const ny = cy + d.y
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (!seen[ni] && cells[ni] === 'floor') {
          seen[ni] = true
          q.push(ni)
        }
      }
    }
    let ok = true
    for (let i = 0; i < cells.length; i++) if (cells[i] === 'floor' && !seen[i]) ok = false
    if (ok) placed++
    else grid[py]![px] = ' '
  }

  const freeCells = (boxes: Point[]): Point[] => {
    const out: Point[] = []
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++)
        if (grid[y]![x] === ' ' && !boxes.some((b) => b.x === x && b.y === y)) out.push({ x, y })
    return out
  }

  const goals: Point[] = []
  guard = 0
  while (goals.length < p.boxes && guard++ < 800) {
    const f = freeCells(goals)
    if (!f.length) break
    goals.push(f[Math.floor(rnd() * f.length)]!)
  }
  if (goals.length < p.boxes) return null
  for (const g of goals) grid[g.y]![g.x] = '.'

  const boxes: Point[] = goals.map((g) => ({ ...g }))
  const f0 = freeCells(boxes)
  if (!f0.length) return null
  let player = f0[Math.floor(rnd() * f0.length)]!

  const level: ParsedLevel = {
    width: w,
    height: h,
    cells: grid.flat().map((ch) => (ch === '#' ? 'wall' : ch === '.' ? 'goal' : 'floor')) as ParsedLevel['cells'],
    playerStart: { ...player },
    boxStarts: boxes.map((b) => ({ ...b })),
    goals,
  }
  const dead = computeDeadSquares(level)

  // 反向拉箱
  let pullsDone = 0
  guard = 0
  const minPulls = Math.max(2, Math.floor(p.pulls * 0.5))
  while (pullsDone < p.pulls && guard++ < p.pulls * 100) {
    const bi = Math.floor(rnd() * boxes.length)
    const d = DIRS[Math.floor(rnd() * 4)]!
    const b = boxes[bi]!
    const stand: Point = { x: b.x + d.x, y: b.y + d.y }
    const dest: Point = { x: b.x + d.x * 2, y: b.y + d.y * 2 }
    if (stand.x <= 0 || stand.y <= 0 || stand.x >= w - 1 || stand.y >= h - 1) continue
    if (dest.x <= 0 || dest.y <= 0 || dest.x >= w - 1 || dest.y >= h - 1) continue
    const cellAt = (pt: Point) => level.cells[pt.y * w + pt.x]!
    const boxAt = (pt: Point) => boxes.some((x) => x.x === pt.x && x.y === pt.y)
    const sc = cellAt(stand)
    const dc = cellAt(dest)
    if ((sc !== 'floor' && sc !== 'goal') || (dc !== 'floor' && dc !== 'goal')) continue
    if (boxAt(stand) || boxAt(dest)) continue
    if (sc !== 'goal' && dead[stand.y * w + stand.x]) continue
    const reach = reachMapCells(level, boxes, player)
    if (!reach[stand.y * w + stand.x]) continue
    boxes[bi] = { ...stand }
    player = { ...dest }
    pullsDone++
  }
  if (pullsDone < minPulls) return null
  if (boxes.some((b) => goals.some((g) => g.x === b.x && g.y === b.y))) return null

  for (const b of boxes) grid[b.y]![b.x] = grid[b.y]![b.x] === '.' ? '*' : '$'
  grid[player.y]![player.x] = grid[player.y]![player.x] === '.' ? '+' : '@'
  return grid.map((r) => r.join('')).join('\n')
}

// ---------------------------------------------------------------------------
// 去重（归一化 + 镜像归一哈希）
// ---------------------------------------------------------------------------

export function levelHash(level: ParsedLevel): string {
  const reachable = reachMapCells(level, level.boxStarts, level.playerStart)
  const signatures: string[] = []
  // All eight rotations/reflections, with player positions in the same region equivalent.
  for (let turn = 0; turn < 4; turn++) {
    for (const mirror of [false, true]) {
      const transform = (x: number, y: number): string => {
        if (mirror) x = -x
        for (let t = 0; t < turn; t++) [x, y] = [-y, x]
        return `${x},${y}`
      }
      // Translation normalization is implicit in centered coordinates.
      const centered = (x: number, y: number) => transform(x - (level.width - 1) / 2, y - (level.height - 1) / 2)
      const normalizedCells = level.cells.map((cell, i) => `${centered(i % level.width, Math.floor(i / level.width))}:${cell}`).sort()
      const normalizedRegion = level.cells.flatMap((_, i) => reachable[i] ? [centered(i % level.width, Math.floor(i / level.width))] : []).sort()
      const boxes = level.boxStarts.map(b => centered(b.x, b.y)).sort()
      signatures.push(`${normalizedCells.join(';')}|${boxes.join(';')}|${normalizedRegion[0]}`)
    }
  }
  return signatures.sort()[0]!
}

// ---------------------------------------------------------------------------
// 批量生成（边生成边落盘，可断点续跑）
// ---------------------------------------------------------------------------

export interface PackTarget {
  pack: PackId
  total: number
  wMin: number
  wMax: number
  hMin: number
  hMax: number
  boxesMin: number
  boxesMax: number
  wallsMin: number
  wallsMax: number
  pullsMin: number
  pullsMax: number
  pushMin: number
  pushMax: number
  moveMin: number
  moveMax: number
  stateCap: number
  timeCapMs: number
}

export const TARGETS: PackTarget[] = [
  { pack: 'tutorial', total: 10, wMin: 5, wMax: 8, hMin: 5, hMax: 8, boxesMin: 1, boxesMax: 2, wallsMin: 0, wallsMax: 1, pullsMin: 2, pullsMax: 5, pushMin: 1, pushMax: 5, moveMin: 1, moveMax: 16, stateCap: 50_000, timeCapMs: 2_000 },
  { pack: 'easy', total: 40, wMin: 7, wMax: 10, hMin: 7, hMax: 10, boxesMin: 2, boxesMax: 4, wallsMin: 0, wallsMax: 2, pullsMin: 4, pullsMax: 9, pushMin: 3, pushMax: 9, moveMin: 5, moveMax: 32, stateCap: 100_000, timeCapMs: 3_000 },
  { pack: 'medium', total: 55, wMin: 9, wMax: 12, hMin: 9, hMax: 12, boxesMin: 3, boxesMax: 6, wallsMin: 1, wallsMax: 4, pullsMin: 8, pullsMax: 15, pushMin: 7, pushMax: 16, moveMin: 14, moveMax: 62, stateCap: 200_000, timeCapMs: 5_000 },
  { pack: 'hard', total: 50, wMin: 11, wMax: 13, hMin: 11, hMax: 13, boxesMin: 5, boxesMax: 7, wallsMin: 3, wallsMax: 6, pullsMin: 10, pullsMax: 14, pushMin: 8, pushMax: 26, moveMin: 22, moveMax: 130, stateCap: 300_000, timeCapMs: 7_000 },
]

const NAME_POOL = [
  '微光', '星愿', '回廊', '灯塔', '渡口', '阶梯', '花园', '月台', '风车', '港湾',
  '竹林', '溪谷', '山丘', '麦田', '彩虹', '云朵', '糖果', '铃铛', '口袋', '阁楼',
  '庭院', '走廊', '广场', '小桥', '流水', '沙滩', '星空', '晨曦', '暮色', '晚霞',
  '露珠', '嫩芽', '萤火', '蝉鸣', '落叶', '初雪', '暖阳', '清风', '明月', '繁星',
  '涟漪', '松林', '花海', '石径', '苔痕', '檐角', '窗棂', '书页', '茶烟', '琴声',
  '棋局', '画卷', '信笺', '船歌', '候鸟', '潮汐', '珊瑚', '琥珀', '雾凇', '山泉',
]

// 前 15 个手工精调关卡：保留原名与 par
const EXISTING_META: Record<string, { name: string; par: number }> = {
  'tutorial/1.xsb': { name: '往前推', par: 2 },
  'tutorial/2.xsb': { name: '绕到箱子后面', par: 4 },
  'tutorial/3.xsb': { name: '两个宝盒', par: 4 },
  'tutorial/4.xsb': { name: '从上往下推', par: 11 },
  'easy/1.xsb': { name: '左右开弓', par: 10 },
  'easy/2.xsb': { name: '三星连珠', par: 14 },
  'easy/3.xsb': { name: '竖井搬运', par: 15 },
  'easy/4.xsb': { name: '双子星', par: 18 },
  'easy/5.xsb': { name: '长征', par: 26 },
  'medium/1.xsb': { name: '四宝归位', par: 25 },
  'medium/2.xsb': { name: '断桥', par: 26 },
  'medium/3.xsb': { name: '回廊', par: 26 },
  'medium/4.xsb': { name: '灯塔', par: 29 },
  'medium/5.xsb': { name: '阶梯', par: 30 },
  'medium/6.xsb': { name: '微光大厅', par: 34 },
}

export interface GenState {
  seeds: Partial<Record<PackId, number>>
  /** par 缓存：相对路径 → 求解器最少步数（避免 writeManifest 重复求解） */
  pars?: Record<string, number>
}

const STATE_FILE = new URL('./.levelgen-state.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
export const LEVELS_ROOT = new URL('../public/levels', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const MANIFEST_FILE = new URL('../game/core/levels-manifest.gen.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

export function loadState(): GenState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as GenState
  } catch {
    return { seeds: {} }
  }
}

export function saveState(s: GenState): void {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
}

export function listLevelFiles(pack: PackId): number[] {
  const dir = join(LEVELS_ROOT, pack)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.xsb'))
    .map((f) => parseInt(f, 10))
    .filter((n) => Number.isInteger(n))
    .sort((a, b) => a - b)
}

/** 质量过滤：布局退化 / 难度不符 / 死角过多 */
export function qualityOk(level: ParsedLevel, res: SolveResult, t: PackTarget): boolean {
  if (res.pushes < t.pushMin || res.pushes > t.pushMax) return false
  if (res.moves < t.moveMin || res.moves > t.moveMax) return false
  if (level.width > t.wMax || level.height > t.hMax) return false
  const dead = computeDeadSquares(level)
  let floorCount = 0
  let deadCount = 0
  for (let i = 0; i < level.cells.length; i++) {
    if (walkableCell(level, i)) floorCount++
    if (dead[i]) deadCount++
  }
  if (deadCount / Math.max(1, floorCount) > 0.5) return false
  let minX = 99
  let minY = 99
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (level.cells[y * level.width + x] !== 'void') {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const bw = maxX - minX + 1
  const bh = maxY - minY + 1
  if (bw < level.width * 0.8 || bh < level.height * 0.8) return false
  if (level.goals.length >= 3) {
    const sameRow = level.goals.every((g) => g.y === level.goals[0]!.y)
    const sameCol = level.goals.every((g) => g.x === level.goals[0]!.x)
    if (sameRow || sameCol) return false
  }
  let maxDist = 0
  for (const a of level.boxStarts) {
    for (const b of level.boxStarts) {
      maxDist = Math.max(maxDist, Math.abs(a.x - b.x) + Math.abs(a.y - b.y))
    }
  }
  if (level.boxStarts.length >= 2 && maxDist < 3) return false
  const ratio = floorCount / (level.width * level.height)
  if (ratio < 0.18 || ratio > 0.72) return false
  return true
}

/** 重新生成 manifest（边生成边更新）；pars 为 相对路径→最少步数 的缓存，命中则跳过求解 */
export function writeManifest(pars?: Record<string, number>): void {
  const metas: LevelMeta[] = []
  for (const t of TARGETS) {
    for (const n of listLevelFiles(t.pack)) {
      const rel = `${t.pack}/${n}.xsb`
      const file = `/levels/${rel}`
      const existing = EXISTING_META[rel]
      if (existing) {
        metas.push({ id: `${t.pack}-${n}`, pack: t.pack, num: n, name: existing.name, par: existing.par, file })
        continue
      }
      let minMoves = pars?.[rel]
      if (minMoves === undefined) {
        const text = readFileSync(join(LEVELS_ROOT, rel), 'utf-8')
        const level = parseXsb(text)
        const res = solveLevel(level, 600_000, 15_000)
        minMoves = res?.moves
        if (res && pars) pars[rel] = res.moves
      }
      const par = minMoves !== undefined ? Math.max(2, Math.ceil(minMoves * 1.25)) : undefined
      const poolIdx = (n - 1) % NAME_POOL.length
      const round = Math.floor((n - 1) / NAME_POOL.length)
      const name = NAME_POOL[poolIdx]! + (round > 0 ? `·${['Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'][round - 1] ?? round + 1}` : '')
      metas.push({ id: `${t.pack}-${n}`, pack: t.pack, num: n, name, par, file })
    }
  }
  const lines = metas
    .map(
      (m) =>
        `  { id: '${m.id}', pack: '${m.pack}', num: ${m.num}, name: '${m.name}', par: ${m.par ?? 'undefined'}, file: '${m.file}' },`,
    )
    .join('\n')
  const out = `// 由 scripts/box-puzzle-tools.ts 的 batch 模式自动生成，请勿手工修改
// par = ceil(求解器最少步数 × 1.25)；前 15 个手工关保留原始 par

import type { LevelMeta } from './types'

export const GENERATED_LEVELS: LevelMeta[] = [
${lines}
]
`
  writeFileSync(MANIFEST_FILE, out)
}

export function batch(budgetSec: number): void {
  const deadline = Date.now() + budgetSec * 1000
  const state = loadState()
  const pars = (state.pars ??= {})

  const hashes = new Set<string>()
  const counts = new Map<PackId, number>()
  for (const t of TARGETS) {
    const nums = listLevelFiles(t.pack)
    counts.set(t.pack, nums.length)
    for (const n of nums) {
      const level = parseXsb(readFileSync(join(LEVELS_ROOT, t.pack, `${n}.xsb`), 'utf-8'))
      hashes.add(levelHash(level))
    }
  }

  let attempts = 0
  let accepted = 0
  outer: for (const t of TARGETS) {
    while ((counts.get(t.pack) ?? 0) < t.total) {
      if (Date.now() > deadline) break outer
      attempts++
      const seed = (state.seeds[t.pack] ?? 1) + 1
      state.seeds[t.pack] = seed
      const rnd = mulberry32(seed * 7919 + 13)
      const pick = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
      // 先定箱子数，再按面积选尺寸（避免大箱数挤小图导致拉箱失败）
      const boxes = pick(t.boxesMin, t.boxesMax)
      const walls = pick(t.wallsMin, t.wallsMax)
      let w = 0
      let h = 0
      for (let tries = 0; tries < 20; tries++) {
        w = pick(t.wMin, t.wMax)
        h = pick(t.hMin, t.hMax)
        if ((w - 2) * (h - 2) >= boxes * 9 + walls * 2 + 6) break
      }
      if ((w - 2) * (h - 2) < boxes * 9 + walls * 2 + 6) continue
      const xsb = generate({
        w,
        h,
        boxes,
        interiorWalls: walls,
        pulls: pick(t.pullsMin, t.pullsMax),
        seed,
      })
      if (!xsb) continue
      let level: ParsedLevel
      try {
        level = parseXsb(xsb)
      } catch {
        continue
      }
      const hv = levelHash(level)
      if (hashes.has(hv)) continue
      const res = solveLevel(level, t.stateCap, t.timeCapMs)
      if (!res) continue
      if (!qualityOk(level, res, t)) continue

      const n = (counts.get(t.pack) ?? 0) + 1
      const dir = join(LEVELS_ROOT, t.pack)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${n}.xsb`), `${t.pack} 第 ${n} 关\n${xsb}\n`)
      hashes.add(hv)
      counts.set(t.pack, n)
      accepted++
      pars[`${t.pack}/${n}.xsb`] = res.moves
      saveState(state)
      writeManifest(pars)
      console.log(
        `[${new Date().toISOString().slice(11, 19)}] ${t.pack} ${n}/${t.total}  seed=${seed} ${w}x${h} 箱=${boxes} 推箱=${res.pushes} 步数=${res.moves} 状态=${res.states}`,
      )
    }
  }
  saveState(state)
  writeManifest(state.pars)
  const summary = TARGETS.map((t) => `${t.pack} ${counts.get(t.pack)}/${t.total}`).join('  ')
  console.log(`\n本轮：尝试 ${attempts} 次，新增 ${accepted} 关。进度：${summary}`)
}
