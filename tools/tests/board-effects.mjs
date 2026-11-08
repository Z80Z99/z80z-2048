import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const {
    BOARD_MOVE_MS, BOARD_IMPACT_MS, MAX_TRAIL_ECHOES, MAX_IMPACT_NODES,
    buildBoardRenderPlan, copyBoardGrid, createBoardEffectScheduler, formatAttackGain, slideAttackDelta,
  } = loadProject('./utils/boardEffects')
  let id = 1
  const cell = (value, flags = {}) => ({ id: id++, value, isNew: false, isMerged: false, ...flags })
  const blank = () => Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => cell(0)))
  const clone = grid => structuredClone(grid)
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    return value
  }
  const keys = plan => [
    ...plan.echoes.map(echo => echo.key), ...plan.impacts.map(impact => impact.key),
    ...plan.impacts.flatMap(impact => impact.decorations.map(bit => bit.key)), ...(plan.edgeKey ? [plan.edgeKey] : []),
  ]
  const assertBudget = plan => {
    assert.ok(plan.echoes.length <= MAX_TRAIL_ECHOES)
    assert.ok(plan.decorativeNodeCount <= MAX_IMPACT_NODES)
    assert.equal(plan.decorativeNodeCount, plan.impacts.reduce((n, impact) => n + impact.decorations.length, plan.edgeKey ? 1 : 0))
    assert.equal(new Set(keys(plan)).size, keys(plan).length)
    for (const echo of plan.echoes) {
      assert.ok(echo.index === 0 || echo.index === 1)
      assert.equal('cell' in echo, false, 'echoes have no game cells')
      assert.equal('text' in echo, false, 'echoes have no number labels')
    }
  }

  assert.equal(BOARD_MOVE_MS, 150)
  assert.equal(BOARD_IMPACT_MS, 280)
  for (const [direction, from, to] of [
    ['left', [1, 3], [1, 0]], ['right', [1, 0], [1, 3]],
    ['up', [3, 1], [0, 1]], ['down', [0, 1], [3, 1]],
  ]) {
    const previous = blank()
    const next = blank()
    const moving = cell(8)
    const stationary = cell(32)
    const spawned = cell(2, { isNew: true })
    previous[from[0]][from[1]] = moving
    next[to[0]][to[1]] = moving
    previous[2][2] = stationary
    next[2][2] = stationary
    next[3][3] = spawned
    const plan = buildBoardRenderPlan(previous, next, 1)
    assert.equal(plan.moving, true, direction)
    assert.equal(plan.echoes.length, 2, `${direction}: only the actual moving tile trails`)
    assert.equal(plan.impacts.length, 0)
    assert.equal(plan.tiles.find(tile => tile.cell.id === spawned.id).pending, true, 'spawn waits for convergence')
    assert.equal(plan.tiles.find(tile => tile.cell.id === stationary.id).pending, false)
    for (const echo of plan.echoes) {
      assert.deepEqual(echo.from, { row: from[0], col: from[1] })
      assert.equal(echo.value, 8)
      if (direction === 'left') assert.ok(echo.to.col > to[1] && echo.to.col < from[1])
      if (direction === 'right') assert.ok(echo.to.col < to[1] && echo.to.col > from[1])
      if (direction === 'up') assert.ok(echo.to.row > to[0] && echo.to.row < from[0])
      if (direction === 'down') assert.ok(echo.to.row < to[0] && echo.to.row > from[0])
    }
    assertBudget(plan)
    const motionless = buildBoardRenderPlan(previous, next, 2, true)
    assert.equal(motionless.moving, false)
    assert.equal(motionless.tiles.some(tile => tile.pending || tile.leaving), false)
    assert.deepEqual(keys(motionless), [])
  }

  const stationaryGrid = blank()
  stationaryGrid[0][0] = cell(16)
  const unchanged = buildBoardRenderPlan(stationaryGrid, clone(stationaryGrid), 3)
  assert.equal(unchanged.moving, false)
  assert.equal(unchanged.echoes.length, 0)
  const initial = buildBoardRenderPlan([], stationaryGrid, 4)
  assert.equal(initial.moving, false)
  assert.deepEqual(keys(initial), [])

  const mergeFixture = (values, direction = 'left') => {
    const previous = blank()
    const next = blank()
    for (const [index, value] of values.entries()) {
      const row = Math.floor(index / 2)
      const col = (index % 2) * 2
      const a = cell(value / 2)
      const b = cell(value / 2)
      let sourceA = [row, col]
      let sourceB = [row, col + 1]
      let target = [row, index % 2]
      if (direction === 'right') {
        sourceA = [row, 3 - col]; sourceB = [row, 2 - col]; target = [row, 3 - index % 2]
      } else if (direction === 'up') {
        sourceA = [col, row]; sourceB = [col + 1, row]; target = [index % 2, row]
      } else if (direction === 'down') {
        sourceA = [3 - col, row]; sourceB = [2 - col, row]; target = [3 - index % 2, row]
      }
      previous[sourceA[0]][sourceA[1]] = a
      previous[sourceB[0]][sourceB[1]] = b
      next[target[0]][target[1]] = cell(value, { isMerged: true, mergedFrom: [a.id, b.id] })
    }
    return { previous, next }
  }

  for (const direction of ['left', 'right', 'up', 'down']) {
    const { previous, next } = mergeFixture(Array(8).fill(512), direction)
    const beforeText = JSON.stringify({ previous, next })
    const plan = buildBoardRenderPlan(freeze(previous), freeze(next), 11)
    assert.equal(plan.impacts.length, 8, `${direction}: all simultaneous merges receive impact`)
    assert.equal(plan.tiles.filter(tile => tile.pending).length, 8)
    const ghosts = plan.tiles.filter(tile => tile.leaving)
    assert.equal(ghosts.length, 16, 'existing source ghosts are reused, not a second Tile declaration')
    assert.equal(new Set(plan.tiles.map(tile => tile.cell.id)).size, plan.tiles.length)
    assert.ok(ghosts.every(tile => !tile.cell.isMerged && !tile.cell.isNew))
    assert.equal(plan.impacts.filter(impact => impact.tier === 'strong').length, 2)
    assert.equal(plan.impacts.filter(impact => impact.tier === 'chips').length, 4)
    assert.equal(plan.decorativeNodeCount, 63, 'eight full impacts plus edge fit the global cap')
    assert.ok(plan.edgeKey)
    assert.equal(plan.echoes.length, 24, 'stationary merge sources get no echoes')
    assertBudget(plan)
    assert.equal(JSON.stringify({ previous, next }), beforeText, 'frozen input is mutation free')
    assert.notEqual(plan.tiles[0].cell, next[plan.tiles[0].row][plan.tiles[0].col])
    assert.notEqual(plan.tiles[0].cell.mergedFrom, next[plan.tiles[0].row][plan.tiles[0].col].mergedFrom)
    const replay = buildBoardRenderPlan(previous, next, 12)
    assert.ok(keys(replay).every(key => !new Set(keys(plan)).has(key)), 'revision creates fresh decorative keys')
  }

  const tiers = mergeFixture([4, 8, 16, 32, 64, 128, 256, 1024])
  const tierPlan = buildBoardRenderPlan(tiers.previous, tiers.next, 20)
  assert.deepEqual(tierPlan.impacts.map(impact => impact.tier), ['small', 'small', 'ring', 'ring', 'chips', 'chips', 'strong', 'strong'])
  for (const impact of tierPlan.impacts) {
    assert.equal(impact.decorations.filter(bit => bit.kind === 'flash').length, 1)
    assert.equal(impact.decorations.filter(bit => bit.kind === 'streak').length, 4)
    assert.equal(impact.decorations.filter(bit => bit.kind === 'ring').length, impact.tier === 'small' ? 0 : impact.tier === 'strong' ? 2 : 1)
    assert.equal(impact.decorations.filter(bit => bit.kind === 'chip').length, ['chips', 'strong'].includes(impact.tier) ? 2 : 0)
  }
  assertBudget(tierPlan)
  const strongest = mergeFixture([256, 512, 2048, 1024])
  const strongestPlan = buildBoardRenderPlan(strongest.previous, strongest.next, 21)
  assert.deepEqual(strongestPlan.impacts.filter(impact => impact.tier === 'strong').map(impact => impact.value), [2048, 1024])
  const belowEdge = mergeFixture([128])
  assert.equal(buildBoardRenderPlan(belowEdge.previous, belowEdge.next, 22).edgeKey, null)

  const densePrevious = blank()
  const denseNext = blank()
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) densePrevious[r][c] = cell(2 ** (r + c + 1))
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) denseNext[r][3 - c] = densePrevious[r][c]
  const capped = buildBoardRenderPlan(densePrevious, denseNext, 23)
  assert.equal(capped.echoes.length, 32, 'two echoes per tile and at most 32 total')
  assertBudget(capped)
  const stale = clone(tiers.next)
  const stalePlan = buildBoardRenderPlan(tiers.next, stale, 24)
  assert.deepEqual(keys(stalePlan), [], 'stale merge flags never replay impacts')
  const itemNext = clone(stationaryGrid)
  itemNext[0][0] = { ...itemNext[0][0], value: 32, isMerged: true }
  assert.deepEqual(keys(buildBoardRenderPlan(stationaryGrid, itemNext, 25)), [], 'item number changes are not merges')
  const cloneGrid = copyBoardGrid(tiers.next)
  cloneGrid[0][0].mergedFrom.push(-1)
  assert.equal(tiers.next[0][0].mergedFrom.includes(-1), false, 'snapshot owns its mergedFrom arrays')

  const beforeAttack = { nodeId: 'battle-1', round: 3, turnsUsed: 4, totalAttack: 100 }
  const afterAttack = { ...beforeAttack, turnsUsed: 5, totalAttack: 164 }
  assert.equal(slideAttackDelta(beforeAttack, afterAttack, true), 64, 'float shows actual aggregate attack delta')
  assert.equal(slideAttackDelta(beforeAttack, afterAttack, false), 0, 'invalid or spectator updates have no float')
  assert.equal(slideAttackDelta(beforeAttack, { ...afterAttack, round: 4 }, true), 0)
  assert.equal(slideAttackDelta(beforeAttack, { ...afterAttack, nodeId: 'battle-2' }, true), 0)
  assert.equal(slideAttackDelta(beforeAttack, { ...afterAttack, turnsUsed: 4 }, true), 0, 'item/stat update is not SLIDE')
  assert.equal(slideAttackDelta(beforeAttack, { ...afterAttack, totalAttack: 100 }, true), 0)
  assert.equal(slideAttackDelta(beforeAttack, { ...afterAttack, totalAttack: 40 }, true), 0)
  assert.equal(slideAttackDelta(beforeAttack, { ...afterAttack, totalAttack: NaN }, true), 0)
  // 浮点蓄力的尾巴不能出现在浮字上：17.000000000000005 显示为 17，真小数保留两位。
  assert.equal(formatAttackGain(17.000000000000005), 17)
  assert.equal(formatAttackGain(4.761904761904762), 4.76)
  assert.equal(formatAttackGain(0), 0)
  assert.equal(formatAttackGain(Number.NaN), 0)
  assert.equal(Number.isInteger(formatAttackGain(12.000000000000002)), true)

  const clock = () => {
    let now = 0
    let timerId = 0
    const jobs = new Map()
    const all = []
    return {
      get count() { return jobs.size },
      get callbacks() { return all },
      install(callback, ms) { const handle = ++timerId; jobs.set(handle, { at: now + ms, callback }); all.push(callback); return handle },
      cancel(handle) { jobs.delete(handle) },
      advance(ms) {
        const until = now + ms
        while (true) {
          const due = [...jobs.entries()].filter(([, job]) => job.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
          if (!due) break
          jobs.delete(due[0]); now = due[1].at; due[1].callback()
        }
        now = until
      },
    }
  }
  const time = clock()
  const scheduler = createBoardEffectScheduler(time.install, time.cancel)
  const events = []
  scheduler.schedule(BOARD_MOVE_MS, () => {
    events.push('converged')
    scheduler.schedule(BOARD_IMPACT_MS, () => events.push('impact-cleared'))
  })
  time.advance(149)
  assert.deepEqual(events, [])
  time.advance(1)
  assert.deepEqual(events, ['converged'], '150ms gate is independent of 280ms impact')
  time.advance(279)
  assert.deepEqual(events, ['converged'])
  time.advance(1)
  assert.deepEqual(events, ['converged', 'impact-cleared'])

  // 第 50ms 实时开启减弱动态：取消移动、冲击及延迟漂字，不等输入门结束。
  const prefTime = clock()
  const prefScheduler = createBoardEffectScheduler(prefTime.install, prefTime.cancel)
  let moving = true
  let transient = true
  let reduced = false
  prefScheduler.schedule(BOARD_MOVE_MS, () => { transient = true; moving = false })
  prefTime.advance(50)
  reduced = true
  prefScheduler.clear(); moving = false; transient = false
  const prefPlan = buildBoardRenderPlan(tiers.previous, tiers.next, 30, reduced)
  assert.equal(prefTime.count, 0)
  assert.equal(prefPlan.moving, false)
  assert.deepEqual(keys(prefPlan), [])
  prefTime.callbacks.forEach(callback => callback())
  prefTime.advance(1000)
  assert.equal(moving, false)
  assert.equal(transient, false, 'stale timer cannot restore transients after live preference change')
  reduced = false
  assert.ok(buildBoardRenderPlan(tiers.previous, tiers.next, 31, reduced).moving)

  const cancelTime = clock()
  const cancelScheduler = createBoardEffectScheduler(cancelTime.install, cancelTime.cancel)
  const cancelEvents = []
  cancelScheduler.schedule(150, () => cancelEvents.push('old move'))
  cancelScheduler.schedule(280, () => cancelEvents.push('old impact'))
  cancelScheduler.clear()
  cancelScheduler.schedule(150, () => cancelEvents.push('new move'))
  cancelTime.callbacks.slice(0, 2).forEach(callback => callback())
  cancelTime.advance(150)
  assert.deepEqual(cancelEvents, ['new move'], 'next valid move replaces old timer tokens')
  cancelScheduler.schedule(650, () => cancelEvents.push('unmounted float'))
  cancelScheduler.clear()
  cancelTime.callbacks.at(-1)()
  cancelTime.advance(1000)
  assert.deepEqual(cancelEvents, ['new move'], 'unmount/context cancellation invalidates stale callbacks')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run()
  console.log('board-effects: all focused checks passed')
}
