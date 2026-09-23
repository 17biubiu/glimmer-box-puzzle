// 开发工具 CLI（非游戏运行时代码）—— 库实现见 levelgen-lib.ts
//   solve  —— 复验 public/levels 下所有 .xsb 可解，输出汇总表
//   gen    —— 交互式生成少量候选关卡（调试用）
//   batch  —— 批量生成至各包目标数；边生成边落盘 + 更新清单，可断点续跑
//
// 打包：./node_modules/.bin/esbuild scripts/sokoban-tools.ts --bundle --platform=node --format=esm --outfile=.tmp/tools.mjs

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseXsb } from '../game/core/xsb-parser'
import type { PackId } from '../game/core/types'
import { LEVELS_ROOT, batch, generate, listLevelFiles, solveLevel } from './levelgen-lib'

const mode = process.argv[2] ?? 'solve'

if (mode === 'solve') {
  const packs: PackId[] = ['tutorial', 'easy', 'medium', 'hard']
  let fail = 0
  let total = 0
  for (const pack of packs) {
    const nums = listLevelFiles(pack)
    if (!nums.length) continue
    let minM = Infinity
    let maxM = 0
    let minP = Infinity
    let maxP = 0
    for (const n of nums) {
      const f = join(LEVELS_ROOT, pack, `${n}.xsb`)
      total++
      try {
        const level = parseXsb(readFileSync(f, 'utf-8'))
        const res = solveLevel(level, 600_000)
        if (!res) {
          console.log(`FAIL  ${pack}/${n}.xsb  超出搜索上限`)
          fail++
        } else {
          minM = Math.min(minM, res.moves)
          maxM = Math.max(maxM, res.moves)
          minP = Math.min(minP, res.pushes)
          maxP = Math.max(maxP, res.pushes)
        }
      } catch (e) {
        console.log(`ERROR ${pack}/${n}.xsb  ${(e as Error).message}`)
        fail++
      }
    }
    console.log(`${pack.padEnd(9)} 关数=${String(nums.length).padStart(3)}  步数 ${minM}–${maxM}  推箱 ${minP}–${maxP}`)
  }
  console.log(`\n共 ${total} 关，${fail === 0 ? '全部可解 ✅' : `${fail} 关失败 ❌`}`)
  process.exit(fail === 0 ? 0 : 1)
} else if (mode === 'batch') {
  batch(Number(process.argv[3] ?? 240))
} else if (mode === 'gen') {
  const [seedStart, count, w, h, boxes, walls, pulls] = process.argv.slice(3).map(Number)
  let made = 0
  for (let seed = seedStart!; made < count! && seed < seedStart! + count! * 200; seed++) {
    const xsb = generate({ w: w!, h: h!, boxes: boxes!, interiorWalls: walls!, pulls: pulls!, seed })
    if (!xsb) continue
    const level = parseXsb(xsb)
    const res = solveLevel(level)
    if (!res) continue
    made++
    console.log(`--- seed=${seed} 推箱=${res.pushes} 步数=${res.moves}`)
    console.log(xsb)
  }
}
