# 微光纪念宝盒 · 宠物推箱子

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md)

一个宠物纪念主题的 3D 卡通推箱子小游戏，基于 Nuxt 3 + 原生 Three.js。带着你的宠物小伙伴，把发光的「微光纪念宝盒」推到星光之处。

更多背景内容和延伸信息可以在[paw & ever](https://www.pawandever.com/?ref=box-puzzle-readme)继续查看。

## 运行

```bash
npm install
npm run dev                # 开发服务器
npm run dev:clean          # 清理 .nuxt/.output/.tmp 后再启动开发服务器
npm run dev -- --port 7100 --host 127.0.0.1
npm run dev:host           # 监听局域网
npm run build              # 生产构建
npm run preview            # 预览生产构建
npm test                   # 引擎、存档、奖励、模型及关卡编排回归
node scripts/regression-red.mjs
npm run test:levels        # 正式关卡可解性、对称去重、难度及三星标准
npm run typecheck          # Vue / TypeScript 类型检查
npm run test:ui            # Chrome 页面交互回归
```

## GitHub Pages 部署

- 仓库已补充 `main` 分支自动部署工作流：`.github/workflows/deploy-pages.yml`
- 触发方式：合并到 `main` 或直接 push 到 `main` 后自动构建并部署；也支持手动触发 `workflow_dispatch`
- 构建命令：`npm run generate`
- 默认 GitHub Pages 地址：`https://17biubiu.github.io/glimmer-box-puzzle/`
- 首次启用时，需要在 GitHub 仓库 `Settings > Pages` 中把 `Source` 设为 `GitHub Actions`

## 操作

- 桌面：方向键 / WASD 移动，`Z` 或 `U` 撤销（最多 4 步）
- 手机：在棋盘上滑动，或使用棋盘下方方向盘
- 顶部 HUD：步数 / 推箱数 / 撤销 / 重新开始 / 静音 / 小贴士 / 返回选关
- 所有选择按钮支持 Tab、Enter、Space；弹窗锁定焦点，Escape 可关闭确认框和小贴士
- 移动 140ms、推箱 180ms，宠物稳定面向镜头，仅保留轻微足部动作和发力倾斜
- 系统开启“减少动态效果”时会关闭装饰动画；网页允许缩放

## 规则与系统

- 经典推箱子：一次推一个箱子，不能拉；全部宝盒归位即胜利
- 星级：`步数 ≤ par` 得 3★，`≤ round(par × 1.5)` 得 2★，其余 1★；无 par 关卡通关即 3★
- 撤销历史上限 4 步，撤销会同时回退棋盘与步数 / 推箱计数
- 进度保存在 localStorage（当前 key：`glimmer-box-puzzle.v2`，兼容旧版存档迁移）
- 4 个难度包：教程 10 关、简单 40 关、中等 55 关、困难 50 关，共 155 关
- 4 只程序化宠物（猫 / 狗 / 兔子 / 蜥蜴），首页、游戏内和奖励展示共用同一套模型
- 每只宠物每关首次通关按星级奖励 1 到 3 份食物，升星补差额；同星或更低星级重玩不会重复发放
- 音频全部由 Web Audio 振荡器实时合成，零音频文件
- 知识小卡与界面文案已接入 i18n，当前支持中、英、日、法、德五种语言

## 关卡梯度

正式课程仍为 155 关，排除旋转、镜像和同一可达区起点变化造成的等价重复。  
难度分数为 `最少推箱数 × 4 + 参考解步数 + 箱子数 × 6`，每个包按分数递增，标记为「起步 / 进阶 / 挑战」。

| 难度包 | 参考解步数 | 最少推箱数 |
| --- | --- | --- |
| 教程 | 1-10 | 1-4 |
| 简单 | 6-24 | 2-8 |
| 中等 | 15-38 | 7-11 |
| 困难 | 22-60 | 8-21 |

困难包新增 12 个紧凑挑战关。求解器先最小化推箱数，再在这些解中最小化行走步数，因此“参考解步数”不是无条件全局最少步数。

## 项目结构

```text
game/core/        纯 TypeScript 游戏核心
  types.ts        类型与常量（宠物 / 难度包 / 关卡元数据）
  xsb-parser.ts   .xsb 解析器
  engine.ts       推箱子引擎
  stars.ts        星级评定
  storage.ts      localStorage 存档
  levels.ts       关卡清单与 par
  levels-curriculum.gen.ts  正式课程顺序、稳定 ID、求解指标
game/render/      Three.js 渲染层
game/audio/       Web Audio 程序化音频
pages/            首页 / 选关 / 游戏页
components/       宠物预览、奖励展示、原生对话框、知识小卡、语言切换器
composables/      存档和 i18n 封装
i18n/locales/     中英日法德语言包
public/levels/    正式课程源文件与保留旧关卡（含 LICENSE-NOTE.md）
scripts/          开发工具、回归测试、关卡编排脚本
```

## 开发工具用法

```bash
# 打包工具脚本（使用 Nuxt 自带 esbuild）
./node_modules/.bin/esbuild scripts/box-puzzle-tools.ts --bundle --platform=node --format=esm --outfile=.tmp/tools.mjs
./node_modules/.bin/esbuild scripts/engine-check.ts --bundle --platform=node --format=esm --outfile=.tmp/check.mjs

node .tmp/tools.mjs solve
node .tmp/tools.mjs gen 100 5 8 8 3 1 6 4 9
node .tmp/check.mjs

# 从原始清单和增强关卡重建课程
node node_modules/esbuild/bin/esbuild scripts/curate-levels.ts --bundle --platform=node --format=esm --outfile=.tmp/curate.mjs
node .tmp/curate.mjs --enhance --write
```

浏览器测试要求本机安装 Chrome。`.tmp/` 中保存浏览器截图与失败记录，不属于发布资源。

## 许可证

代码以 [MIT](./LICENSE) 发布。音频为 Web Audio 程序化合成，宠物模型为程序化几何体，不含第三方素材。关卡除 `tutorial/1.xsb` 外均为本项目原创（手工设计或仓库内生成器产出）；`tutorial/1.xsb` 棋盘来自 David W. Skinner 的 Microban 关卡集（#44 'Duh!'），按作者条款署名使用，详见 [public/levels/LICENSE-NOTE.md](./public/levels/LICENSE-NOTE.md)。
