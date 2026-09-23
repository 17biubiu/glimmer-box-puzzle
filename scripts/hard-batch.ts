// hard 包并行生成主进程（开发工具，非运行时代码）
// 用法：node .tmp/hard-batch.mjs [预算秒]
// 每接受一关立即写盘 + 更新 manifest + 保存种子游标，可随时中断续跑。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'
import { Worker } from 'node:worker_threads'
import { parseXsb } from '../game/core/xsb-parser'
import {
  LEVELS_ROOT,
  TARGETS,
  levelHash,
  listLevelFiles,
  loadState,
  saveState,
  writeManifest,
} from './levelgen-lib'

const budgetSec = Number(process.argv[2] ?? 240)
const t = TARGETS.find((x) => x.pack === 'hard')!
const deadline = Date.now() + budgetSec * 1000
const state = loadState()
const pars = (state.pars ??= {})

// 跨包去重哈希
const hashes = new Set<string>()
for (const tt of TARGETS) {
  for (const n of listLevelFiles(tt.pack)) {
    try {
      hashes.add(levelHash(parseXsb(readFileSync(join(LEVELS_ROOT, tt.pack, `${n}.xsb`), 'utf-8'))))
    } catch {
      // 忽略坏文件
    }
  }
}

let count = listLevelFiles('hard').length
const startSeed = state.seeds.hard ?? 1
let maxSeed = startSeed
const numWorkers = Math.min(8, Math.max(2, os.cpus().length - 2))
console.log(`hard 现有 ${count}/${t.total}，启动 ${numWorkers} 个 worker，预算 ${budgetSec}s，起始种子 ${startSeed}`)

const workers: Worker[] = []
let done = false

function finish(reason: string) {
  if (done) return
  done = true
  state.seeds.hard = maxSeed + numWorkers
  saveState(state)
  writeManifest(pars)
  for (const w of workers) void w.terminate()
  console.log(`\n结束（${reason}）：hard ${count}/${t.total}，种子游标保存为 ${state.seeds.hard}`)
  process.exit(0)
}

for (let i = 0; i < numWorkers; i++) {
  const w = new Worker(new URL('./hard-worker.mjs', import.meta.url), {
    workerData: { workerId: i, numWorkers, startSeed },
  })
  w.on('message', (msg: { seed: number; xsb: string; pushes: number; moves: number; boxes: number; size: string }) => {
    maxSeed = Math.max(maxSeed, msg.seed)
    if (done || count >= t.total || Date.now() > deadline) return
    let level
    try {
      level = parseXsb(msg.xsb)
    } catch {
      return
    }
    const hv = levelHash(level)
    if (hashes.has(hv)) return
    hashes.add(hv)
    count++
    const dir = join(LEVELS_ROOT, 'hard')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, `${count}.xsb`), `hard 第 ${count} 关\n${msg.xsb}\n`)
    pars[`hard/${count}.xsb`] = msg.moves
    saveState(state)
    writeManifest(pars)
    console.log(
      `[${new Date().toISOString().slice(11, 19)}] hard ${count}/${t.total}  seed=${msg.seed} ${msg.size} 箱=${msg.boxes} 推箱=${msg.pushes} 步数=${msg.moves}`,
    )
    if (count >= t.total) finish('达成目标')
  })
  w.on('error', (e) => console.error('worker 错误：', e.message))
  workers.push(w)
}

const timer = setInterval(() => {
  if (Date.now() > deadline) finish('预算用尽')
}, 1000)
timer.unref?.()

if (!existsSync(join(LEVELS_ROOT, 'hard'))) mkdirSync(join(LEVELS_ROOT, 'hard'), { recursive: true })
