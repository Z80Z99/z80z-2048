# Z80Z — 2048 Roguelike

把数字化为力量的地牢爬塔游戏。基于 uni-app、Vue 3、Pinia 和 TypeScript，支持微信小程序与 H5。

## 玩法

- **2048 战斗**：每回合基础 6 步。合并产出的数字累计为攻击，盘面数字之和折算为防御，空格越多速度越快。回合后方块减半，最低为 2。
- **先后手结算**：速度相同时玩家先手；先手致死会阻止后手行动。闪避、吸血、回复、首击减伤和反弹分别结算并显示原因。
- **路线爬塔**：每阶段 10 层加 1 个首领层，纸质墨线地图包含真实分叉与汇合，只能进入虚线相连的节点。三阶段后进入无尽模式。
- **装备与成长**：20 套套装、5 部位、3 品质，另有 15 款非套装装备。强化采用白／蓝／金／红／紫／黑六种作用分类，35 张持续卡可无限叠加，另有 2 种即时补给（卡池共 37 个定义）和 5 种携带道具；装备品质与强化分类独立。
- **事件选择**：25 个事件，阶段累计池为 S1 9／S2 19／S3+ 25；新增 10 个事件各 4–5 选。每次只能选一个，预览缓存结果但尚不应用，点「继续前进」才 APPLY；黑卡还须额外确认，当前无预览后取消 action。金币、交易生命成本、紫卡层数或重铸装备不足时禁用，不会隐式欠债。全部选项、成本和奖励见 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md)。
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
npm test                       # 单元/回归测试，自动发现 tools/tests
npm run typecheck              # 核心、store、类型、storage
npm run simulate               # 固定种子快照 + 重复种子校验
npm run parity                 # 200 种子，每种子复跑 + 历史可比指标
```

默认模拟与统计命令是**只读验证**：缺失或不匹配会失败，不会把错误静默写成新基线。规则整合完成、差异报告经审核并明确批准录制后，才选择需要的命令（不是每次规则改动都自动执行）：

```bash
node tools/simulate.mjs --update-baseline
node tools/parity.mjs record
```

当前 `tools/simulate.mjs` 的 `RULE_VERSION` 为 **`sixcolor-v2-events25`**，parity／多策略工具复用该版本；新录制使用 v2 命名空间。`tools/baselines/sixcolor-v1-*.json` 以及旧 `baseline.snapshot.json`、`parity-before.json`、`parity-after.json` 均保留，不覆写。缺失 v2 基线时先用 `--report-only` 审阅真实结果，不用 record 掩盖失败，也不要求重新设计仍保持旧 ±15%。模拟记录实际层数、护甲、道具、损血／治疗、消费及失败原因。

**统计限制**：基础、角落规划、攻击、防御、经济是固定算法策略，均不代表真人通关率或最优构筑。文档保留的旧六色／前期平衡数据不是 25 事件版本的新率，需在当前规则下独立测量。`node tools/balance-strategies.mjs --smoke` 做快速安全检查，`node tools/balance-strategies.mjs --report-only --seeds 50 --holdout-count 50` 运行五策略与独立样本，不覆写基线。本轮27组测试、类型与SFC检查、固定种子／200种子及五策略50＋50种子回归已通过；新版基线已独立录制并复验，v1文件未覆盖。五策略统计为算法结果，不代表真人，完整改前／改后报告随本轮交付包提供。

## 本轮改进

界面减负、棋盘下方道具、属性说明和合并动效见 [UI_MOTION_IMPROVEMENTS.md](./UI_MOTION_IMPROVEMENTS.md)。六色卡片、道具、净化、起始点数与数值见 [SIXCOLOR_RULES.md](./SIXCOLOR_RULES.md)。25事件的全部选项、成本、精确奖励和概率见 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md)，引擎与任务路径汇总见 [PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md)。

详见 [IMPROVEMENTS.md](./IMPROVEMENTS.md)：机制修复、视觉交互、测试结果、基线变化和未验证范围。纸质分叉地图另见 [MAP_IMPROVEMENTS.md](./MAP_IMPROVEMENTS.md)。怪物、装备和场景美术见 [ART_IMPROVEMENTS.md](./ART_IMPROVEMENTS.md)。

局外存档键保持 `z80z_meta`。旧的数字型无尽首领 ID 可迁移至稳定物种 ID；无法反推物种的旧随机普通怪 ID 原样保留，不凭空合并或删除记录。当前仍仅持久化局外成长，不自动保存进行中的冒险。
