// run-tests.mjs — Simple sequential test runner
// Discovers tools/tests/*.mjs, runs each test file's run() export,
// reports PASS/FAIL per file, exits non-zero on any failure.

import fs from 'node:fs';
import path from 'node:path';

const TESTS_DIR = path.resolve(import.meta.dirname, 'tests');

async function main() {
  if (!fs.existsSync(TESTS_DIR)) {
    console.error(`Tests directory not found: ${TESTS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.mjs'))
    .sort();

  if (files.length === 0) {
    console.log('No test files found.');
    process.exit(0);
  }

  let total = 0;
  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(TESTS_DIR, file);
    total++;
    try {
      // Convert Windows path to file:// URL for ESM dynamic import
      const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');
      const mod = await import(fileUrl);
      if (typeof mod.run !== 'function') {
        console.log(`SKIP  ${file}  (no run() export)`);
        continue;
      }
      await mod.run();
      console.log(`PASS  ${file}`);
      passed++;
    } catch (err) {
      console.log(`FAIL  ${file}`);
      console.log(`      ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`${failed} FAILED`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Runner error:', err.message);
  process.exit(1);
});
