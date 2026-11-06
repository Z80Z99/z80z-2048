import assert from 'node:assert/strict'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const storage = loadProject('./utils/storage')
  const { getBestiaryId } = loadProject('./core/enemy')
  const original = global.uni.getStorageSync
  try {
    global.uni.getStorageSync = () => '{broken'
    assert.equal(storage.loadMeta().totalRuns, 0)
    global.uni.getStorageSync = () => JSON.stringify({
      totalGold: -10, totalRuns: 'oops', purchasedIds: ['meta_start', 'meta_start', 1],
      unlockedEnemies: ['boss_endless_4', 'boss_endless_12'],
      enemyKills: { boss_endless_4: 2, boss_endless_12: 3, rat: 'five' },
      bestiaryClaimed: [3, '6', 999], bestiaryBonusAtk: -1,
    })
    const meta = storage.loadMeta()
    assert.equal(meta.totalGold, 0)
    assert.equal(meta.totalRuns, 0)
    assert.deepEqual(meta.purchasedIds, ['meta_start'])
    assert.deepEqual(meta.bestiaryClaimed, [3])
    assert.equal(meta.bestiaryBonusAtk, 0)
    assert.equal(meta.enemyKills[getBestiaryId('boss_endless_4')], 5)
    assert.equal(meta.unlockedEnemies.length, 1)
    assert.equal(meta.enemyKills.rat, 0)
    global.uni.getStorageSync = () => '{"enemyKills":{"__proto__":50,"rat":7}}'
    assert.equal(storage.loadMeta().enemyKills.rat, 7)
    assert.equal(Object.prototype.hasOwnProperty.call(storage.loadMeta().enemyKills, '__proto__'), false)
  } finally {
    global.uni.getStorageSync = original
  }
}
