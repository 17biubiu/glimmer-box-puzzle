// 标准 .xsb 关卡解析器 —— 纯 TypeScript
// 字符约定：
//   #  墙
//   @  玩家（站在地板上）
//   +  玩家（站在目标点上）
//   $  箱子（在地板上）
//   *  箱子（在目标点上）
//   .  目标点
//   - / _ / 空格  地板
// 多关卡集合：关卡之间用空行分隔；以非墙字符开头且不含关卡字符的“标题行”
// 会作为上一段与下一段的分隔（兼容常见公开关卡集格式）。

import type { CellKind, ParsedLevel, Point } from './types'

const LEVEL_CHARS = new Set(['#', '@', '+', '$', '*', '.', '-', '_'])

function isLevelLine(line: string): boolean {
  const t = line.trim()
  if (t.length === 0) return false
  // 标题行一般不含墙字符；含 # 的几乎一定是关卡行
  return t.includes('#')
}

export interface XsbLevelChunk {
  title?: string
  xsb: string
}

/** 解析可能包含多个关卡的 .xsb 文本 */
export function parseXsbSet(text: string): XsbLevelChunk[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const chunks: XsbLevelChunk[] = []
  let current: string[] = []
  let pendingTitle: string | undefined

  const flush = () => {
    // 去掉首尾全空行
    while (current.length && current[0]!.trim() === '') current.shift()
    while (current.length && current[current.length - 1]!.trim() === '') current.pop()
    if (current.length > 0) {
      chunks.push({ title: pendingTitle, xsb: current.join('\n') })
      pendingTitle = undefined
    }
    current = []
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, '')
    if (line.trim() === '') {
      flush()
      continue
    }
    if (isLevelLine(line)) {
      current.push(line)
    } else {
      // 非关卡行：可能是标题
      flush()
      const t = line.trim()
      if (t.length > 0) pendingTitle = t
    }
  }
  flush()
  return chunks
}

/** 解析单关 xsb 文本为结构化关卡 */
export function parseXsb(xsb: string): ParsedLevel {
  const rows = xsb.replace(/\r\n?/g, '\n').split('\n').filter((r) => r.trim().length > 0)
  if (rows.length === 0) throw new Error('空的 xsb 关卡')

  const height = rows.length
  let width = 0
  for (const r of rows) width = Math.max(width, r.length)

  const cells: CellKind[] = new Array<CellKind>(width * height).fill('void')
  const boxStarts: Point[] = []
  const goals: Point[] = []
  let playerStart: Point | null = null

  for (let y = 0; y < height; y++) {
    const row = rows[y]!
    for (let x = 0; x < width; x++) {
      const ch = x < row.length ? row[x]! : ' '
      const idx = y * width + x
      switch (ch) {
        case '#':
          cells[idx] = 'wall'
          break
        case '.':
          cells[idx] = 'goal'
          goals.push({ x, y })
          break
        case '$':
          cells[idx] = 'floor'
          boxStarts.push({ x, y })
          break
        case '*':
          cells[idx] = 'goal'
          goals.push({ x, y })
          boxStarts.push({ x, y })
          break
        case '@':
          cells[idx] = 'floor'
          playerStart = { x, y }
          break
        case '+':
          cells[idx] = 'goal'
          goals.push({ x, y })
          playerStart = { x, y }
          break
        case ' ':
        case '-':
        case '_':
          cells[idx] = 'floor'
          break
        default:
          cells[idx] = 'void'
          break
      }
    }
  }

  if (!playerStart) throw new Error('xsb 中缺少玩家 (@)')
  if (boxStarts.length === 0) throw new Error('xsb 中缺少箱子 ($)')
  if (boxStarts.length !== goals.length) {
    throw new Error(`箱子数 (${boxStarts.length}) 与目标点数 (${goals.length}) 不一致`)
  }

  // 用洪水填充标记玩家可达区域：不可达的非墙格子记为 void
  // （兼容不规则外形的关卡，避免在墙外渲染地板）
  const reachable = new Array<boolean>(width * height).fill(false)
  const queue: Point[] = [playerStart]
  reachable[playerStart.y * width + playerStart.x] = true
  while (queue.length) {
    const p = queue.pop()!
    for (const d of [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ]) {
      const nx = p.x + d.x
      const ny = p.y + d.y
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const ni = ny * width + nx
      if (reachable[ni]) continue
      if (cells[ni] === 'wall' || cells[ni] === 'void') continue
      reachable[ni] = true
      queue.push({ x: nx, y: ny })
    }
  }
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== 'wall' && !reachable[i]) cells[i] = 'void'
  }

  // 校验所有箱子都在可达区域内
  for (const b of boxStarts) {
    if (!reachable[b.y * width + b.x]) {
      throw new Error(`箱子 (${b.x},${b.y}) 不在可达区域内`)
    }
  }

  return { width, height, cells, playerStart, boxStarts, goals }
}

/** 便捷：解析多关卡文本并直接返回 ParsedLevel 数组 */
export function parseXsbSetLevels(text: string): { title?: string; level: ParsedLevel }[] {
  return parseXsbSet(text).map((c) => ({ title: c.title, level: parseXsb(c.xsb) }))
}
