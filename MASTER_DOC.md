# Z80Z 项目总文档（合并版）

> **汇总阅读入口**：本文件由 `tools/gen-master-doc.mjs` 从 10 份源文档机械合并生成（默认 `--check` 只读校验，`--write` 才写入）。**内容修正一律改源文档后重新生成**：事件表改 `core/events.ts` → `node tools/gen-events-guide.mjs --write` → `node tools/gen-master-doc.mjs --write`；其余部分直接改源 md 再同步总文档。若文档与代码冲突，以代码为准并回填源文档（沿用 AGENTS.md 约定）。
>
> 各源文档原样保留、并行维护；本总文档只是合并视图，不替代任何源文件。

## 目录

- [第1部分 · 项目总览](#part-1)
- [第2部分 · 协作约定](#part-2)
- [第3部分 · 系统知识库](#part-3)
- [第4部分 · 六色强化与消耗品详单](#part-4)
- [第5部分 · 奇遇事件指南](#part-5)（自动生成表）
- [第6部分 · 历史改进总记录](#part-6)（历史记录）
- [第7部分 · 界面减负与合并动效](#part-7)（历史记录）
- [第8部分 · 纸质分叉地图](#part-8)（历史记录）
- [第9部分 · 怪物、物品与场景美术](#part-9)（历史记录）
- [第10部分 · 地图图标](#part-10)（历史记录）

---

<a id="part-1"></a>

# 第1部分 · 项目总览（原 README.md）


把数字化为力量的地牢爬塔游戏。基于 uni-app、Vue 3、Pinia 和 TypeScript，支持微信小程序与 H5。

## 玩法

- **2048 战斗**：每回合基础 6 步。合并产出的数字累计为攻击，盘面数字之和折算为防御，空格越多速度越快。回合后方块减半，最低为 2。
- **先后手结算**：速度相同时玩家先手；先手致死会阻止后手行动。闪避、吸血、回复、首击减伤和反弹分别结算并显示原因。
- **路线爬塔**：每阶段 10 层加 1 个首领层，纸质墨线地图包含真实分叉与汇合，只能进入虚线相连的节点。三阶段后进入无尽模式。
- **装备与成长**：20 套套装、5 部位、3 品质，另有 15 款非套装装备。强化采用白／蓝／金／红／紫／黑六种作用分类，45 张持续卡可无限叠加，另有 2 种即时补给（卡池共 47 个定义）和 5 种携带道具；装备品质与强化分类独立。
- **事件选择**：34 个强制奇遇，阶段累计池为 S1 12／S2 26／S3+ 34；每个选项有 **3 种随机结果**（权重和 100，收获不预告），点选即结算并在结果页展示本次档位与收获。不可行档抽取时自动剔除，仅三档全部不可行才整项禁用；每事件至少有一个三档全零依赖的选项，0 金残血也能推进，不会隐式欠债；主动支付计入挥金如土成长，意外损失不计；黑卡点选直接生效且本局不可解除。全部选项、代价与三档概率见 EVENTS_GUIDE.md。
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

当前 `tools/simulate.mjs` 的 `RULE_VERSION` 为 **`sixcolor-v3-flat-defense`**（新增固定减伤卡组：坚甲/守拙/磨砺之盾/棘盾契约），parity／多策略工具复用该版本；新录制使用该命名空间。`tools/baselines/` 下 `sixcolor-v1-*`、`sixcolor-v2-random-events-*` 以及旧 `baseline.snapshot.json`、`parity-before.json`、`parity-after.json` 均保留，不覆写。缺失当前版本基线时先用 `--report-only` 审阅真实结果，不用 record 掩盖失败，也不要求重新设计仍保持旧 ±15%。模拟记录实际层数、护甲、道具、损血／治疗、消费及失败原因。

**统计限制**：基础、角落规划、攻击、防御、经济是固定算法策略，均不代表真人通关率或最优构筑。文档保留的旧六色／前期平衡数据不是当前 34 事件三档版本的新率，需在当前规则下独立测量。`node tools/balance-strategies.mjs --smoke` 做快速安全检查，`node tools/balance-strategies.mjs --report-only --seeds 50 --holdout-count 50` 运行五策略与独立样本，不覆写基线。本轮30组测试、类型与SFC检查已通过；当前规则版本 `sixcolor-v3-flat-defense` 的新基线待差异审阅并批准后录制，此前以 `--report-only` 结果为准。五策略统计为算法结果，不代表真人。

## 本轮改进

界面减负、棋盘下方道具、属性说明和合并动效见 UI_MOTION_IMPROVEMENTS.md。六色卡片、道具、净化、起始点数与数值见 SIXCOLOR_RULES.md。34 个事件的全部选项、成本、精确奖励和概率见 EVENTS_GUIDE.md（由源码自动生成），引擎与任务路径汇总见 PROJECT_ANALYSIS.md。全部文档的合并阅读入口见 MASTER_DOC.md。

详见 IMPROVEMENTS.md：机制修复、视觉交互、测试结果、基线变化和未验证范围。纸质分叉地图另见 MAP_IMPROVEMENTS.md。怪物、装备和场景美术见 ART_IMPROVEMENTS.md。

局外存档键保持 `z80z_meta`。旧的数字型无尽首领 ID 可迁移至稳定物种 ID；无法反推物种的旧随机普通怪 ID 原样保留，不凭空合并或删除记录。当前仍仅持久化局外成长，不自动保存进行中的冒险。

---

<a id="part-2"></a>

# 第2部分 · 协作约定（原 AGENTS.md）


本文件为 AI 协作代理在本仓库工作时必须遵守的约定。执行任何改动前先读本文件。

> **系统知识库**：全部文档的合并阅读入口见 MASTER_DOC.md；游戏规则、机制公式、测试与基线工作流、标准任务手册见 PROJECT_ANALYSIS.md。做任务安排前先读它；卡牌数值详单见 SIXCOLOR_RULES.md。若文档与代码冲突，以代码为准并回填文档（先改源文档，再用 `tools/gen-master-doc.mjs --write` 同步总文档）。

## 项目简介

Z80Z：基于 2048 玩法的 Roguelike 爬塔微信小程序（uni-app Vue 3 + Pinia + TypeScript）。

- `core/`：纯游戏逻辑（棋盘、战斗、敌人、路线、强化、装备、事件、随机）
- `store/`：Pinia 状态（gameStore 游戏流程 + helpers 纯函数）
- `components/`：UI 组件（`screens/` 下按屏幕拆分）
- `pages/index/`：唯一页面（屏幕切换外壳）
- `tools/`：测试、模拟、统计与官方构建/压图/上传入口（逻辑测试跑在 Node 上，无构建链路依赖）
- `manifest.json` 的 appid 必须保持占位符 `touristappid`

## 测试与验证（改动后必跑）

```bash
node tools/run-tests.mjs                   # TDD 单测，必须全绿
node tools/simulate.mjs                    # 固定种子整局模拟；SHA-256 为回归锚点
node tools/parity.mjs                      # 200 种子统计平价（数值分布改动需证明无偏差）
node node_modules/typescript/bin/tsc -p tools/tsconfig.check.json   # 类型检查，必须 0 错误
```

规则：`simulate.mjs` 的 SHA-256 哈希是行为回归锚点——除明确授权的改动外不得变化；变化时必须给出平价证明。

## 提交与发布授权

完成改动后先验证，默认只保留本地工作区。**只有用户明确要求时，才提交／推送 GitHub 或上传微信**；当前任务的发布授权不延续到以后任务。

获授权后：

1. **验证**：跑上述测试，确认改动可用且无回归，检查待提交文件无凭据或构建产物
2. **提交**：在非默认分支提交相互依赖的已验证改动；消息沿用 `fix:` / `feat:` / `refactor:` / `docs:` / `chore:` 前缀
3. **推送**：核对远端后普通推送，不强制覆盖；用远端哈希确认同步
4. **微信上传**：仅在明确要求时上传开发版。设置体验版、审核与正式发布属于不同动作，未经授权不执行

### 护栏（遇到必须停下向用户确认，不得静默处理）

- **凭据**：diff 中出现真实 appid、token、密钥类内容 → 拦截并改为占位符。真实微信 appid 仅可本地临时修改用于发布调试，**绝不提交**
- **验证失败**：测试不过 → 不提交坏状态，先修复
- **推送失败**：认证失效、网络问题 → 停下报告，不静默放弃
- **歧义/高风险**：意图不明确或改动有明显副作用 → 先询问

## 其他约定

- `node_modules/`、`unpackage/`、`.codegraph/`、`.omo/`、`*.log` 不入库（已在 `.gitignore`）
- 保持既有代码风格：`.ts` 无分号、单引号；`.vue` 2 空格缩进；中文注释/文案
- git 身份（仓库级已配置）：Z80Z <790200647@qq.com>
- 游戏平衡数值（成本、伤害公式、经验曲线、掉落率）不随意改动

---

<a id="part-3"></a>

# 第3部分 · 系统知识库（原 PROJECT_ANALYSIS.md）


> **本文件的用途**：供所有 AI 代理在执行任何任务前读取，建立对游戏规则、机制、代码结构与开发约定的完整认知。读完本文应能回答"游戏怎么玩、每个系统怎么运作、改某处要动哪些文件"。
>
> **效力与时效**：主体保留 2026-11-07 的系统解析；2026-11-12 按当前源码核对 34 个强制事件（113 选项 × 3 档随机 = 339 档）、47 个卡池定义与规则版本 `sixcolor-v3-flat-defense`（新增固定减伤卡组：坚甲/守拙/磨砺之盾/棘盾契约；详见 §5.2、§6 与 §19）。行号引用格式 `文件:行号`，代码继续演进后行号可能漂移——**若文档与代码冲突，一律以代码为准**，并用搜索定位新位置。卡牌数值详单见 SIXCOLOR_RULES.md，全部事件选项、成本、精确奖励和限制见 EVENTS_GUIDE.md。

---

## 目录

1. [项目速览](#1-项目速览)
2. [目录模块地图](#2-目录模块地图)
3. [核心循环与状态机](#3-核心循环与状态机)
4. [棋盘机制](#4-棋盘机制)
5. [战斗公式全集](#5-战斗公式全集)
6. [六色强化卡体系（47 张）](#6-六色强化卡体系)
7. [消耗品](#7-消耗品)
8. [装备系统](#8-装备系统)
9. [敌人系统](#9-敌人系统)
10. [事件系统](#10-事件系统)
11. [商店 / 营地 / 路线规则](#11-商店--营地--路线规则)
12. [进度与经济](#12-进度与经济)
13. [确定性与随机](#13-确定性与随机)
14. [测试与基线基建](#14-测试与基线基建)
15. [UI 架构](#15-ui-架构)
16. [构建与发布](#16-构建与发布)
17. [红线与约定汇总](#17-红线与约定汇总)
18. [标准任务手册](#18-标准任务手册)
19. [已知限制与未验证范围](#19-已知限制与未验证范围)
20. [术语表](#20-术语表)

---

## 1. 项目速览

**类型**：2048 滑块合并 × 回合制战斗的 Roguelike 爬塔游戏。每个阶段是一张 10+1 层的分支路线图；战斗本质是在 4×4 棋盘上滑动合并：每回合有限步数内合并积攒"蓄力"（攻击），回合结束后按攻防公式结算一次伤害。

**技术栈**（版本锁定见 `package.json`）：

| 组件 | 版本/说明 |
|---|---|
| uni-app 工具链 | 3.0.0-5030420261029002（官方 CLI，经 `tools/build.mjs` 调用） |
| Vite | 5.2.8 |
| Vue | 3.4.21（Composition API + `<script setup lang="ts">`） |
| Pinia | 2.1.7 |
| TypeScript | 全量 `.ts`/`.vue` ts 源码 |
| Node | **≥22.12**（build.mjs 强制校验） |

**双端**：微信小程序（`build mp-weixin`，产物 `unpackage/dist/build/mp-weixin`）与 H5（`build h5` → `unpackage/dist/build/h5`）。`manifest.json` 的 `mp-weixin.appid` 固定占位 `touristappid`，真实 AppID 只在发布上传时经 `tools/upload-mp.mjs --appid` 临时注入，**绝不入库**。

**npm scripts 全表**：

| 命令 | 实际执行 | 用途 |
|---|---|---|
| `npm run dev:h5` | `node tools/build.mjs dev h5` | 开发热更新（默认端口 5173 起） |
| `npm run build:h5` | `node tools/build.mjs build h5` | H5 正式构建 |
| `npm run preview:h5` | `node tools/build.mjs preview h5` | 预览服务（默认端口 4173） |
| `npm run build:mp-weixin` | `node tools/build.mjs build mp-weixin` | 微信构建 + 自动压图 + 包体校验（≤2 MiB） |
| `npm test` | `node tools/run-tests.mjs` | 30 组测试，必须全绿 |
| `npm run typecheck` | `tsc -p tools/tsconfig.check.json` | 类型检查（0 错误） |
| `npm run simulate` | `node tools/simulate.mjs` | 固定种子整局模拟 + SHA-256 基线 |
| `npm run parity` | `node tools/parity.mjs` | 200 种子统计平价 |
| `npm run upload:mp-weixin` | `node tools/upload-mp.mjs` | 微信开发版上传（需 `--appid`） |

**规则与文档索引**：协作约定见 AGENTS.md；卡牌数值详单见 SIXCOLOR_RULES.md；全部事件选项与引擎复用职责见 EVENTS_GUIDE.md；项目入口见 README.md；历史改进记录见 IMPROVEMENTS / UI_MOTION_IMPROVEMENTS / MAP_IMPROVEMENTS / ART_IMPROVEMENTS。**本文是汇总入口**。

---

## 2. 目录模块地图

| 文件/目录 | 职责 | 改什么需求找它 |
|---|---|---|
| `core/board.ts` | 4×4 棋盘纯逻辑：滑动、合并（mergedFrom）、生成（spawnTile）、回合减半（halveGridTiles）、起始点放置 | 棋盘行为、生成概率 |
| `core/battle.ts` | 战斗纯函数：processTurn（滑动回合）、getBattlePreview（伤害预估）、resolveRound（结算）、startNewRound、getCombinedCardModifiers | 战斗公式、新机制消费点 |
| `core/cardEffects.ts` | 卡牌效果系统：EFFECT_RULES 校验表、validateCard（六色约束）、collectCardModifiers（聚合）、deriveCardPlayer（白卡→属性） | 新增效果键、卡牌校验规则 |
| `core/upgrade.ts` | UPGRADE_POOL（47 张卡定义）、pickUpgrades（加权抽卡）、upgradeCost、cardClassText/Description | 加卡、改卡价、抽卡权重 |
| `core/equipment.ts` | 345 件装备生成、套装效果（EquipSetEffects）、computeEquipBonuses、getEffectivePlayer | 装备/套装/掉落品质 |
| `core/enemy.ts` | 76 条图鉴敌人、分层出现、词缀系统（13 条）、无尽生成、每回合成长常量 | 敌人、词缀、难度曲线 |
| `core/events.ts` | 34 个强制事件（112 选 × 3 档）、15 种效果类型校验、`resolveEventOutcome` 加权抽档、`buildEventResult` 描述生成 | 事件数据、阶段池、三档结果；详见 EVENTS_GUIDE |
| `core/consumables.ts` | 5 种消耗品定义与使用场景校验 | 消耗品 |
| `core/route.ts` | 路线生成（10+1 层、分支连线 makeEnemy 接敌人系统） | 路线结构、敌人分布 |
| `core/routeLayout.ts` | 地图纯展示坐标（状态着色、层距、抖动） | 地图视觉 |
| `core/progress.ts` | 升级循环 gainXp | 经验曲线 |
| `core/random.ts` | Mulberry32 与作用域随机 createScopedRng | 随机/可复现性 |
| `store/gameStore.ts` | Pinia 主状态机（screen、player、upgrades、battle、route、shop、event、meta 全部动作） | 几乎一切玩法流程 |
| `store/helpers.ts` | buildShop、rollRewardChoices、applyMetaUpgrades、xpToNext | 商店构造、奖励抽取 |
| `store/initialState.ts` | 初始状态（玩家属性、runState 字段） | 新增全局状态字段 |
| `store/debugActions.ts` | 开发调试动作（__DEV__ 才生效） | 调试功能 |
| `components/screens/*.vue` | 屏幕组件：Title/Route/Battle/Reward/Shop/Rest/Meta/GameOver/BossChoice（9 个）＋ 根 components 下 EventPanel，共 10 个屏幕 | 屏幕级 UI |
| `components/*.vue` | Board/Tile（棋盘渲染与动效）、CardIcon/CardDetails/ItemIcon/MapIcon、CardDetails（效果文案渲染）、ExpandPanel、StatusBar、EnemyDisplay、BattleItems（战斗道具栏）、ConsumablesPanel、UpgradesPanel、EquipmentPanel、GameRulesPanel、AttributeHelp、ResultModal、DebugPanel、BestiaryPanel | 面板与展示组件 |
| `composables/` | useSwipe（触摸+指针手势）、usePanelMotion（弹层开合状态机）、useFeedback（提示）、useMotionPreference（减少动态，系统偏好监听仅 H5）；键盘方向键在 Board 组件内监听 | 交互模式 |
| `utils/boardEffects.ts` | 棋盘动效数据层：buildBoardRenderPlan、slideAttackDelta、formatAttackGain、动效预算常量 | 棋盘特效、浮字 |
| `utils/displayText.ts` | summarizeEffect/summarizeCard/summarizeConsumable（效果→通俗文案）、getActualHealGained、cardClassHelp | 效果文案 |
| `utils/attributeInfo.ts` | 属性说明弹窗内容（11 个属性键） | 属性说明 |
| `utils/panelMotion.ts` / `usePanelMotion.ts` | 面板开合状态机（closed→opening→open→closing） | 弹层过渡 |
| `utils/artwork.ts` | 图标/卡面/场景资源键 | 美术资源键 |
| `utils/storage.ts` | 局外存档（`z80z_meta`）读写与白名单校验 | 持久化 |
| `tools/` | run-tests、harness（TS 转译加载器）、simulate、parity、balance-strategies、build、optimize-mp-art、upload-mp、baselines/（基线 JSON）、tests/（27 个测试） | 测试/构建/发布 |

---

## 3. 核心循环与状态机

### 3.1 一局的完整闭环

```
标题页 START_RUN(seed=Date.now())
  → 重置状态 + 局外加成（applyMetaUpgrades）
  → 生成 stage1 路线（createRng(seed)）
  → （买了 meta_start 则排入 'start' 奖励）
  → 路线图选节点
      ├─ battle/elite：进入战斗（胜利→金币/经验/掉落→奖励队列）
      ├─ event：进入事件（选项→确认→应用）
      ├─ shop：商店（购买/刷新/移除）
      └─ rest：营火（治疗 30%）
  → 打赢第 11 层 boss → boss_choice：继续下一阶段 / 胜利结算
  → stage+1 生成新路线（敌人更强、词缀更多）；stage≥4 无尽程序生成
  → 死亡/胜利 → 结算灵魂碎片（10% 金币 + stage×10 或 5）→ 局外永久升级/图鉴
```

### 3.2 screen 状态机（`store.gameStore.screen`）

| 屏幕 | 进入动作 | 离开动作 |
|---|---|---|
| title | 初始 / GO_TO_META_SHOP 返回 | START_RUN |
| route | 默认 | SELECT_NODE（节点必须 accessible 且未完成） |
| battle | SELECT_NODE(battle/elite/boss 节点，预构造 BattleState) | 战斗结算→奖励队列；死亡→gameover |
| reward | _showNextReward()（队列非空时自动） | PICK_UPGRADE / SKIP_REWARD（FIFO，一份一份） |
| shop | SELECT_NODE(shop) | GO_TO_ROUTE()（可随时离开，节点可重入） |
| rest | SELECT_NODE(rest) | GO_TO_ROUTE()（未休整也可离开） |
| event | SELECT_NODE(event) → CHOOSE_EVENT → LEAVE_EVENT | 无中途退出——必须选一个选项，点选即结算；没有安全出口 |
| boss_choice | boss 战胜利奖励队列耗尽后 | BOSS_DEFEATED('continue'→下一阶段 / 'end'→胜利结算) |
| meta | 标题页 GO_TO_META_SHOP | 购买/返回 |
| gameover | 死亡 / 主动结算 | START_RUN 重开 |

**路线节点重入规则**：商店与营地在"选定下一层之前"可反复进出——SELECT_NODE 对 `['shop','rest']` 不标记 completed 且保留自身 accessible（`gameStore.ts` SELECT_NODE 内 `reenterable` 分支）；选定下一层时旧节点 accessible 被统一收窄，自然锁死。战斗类节点进入即 completed。

### 3.3 战斗回合阶段机（`battle.phase`）

| 阶段 | 含义 | 进入方式 | 允许操作 |
|---|---|---|---|
| playing | 本回合滑动中 | 回合开始 | SLIDE（方向滑动）、END_TURN_EARLY、使用战斗道具 |
| round_delay | 步数用尽/提前结束，展示蓄力摘要 | turnsUsed≥maxTurns 或 END_TURN_EARLY | SHOW_ROUND（500ms 定时器自动） |
| round_end | 双方交战结算展示 | SHOW_ROUND | NEXT_ROUND（开启下一回合） |
| finish_delay | 敌人死亡/玩家死亡 | resolveRound 判定 | SHOW_BATTLE_RESULT（600ms 定时器） |
| finished | 结果定格 | SHOW_BATTLE_RESULT | END_BATTLE（领溢出奖励）→ 奖励队列 |

阶段定时器在 BattleScreen `onUnmounted` 清理；阶段变化会自动关闭属性弹窗。

### 3.4 奖励队列

- **reason 4 种**（`types/index.ts`）：`'start'`（局外初始优势）/ `'levelup'`（每次升级入队一份）/ `'elite'` / `'boss'`（击杀对应节点入队）。
- **allowedClasses**：普通与 levelup 用白/蓝/金；elite 允许 蓝+金；**boss 只给金卡**（`gameStore._resolveKill`）。
- **FIFO**：`_showNextReward` 取队首，用 `('reward', rewardRollCount)` 作用域抽 3 选；领奖/跳过都只消耗当前一份；队列耗尽后——若当前是 boss 节点进 boss_choice，否则回 route。
- **满血保底**：`hpRatio<0.5` 且白卡可用且未排除治疗时，三选一必含一张即时治疗（`core/upgrade.ts` pickUpgrades）。
- 抽卡类权重：**white 60 / blue 30 / gold 10 / red 1 / purple 1 / black 1**（先按权重选色，再类内均匀选卡、三选不重复）。

---

## 4. 棋盘机制

**棋盘**：4×4，格子有稳定 `id`、`value`、`isNew`、`isMerged`、`mergedFrom`。

### 4.1 滑动与合并

- `slideGrid(grid, direction)`：整行/列推移，相邻等值合并；合并格 `value×2`、`mergedFrom=[idA,idB]`、`mergedSum += 合并后数值`（`core/board.ts` mergeLine）。
- **同一方块在一次滑动中最多参与一次合并**（新生成的格子不再参与）；不同配对可以同次合并——如 `[2,2,2,2]` 向左滑出 `[4,4,0,0]`（mergedSum=8、两个合并格）。
- 只有棋盘发生移动才消耗步数（`moved=false` 直接返回原状态，不耗步、不生成）。

### 4.2 生成

- 每次有效滑动生成 1 个新方块：位置均匀随机（1 次 rng）+ 数值 `rng()<0.9 ? 2 : 4`（1 次 rng）——**90% 出 2、10% 出 4**。
- **幸运生成**（蓝卡 spawnLuck）：4 的概率 = `10% + 90%×评级÷(1+评级)`，无限逼近必出，永不封顶。实现：`processTurn` 把 `0.1 + 0.9*naturalFraction(spawnLuck)` 传给 `spawnTile`。
- **开局优势**（startingPoints）：每回合开局把"待放点数"按 2 的幂拆解放置；空位不足时留在 pending，之后有位再放。点数必须是**非负偶数安全整数**（RangeError 校验）。

### 4.3 回合减半

- 回合结束（startNewRound）所有方块 `value = max(2, floor(value/2))`（0 保持 0），棋子身份保留。
- **减半护佑**（halveShield）：每个非空方块以 `评级÷(1+评级)` 概率跳过本次减半（每方块消耗 1 次 rng）。

### 4.4 蓄力（攻击）公式

```
baseCharge   = mergedSum × (1 + mergeCoefficient) × (1 + burstCoefficient)
earnedCharge = (baseCharge + 连锁加成) ÷ (1 + max(0, chargeLoss))
连锁加成     = 连锁战意(comboBonus) × comboStreak（仅本次有合并时）
totalAttack += earnedCharge
```

**算例**：mergedSum=8、强力攻击 2 层（mergeCoefficient=0.2）、狂战契约（burst=1）、连锁战意 3 层（comboBonus=12）、连锁 3、散能诅咒 1 层（chargeLoss=0.15）：
- baseCharge = 8 × 1.2 × 2 = 19.2
- 连锁加成 = 12 × 3 = 36 → 分子 55.2
- ÷1.15 → earnedCharge = 48（浮点尾部由浮字格式化隐藏）
- totalAttack 累加之；**回合结束清零重攒**（startNewRound `totalAttack = 剩余步数×过载核心 + 蓄力起步`）

**连锁**：有合并的滑动 comboStreak+1；未合并时——无连锁回响归零；有连锁回响（comboGrace）按 `floor(旧连锁 × 评级÷(1+评级))` 保留。

**过载核心**（savedStepsCharge）+ **蓄力起步**（chargeStart）：回合开始 `totalAttack = max(0, maxTurns − turnsUsed) × savedStepsCharge + chargeStart`。剩余步数在 startNewRound 重算（提前结束=剩余步数；自然耗尽=0），不再沿用旧字段。

---

## 5. 战斗公式全集

### 5.1 防御值（defenseValue，四来源相加后 floor）

```
defenseValue = floor(
    棋盘总和 × defenseMultiplier ÷ 3
  + totalDefense × ((player.spawnArmor ?? 0) + modifiers.spawnArmor)
  + mechanicArmor            -- 锻甲合流积累
  + carryArmor               -- 上回合传承留下的
)
```
- totalDefense：本回合每个新生成方块的数值累加（生成越多防越高）。
- ÷3 是 2026-11-07 前期平衡修正（原 ÷6 把防御稀释到几乎无效）。
- **算例**：棋盘总和 240、防御倍率 1.5、totalDefense=16、灵活身法 0.2、锻甲合流本回合攒了 25、传承留 12：
  `floor(240×1.5/3 + 16×0.2 + 25 + 12) = floor(120 + 3.2 + 25 + 12) = floor(160.2) = 160`

### 5.2 承受伤害（incomingDamage）

```
armorDamage   = max(1, ceil(敌攻 × 15 ÷ (15 + max(0, defenseValue + flatDefense))))
incoming      = max(1, ceil(armorDamage × (1 + vulnerability)))
要塞套装      = ceil(incoming ÷ 2)   -- 每场首次实际受伤，fortifyUsed 记录
```
- 常数 **15** 是全部 UI 引用的真实值（旧文档的 30 已废弃）。
- **算例**：敌攻 20、总防 45 → ceil(20×15/60)=5；易伤 0.3 → ceil(5×1.3)=7。

### 5.3 出手伤害（enemyDamage，对敌）

```
enemyDamage = max(0, floor(totalAttack × attackMultiplier − 敌防) + flatAttack)    （totalAttack>0 才出手）
```
- **固定攻击加在 floor 之后、下限截断之内**：蓄力 10、倍率 1、敌防 100、固定攻击 5 → max(0, floor(−90)+5)=0，不会穿透防御白嫖伤害。
- **算例**：蓄力 50、攻击倍率 1.5、敌防 20 → floor(55)+0=55。
- 蓄力为 0 时**不会仅靠装备固定攻击出手**。

### 5.4 结算附加机制（resolveRound attack 闭包内）

| 机制 | 公式 | 说明 |
|---|---|---|
| 暴击（致命节奏 critRating） | 概率 = 评级÷(1+评级)；伤害 ×2 | 每次攻击独立抽签（仅持卡时消耗 rng）；倍伤放大溢出与吸血基数 |
| 斩杀（猎手印记/猎魔契约 executeRating） | 线 = 敌最大生命 × 评级÷(1+评级)；一击后敌人剩余 ≤ 线 → 直接击杀 | 补刀部分计入 overflowDamage；不改写 enemyDamage 字段 |
| 吸血（lifestealRating） | 回复 = 实际生命伤害 × min(1, 评级÷(1+评级) + 装备吸血) | 不计溢出/反弹/斩杀；受治疗衰减 |
| 追加攻击（extraStrikeRating） | 首击后双方存活且 rng < 评级÷(1+评级) → 再攻击一次 | 每回合最多一次；触发即反噬 backlash |
| 反噬（backlash）/流血（bleed）/灼烧（burn）/噬魂（soulRecoil） | 固定数值扣血 | 计入 curseDamage，独立于战斗伤害；可以致死 |
| 敌人回血（enemyRegen） | 回合结束存活敌回 min(上限−当前, 评级×层数) | |

### 5.5 时序与死亡规则

- 先手判定：`firstStrike（套装） || playerSpeed ≥ enemySpeed`；速度 = 基础速度 + 空格数。
- **chronological death**：所有伤害按时间顺序即时结算——先手击杀会阻断后手出手；致命来袭后死者不能攻击/吸血/再生；诅咒损血与战斗伤害同回合叠加致死时，先发生的先记录。
- 敌人三维成长：`敌攻 = base + max(0, round−2)×3 + (round−1)×enemyRage`、`敌防 = base + max(0, round−2)×3`、`敌速 = base + max(0, round−2)×1`（`core/enemy.ts` 常量 + `core/battle.ts` 消费）。**前两回合不成长**（2026-11-07 前期平衡修正，给 boss 战一个公平窗口）；阴影低语不受缓冲。敌人本体对象永不被修改。

### 5.6 RoundResult 字段语义（显示与测试都依赖）

| 字段 | 语义 |
|---|---|
| enemyDamage | 本次**计划**对敌伤害（暴击已含；斩杀补刀不改写它） |
| overflowDamage | 计划伤害超出敌人当前生命的部分 + 斩杀补刀；END_BATTLE 时可选 1:1 换金币或 2:1 换经验 |
| healing / curseDamage / reflectedDamage / extraDamage | 各来源独立记录，ResultModal 分项展示 |
| attackCount / playerActed / enemyActed / avoidReason | 攻击次数（含追加）、是否出手、跳过原因（kill/skip/defense/dodge） |
| playerHpAfter / enemyHpAfter | 结算后生命（0 = 死亡） |

---

## 6. 六色强化卡体系

**45 张持续卡 + 2 张即时治疗 = 47 个定义**（`core/upgrade.ts` 的 UPGRADE_POOL 长度 47，含即时卡；5 种携带道具另计）。逐卡数值详单见 SIXCOLOR_RULES.md，事件获取渠道详单见 EVENTS_GUIDE.md，此处给体系规则 + 全部 47 个定义的速查表。

### 6.1 六色职责与规则

| 色 | 职责 | 校验约束（validateCard） | 叠加 | 移除 | 价格 |
|---|---|---|---|---|---|
| 白 | 只加基础属性（stat scope） | 全部效果 stat | ✅ 无限 | 商店移除 | 20 |
| 蓝 | 只改战斗参数（parameter scope） | 全部效果 parameter | ✅ 无限 | 商店移除 | 50 |
| 金 | 只加正面机制（mechanic 正面） | 全部效果 mechanic+positive | ✅ 无限 | 商店移除 | 90 |
| 红 | 恰好 2 条机制：1 强正面（isStrongMechanic）+1 负面 | mechanic，正负各一 | ✅ 无限 | 商店移除 | 仅风险事件 |
| 紫 | 纯负面诅咒 | mechanic 负面 | ✅ 无限 | 净化药剂/净化师/断咒祭坛 | 不可购买 |
| 黑 | 纯负面宿命 | mechanic 负面 | ✅ 无限 | **本局不可解除** | 不可购买 |

- **无限叠加原则**：所有卡按"定义+数量"聚合（`collectCardModifiers` 乘 count，不展开数组），**没有任何层数上限**。概率/比例型走评级曲线 `评级÷(1+评级)` 无限逼近但达不到 100%；唯一例外是迟滞诅咒的"步数至少 1"——那是游戏可运行的规则底线，不是叠加上限。
- 参数加算不复利：+8%/层 是线性加在倍率上（2 层=+16%）。
- 效果数值恒为正；正负语义由 type 定义（validateCardEffect 拒绝 value≤0）。
- 红卡的"强正面"由 isStrongMechanic 白名单判定（burst/extraStrike/execute/greed ≥1，lifesteal ≥0.5）。

### 6.2 全卡速查（47 张；公式化说明）

**白（7）**：攻击强化 攻倍率+8%/层 ｜ 防御强化 防+8%/层 ｜ 生命训练 maxHp+8 获得时等量回血 ｜ 淘金者 金币+3%/层 ｜ 均衡训练 攻+5% 且防+5%/层 ｜ 血脉坚韧 maxHp+6 且防+3%/层 ｜ 见多识广 战斗经验+10%/层

**蓝（7）**：快速思考 每回合+1步 ｜ 强力攻击 合并蓄力系数+10%/层 ｜ 灵活身法 生成护甲系数+0.2/层 ｜ 开局优势 每回合+4点起始方块 ｜ 蓄力起步 开局自带3点蓄力/层 ｜ 幸运生成 4 概率=10%+90%×评级÷(1+评级) ｜ 减半护佑 不减半概率=评级÷(1+评级)

**金（13）**：连锁战意 连锁每层+4蓄力 ｜ 锻甲合流 合并数值25%→机制护甲 ｜ 护甲传承 保留评级+0.25 ｜ 生命汲取 吸血评级+0.08 ｜ 连锁回响 未合并回合连锁按比例保留 ｜ 猎手印记 斩杀线=最大生命×评级÷(1+评级) ｜ 致命节奏 暴击率=评级÷(1+评级) ｜ 过载核心 剩余每步→2蓄力 ｜ 战魂图腾 每击败一个敌人攻倍率+2%（整局累积） ｜ 英魂宝珠 每击败一个敌人最大生命+3并回复（受治疗衰减） ｜ 熔炼掌握 每累计合并100点方块数值攻倍率+1% ｜ 挥金如土 每累计主动支付25金币攻倍率+1%（购买/交易/赌注计入，意外损失不计） ｜ 百战老兵 每进入一场战斗攻倍率+1% ｜ 磨砺之盾 每累计承受30点伤害固定减伤+1

**红（7，均可来自狂战祭坛；猎魔契约也可来自星界棋局）**：狂战契约 爆发+100%/承伤+30% ｜ 血之契约 吸血0.5/流血3 ｜ 双刃赌局 追加攻击1/反噬4 ｜ 猎魔契约 斩杀线50%/承伤+25% ｜ 贪婪之约 金币×(1+评级)/灼烧4 ｜ 浴血狂怒 当前生命每降10%攻+6%（满血无加成）/承伤+25% ｜ 棘盾契约 受击按评级概率反弹(2×层数+本次减免量)/攻击散失+0.3

**紫（5，诅咒）**：灼烧 每回合−2/层 ｜ 衰败 治疗衰减+0.2/层 ｜ 散能 蓄力散失+0.15/层 ｜ 迟滞 每回合步数−1/层（保底1） ｜ 脆甲 侵蚀+0.15/层（抵扣传承）

**黑（3，宿命）**：噬魂 每次合并移动−2/层 ｜ 轮回 敌人每回合回4/层 ｜ 阴影低语 敌攻每回合成长+1/层

**即时（2，不占持有）**：急救包 回12 / 大急救包 回30（受衰减、不超上限）

### 6.3 获取渠道矩阵

| 来源 | 内容 | 位置 |
|---|---|---|
| 普通奖励/levelup | 白/蓝/金加权 60/30/10（+满血保底治疗） | pickUpgrades |
| elite 奖励 | 蓝+金 | _resolveKill |
| boss 奖励 | 仅金 | _resolveKill |
| 商店（3 槽） | 白/蓝/金，价 20/50/90 | buildShop |
| 狂战祭坛（S1+） | 6 种红卡必选其一（强制选择，无安全离开） | events.ts risk_shrine |
| 诅咒藏书室（S2+） | 金卡+紫诅咒配对交易（5 组） | cursed_archive |
| 深渊契约（S3+） | 金卡+黑宿命配对交易（3 组，黑卡三档都给、点选即生效无确认） | abyss_contract |
| 流浪的净化师（S2+） | 40 金净化一层紫卡 | cleansing_hermit |
| 信使／训练室（S1+） | `xp_1`；`balanced_1`／`def_up_1`／`vigor_1`，金币或固定生命成本 | lost_messenger／training_room |
| 镜面水池（S2+） | `spawn_luck_1`／`halve_shield_1`／`atk_up_2` 各30金，或即时治疗 | mirror_pool |
| 废弃钟楼（S2+） | 步数／起始蓄力／剩余步转蓄力／连锁回响；战术药剂 | abandoned_clock |
| 游荡铸匠（S2+） | 锻甲金卡、白卡组合、装备锻造与重铸 | roaming_smith |
| 断咒祭坛（S2+） | 15生命或35金净化1层；65金净化2层；45金买净化药剂×1 | cleansing_altar |
| 星界棋局（S3+） | 斩杀+暴击／锻甲+传承金卡组合；金+黑交易；`red_hunt` | astral_chess |
| 废弃营地／猩红药圃 | 既有药剂／卷轴入库存，或事件即时治疗（上限风险另列） | abandoned_camp（S1+）／crimson_garden（S3+） |

上表只概览来源；所有成本、数量和组合以 EVENTS_GUIDE.md 逐项表为准。事件价不修改商店标准价，新增来源不增加卡池总数。

**铁律**：每一种红/紫/黑卡都必须有正常游戏获取选项（events 的 trade 契约测试强制断言），不允许只存在于调试按钮。

### 6.4 移除与净化

| 途径 | 代价 | 范围 |
|---|---|---|
| 商店移除 | 30 金，每店限一次 | 白/蓝/金/红 各撤一层（正负同撤） |
| 净化药剂（50 金） | 1 份道具 | 只移紫一层；限 route/shop/rest |
| 净化师事件 | 40 金 | 只移紫一层（removesPurple） |
| 断咒祭坛 | 15 当前生命／35 金净化1层，或65金净化2层 | 按持有列表首紫逐层处理，多层先减同张；生命支付后至少留1点 |
| 营火 | — | **不净化**（只治疗） |
| 黑卡 | — | 任何入口都拒绝 |

---

## 7. 消耗品

5 种（`core/consumables.ts`），购买入库、使用扣数量：

| id | 名称 | 价格 | 时效 | 效果 |
|---|---|---|---|---|
| tactical_potion | 战术药剂 | 35 | 本回合 | +2 步 |
| charge_potion | 蓄能药剂 | 35 | 本回合 | 合并积蓄系数 +50%（不追溯） |
| combo_scroll | 连锁卷轴 | 60 | 本场战斗 | 连锁每层 +8 蓄力 |
| berserk_potion | 狂战药剂 | 45 | 本回合 | 爆发 +100% / 承伤 +30% |
| cleanse_potion | 净化药剂 | 50 | 即时 | 移除一层紫卡 |

**使用场景**：战斗药剂/卷轴只能在 `phase==='playing'` 使用（不耗步数）；净化只能在 route/shop/rest；`eventResult` 展示期间一律禁用（结果页只能离开）。临时效果写进 `battleModifiers`（战斗级）或 `roundModifiers`（回合级），回合/战斗结束清除。

---

## 8. 装备系统

### 8.1 构成

- **5 部位**（pants/helmet/armor/gloves/boots）× **3 品质**（common/rare/epic，倍率 1/1.5/2.2）。
- **20 套装 × 5 × 3 = 300 件** + **15 散件 × 3 = 45 件** = **345 件**（`core/equipment.ts` 自动生成）。
- 商店价 30/70/120；掉落品质受 tier 与 dropRarityBoost 影响。

### 8.2 装备 id 与数值

- compound id：`"<baseId>:<level>:<fluct>"`（makeEquipId）；fluct ∈ 70~130（同 id+level+fluct 数值恒定）。
- 等级乘区 `1 + 0.12×(level−1)`；商店与掉落等级 = `(stage−1)×2 + 1 + rng()×2`。
- 散件词条由 `createRng(hash("id:level:fluct"))` 确定性生成：词条数 epic 3 / rare 2 / common 1（+0~1），从攻 10-22、防 8-18、hp 8-20、速 1-4、金 5-12%、exp 5-12% 池不重复抽取。

### 8.3 20 套装（2/3/5 件效果）

| 套装 | 2 件 | 3 件 | 5 件 |
|---|---|---|---|
| 暴风 tempest | 速+4 | 攻倍率+20% | 每回合+2 步 |
| 磐石 fortress | 防+20% | HP+25% | 首次受伤减半+反弹 5 |
| 影步 shadow | 速+3 | 攻+10% | 永远先手+10% 闪避 |
| 噬血 vampire | 攻+10% | 吸血 10% | 吸血 20%+攻+25% |
| 财宝 treasure | 金币+25% | 经验+30% | 掉落品质+1 |
| 烈焰 flame | 攻+15% | 攻+25%(共40%) | 无视 40% 敌防 |
| 冰霜 frost | 防+15% | 敌速−4 | 敌攻−30% |
| 雷霆 thunder | 速+5 | 攻+15% | 20% 敌人跳过攻击 |
| 圣光 holy | HP+20% | 合并回合回 8% | 回 16%+防+20% |
| 暗影 dark | 攻+25% | 速+3 | 攻×2 且防×0.5 |
| 自然 nature | 四维+8% | +12%(共20%) | +20%(共40%) |
| 龙裔 dragon | HP+30% | 攻+20% | HP+50%+攻+30% |
| 虚空 void | 每回合随机一项+20% | +30%(共50%) | 每回合随机一项翻倍 |
| 时光 time | 速+3 | 每回合+2 步 | +5 步+速 6 |
| 灵魂 soul | 经验+40% | 攻+10% | 经验翻倍+攻+20% |
| 战士 warrior | 攻+15%防+10% | HP+20% | 攻防各再+25% |
| 猎人 hunter | 速+4金币+20% | 先手 | 金币+40% |
| 贤者 sage | 经验+30%防+10% | 合并回合回 5% | 经验翻倍+防+30% |
| 盗贼 thief | 金币+30%速+2 | 15% 闪避 | 闪避 15%+金币+50% |
| 王者 king | 四维+10% | +15%(共25%) | +25%(共50%)+掉落件数×2 |

### 8.4 EquipSetEffects 关键键

`extraTurns`（额外步数）、`lifesteal`/`dodge`/`skipChance`（比例）、`fortify`+`reflect`（首击减半反弹）、`firstStrike`（无条件先手）、`pierce`（无视敌防%）、`regen`（合并回合末回血%）、`enemyAtkDown`/`enemySpdDown`、`attackBonus`/`defenseBonus`/`hpBonus`/`speedPercent`/`speedBonus`/`goldBonus`/`xpBonus`（百分比）、`randomBonus`/`randomDouble`（虚空套随机轴，开局抽签）、`doubleAtk`/`halfDefense`、`doubleGold`/`doubleXp`、`dropRarityBoost`/`dropCount`。

### 8.5 掉落

击杀基础概率 tier≥4 = 100%、tier3 = 40%、tier2 = 20%、tier1 = 10%；boss 强制掉落、elite 概率 ×2（封顶 100%）。稀有度表按 tier 分档（tier≥4 可出史诗）；dropRarityBoost 升 1 档（上限史诗）、dropCount = 2（王者 5 件）多掉一件。事件装备来源除陨落战士common、神秘黑匣rare、远古锻造台25金epic／重铸common→rare、赌徒50%／70%外，新增信使30金common、石像25金common、游荡铸匠60金rare／重铸common→rare；每次1件，缓存精确compound ID，不自动穿戴。全表见 EVENTS_GUIDE.md。

---

## 9. 敌人系统

### 9.1 图鉴构成（76 条 = ENEMIES 数组：48 固定 + 28 无尽模板）

- Stage1 地牢入口（tier1）：普通 12（巨鼠 28/22/1/9 → 洞穴巨魔 65/18/4/3，防御已减半）+ 精英 3（兽人战士/亡灵法师/幽灵）+ boss 岩石巨人 130/28/10/8。
- Stage2 深渊回廊（tier2）：普通 12（石魔像 → 烈焰幼龙，防御约 −30%）+ 精英 3（幼龙/瘟疫使者/巫妖）+ boss 远古巨龙 170/44/14/14。
- Stage3 终焉之间（tier3）：普通 12（独眼巨人 → 末日使者）+ 精英 3（九头蛇/大恶魔/死亡天使）+ boss 终焉之主 260/56/26/16。
- Stage≥4 无尽：普通模板 15 + 精英模板 5 + boss 模板 8（虚空之主→万象归零循环）。

### 9.2 出现与缩放

- 分层：过滤 `minLayer ≤ layer` 后加权抽样，`权重 = 1 + (minLayer−1) × min(1,(layer−1)/9)`——越深越偏晚解锁种。
- 无尽缩放（普通/精英）：`scale = 1 + (stage−3)×0.35 + layer×0.02`；hp/攻/防 floor(模板×scale)；速度软压缩（>24 → 24+√(raw−24)）。
- 无尽 boss：模板按 `(stage−4)%8` 循环，`scale = 1 + (stage−3)×0.4`，基值 250/60/24/16，名字带 `Lv.<stage>`。

### 9.3 词缀（敌人强化，13 条）

| 词缀 | 效果 | | 词缀 | 效果 |
|---|---|---|---|---|
| 攻击强化 | 攻×1.2 | | 强力攻击 | 攻×1.35 |
| 防御强化 | 防×1.2 | | 铜墙铁壁 | 防×1.35 |
| 生命训练 | HP×1.1 | | 顽强生命 | HP×1.3 |
| 灵活身法 | 防×1.1 | | 灵巧闪避 | 防×1.18 |
| 毁灭之力 | 攻×1.5 | | 不朽之盾 | 防×1.5 |
| 幻影步法 | 防×1.25 | | 不灭之躯 | HP×1.5 |
| 生命强化 | HP×1.2 | | | |

数量 = `min(stage−1, 13)`（S2 一条、S3 两条…S14 起 13 条封顶），从池中**无放回**均匀抽取；只乘攻/防/HP，速度不受影响。词缀 id 存入 `enemy.enemyUpgrades`，图鉴展示。

### 9.4 每回合成长

见 §5.5——常量 攻+3/防+3/速+1 每回合，阴影低语追加敌攻成长。若拖到后期不解决，敌人会滚雪球（逼玩家在成长曲线上做取舍）。

---

## 10. 事件系统

**34 个事件、112 个选项 × 3 档随机结果 = 336 档**（`core/events.ts` EVENTS）。全部为**强制奇遇**：点选即结算（结果页只做展示），收获不预告；每事件至少有一个选项的**全部三档**零依赖金币/生命/持有物，避免死锁。按 `stageMin <= stage` 累计解锁，`pickEvent` 在当前池内均匀抽取，不做跨节点去重。逐项三档概率表由 `tools/gen-events-guide.mjs` 自动生成到 EVENTS_GUIDE.md。

| 解锁阶段 | 既有事件 | 强制奇遇（精确 ID） | 本阶段新增／累计池 |
|---|---|---|---|
| S1+ | 宝箱、治愈之泉、暗影祭坛、陨落战士、狂战祭坛、废弃营地、迷路的信使、机关训练室、石像的口袋 | `sinking_bridge`／`screaming_well`／`starving_ambush` | 12／S1 12 |
| S2+ | 赌徒的邀约、远古卷轴、看似平静的地面、诅咒藏书室、炼金补给、流浪的净化师、镜面水池、废弃钟楼、游荡铸匠、断咒祭坛 | `collapsing_shrine`／`cursed_bargain`／`midnight_auction`／`greed_trial` | 14／S2 26 |
| S3+ | 神秘黑匣、垂死商人、远古锻造台、深渊契约、星界棋局、猩红药圃 | `spirit_bargain`／`doom_gate` | 8／S3及以后34 |

**所有34事件逐项 label／成本／精确卡与道具 ID×数量／效果／概率／stageMin**，以及装备随机 ID 规则与源码职责引用见 EVENTS_GUIDE.md。这里只保留引擎概要，避免重复维护全表。

**核心原则**：
1. **只能选一个、点选即结算**——`CHOOSE_EVENT`（`store/gameStore.ts`）在一次确定性作用域 RNG（`event-choice` + 选项序号）内完成 1 次分支抽取 + 档内结算（金币区间再抽 1 次、随机装备抽 3 次、重铸抽 4 次），立即扣费、发奖、净化并缓存 `eventResult`（含 `outcomeLabel`/`tone`）；结果页只做展示，`LEAVE_EVENT` 清空事件并接奖励队列或回路线。随机只抽一次，不可重选。
2. **强制选择、无安全离开**——所有事件标记 `forced: true`。防死锁规则：每事件至少有一个选项的**全部三档**零依赖（设计、`events-forced` 与 `events-expansion` 测试都强制这一点）。`GO_TO_ROUTE` 只允许商店／营地退出；事件页离开只能走 `LEAVE_EVENT`。
3. **黑卡直接生效**——没有确认步骤；黑卡作为固定代价出现在相关选项的全部三档中（变的只是额外收获），点选后直接入手且本局不可解除。结果页以「■ 含黑卡 · 本局不可解除」标记。
4. **预检与可行档剔除**——`resolveEventOutcome` 先按当前资源过滤不可行档（金币/生命/紫层不足等），再在可行档内按权重归一化抽取，因此结算中途不会因资源不足失败；整档全部不可行的选项在选项层禁用并显示首档原因。`CHOOSE_EVENT` 内保留 fail-fast invariant（批量安全累计、净化目标、重铸目标），失败抛 `事件结算失败（id）：原因`。金币不得用未得奖励抵押；交易 `hpCost` 要求 `hp - hpCost >= 1`。
5. **损血保底**——`hp_reduce` 类档位 `max(1, hp - value)` 至少留 1 点；不套交易 `hpCost` 禁用规则，也不将此保底推广到可致死的战斗诅咒损血。
6. **净化顺序**——结算的 `removesPurple` 循环每次找持有列表首张合法紫卡，`_removeCardLayer` 每次减一层，多层先减同张；两层净化不保证影响两种卡。黑卡不能净化，也不计入可净化层数。
7. **即时回血不走卡 grant**——复用事件 `heal`／`gold_heal`／`heal_curse`；`_canGrantCards` 只接受持续卡，不能用 `heal_1`／`heal_2` instant grant 冒充。百分比治疗基于有效总上限，受治疗衰减；上限诅咒先治疗，再降低基础上限（最低10）并夹当前生命。
8. **重铸与入库**——`getReforgeEligibleItem` 取背包首件未装备普通装备，同 ID 有穿戴份数时全部排除；随机装备缓存精确 compound ID，入背包不自动穿戴；携带道具入库不自动使用。

**既有复用链**：EVENTS 数据（`pick`/`tradeO`/`o` 助手）→ `resolveEventOutcome`（`core/events.ts`）加权抽档 → `resolveEventEffect` 档内结算 → `CHOOSE_EVENT` invariant + 落地 → `eventResult` 展示 → `LEAVE_EVENT` 清理 → `_grantUpgrade`/`_addConsumable`/`_removeCardLayer`/`_heal`。所有事件复用现有效果类型，没有新增战斗效果键。

**15 种效果类型**（EFFECT_FIELDS 白名单，未知 type 在选项校验／resolve 时报“事件效果不受支持”；三档化后 `gamble`/`disarm`/`sprint`/`heal_mixed`/`heal.curse` 分支已摊平为显式档位并剪除）：

| type | 字段 | 语义 |
|---|---|---|
| none | — | 无事发生（「空档」档位载荷） |
| gold | value | ±金币（唯一允许负值，付费档用它表达） |
| heal | value | 回复总生命上限 value% |
| hp_reduce | value | 扣固定生命（留1） |
| maxhp_down / maxhp_down_pct | value | 本局基础上限 −value%（最低10），夹当前生命 |
| maxhp_up | value | 本局基础上限 +value |
| xp | value | 直接经验，可能接升级奖励队列 |
| hp_reduce_pct | value(+atk_mult,def_mult) | 当前生命 −value% 换倍率（留1） |
| heal_curse | heal, curse_hp | 先按原总上限回 heal%，再降基础上限 curse_hp%（curse_hp 必须为正） |
| gold_heal | heal, gold | 回血＋金币 |
| gold_xp | gold, xp | 金币＋直接经验 |
| drop_equip | rarity/cost | 随机品质装备×1（结算时 roll 具体 ID），缓存精确 ID |
| reforge | sell_price, new_rarity, cost | 消耗背包首件未装备 common → 金币＋新品质装备×1 |
| card_trade | grants, consumableGrants, cost, hpCost, gold, removesPurple | 精确持续卡／道具数量、紫层净化；缓存用 cardGrants；无确认字段 |

---

## 11. 商店 / 营地 / 路线规则

### 11.1 商店（buildShop，`store/helpers.ts`）

- 槽位：强化 3（白/蓝/金加权抽、排除治疗）+ 装备 3（无放回随机，等级 `(stage−1)×2+1+rng×2`）+ 治疗 1（急救包 20 / 大急救包 50）+ 消耗品 2（5 种无放回）。
- 刷新：首刷 10 金，每次 **+10**（10→20→30…），重建全部槽位；离开重进**不重置**货架/刷新次数/移除标记。
- 移除强化：30 金，每店限一次，撤一层白/蓝/金/红（正负同撤，不退原价）。
- 卡面只显示图标+名字+价格；**点击卡片弹窗查看完整效果，购买在弹窗内**。

### 11.2 营地

- 治疗 = 30% 生命上限（受治疗衰减、不超上限），每节点一次；满血也可休整；**不净化**。
- 未休整也可"先离开"，选定下一层前可重入（restUsed 不重置）。

### 11.3 路线

- 每阶段 10 层 + boss；每层 2~4 节点（3/6/9 层固定 商店+休息+随机）；第 11 层 boss。
- 连线：最近邻双向补齐保证无死路 + 额外分叉不交叉（`connectRouteLayers`）；`nextIds` 是通行唯一依据。
- 地图显示：金色"可前往"=accessible；墨色双圈"刚完成/可再次进入"=currentNodeId；墨圈=已完成；淡虚线=未来；褪色=已放弃。"定位进度"按钮滚动到当前进度。

---

## 12. 进度与经济

### 12.1 经验与升级

- 曲线：`xpToNext(level) = 25 + (level−1)×12`（Lv1→25、Lv2→37…）；`gainXp` 循环可连升。
- 每升 1 级 = 奖励队列排入一份三选一（`reason:'levelup'`）。
- 经验来源：击杀 `floor((tier×8 + floor(总蓄力/8)) × (1+xpBoost)) × 节点倍率(精英2/boss3)`；事件 xp；套装 doubleXp 翻倍。

### 12.2 金币

```
基础 = floor(敌 tier × 15 × (1 + goldBoost + 敌方修正) × (1 + greedRating)) × 节点倍率(1/2/3)
金币 = 基础 + 剩余基础步数 × 2        -- 只奖基础 6 步的剩余，额外步数不奖
```
doubleGold（套装结构支持）再 ×2。溢出伤害可选 1:1 金币或 2:1（floor）经验。

### 12.3 灵魂碎片（局外货币）

`runShards = floor(max(0, 金币) × 0.1) + (胜利 ? stage×10 : 5)`。

### 12.4 局外永久升级（5 项，一次性）

| id | 效果 | 价 |
|---|---|---|
| meta_hp_1 / meta_hp_2 | 初始 maxHp +10 / +10 | 10 / 30 |
| meta_atk_1 / meta_atk_2 | 初始攻倍率 +10% / +10% | 15 / 50 |
| meta_start | 开局多一次卡牌奖励 | 40 |

### 12.5 图鉴

- 击杀即解锁（getBestiaryId 归并种族；旧无尽 id 尽量归并）。
- 单敌：每 5 杀领 +3 碎片。全局：每 20 个里程碑领 +10 碎片 + 永久 maxHp+3。
- 解锁数里程碑（自动）：3→15 碎片、6→HP+5、10→25 碎片、13→攻倍率+5%、16→50 碎片+HP+10。
- 持久化 `z80z_meta`（仅局外；**局内冒险不自动存档**）。

---

## 13. 确定性与随机

- `createRng(seed)` = **Mulberry32**（魔数 0x6d2b79f5，Math.imul 混淆）。
- `createScopedRng(seed, ...scope)`：对每段做 FNV-1a 变体哈希（段长前缀防拼接歧义）后喂给 Mulberry32。
- `store._rng(...scope)` = `createScopedRng(runSeed, stage, currentNodeId ?? 'start', ...scope)` —— **同一 seed + 同一操作序列 = 完全相同的对局**。
- 作用域标签清单：`'shop',refreshCount`／`'event'`、`'event-choice',i`／`'spawn',round,turnsUsed`／`'equipment',round`／`'board',round`／`'combat',round,turnsUsed`／`'loot'`／`'reward',rewardRollCount`；路线生成 stage1 用 `createRng(seed)`、后续 `createScopedRng(runSeed,'route',stage)`，连线索引用节点签名作种子。
- **破坏可复现性的行为**（都禁止）：在玩法路径用 Math.random、修改 rng 消耗次数（新增抽签要条件化，如暴击仅持卡时消耗）、把 rng 传给展示层。

---

## 14. 测试与基线基建

### 14.1 30 个测试文件（tools/tests/，`run-tests.mjs` 自动发现）

art-resources（美术资源资产校验）、board-effects（棋盘动效/浮字）、board-rewards（奖励池）、card-domain（卡定义/聚合/派生）、card-events（事件卡交易）、characterization（种子快照）、display-text（效果文案）、equipment-combat（装备+战斗公式）、events-progression（事件结算与无尽进度纯逻辑回归）、events-expansion（三档随机事件字面量契约与真实 Pinia 结算回归：支付/净化/重铸/黑卡/治疗/主动支付统计/代价摘要）、events-forced（无安全出口、全三档零依赖防死锁、禁用原因与机器人选择策略）、gen-events-guide（事件指南生成器纯函数与磁盘一致性）、map-icons（图标资产）、null-safe-costs、package-size（微信包体统计与门禁边界）、panel-motion、planned-red-core/planned-red-store（红卡体系）、route-branches（路线分支）、route-layout（地图布局）、route-progress（进度文案）、shop-layout（商店网格）、sixcolor-combat（战斗公式全集）、sixcolor-store（store 流程）、storage-validation、store-regressions、swipe-input、ui-components（SFC 编译+挂载）、ui-feedback、w2-bugfix。

### 14.2 harness 原理与写法

- `tools/harness.mjs`：typescript.transpileModule 把 `.ts` 转 CJS + Module._cache 注入；`.vue` 不会被自动处理——**ui-components 测试里被 import 的 .vue 必须先 `compile('components/X.vue')`**。
- 断言惯例：`freeze()` 冻结输入证不改写；`sequence(...)` 受控 rng（多余调用直接 fail）；测试入口把 `Math.random` 替换为抛错，强制显式 rng。

### 14.3 改卡必改的硬编码位置（清单）

| 位置 | 内容 |
|---|---|
| `tools/tests/card-domain.mjs:19-21` | 池长 43、id 去重、即时卡数 |
| `tools/tests/card-domain.mjs` expected 表 + 聚合断言 | 每张卡首效果 + 40 键×1000 层聚合值 |
| `tools/tests/display-text.mjs:63` + expected 表 | 池长 43 + 每卡文案逐字断言 |
| `tools/tests/card-events.mjs` channel/obtainable 清单 | 每个交易事件的获取渠道与可获取断言 |
| `tools/tests/events-progression.mjs` 阶段计数与逐项契约 | 每阶段事件数/结构/结算回归 |
| `tools/tests/board-rewards.mjs` | 金卡数 13 等 |
| `tools/tests/characterization.mjs` + `planned-red-store.mjs` | seed42 固定抽卡表 |
| `tools/simulate.mjs` cardScore/outcomeScore/choiceScore | 新效果键的机器人权重 |

### 14.4 基线工作流（玩法改动评估，录制需单独批准）

当前 `tools/simulate.mjs` 的 `RULE_VERSION` 为 **`sixcolor-v3-flat-defense`**（2026-11-12：新增固定减伤线性通道——坚甲/守拙/磨砺之盾/棘盾契约；更早版本基线保留作对比）。parity／多策略工具从它导入版本。`tools/baselines/` 下所有历史基线（sixcolor-v1-\*、v2 各版本）保留，不覆写。规则版本切换不等于基线已录制，也不是自动 record 的授权。

玩法改动按任务授权做测试与只读验证；缺失新版本基线时先报告缺失，可用 `--report-only` 查看当前实际结果：

```bash
node tools/run-tests.mjs
node tools/simulate.mjs --report-only
node tools/parity.mjs --report-only
node tools/balance-strategies.mjs --smoke
```

**只有整合完成、真实差异经审阅且明确批准录制后**，才选择需要的录制命令：

```bash
node tools/simulate.mjs --update-baseline
node tools/parity.mjs record
```

默认 check 只读，缺失／不匹配会失败；录制写当前版本／配置命名空间，同版本同配置会写既有目标，不能盲目每次规则改动都 record，更不能重录掩盖失败或重复种子不一致。回复说明行为与哈希变化原因、测量口径和未验证项，不把旧通关率改名为新率。**本轮（sixcolor-v3-flat-defense）30组测试、类型/SFC 检查已通过；新版本基线尚未录制，模拟与统计以 `--report-only` 结果如实报告，待差异审阅并批准后单独录制；更早版本基线原样保留。**

---

## 15. UI 架构

- **单页外壳** `pages/index/index.vue`：按 `store.screen` 切 10 个屏幕；悬浮工具栏（规则/装备/强化[战斗]/道具[非战斗]/主题/调试）。
- **弹层模式**：`useModalMotion(reduced)` 返回 `{mounted, closing, open, close, reset, onTransitionEnd}`；宿主写法 = `v-if="x.mounted.value"` + `ui-motion-closing` 类 + `@click.capture/@keydown.capture blockClosing` + `@transitionend`；页面外壳把自身挂载的六个弹层（规则/装备/强化/道具/主题/调试）mounted OR 成全局 `inputBlocked` provide 给棋盘/道具栏阻断输入（各屏幕内部的弹层自行阻断自身交互）。**收起动画期间保留遮罩与阻断**。
- **棋盘动效**：150ms 移动门 + 280ms 冲击 + 最多 64 装饰节点；浮字"攻击 +X"经 `formatAttackGain` 保留两位小数（浮点尾巴不外露）；减少动态效果时浮字改静态文字（数值反馈不丢失），装饰全部关闭。
- **reduced-motion 三层**：`prefers-reduced-motion` 媒体查询、`.motion-reduced`（容器类）、`.zcode-motion-reduced`（H5 documentElement 类）。
- **属性说明**：点生命/攻/防/速/步数/金币/经验/敌人属性 → AttributeHelp 弹窗（第一层通俗值+当前量，展开"怎么算"看公式）；数据源 effectivePlayer/activeCardModifiers/battlePreview。
- 面板内容在收起过渡期间保持挂载，动画完才卸载；切屏强制 reset 所有弹层。

---

## 16. 构建与发布

- `tools/build.mjs <dev|build|preview> <h5|mp-weixin>`：子进程调 uni CLI，注入 UNI_PLATFORM/UNI_OUTPUT_DIR/CI=1；**mp-weixin 构建后自动跑 optimize-mp-art 并校验包体 ≤2 MiB**（超限即失败）。
- `tools/optimize-mp-art.mjs`：只压**构建产物副本**（敌人 128/徽记 96/道具与地图图标 128/场景 480 宽、删 SVG），`static/` 源图不动。
- `tools/upload-mp.mjs --appid wx...`：appid 校验 `wx[0-9a-f]{16}`、只写构建副本 project.config.json、调微信 cli 上传——**真实 appid 绝不提交**。
- #ifdef 差异全在 H5 侧：viewport 高度、Board 鼠标拖动、reduced-motion 监听、换屏回顶；微信端触屏滑动为默认路径。
- 调试面板（DEBUG_ENABLED=__DEV__）只在 dev 构建，正式构建无入口且 debug 动作无效。

---

## 17. 红线与约定汇总

1. **`manifest.json` appid 固定 `touristappid`**；真实 appid 仅本地上传临时注入。
2. **代码改动验证**：按任务授权跑单测／类型／相关UI与只读simulate／parity；玩法差异需解释。纯文档任务若明确要求不跑test/build则只静态核对；基线录制须另经审阅与批准（§14.4），不随规则变更自动record。
3. **哈希锚点纪律**：SHA-256 变化必须给出原因与 parity 证明，不得静默重录。
4. **无限叠加原则**：任何卡不得设层数上限；概率/比例走评级曲线逼近 100%（唯一例外：步数保底 1）。
5. **红/紫/黑获取铁律**：每种风险卡都必须有正常游戏获取事件；事件强制选择（无安全出口），但每个事件必须至少有一个不依赖金币、生命或持有物的可用选项。
6. **事件点选即结算**：`CHOOSE_EVENT` 在一次确定性作用域抽签内完成分支抽取与档内结算并缓存 `eventResult`；不重抽、不重掷，重复选择不重复发奖。
7. **文案禁词**：summarizeEffect 输出禁"评级/系数/强力收益/正面收益/负面代价"；事件文本禁"不详/永久/半价/可欠债/稀有以上/损失 N 步/跳过一次地图移动"。
8. **数值文本通俗化**：面向玩家的文案给"实际值/百分比"，公式细节收进"怎么算"。
9. **C 盘备份目录只读**；开发只动 `E:\Zcode project\z80z-2048`。
10. **发布授权**：默认不自动 commit/push GitHub、不上传微信、不审核发布；只有用户明确要求相应动作时执行，并且只对当前任务有效。交付物打包到 `E:\Zcode project\z80z-2048-deliverables\<主题>\`（源码+H5+微信三个 zip，校验 touristappid）。
11. 交付前浏览器实测 4173（390×844 视口），微信端以编译验证为准（真机未测要注明）。

---

## 18. 标准任务手册

### 18.1 加一张强化卡（用本轮 15 卡的实操路径）

1. **是否需要新机制键？** 是 → `types/index.ts` CardModifiers 加键 → `core/cardEffects.ts`：EFFECT_RULES 加 scope/polarity、emptyCardModifiers 加 0、（stat 键）deriveCardPlayer 映射、（红卡正面）isStrongMechanic 阈值。
2. **引擎消费**：`core/battle.ts` 对应段（processTurn 蓄力段 / getBattlePreview 承伤段 / resolveRound 攻击与回合末段 / startNewRound）。**rng 消耗必须条件化**（仅持卡时抽签），否则破坏既有种子序列。
3. **定义**：`core/upgrade.ts` UPGRADE_POOL 用 `card()/effect()` 工厂；icon 复用现有键。
4. **文案**：`utils/displayText.ts` summarizeEffect 加 case（禁词注意）。
5. **获取来源**：白/蓝/金自动进奖励与商店；红/紫/黑必须接入事件（risk_shrine/cursed_archive/abyss_contract 的 choices）。
6. **测试 8 处**：card-domain（池长/expected 表/聚合值/deriveCardPlayer）、display-text（池长/文案表）、card-events（交易 grants 表、obtainable 清单）、events-progression（tradeEvents 契约、事件计数、obtainable）、characterization + planned-red-store（seed42 抽卡表）、board-rewards（金卡数）、sixcolor-combat（新机制冻结断言）、sixcolor-store（store 层行为）。
7. **simulate 权重**：`tools/simulate.mjs` cardScore/eventScore 补键（正面小正分、诅咒负分）。
8. **基线**：§14.4 工作流；**文档**：SIXCOLOR_RULES 卡表 + 本文件 §6。

### 18.2 加一个事件

在 `core/events.ts` EVENTS 加定义（精确id、stageMin、choices；三档用既有 `pick`/`tradeO`/`o` 助手，即时治疗用 `heal`，机关／装备／重铸复用原效果）→ 检查选项门禁（`getEventChoiceDisabledReasonForChoice`）与结算职责（`CHOOSE_EVENT` fail-fast）→ 按实际数据同步事件计数、阶段累计池及相关测试（events-expansion 字面量契约／events-progression等）→ `node tools/gen-events-guide.mjs --write` 重新生成 EVENTS_GUIDE.md 并同步本文§6／§10与 SIXCOLOR_RULES／README入口。只有新效果字段才走§18.3；规则版本与是否录制基线按§14.4分别决定。当前34事件复用15类效果，无需为新增来源扩战斗机制。

### 18.3 加一个效果字段（如 removesPurple）

events.ts：EFFECT_FIELDS 白名单 → `pick`/`tradeO`/`o` 助手与结算透传 → getCardTradeDisabledReason 校验（context 缺字段时给禁用原因）→ resolveEventEffect/gameStore `CHOOSE_EVENT` 点选即结算（invariant fail-fast）→ 测试同步。

### 18.4 调一个数值

只动 `core/upgrade.ts`/`core/battle.ts`/`core/enemy.ts` 等对应常量 → 授权范围内测试及只读simulate/parity（必要时report-only）→ 解释真实行为／哈希变化与测量结果。若需要新基线，整合完成后按§14.4单独审阅批准录制；不要假定每处数值都必改固定快照，也不要用盲目record消除差异。

### 18.5 加一个消耗品

`core/consumables.ts` 定义（validateConsumable 约束）→ gameStore USE_CONSUMABLE 分支（或走 modifiersFromEffects 泛化）→ 使用场景校验 → card-domain 消耗品段 → 商店池自动。

### 18.6 发版检查单

tests 30/30 → tsc 0 错 → SFC 编译 → simulate/parity（新规则版本先 `--report-only`，基线录制需单独批准）→ `build h5` + `build mp-weixin`（包体 >2MiB 构建失败）→ 4173 浏览器实测（390×844）→ 打包三 zip 到 deliverables → 仅执行用户明确授权的提交／推送／上传动作，回复准确结果和未实测范围。

---

## 19. 已知限制与未验证范围

- **微信真机未实测**：编译通过 ≠ 真机性能/兼容验证；所有"微信可用"结论仅到编译级。
- **模拟 ≠ 真人平衡**：tools 里的五种策略（baseline/corner/attack/defense/economy）是固定算法，通关率不代表真人。
- **2026-11-07 前期平衡包（历史实测，不是当前规则的通关率）**（针对“前期玩家数值追不上怪物”的实测3~10倍倒挂）：防御公式÷6→÷3、敌人回合成长前两回合缓冲、stage1/2敌防与boss数值下调（岩石巨人130/28/10、远古巨龙170/44/14）。当时attack策略打过stage1 boss 26/50（52%）、stage2 boss 14/50（28%）、整局胜利8~15/50（改前5）；baseline当时仍全灭。这些样本保留历史口径，不能迁移为 `sixcolor-v2-forced-events-r2` 的通关率，扩充后需独立测量。原目标口径：boss击杀/存活比≤1.5x；stage3+高压是后期曲线设计。
- **2026-11-09 三档随机事件（sixcolor-v2-random-events，历史实测口径同上）**：34 事件全部改为每选项 3 种随机结果（主题化档名、点选即结算、收获不预告、黑卡免确认）。与前版 `sixcolor-v2-forced-events-r2` 五策略 50+50 对比：baseline 3→2 / 2→2、corner 12→12 / 17→13、attack 15→14 / 19→19、defense 14→12 / 14→11、economy 11→11 / 11→10（checkpoint/holdout 通关数），整体**略变难**（收益事件档位略抠、付费落空档引入），attack/corner/economy 基本持平；200 种子 parity 17 胜（前版 20）、全部 valid、0 invalid slides。三档波动大于前版单点结算，真人体感差异会大于算法差异。
- **2026-11-10 一致性修复（sixcolor-v2-consistency-fixes，前一版本）**：①浴血狂怒换算修正——`lowHpFury` 参数 6 现按“每损失 10% 生命攻击倍率 +6 个百分点”计（半血单层 +0.30，修正前错误地 +30）；②事件负金币档标记主动支付并经 `_spendGold` 计入“挥金如土”（修正前绕过消费统计），意外损失不计；③选项代价摘要 `summarizeChoiceCost` 由 UI 与文档生成器共用，代价列不再全部显示“无”；④微信包体超 2MiB 构建失败真正生效。新基线待审阅批准后录制。
- **无尽模式**：stage≥4 程序生成，数值随 stage 线性放大，没有"通关终点"——平衡数据只覆盖 stage1~3 为主。
- **局内不自动存档**：刷新/关页即弃局（设计如此）；只有局外 meta 持久化。
- 浏览器验证基于 H5；微信端共享逻辑但渲染层（skyline/webview 差异）未覆盖。

---

## 20. 术语表

| 术语 | 含义 |
|---|---|
| 蓄力（totalAttack） | 合并积攒的本回合攻击；回合清零（过载核心/蓄力起步可带初始值） |
| 评级 / 自然分数 | 无限叠加的概率型参数；实际比例 = 评级÷(1+评级)（naturalFraction） |
| 机制护甲 / 传承护甲 | 锻甲合流当场生成 / 上回合按传承比例留下的护甲 |
| 溢出伤害 | 计划伤害超出敌人剩余生命的部分 + 斩杀补刀；结算时换金币或经验 |
| 词缀 | 敌人强化（13 条池，按 stage 数量无放回抽取） |
| 作用域 rng | 由 runSeed+stage+节点+用途派生的确定性随机流 |
| 基线 | tools/baselines/ 下的 simulate 哈希与 parity 统计锚点 |
| 灵魂碎片 | 局外货币：结算获得，买永久升级/图鉴奖励 |
| pending 点数 | 起始方块没放完的余额，空位出现后继续放置 |
| 可再次进入 | 商店/营地在选定下一层前的重入状态（不标 completed） |
| 点选即结算 | 事件选项点击后一次抽签结算（`CHOOSE_EVENT`），无预览/确认步骤；结果页只做展示 |
| ui-entry / ui-feedback | 全局入场动画与成功提示类（App.vue 公共原语） |

---

<a id="part-4"></a>

# 第4部分 · 六色强化与消耗品详单（原 SIXCOLOR_RULES.md）


## 卡片分类

本文件按 `E:\Zcode project\z80z-2048` 当前源码同步（2026-11-12）；卡池为 **45 张持续卡＋2 张即时卡**，事件为 **34 个强制事件 × 每选项 3 种随机结果**（113 选项／339 档），规则版本为 `sixcolor-v3-flat-defense`。装备仍是普通／稀有／史诗三档，与下列卡片分类完全独立。系统机制见 PROJECT_ANALYSIS.md，全部事件的 label、成本、精确奖励数量与概率见 EVENTS_GUIDE.md，项目入口见 README.md。

| 分类 | 意义 | 持续卡数量 |
|---|---|---:|
| 白色 | 只提升基础属性 | 8 |
| 蓝色 | 调整已有机制参数 | 8 |
| 金色 | 增加正面触发机制 | 14 |
| 红色 | 一条强力正面机制＋一条负面机制 | 7 |
| 紫色 | 纯负面，仅特殊净化 | 5 |
| 黑色 | 纯负面，本局不可解除 | 3 |

共 **45 张持续卡＋2 种即时补给＝47 个卡池定义**，另有 **5 种携带道具**，不计入 47。持续卡可无限获得，按“定义＋数量”聚合，不设 maxStacks。JavaScript 精确整数范围属于输入安全边界，超过范围会在发卡前拒绝，不伪装成已成功获得。

## 持续卡表：每层收益／代价

| 颜色 | 名称 | 每层效果 |
|---|---|---|
| 白 | 攻击强化 | 攻击倍率＋8个百分点 |
| 白 | 防御强化 | 防御倍率＋8个百分点 |
| 白 | 生命训练 | 最大生命＋8，获得时等量回复（受治疗衰减） |
| 白 | 淘金者 | 战斗基础金币倍率＋3个百分点 |
| 白 | 均衡训练 | 攻击倍率＋5个百分点，同时防御倍率＋5个百分点 |
| 白 | 血脉坚韧 | 最大生命＋6（获得时等量回复），同时防御倍率＋3个百分点 |
| 白 | 见多识广 | 战斗获得经验＋10个百分点 |
| 蓝 | 快速思考 | 每回合＋1步 |
| 蓝 | 强力攻击 | 合并积蓄系数＋10个百分点 |
| 蓝 | 灵活身法 | 生成方块护甲系数＋0.2 |
| 蓝 | 开局优势 | 每回合＋4点起始方块数值 |
| 蓝 | 蓄力起步 | 每回合开局自带3点蓄力 |
| 蓝 | 幸运生成 | 新方块为4的概率＝10%＋90%×评级／(1＋评级)，无限逼近必出 |
| 蓝 | 减半护佑 | 回合结束时每个方块不减半概率＝评级／(1＋评级)，无限逼近必不减半 |
| 金 | 连锁战意 | 连续合并每层连锁＋4点额外蓄力，非合并移动重置连锁 |
| 金 | 锻甲合流 | 按每次合并数值的25%生成机制护甲 |
| 金 | 护甲传承 | 护甲保留评级＋0.25；比例＝评级／(1＋评级) |
| 金 | 生命汲取 | 吸血评级＋0.08；比例＝评级／(1＋评级)，只按实际生命伤害 |
| 金 | 连锁回响 | 未合并的回合连锁按保留比例延续（向下取整）；比例＝评级／(1＋评级) |
| 金 | 猎手印记 | 斩杀线＝敌人最大生命×评级／(1＋评级)；一击后敌人剩余生命低于斩杀线直接击杀，补刀计入溢出 |
| 金 | 致命节奏 | 暴击概率＝评级／(1＋评级)；暴击伤害×2，同时放大溢出与吸血基数 |
| 金 | 过载核心 | 回合结束时每剩余1步，转化为下回合开局2点蓄力 |
| 红 | 狂战契约 | 合并爆发系数＋100%；来袭伤害系数＋30% |
| 红 | 血之契约 | 吸血评级＋0.5；每回合结束流血3点 |
| 红 | 双刃赌局 | 追加攻击评级＋1，概率＝评级／(1＋评级)，每回合最多追加一次；触发追加时反噬4点 |
| 红 | 猎魔契约 | 斩杀线＝敌人最大生命×50%；来袭伤害系数＋25% |
| 红 | 贪婪之约 | 战斗金币收益×(1＋评级)，1层翻倍；每回合结束灼烧4点 |
| 紫 | 灼烧诅咒 | 每回合结束损失2点生命 |
| 紫 | 衰败诅咒 | 治疗衰减评级＋0.2；实际回复＝原回复／(1＋评级) |
| 紫 | 散能诅咒 | 蓄力散失评级＋0.15；新增蓄力＝原新增蓄力／(1＋评级)，不追溯已有蓄力 |
| 紫 | 迟滞诅咒 | 每回合行动步数−1（最多减到1步） |
| 紫 | 脆甲诅咒 | 护甲侵蚀评级＋0.15；回合间保留比例按(传承评级−侵蚀评级)计算，可完全抵消 |
| 黑 | 噬魂宿命 | 每次实际合并移动反噬2点生命 |
| 黑 | 轮回宿命 | 回合结束存活敌人回复4点生命，不复活已击败敌人 |
| 黑 | 阴影低语 | 敌人攻击每回合成长＋1 |
| 金 | 战魂图腾 | 每击败一个敌人，攻击倍率＋2个百分点，整局累积 |
| 金 | 英魂宝珠 | 每击败一个敌人，最大生命＋3并回复生命（受治疗衰减） |
| 金 | 熔炼掌握 | 整局每累计合并100点方块数值，攻击倍率＋1个百分点 |
| 金 | 挥金如土 | 每累计主动支付25金币，攻击倍率＋1个百分点（购买/交易/赌注计入，意外损失不计） |
| 金 | 百战老兵 | 每进入一场战斗，攻击倍率＋1个百分点 |
| 红 | 浴血狂怒 | 当前生命每降低10%，攻击倍率＋6%（满血无加成）；来袭伤害系数＋25% |
| 白 | 坚甲 | 每次承受攻击的伤害−1 |
| 蓝 | 守拙 | 交战结算时每剩余1点行动步数，本次承伤额外−1 |
| 金 | 磨砺之盾 | 整局每累计承受30点伤害，固定减伤＋1 |
| 红 | 棘盾契约 | 受击时按评级概率反弹（2×层数＋本次减免量）伤害；攻击散失评级＋0.3 |

每层参数加算，不逐层复利。概率与保留比自然趋近100%并不是卡片层数上限。红卡移除一层时正负两条同时撤销；已经结算的伤害、治疗和费用不追溯。

## 获取和解除

- 普通升级／商店仅白、蓝、金；商店价格20／50／90金币。
- 精英奖励蓝／金，首领奖励金卡；不将六色当作可比较的高低梯级。
- 奇遇共 **34 个强制事件、112 个选项、336 档随机结果**：每选项恰好 3 档（权重和 100，主题化档名），点选即结算，收获不预告；不可行档抽取时自动剔除。累计可抽池 **S1 12／S2 26／S3+ 34**，按 `stageMin <= stage` 均匀抽取。每事件至少一个选项的全部三档零依赖（0金、1生命、无装备无紫卡也能推进）。
- 狂战祭坛提供 **7 种红卡**选择（含 `blood_fury`、`thorn_aegis`）；诅咒藏书室提供5组金卡与紫卡的交易；深渊契约提供3组金卡与黑卡交易（黑卡三档都给，作为固定代价）。星界棋局提供金卡组合、金／黑交易及 `red_hunt` 来源。黑卡点选即生效，本局不可解除。
- 新增正面卡来源：信使的 `xp_1`；训练室的 `balanced_1`／`def_up_1`／`vigor_1`；镜面水池的 `spawn_luck_1`／`halve_shield_1`／`atk_up_2`；钟楼的 `bonus_turn_0_5`／`charge_start_1`／`gold_saved_steps`／`gold_combo_grace`；铸匠的 `gold_merge_armor`／`def_up_1`／`vigor_1`；成长卡 `war_soul_totem`／`soul_orb`／`smelting_mastery`／`spend_blade`／`veteran_blade` 来自普通奖励池。废弃营地、钟楼、断咒祭坛与猩红药圃增加道具来源；这些复用现有卡／道具定义，不增加卡池总数。精确价格、数量及整份组合见 EVENTS_GUIDE.md。
- 流浪的净化师（S2+）40金币净化1层紫卡；断咒祭坛（S2+）可付15当前生命／35金币净化1层、65金币净化2层，或45金币买 `cleanse_potion` ×1留待之后使用。购买药剂不要求当下有紫卡，立即净化选项要求足够紫层。
- **每个事件只能选一个且不能跳过**：`CHOOSE_EVENT` 点选即结算（分支抽取 + 档内结算一次完成），随机不重掷；`LEAVE_EVENT` 离开结果页。没有预览、确认或换选 action；门禁通过后内部预检失败会抛错暴露（fail-fast），避免静默软锁。
- 机关失败扣血至少留1点；交易固定 `hpCost` 的档位要求支付后至少留 1 点。**选项级禁用只在三档全部不可行时发生**；部分档位不可行（金币/生命/紫层不足）时该档在抽取时剔除，选项仍可点击。即时治疗走事件 `heal`（或混合／上限诅咒分支），不以 instant 卡 grant 替代；事件交易发卡预检只接收持续卡。
- 所有红／紫／黑定义都有正常游戏中的获取选项，不仅是调试按钮。
- 营地只治疗（生命上限30%，每节点一次）；选定下一层前可以离开再进，休整次数不重置。紫卡的移除途径是净化药剂或特定奇遇，篝火不净化；「废弃营地」奇遇不是可重入的营地节点。
- 商店移除只能解除一层白／蓝／金／红持续卡；紫卡需要净化药剂或特定奇遇；黑卡本局任何解除入口都拒绝。**事件净化按持有列表首张合法紫卡逐层处理，多层先减该张**，双重断咒不保证影响两种紫卡。新局清空所有局内负面卡。

## 两类消耗品

| 名称 | 分类／时效 | 效果 | 价格 |
|---|---|---|---:|
| 急救包 | 白·领取即用 | 回复12生命 | 20 |
| 大急救包 | 白·领取即用 | 回复30生命 | 50 |
| 战术药剂 | 蓝·本回合 | 本回合＋2步 | 35 |
| 蓄能药剂 | 蓝·本回合 | 后续合并积蓄系数＋50个百分点，不追溯已有攻击 | 35 |
| 连锁卷轴 | 金·本场战斗 | 连续合并每层连锁额外＋8蓄力 | 60 |
| 狂战药剂 | 红·本回合 | 爆发＋100%；来袭伤害＋30% | 45 |
| 净化药剂 | 金·即时 | 净化一层紫卡，不能解除黑卡 | 50 |

携带道具存数量，购买不自动使用。战斗药剂／卷轴仅操作阶段使用，不消耗滑动步数；净化只能路线、商店或营地使用。无库存、阶段错误或无合法净化目标时不扣道具。本回合效果下回合清除，本场效果战斗结束清除，新局清空携带库存。

## 战斗数值

```
总护甲 = floor(盘面总和 × 防御倍率 / 3
             + 本回合生成值 × 生成护甲系数
             + 机制护甲 + 结转护甲)
        + 固定防御

来袭伤害 = ceil(敌攻 × 15 / (15 + 总护甲))
```

之后计算易伤、首击守护与闪避等。正的敌人攻击在有限护甲下仍至少有1点基础伤害，取消旧的50%棋盘防御截断，避免两桶防御倍率相乘失控。

**固定减伤（sixcolor-v3）**：`承伤 = max(1, 易伤后伤害 − 固定减伤总量)`，其中总量 = 坚甲等卡牌加成 + 磨砺之盾整局累计 + 交战时剩余步数 × 守拙层数。它在易伤放大之后扣减，所以承伤加成不会被减伤稀释；`max(1,...)` 保底避免零伤免疫。

- 没有合并蓄力时不能靠固定装备攻击免费出手；普通移动不算合并。
- 装备回合再生只在完成有效合并并存活时触发。
- 省步金币只计算击杀回合未使用的基础步数，额外步数及之前回合等待不制造收益。
- 起始点数拆成2的幂方块，优先放大块；放不下保存在本场点数池。生命周期满足已分配＝已放置＋待放置，不按层数展开数组。
- 现有溢出兑换、合并经验及装备三档经济保持；敌人强化独立保留旧13种数值，不自动继承玩家新卡。

## 验证与平衡限制

- **历史验证记录（非本轮重跑）**：首版19组单元／回归覆盖1000层、红卡整体移除、紫／黑权限、临时效果、点数守恒、连续奖励旧点击、事件重复发卡及极大安全输入；当前34个强制事件以现有测试文件与主代理实际结果为准。
- 模拟支持基础、角落规划、攻击、防御、经济五种算法策略，记录实际卡层数、库存、损血／治疗和收益，不代表真人或最优策略。
- **历史首版调优**：护甲常数30对多策略过于惩罚，比较10／15后选15；调优过程和独立样本分开。后续2026-11-07前期平衡把盘面防御除数从6改为3，并调整敌人数值与成长缓冲，本文公式已按当前源码同步。
- **历史首版采样**：每策略种子1～50与独立301～350各复跑一次，共1000次模拟；另有默认200种子基线及阶段4合成测试。失败／超时／无进展应明确报告，不冒充战败。
- **仅作历史参考的首版率**：在常数15的首轮50＋50样本中，攻击策略通关三阶段为5/50与3/50，角落策略4/50与2/50，防御1/50与0/50，经济3/50与3/50；基础策略均0/50。这些不是前期平衡后或 **sixcolor-v2-random-events** 的新率，不能据此宣称当前难度或流派平衡。
- 普通模拟默认不接受负面契约（无安全选项时才回落到期望最高的可执行选项），因此不能证明红／诅咒流派平衡；机制组合覆盖与真人取舍试玩是不同证据。
- 当前 `RULE_VERSION` 为 **`sixcolor-v3-flat-defense`**（`tools/simulate.mjs`），parity／多策略工具导入同一版本；该版本为防御投资新增固定减伤线性通道（坚甲／守拙／磨砺之盾／棘盾契约四卡）。旧 `tools/baselines/` 下全部历史基线原样保留，不覆写；新录制使用当前版本命名空间，待差异审阅并批准后进行。
- 默认验证只读；可先用 `--report-only` 查看当前结果。只有整合完成、审阅差异且明确批准后，才执行所需 `--update-baseline`／`record`；规则变更、缺失基线或 mismatch 本身不是自动录制授权，同版本同配置的录制也会写既有目标文件。
- **当前版本验证状态**：30组单元／回归与类型检查通过（含生成器与包体门禁测试）；`sixcolor-v3-flat-defense` 新基线尚未录制，以 `--report-only` 结果为准。首轮五策略 50+50 实测：defense 8 胜（前版 9）、attack 20（前版 17）、corner 7（前版 12）、baseline 0、economy 4——新卡进入白卡池稀释了其他卡的出现率，净效果接近中性；固定减伤 1 点/层的力度在后期敌攻 50+ 时占比偏小，若要继续加强需另行调整卡面数值并复测。

---

<a id="part-5"></a>

# 第5部分 · 奇遇事件指南（原 EVENTS_GUIDE.md）

> 此部分表格由 tools/gen-events-guide.mjs 从 core/events.ts 自动生成；改事件后先重新生成源文件，再同步总文档。


> 按当前 `core/events.ts` 自动生成（`tools/gen-events-guide.mjs`，默认只读校验，`--write` 才写入）。共 **34 个强制事件、113 个选项、339 档随机结果**：点选即结算，结果页展示本次档位与收获；选项只显示代价，收获完全不预告。抽取时不可行档（金币/生命/紫卡不足）自动剔除，剩余档按权重归一化。本文若与源码冲突，以源码为准。
>
> 入口：README.md · 系统与职责：PROJECT_ANALYSIS.md · 卡牌和道具详单：SIXCOLOR_RULES.md。

## 通用规则

- **强制选择**：所有事件 `forced: true`，必须选一项，无法跳过也无法离开；每事件至少有一个选项的**全部三档**零依赖金币、生命或持有物，0 金残血也能推进。
- **点选即结算**：`CHOOSE_EVENT(index)` 在一次确定性作用域 RNG（`event-choice` + 选项序号）内完成 1 次分支抽取 + 档内结算（金币区间再抽 1 次、随机装备抽 3 次、重铸抽 4 次），立即落地并缓存 `eventResult`；结果页只做展示，「离开」(`LEAVE_EVENT`) 后回路线或接升级奖励队列。随机只抽一次，不可重选。
- **代价显示**：选项卡只显示 label 与交易代价行（金币/生命支付与紫卡/重铸前提，混合档显示范围或上限）；收获不预告。禁用的选项显示动态原因（如「金币不足：需要 35 金币」）；只有三档全部不可行时才整项禁用，部分不可行档在抽取时剔除。
- **交易先扣后发**：先收金币奖励、再扣成本、再发卡/道具、最后逐层净化首张紫卡；`hpCost` 要求支付后至少保留 1 点。主动支付（购买/赌注/投币）计入「挥金如土」消费成长，意外损失不计。黑卡三档都给（是固定代价），直接生效且本局不可解除，没有确认步骤。
- **档位标记**：✦ good（结果页金色）/ • mid（正文色）/ ✗ bad（警示红）。
- 装备奖励结算时从品质池随机基础 ID + 等级 `(stage-1)×2+1 或 +1` + 浮动 70–130；金币/经验区间含两端、等概率。
- 阶段池：S1 12 / S2 26 / S3+ 34，按 `stageMin ≤ stage` 均匀抽取，无跨节点去重。

## 引擎职责（核对时的函数定位）

| 位置 | 职责 |
|---|---|
| `core/events.ts` `EventOutcome`/`EventChoice` | weight/label/tone/effect 数据契约；选项恰好 3 档、权重和 100 |
| `resolveEventOutcome` | 可行档过滤（不可行档剔除）→ 权重归一化抽分支 → `resolveEventEffect` 档内结算 |
| `getEventChoiceDisabledReasonForChoice` | 三档结构校验 + 至少一档可行；全部不可行时返回首档原因 |
| `core/events.ts` `getEventCatalog`/`summarizeChoiceCost` | 只读事件目录与选项代价摘要（UI 选项卡与本部分表格共用） |
| `store/gameStore.ts` `CHOOSE_EVENT`/`LEAVE_EVENT` | 点选即结算（invariant fail-fast）+ 结果页缓存/离开 |
| `tools/simulate.mjs` `pickEventChoice`/`choiceScore` | 机器人按三档加权期望选选项 |
| `tools/gen-events-guide.mjs` | 本部分表格的自动生成器 |

## 事件列表

### 01 宝箱 · `treasure_chest`

`stageMin: 1`（S1+）；1 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 撬开箱盖 | 无 | 40% ✦满载：获得 18~30 金币<br>45% •有点收获：获得 8~16 金币<br>15% ✗空箱：获得 1~5 金币 |

### 02 治愈之泉 · `healing_fountain`

`stageMin: 1`（S1+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 畅饮泉水 | 无 | 70% ✦清冽甘泉：回复生命上限的 30%<br>20% ✗水中带刺：回复 30% 后基础生命上限 −10%（最低 10）<br>10% •泉水浑浊：回复生命上限的 10% |
| 轻抿一口 | 无 | 60% ✦精神一振：回复生命上限的 12%<br>30% •微有凉意：回复生命上限的 8%<br>10% •无甚感觉：无事发生 |
| 装瓶出售泉水 | 无 | 45% ✦卖了个好价钱：获得 15~25 金币<br>40% •正常价钱：获得 10~14 金币<br>15% ✗途中洒了：获得 2~5 金币 |

### 03 暗影祭坛 · `dark_shrine`

`stageMin: 1`（S1+）；2 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 献上 20% 当前生命 | 无 | 50% ✦神明回应：当前生命 −20%（留 1），攻击倍率 +10 个百分点<br>35% •低语应允：当前生命 −20%（留 1），攻击倍率 +8 个百分点<br>15% ✗祭品被无视：当前生命 −20%（留 1），攻击倍率 +4 个百分点 |
| 献上 15% 基础生命上限 | 无 | 50% ✦强大庇佑：基础生命上限 −15%（最低 10），防御倍率 +15 个百分点<br>35% •稳固庇佑：基础生命上限 −15%（最低 10），防御倍率 +12 个百分点<br>15% ✗庇佑摇曳：基础生命上限 −15%（最低 10），防御倍率 +6 个百分点 |

### 04 陨落战士 · `fallen_warrior`

`stageMin: 1`（S1+）；2 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 拾取遗落装备 | 无 | 45% ✦完好武器：获得随机普通装备 ×1（具体 ID/等级/浮动结算时随机）<br>40% •备用钱袋：获得 12~20 金币<br>15% ✗只剩碎布：无事发生 |
| 搜刮钱袋 | 无 | 40% ✦鼓鼓囊囊：获得 24~35 金币<br>45% •有点收获：获得 12~20 金币<br>15% ✗空空如也：获得 4~8 金币 |

### 05 狂战祭坛 · `risk_shrine`

`stageMin: 1`（S1+）；7 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 接受狂战契约 | 无 | 40% ✦血契狂喜：获得 红卡 red_berserk ×1，另获 10~18 金币<br>45% •契约生效：获得 红卡 red_berserk ×1<br>15% ✗血祭失败：无事发生 |
| 接受血之契约 | 无 | 40% ✦血契狂喜：获得 红卡 red_blood ×1，另获 10~18 金币<br>45% •契约生效：获得 红卡 red_blood ×1<br>15% ✗血祭失败：无事发生 |
| 接受双刃赌局 | 无 | 40% ✦血契狂喜：获得 红卡 red_double ×1，另获 10~18 金币<br>45% •契约生效：获得 红卡 red_double ×1<br>15% ✗血祭失败：无事发生 |
| 接受猎魔契约 | 无 | 40% ✦血契狂喜：获得 红卡 red_hunt ×1，另获 10~18 金币<br>45% •契约生效：获得 红卡 red_hunt ×1<br>15% ✗血祭失败：无事发生 |
| 接受贪婪之约 | 无 | 40% ✦血契狂喜：获得 红卡 red_greed ×1，另获 10~18 金币<br>45% •契约生效：获得 红卡 red_greed ×1<br>15% ✗血祭失败：无事发生 |
| 接受浴血狂怒 | 无 | 40% ✦血契狂喜：获得 红卡 blood_fury ×1，另获 10~18 金币<br>45% •契约生效：获得 红卡 blood_fury ×1<br>15% ✗血祭失败：无事发生 |
| 接受棘盾契约 | 无 | 40% ✦血契狂喜：获得 红卡 thorn_aegis ×1，另获 10~18 金币<br>45% •契约生效：获得 红卡 thorn_aegis ×1<br>15% ✗血祭失败：无事发生 |

### 06 废弃营地 · `abandoned_camp`

`stageMin: 1`（S1+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 使用残留药品 | 无 | 45% ✦药效尚存：回复生命上限的 22%<br>40% •药力微弱：回复生命上限的 12%<br>15% ✗药瓶已空：无事发生 |
| 翻找药箱 | 无 | 40% ✦完整药瓶：获得 道具 tactical_potion ×1<br>40% •散落药粉：获得 6~12 金币<br>20% ✗只剩空瓶：无事发生 |
| 搜集营地散币 | 无 | 40% ✦埋藏的钱袋：获得 10~18 金币<br>45% •零散硬币：获得 5~9 金币<br>15% ✗一无所获：无事发生 |

### 07 迷路的信使 · `lost_messenger`

`stageMin: 1`（S1+）；4 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 帮忙运送，领取报酬 | 支付最多 18 点生命 | 45% ✦重礼相酬：支付 18 点生命，获得 白卡 xp_1 ×1，另获 20~30 金币<br>40% •如约支付：支付 18 点生命，获得 白卡 xp_1 ×1，另获 12~20 金币<br>15% ✗空手而归：无事发生 |
| 购买旅行手记（15 金币） | 支付15 金币 | 45% ✦内容翔实：支付 15 金币，获得 白卡 xp_1 ×1，另获 5~10 金币<br>40% •普通手记：支付 15 金币，获得 白卡 xp_1 ×1<br>15% ✗无用小册：失去 15 金币 |
| 顺路捎一段口信 | 无 | 45% ✦酬谢金币：获得 8~12 金币<br>40% •一句道谢：获得 3~6 金币<br>15% ✗白跑一趟：无事发生 |
| 购买备用行装（30 金币） | 支付30 金币 | 40% ✦结实的护具：获得随机普通装备 ×1，支付 30 金币（具体 ID/等级/浮动结算时随机）<br>45% •买到补给：支付 30 金币，获得 道具 tactical_potion ×1<br>15% ✗买了假货：失去 30 金币 |

### 08 机关训练室 · `training_room`

`stageMin: 1`（S1+）；4 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 进行实战演练 | 支付最多 10 点生命 | 50% ✦收获颇丰：支付 10 点生命，获得 白卡 balanced_1 ×1，另获 5~10 金币<br>35% •有所进步：支付 10 点生命，获得 白卡 balanced_1 ×1<br>15% ✗动作变形：失去 10 点生命（留 1） |
| 参加防御课程（20 金币） | 支付20 金币 | 45% ✦要点尽得：支付 20 金币，获得 白卡 def_up_1 ×1，另获 5~10 金币<br>40% •正常上课：支付 20 金币，获得 白卡 def_up_1 ×1<br>15% ✗听打瞌睡：失去 20 金币 |
| 参加耐力课程（20 金币） | 支付20 金币 | 45% ✦要点尽得：支付 20 金币，获得 白卡 vigor_1 ×1，另获 5~10 金币<br>40% •正常上课：支付 20 金币，获得 白卡 vigor_1 ×1<br>15% ✗听打瞌睡：失去 20 金币 |
| 旁观课程 | 无 | 50% ✦记下要点：获得 12 经验<br>35% •一知半解：获得 6 经验<br>15% ✗无事发生：无事发生 |

### 09 石像的口袋 · `statue_purse`

`stageMin: 1`（S1+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 拾取外侧散币 | 无 | 40% ✦口袋松动：获得 10~18 金币<br>45% •几枚硬币：获得 5~9 金币<br>15% ✗只有石屑：无事发生 |
| 拆开机关暗袋 | 无 | 40% ✦完美开袋：获得 25~40 金币<br>35% •勉强掏出：获得 12~20 金币<br>25% ✗触发机关：失去 12 点生命（留 1） |
| 买通守袋者（25 金币） | 支付25 金币 | 40% ✦交出袋中物：获得随机普通装备 ×1，支付 25 金币（具体 ID/等级/浮动结算时随机）<br>45% •只好买药：支付 25 金币，获得 道具 tactical_potion ×1<br>15% ✗骗走金币：失去 25 金币 |

### 10 断裂的吊桥 · `sinking_bridge`

`stageMin: 1`（S1+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 攀着残索爬过去 | 无 | 45% ✦敏捷落地：当前生命 −15%（留 1），攻击倍率 +8 个百分点<br>40% •磨破手掌：当前生命 −15%（留 1），攻击倍率 +6 个百分点<br>15% ✗踩空半步：当前生命 −15%（留 1），攻击倍率 +2 个百分点 |
| 沿河岸绕远路 | 无 | 50% ✦平安渡河：回复生命上限的 12%<br>35% •涉水而行：回复生命上限的 7%<br>15% ✗滑了一跤：失去 4 点生命（留 1） |
| 拆下桥板当护具 | 无 | 40% ✦厚实桥板：获得随机普通装备 ×1（具体 ID/等级/浮动结算时随机）<br>40% •木板散落：获得 8~14 金币<br>20% ✗落入湍流：无事发生 |

### 11 哭嚎之井 · `screaming_well`

`stageMin: 1`（S1+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 投下金币安抚井灵 | 支付6~15 金币 | 45% ✦哭声平息：失去 10 金币<br>40% •短暂安静：失去 6 金币<br>15% ✗索要更多：失去 15 金币 |
| 献上一小段生命 | 无 | 45% ✦鲜血安抚：失去 8 点生命（留 1）<br>40% •疼痛抽搐：失去 10 点生命（留 1）<br>15% ✗井灵贪得：失去 14 点生命（留 1） |
| 割破手掌立誓 | 无 | 45% ✦血誓成立：当前生命 −10%（留 1），攻击倍率 +7 个百分点<br>40% •誓言微光：当前生命 −10%（留 1），攻击倍率 +5 个百分点<br>15% ✗誓言反噬：当前生命 −10%（留 1） |

### 12 饥饿的伏击者 · `starving_ambush`

`stageMin: 1`（S1+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 交出干粮 | 无 | 45% ✦伏击者满足：当前生命 −10%（留 1），防御倍率 +5 个百分点<br>40% •勉强放过：当前生命 −10%（留 1），防御倍率 +4 个百分点<br>15% ✗得寸进尺：当前生命 −10%（留 1），防御倍率 +1 个百分点 |
| 拼死突围 | 支付最多 18 点生命 | 40% ✦大胜：支付 18 点生命，获得 白卡 atk_up_1 ×1，另获 30~45 金币<br>45% •惨胜：支付 18 点生命，获得 白卡 atk_up_1 ×1，另获 12~22 金币<br>15% ✗落荒而逃：失去 18 点生命（留 1） |
| 说服从前的同伴 | 无 | 45% ✦旧情难忘：回复生命上限的 10%<br>40% •半信半疑：回复生命上限的 6%<br>15% ✗被驱逐：失去 6 点生命（留 1） |

### 13 赌徒的邀约 · `gambler`

`stageMin: 2`（S2+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 赌一把（20 金币） | 支付20 金币 | 45% ✦手气极佳：获得随机稀有装备 ×1，支付 20 金币（具体 ID/等级/浮动结算时随机）<br>25% •押中彩头：获得随机普通装备 ×1，支付 20 金币（具体 ID/等级/浮动结算时随机）<br>30% ✗输个精光：失去 20 金币 |
| 押上一点运气 | 无 | 25% ✦居然中了：获得随机普通装备 ×1（具体 ID/等级/浮动结算时随机）<br>35% •捡到铜板：获得 4~10 金币<br>40% ✗白费力气：无事发生 |
| 谨慎下注（5 金币） | 支付最多 5 金币 | 45% ✦稳稳命中：获得随机普通装备 ×1，支付 5 金币（具体 ID/等级/浮动结算时随机）<br>35% •赚回本金：获得 6~12 金币<br>20% ✗亏掉赌注：失去 5 金币 |

### 14 远古卷轴 · `ancient_scroll`

`stageMin: 2`（S2+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 仔细研读 | 无 | 45% ✦豁然贯通：获得 40~60 经验<br>40% •略有所得：获得 20~32 经验<br>15% ✗字迹模糊：获得 5~10 经验 |
| 简略翻阅 | 无 | 50% ✦快速浏览：获得 18 经验<br>35% •匆匆一瞥：获得 10 经验<br>15% ✗无心阅读：无事发生 |
| 出售卷轴 | 无 | 45% ✦遇到识货人：获得 12~20 金币<br>40% •正常成交：获得 8~14 金币<br>15% ✗只能贱卖：获得 3~6 金币 |

### 15 看似平静的地面 · `spike_trap`

`stageMin: 2`（S2+）；2 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 试着拆除机关 | 无 | 40% ✦完美拆除：获得 18~30 金币<br>35% •勉强拆掉：获得 8~15 金币<br>25% ✗机关触发：失去 12 点生命（留 1） |
| 快速冲刺过去 | 无 | 55% ✦一跃而过：无事发生<br>30% •落地踉跄：失去 6 点生命（留 1）<br>15% ✗重重摔倒：失去 18 点生命（留 1） |

### 16 诅咒藏书室 · `cursed_archive`

`stageMin: 2`（S2+）；5 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 研读连锁书卷 | 无 | 40% ✦完全领悟：获得 金卡 gold_combo ×1 + 紫卡 curse_burn ×1，另获 8~14 金币<br>45% •习得诅咒：获得 金卡 gold_combo ×1 + 紫卡 curse_burn ×1<br>15% ✗书灵抗拒：无事发生 |
| 研读汲取书卷 | 无 | 40% ✦完全领悟：获得 金卡 gold_lifesteal ×1 + 紫卡 curse_decay ×1，另获 8~14 金币<br>45% •习得诅咒：获得 金卡 gold_lifesteal ×1 + 紫卡 curse_decay ×1<br>15% ✗书灵抗拒：无事发生 |
| 研读传承书卷 | 无 | 40% ✦完全领悟：获得 金卡 gold_merge_armor ×1 + 金卡 gold_carry ×1 + 紫卡 curse_charge ×1，另获 8~14 金币<br>45% •习得诅咒：获得 金卡 gold_merge_armor ×1 + 金卡 gold_carry ×1 + 紫卡 curse_charge ×1<br>15% ✗书灵抗拒：无事发生 |
| 研读迟滞书卷 | 无 | 40% ✦完全领悟：获得 金卡 gold_crit ×1 + 紫卡 curse_heavy ×1，另获 8~14 金币<br>45% •习得诅咒：获得 金卡 gold_crit ×1 + 紫卡 curse_heavy ×1<br>15% ✗书灵抗拒：无事发生 |
| 研读过载书卷 | 无 | 40% ✦完全领悟：获得 金卡 gold_saved_steps ×1 + 紫卡 curse_brittle ×1，另获 8~14 金币<br>45% •习得诅咒：获得 金卡 gold_saved_steps ×1 + 紫卡 curse_brittle ×1<br>15% ✗书灵抗拒：无事发生 |

### 17 炼金补给 · `alchemy_supply`

`stageMin: 2`（S2+）；2 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 购买战术药剂（35 金币） | 支付35 金币 | 45% ✦附赠赠品：支付 35 金币，获得 道具 tactical_potion ×1，另获 6~12 金币<br>40% •正常购买：支付 35 金币，获得 道具 tactical_potion ×1<br>15% ✗钱袋被调包：失去 35 金币 |
| 帮忙整理药材 | 无 | 45% ✦店主道谢：获得 8~14 金币<br>40% •些许酬劳：获得 4~8 金币<br>15% ✗白忙一场：无事发生 |

### 18 流浪的净化师 · `cleansing_hermit`

`stageMin: 2`（S2+）；2 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 支付 40 金币，净化一层紫卡 | 支付最多 40 金币 | 50% ✦净化完成：支付 40 金币，净化紫卡 1 层，另获 6~10 金币<br>35% •净化顺利：支付 40 金币，净化紫卡 1 层<br>15% ✗仪式被打断：无事发生 |
| 听一段旧事 | 无 | 50% ✦引人入胜：获得 14 经验<br>35% •些许感悟：获得 8 经验<br>15% ✗呢喃难懂：无事发生 |

### 19 镜面水池 · `mirror_pool`

`stageMin: 2`（S2+）；4 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 选择数字倒影（30 金币） | 支付最多 30 金币 | 45% ✦清晰倒影：支付 30 金币，获得 蓝卡 spawn_luck_1 ×1，另获 5~10 金币<br>40% •模糊倒影：支付 30 金币，获得 蓝卡 spawn_luck_1 ×1<br>15% ✗倒影破碎：无事发生 |
| 选择石面倒影（30 金币） | 支付最多 30 金币 | 45% ✦清晰倒影：支付 30 金币，获得 蓝卡 halve_shield_1 ×1，另获 5~10 金币<br>40% •模糊倒影：支付 30 金币，获得 蓝卡 halve_shield_1 ×1<br>15% ✗倒影破碎：无事发生 |
| 选择力量倒影（30 金币） | 支付最多 30 金币 | 45% ✦清晰倒影：支付 30 金币，获得 蓝卡 atk_up_2 ×1，另获 5~10 金币<br>40% •模糊倒影：支付 30 金币，获得 蓝卡 atk_up_2 ×1<br>15% ✗倒影破碎：无事发生 |
| 俯身饮水 | 无 | 50% ✦清凉入喉：回复生命上限的 18%<br>35% •稍解干渴：回复生命上限的 10%<br>15% ✗水味苦涩：无事发生 |

### 20 废弃钟楼 · `abandoned_clock`

`stageMin: 2`（S2+）；5 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 加快节拍（35 金币） | 支付35 金币 | 40% ✦齿轮咬合：支付 35 金币，获得 蓝卡 bonus_turn_0_5 ×1，另获 4~8 金币<br>45% •正常上弦：支付 35 金币，获得 蓝卡 bonus_turn_0_5 ×1<br>15% ✗发条崩断：失去 35 金币 |
| 储存时间（65 金币） | 支付65 金币 | 40% ✦双重祝福：支付 65 金币，获得 蓝卡 charge_start_1 ×1 + 金卡 gold_saved_steps ×1，另获 6~12 金币<br>45% •完整储存：支付 65 金币，获得 蓝卡 charge_start_1 ×1 + 金卡 gold_saved_steps ×1<br>15% ✗钟芯碎裂：失去 65 金币 |
| 延续节奏（55 金币） | 支付55 金币 | 40% ✦韵律相扣：支付 55 金币，获得 金卡 gold_combo_grace ×1，另获 5~10 金币<br>45% •节奏延续：支付 55 金币，获得 金卡 gold_combo_grace ×1<br>15% ✗齿轮卡死：失去 55 金币 |
| 带走钟芯药剂（25 金币） | 支付25 金币 | 45% ✦珍藏佳酿：支付 25 金币，获得 道具 tactical_potion ×1，另获 3~6 金币<br>40% •正常药剂：支付 25 金币，获得 道具 tactical_potion ×1<br>15% ✗瓶身龟裂：失去 25 金币 |
| 听钟声静心 | 无 | 45% ✦心神安宁：回复生命上限的 8%<br>40% •稍感平静：回复生命上限的 5%<br>15% ✗钟声刺耳：无事发生 |

### 21 游荡铸匠 · `roaming_smith`

`stageMin: 2`（S2+）；6 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 交旧换新（消耗 1 件普通装备） | 需 1 件未装备普通装备 | 40% ✦大师手笔：消耗背包首件未装备普通装备，换随机稀有装备 ×1 + 15~22 金币<br>45% •正常重铸：消耗背包首件未装备普通装备，换随机稀有装备 ×1 + 8~15 金币<br>15% ✗失手损毁：消耗背包首件未装备普通装备，换随机普通装备 ×1 + 3~6 金币 |
| 委托锻造（60 金币） | 支付60 金币 | 45% ✦上乘之作：获得随机稀有装备 ×1，支付 60 金币（具体 ID/等级/浮动结算时随机）<br>40% •结实耐用：获得随机普通装备 ×1，支付 60 金币（具体 ID/等级/浮动结算时随机）<br>15% ✗卷款而逃：失去 60 金币 |
| 学习锻甲（60 金币） | 支付60 金币 | 40% ✦融会贯通：支付 60 金币，获得 金卡 gold_merge_armor ×1，另获 5~10 金币<br>45% •习得要领：支付 60 金币，获得 金卡 gold_merge_armor ×1<br>15% ✗看走了眼：失去 60 金币 |
| 修补护具（25 金币） | 支付25 金币 | 45% ✦焕然一新：支付 25 金币，获得 白卡 def_up_1 ×1 + 白卡 vigor_1 ×1，另获 3~6 金币<br>40% •修修补补：支付 25 金币，获得 白卡 def_up_1 ×1 + 白卡 vigor_1 ×1<br>15% ✗越修越坏：失去 25 金币 |
| 帮忙拉风箱 | 无 | 45% ✦工钱丰厚：获得 10~16 金币<br>40% •几枚铜板：获得 5~8 金币<br>15% ✗白干活：无事发生 |
| 烘干炉火 | 无 | 45% ✦暖人心脾：回复生命上限的 8%<br>40% •驱散寒气：回复生命上限的 5%<br>15% ✗火星四溅：失去 4 点生命（留 1） |

### 22 断咒祭坛 · `cleansing_altar`

`stageMin: 2`（S2+）；5 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 血祭断咒（支付 15 点生命） | 支付最多 15 点生命 | 45% ✦咒文崩碎：支付 15 点生命，净化紫卡 1 层，另获 4~8 金币<br>40% •诅咒松动：支付 15 点生命，净化紫卡 1 层<br>15% ✗血祭失败：失去 15 点生命（留 1） |
| 金币断咒（35 金币） | 支付35 金币 | 45% ✦咒愿消散：支付 35 金币，净化紫卡 1 层，另获 4~8 金币<br>40% •顺利净化：支付 35 金币，净化紫卡 1 层<br>15% ✗金币被吞噬：失去 35 金币 |
| 购买净化药剂，留待之后（45 金币） | 支付45 金币 | 45% ✦灵药一瓶：支付 45 金币，获得 道具 cleanse_potion ×1，另获 4~8 金币<br>40% •正常购买：支付 45 金币，获得 道具 cleanse_potion ×1<br>15% ✗药剂失效：失去 45 金币 |
| 双重断咒（65 金币） | 支付65 金币 | 45% ✦双咒俱碎：支付 65 金币，净化紫卡 2 层，另获 5~10 金币<br>40% •双重净化：支付 65 金币，净化紫卡 2 层<br>15% ✗只碎一层：支付 65 金币，净化紫卡 1 层 |
| 献上一段祷词 | 无 | 50% ✦祭坛低语：回复生命上限的 10%<br>35% •心神安定：回复生命上限的 6%<br>15% ✗无事发生：无事发生 |

### 23 崩塌的神龛 · `collapsing_shrine`

`stageMin: 2`（S2+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 抢出供品 | 无 | 40% ✦满捧供品：获得 24~40 金币<br>45% •几件供品：获得 12~20 金币<br>15% ✗供品散落：获得 4~8 金币 |
| 扛走石像碎片 | 无 | 40% ✦石心宝物：获得随机稀有装备 ×1（具体 ID/等级/浮动结算时随机）<br>40% •沉碎石像：获得随机普通装备 ×1（具体 ID/等级/浮动结算时随机）<br>20% ✗被埋住脚：失去 10 点生命（留 1） |
| 用身体撑住横梁 | 无 | 45% ✦神明看在眼里：当前生命 −15%（留 1），防御倍率 +8 个百分点<br>40% •勉强撑住：当前生命 −15%（留 1），防御倍率 +6 个百分点<br>15% ✗筋疲力尽：当前生命 −15%（留 1），防御倍率 +2 个百分点 |

### 24 低语的契约 · `cursed_bargain`

`stageMin: 2`（S2+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 签名换取力量 | 无 | 40% ✦契约兑现：获得 金卡 gold_combo ×1 + 紫卡 curse_burn ×1，另获 8~14 金币<br>45% •白纸黑字：获得 金卡 gold_combo ×1 + 紫卡 curse_burn ×1<br>15% ✗只余诅咒：获得 紫卡 curse_burn ×1 |
| 撕毁契约 | 无 | 45% ✦契约畏缩：当前生命 −12%（留 1），攻击倍率 +6 个百分点<br>40% •纸片割手：当前生命 −12%（留 1），攻击倍率 +4 个百分点<br>15% ✗低语缠绕：当前生命 −12%（留 1） |
| 把它烧掉 | 支付12~25 金币 | 45% ✦一把烧净：失去 12 金币<br>40% •火势失控：失去 18 金币<br>15% ✗契约不灭：失去 25 金币 |

### 25 午夜拍卖会 · `midnight_auction`

`stageMin: 2`（S2+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 花 40 金币买回自己的东西 | 支付40 金币 | 45% ✦物归原主：获得随机稀有装备 ×1，支付 40 金币（具体 ID/等级/浮动结算时随机）<br>40% •略有瑕疵：获得随机普通装备 ×1，支付 40 金币（具体 ID/等级/浮动结算时随机）<br>15% ✗竞价失败：失去 40 金币 |
| 买下一瓶狂战药剂（35 金币） | 支付35 金币 | 45% ✦真品佳酿：支付 35 金币，获得 道具 berserk_potion ×1，另获 3~6 金币<br>40% •正常购买：支付 35 金币，获得 道具 berserk_potion ×1<br>15% ✗赝品：失去 35 金币 |
| 把拍品让给旁人 | 无 | 40% ✦分到让利：获得 14~22 金币<br>45% •少量补偿：获得 8~12 金币<br>15% ✗一无所获：无事发生 |

### 26 贪欲之试 · `greed_trial`

`stageMin: 2`（S2+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 奉上 35 金币换锋芒 | 支付35 金币 | 45% ✦锋芒毕露：支付 35 金币，获得 金卡 gold_crit ×1，另获 4~8 金币<br>40% •一刀一诺：支付 35 金币，获得 金卡 gold_crit ×1<br>15% ✗石门吞金：失去 35 金币 |
| 用血证明 | 支付最多 20 点生命 | 45% ✦血契响应：支付 20 点生命，获得 金卡 gold_execute ×1，另获 4~8 金币<br>40% •印记浮现：支付 20 点生命，获得 金卡 gold_execute ×1<br>15% ✗血白流了：失去 20 点生命（留 1） |
| 转身离开石门 | 无 | 45% ✦石门放行：失去 6 点生命（留 1）<br>40% •石屑擦伤：失去 10 点生命（留 1）<br>15% ✗门缝夹击：失去 16 点生命（留 1） |

### 27 神秘黑匣 · `mysterious_box`

`stageMin: 3`（S3+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 打破封印 | 无 | 45% ✦匣藏珍品：获得随机稀有装备 ×1（具体 ID/等级/浮动结算时随机）<br>40% •寻常器物：获得随机普通装备 ×1（具体 ID/等级/浮动结算时随机）<br>15% ✗空盒：无事发生 |
| 搜寻夹层 | 无 | 40% ✦隐藏金币：获得 24~40 金币<br>45% •少量金币：获得 12~20 金币<br>15% ✗夹层是空的：无事发生 |
| 只拾取地面金币 | 无 | 40% ✦散落的赏金：获得 8~12 金币<br>45% •几枚硬币：获得 4~7 金币<br>15% ✗只有尘土：获得 1~2 金币 |

### 28 垂死商人 · `dying_merchant`

`stageMin: 3`（S3+）；2 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 协助包扎并分享药剂 | 无 | 40% ✦丰厚酬谢：回复 12% 并获得 8~15 金币<br>45% •衷心感谢：回复 10% 并获得 4~8 金币<br>15% ✗商人昏迷：无事发生 |
| 拿走行囊与手记 | 无 | 40% ✦满载而归：获得 35~55 金币和 18~28 经验<br>45% •有点收获：获得 20~32 金币和 10~16 经验<br>15% ✗只有杂物：获得 5~10 金币和 2~5 经验 |

### 29 远古锻造台 · `ancient_anvil`

`stageMin: 3`（S3+）；4 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 淬火（消耗 25 金币） | 支付25 金币 | 45% ✦神兵出世：获得随机史诗装备 ×1，支付 25 金币（具体 ID/等级/浮动结算时随机）<br>40% •合格作品：获得随机稀有装备 ×1，支付 25 金币（具体 ID/等级/浮动结算时随机）<br>15% ✗淬火失败：获得随机普通装备 ×1，支付 25 金币（具体 ID/等级/浮动结算时随机） |
| 拆装置换（消耗 1 件普通装备） | 需 1 件未装备普通装备 | 40% ✦精工重铸：消耗背包首件未装备普通装备，换随机稀有装备 ×1 + 20~25 金币<br>45% •普通重铸：消耗背包首件未装备普通装备，换随机稀有装备 ×1 + 12~18 金币<br>15% ✗失手损毁：消耗背包首件未装备普通装备，换随机普通装备 ×1 + 4~8 金币 |
| 拾取供台金币 | 无 | 40% ✦厚重的赏钱：获得 10~18 金币<br>45% •零散金币：获得 5~9 金币<br>15% ✗只剩碎屑：获得 1~3 金币 |
| 感受炉温恢复 | 无 | 45% ✦暖意融融：回复生命上限的 8%<br>40% •稍作休整：回复生命上限的 5%<br>15% ✗烟气呛人：无事发生 |

### 30 深渊契约 · `abyss_contract`

`stageMin: 3`（S3+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 接受锻甲合流与噬魂宿命 | 无 | 40% ✦深渊回赠：获得 金卡 gold_merge_armor ×1 + 黑卡 doom_soul ×1，另获 10~18 金币<br>45% •契约生效：获得 金卡 gold_merge_armor ×1 + 黑卡 doom_soul ×1<br>15% ✗只换来黑影：获得 黑卡 doom_soul ×1 |
| 接受生命汲取与轮回宿命 | 无 | 40% ✦深渊回赠：获得 金卡 gold_lifesteal ×1 + 黑卡 doom_rebirth ×1，另获 10~18 金币<br>45% •契约生效：获得 金卡 gold_lifesteal ×1 + 黑卡 doom_rebirth ×1<br>15% ✗只换来黑影：获得 黑卡 doom_rebirth ×1 |
| 接受连锁回响与阴影低语 | 无 | 40% ✦深渊回赠：获得 金卡 gold_combo_grace ×1 + 黑卡 doom_rage ×1，另获 10~18 金币<br>45% •契约生效：获得 金卡 gold_combo_grace ×1 + 黑卡 doom_rage ×1<br>15% ✗只换来黑影：获得 黑卡 doom_rage ×1 |

### 31 星界棋局 · `astral_chess`

`stageMin: 3`（S3+）；4 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 金币下注（85 金币） | 支付85 金币 | 40% ✦完胜：支付 85 金币，获得 金卡 gold_execute ×1 + 金卡 gold_crit ×1，另获 10~20 金币<br>45% •胜局：支付 85 金币，获得 金卡 gold_execute ×1 + 金卡 gold_crit ×1<br>15% ✗败北：失去 85 金币 |
| 命运下注 | 无 | 40% ✦命运眷顾：获得 金卡 gold_execute ×1 + 金卡 gold_crit ×1 + 黑卡 doom_rage ×1，另获 8~16 金币<br>45% •缔结命运：获得 金卡 gold_execute ×1 + 金卡 gold_crit ×1 + 黑卡 doom_rage ×1<br>15% ✗命运嘲弄：获得 黑卡 doom_rage ×1 |
| 防守布局（65 金币） | 支付65 金币 | 40% ✦铜墙铁壁：支付 65 金币，获得 金卡 gold_merge_armor ×1 + 金卡 gold_carry ×1，另获 8~14 金币<br>45% •稳固防线：支付 65 金币，获得 金卡 gold_merge_armor ×1 + 金卡 gold_carry ×1<br>15% ✗布局落空：失去 65 金币 |
| 接受猎魔契约 | 无 | 40% ✦猎魔之力：获得 红卡 red_hunt ×1，另获 6~12 金币<br>45% •契约缔结：获得 红卡 red_hunt ×1<br>15% ✗契约无回应：无事发生 |

### 32 猩红药圃 · `crimson_garden`

`stageMin: 3`（S3+）；4 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 采集危险药材 | 支付最多 18 点生命 | 45% ✦药材饱满：支付 18 点生命，获得 道具 berserk_potion ×2<br>40% •一株药材：支付 18 点生命，获得 道具 berserk_potion ×1<br>15% ✗荆棘割伤：失去 18 点生命（留 1） |
| 购买稳妥补给（60 金币） | 支付60 金币 | 45% ✦双份补给：支付 60 金币，获得 道具 tactical_potion ×1 + 道具 charge_potion ×1，另获 4~8 金币<br>40% •正常购买：支付 60 金币，获得 道具 tactical_potion ×1 + 道具 charge_potion ×1<br>15% ✗钱货两空：失去 60 金币 |
| 搜集连锁秘卷（45 金币） | 支付45 金币 | 45% ✦完好秘卷：支付 45 金币，获得 道具 combo_scroll ×1，另获 3~8 金币<br>40% •正常购买：支付 45 金币，获得 道具 combo_scroll ×1<br>15% ✗秘卷损毁：失去 45 金币 |
| 服用鲜红药汁 | 无 | 45% ✦药力澎湃：回复 45% 后基础生命上限 −8%（最低 10）<br>40% •代价浮现：回复 35% 后基础生命上限 −12%（最低 10）<br>15% ✗药性相冲：失去 15 点生命（留 1） |

### 33 游魂的交易 · `spirit_bargain`

`stageMin: 3`（S3+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 收下它的执念 | 无 | 40% ✦执念化力：获得 金卡 gold_crit ×1 + 黑卡 doom_soul ×1，另获 8~14 金币<br>45% •心愿相抵：获得 金卡 gold_crit ×1 + 黑卡 doom_soul ×1<br>15% ✗只有黑影：获得 黑卡 doom_soul ×1 |
| 替它了却心愿 | 无 | 40% ✦圆满了却：当前生命 −12%（留 1）<br>40% •费尽心力：当前生命 −15%（留 1）<br>20% ✗心愿难了：当前生命 −20%（留 1） |
| 洒下金币请它离开 | 支付22~40 金币 | 40% ✦洒币安魂：失去 22 金币<br>40% •游魂贪婪：失去 30 金币<br>20% ✗索求无度：失去 40 金币 |

### 34 宿命之门 · `doom_gate`

`stageMin: 3`（S3+）；3 个选项；每个选项 3 种随机结果，权重之和为 100，点选即结算。

| 选项 | 代价 | 三档随机结果（抽取时不可行档自动剔除，剩余档归一化） |
|---|---|---|
| 接受宿命换取力量 | 无 | 40% ✦宿命馈赠：获得 金卡 gold_crit ×1 + 金卡 gold_saved_steps ×1 + 黑卡 doom_rage ×1，另获 6~12 金币<br>45% •命运加身：获得 金卡 gold_crit ×1 + 金卡 gold_saved_steps ×1 + 黑卡 doom_rage ×1<br>15% ✗只有低语：获得 黑卡 doom_rage ×1 |
| 用生命封住门 | 无 | 45% ✦以血封印：回复 22% 后基础生命上限 −4%（最低 10）<br>40% •门后回响：回复 20% 后基础生命上限 −5%（最低 10）<br>15% ✗门扉反噬：回复 18% 后基础生命上限 −8%（最低 10） |
| 把门推开一条缝 | 无 | 40% ✦门后宝物：获得 28~42 金币<br>45% •几件遗物：获得 14~22 金币<br>15% ✗门后空空：获得 3~6 金币 |

---

<a id="part-6"></a>

# 第6部分 · 历史改进总记录（原 IMPROVEMENTS.md）

> **历史记录**：本部分描述当轮改进时的设计与验证快照，条目以当时口径记录，不代表当前规则；现行规范以第一至五部分为准，冲突时以源码为准。


日期：2026-11-06。基于 GitHub 源码快照 `7886cb9`，所有改动保留在本地，未提交或推送。

## 1. 机制与流程

### 装备 / 套装
- 20 套套装的 2/3/5 件阈值、基础属性和特殊效果全部实现并与描述对齐。
- 财宝五件提升装备掉落品质，王者五件实际掉落两件装备；金币/经验词条进入奖励计算。
- 噬血按实际造成的生命损失回复，不用溢出伤害刷血；磐石首次有效受击减半并反弹；暗影攻击翻倍伴随防御减半。
- 虚空效果按回合用种子抽签，预览不重新抽取随机数。
- 基础属性与有效属性分离，穿脱不累加、不回满血；战斗与待确认事件中锁定换装。
- 非套装原先剔除中文造成的 ID 冲突已修复；重复掉落保留独立实例，同属性副本不会吞掉或白扣钱。
- 非套装词条用确定性随机无放回抽取，数量符合品质，浮动限制为 70%～130%。

### 战斗 / 奖励
- 真正按先后手结算，先被击败的一方不能反击或治疗；同时死亡按失败处理。
- 预览与实际计算共用函数；日志区分防御抵消、闪避、停止反击、先手击杀、吸血、恢复与反弹。
- 提前结束累计的步数在任意方式获胜时都结算金币，失败不发。
- 强化改为奖励队列，精英/首领奖励与连续升级、溢出经验不互相覆盖；跳过只消耗当前一份奖励。
- 满血不出售无效治疗，治疗为即时消耗，不进永久强化列表。
- 商店移除明确为一层、每店一次；刷新不会重置已用移除机会，刷新商品与价格分别计数。
- 死亡/主动结算只发一次灵魂碎片；结束界面可正常进入永久升级。

### 事件 / 随机 / 无尽
- 事件结果先抽取一次并缓存，确认不重抽、重复调用不重复发奖或扣费。
- 修复赌徒 50%/70% 胜率、单次赌注扣费、金币门槛；治疗泉先回血再判诅咒。
- 淬火实际扣 25 金币；重铸实际消耗指定未装备普通物品并发放稀有装备和金币，确认时校验原物品仍有效。
- 移除不存在的地图步数成本、半价装备承诺等误导文本；“永久”局内效果改为“本局”。
- 正常玩法不调用 `Math.random`；`Date.now` 只用于未指定种子的新开局。节点、回合、刷新次数作为独立随机作用域。
- 无尽怪物采用稳定物种 ID，能累计图鉴击杀；旧可识别首领 ID 安全迁移，无法识别的记录保留。
- 深层怪物权重改为偏向后解锁敌人，无尽基础速度超过 24 后软增长；未随意调整基础攻击、防御、生命、价格或经验曲线。
- 事件节点不再生成无用敌人。

## 2. 文案、美术与交互

- 石青/古金地牢、深紫回廊、余烬终焉三阶段配色，以及可用的浅色主题。
- 首页符文门视觉、怪物图标、统一按钮/面板/属性色；资源由代码和本地资源组成，无外链图片。
- 方块身份在移动与减半时保留，支持真实位移、合并来源动画和新块反馈。
- 4096+ 兜底色与按位数字号，减少持续光晕和彩虹干扰；支持系统减少动态效果。
- 手机滑动、H5 鼠标左键拖动与方向键；鼠标采用指针捕获，移出棋盘后松开也能正确结束手势，触摸/指针不会重复触发。模态面板/非操作阶段阻止棋盘输入。
- 路线使用原生滚动，锁定卡片不再被默认白底覆盖；显示当前可进入层。
- 详细数值采用统一格式：套装攻击/防御为固定值，非套装为百分比，生命为固定值，金币/经验为百分比。
- 敌人强化使用敌人专属解释，不把敌人的百分比生命增加误写成玩家固定治疗。
- 规则说明纠正合并不减少盘面总和、无虚构 70% 减伤上限、开局奖励须局外解锁等。
- 发布版隐藏并禁用调试操作。调试击杀复用正式奖励逻辑，不再复制一份实现。

## 3. 工程与验证

- 增加锁定版本的官方 uni-app CLI 构建，保留原 HBuilderX 目录布局。
- H5 与微信小程序构建通过；小程序组件显式 `apply-shared` 使用统一主题。
- `touristappid` 保持占位符，关闭默认 uni 统计，开发与预览服务仅绑定本机。
- 原始 5 组测试扩展为 11 组，覆盖鼠标/触摸输入、套装全部阈值、词条抽取、战斗时序、回合效果、事件事务、奖励队列、同种子复现、棋盘身份、存档校验等。
- 类型检查由原来的 2 处错误修至 0 处。
- `simulate` / `parity` 默认只读验证，失败返回非零；不再自动覆写基线。

### 200 种子比较

策略固定为“首个可进入节点 + 固定方向循环”，不购买装备。每个种子复跑，检查完全相同结果、最终退出状态，无卡死。

| 可比指标 | 原版均值 | 改进版均值 | 变化 |
|---|---:|---:|---:|
| 金币 | 44.265 | 48.350 | +9.23% |
| 剩余经验 | 15.950 | 14.965 | -6.18% |
| 等级 | 1.620 | 1.705 | +5.25% |
| 获胜战斗回合数 | 6.925 | 7.330 | +5.85% |
| 击杀数 | 2.635 | 2.695 | +2.28% |
| 已通关阶段 | 0 | 0 | 样本无通关，不能据此推断平衡 |

可比指标在原定 15% 范围内。**不等于所有玩法/流派数值不变。**修复以前无效的装备必然影响装备流派，需要后续真人试玩调优。

旧模拟在死亡时直接跳过结算，漏计整场死亡战斗；新脚本把获胜/失败回合分别记录。新增全部战斗回合均值为 9.980，其中死亡战斗 2.650。不能把旧 6.925 与新 9.980 直接比较得出“难度提高 44%”。有效步数现在累计所有回合，不只累计最后一回合。

### 固定种子基线变化

- 原版种子 12345：`d55d7ed1138c1be0b26f25243dd284f936e2859131e924186e86e3b53283f2e9`
- 新版种子 12345：`177f8bf8d7897f519337c227e535889d03df92339c1d460e0679494dc9b50efb`

改变原因：显式授权的随机作用域修复、怪物权重与事件随机消耗、奖励/死亡时序改进、治疗卡不存为永久强化，以及统计新增获胜/失败回合与完整有效步数。旧比较保留在 `tools/parity-before.json`，新版记录在 `tools/parity-after.json`。

## 4. 边界与后续

- 本轮做了真实 H5 浏览器界面检查；**微信开发者工具 GUI 与微信真机未实测**，编译成功不等于真机性能验证。
- 图标采用统一界面与语义图形，不是逐只怪物的手绘精灵图；音乐/音效未新增。
- 没有部署公开网站，也没有使用真实小程序凭据；所有预览都是本机链接。
- 不提供整局自动存档，仍只持久化局外成长。
- 诅咒按选择时的基础生命上限扣一次固定值，之后移除生命强化不会返还已支付的诅咒代价。
- 更高级的敌人行为、武器技能、路线分支策略和长期真人平衡属于下一轮玩法设计，而非本次修复中擅自增加的内容。

---

<a id="part-7"></a>

# 第7部分 · 界面减负与合并动效（原 UI_MOTION_IMPROVEMENTS.md）

> **历史记录**：本部分描述当轮改进时的设计与验证快照，条目以当时口径记录，不代表当前规则；现行规范以第一至五部分为准，冲突时以源码为准。


本轮仅修改 `E:\Zcode project\z80z-2048` 的展示层，沿用六色玩法；不提交／推送、不上传微信。

## 操作和说明

- 战斗道具放在棋盘之后、结束按钮之前，按库存显示，直接使用一件。
- 无道具时只显示一行空状态；净化药剂仍只能战斗外使用。
- 点击生命、攻击、防御、速度、步数、金币或经验，可以查看用途和当前数值；详细计算放在“怎么算”里。
- 总防御显示包含装备固定防御；真实公式常数15，不再显示旧的30。
- 属性弹窗关闭时保留遮罩和输入阻断到实际移除，避免关闭动画期间误触。

## 文本减负

- 奖励、商店、道具的效果只显示一次，不再重复分类教学和“正面收益”。
- 0层不显示，普通卡以一句效果为主；红卡保留收益和代价，紫／黑保留解除限制。
- 回复生命预估使用真实减少治疗与上限顺序；营地显示实际可回复量。
- 事件正确读取 `{id,count}` 卡片奖励，保留数量、费用和黑卡确认，不让完整结果描述与卡片详情重复。
- 复杂评级与系数不放在主要选择卡面；完整机制仍可在详细说明查阅。
- 商店货架网格所有行等高，已售出占位与在售商品同尺寸；道具／药水售出占位统一为“— 已售出”。
- 商店卡面只显示图标、名字与价格；点击商品在弹窗查看完整效果，购买也在弹窗内完成，四个商品区统一。
- 详情弹窗不再重复卡片品质与叠加说明（六色说明保留在规则页），商店与地图强化详情一致。
- 战斗工具栏新增“强化 N”按钮，打开只读列表查看已获得的强化卡与当前层数效果；打开期间棋盘输入阻断。
- 商店与营地在选定下一层前可离开再进；重进商店不重置货架与刷新次数，重进营地不重置休整次数。
- 系统减少动态效果时，合并攻击浮字改为静态文字短暂显示（原为整段隐藏），数值反馈不再丢失。

## 面板和反馈

- 属性、敌人能力、战斗说明、地图属性、强化和规则分节使用可复用的测量高度过渡。
- 面板内容在收起过渡中仍挂载，结束后才卸载；计时器与异步测量带版本号，快速开关不受旧回调影响。
- 生命／金币／等级变化、使用道具、购买、换装和奖励入场采用短暂反馈，只有真实成功才提示。
- 游戏动作立即执行，不等待动画、不从动画回调再次执行。

## 合并与拖尾

- 保持原150ms移动输入节奏，稳定Cell ID不变。
- 移动棋子带低透明度、不含数字的残影；静止或新生成棋子不产生拖尾。
- 合并来源靠拢，在移动末尾缩小；新棋子挤压后弹起，约280ms回弹收尾。
- 局部中心亮光、冲击圈、四向短光线与少量石屑分层出现；大合并强化但强度封顶。
- 实际合并新增攻击只显示一条汇总浮字，不把棋子数值当成伤害。
- 同时合并最多64个装饰节点，下一次有效操作会清理旧特效，不延长输入锁。
- 系统减少动态模式关闭位移、拖尾、火花、震动与开合过渡，仍保留必要文字反馈。

## 验证

- 新增面板状态／异步测量、拖尾几何与预算、纯文案和回复预估、反馈计时器与实际Vue组件渲染测试。
- 固定种子和200种子数值基线应保持原样，不修改核心／store和卡片参数。
- H5与微信构建检查，微信包体低于2MB。
- H5检查奖励一屏阅读、道具栏、属性点击、快速开关、合并数字清晰与减少动态模式；微信真机仍需进一步验证。

---

<a id="part-8"></a>

# 第8部分 · 纸质分叉地图（原 MAP_IMPROVEMENTS.md）

> **历史记录**：本部分描述当轮改进时的设计与验证快照，条目以当时口径记录，不代表当前规则；现行规范以第一至五部分为准，冲突时以源码为准。


受 Roguelike 卡牌游戏路线图的视觉语言启发，采用原创界面与图标，不复制《杀戮尖塔》的图像、字体或资源。

## 路线规则

- 每阶段仍为 10 层探索加 1 层首领，节点与敌人分布不改。
- 原来的“下一层全部可选”改为实际稀疏连线：每节点连接下一层 1～2 个节点。
- 最近邻基础连接确保所有节点可从入口到达，每条路线都能继续到首领；额外分叉不制造交叉连线。
- `nextIds` 为通行依据，地图显示和 store 校验使用同一份连接关系。
- 连接随机使用独立作用域，不消耗节点/敌人生成的随机序列；同一种子结果稳定。

## 视觉与操作

- 纸面与墨线替代矩形节点卡片，虚线体现真实的分叉与汇合。
- 已走路径、当前可选节点、未来路线与已错过支路分别呈现状态。
- 节点详情显示遭遇和路线信息；只有当前相连节点允许进入。
- 支持原生地图滚动与“定位进度”按钮；点按后回到“刚完成的一层”与“下一层可选路标”之间，属性区不抢占地图主要空间。
- 使用本地透明 PNG 图标与 CSS 实现，H5 与微信小程序共用布局。图标为原创墨线图形，提供深墨与古金两种版本，地图、详情、图例复用同一套资源。
- 战斗为交叉双剑，精英为角骷髅，事件为神秘卷轴，休息为营火，商店为钱袋，首领为加冕徽记；替代原来的矩形边框拼接图标。

## 进度标注

走完一个路标后，`currentNodeId` 会停留在刚完成的节点，通往下一层的节点同时变为可前往。早期版本把这两处都当作“当前位置”，底部又按下一层报楼层，于是第 3 层完成时会同时出现“第 3 层可前往”和“第 2 层当前位置”的观感错位。

- 刚完成的节点改为墨色双圈“刚完成”，只有可前往的节点保留金色“可前往”，全图只有一个金色焦点。
- 底部进度改为“第 N 层已完成 · 第 N+1 层有 X 条路可选”，层号标记同步区分深墨（已完成）与描金（下一层）。
- 层距由 156rpx 调至 176rpx，随机纵向抖动由 ±13rpx 收到 ±7rpx，状态文字不会再压到上一层的图标；`route-layout` 测试新增相邻层间距断言。
- 这次只改展示文案与坐标，不改变路线生成、可达性判定或任何玩法随机数。

## 验证范围

新增路线测试覆盖 500 张不同种子/阶段地图的可达性、无死路、无交叉、节点度数、确定性与越界选择拦截。

固定首节点自动策略的 200 个种子统计和快照保持不变。这只证明该固定策略的回归结果不变，**不代表其他分叉选择的难度完全相同**：真实连线会改变不同支路可获得的补给与风险，需要试玩评估。

微信小程序以编译验证为主，微信真机表现仍待实测。所有改动保留本地，不自动提交或推送。

---

<a id="part-9"></a>

# 第9部分 · 怪物、物品与场景美术（原 ART_IMPROVEMENTS.md）

> **历史记录**：本部分描述当轮改进时的设计与验证快照，条目以当时口径记录，不代表当前规则；现行规范以第一至五部分为准，冲突时以源码为准。


本轮开发目录：`E:\Zcode project\z80z-2048`。仅更新静态展示美术，不改变玩法数值、路线或随机流程。

## 范围

1. **首批怪物头像**：第一阶段 15 种敌人及三个阶段首领，共 18 张原创头像。战斗和图鉴复用；尚未绘制的敌人保留原图形回退，图片加载失败也不留空。
2. **物品辨识度**：五部位装备、九类强化图形，以及二十套套装徽记。等级与品质继续使用数据与框线叠加，不为每个组合重复画图。
3. **统一材质**：暗墨、古金、纸签与刻线卡框，沿用已有深浅主题及属性色，保持名字、价格和数值可读。
4. **场景**：地牢石拱、深渊回廊、终焉祭坛作为战斗背景装饰；商店和营地有限高度小景，不占用棋盘或遮挡操作。

## 明确不做

- 不制作新首页 Logo。
- 不新增胜败结算插画。
- 不附带此前未批准的动效方案。
- 不部署、不推送，不修改 C 盘备份。

## 资源结构

- `static/enemies/`：原创新怪物头像 PNG 与 SVG 源稿。
- `static/items/`：装备部位与强化类别图标。
- `static/set-emblems/`：套装徽记。
- `static/scenes/`：阶段与补给场景。
- `tools/art/`：可复现的本地绘制脚本，独立于输出资源目录。
- `utils/artwork.ts`：纯展示资源查找，包含安全回退。
- `components/ItemIcon.vue`：品质框、物品图与套装徽记的复用组件。

所有 PNG 本地打包，素材原创，不请求第三方图片服务，不复制其他游戏资源。SVG 保留为编辑源稿，运行时使用 PNG 兼容微信小程序。

## 验证

资源测试检查尺寸、透明通道、SVG 源稿、所有装备／强化类别覆盖及缺失回退；既有单测、类型检查、固定种子模拟和统计应保持通过，基线不更新。

H5 实际界面检查覆盖头像、背包、奖励、商店、营地和深浅色／短屏布局。微信小程序做编译验证，真机观感与性能仍需后续实测。

---

<a id="part-10"></a>

# 第10部分 · 地图图标（原 MAP_ICON_IMPROVEMENTS.md）

> **历史记录**：本部分描述当轮改进时的设计与验证快照，条目以当时口径记录，不代表当前规则；现行规范以第一至五部分为准，冲突时以源码为准。


地图原先的图标通过细线矩形边框拼接，缩小后缺少清晰轮廓。本轮只改视觉资源，不改路线、节点通行、战斗或数值。

- 重画战斗双剑、精英角骷髅、事件卷轴、营火、金币袋、首领徽记与入口罗盘。
- 使用统一的墨色轮廓、负空间高光和少量刻线细节，避免小尺寸图标变成杂乱线条。
- 深墨／古金两个版本对应普通与当前可选路标，不依赖运行时滤镜。
- 透明本地 PNG 用于跨平台展示，原始 SVG 作为可编辑素材保留。
- `MapIcon.vue` 统一图标来源；地图、节点详情和图例复用同一套图形。
- 图标不接收指针事件，节点按钮仍负责交互，避免图片抢占点击。
- 不使用《杀戮尖塔》或其他游戏的原始素材，没有新增外链请求。

验证包括 PNG 格式、尺寸、透明通道、资源引用、既有回归、双端编译，以及 H5 手机尺寸视觉检查。微信真机仍待验证。
