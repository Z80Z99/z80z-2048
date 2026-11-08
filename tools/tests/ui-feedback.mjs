import assert from 'node:assert/strict'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const { createFeedbackController, formatChange } = loadProject('./utils/feedback')
  const scheduled = new Map(), changes = []
  let next = 0
  const controller = createFeedbackController(state => changes.push(state), {
    schedule(callback) { const id = ++next; scheduled.set(id, callback); return id },
    cancel(id) { scheduled.delete(id) },
  })
  controller.show('已使用药剂')
  const first = scheduled.get(1)
  controller.show('已使用药剂')
  assert.equal(controller.getState().revision, 2)
  first()
  assert.equal(controller.getState().text, '已使用药剂', 'stale cleanup cannot remove newer feedback')
  scheduled.get(2)()
  assert.equal(controller.getState().text, '')
  controller.show('新的提示')
  controller.clear()
  assert.equal(scheduled.size, 0)
  controller.dispose()
  const count = changes.length
  controller.show('不能显示')
  assert.equal(changes.length, count)
  assert.equal(formatChange(1, 3), '+2')
  assert.equal(formatChange(3, 1), '−2')
  assert.equal(formatChange(2, 2), null)
  assert.equal(formatChange(NaN, 2), null)
  const { attributeInfo } = loadProject('./utils/attributeInfo')
  const { createInitialState } = loadProject('./store/initialState')
  const { initBattle, getBattlePreview } = loadProject('./core/battle')
  const { createRng } = loadProject('./core/random')
  const player = createInitialState().player
  const battle = initBattle({ id: 'rat', name: '巨鼠', hp: 28, maxHp: 28, attack: 22, defense: 1, speed: 9, tier: 1 }, 6, createRng(1))
  const preview = getBattlePreview(battle, player)
  const context = { player, battle, preview }
  assert.ok(attributeInfo('player.speed', context).value.includes('2') || attributeInfo('player.speed', context).value.includes('14'))
  assert.ok(attributeInfo('player.defense', context).calculation.includes('× 15'))
  for (const key of ['player.hp','player.attack','player.defense','player.speed','player.gold','player.xp','player.steps','enemy.hp','enemy.attack','enemy.defense','enemy.speed']) {
    const help = attributeInfo(key, context)
    assert.ok(help.title && help.summary && help.details.length)
  }
}
