# AGENTS.md — 项目协作约定

本文件为 AI 协作代理在本仓库工作时必须遵守的约定。执行任何改动前先读本文件。

## 项目简介

Z80Z：基于 2048 玩法的 Roguelike 爬塔微信小程序（uni-app Vue 3 + Pinia + TypeScript）。

- `core/`：纯游戏逻辑（棋盘、战斗、敌人、路线、强化、装备、事件、随机）
- `store/`：Pinia 状态（gameStore 游戏流程 + helpers 纯函数）
- `components/`：UI 组件（`screens/` 下按屏幕拆分）
- `pages/index/`：唯一页面（屏幕切换外壳）
- `tools/`：测试基建（无构建链路，逻辑测试跑在 Node 上）
- `manifest.json` 的 appid 必须保持占位符 `touristappid`

## 测试与验证（改动后必跑）

```bash
node tools/run-tests.mjs                   # TDD 单测，必须全绿
node tools/simulate.mjs                    # 固定种子整局模拟；SHA-256 为回归锚点
node tools/parity.mjs                      # 200 种子统计平价（数值分布改动需证明无偏差）
node node_modules/typescript/bin/tsc -p tools/tsconfig.check.json   # 类型检查，错误数不得超过 tools/tsc-baseline.txt
```

规则：`simulate.mjs` 的 SHA-256 哈希是行为回归锚点——除明确授权的改动外不得变化；变化时必须给出平价证明。

## 自动提交推送（强制约定）

每次迭代/改动完成后，**自动执行，无需再询问用户**：

1. **验证**：跑上述测试，确认改动可用且无回归
2. **提交**：按逻辑拆成原子提交；消息风格沿用仓库历史（`fix:` / `feat:` / `refactor:` / `docs:` / `chore:` 前缀 + 中文或英文简述，必要时加正文）
3. **推送**：`git push origin master`，并用 `git ls-remote origin` 确认远端哈希同步

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
