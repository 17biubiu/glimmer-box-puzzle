// localStorage 持久化封装 —— 单一命名空间 key，SSR 安全
// 仅保存：解锁进度、每关星级、每关最佳步数/推箱数、选择的宠物、静音设置

import { PETS, type PackId, type PetKind } from './types'
import { LEVELS } from './levels'

const STORAGE_KEY = 'glimmer-box-puzzle.v2'
const LEGACY_STORAGE_KEY = 'glimmer-sokoban.v1'

export interface LevelBest {
  moves: number
  pushes: number
}

export interface SaveData {
  /** 每个包已解锁到的关卡数（从 1 计；0 = 仅第 1 关可用前的初始值见下方逻辑） */
  unlocked: Partial<Record<PackId, number>>
  /** levelId -> 星数 */
  stars: Record<string, number>
  /** levelId -> 最佳成绩 */
  best: Record<string, LevelBest>
  pet: PetKind
  muted: boolean
  food: Record<PetKind, number>
  /** Highest rewarded stars per pet and level; replaying cannot mint food. */
  rewarded: Record<string, number>
  curriculumVersion: 2
  accessible: string[]
}

const DEFAULTS: SaveData = {
  unlocked: {},
  stars: {},
  best: {},
  pet: 'cat',
  muted: false,
  food: { cat: 0, dog: 0, rabbit: 0, lizard: 0 },
  rewarded: {},
  curriculumVersion: 2,
  accessible: [],
}

function isClient(): boolean {
  return typeof window !== 'undefined'
}

function validCounts(value: unknown, max = Number.MAX_SAFE_INTEGER): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([, n]) =>
    typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= max))
}

export function loadSave(): SaveData {
  if (!isClient()) return structuredClone(DEFAULTS)
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULTS)
    const data = JSON.parse(raw) as Partial<SaveData> | null
    if (!data || typeof data !== 'object' || Array.isArray(data)) return structuredClone(DEFAULTS)
    const best = Object.fromEntries(Object.entries(data.best ?? {}).filter(([, b]) =>
      b && Number.isSafeInteger(b.moves) && b.moves >= 0 && Number.isSafeInteger(b.pushes) && b.pushes >= 0))
    const unlocked = validCounts(data.unlocked)
    const rewarded = Object.fromEntries(Object.entries(validCounts(data.rewarded, 3)).filter(([key]) =>
      /^(cat|dog|rabbit|lizard):(tutorial|easy|medium|hard)-[1-9]\d{0,2}(-r2)?$/.test(key)))
    // The receipt ledger is authoritative; a damaged balance cannot create or erase receipts.
    const food = { ...DEFAULTS.food }
    for (const [key, amount] of Object.entries(rewarded)) food[key.split(':')[0] as PetKind] += amount
    const accessible = new Set(Array.isArray(data.accessible)
      ? data.accessible.filter(id => typeof id === 'string' && LEVELS.some(level => level.id === id)) : [])
    if (data.curriculumVersion !== 2) {
      for (const level of LEVELS) {
        const original = /^(tutorial|easy|medium|hard)-(\d+)$/.exec(level.id)
        if (original && Number(original[2]) <= Math.max(1, unlocked[level.pack] ?? 1)) accessible.add(level.id)
      }
    }
    return {
      unlocked,
      stars: validCounts(data.stars, 3),
      best,
      pet: PETS.some((p) => p.id === data.pet) ? data.pet! : 'cat',
      muted: data.muted === true,
      food,
      rewarded,
      curriculumVersion: 2,
      accessible: [...accessible],
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

export function saveAll(data: SaveData): void {
  if (!isClient()) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 存储被禁用等情况：静默失败，不影响游戏
  }
}

/** 某关是否已解锁：包内第 1 关始终解锁，第 N 关需 N-1 已通关（有星级记录） */
export function isLevelUnlocked(save: SaveData, pack: PackId, num: number, levelIdOf: (n: number) => string): boolean {
  const id = levelIdOf(num)
  if ((save.stars[id] ?? 0) > 0 || save.accessible.includes(id)) return true
  if (num <= 1) return true
  const prevStars = save.stars[levelIdOf(num - 1)]
  return (prevStars ?? 0) > 0
}

/** 记录通关：写入星级（取最高）、最佳成绩（取更优）、解锁进度 */
export function recordClear(save: SaveData, levelId: string, pack: PackId, num: number, stars: number, moves: number, pushes: number): number {
  const rewardKey = `${save.pet}:${levelId}`
  const previousReward = save.rewarded[rewardKey] ?? 0
  const reward = Math.max(0, stars - previousReward)
  save.rewarded[rewardKey] = Math.max(previousReward, stars)
  save.food[save.pet] += reward
  save.stars[levelId] = Math.max(save.stars[levelId] ?? 0, stars)
  const prev = save.best[levelId]
  if (!prev || moves < prev.moves || (moves === prev.moves && pushes < prev.pushes)) {
    save.best[levelId] = { moves, pushes }
  }
  save.unlocked[pack] = Math.max(save.unlocked[pack] ?? 0, num + 1)
  saveAll(save)
  return reward
}

export function setPet(save: SaveData, pet: PetKind): void {
  save.pet = pet
  saveAll(save)
}

export function setMuted(save: SaveData, muted: boolean): void {
  save.muted = muted
  saveAll(save)
}
