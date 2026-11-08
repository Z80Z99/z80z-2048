import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { loadProject } from '../harness.mjs'

const require = createRequire(import.meta.url)
const vue = require('vue')
const sfc = require('@vue/compiler-sfc')
const ts = require('typescript')
const root = path.resolve(import.meta.dirname, '../..')
const { createPanelMotion, isOwnMotionTransition } = loadProject('./utils/panelMotion')
const { useModalMotion } = loadProject('./composables/usePanelMotion')

function scheduler() {
  let serial = 0
  const jobs = new Map()
  return {
    jobs,
    schedule(callback, delay) {
      const id = ++serial
      jobs.set(id, { callback, delay, active: true })
      return id
    },
    cancel(id) { if (jobs.has(id)) jobs.get(id).active = false },
    fire(id) {
      const job = jobs.get(id)
      assert.ok(job, `timer ${id} exists`)
      job.active = false
      job.callback() // 已取消的回调也故意执行，验证代次护栏。
    },
    latest() { return serial },
    pending() { return [...jobs.values()].filter(job => job.active) },
  }
}

function controllerTests() {
  const clock = scheduler()
  const changes = []
  let reduced = false
  let duration = 200
  const motion = createPanelMotion({
    schedule: clock.schedule, cancel: clock.cancel,
    duration: () => duration, reduced: () => reduced,
    onChange: snapshot => changes.push(snapshot),
  })
  assert.deepEqual(motion.snapshot, { mounted: false, phase: 'closed', revision: 0 })
  motion.show()
  const firstOpen = clock.latest()
  assert.equal(motion.snapshot.phase, 'opening')
  assert.equal(clock.jobs.get(firstOpen).delay, 200)
  motion.show()
  assert.equal(clock.latest(), firstOpen, '重复打开不新增定时器')
  motion.close()
  const firstClose = clock.latest()
  const closingRevision = motion.snapshot.revision
  assert.equal(motion.snapshot.mounted, true, '关闭中保留内容和遮罩')
  motion.close()
  assert.equal(clock.latest(), firstClose, '重复关闭不延长窗口')
  motion.show()
  const reopen = clock.latest()
  clock.fire(firstClose)
  clock.fire(firstOpen)
  motion.finish(closingRevision)
  assert.equal(motion.snapshot.phase, 'opening', '旧回调不能关闭重开的面板')
  assert.equal(clock.pending().length, 1, '旧回调不能清除当前定时器')
  motion.finish(motion.snapshot.revision)
  assert.equal(motion.snapshot.phase, 'open')
  const changeCount = changes.length
  motion.finish(motion.snapshot.revision)
  clock.fire(reopen)
  assert.equal(changes.length, changeCount, '重复完成幂等')

  motion.close()
  const changedDuration = clock.latest()
  duration = 80
  motion.sync()
  const newTimer = clock.latest()
  assert.equal(clock.jobs.get(newTimer).delay, 80)
  clock.fire(changedDuration)
  assert.equal(motion.snapshot.phase, 'closing')
  reduced = true
  motion.sync()
  assert.equal(motion.snapshot.phase, 'closed', '动态减少动效立即完成关闭')
  assert.equal(clock.pending().length, 0)
  clock.fire(newTimer)
  motion.show()
  assert.equal(motion.snapshot.phase, 'open', '减少动效打开无延迟')
  motion.close()
  assert.equal(motion.snapshot.phase, 'closed')

  reduced = false
  duration = 0
  motion.show()
  assert.equal(motion.snapshot.phase, 'open', '零时长无需定时器')
  duration = 200
  motion.close()
  const beforeReset = clock.latest()
  motion.reset()
  const resetRevision = motion.snapshot.revision
  clock.fire(beforeReset)
  assert.equal(motion.snapshot.revision, resetRevision)
  motion.show()
  const beforeDispose = clock.latest()
  motion.dispose()
  const disposedRevision = motion.snapshot.revision
  clock.fire(beforeDispose)
  motion.show()
  motion.close()
  motion.reset()
  motion.finish(disposedRevision)
  motion.sync()
  motion.dispose()
  assert.equal(motion.snapshot.phase, 'closed')
  assert.equal(motion.snapshot.revision, disposedRevision)
  assert.equal(clock.pending().length, 0)

  const own = { id: 'root', dataset: { motionId: 'motion-root' } }
  assert.equal(isOwnMotionTransition({ target: own, currentTarget: own, propertyName: 'height' }, 'height'), true)
  assert.equal(isOwnMotionTransition({ target: { id: 'child' }, currentTarget: own, propertyName: 'height' }, 'height'), false)
  assert.equal(isOwnMotionTransition({ target: { dataset: { motionId: 'motion-root' } }, currentTarget: own, detail: { propertyName: 'height' } }, 'height'), true)
  assert.equal(isOwnMotionTransition({ target: {}, currentTarget: {}, propertyName: 'height' }, 'height'), false)
  assert.equal(isOwnMotionTransition({ target: own, currentTarget: own, propertyName: 'opacity' }, 'height'), false)
  assert.equal(isOwnMotionTransition({ target: own, currentTarget: own }, 'height'), false)
}

function compilePanel() {
  const filename = path.join(root, 'components/ExpandPanel.vue')
  const source = fs.readFileSync(filename, 'utf8')
  const parsed = sfc.parse(source, { filename })
  assert.deepEqual(parsed.errors, [])
  const compiled = sfc.compileScript(parsed.descriptor, {
    id: 'panel-motion-test', inlineTemplate: true,
    templateOptions: { compilerOptions: { isCustomElement: tag => tag === 'view' } },
  })
  const style = sfc.compileStyle({
    source: parsed.descriptor.styles[0].content,
    filename, id: 'data-v-panel-motion-test', scoped: true,
  })
  assert.deepEqual(style.errors, [], 'scoped CSS compiles')
  assert.ok(!source.includes('scrollHeight') && !source.includes('<Transition'), '只使用跨端 uni 测量')
  assert.ok(source.includes('display: flow-root') && source.includes('overflow: hidden'), '子元素外边距不折叠到测量包装外')

  // 仅检查所拥有的 TS 与 SFC script，不构建应用或拉入游戏模块。
  const virtualFile = filename + '.ts'
  const options = {
    strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Node10, types: [],
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const isVirtual = file => path.resolve(file) === path.resolve(virtualFile)
  host.fileExists = file => isVirtual(file) || fileExists(file)
  host.readFile = file => isVirtual(file) ? compiled.content : readFile(file)
  host.getSourceFile = (file, languageVersion) => {
    const content = host.readFile(file)
    return content === undefined ? undefined : ts.createSourceFile(file, content, languageVersion, true)
  }
  const program = ts.createProgram([
    virtualFile,
    path.join(root, 'utils/panelMotion.ts'),
    path.join(root, 'composables/usePanelMotion.ts'),
    path.join(root, 'tools/shims.d.ts'),
  ], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }))
  const module = new Module(virtualFile)
  module.filename = virtualFile
  module.paths = Module._nodeModulePaths(path.dirname(virtualFile))
  const result = ts.transpileModule(compiled.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
  module._compile(result.outputText, virtualFile)
  return module.exports.default
}

function renderer() {
  function node(type, text = '') { return { type, text, props: {}, children: [], parent: null } }
  function remove(child) {
    if (!child.parent) return
    const index = child.parent.children.indexOf(child)
    if (index >= 0) child.parent.children.splice(index, 1)
    child.parent = null
  }
  const host = vue.createRenderer({
    createElement: tag => node(tag), createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (element, text) => { element.text = text },
    setElementText: (element, text) => { element.text = text; element.children = [] },
    patchProp: (element, key, previous, next) => { element.props[key] = next },
    insert(child, parent, anchor) {
      remove(child)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(child)
      else parent.children.splice(index, 0, child)
      child.parent = parent
    },
    remove, parentNode: element => element.parent,
    nextSibling: element => element.parent?.children[element.parent.children.indexOf(element) + 1] ?? null,
  })
  return { host, container: node('container') }
}

async function componentTests(Panel) {
  const clock = scheduler()
  const savedTimeout = global.setTimeout
  const savedClearTimeout = global.clearTimeout
  const savedUni = global.uni
  global.setTimeout = clock.schedule
  global.clearTimeout = clock.cancel
  const queries = []
  global.uni = {
    createSelectorQuery() {
      let callback
      const query = {
        in(scope) { assert.ok(scope?.$el, '使用真实组件 proxy 作用域'); return query },
        select(selector) { assert.equal(selector, '.expand-content'); return query },
        boundingClientRect(receive) { callback = receive; return query },
        exec() { queries.push(callback); return query },
      }
      return query
    },
  }
  const open = vue.ref(false)
  const revision = vue.ref(0)
  const duration = vue.ref(200)
  const reducedProp = vue.ref(undefined)
  const reduced = vue.ref(false)
  const exposed = vue.ref(null)
  const { host, container } = renderer()
  const app = host.createApp({
    setup() {
      vue.provide('motionReduced', reduced)
      return () => vue.h(Panel, {
        ref: exposed, open: open.value, revision: revision.value, duration: duration.value,
        reduced: reducedProp.value, class: 'parent-colour', style: { color: 'red' },
      }, { default: () => [vue.h('view', { class: 'slot-child' }, 'retained data')] })
    },
  })
  const flush = async () => { await vue.nextTick(); await vue.nextTick() }
  const panel = () => container.children[0]
  const content = () => panel().children.find(child => child.type === 'view')
  const transition = (propertyName = 'height', own = true) => {
    const currentTarget = { dataset: { motionId: panel().props['data-motion-id'] } }
    panel().props.onTransitionend({ currentTarget, target: own ? currentTarget : { id: 'child' }, propertyName })
  }
  try {
    app.mount(container)
    await flush()
    assert.equal(content(), undefined, '初始关闭不渲染插槽')
    assert.equal(queries.length, 0)
    assert.ok(panel().props.class.includes('parent-colour'), '父级 class 自动透传')
    assert.equal(panel().props.style.color, 'red', '父级 style 自动透传')
    assert.equal(panel().props.style.height, '0px')

    open.value = true
    await flush()
    assert.ok(content())
    assert.equal(queries.length, 1, '初次打开仅测量一次')
    queries[0]({ height: 64 })
    await flush()
    assert.equal(panel().props.style.height, '64px')
    assert.equal(content().props.style.opacity, 1)
    transition()
    await flush()
    assert.equal(clock.pending().length, 0)

    open.value = false
    await flush()
    const staleCloseTimer = clock.latest()
    assert.ok(content(), '离场中 DOM 和子数据保留')
    assert.equal(panel().props.style.height, '0px')
    transition('height', false)
    transition('opacity')
    await flush()
    assert.ok(content(), '忽略冒泡和内层 opacity 结束')
    open.value = true
    await flush()
    clock.fire(staleCloseTimer)
    queries[1]({ height: 72 })
    await flush()
    assert.ok(content(), '重开后旧关闭回调无效')
    assert.equal(panel().props.style.height, '72px')

    revision.value++
    await flush()
    const staleQuery = queries.at(-1)
    exposed.value.refresh()
    await flush()
    staleQuery({ height: 999 })
    queries.at(-1)({ height: 88 })
    await flush()
    assert.equal(panel().props.style.height, '88px', 'revision / refresh 丢弃过期测量')

    revision.value++
    await flush()
    const durationStaleQuery = queries.at(-1)
    duration.value = 90
    await flush()
    durationStaleQuery({ height: 777 })
    queries.at(-1)({ height: 45 })
    await flush()
    assert.equal(panel().props.style.height, '45px')
    assert.equal(panel().props.style.transitionDuration, '90ms')

    revision.value++
    await flush()
    const closeStaleQuery = queries.at(-1)
    open.value = false
    await flush()
    closeStaleQuery({ height: 888 })
    await flush()
    assert.equal(panel().props.style.height, '0px', '关闭使在途测量失效')
    clock.fire(clock.latest())
    await flush()
    assert.equal(content(), undefined, '计时兜底移除内容')

    open.value = true
    await flush()
    const firstMissing = queries.length
    queries.at(-1)(null)
    await flush()
    assert.equal(queries.length, firstMissing + 1)
    queries.at(-1)(null)
    await flush()
    assert.equal(queries.length, firstMissing + 1, '最多两次布局查询，不轮询')
    exposed.value.refresh()
    await flush()
    queries.at(-1)({ height: 0 })
    await flush()
    assert.equal(panel().props.style.height, '0px', '空内容不强造非零高度')
    assert.equal(content().props.style.opacity, 1)

    open.value = false
    await flush()
    const reduceCloseTimer = clock.latest()
    reduced.value = true
    await flush()
    assert.equal(content(), undefined, '继承的 live reduced 立即完成关闭')
    assert.equal(clock.pending().length, 0)
    clock.fire(reduceCloseTimer)
    open.value = true
    await flush()
    queries.at(-1)({ height: 19 })
    await flush()
    reducedProp.value = false
    await flush()
    queries.at(-1)({ height: 20 })
    await flush()
    open.value = false
    await flush()
    const transitionCloseTimer = clock.latest()
    transition()
    await flush()
    assert.equal(content(), undefined, '自身 height 结束立即移除关闭内容')
    assert.equal(clock.pending().length, 0)
    clock.fire(transitionCloseTimer)
    reducedProp.value = undefined
    open.value = true
    await flush()
    queries.at(-1)({ height: 20 })
    await flush()
    assert.equal(panel().props.style.transitionDuration, '0ms')
    reducedProp.value = false
    await flush()
    queries.at(-1)({ height: 21 })
    await flush()
    assert.equal(panel().props.style.transitionDuration, '90ms', '显式 false 覆盖继承偏好')

    revision.value++
    await flush()
    const unmountQuery = queries.at(-1)
    open.value = false
    await flush()
    const unmountTimer = clock.latest()
    app.unmount()
    const queryCount = queries.length
    unmountQuery({ height: 1234 })
    clock.fire(unmountTimer)
    await flush()
    assert.equal(container.children.length, 0)
    assert.equal(queries.length, queryCount)
    assert.equal(clock.pending().length, 0, '卸载取消所有展示定时器')
  } finally {
    app.unmount()
    global.setTimeout = savedTimeout
    global.clearTimeout = savedClearTimeout
    global.uni = savedUni
  }
}

function composableTests() {
  const reduced = vue.ref(true)
  const scope = vue.effectScope()
  const motion = scope.run(() => useModalMotion(reduced))
  motion.open()
  assert.equal(motion.mounted.value, true)
  assert.equal(motion.closing.value, false)
  motion.close()
  assert.equal(motion.mounted.value, false)
  motion.show()
  motion.reset()
  assert.equal(motion.mounted.value, false)
  scope.stop()
  motion.open()
  assert.equal(motion.mounted.value, false, 'scope cleanup 后 API 不再激活')
}

export async function run() {
  controllerTests()
  composableTests()
  const Panel = compilePanel()
  await componentTests(Panel)
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await run()
  console.log('panel-motion: controller/composable/SFC focused checks passed')
}
