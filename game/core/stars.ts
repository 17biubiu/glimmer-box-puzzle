// 星级评定 —— 纯 TypeScript
// 规则：Moves ≤ par → 3★；Moves ≤ round(par×1.5) → 2★；否则 1★。
// 未设置 par 的关卡通关即 3★。

export function computeStars(moves: number, par?: number): 1 | 2 | 3 {
  if (par === undefined || par === null) return 3
  if (moves <= par) return 3
  if (moves <= Math.round(par * 1.5)) return 2
  return 1
}

export function starText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars))
}
