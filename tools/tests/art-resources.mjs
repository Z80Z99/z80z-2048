import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const art = loadProject('./utils/artwork')
  const enemy = loadProject('./core/enemy')
  const equipment = loadProject('./core/equipment')
  const upgrade = loadProject('./core/upgrade')
  const root = path.resolve(import.meta.dirname, '../..')
  const paths = new Set()
  for (const id of art.MONSTER_PORTRAIT_IDS) {
    const source = art.monsterPortrait(id)
    assert.equal(enemy.getEnemyIcon(id), source)
    assert.ok(enemy.getEnemyFallbackIcon(id))
    paths.add(source)
  }
  for (const item of equipment.ALL_EQUIPMENT) {
    paths.add(art.equipmentArtwork(item.slot))
    if (item.set) {
      assert.ok(art.setEmblem(item.set), `set emblem exists for ${item.set}`)
      paths.add(art.setEmblem(item.set))
    }
  }
  for (const def of upgrade.UPGRADE_POOL) {
    assert.ok(Array.isArray(def.effects) && def.effects.length > 0, `${def.id}: effects array`)
    assert.ok(!Object.hasOwn(def, 'effect'), `${def.id}: no legacy singular effect`)
    assert.ok(art.CARD_ART_ICONS.includes(def.icon), `${def.id}: registered semantic artwork icon`)
    paths.add(art.cardArtwork(def.icon))
  }
  for (const stage of [1, 2, 3, 4, 20]) paths.add(art.stageArtwork(stage))
  paths.add('/static/scenes/camp.png')
  paths.add('/static/scenes/shop.png')
  assert.equal(art.monsterPortrait('not-a-real-enemy'), null)
  assert.equal(art.setEmblem('unknown'), null)
  assert.equal(art.setEmblem('__proto__'), null)
  assert.equal(art.cardArtwork('unknown'), '/static/items/ward.png')
  assert.equal(art.cardArtwork('__proto__'), '/static/items/ward.png')
  assert.equal(art.equipmentArtwork('unknown'), '/static/items/armor.png')
  for (const source of paths) {
    const bytes = fs.readFileSync(path.join(root, source.slice(1)))
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(bytes[25], 6, 'RGBA art')
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20)
    assert.ok(width >= 256 && height >= 256)
    assert.ok(bytes.length > 500, 'art is not a blank placeholder')
    const vector = fs.readFileSync(path.join(root, source.slice(1).replace(/\.png$/, '.svg')), 'utf8')
    assert.ok(vector.includes('<svg'))
    assert.ok(!/<image\b|https?:\/\/(?!www\.w3\.org)/.test(vector), 'original local path artwork')
  }
  assert.equal(paths.size, 57, '18 portraits,14 item categories,20 emblems,5 scenes')
  assert.ok(!enemy.getEnemyIcon('mage').startsWith('/'), 'unpainted enemy retains safe fallback')
  const itemIcon = fs.readFileSync(path.join(root, 'components/ItemIcon.vue'), 'utf8')
  assert.ok(itemIcon.includes('@error='), 'failed images have readable fallback')
  const display = fs.readFileSync(path.join(root, 'components/EnemyDisplay.vue'), 'utf8')
  assert.ok(display.includes('@error="portraitFailed = true"'))
}
