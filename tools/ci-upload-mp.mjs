// 用微信官方 miniprogram-ci 上传开发版（无需打开开发者工具，可在 CI 里跑）。
// 凭据只从环境变量读，绝不写入仓库：
//
//   WECHAT_APPID         小程序 AppID（wx 开头 16 位）
//   WECHAT_PRIVATE_KEY   代码上传密钥文件的完整内容
//
//   node tools/ci-upload-mp.mjs [--version 1.1.1] [--desc "说明"] [--dry-run]
//
// --dry-run 只校验参数与构建产物，不联网、不上传，可用于本地自检。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const outputDir = path.join(projectRoot, 'unpackage/dist/build/mp-weixin')
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024

function fail(message) {
  console.error(`[ci-upload] ${message}`)
  process.exit(1)
}

const { values } = parseArgs({
  options: {
    version: { type: 'string' },
    desc: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
})

// 1) 构建产物必须存在（先跑 npm run build:mp-weixin）。
if (!fs.existsSync(path.join(outputDir, 'app.json'))) fail('缺少构建产物：先运行 npm run build:mp-weixin')

// 2) 包体大小：微信主包上限 2 MiB。
const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((sum, entry) => sum + (entry.isDirectory() ? walk(path.join(dir, entry.name)) : fs.statSync(path.join(dir, entry.name)).size), 0)
const bytes = walk(outputDir)
const mib = (bytes / 1048576).toFixed(2)
if (bytes > MAX_PACKAGE_BYTES) fail(`微信包体 ${mib} MiB 超过 2 MiB 上限`)
console.log(`[ci-upload] 包体 ${mib} MiB（${bytes} 字节）`)

// 3) 凭据与版本号。
const appid = process.env.WECHAT_APPID ?? ''
const privateKey = process.env.WECHAT_PRIVATE_KEY ?? ''
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8'))
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
const version = values.version ?? pkg.version ?? manifest.versionName
const desc = values.desc ?? `Z80Z ${version}`

if (!/^wx[0-9a-f]{16}$/.test(appid)) fail('缺少有效的 WECHAT_APPID（wx 开头 16 位）')
if (!version || !/^\d+(\.\d+){1,3}$/.test(version)) fail(`版本号格式不正确：${version}`)

if (values['dry-run']) {
  // 本地自检：不校验密钥、不联网、不写构建副本。
  console.log(`[ci-upload] dry-run 通过：appid=${appid} version=${version} desc=${desc}`)
  console.log('[ci-upload] 真实上传需要 WECHAT_PRIVATE_KEY，并且该密钥要关闭 IP 白名单（CI 出口 IP 不固定）')
  process.exit(0)
}

if (!privateKey.trim()) fail('缺少 WECHAT_PRIVATE_KEY（小程序代码上传密钥的完整内容）')

// 4) 密钥只在临时文件里落地，用完即删；构建副本里的 appid 也只在本地改写，仓库 manifest 保持 touristappid。
const keyPath = path.join(os.tmpdir(), `z80z-upload-${process.pid}.key`)
fs.writeFileSync(keyPath, privateKey, { encoding: 'utf8', mode: 0o600 })
const configPath = path.join(outputDir, 'project.config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
config.appid = appid
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

try {
  // miniprogram-ci 是 CommonJS 包且没有 exports 字段：不同 Node 版本对 `import()` 的
  // 命名导出分析结果不同（Node 22 只能拿到 default，Node 24 能拿到命名导出），
  // 所以按 CJS 直接 require，避免因 runner 的 Node 版本不同而失败。
  const require = createRequire(import.meta.url)
  let ci
  try {
    ci = require('miniprogram-ci')
  } catch (error) {
    fail(`未安装 miniprogram-ci（${error.message}）：运行 npm ci 或 npm install --save-dev miniprogram-ci@2`)
  }
  // 兜底：若被 ESM 包装过，接口可能挂在 default 上。
  if (typeof ci?.Project !== 'function' && typeof ci?.default?.Project === 'function') ci = ci.default
  const pkgVersion = (() => { try { return require('miniprogram-ci/package.json').version } catch { return '未知' } })()
  if (typeof ci?.Project !== 'function' || typeof ci?.upload !== 'function') {
    fail(`miniprogram-ci 接口异常（版本 ${pkgVersion}）：拿不到 Project/upload`)
  }
  console.log(`[ci-upload] miniprogram-ci ${pkgVersion}`)

  const project = new ci.Project({ appid, type: 'miniProgram', projectPath: outputDir, privateKeyPath: keyPath, ignores: ['node_modules/**/*'] })
  await ci.upload({
    project,
    version,
    desc,
    setting: { es6: true, minify: true, autoPrefixWXSS: true },
    onProgressUpdate: info => {
      if (typeof info === 'string') console.log(`[ci-upload] ${info}`)
    },
  })
  console.log(`[ci-upload] ${version} 上传成功。到 mp.weixin.qq.com → 版本管理 里选为体验版。`)
} finally {
  try { fs.unlinkSync(keyPath) } catch { /* 临时文件清理失败不影响结果 */ }
}
