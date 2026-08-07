// harness.mjs — CJS loader for the Z80Z TypeScript project
// Transpiles .ts files via typescript.transpileModule → CommonJS,
// resolves extension-less relative imports to .ts / index.ts,
// and falls back to node_modules for bare specifiers ('pinia', 'vue', etc.).
//
// RESULT: Real pinia + vue loading WORKS on Node 24 with the project's
// node_modules. No shim needed. createPinia() + setActivePinia() +
// useGameStore() all instantiate correctly under CJS.

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import * as ts from 'typescript';

// ── Project root ──────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');

// ── global.uni stub (MUST be installed before any store module loads) ──
// storage.ts references uni.getStorageSync / uni.setStorageSync inside
// function bodies, so they are only called at runtime — but the stub
// must exist when the module is first required.
if (!global.__z80zUniStubInstalled) {
  global.uni = {
    getStorageSync: () => '',
    setStorageSync: () => {},
    // Any additional uni members referenced in project code go here.
  };
  global.__z80zUniStubInstalled = true;
}

// ── Resolver: extension-less .ts imports ──────────────────────────
const _builtinResolve = Module._resolveFilename;

Module._resolveFilename = function (specifier, parent, isMain, options) {
  // Bare specifiers: delegate to native node_modules resolution
  if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) {
    return _builtinResolve.apply(this, arguments);
  }

  const dir = parent && parent.filename
    ? path.dirname(parent.filename)
    : PROJECT_ROOT;

  let resolved = path.resolve(dir, specifier);

  // Try specifier.ts
  const asTs = resolved + '.ts';
  if (fs.existsSync(asTs)) {
    return _builtinResolve.call(this, asTs, parent, isMain, options);
  }

  // Try specifier/index.ts
  const asIndex = path.join(resolved, 'index.ts');
  if (fs.existsSync(asIndex)) {
    return _builtinResolve.call(this, asIndex, parent, isMain, options);
  }

  // Fallback: let Node try its own resolution
  return _builtinResolve.apply(this, arguments);
};

// ── Transpilation: .ts → CJS ─────────────────────────────────────
// TS5 type-only imports (import type { ... }) are elided by default
// when transpiling to CommonJS.  This means loading store/gameStore.ts
// does NOT require ../types at runtime — proven by the characterization
// tests below.
if (!Module._extensions['.ts']) {
  Module._extensions['.ts'] = function (mod, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const result = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: filename,
    });
    mod._compile(result.outputText, filename);
  };
}

// ── Public API ────────────────────────────────────────────────────
const _require = createRequire(import.meta.url);

/**
 * Load a project TypeScript module by its import specifier
 * (relative to the project root).  Returns the module's exports.
 *
 * Example:
 *   loadProject('./store/gameStore')   // returns { useGameStore }
 *   loadProject('./core/random')       // returns { createRng, ... }
 */
export function loadProject(specifier) {
  // Resolve relative to project root, then require the absolute path.
  // The patched resolver will add .ts / index.ts as needed.
  const abs = path.resolve(PROJECT_ROOT, specifier);
  return _require(abs);
}
