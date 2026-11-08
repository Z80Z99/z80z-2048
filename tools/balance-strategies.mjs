// Multi-policy checkpoint + disjoint holdout. Defaults are read-only; use
// `record` only after reviewing reports and confirming final integration.
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { runSim, STRATEGIES, RULE_VERSION, POLICY_VERSION, parseCli, predictDirections, chooseDirection, historicalData, baselinePath, validateOrRecord, getCardCatalog } from './simulate.mjs'
import { runSuite, printSuite, suiteAnchor, suiteValid } from './parity.mjs'
import { loadProject } from './harness.mjs'

export function runSmoke() {
  const checks = []
  const grid = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]].map((row, r) => row.map((value, c) => ({ value, id: r * 4 + c + 1, isNew: false, isMerged: false })))
  const before = JSON.stringify(grid), random = Math.random, now = Date.now
  const predictions = predictDirections(grid)
  assert.equal(JSON.stringify(grid), before)
  assert.equal(predictions.find(result => result.direction === 'left').mergedSum, 4)
  const invalidFirst = [[2, 0, 0, 0], [4, 0, 0, 0], [8, 0, 0, 0], [16, 0, 0, 0]].map((row, r) => row.map((value, c) => ({ value, id: r * 4 + c + 1, isNew: false, isMerged: false })))
  assert.equal(chooseDirection(invalidFirst, 0, 'baseline'), 'right')
  const full = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ({ value: (r + c) % 2 ? 2 : 4, id: r * 4 + c + 1, isNew: false, isMerged: false })))
  assert.equal(chooseDirection(full), null)
  checks.push('value-only direction prediction leaves live grid unchanged; skips invalid directions; detects no legal moves')
  for (const strategy of STRATEGIES) {
    const first = runSim(1, { strategy }), replay = runSim(1, { strategy })
    assert.equal(first.hash, replay.hash)
    assert.equal(first.snapshot.terminal.valid, true, JSON.stringify(first.snapshot.terminal.failure))
    assert.equal(first.snapshot.battleStats.invalidSlides, 0)
    assert.equal(first.snapshot.hp.accountingResidual, 0)
    assert.equal(first.snapshot.gold.accountingResidual, 0)
  }
  checks.push('all five policies complete and replay deterministically with exact HP/gold accounting')
  assert.equal(Math.random, random); assert.equal(Date.now, now)
  checks.push('global Math.random and Date.now untouched')
  assert.equal(runSim(1, { maxIterations: 1 }).snapshot.terminal.failure.code, 'iteration_limit')
  assert.equal(runSim(1, { maxBattleRounds: 1 }).snapshot.terminal.failure.code, 'battle_round_limit')
  assert.equal(runSim(1, { maxValidTurns: 1 }).snapshot.terminal.failure.code, 'turn_limit')
  assert.throws(() => runSim(1, { maxIterations: 1, throwOnFailure: true }), /iteration_limit/)
  checks.push('iteration, battle-round, valid-turn limits return explicit failures and optional throw')
  const synthetic = runSim(7, { strategy: 'attack', syntheticStage: 4, maxStage: 4 })
  assert.equal(synthetic.snapshot.terminal.valid, true, JSON.stringify(synthetic.snapshot.terminal.failure))
  assert.match(synthetic.snapshot.scenario, /SYNTHETIC/)
  assert.equal(synthetic.snapshot.terminal.stage, 4)
  assert.equal(synthetic.snapshot.terminal.debugActionCount, 0)
  checks.push('explicit synthetic procedural stage4 fixture with debug disabled; no claim of reachable play')

  // API fixtures are synthetic, not counted in normal/holdout metrics.
  const pinia = createRequire(import.meta.url)('pinia')
  const { useGameStore } = loadProject('./store/gameStore')
  const { cardById } = loadProject('./core/upgrade')
  const p = pinia.createPinia(); pinia.setActivePinia(p)
  const store = useGameStore(p)
  try {
    store.START_RUN(9)
    store.screen = 'rest'; store.player.hp = 10
    store.GO_TO_ROUTE(); assert.equal(store.screen, 'route', 'unused campfire can be left')
    store.screen = 'rest'
    store.REST_HEAL(); assert.equal(store.restUsed, true); assert.equal(store.player.hp, 40)
    store.GO_TO_ROUTE(); assert.equal(store.screen, 'route')
    // 营地只治疗；紫卡净化走奇遇（cleansing_hermit）。
    store.screen = 'event'
    store.player.gold = 100
    store.upgrades = [{ def: cardById('curse_burn'), count: 2 }]
    store.gameEvent = { id: 'cleansing_hermit', title: 'fixture', icon: '', desc: '', stageMin: 2, choices: [{ label: 'cleanse', effect: { type: 'card_trade', grants: [], cost: 40, gold: 0, hpCost: 0, removesPurple: 1 } }, { label: 'leave', effect: { type: 'none' } }] }
    store.RESOLVE_EVENT(0)
    assert.ok(store.eventResult, 'hermit cleanse resolves with purple held')
    store.APPLY_EVENT()
    assert.equal(store.upgrades[0]?.count, 1, 'event cleanse removed one purple layer')
    assert.equal(store.player.gold, 60, 'cleanse cost deducted')
    store.START_RUN(9)
    store.rewardQueue = [{ reason: 'levelup' }, { reason: 'elite', allowedClasses: ['blue', 'gold'] }]
    store._showNextReward()
    let generation = store.rewardRollCount
    let id = store.rewardChoices.find(card => card.kind === 'persistent').id
    store.PICK_UPGRADE(id, generation - 1); assert.equal(store.rewardQueue.length, 2)
    store.PICK_UPGRADE(id, generation); assert.equal(store.rewardQueue.length, 1); assert.equal(store.screen, 'reward')
    generation = store.rewardRollCount; id = store.rewardChoices[0].id
    store.PICK_UPGRADE(id, generation); assert.equal(store.rewardQueue.length, 0); assert.equal(store.screen, 'route')
    assert.equal(store.upgrades.reduce((total, card) => total + card.count, 0), 2)
    store.screen = 'event'
    store.gameEvent = { id: 'synthetic-black', title: 'fixture', icon: '', desc: '', choices: [{ label: 'accept', effect: { type: 'card_trade', grants: [{ id: 'doom_soul', count: 1 }], cost: 0, gold: 0, hpCost: 0 } }, { label: 'leave', effect: { type: 'none' } }] }
    store.RESOLVE_EVENT(0)
    assert.equal(store.eventResult.requiresBlackConfirmation, true)
    store.APPLY_EVENT(); assert.equal(store.screen, 'event'); assert.equal(store.upgrades.some(card => card.def.cardClass === 'black'), false)
    store.CONFIRM_BLACK_EVENT(); store.APPLY_EVENT()
    assert.equal(store.screen, 'route'); assert.equal(store.upgrades.some(card => card.def.id === 'doom_soul'), true)
    checks.push('synthetic API fixtures: rest one-time action with early leave, event cleanse one purple layer, id-based queued picks/stale generation guard, explicit black confirm-before-apply')
  } finally { store.$dispose(); p._e.stop() }
  return { pass: true, checks }
}

export function runStrategies({ seedStart = 1, numSeeds = 200, holdoutStart = 301, holdoutCount = 50, policies = STRATEGIES, options = {} } = {}) {
  if (holdoutCount && Math.max(seedStart, holdoutStart) <= Math.min(seedStart + numSeeds - 1, holdoutStart + holdoutCount - 1)) throw new RangeError('Training and holdout seeds must be disjoint')
  const reports = []
  for (const strategy of policies) {
    reports.push({ policy: strategy, cohort: 'checkpoint', report: runSuite({ seedStart, numSeeds, options: { ...options, strategy } }) })
    if (holdoutCount) reports.push({ policy: strategy, cohort: 'holdout', report: runSuite({ seedStart: holdoutStart, numSeeds: holdoutCount, options: { ...options, strategy } }) })
  }
  return { ruleVersion: RULE_VERSION, policyVersion: POLICY_VERSION, note: 'Simple weighted algorithm policies; no tuning against holdout, no optimal/human or blanket-balanced claim. Full snapshots retained for every seed; replay and terminal failures are never silently dropped.', reports }
}
function printTable(reports) {
  console.log('\nPolicy | cohort | n | victory | death | invalid | >=stage2 | kills mean | rounds mean | turns mean | HP loss mean | heal mean | gold mean | cards mean | invalid slides sum')
  for (const { policy, cohort, report } of reports) {
    const s = report.summary, t = report.terminal
    console.log(`${policy} | ${cohort} | ${report.numSeeds} | ${t.victories} | ${t.deaths} | ${t.invalid} | ${t.reachedStage2} | ${s.kills.mean.toFixed(3)} | ${s.allBattleRounds.mean.toFixed(3)} | ${s.validTurns.mean.toFixed(3)} | ${s.hpLoss.mean.toFixed(3)} | ${s.healing.mean.toFixed(3)} | ${s.gold.mean.toFixed(3)} | ${s.cardCount.mean.toFixed(3)} | ${s.invalidSlides.sum}`)
  }
  console.log('\nCard id | class/kind | effect(s) | ' + reports.map(item => `${item.policy}/${item.cohort} acquired`).join(' | '))
  for (const card of getCardCatalog()) {
    console.log(`${card.id} | ${card.cardClass}/${card.kind} | ${card.effects.map(effect => `${effect.type}=${effect.value}(${effect.polarity})`).join(', ')} | ${reports.map(item => item.report.cardUsage.find(usage => usage.id === card.id).acquired).join(' | ')}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cli = parseCli(process.argv.slice(2))
  if (cli.smoke) console.log(JSON.stringify(runSmoke(), null, 2))
  else {
    const historical = historicalData()
    const output = runStrategies({ seedStart: cli.seedStart, numSeeds: cli.seeds, holdoutStart: cli.holdoutStart, holdoutCount: cli.holdoutCount, policies: cli.policies, options: cli.options })
    const valid = output.reports.every(item => suiteValid(item.report))
    const configuration = { seedStart: cli.seedStart, numSeeds: cli.seeds, holdoutStart: cli.holdoutStart, holdoutCount: cli.holdoutCount, policies: cli.policies, options: cli.options }
    const anchor = { ruleVersion: RULE_VERSION, policyVersion: POLICY_VERSION, configuration, note: output.note, reports: output.reports.map(item => ({ ...item, report: suiteAnchor(item.report, historical) })) }
    const validation = valid ? validateOrRecord(baselinePath('balance', configuration), anchor, cli.mode) : { status: 'invalid-not-recorded' }
    if (cli.json) console.log(JSON.stringify({ ...output, validation }, null, 2))
    else {
      for (const item of output.reports) printSuite(item.report, item.cohort)
      printTable(output.reports)
      console.log(`\nBaseline ${validation.status}: ${validation.file ?? ''}`)
      if (validation.detail) console.log(validation.detail)
      console.log('Historical artifacts byte-preserved. Rates describe the named algorithm only; stage4 synthetic runs must be reported separately.')
    }
    if (!valid || ['missing', 'mismatch'].includes(validation.status)) process.exitCode = 1
  }
}
