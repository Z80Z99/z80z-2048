import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertPackageSize, calculatePackageSize, MAX_PACKAGE_BYTES } from '../package-size.mjs'

const cliPath = fileURLToPath(new URL('../package-size.mjs', import.meta.url))
const projectRoot = fileURLToPath(new URL('../..', import.meta.url))

function snapshot(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).map(entry => {
    const file = path.join(directory, entry.name)
    const stat = fs.statSync(file)
    return {
      name: entry.name,
      modified: stat.mtimeMs,
      contents: entry.isDirectory() ? snapshot(file) : createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
    }
  })
}

export function run() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'z80z-package-size-'))
  try {
    const relative = path.relative(projectRoot, temporaryRoot)
    assert.ok(path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`), 'fixtures stay outside the repository')
    assert.equal(MAX_PACKAGE_BYTES, 2 * 1024 * 1024)

    const invoke = args => {
      const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: temporaryRoot,
        encoding: 'utf8',
        shell: false,
      })
      assert.ifError(result.error)
      assert.equal(result.signal, null)
      return result
    }

    const empty = path.join(temporaryRoot, 'empty')
    fs.mkdirSync(path.join(empty, 'nested'), { recursive: true })
    fs.writeFileSync(path.join(empty, 'nested', 'zero.js'), '')
    const emptyBefore = snapshot(empty)
    assert.equal(calculatePackageSize(empty), 0)
    assert.equal(assertPackageSize(empty), 0)
    assert.equal(invoke([empty]).status, 0)
    assert.deepEqual(snapshot(empty), emptyBefore, 'empty directories and files stay unchanged')

    for (const [label, bytes] of [
      ['below limit', MAX_PACKAGE_BYTES - 1],
      ['equal limit', MAX_PACKAGE_BYTES],
      ['above limit', MAX_PACKAGE_BYTES + 1],
    ]) {
      const directory = path.join(temporaryRoot, label)
      const nested = path.join(directory, 'static', 'scenes')
      fs.mkdirSync(nested, { recursive: true })
      fs.mkdirSync(path.join(directory, 'empty'))
      fs.writeFileSync(path.join(directory, 'app.js'), Buffer.alloc(1024, 1))
      fs.writeFileSync(path.join(nested, 'scene.png'), Buffer.alloc(bytes - 1025, 2))
      fs.writeFileSync(path.join(nested, 'scene.svg'), 'x')
      const before = snapshot(directory)
      assert.equal(calculatePackageSize(directory), bytes, `${label}: nested files all count`)
      if (bytes > MAX_PACKAGE_BYTES) {
        assert.throws(() => assertPackageSize(directory), { name: 'RangeError', message: /over 2 MiB limit/ })
      } else {
        assert.equal(assertPackageSize(directory), bytes)
      }
      const result = invoke([directory])
      assert.equal(result.status, bytes > MAX_PACKAGE_BYTES ? 1 : 0, `${label}: CLI exit code`)
      assert.match(result.stdout + result.stderr, new RegExp(`${bytes} bytes`))
      if (bytes > MAX_PACKAGE_BYTES) {
        assert.match(result.stderr, /over 2 MiB limit/)
        assert.equal(result.stdout, '')
      } else {
        assert.match(result.stdout, /WeChat package:/)
        assert.equal(result.stderr, '')
      }
      assert.deepEqual(snapshot(directory), before, `${label}: helper and CLI leave files and timestamps unchanged`)
    }

    const missing = path.join(temporaryRoot, 'missing')
    const notDirectory = path.join(temporaryRoot, 'file.js')
    fs.writeFileSync(notDirectory, 'not a directory')
    for (const [directory, code] of [[missing, 'ENOENT'], [notDirectory, 'ENOTDIR']]) {
      assert.throws(() => calculatePackageSize(directory), { code })
      assert.throws(() => assertPackageSize(directory), { code })
      const result = invoke([directory])
      assert.equal(result.status, 1, `${code}: CLI exits nonzero`)
      assert.ok(result.stderr.includes(code), `${code}: CLI reports filesystem error`)
      assert.equal(result.stdout, '')
    }
    assert.equal(fs.existsSync(missing), false, 'missing output is not created')
    assert.equal(fs.readFileSync(notDirectory, 'utf8'), 'not a directory')

    // 权限错误用注入模拟，避免管理员权限使 chmod 测试失效。
    const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' })
    for (const [method, deniedPath] of [
      ['readdirSync', path.join(empty, 'nested')],
      ['statSync', path.join(empty, 'nested', 'zero.js')],
    ]) {
      const original = fs[method]
      try {
        fs[method] = (file, ...args) => {
          if (file === deniedPath) throw denied
          return original(file, ...args)
        }
        assert.throws(() => calculatePackageSize(empty), error => error === denied)
        assert.throws(() => assertPackageSize(empty), error => error === denied)
      } finally {
        fs[method] = original
      }
    }
    assert.deepEqual(snapshot(empty), emptyBefore)

    for (const args of [[], [empty, empty], ['--unknown']]) {
      const result = invoke(args)
      assert.equal(result.status, 1, 'invalid CLI arguments fail')
      assert.ok(result.stderr.length > 0)
      assert.equal(result.stdout, '')
    }
    const help = invoke(['--help'])
    assert.equal(help.status, 0)
    assert.match(help.stdout, /Usage:/)
    assert.equal(help.stderr, '')
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true })
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    run()
    console.log('PASS  package-size.mjs')
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
