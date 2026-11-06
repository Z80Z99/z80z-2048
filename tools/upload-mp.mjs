// Uploads the current WeChat build as a development version.
// The real AppID never enters Git: pass it inline each time.
//
//   node tools/upload-mp.mjs --appid wx... --version 1.1.0 --desc "说明"
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const outputDir = path.join(projectRoot, 'unpackage/dist/build/mp-weixin')
const cliPath = process.env.WECHAT_DEVTOOLS_CLI || 'E:/微信web开发者工具/cli.bat'
const { values } = parseArgs({
  options: {
    appid: { type: 'string' },
    version: { type: 'string' },
    desc: { type: 'string' },
  },
})
const appid = values.appid || process.env.WECHAT_APPID
if (!appid || !/^wx[0-9a-f]{16}$/.test(appid)) {
  throw new Error('Pass --appid wx<16 hex chars> (or set WECHAT_APPID). Never commit it.')
}
if (!fs.existsSync(path.join(outputDir, 'app.json'))) {
  throw new Error('Build first: npm run build:mp-weixin')
}
const version = values.version || JSON.parse(fs.readFileSync(path.join(projectRoot, 'manifest.json'), 'utf8')).versionName
const desc = values.desc || 'Z80Z update'

// The uploaded copy only; manifest.json keeps its touristappid placeholder.
const configPath = path.join(outputDir, 'project.config.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
config.appid = appid
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

const result = spawnSync(`"${cliPath}"`, ['upload', '--project', outputDir, '--version', version, '--desc', desc], {
  stdio: 'inherit',
  shell: true,
})
if (result.status !== 0) {
  console.error('[upload] failed; run tools/build.mjs build mp-weixin first if the package is over 2 MiB')
  process.exitCode = 1
} else {
  console.log(`[upload] ${version} uploaded. Set it as 体验版 in mp.weixin.qq.com → 版本管理.`)
}
