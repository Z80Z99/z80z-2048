import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const usage = 'Usage: node tools/build.mjs <dev h5 | build h5 | build mp-weixin | preview h5> [--port <number>]'

try {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error('The pinned uni-app compiler requires Node.js >=22.12.0.')
  }

  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  if (values.help) {
    console.log(usage)
  } else {
    const [action, platform] = positionals
    if (positionals.length !== 2 || ![
      'dev:h5',
      'build:h5',
      'build:mp-weixin',
      'preview:h5',
    ].includes(`${action}:${platform}`)) {
      throw new Error(usage)
    }
    if (values.port !== undefined && (action === 'build' || !/^\d+$/.test(values.port) ||
      Number(values.port) < 1 || Number(values.port) > 65535)) {
      throw new Error('--port must be an integer from 1 to 65535 and is only supported for dev/preview.')
    }

    const outputDir = path.join(projectRoot, 'unpackage/dist', action === 'dev' ? 'dev' : 'build', platform)
    const cliPath = path.join(projectRoot, 'node_modules', action === 'preview'
      ? 'vite/bin/vite.js'
      : '@dcloudio/vite-plugin-uni/bin/uni.js')
    if (!existsSync(cliPath)) {
      throw new Error('Build dependencies are missing. Run npm ci --ignore-scripts --no-audit --no-fund first.')
    }
    if (action === 'preview' && !existsSync(path.join(outputDir, 'index.html'))) {
      throw new Error('The H5 production build is missing. Run npm run build:h5 first.')
    }

    const args = [cliPath]
    if (action !== 'dev') args.push(action)
    if (action !== 'preview') args.push('--platform', platform)
    args.push('--config', path.join(projectRoot, 'vite.config.mjs'))
    if (values.port !== undefined) args.push('--port', values.port)

    console.log(`[uni-app] ${action} ${platform}; ${action === 'preview' ? 'serving' : 'output'}: ${outputDir}`)
    const child = spawn(process.execPath, args, {
      // uni's platform discovery uses cwd; input stays in the existing HBuilderX root layout.
      cwd: projectRoot,
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        NODE_ENV: action === 'dev' ? 'development' : 'production',
        UNI_PLATFORM: platform,
        UNI_INPUT_DIR: projectRoot,
        UNI_OUTPUT_DIR: outputDir,
        VITE_ROOT_DIR: projectRoot,
        // Official uni-cli-shared skips its update/usage-report request in CI mode.
        CI: '1',
      },
    })
    const onInterrupt = () => child.kill('SIGINT')
    const onTerminate = () => child.kill('SIGTERM')
    process.on('SIGINT', onInterrupt)
    process.on('SIGTERM', onTerminate)
    child.once('error', error => {
      console.error(`[uni-app] ${error.message}`)
      process.exitCode = 1
    })
    child.once('close', (code, signal) => {
      process.removeListener('SIGINT', onInterrupt)
      process.removeListener('SIGTERM', onTerminate)
      process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1)
    })
  }
} catch (error) {
  console.error(`[uni-app] ${error.message}`)
  process.exitCode = 1
}
