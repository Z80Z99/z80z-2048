# Z80Z — 2048 Roguelike

基于 2048 玩法的 Roguelike 爬塔游戏，微信小程序（uni-app Vue 3 + Pinia + TypeScript）。

## 玩法

- **2048 战斗**：滑动合并方块积攒攻击力，生成方块积攒防御力，空格数决定出手速度；每回合结束棋盘数值减半，考验合并规划
- **地图爬塔**：每阶段 10 层 + BOSS 层，包含战斗 / 精英 / 商店 / 休息 / 事件节点，3 个手写阶段后进入无尽程序化生成
- **装备系统**：20 套套装 x 5 部位 x 3 品质，2/3/5 件套触发套装效果（吸血、闪避、先手、双倍金币等）；装备带等级与随机属性浮动
- **强化卡**：普通 / 稀有 / 史诗共 26 张，局内三选一成长，可叠加
- **局外成长**：灵魂碎片购买永久升级，怪物图鉴击杀解锁奖励
- **种子随机**：整局使用 Mulberry32 种子 RNG，同一种子结果可复现（含战斗判定）

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | uni-app（Vue 3 组合式 API） |
| 状态 | Pinia |
| 语言 | TypeScript / SCSS |
| 目标平台 | 微信小程序 |

## 项目结构

```
core/            纯游戏逻辑（棋盘、战斗、敌人、路线、强化、装备、事件、随机）
store/           Pinia 状态（gameStore 全量游戏流程 + 纯函数辅助）
types/           类型定义
components/       UI 组件（Board、Tile、各面板、screens/ 下按屏幕拆分）
pages/index/      唯一页面（屏幕切换外壳 + 悬浮工具栏）
tools/            测试基建（node 内存编译 + 整局模拟 + 统计平价）
utils/            本地持久化（uni storage）
```

## 运行

1. 用 HBuilderX 导入本项目
2. 运行到微信开发者工具
3. 发布前将 `manifest.json` 中的 `appid`（当前为游客占位符 `touristappid`）替换为自己的微信小程序 appid

## 测试

项目无构建链路，测试跑在 Node 上（内存转译 TypeScript，可实例化真实 Pinia store）：

```bash
node tools/run-tests.mjs                       # TDD 单测（表征 + 回归 + bugfix）
node tools/simulate.mjs                        # 固定种子整局模拟，输出 SHA-256 回归锚点
node tools/parity.mjs                          # 200 种子统计平价（验证改动不影响数值分布）
node node_modules/typescript/bin/tsc -p tools/tsconfig.check.json   # 类型检查
```

## 说明

- `node_modules/`、`unpackage/`（构建产物）不入库
- `manifest.json` 中的 appid 为占位符，不包含真实小程序凭据
