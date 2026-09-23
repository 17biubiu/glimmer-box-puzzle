// 开发工具（非游戏运行时代码）：引擎冒烟测试
// 验证 move / push / win / undo / 撤销上限=4 / 星级计算
// 打包运行：esbuild --bundle 后 node 执行（见 README）

import { parseXsb } from '../game/core/xsb-parser'
import { SokobanEngine, MAX_UNDO } from '../game/core/engine'
import { computeStars } from '../game/core/stars'

let failures = 0
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ✅ ${msg}`)
  else {
    console.log(`  ❌ ${msg}`)
    failures++
  }
}

// 1) 基本推箱 + 胜利
{
  console.log('用例 1：单箱直线推')
  const lv = parseXsb('#####\n#@$.#\n#####')
  const e = new SokobanEngine(lv)
  const r = e.tryMove('right')
  assert(r.moved && r.pushed, '向右移动并推动箱子')
  assert(r.won && e.isWin(), '箱子到目标点后胜利')
  assert(e.moves === 1 && e.pushes === 1, '计数器 moves=1 pushes=1')
  assert(e.undo(), '可撤销')
  assert(e.moves === 0 && e.pushes === 0 && !e.isWin(), '撤销后计数器与棋盘回退')
  assert(e.player.x === 1 && e.boxes[0]!.x === 2, '玩家与箱子位置复原')
}

// 2) 撞墙 / 箱子顶箱子 / 不能拉
{
  console.log('用例 2：非法移动')
  const lv = parseXsb('#####\n#@$.#\n#####')
  const e = new SokobanEngine(lv)
  const r = e.tryMove('left')
  assert(!r.moved && e.moves === 0, '撞墙不计步')
  const lv2 = parseXsb('#######\n#@$$..#\n#######')
  const e2 = new SokobanEngine(lv2)
  const r2 = e2.tryMove('right')
  assert(!r2.moved && e2.moves === 0 && e2.pushes === 0, '一次只能推一个箱子')
}

// 3) 撤销上限 4
{
  console.log('用例 3：撤销历史上限 4')
  const lv = parseXsb('#######\n#     #\n# @$. #\n#     #\n#######')
  const e = new SokobanEngine(lv)
  // 上下走动 6 步
  e.tryMove('down')
  e.tryMove('up')
  e.tryMove('down')
  e.tryMove('up')
  e.tryMove('down')
  e.tryMove('up')
  assert(e.moves === 6, `已走 6 步（实际 ${e.moves}）`)
  assert(e.undoLeft === MAX_UNDO, `撤销栈封顶为 ${MAX_UNDO}（实际 ${e.undoLeft}）`)
  let n = 0
  while (e.undo()) n++
  assert(n === MAX_UNDO, `最多只能撤销 ${MAX_UNDO} 步（实际 ${n}）`)
  assert(e.moves === 2, `撤销 4 步后 moves=2（实际 ${e.moves}）`)
}

// 4) 多关卡集合解析（含标题行 + 空行分隔）
{
  console.log('用例 4：xsb 集合解析')
  const text = '第一关\n#####\n#@$.#\n#####\n\n第二关\n######\n# @$ #\n#  . #\n######\n'
  const { parseXsbSet } = await import('../game/core/xsb-parser')
  const chunks = parseXsbSet(text)
  assert(chunks.length === 2, `解析出 2 关（实际 ${chunks.length}）`)
  assert(chunks[0]!.title === '第一关' && chunks[1]!.title === '第二关', '标题行正确提取')
  const lv2 = parseXsb(chunks[1]!.xsb)
  assert(lv2.boxStarts.length === 1 && lv2.goals.length === 1, '第二关箱子/目标解析正确')
}

// 5) 星级
{
  console.log('用例 5：星级评定')
  assert(computeStars(8, 10) === 3, 'moves≤par → 3★')
  assert(computeStars(15, 10) === 2, 'moves≤1.5par → 2★')
  assert(computeStars(16, 10) === 1, '其余 → 1★')
  assert(computeStars(999, undefined) === 3, '无 par → 通关即 3★')
}

console.log(failures === 0 ? '\n引擎冒烟测试全部通过 ✅' : `\n${failures} 项失败 ❌`)
process.exit(failures === 0 ? 0 : 1)
