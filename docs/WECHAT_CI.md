# 微信开发版自动上传（GitHub Actions）

合并到 `master` 后，GitHub Actions 会自动构建微信包并上传为**开发版**。
设体验版、提审、发布仍然要在 mp.weixin.qq.com 手动操作——微信没有为这些动作提供可用的公开接口。

## 一次性配置（约 5 分钟）

### 1. 下载代码上传密钥

mp.weixin.qq.com → 左侧 **开发与服务 → 开发管理 → 开发设置** → 找到 **小程序代码上传** → 生成并下载密钥文件（文件名形如 `private.wx<你的小程序AppID>.key`）。

> 密钥文件等同于上传权限，**不要提交到仓库**。仓库的 `.gitignore` 已忽略 `*.key`。

### 2. 关闭该密钥的 IP 白名单

同一页面下方的 **IP 白名单** → 关闭。

**这一步必须做**：GitHub Actions 的 runner 出口 IP 每次都不固定，开着白名单上传必然报 `invalid ip` 一类错误。要保留白名单就只能用自建 runner 并把它的 IP 加进去。

### 3. 在仓库里加两个 Secret

GitHub 仓库 → **Settings → Secrets and variables → Actions → New repository secret**：

| 名称 | 值 |
|---|---|
| `WECHAT_APPID` | 你的小程序 AppID（mp 后台「开发设置」第一项，`wx` 开头 16 位） |
| `WECHAT_PRIVATE_KEY` | 密钥文件的**完整内容**（用文本编辑器打开，全选复制，包括开头结尾的 `-----` 行） |

密钥只存在 GitHub 加密存储里，工作流运行时才注入，不会出现在日志或仓库中。

## 工作流做什么

`.github/workflows/wechat-upload.yml`，触发方式是 **push 到 master**（也可在 Actions 页面手动 Run workflow，并填写上传说明）。

1. `windows-latest` + Node 22（必须 Windows：压图脚本用 PowerShell + System.Drawing）
2. `npm ci` 装依赖
3. `npm test` + `npm run typecheck` —— **测试不通过就不会上传**
4. `npm run build:mp-weixin` 构建（内含压图与 2 MiB 包体校验）
5. `node tools/ci-upload-mp.mjs` 用 miniprogram-ci 上传开发版

版本号取 `package.json` 的 `version`；上传说明默认用该次提交的标题和短哈希。

## 本地自检（不上传）

```bash
WECHAT_APPID=wx你的16位AppID npm run upload:mp-weixin:ci -- --dry-run
```

dry-run 只检查构建产物、包体大小和参数，不联网、不需要密钥。

## 常见失败

| 现象 | 原因 |
|---|---|
| `invalid ip` / 白名单相关 | 密钥的 IP 白名单没关 |
| `-1` / 40164 类错误 | 密钥内容不完整（复制时截断）或已失效，重新下载 |
| `qrCode` / 需要扫码 | 用错了旧的上传方式；本流程走 miniprogram-ci，不需要扫码 |
| `包体超过 2 MiB` | 构建阶段就会失败，先看 `npm run build:mp-weixin` 输出 |
| 上传成功但后台看不到 | 去看 **版本管理 → 开发版本**，不是“线上版本” |

## 安全约定

- `manifest.json` 的 appid 始终是占位符 `touristappid`；真实 appid 只在构建副本和 CI 环境变量里出现。
- 真实上传密钥绝不入库、绝不写进文档、绝不出现在提交信息里。
- 上传的只是**开发版**。对外可见需要你手动选择体验版或提交审核。
