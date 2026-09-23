// hard 包并行生成 worker（开发工具，非运行时代码）
// 每个 worker 独立按种子流生成候选：生成 → 求解（带硬超时）→ 质量过滤 → 上交主进程

import { parentPort, workerData } from 'node:worker_threads'
import { parseXsb } from '../game/core/xsb-parser'
import { TARGETS, generate, mulberry32, qualityOk, solveLevel } from './levelgen-lib'

const t = TARGETS.find((x) => x.pack === 'hard')!
const { workerId, numWorkers, startSeed } = workerData as { workerId: number; numWorkers: number; startSeed: number }

let seed = startSeed + workerId
for (;;) {
  const r = mulberry32(seed * 7919 + 13)
  const pick = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
  // 箱子数加权：5 箱为主（快），6 箱次之，少量 7 箱
  const br = r()
  const boxes = br < 0.55 ? 5 : br < 0.9 ? 6 : 7
  const walls = pick(t.wallsMin, t.wallsMax)
  let w = 0
  let h = 0
  for (let i = 0; i < 20; i++) {
    w = pick(t.wMin, t.wMax)
    h = pick(t.hMin, t.hMax)
    if ((w - 2) * (h - 2) >= boxes * 9 + walls * 2 + 6) break
  }
  seed += numWorkers
  if ((w - 2) * (h - 2) < boxes * 9 + walls * 2 + 6) continue
  const curSeed = seed - numWorkers
  const xsb = generate({ w, h, boxes, interiorWalls: walls, pulls: pick(t.pullsMin, t.pullsMax), seed: curSeed })
  if (!xsb) continue
  let level
  try {
    level = parseXsb(xsb)
  } catch {
    continue
  }
  const res = solveLevel(level, t.stateCap, t.timeCapMs)
  if (!res) continue
  if (!qualityOk(level, res, t)) continue
  parentPort!.postMessage({ seed: curSeed, xsb, pushes: res.pushes, moves: res.moves, boxes, size: `${w}x${h}` })
}
