// Statistical balance check for the fixed first-node/cyclic-slide policy.
// Default is read-only verification. Historical rounds counted winning battles only.
import fs from 'node:fs'
import path from 'node:path'
import { runSim } from './simulate.mjs'

const NUM_SEEDS = 200
const mode = process.argv[2] || 'check'
if (!['check', 'after', 'before', 'record'].includes(mode)) throw new Error('Usage: node tools/parity.mjs [check|after|before|record]')

const results = []
for (let seed = 1; seed <= NUM_SEEDS; seed++) {
  const { snapshot, hash } = runSim(seed)
  const repeated = runSim(seed)
  if (hash !== repeated.hash) throw new Error(`Non-deterministic simulation for seed ${seed}`)
  results.push({
    seed,
    gold: snapshot.player.gold,
    xp: snapshot.player.xp,
    level: snapshot.player.level,
    stagesCleared: snapshot.stagesCleared,
    battleRounds: snapshot.battleStats.winningRounds,
    kills: snapshot.battleStats.kills,
    allBattleRounds: snapshot.battleStats.rounds,
    losingRounds: snapshot.battleStats.losingRounds,
    validTurns: snapshot.battleStats.turns,
  })
}

const summary = {}
for (const key of ['gold', 'xp', 'level', 'stagesCleared', 'battleRounds', 'kills', 'allBattleRounds', 'losingRounds', 'validTurns']) {
  const values = results.map(r => r[key])
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  summary[key] = { mean, std: Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length) }
}
const report = { mode: 'after', numSeeds: NUM_SEEDS, metricVersion: 2, note: 'battleRounds compares winning rounds only; allBattleRounds includes deaths. Fixed policy does not measure human win rate.', summary, results }
console.log(`\n=== Balance comparison (${NUM_SEEDS} seeds, each replayed) ===`)
for (const [key, value] of Object.entries(summary)) console.log(`  ${key}: mean=${value.mean.toFixed(3)} std=${value.std.toFixed(3)}`)
console.log('Repeat-seed determinism and terminal-state validation: PASS')

if (mode === 'record') {
  const output = path.join(import.meta.dirname, 'parity-after.json')
  fs.writeFileSync(output, JSON.stringify(report, null, 2), 'utf8')
  console.log('Recorded the reviewed after-change metrics.')
}
if (mode === 'before') console.log('The historical before-change file is preserved; this command never overwrites it.')

const before = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'parity-before.json'), 'utf8'))
console.log('\n=== Historical baseline → current (comparable metrics) ===')
let withinThreshold = true
for (const [key, baseline] of Object.entries(before.summary)) {
  const current = summary[key].mean
  const delta = baseline.mean === 0 ? (current === 0 ? 0 : Infinity) : (current - baseline.mean) / Math.abs(baseline.mean) * 100
  const okay = Math.abs(delta) < 15
  withinThreshold &&= okay
  console.log(`  ${key}: ${baseline.mean.toFixed(3)} → ${current.toFixed(3)} (Δ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%) ${okay ? 'OK' : 'EXCEEDS 15%'}`)
}
console.log(`Comparable balance metrics (|Δmean| <15%): ${withinThreshold ? 'PASS' : 'FAIL'}`)
if (!withinThreshold) process.exitCode = 1
if (mode !== 'record') {
  const expected = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'parity-after.json'), 'utf8'))
  if (expected.metricVersion !== 2 || JSON.stringify(expected.results) !== JSON.stringify(results)) {
    console.error('Recorded after-change metrics differ. Review differences before running parity.mjs record.')
    process.exitCode = 1
  } else console.log('Recorded after-change metrics: PASS')
}
