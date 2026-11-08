// Exact, versioned regression anchors. Historical comparisons are descriptive
// only: intentional six-color redesign is not an old +/-15% parity assertion.
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { runSim, RULE_VERSION, POLICY_VERSION, normalizeOptions, parseCli, historicalData, getCardCatalog, getRuleFingerprint, baselinePath, validateOrRecord } from './simulate.mjs'

const sum = values => values.reduce((total, value) => total + value, 0)
const increment = (object, key, amount = 1) => { object[key] = (object[key] ?? 0) + amount }
const sortObject = object => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, 'en')))
export function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.length ? sum(values) / values.length : 0
  const percentile = fraction => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] : 0
  return { sum: sum(values), mean, std: values.length ? Math.sqrt(sum(values.map(value => (value - mean) ** 2)) / values.length) : 0, min: sorted[0] ?? 0, median: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1) ?? 0 }
}
function metrics(snapshot) {
  return {
    gold: snapshot.player.gold, xp: snapshot.player.xp, level: snapshot.player.level,
    stagesCleared: snapshot.stagesCleared, stageReached: snapshot.terminal.stage,
    battleRounds: snapshot.battleStats.winningRounds, allBattleRounds: snapshot.battleStats.rounds,
    losingRounds: snapshot.battleStats.losingRounds, kills: snapshot.battleStats.kills,
    validTurns: snapshot.battleStats.turns, settledRounds: snapshot.battleStats.settledRounds,
    noLegalMoves: snapshot.battleStats.noLegalMoves, invalidSlides: snapshot.battleStats.invalidSlides,
    zeroDamageRounds: snapshot.battleStats.zeroDamageRounds, earlyEnds: snapshot.battleStats.earlyEnds,
    hp: snapshot.player.hp, maxHp: snapshot.stats.terminal.maxHp, hpLoss: snapshot.hp.loss, healing: snapshot.hp.healing,
    goldGained: snapshot.gold.gained, goldSpent: snapshot.gold.spent,
    cardCount: snapshot.cardCounts.total, uniqueCards: snapshot.cardCounts.unique,
    acquiredCards: sum(Object.values(snapshot.cardCounts.acquired)),
    equipmentCount: snapshot.inventory.equipmentIds.length, equippedCount: Object.values(snapshot.inventory.equipped).filter(Boolean).length,
    consumableCount: sum(Object.values(snapshot.inventory.consumables)), consumablesUsed: sum(Object.values(snapshot.inventory.consumed)),
    iterations: snapshot.iterations,
    ...Object.fromEntries(Object.entries(snapshot.cardCounts.byClass).map(([key, value]) => [`cards_${key}`, value])),
    ...Object.fromEntries(Object.entries(snapshot.stats.terminal).map(([key, value]) => [`stat_${key}`, value])),
    ...Object.fromEntries(Object.entries(snapshot.battleStats).filter(([, value]) => typeof value === 'number').map(([key, value]) => [`battle_${key}`, value])),
  }
}

export function summarizeResults(results) {
  const snapshots = results.map(result => result.snapshot)
  const allMetrics = snapshots.map(metrics)
  const summary = Object.fromEntries(Object.keys(allMetrics[0] ?? {}).map(key => [key, distribution(allMetrics.map(value => value[key]))]))
  const terminalCounts = {}, failures = [], phaseCounts = {}, stageCounts = {}, nodeCounts = {}, actions = {}, rewardPicks = {}, acquired = {}, removed = {}, hpSources = {}, goldSources = {}, cardSources = {}
  for (const snapshot of snapshots) {
    increment(terminalCounts, snapshot.terminal.valid ? snapshot.terminal.outcome : `INVALID:${snapshot.terminal.failure?.code ?? 'unknown'}`)
    increment(phaseCounts, `${snapshot.screen}:${snapshot.terminal.phase ?? 'null'}`)
    increment(stageCounts, snapshot.terminal.stage)
    if (!snapshot.terminal.valid) failures.push({ seed: snapshot.seed, terminal: snapshot.terminal })
    for (const [key, value] of Object.entries(snapshot.nodesVisited)) increment(nodeCounts, key, value)
    for (const [key, value] of Object.entries(snapshot.actions)) increment(actions, key, value)
    for (const [key, value] of Object.entries(snapshot.rewardPicks)) increment(rewardPicks, key, value)
    for (const [key, value] of Object.entries(snapshot.cardCounts.acquired)) increment(acquired, key, value)
    for (const [key, value] of Object.entries(snapshot.cardCounts.removed)) increment(removed, key, value)
    for (const [source, entries] of Object.entries(snapshot.cardCounts.sources)) for (const [id, count] of Object.entries(entries)) increment(cardSources[source] ??= {}, id, count)
    for (const [source, values] of Object.entries(snapshot.hp.sources)) for (const [key, value] of Object.entries(values)) increment(hpSources[source] ??= { healing: 0, loss: 0 }, key, value)
    for (const [source, values] of Object.entries(snapshot.gold.sources)) for (const [key, value] of Object.entries(values)) increment(goldSources[source] ??= { gained: 0, spent: 0 }, key, value)
  }
  const cardUsage = getCardCatalog().map(def => {
    const counts = snapshots.map(snapshot => snapshot.cards.find(card => card.id === def.id)?.count ?? 0)
    const offeredPicks = snapshots.map(snapshot => snapshot.cardCounts.acquired[def.id] ?? 0)
    return { ...def, acquired: acquired[def.id] ?? 0, acquiredRuns: offeredPicks.filter(count => count > 0).length, heldRuns: counts.filter(count => count > 0).length, terminalCounts: distribution(counts), removed: removed[def.id] ?? 0 }
  })
  return {
    numSeeds: snapshots.length, summary,
    terminal: { valid: snapshots.filter(snapshot => snapshot.terminal.valid).length, invalid: failures.length, outcomes: sortObject(terminalCounts), screensAndPhases: sortObject(phaseCounts), stagesReached: sortObject(stageCounts), victories: snapshots.filter(snapshot => snapshot.terminal.valid && snapshot.terminal.outcome === 'victory').length, deaths: snapshots.filter(snapshot => snapshot.terminal.valid && snapshot.terminal.outcome === 'defeat').length, reachedStage2: snapshots.filter(snapshot => snapshot.terminal.stage >= 2).length, reachedStage3: snapshots.filter(snapshot => snapshot.terminal.stage >= 3).length, reachedStage4: snapshots.filter(snapshot => snapshot.terminal.stage >= 4).length, failures },
    nodesVisited: sortObject(nodeCounts), actions: sortObject(actions), rewardPicks: sortObject(rewardPicks),
    hpSources: sortObject(hpSources), goldSources: sortObject(goldSources), cardSources: sortObject(cardSources), cardUsage,
  }
}

/** Every seed is replayed with the exact same options and fresh meta state.
 * Wall-clock measurements are excluded from the deterministic anchor. */
export function runSuite({ seedStart = 1, numSeeds = 200, options = {} } = {}) {
  if (!Number.isSafeInteger(seedStart) || !Number.isSafeInteger(numSeeds) || numSeeds < 1 || !Number.isSafeInteger(seedStart + numSeeds - 1)) throw new RangeError('Invalid seed range')
  const normalized = normalizeOptions(options)
  const results = [], timings = [], replayMismatches = []
  const started = performance.now()
  for (let seed = seedStart; seed < seedStart + numSeeds; seed++) {
    const result = runSim(seed, normalized)
    const replay = runSim(seed, normalized)
    if (result.hash !== replay.hash) replayMismatches.push({ seed, hash: result.hash, replayHash: replay.hash })
    results.push({ seed, hash: result.hash, snapshot: result.snapshot })
    timings.push(result.performance.elapsedMs, replay.performance.elapsedMs)
  }
  const totals = summarizeResults(results)
  return {
    ruleVersion: RULE_VERSION, policyVersion: POLICY_VERSION, metricVersion: 3,
    ruleFingerprint: getRuleFingerprint(), configuration: { seedStart, numSeeds, options: normalized },
    note: 'Bounded deterministic algorithm policy, fresh meta per seed. Not optimal play, human win rate, or a blanket balance approval. Zero-action and exhausted bounds are explicit invalid results, not deaths.',
    ...totals, determinism: { replayed: numSeeds, mismatches: replayMismatches }, results,
    performance: { totalElapsedMs: performance.now() - started, runs: numSeeds * 2, elapsedMsPerRun: distribution(timings) },
  }
}
export function suiteAnchor(report, historical = historicalData()) {
  const { performance: ignored, ...anchor } = report
  return { ...anchor, historicalFiles: historical.map(({ name, sha256 }) => ({ name, sha256 })) }
}
export function historicalComparison(report, historical = historicalData()) {
  return historical.filter(item => item.data.summary).map(item => ({
    file: item.name, sha256: item.sha256, note: 'Historical-only comparison: rules AND policy differ; no +/-15% pass/fail gate.',
    metrics: Object.fromEntries(Object.entries(item.data.summary).filter(([key]) => report.summary[key]).map(([key, previous]) => {
      const current = report.summary[key].mean
      return [key, { historicalMean: previous.mean, currentMean: current, absoluteDelta: current - previous.mean, percentDelta: previous.mean === 0 ? null : (current - previous.mean) / Math.abs(previous.mean) * 100 }]
    })),
  }))
}
export function printSuite(report, label = '') {
  const { configuration: c, summary: s, terminal: t } = report
  console.log(`\n${label} ${RULE_VERSION} ${c.options.strategy} seeds=${c.seedStart}..${c.seedStart + c.numSeeds - 1} maxStage=${c.options.maxStage}${c.options.syntheticStage ? ` SYNTHETIC stage ${c.options.syntheticStage} (not playable reachability)` : ''}`)
  console.log(`Terminal exact: ${JSON.stringify(t.outcomes)}; phases=${JSON.stringify(t.screensAndPhases)}; reached stages=${JSON.stringify(t.stagesReached)}; valid=${t.valid}/${report.numSeeds}; replay mismatches=${report.determinism.mismatches.length}`)
  for (const key of ['kills', 'allBattleRounds', 'validTurns', 'hp', 'maxHp', 'hpLoss', 'healing', 'gold', 'goldGained', 'goldSpent', 'level', 'xp', 'cardCount', 'cards_white', 'cards_blue', 'cards_gold', 'cards_red', 'cards_purple', 'cards_black', 'equipmentCount', 'equippedCount', 'consumablesUsed', 'stat_attackMultiplier', 'stat_defenseMultiplier', 'stat_flatAttack', 'stat_flatDefense', 'stat_baseSpeed', 'stat_maxTurns', 'noLegalMoves', 'invalidSlides', 'zeroDamageRounds', 'iterations']) {
    const value = s[key]
    console.log(`  ${key}: mean=${value.mean.toFixed(3)} min=${value.min} p95=${value.p95} max=${value.max} sum=${value.sum}`)
  }
  console.log(`HP sources=${JSON.stringify(report.hpSources)}`)
  console.log(`Gold sources=${JSON.stringify(report.goldSources)}`)
  console.log(`Card acquisitions=${JSON.stringify(Object.fromEntries(report.cardUsage.filter(card => card.acquired).map(card => [card.id, card.acquired])))}`)
  console.log(`Reward queue picks=${JSON.stringify(report.rewardPicks)}; nodes=${JSON.stringify(report.nodesVisited)}`)
  console.log(`Performance=${report.performance.totalElapsedMs.toFixed(1)}ms total; per-run median=${report.performance.elapsedMsPerRun.median.toFixed(2)}ms p95=${report.performance.elapsedMsPerRun.p95.toFixed(2)}ms`)
  for (const failure of t.failures) console.error(`FAILURE ${JSON.stringify(failure)}`)
  for (const mismatch of report.determinism.mismatches) console.error(`NONDETERMINISM ${JSON.stringify(mismatch)}`)
}
export function reportDigest(report) {
  return createHash('sha256').update(JSON.stringify(suiteAnchor(report))).digest('hex')
}
export function suiteValid(report) { return report.terminal.invalid === 0 && report.determinism.mismatches.length === 0 }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cli = parseCli(process.argv.slice(2))
  const historical = historicalData()
  const report = runSuite({ seedStart: cli.seedStart, numSeeds: cli.seeds, options: cli.options })
  const comparison = historicalComparison(report, historical)
  const validation = suiteValid(report) ? validateOrRecord(baselinePath('parity', report.configuration), suiteAnchor(report, historical), cli.mode) : { status: 'invalid-not-recorded' }
  if (cli.json) console.log(JSON.stringify({ ...report, historicalComparison: comparison, validation }, null, 2))
  else {
    printSuite(report)
    console.log(`\nBaseline ${validation.status}: ${validation.file ?? ''}`)
    if (validation.detail) console.log(validation.detail)
    for (const item of comparison) console.log(`Historical-only ${item.file}: ${JSON.stringify(item.metrics)}`)
    console.log('Intentional redesign: no old 15% gate. Measured algorithm rates are not human balance claims.')
  }
  if (!suiteValid(report) || ['missing', 'mismatch'].includes(validation.status)) process.exitCode = 1
}
