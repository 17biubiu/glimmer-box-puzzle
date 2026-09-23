# 关卡版权说明（LICENSE NOTE）

## 现状（2026-09-23 核实）

本目录下 `tutorial/`、`easy/`、`medium/`、`hard/` 共 167 个 `.xsb` 棋盘，
**并非全部为本项目原创**。逐项核实结果：

- **例外：`tutorial/1.xsb`（往前推）**
  其棋盘与 David W. Skinner 的公开关卡集 **Microban 第 44 关（'Duh!'，
  2000 年 4 月修订）完全一致**（含玩家初始位置）。Microban 的常见再分发
  条款为“注明作者 David W. Skinner 即可自由再分发”；商用发布前应以作者
  原始发布页（http://users.bentonrea.com/~sasquatch/sokoban/）的条款为准
  再次确认。处理方式二选一：
  1. 保留该关并按下方登记表署名（当前选择）；
  2. 用新棋盘替换，并分配新的关卡 ID，避免旧成绩和奖励绑定到新棋盘。
- **其余 166 个棋盘**：15 个手工设计关 + 仓库内反向拉箱生成器
  （`scripts/levelgen-lib.ts`）产出，已做规范化（旋转 / 镜像 / 平移等价，
  含与不含玩家初始位置两种口径）比对，在以下公开关卡集中均无命中：
  Microban（155 关）、Sasquatch（50 关）、Microcosmos、Minicosmos、
  Picokosmos、Nabokosmos（Aymeric du Peloux）、
  Original + Extra（97 关，Thinking Rabbit）。
  比对方法：裁剪包围盒后按 8 种旋转 / 镜像变换规范化，
  含与不含玩家初始位置两种口径分别比对（脚本与参考集快照为本地临时文件，
  未入库，不进入发布包）。

当前正式课程由 `game/core/levels-curriculum.gen.ts` 指定，共 155 关；
目录还保留被 12 个 `hard/challenge-*.xsb` 替换的旧棋盘文件，不进入正式课程。
新增关卡由 `scripts/curate-levels.ts` 调用同一仓库内生成器产生。

## 第三方关卡登记

| 关卡文件 | 来源集合 | 作者 | 对应原关 | 许可 / 条款 | 署名要求 |
| --- | --- | --- | --- | --- | --- |
| `tutorial/1.xsb` | Microban（2000 年 4 月修订） | David W. Skinner | Level 44 'Duh!' | 署名后可自由再分发（以作者原始发布页条款为准） | 注明 "Level by David W. Skinner (Microban #44)" |

## 后续引入第三方关卡时

- **公开 .xsb 关卡集**（如 Microban、Sasquatch 等）
  在商用前必须**逐集合核实许可证**（作者授权 / CC / 公有领域等），
  并在本文件的登记表中记录每个集合的来源、作者、许可证与署名要求。
- 在许可证核实完成前，不得将任何第三方关卡集打包进正式发布版本。
- 替换棋盘必须使用新的关卡 ID，避免旧成绩和奖励绑定到新棋盘。
- 替换关卡后运行 `npm run test:levels` 验证正式清单的可解性、旋转/镜像去重和难度。
  `par` 依据最少推箱解中的参考步数校准，不宣称为无条件全局最少步数。
