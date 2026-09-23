// 推箱子游戏引擎 —— 纯 TypeScript，框架无关
// 规则：经典 2D 网格推箱子。一次只能推一个箱子，不能拉箱子，
// 全部箱子位于目标点即胜利。撤销历史上限 4 步。

import type { Direction, MoveRecord, MoveResult, ParsedLevel, Point } from './types'
import { DIR_VECTORS } from './types'

export const MAX_UNDO = 4

export class SokobanEngine {
  readonly level: ParsedLevel
  player: Point
  /** 箱子位置数组，下标稳定（与渲染层一一对应） */
  boxes: Point[]
  moves = 0
  pushes = 0
  private history: MoveRecord[] = []

  constructor(level: ParsedLevel) {
    this.level = level
    this.player = { ...level.playerStart }
    this.boxes = level.boxStarts.map((b) => ({ ...b }))
  }

  private cellAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return 'wall' as const
    return this.level.cells[y * this.level.width + x]!
  }

  isWalkable(x: number, y: number): boolean {
    const c = this.cellAt(x, y)
    return c === 'floor' || c === 'goal'
  }

  boxIndexAt(x: number, y: number): number {
    return this.boxes.findIndex((b) => b.x === x && b.y === y)
  }

  isGoal(x: number, y: number): boolean {
    return this.cellAt(x, y) === 'goal'
  }

  /** 剩余可撤销步数 */
  get undoLeft(): number {
    return this.history.length
  }

  /** 尝试朝某方向移动一格；若前方是箱子则尝试推动 */
  tryMove(dir: Direction): MoveResult {
    const d = DIR_VECTORS[dir]
    const nx = this.player.x + d.x
    const ny = this.player.y + d.y

    if (!this.isWalkable(nx, ny)) {
      return { moved: false, pushed: false, won: false }
    }

    const bi = this.boxIndexAt(nx, ny)
    let record: MoveRecord

    if (bi >= 0) {
      // 前方是箱子：检查箱子前方
      const bx = nx + d.x
      const by = ny + d.y
      if (!this.isWalkable(bx, by) || this.boxIndexAt(bx, by) >= 0) {
        return { moved: false, pushed: false, won: false }
      }
      record = {
        dir,
        playerFrom: { ...this.player },
        boxIndex: bi,
        boxFrom: { ...this.boxes[bi]! },
        pushed: true,
      }
      this.boxes[bi] = { x: bx, y: by }
      this.player = { x: nx, y: ny }
      this.moves += 1
      this.pushes += 1
    } else {
      record = { dir, playerFrom: { ...this.player }, boxIndex: -1, boxFrom: null, pushed: false }
      this.player = { x: nx, y: ny }
      this.moves += 1
    }

    this.history.push(record)
    if (this.history.length > MAX_UNDO) this.history.shift()

    return { moved: true, pushed: record.pushed, won: this.isWin() }
  }

  /** 撤销一步：回退棋盘并扣减计数器 */
  undo(): boolean {
    const rec = this.history.pop()
    if (!rec) return false
    this.player = { ...rec.playerFrom }
    if (rec.pushed && rec.boxIndex >= 0 && rec.boxFrom) {
      this.boxes[rec.boxIndex] = { ...rec.boxFrom }
      this.pushes = Math.max(0, this.pushes - 1)
    }
    this.moves = Math.max(0, this.moves - 1)
    return true
  }

  isWin(): boolean {
    return this.boxes.every((b) => this.isGoal(b.x, b.y))
  }

  /** 序列化当前局面（供调试/求解器） */
  key(): string {
    const bs = this.boxes
      .map((b) => `${b.x},${b.y}`)
      .sort()
      .join(';')
    return `${this.player.x},${this.player.y}|${bs}`
  }
}
