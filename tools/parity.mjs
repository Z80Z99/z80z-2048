// parity.mjs — Statistical parity check for W2 Step 7 (seeded battle RNG).
// Runs seeds 1..200, collects per-run metrics, writes parity-<mode>.json,
// and when mode=after prints a before/after mean comparison.
//
// Usage:
//   node tools/parity.mjs before   # collect BEFORE the rng wiring
//   node tools/parity.mjs after    # collect AFTER the rng wiring + compare

import fs from 'node:fs';
import path from 'node:path';
import { runSim } from './simulate.mjs';

const NUM_SEEDS = 200;
const OUT_DIR = import.meta.dirname;

function collectMetrics() {
  const results = [];
  for (let seed = 1; seed <= NUM_SEEDS; seed++) {
    const { snapshot } = runSim(seed);
    results.push({
      seed,
      gold: snapshot.player.gold,
      xp: snapshot.player.xp,
      level: snapshot.player.level,
      stagesCleared: snapshot.stagesCleared,
      battleRounds: snapshot.battleStats.rounds,
      kills: snapshot.battleStats.kills,
    });
  }
  return results;
}

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
}

function summarize(results) {
  const keys = ['gold', 'xp', 'level', 'stagesCleared', 'battleRounds', 'kills'];
  const summary = {};
  for (const k of keys) {
    const vals = results.map(r => r[k]);
    summary[k] = { mean: mean(vals), std: std(vals) };
  }
  return summary;
}

const mode = process.argv[2] || 'before';
const results = collectMetrics();
const summary = summarize(results);

const outFile = path.resolve(OUT_DIR, `parity-${mode}.json`);
fs.writeFileSync(outFile, JSON.stringify({ mode, numSeeds: NUM_SEEDS, summary, results }, null, 2), 'utf8');

console.log(`\n=== Parity ${mode} (${NUM_SEEDS} seeds) ===`);
for (const [k, v] of Object.entries(summary)) {
  console.log(`  ${k}: mean=${v.mean.toFixed(3)} std=${v.std.toFixed(3)}`);
}

// If after-mode and before file exists, print comparison
if (mode === 'after') {
  const beforeFile = path.resolve(OUT_DIR, 'parity-before.json');
  if (fs.existsSync(beforeFile)) {
    const beforeSummary = JSON.parse(fs.readFileSync(beforeFile, 'utf8')).summary;
    console.log(`\n=== Comparison (before → after) ===`);
    let allOk = true;
    for (const k of Object.keys(beforeSummary)) {
      const bm = beforeSummary[k].mean;
      const am = summary[k].mean;
      const relDelta = bm === 0 ? (am === 0 ? 0 : Infinity) : ((am - bm) / Math.abs(bm)) * 100;
      const ok = Math.abs(relDelta) < 15;
      if (!ok) allOk = false;
      const sign = relDelta >= 0 ? '+' : '';
      console.log(`  ${k}: ${bm.toFixed(3)} → ${am.toFixed(3)}  (Δ${sign}${relDelta.toFixed(2)}%)  ${ok ? 'OK' : 'EXCEEDS 15%'}`);
    }
    console.log(`\nAcceptance (each metric |Δmean| < 15%): ${allOk ? 'PASS' : 'FAIL'}`);
  }
}