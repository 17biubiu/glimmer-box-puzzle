// 关卡顺序由 curate-levels.ts 根据求解指标编排，id 与原棋盘保持绑定。

import type { LevelMeta, PackId } from './types'
import { CURATED_LEVELS } from './levels-curriculum.gen'

export const LEVELS: LevelMeta[] = CURATED_LEVELS

export function levelsOfPack(pack: PackId): LevelMeta[] {
  return LEVELS.filter((l) => l.pack === pack).sort((a, b) => a.num - b.num)
}

export function findLevel(pack: PackId, num: number): LevelMeta | undefined {
  return LEVELS.find((l) => l.pack === pack && l.num === num)
}

export function nextLevel(meta: LevelMeta): LevelMeta | undefined {
  return findLevel(meta.pack, meta.num + 1)
}
