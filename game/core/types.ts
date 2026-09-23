// 游戏核心类型定义 —— 纯 TypeScript，不依赖 Vue / Nuxt / Three.js

export type CellKind = 'wall' | 'floor' | 'goal' | 'void'

export interface Point {
  x: number // 列（横向）
  y: number // 行（纵向）
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIR_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** 解析后的关卡静态数据 */
export interface ParsedLevel {
  width: number
  height: number
  /** 按 y * width + x 排列的格子类型 */
  cells: CellKind[]
  playerStart: Point
  /** 初始箱子位置（顺序稳定，作为箱子 id） */
  boxStarts: Point[]
  goals: Point[]
}

/** 单步移动记录（用于撤销） */
export interface MoveRecord {
  dir: Direction
  playerFrom: Point
  /** 被推动的箱子下标；未推动为 -1 */
  boxIndex: number
  boxFrom: Point | null
  pushed: boolean
}

export interface MoveResult {
  moved: boolean
  pushed: boolean
  won: boolean
}

export type PetKind = 'cat' | 'dog' | 'rabbit' | 'lizard'

export const PETS: { id: PetKind; name: string; emoji: string; food: string; foodEmoji: string }[] = [
  { id: 'cat', name: '小猫', emoji: '🐱', food: '鱼肉零食', foodEmoji: '🐟' },
  { id: 'dog', name: '小狗', emoji: '🐶', food: '狗狗饼干', foodEmoji: '🦴' },
  { id: 'rabbit', name: '兔子', emoji: '🐰', food: '提摩西草', foodEmoji: '🌿' },
  { id: 'lizard', name: '蜥蜴', emoji: '🦎', food: '昆虫零食', foodEmoji: '🦗' },
]

export type PackId = 'tutorial' | 'easy' | 'medium' | 'hard'

export interface PackInfo {
  id: PackId
  name: string
  desc: string
  color: string
  emoji: string
}

export const PACKS: PackInfo[] = [
  { id: 'tutorial', name: '教程', desc: '学会推箱基本功', color: '#69f0ae', emoji: '🌱' },
  { id: 'easy', name: '简单', desc: '轻轻松松开动脑筋', color: '#40c4ff', emoji: '🌤️' },
  { id: 'medium', name: '中等', desc: '需要一点策略哦', color: '#ffab40', emoji: '🔥' },
  { id: 'hard', name: '困难', desc: '推箱子大师的试炼', color: '#ff6f61', emoji: '💎' },
]

export interface LevelMeta {
  /** 全局唯一 id，如 tutorial-1 */
  id: string
  pack: PackId
  /** 包内序号，从 1 开始 */
  num: number
  name: string
  /** 三星步数标准；undefined 表示通关即三星 */
  par?: number
  /** xsb 文件路径（public 下） */
  file: string
  challenge?: number
  minPushes?: number
  solutionMoves?: number
  boxCount?: number
  stage?: string
}
