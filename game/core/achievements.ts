// 成就与进度统计 —— 纯 TypeScript，不依赖 Vue / Three.js
// 提供各难度包进度统计与「全三星」判定，供选关页与胜利结算页使用。

import type { PackId } from './types'
import { PACKS } from './types'
import type { SaveData } from './storage'
import { levelsOfPack } from './levels'

export interface PackProgress {
  /** 包内总关数 */
  total: number
  /** 已通关数（至少 1★） */
  cleared: number
  /** 3★ 关数 */
  threeStar: number
  /** 是否全 3★（完美通关） */
  perfect: boolean
}

export function packProgress(save: SaveData, pack: PackId): PackProgress {
  const levels = levelsOfPack(pack)
  let cleared = 0
  let threeStar = 0
  for (const l of levels) {
    const s = save.stars[l.id] ?? 0
    if (s > 0) cleared++
    if (s >= 3) threeStar++
  }
  return {
    total: levels.length,
    cleared,
    threeStar,
    perfect: levels.length > 0 && threeStar === levels.length,
  }
}

/** 是否所有难度包全部 3★（游戏大满贯） */
export function allPerfect(save: SaveData): boolean {
  return PACKS.every((p) => packProgress(save, p.id).perfect)
}

/** 总星数 / 总关数（首页或选关页展示用） */
export function overallProgress(save: SaveData): { cleared: number; stars: number; total: number; maxStars: number } {
  let cleared = 0
  let stars = 0
  let total = 0
  for (const p of PACKS) {
    const pr = packProgress(save, p.id)
    cleared += pr.cleared
    stars += levelsOfPack(p.id).reduce((acc, level) => acc + (save.stars[level.id] ?? 0), 0)
    total += pr.total
  }
  return { cleared, stars, total, maxStars: total * 3 }
}
