import assert from 'node:assert/strict'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const board = loadProject('./core/board')
  const { createRng } = loadProject('./core/random')
  const { pickUpgrades, UPGRADE_POOL, CARD_CLASSES, NORMAL_CARD_CLASSES } = loadProject('./core/upgrade')
  const { rollRewardChoices } = loadProject('./store/helpers')
  const grid = board.createEmptyGrid()
  grid[0][0].value = 2
  grid[0][2].value = 2
  grid[0][3].value = 4
  const previous = JSON.stringify(grid)
  const left = board.slideGrid(grid, 'left')
  assert.equal(JSON.stringify(grid), previous, 'slide does not mutate previous grid')
  assert.deepEqual(left.grid[0].map(c => c.value), [4, 4, 0, 0])
  assert.equal(left.mergedSum, 4, 'tile merges only once per move')
  assert.equal(left.grid[0][1].id, grid[0][3].id, 'unmerged tile keeps identity')
  assert.deepEqual(left.grid[0][0].mergedFrom, [grid[0][0].id, grid[0][2].id])
  const half = board.halveGridTiles(left.grid)
  assert.equal(half[0][0].id, left.grid[0][0].id)
  assert.equal(half[0][0].value, 2)
  assert.equal(half[0][0].isMerged, false)
  const values = grid => grid.flat().reduce((sum, c) => sum + c.value, 0)
  for (const direction of ['up', 'down', 'left', 'right']) {
    const result = board.slideGrid(grid, direction)
    assert.equal(values(result.grid), values(grid), 'merge preserves board sum')
    const occupiedIds = result.grid.flat().filter(c => c.value).map(c => c.id)
    assert.equal(new Set(occupiedIds).size, occupiedIds.length)
  }
  const result = board.spawnTile(left.grid, createRng(4))
  assert.equal(values(result.grid), values(left.grid) + result.spawnedValue)

  // 六色奖励有限终止：Boss 按金卡分类三选一，不再有史诗数量或持有上限。
  assert.deepEqual(CARD_CLASSES, ['white', 'blue', 'gold', 'red', 'purple', 'black'])
  assert.deepEqual(NORMAL_CARD_CLASSES, ['white', 'blue', 'gold'])
  for (const def of UPGRADE_POOL) {
    assert.ok(!Object.hasOwn(def, 'rarity'), `${def.id}: cards do not use equipment rarity`)
    assert.ok(!Object.hasOwn(def, 'maxStacks'), `${def.id}: no per-card stack cap`)
  }
  const boss = pickUpgrades(() => 0, { count: 3, excludeHeal: true, allowedClasses: ['gold'] })
  assert.equal(boss.length, 3)
  assert.deepEqual(boss.map(u => u.id), ['gold_combo', 'gold_merge_armor', 'gold_carry'])
  assert.ok(boss.every(u => u.cardClass === 'gold' && u.kind === 'persistent'))
  const allGold = pickUpgrades(() => 0, { count: 10, allowedClasses: ['gold'] })
  assert.equal(allGold.length, 8, 'all eight gold cards are eligible, with no old two-epic cap')
  assert.equal(new Set(allGold.map(u => u.id)).size, allGold.length)
  const owned = UPGRADE_POOL.map(def => ({ def, count: 1000000 }))
  const repeatable = rollRewardChoices(createRng(7), owned, { count: UPGRADE_POOL.length + 5, excludeHeal: true })
  const safePersistent = UPGRADE_POOL.filter(u => NORMAL_CARD_CLASSES.includes(u.cardClass) && u.kind === 'persistent')
  assert.deepEqual(repeatable.map(u => u.id).sort(), safePersistent.map(u => u.id).sort(), 'large owned counts never exhaust future rewards')
  assert.equal(new Set(repeatable.map(u => u.id)).size, repeatable.length, 'one offer still contains unique IDs')
  assert.ok(repeatable.every(u => !['red', 'purple', 'black'].includes(u.cardClass)), 'safe rewards exclude risk, curse and doom')
  for (const count of [Infinity, NaN, -1, 0]) {
    assert.deepEqual(pickUpgrades(() => { throw new Error('invalid count consumed RNG') }, { count }), [])
  }
  assert.deepEqual(pickUpgrades(() => { throw new Error('empty pool consumed RNG') }, { allowedClasses: [] }), [])
  const maxHpOwned = rollRewardChoices(createRng(7), [{ def: UPGRADE_POOL.find(u => u.id === 'max_hp_1'), count: 1 }], { count: 30, excludeHeal: true, hpRatio: 1 })
  assert.ok(maxHpOwned.every(u => u.kind !== 'instant' && u.effects.every(effect => effect.type !== 'heal')), 'full HP never re-enables heal cards')
}
