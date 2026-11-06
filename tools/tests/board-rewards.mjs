import assert from 'node:assert/strict'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const board = loadProject('./core/board')
  const { createRng } = loadProject('./core/random')
  const { pickUpgrades, UPGRADE_POOL } = loadProject('./core/upgrade')
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

  // 奖励池有限终止、Boss 三选一不会被普通奖励的两张史诗上限卡住。
  const boss = pickUpgrades(() => 0, [], {}, 3, true, 1, 'epic')
  assert.equal(boss.length, 3)
  assert.ok(boss.every(u => u.rarity === 'epic'))
  const exhausted = Object.fromEntries(UPGRADE_POOL.map(u => [u.id, u.maxStacks]))
  assert.deepEqual(pickUpgrades(() => 0, [], exhausted, 3, true), [])
  const capped = pickUpgrades(() => 0, [], {}, 5, true)
  assert.ok(capped.filter(u => u.rarity === 'epic').length <= 2)
  const maxHpOwned = pickUpgrades(createRng(7), ['max_hp_1'], { max_hp_1: 1 }, 30, true, 1)
  assert.ok(maxHpOwned.every(u => u.effect.type !== 'heal'), 'full HP never re-enables heal cards')
}
