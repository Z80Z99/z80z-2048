# PROJECT_ANALYSIS.md — Z80Z 全项目解析（Agent 知识库）

> **本文件的用途**：供所有 AI 代理在执行任何任务前读取，建立对游戏规则、机制、代码结构与开发约定的完整认知。读完本文应能回答"游戏怎么玩、每个系统怎么运作、改某处要动哪些文件"。
>
> **效力与时效**：主体保留 2026-11-07 的系统解析；2026-11-08 按当前源码静态核对 25 事件扩充、卡池数量与规则版本（本次仅文档，不跑测试／构建）。行号引用格式 `文件:行号`，代码继续演进后行号可能漂移——**若文档与代码冲突，一律以代码为准**，并用搜索定位新位置。卡牌数值详单见 [SIXCOLOR_RULES.md](./SIXCOLOR_RULES.md)，全部事件选项、成本、精确奖励和限制见 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md)。

---

## 目录

1. [项目速览](#1-项目速览)
2. [目录模块地图](#2-目录模块地图)
3. [核心循环与状态机](#3-核心循环与状态机)
4. [棋盘机制](#4-棋盘机制)
5. [战斗公式全集](#5-战斗公式全集)
6. [六色强化卡体系（37 张）](#6-六色强化卡体系)
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
| `npm test` | `node tools/run-tests.mjs` | 27 组测试，必须全绿 |
| `npm run typecheck` | `tsc -p tools/tsconfig.check.json` | 类型检查（0 错误） |
| `npm run simulate` | `node tools/simulate.mjs` | 固定种子整局模拟 + SHA-256 基线 |
| `npm run parity` | `node tools/parity.mjs` | 200 种子统计平价 |
| `npm run upload:mp-weixin` | `node tools/upload-mp.mjs` | 微信开发版上传（需 `--appid`） |

**规则与文档索引**：协作约定见 [AGENTS.md](./AGENTS.md)；卡牌数值详单见 [SIXCOLOR_RULES.md](./SIXCOLOR_RULES.md)；全部事件选项与引擎复用职责见 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md)；项目入口见 [README.md](./README.md)；历史改进记录见 IMPROVEMENTS / UI_MOTION_IMPROVEMENTS / MAP_IMPROVEMENTS / ART_IMPROVEMENTS。**本文是汇总入口**。

---

## 2. 目录模块地图

| 文件/目录 | 职责 | 改什么需求找它 |
|---|---|---|
| `core/board.ts` | 4×4 棋盘纯逻辑：滑动、合并（mergedFrom）、生成（spawnTile）、回合减半（halveGridTiles）、起始点放置 | 棋盘行为、生成概率 |
| `core/battle.ts` | 战斗纯函数：processTurn（滑动回合）、getBattlePreview（伤害预估）、resolveRound（结算）、startNewRound、getCombinedCardModifiers | 战斗公式、新机制消费点 |
| `core/cardEffects.ts` | 卡牌效果系统：EFFECT_RULES 校验表、validateCard（六色约束）、collectCardModifiers（聚合）、deriveCardPlayer（白卡→属性） | 新增效果键、卡牌校验规则 |
| `core/upgrade.ts` | UPGRADE_POOL（37 张卡定义）、pickUpgrades（加权抽卡）、upgradeCost、cardClassText/Description | 加卡、改卡价、抽卡权重 |
| `core/equipment.ts` | 345 件装备生成、套装效果（EquipSetEffects）、computeEquipBonuses、getEffectivePlayer | 装备/套装/掉落品质 |
| `core/enemy.ts` | 76 条图鉴敌人、分层出现、词缀系统（13 条）、无尽生成、每回合成长常量 | 敌人、词缀、难度曲线 |
| `core/events.ts` | 25 个事件（94 选）、19 种既有效果类型校验与缓存结算、getEventChoiceDisabledReason、描述生成 | 事件数据、阶段池、效果类型；详见 EVENTS_GUIDE |
| `core/consumables.ts` | 5 种消耗品定义与使用场景校验 | 消耗品 |
| `core/route.ts` | 路线生成（10+1 层、分支连线 makeEnemy 接敌人系统） | 路线结构、敌人分布 |
| `core/routeLayout.ts` | 地图纯展示坐标（状态着色、层距、抖动） | 地图视觉 |
| `core/progress.ts` | 升级循环 gainXp | 经验曲线 |
| `core/random.ts` | Mulberry32 与作用域随机 createScopedRng | 随机/可复现性 |
| `store/gameStore.ts` | Pinia 主状态机（screen、player、upgrades、battle、route、shop、event、meta 全部动作） | 几乎一切玩法流程 |
| `store/helpers.ts` | buildShop、rollRewardChoices、applyMetaUpgrades、xpToNext | 商店构造、奖励抽取 |
| `store/initialState.ts` | 初始状态（玩家属性、runState 字段） | 新增全局状态字段 |
| `store/debugActions.ts` | 开发调试动作（__DEV__ 才生效） | 调试功能 |
| `components/screens/*.vue` | 10 个屏幕：Title/Route/Battle/Reward/Shop/Rest/Meta/GameOver/BossChoice + EventPanel | 屏幕级 UI |
| `components/*.vue` | Board/Tile（棋盘渲染与动效）、CardIcon/CardDetails/ItemIcon/MapIcon、CardDetails（效果文案渲染）、ExpandPanel、StatusBar、EnemyDisplay、BattleItems（战斗道具栏）、ConsumablesPanel、UpgradesPanel、EquipmentPanel、GameRulesPanel、AttributeHelp、ResultModal、DebugPanel、BestiaryPanel | 面板与展示组件 |
| `composables/` | useSwipe（触摸+指针+键盘）、usePanelMotion（弹层开合状态机）、useFeedback（提示）、useMotionPreference（减少动态）、useBoardEffects? — 见 utils | 交互模式 |
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
| event | SELECT_NODE(event) | 无中途退出——必须选一个选项；每个交易事件含 type:'none' 安全出口 |
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

- `slideGrid(grid, direction)`：整行/列推移，相邻等值合并一次；合并格 `value×2`、`mergedFrom=[idA,idB]`、`mergedSum += 合并后数值`（`core/board.ts` mergeLine）。
- 一次滑动最多合并一次（新生成的格子不再参与）。
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
enemyDamage = max(0, floor(totalAttack × attackMultiplier − 敌防)) + flatAttack    （totalAttack>0 才出手）
```
- **算例**：蓄力 50、攻击倍率 1.5、敌防 20 → floor(75−20)=55。
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

**35 张持续卡 + 2 张即时治疗 = 37 个定义**（`core/upgrade.ts` 的 UPGRADE_POOL 长度 37，含即时卡；5 种携带道具另计）。逐卡数值详单见 [SIXCOLOR_RULES.md](./SIXCOLOR_RULES.md)，事件获取渠道详单见 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md)，此处给体系规则 + 全部 37 个定义的速查表。

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

### 6.2 全卡速查（37 张；公式化说明）

**白（7）**：攻击强化 攻倍率+8%/层 ｜ 防御强化 防+8%/层 ｜ 生命训练 maxHp+8 获得时等量回血 ｜ 淘金者 金币+3%/层 ｜ 均衡训练 攻+5% 且防+5%/层 ｜ 血脉坚韧 maxHp+6 且防+3%/层 ｜ 见多识广 战斗经验+10%/层

**蓝（7）**：快速思考 每回合+1步 ｜ 强力攻击 合并蓄力系数+10%/层 ｜ 灵活身法 生成护甲系数+0.2/层 ｜ 开局优势 每回合+4点起始方块 ｜ 蓄力起步 开局自带3点蓄力/层 ｜ 幸运生成 4 概率=10%+90%×评级÷(1+评级) ｜ 减半护佑 不减半概率=评级÷(1+评级)

**金（8）**：连锁战意 连锁每层+4蓄力 ｜ 锻甲合流 合并数值25%→机制护甲 ｜ 护甲传承 保留评级+0.25 ｜ 生命汲取 吸血评级+0.08 ｜ 连锁回响 未合并回合连锁按比例保留 ｜ 猎手印记 斩杀线=最大生命×评级÷(1+评级) ｜ 致命节奏 暴击率=评级÷(1+评级) ｜ 过载核心 剩余每步→2蓄力

**红（5，均可来自狂战祭坛；猎魔契约也可来自星界棋局）**：狂战契约 爆发+100%/承伤+30% ｜ 血之契约 吸血0.5/流血3 ｜ 双刃赌局 追加攻击1/反噬4 ｜ 猎魔契约 斩杀线50%/承伤+25% ｜ 贪婪之约 金币×(1+评级)/灼烧4

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
| 狂战祭坛（S1+） | 5 种红卡任选一份，或安全离开 | events.ts risk_shrine |
| 诅咒藏书室（S2+） | 金卡+紫诅咒配对交易（5 组） | cursed_archive |
| 深渊契约（S3+） | 金卡+黑宿命配对交易（3 组，需额外确认） | abyss_contract |
| 流浪的净化师（S2+） | 40 金净化一层紫卡 | cleansing_hermit |
| 信使／训练室（S1+） | `xp_1`；`balanced_1`／`def_up_1`／`vigor_1`，金币或固定生命成本 | lost_messenger／training_room |
| 镜面水池（S2+） | `spawn_luck_1`／`halve_shield_1`／`atk_up_2` 各30金，或即时治疗 | mirror_pool |
| 废弃钟楼（S2+） | 步数／起始蓄力／剩余步转蓄力／连锁回响；战术药剂 | abandoned_clock |
| 游荡铸匠（S2+） | 锻甲金卡、白卡组合、装备锻造与重铸 | roaming_smith |
| 断咒祭坛（S2+） | 15生命或35金净化1层；65金净化2层；45金买净化药剂×1 | cleansing_altar |
| 星界棋局（S3+） | 斩杀+暴击／锻甲+传承金卡组合；金+黑交易；`red_hunt` | astral_chess |
| 废弃营地／猩红药圃 | 既有药剂／卷轴入库存，或事件即时治疗（上限风险另列） | abandoned_camp（S1+）／crimson_garden（S3+） |

上表只概览来源；所有成本、数量和组合以 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md) 逐项表为准。事件价不修改商店标准价，新增来源不增加卡池总数。

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

**使用场景**：战斗药剂/卷轴只能在 `phase==='playing'` 使用（不耗步数）；净化只能在 route/shop/rest；`eventResult` 未确认时一律禁用；事件结果确认前不能使用任何道具。临时效果写进 `battleModifiers`（战斗级）或 `roundModifiers`（回合级），回合/战斗结束清除。

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

击杀基础概率 tier≥4 = 100%、tier3 = 40%、tier2 = 20%、tier1 = 10%；boss 强制掉落、elite 概率 ×2（封顶 100%）。稀有度表按 tier 分档（tier≥4 可出史诗）；dropRarityBoost 升 1 档（上限史诗）、dropCount = 2（王者 5 件）多掉一件。事件装备来源除陨落战士common、神秘黑匣rare、远古锻造台25金epic／重铸common→rare、赌徒50%／70%外，新增信使30金common、石像25金common、游荡铸匠60金rare／重铸common→rare；每次1件，缓存精确compound ID，不自动穿戴。全表见 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md)。

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

**25 个事件、94 个选项**（`core/events.ts:90–414` EVENTS），原15个保留＋10个新事件各4–5选。按 `stageMin <= stage` 累计解锁，`pickEvent`（`core/events.ts:623–628`）在当前池内均匀抽取，不做跨节点去重。

| 解锁阶段 | 原有事件 | 新增事件（精确 ID） | 本阶段新增／累计池 |
|---|---|---|---|
| S1+ | 宝箱、治愈之泉、暗影祭坛、陨落战士、狂战祭坛 | `abandoned_camp`／`lost_messenger`／`training_room`／`statue_purse` | 9／S1 9 |
| S2+ | 赌徒的邀约、远古卷轴、看似平静的地面、诅咒藏书室、炼金补给、流浪的净化师 | `mirror_pool`／`abandoned_clock`／`roaming_smith`／`cleansing_altar` | 10／S2 19 |
| S3+ | 神秘黑匣、垂死商人、远古锻造台、深渊契约 | `astral_chess`／`crimson_garden` | 6／S3及以后25 |

**所有25事件逐项 label／成本／精确卡与道具 ID×数量／效果／概率／stageMin**，以及装备随机 ID 规则与源码职责引用见 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md)。这里只保留引擎概要，避免重复维护全表。

**核心原则**：
1. **只能选一个、预览尚未生效**——`RESOLVE_EVENT`（`store/gameStore.ts:123–130`）一次掷骰并缓存 `eventResult`，不扣费、不发奖、不净化；`APPLY_EVENT`（`:136–211`）才应用，绝不重掷。应用结束清空事件，重复点击不重复发奖。
2. **每个含交易的事件恰好一个 `type:'none'` 安全离开选项**；这是首次选择时的出口，不是预览后的取消。当前无取消／返回选项列表 action：已有预览时 RESOLVE 拒绝换选，`GO_TO_ROUTE`（`:311–314`）只允许商店／营地退出。
3. **黑卡确认**——交易含黑卡时须 `CONFIRM_BLACK_EVENT`（`:132–134`）再 APPLY，确认标记本身不发卡。黑卡是否需要确认由实际卡定义推导；当前描述器残留的“可取消”文案并无 action 支持，不应当作功能。
4. **预检与整份应用**——`getEventChoiceDisabledReason`／`getCardTradeDisabledReason`（`core/events.ts:465–548`）检查金币、生命、紫层、精确奖励定义与数量及装备条件；APPLY 还做批量安全累计预检。金币不得用未得奖励抵押；交易 `hpCost` 要求 `hp - hpCost >= 1`，不够则禁用，不是支付到1点的截断。
5. **机关损血保底**——`disarm`／`sprint` 失败走 `hp_reduce`，`max(1, hp - value)` 至少留1点（`store/gameStore.ts:181–185`）；不套交易 `hpCost` 禁用规则，也不将此保底推广到可致死的战斗诅咒损血。
6. **净化顺序**——APPLY 的 `removesPurple` 循环（`:163–166`）每次找持有列表首张合法紫卡，`_removeCardLayer`（`:670–676`）每次减一层，多层先减同张；两层净化不保证影响两种卡。黑卡不能净化，也不计入可净化层数。
7. **即时回血不走卡 grant**——复用事件 `heal`／`gold_heal`／`heal_curse`；`_canGrantCards`（`:621–637`）只接受持续卡，所以不能用 `heal_1`／`heal_2` instant grant 冒充。百分比治疗基于有效总上限，受治疗衰减；上限诅咒先治疗，再降低基础上限（最低10）并夹当前生命。
8. **重铸与入库**——`getReforgeEligibleItem`（`core/events.ts:416–426`）取背包首件未装备普通装备，同 ID 有穿戴份数时全部排除；随机装备缓存精确 compound ID，入背包不自动穿戴；携带道具入库不自动使用。

**既有复用链**：EVENTS 数据 → `cardTradeChoice`（`core/events.ts:73–88`）或原效果定义 → 预检 → `resolveEventEffect`（`:638–693`）缓存 → EventPanel 展示／黑卡确认 → gameStore APPLY → `_grantUpgrade`／`_addConsumable`／`_removeCardLayer`／`_heal`。新增10事件复用现有效果类型，没有新增战斗效果键；精确职责路径详见指南第4节。

**19 种效果类型**（EFFECT_FIELDS 白名单，未知 type 在选项校验／resolve 时报“事件效果不受支持”）：

| type | 字段 | 语义 |
|---|---|---|
| none | — | 安全离开 |
| gold | value | ±金币（唯一允许负值） |
| heal | value(+curse,curse_hp) | 回复总生命上限 value%；roll 命中 curse% 转为 heal_curse |
| hp_reduce | value | 扣固定生命（留1） |
| maxhp_down / maxhp_down_pct | value | 本局基础上限 −value%（最低10），夹当前生命 |
| maxhp_up | value | 本局基础上限 +value |
| xp | value | 直接经验，可能接升级奖励队列 |
| hp_reduce_pct | value(+atk_mult,def_mult) | 当前生命 −value% 换倍率（留1） |
| heal_curse | heal, curse_hp | 先按原总上限回 heal%，再降基础上限 curse_hp% |
| gold_heal | heal, gold | 回血＋金币（heal_mixed 折算成它） |
| gold_xp | gold, xp | 金币＋直接经验 |
| heal_mixed | heal, bonus_gold | 回血＋随机金币 |
| disarm | gold_win, hp_lose | 50% 金币／50% 固定损血（留1） |
| sprint | hp_dmg(+safe) | safe% 无事，否则扣血（留1） |
| gamble | cost, win_chance, win_rarity | 预付足额赌注，输赢只扣一次 |
| drop_equip | rarity/cost | 随机品质装备×1，缓存精确 ID |
| reforge | sell_price, new_rarity, cost | 消耗背包首件未装备 common → 金币＋新品质装备×1 |
| card_trade | grants, consumableGrants, cost, hpCost, gold, removesPurple | 精确持续卡／道具数量、紫层净化；缓存用 cardGrants，黑卡额外确认 |

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

### 14.1 27 个测试文件（tools/tests/，`run-tests.mjs` 自动发现）

board-effects（棋盘动效/浮字）、board-rewards（奖励池）、card-domain（卡定义/聚合/派生）、card-events（事件卡交易）、characterization（种子快照）、display-text（效果文案）、equipment-combat（装备+战斗公式）、events-progression（原有事件分层与契约）、events-expansion（10新事件46选项独立契约、支付/净化/重铸/黑卡/治疗真实动作回归）、map-icons（图标资产）、null-safe-costs、panel-motion、planned-red-core/planned-red-store（红卡体系）、route-branches（路线分支）、route-layout（地图布局）、route-progress（进度文案）、shop-layout（商店网格）、sixcolor-combat（战斗公式全集）、sixcolor-store（store 流程）、storage-validation、store-regressions、swipe-input、ui-components（SFC 编译+挂载）、ui-feedback、w2-bugfix。

### 14.2 harness 原理与写法

- `tools/harness.mjs`：typescript.transpileModule 把 `.ts` 转 CJS + Module._cache 注入；`.vue` 不会被自动处理——**ui-components 测试里被 import 的 .vue 必须先 `compile('components/X.vue')`**。
- 断言惯例：`freeze()` 冻结输入证不改写；`sequence(...)` 受控 rng（多余调用直接 fail）；测试入口把 `Math.random` 替换为抛错，强制显式 rng。

### 14.3 改卡必改的硬编码位置（清单）

| 位置 | 内容 |
|---|---|
| `tools/tests/card-domain.mjs:19-21` | 池长 37、id 去重、即时卡数 |
| `tools/tests/card-domain.mjs` expected 表 + 聚合断言 | 每张卡首效果 + 34 键×1000 层聚合值 |
| `tools/tests/display-text.mjs:42` + expected 表 | 池长 37 + 每卡文案逐字断言 |
| `tools/tests/card-events.mjs` expected 表 | 每个交易事件的 grants 清单 |
| `tools/tests/events-progression.mjs` tradeEvents 契约 | 每事件交易数/允许类/代价 |
| `tools/tests/board-rewards.mjs` | 金卡数 8 等 |
| `tools/tests/characterization.mjs` + `planned-red-store.mjs` | seed42 固定抽卡表 |
| `tools/simulate.mjs` cardScore/eventScore | 新效果键的机器人权重 |

### 14.4 基线工作流（玩法改动评估，录制需单独批准）

当前 `tools/simulate.mjs:21` 的 `RULE_VERSION` 为 **`sixcolor-v2-events25`**；parity／多策略工具从它导入版本。`tools/baselines/sixcolor-v1-*.json` 与历史 snapshot／parity 文件保留，不覆写。规则版本切换不等于基线已录制，也不是自动 record 的授权。

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

默认 check 只读，缺失／不匹配会失败；录制写当前版本／配置命名空间，同版本同配置会写既有目标，不能盲目每次规则改动都 record，更不能重录掩盖失败或重复种子不一致。回复说明行为与哈希变化原因、测量口径和未验证项，不把旧通关率改名为新率。**本轮27组测试、类型/SFC、H5/微信构建以及新版固定种子、200种子和五策略50＋50种子回归已通过。v2基线已按本轮批准流程单独记录并默认复验通过，原v1基线SHA-256保持不变。**

---

## 15. UI 架构

- **单页外壳** `pages/index/index.vue`：按 `store.screen` 切 10 个屏幕；悬浮工具栏（规则/装备/强化[战斗]/道具[非战斗]/主题/调试）。
- **弹层模式**：`useModalMotion(reduced)` 返回 `{mounted, closing, open, close, reset, onTransitionEnd}`；宿主写法 = `v-if="x.mounted.value"` + `ui-motion-closing` 类 + `@click.capture/@keydown.capture blockClosing` + `@transitionend`；全局 `inputBlocked` 把所有弹层 mounted OR 起来 provide 给棋盘/道具栏阻断输入。**收起动画期间保留遮罩与阻断**。
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
5. **红/紫/黑获取铁律**：每种风险卡都必须有正常游戏获取事件；每个交易事件恰好一个安全出口。
6. **事件预览缓存**：掷骰只在 RESOLVE_EVENT，APPLY 不重掷。
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

在 `core/events.ts` EVENTS 加定义（精确id、stageMin、choices；交易用既有 `cardTradeChoice`，即时治疗用 `heal`，机关／装备／重铸复用原效果）→ 检查 preview／APPLY职责与成本预检 → 按实际数据同步事件计数、阶段累计池及相关测试（card-events／events-progression等）→ 文档同步 [EVENTS_GUIDE.md](./EVENTS_GUIDE.md) 全部选项、本文§6／§10与 SIXCOLOR_RULES／README入口。只有新效果字段才走§18.3；规则版本与是否录制基线按§14.4分别决定。当前25事件复用19类效果，无需为新增来源扩战斗机制。

### 18.3 加一个效果字段（如 removesPurple）

events.ts：EFFECT_FIELDS 白名单 → cardTradeChoice/结算透传 → getCardTradeDisabledReason 校验（context 缺字段时给禁用原因）→ describeCardTrade 文案 → gameStore APPLY_EVENT 原子预检+应用 → 测试同步。

### 18.4 调一个数值

只动 `core/upgrade.ts`/`core/battle.ts`/`core/enemy.ts` 等对应常量 → 授权范围内测试及只读simulate/parity（必要时report-only）→ 解释真实行为／哈希变化与测量结果。若需要新基线，整合完成后按§14.4单独审阅批准录制；不要假定每处数值都必改固定快照，也不要用盲目record消除差异。

### 18.5 加一个消耗品

`core/consumables.ts` 定义（validateConsumable 约束）→ gameStore USE_CONSUMABLE 分支（或走 modifiersFromEffects 泛化）→ 使用场景校验 → card-domain 消耗品段 → 商店池自动。

### 18.6 发版检查单

tests 27/27 → tsc 0 错 → SFC 编译 → simulate/parity 基线 → `build h5` + `build mp-weixin`（包体 ≤2MiB）→ 4173 浏览器实测（390×844）→ 打包三 zip 到 deliverables → 仅执行用户明确授权的提交／推送／上传动作，回复准确结果和未实测范围。

---

## 19. 已知限制与未验证范围

- **微信真机未实测**：编译通过 ≠ 真机性能/兼容验证；所有"微信可用"结论仅到编译级。
- **模拟 ≠ 真人平衡**：tools 里的五种策略（baseline/corner/attack/defense/economy）是固定算法，通关率不代表真人。
- **2026-11-07 前期平衡包（历史实测，不是25事件新率）**（针对“前期玩家数值追不上怪物”的实测3~10倍倒挂）：防御公式÷6→÷3、敌人回合成长前两回合缓冲、stage1/2敌防与boss数值下调（岩石巨人130/28/10、远古巨龙170/44/14）。当时attack策略打过stage1 boss 26/50（52%）、stage2 boss 14/50（28%）、整局胜利8~15/50（改前5）；baseline当时仍全灭。这些样本保留历史口径，不能迁移为 `sixcolor-v2-events25` 的通关率，扩充后需独立测量。原目标口径：boss击杀/存活比≤1.5x；stage3+高压是后期曲线设计。
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
| 黑卡确认 | 深渊契约类交易的二段确认（CONFIRM_BLACK_EVENT） |
| ui-entry / ui-feedback | 全局入场动画与成功提示类（App.vue 公共原语） |
