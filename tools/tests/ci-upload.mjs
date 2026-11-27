// CI 上传脚本的自检：参数校验、包体门禁、密钥不落地、dry-run 不联网。不执行真实上传。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

export async function run() {
  const root = path.resolve(import.meta.dirname, '../..')
  const script = path.join(root, 'tools/ci-upload-mp.mjs')
  const outputDir = path.join(root, 'unpackage/dist/build/mp-weixin')
  // 需要先有构建产物：CI 里上传步骤排在 build 之后。
  if (!fs.existsSync(path.join(outputDir, 'app.json'))) {
    console.log('skip: 没有微信构建产物（先跑 npm run build:mp-weixin）')
    return
  }
  const run = (env = {}, args = ['--dry-run']) => {
    const clean = { ...process.env }
    delete clean.WECHAT_APPID
    delete clean.WECHAT_PRIVATE_KEY
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...clean, ...env } })
    return { code: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` }
  }

  // 扫码/开发者工具那条老路径不应出现在 CI 脚本里。
  const source = fs.readFileSync(script, 'utf8')
  assert.doesNotMatch(source, /cli\.bat|微信web开发者工具/, 'CI 上传走 miniprogram-ci，不依赖开发者工具')
  assert.match(source, /^import fs from 'node:fs'/m)
  // miniprogram-ci 是没有 exports 字段的 CJS 包：必须按 CJS require，
  // 否则 Node 22 的 import() 只给 default，会出现 "Project is not a constructor"。
  assert.match(source, /createRequire\(import\.meta\.url\)/, 'miniprogram-ci 用 createRequire 加载')
  assert.doesNotMatch(source, /await import\('miniprogram-ci'\)/, '不要用 import() 取 miniprogram-ci 的命名导出')
  {
    const { createRequire } = await import('node:module')
    const require = createRequire(script)
    const ci = require('miniprogram-ci')
    assert.equal(typeof ci.Project, 'function', 'createRequire 能取到 Project 构造器')
    assert.equal(typeof ci.upload, 'function', 'createRequire 能取到 upload')
    // 构造 Project 不联网；privateKeyPath 只需存在。
    const project = new ci.Project({ appid: 'wx0123456789abcdef', type: 'miniProgram', projectPath: outputDir, privateKeyPath: script, ignores: ['node_modules/**/*'] })
    assert.ok(project.projectPath, 'Project 能成功构造（即上次 CI 失败的那一步）')
  }

  // 缺少 appid：失败且说明原因。
  assert.equal(run({}).code, 1)
  assert.match(run({}).out, /缺少有效的 WECHAT_APPID/)
  // appid 格式不对：同样拦下，避免把错 id 传上去。
  assert.equal(run({ WECHAT_APPID: 'touristappid' }).code, 1)
  assert.equal(run({ WECHAT_APPID: 'wx123' }).code, 1)

  // dry-run：通过、报出包体、且不要求密钥。
  const validAppid = 'wx0123456789abcdef'
  const dry = run({ WECHAT_APPID: validAppid })
  assert.equal(dry.code, 0, dry.out)
  assert.match(dry.out, /dry-run 通过/)
  assert.match(dry.out, /包体 1\.\d+ MiB/)
  assert.doesNotMatch(dry.out, /缺少 WECHAT_PRIVATE_KEY/, 'dry-run 不需要密钥')

  // 非 dry-run 但缺密钥：应在上传前就失败，不会静默成功。
  const noKey = run({ WECHAT_APPID: validAppid }, [])
  assert.equal(noKey.code, 1)
  assert.match(noKey.out, /缺少 WECHAT_PRIVATE_KEY/)

  // 版本号格式：非法值要拦下。
  const badVersion = run({ WECHAT_APPID: validAppid }, ['--dry-run', '--version', 'v1.2'])
  assert.equal(badVersion.code, 1)
  assert.match(badVersion.out, /版本号格式不正确/)

  // 包体门禁：脚本自己也会量一遍，且与 package-size 的上限一致。
  assert.match(source, /MAX_PACKAGE_BYTES = 2 \* 1024 \* 1024/)
  assert.match(source, /超过 2 MiB 上限/)
}
