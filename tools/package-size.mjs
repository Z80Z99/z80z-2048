import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024

// 只读取构建副本的文件大小，不改写或压缩任何资源。
export function calculatePackageSize(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((bytes, entry) => {
    const file = path.join(directory, entry.name)
    return bytes + (entry.isDirectory() ? calculatePackageSize(file) : fs.statSync(file).size)
  }, 0)
}

export function assertPackageSize(directory) {
  const bytes = calculatePackageSize(directory)
  if (bytes > MAX_PACKAGE_BYTES) {
    throw new RangeError(`WeChat package: ${(bytes / (1024 * 1024)).toFixed(2)} MiB (${bytes} bytes; over 2 MiB limit)`)
  }
  return bytes
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const usage = 'Usage: node tools/package-size.mjs <mp-weixin output directory>'
  try {
    const { positionals, values } = parseArgs({
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h' },
      },
    })
    if (values.help) {
      console.log(usage)
    } else {
      if (positionals.length !== 1) throw new Error(usage)
      const bytes = assertPackageSize(positionals[0])
      console.log(`[uni-app] WeChat package: ${(bytes / (1024 * 1024)).toFixed(2)} MiB (${bytes} bytes)`)
    }
  } catch (error) {
    console.error(`[uni-app] ${error.message}`)
    process.exitCode = 1
  }
}
