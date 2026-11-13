# AGENTS.md — 项目协作约定

本文件为 AI 协作代理在本仓库工作时必须遵守的约定。执行任何改动前先读本文件。

> **系统知识库**：全部文档的合并阅读入口见 [MASTER_DOC.md](./MASTER_DOC.md)；游戏规则、机制公式、测试与基线工作流、标准任务手册见 [PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md)。做任务安排前先读它；卡牌数值详单见 [SIXCOLOR_RULES.md](./SIXCOLOR_RULES.md)。若文档与代码冲突，以代码为准并回填文档（先改源文档，再用 `tools/gen-master-doc.mjs --write` 同步总文档）。

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
