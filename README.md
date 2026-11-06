# Z80Z — 2048 Roguelike

把数字化为力量的地牢爬塔游戏。基于 uni-app、Vue 3、Pinia 和 TypeScript，支持微信小程序与 H5。

## 玩法

- **2048 战斗**：每回合基础 6 步。合并产出的数字累计为攻击，盘面数字之和折算为防御，空格越多速度越快。回合后方块减半，最低为 2。
- **先后手结算**：速度相同时玩家先手；先手致死会阻止后手行动。闪避、吸血、回复、首击减伤和反弹分别结算并显示原因。
- **路线爬塔**：每阶段 10 层加 1 个首领层，纸质墨线地图包含真实分叉与汇合，只能进入虚线相连的节点。三阶段后进入无尽模式。
- **装备与成长**：20 套套装、5 部位、3 品质，另有 15 款非套装装备。2/3/5 件效果与描述一致；26 张强化卡、局外升级、怪物图鉴。
- **事件选择**：先显示明确成本与收益，再一次性确认。金币不足或无可重铸装备时选项不可用，不会隐式欠债。
- **种子复现**：同一初始存档、种子和操作序列得到相同游戏结果；随机按节点、回合和刷新次数隔离。UI 动画 ID 不属于玩法结果。

## 开发与构建

要求 **Node.js ≥22.12**（已在 Node 24.18 验证）。项目保留 HBuilderX 的根目录布局，同时提供锁定版本的官方 uni-app 命令行工具链。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run dev:h5                 # http://127.0.0.1:5173/
npm run build:h5
npm run preview:h5             # http://127.0.0.1:4173/
npm run build:mp-weixin
```

生成目录：

- `unpackage/dist/build/h5`：正式 H5 静态资源。
- `unpackage/dist/build/mp-weixin`：在微信开发者工具中导入。

也可用 HBuilderX 导入项目运行。`manifest.json` 的 appid 保持 `touristappid`；发布者需要自行配置真实小程序 appid。默认关闭 uni 统计，开发服务仅监听本机。

**操作**：手机滑动棋盘；H5 支持鼠标左键按住拖动及方向键。战斗中不可换装。界面支持浅/深色及阶段配色，系统开启减少动态效果时关闭位移特效。调试面板只在命令行开发模式开放，正式构建无调试入口且调试动作无效。

## 结构

```text
core/              纯棋盘、战斗、装备、路线、敌人、事件、随机、升级逻辑
store/             游戏状态与奖励队列；独立 development-only 调试动作
components/        UI 面板及 screens/ 下的屏幕
pages/index/       页面外壳、屏幕切换、工具栏
utils/             防御性本地存档读取与保存
static/            本地资源，无外链依赖
tools/             测试、模拟、统计、官方构建入口
```

`store.player` 保存基础属性，`store.effectivePlayer` 统一计算装备和套装后的属性。UI 与战斗预览都使用同一计算路径，穿脱装备不回满血，也不会重复叠加属性。

## 验证

```bash
npm test                       # 15 组单元/回归测试
npm run typecheck              # 核心、store、类型、storage
npm run simulate               # 固定种子快照 + 重复种子校验
npm run parity                 # 200 种子，每种子复跑 + 历史可比指标
```

默认模拟与统计命令是**只读验证**：差异会失败，不会把错误静默写成新基线。只有在明确审核规则改动后执行：

```bash
node tools/simulate.mjs --update-baseline
node tools/parity.mjs record
```

`parity-before.json` 保存原版统计。新版将获胜战斗回合与死亡战斗回合分开记录，前者用于与旧版对比；有效步数统计包含全部回合，不再仅计算最后一回合。

**统计限制**：自动策略固定选择首个节点、循环方向、不购买装备，不代表真人通关率，也不充分覆盖套装流派的数值平衡。装备效果另有逐套、逐阈值与结算回归测试。

## 本轮改进

详见 [IMPROVEMENTS.md](./IMPROVEMENTS.md)：机制修复、视觉交互、测试结果、基线变化和未验证范围。纸质分叉地图另见 [MAP_IMPROVEMENTS.md](./MAP_IMPROVEMENTS.md)。怪物、装备和场景美术见 [ART_IMPROVEMENTS.md](./ART_IMPROVEMENTS.md)。

局外存档键保持 `z80z_meta`。旧的数字型无尽首领 ID 可迁移至稳定物种 ID；无法反推物种的旧随机普通怪 ID 原样保留，不凭空合并或删除记录。当前仍仅持久化局外成长，不自动保存进行中的冒险。
