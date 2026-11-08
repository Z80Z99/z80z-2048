import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const { UPGRADE_POOL, cardById } = loadProject('./core/upgrade')
  const { CONSUMABLE_POOL } = loadProject('./core/consumables')
  const { summarizeEffect, displaySummary, summarizeCard, summarizeConsumable, getActualHealGained, durationText, cardClassHelp } = loadProject('./utils/displayText')
  const { collectCardModifiers } = loadProject('./core/cardEffects')
  const freeze = value => {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze)
      Object.freeze(value)
    }
    return value
  }
  const before = JSON.stringify({ cards: UPGRADE_POOL, items: CONSUMABLE_POOL })
  const expected = {
    atk_up_1: ['攻击增强8%'],
    def_up_1: ['防御增强8%'],
    max_hp_1: ['生命上限+8（同时恢复8）'],
    gold_1: ['战斗获得的金币增加3%'],
    bonus_turn_0_5: ['每回合多1步'],
    atk_up_2: ['合并获得的攻击增加10%'],
    spawn_red_1: ['新方块也能增加防御（每点数值+0.2）'],
    start_tile_1: ['每回合赠送4点方块；没空位会留到之后'],
    gold_combo: ['连续合并，每层多攒4点攻击；没合并就重算'],
    gold_merge_armor: ['合并时获得防御，数值为合并结果的25%'],
    gold_carry: ['把部分合并防御留到下一回合；叠加后留下更多'],
    gold_lifesteal: ['攻击造成伤害时回复生命；叠加后回复更多'],
    red_berserk: ['合并获得的攻击增加100%', '受到的敌人攻击伤害增加30%'],
    red_blood: ['攻击造成伤害时回复生命；叠加后回复更多', '每层：回合结束流血，失去3点生命'],
    red_double: ['有机会再攻击一次；叠加后机会更大，每回合最多一次', '每层：触发追加攻击时，失去4点生命'],
    curse_burn: ['每层：回合结束灼烧，失去2点生命'],
    curse_decay: ['回复的生命减少；叠加后减少更多'],
    curse_charge: ['合并积攒的攻击减少；叠加后减少更多'],
    doom_soul: ['每层：滑动发生合并时，失去2点生命'],
    doom_rebirth: ['每层：回合结束仍存活的敌人恢复4点生命（不超过上限）'],
    balanced_1: ['攻击增强5%', '防御增强5%'],
    vigor_1: ['生命上限+6（同时恢复6）', '防御增强3%'],
    xp_1: ['战斗获得的经验增加10%'],
    charge_start_1: ['每回合开局自带3点蓄力'],
    spawn_luck_1: ['新方块更容易出现高数值；叠加后更明显'],
    halve_shield_1: ['回合结束时方块有机会不减半；叠加后机会更大'],
    gold_combo_grace: ['未合并的回合连锁会延续一部分；叠加后保留更多'],
    gold_execute: ['攻击后敌人生命低于斩杀线时直接击杀；叠加后斩杀线提高'],
    gold_crit: ['攻击有几率造成双倍伤害；叠加后几率提高'],
    gold_saved_steps: ['回合结束时每剩余 1 步，下回合开局获得2点蓄力'],
    red_hunt: ['攻击后敌人生命低于斩杀线时直接击杀；叠加后斩杀线提高', '受到的敌人攻击伤害增加25%'],
    red_greed: ['战斗获得的金币翻倍；叠加后收益更高', '每层：回合结束灼烧，失去4点生命'],
    curse_heavy: ['每回合行动步数减少1（至少保留 1 步）'],
    curse_brittle: ['回合间保留的护甲会被侵蚀；叠加后侵蚀更多'],
    doom_rage: ['每层：敌人攻击每回合成长 +1'],
    heal_1: ['立即恢复12点生命（受治疗减少影响，不超过上限）'],
    heal_2: ['立即恢复30点生命（受治疗减少影响，不超过上限）'],
  }
  assert.equal(UPGRADE_POOL.length, 37)
  for (const def of UPGRADE_POOL) {
    const frozen = freeze(JSON.parse(JSON.stringify(def)))
    const lines = summarizeCard(frozen)
    assert.deepEqual(lines.map(line => line.text), expected[def.id], def.id)
    assert.equal(lines.length, def.effects.length, 'one summary per effect')
    assert.deepEqual(lines.map(line => line.polarity), def.effects.map(effect => effect.polarity), 'never drop negative polarity')
    for (const effect of frozen.effects) {
      assert.equal(summarizeEffect(effect), displaySummary(effect))
      assert.doesNotMatch(summarizeEffect(effect), /评级|系数|强力收益|正面收益|负面代价/)
    }
    if (def.cardClass === 'red') assert.deepEqual(lines.map(line => line.polarity), ['positive', 'negative'])
    if (def.cardClass === 'black') assert.match(cardClassHelp(def.cardClass), /本局不可解除/)
  }
  const effectOf = id => cardById(id).effects[0]
  assert.match(summarizeEffect(effectOf('gold_carry'), { count: 1 }), /20%/)
  assert.match(summarizeEffect(effectOf('gold_carry'), { count: 4 }), /50%/)
  assert.doesNotMatch(summarizeEffect(effectOf('gold_carry'), { count: 1 }), /25%/)
  assert.equal(summarizeEffect(effectOf('gold_carry'), { count: 0 }), expected.gold_carry[0])
  assert.match(summarizeEffect(effectOf('gold_lifesteal'), { modifiers: { lifestealRating: 0.08 } }), /7.41%/)
  assert.match(summarizeEffect(effectOf('gold_lifesteal'), { modifiers: { lifestealRating: 0.16 } }), /13.79%/)
  assert.match(summarizeEffect(effectOf('red_blood'), { modifiers: { lifestealRating: 0.58 } }), /36.71%/)
  assert.match(summarizeEffect(effectOf('red_double'), { modifiers: { extraStrikeRating: 1 } }), /50%/)
  assert.match(summarizeEffect(effectOf('curse_decay'), { modifiers: { healingPenalty: 0.2 } }), /16.67%/)
  assert.match(summarizeEffect(effectOf('curse_charge'), { modifiers: { chargeLoss: 0.15 } }), /13.04%/)
  assert.match(summarizeEffect(effectOf('gold_carry'), { modifiers: { armorCarry: 0.5 }, count: 1 }), /33.33%/, 'actual total takes priority over per-card count')
  const held = [{ def: cardById('gold_carry'), count: 3 }, { def: cardById('gold_lifesteal'), count: 2 }, { def: cardById('curse_decay'), count: 1 }]
  const context = freeze({ modifiers: collectCardModifiers(held), count: 3 })
  const contextBefore = JSON.stringify(context)
  assert.match(summarizeEffect(effectOf('gold_carry'), context), /42.86%/)
  assert.match(summarizeEffect(effectOf('gold_lifesteal'), context), /13.79%/)
  assert.equal(JSON.stringify(context), contextBefore)

  assert.equal(CONSUMABLE_POOL.length, 5)
  for (const item of CONSUMABLE_POOL) {
    const frozen = freeze(JSON.parse(JSON.stringify(item)))
    const lines = summarizeConsumable(frozen)
    assert.equal(lines.length, item.cleanse ? 1 : item.effects.length)
    if (!item.cleanse) assert.deepEqual(lines.map(line => line.polarity), item.effects.map(effect => effect.polarity))
    lines.forEach(line => assert.doesNotMatch(line.text, /评级|系数/))
    assert.ok(durationText(item.duration))
  }
  assert.match(summarizeConsumable(CONSUMABLE_POOL.find(item => item.id === 'charge_potion'))[0].text, /50%.*不影响已有攻击/)
  assert.deepEqual(summarizeConsumable(CONSUMABLE_POOL.find(item => item.id === 'berserk_potion')).map(line => line.text), ['合并获得的攻击增加100%', '受到的敌人攻击伤害增加30%'])
  assert.match(summarizeConsumable(CONSUMABLE_POOL.find(item => item.cleanse))[0].text, /紫卡一层；黑卡本局不可解除/)
  assert.equal(durationText('persistent'), '本局持续')
  assert.equal(durationText('instant'), '立即生效')
  assert.equal(durationText('round'), '本回合有效')
  assert.equal(durationText('battle'), '本场战斗有效')

  const player = freeze({ hp: 20, maxHp: 101 })
  assert.equal(getActualHealGained(player, 12, 0.2), 10)
  assert.equal(getActualHealGained(player, Math.floor(player.maxHp * 0.3), 0.2), 25)
  assert.equal(getActualHealGained({ hp: 99, maxHp: 101 }, 30, 0.2), 2)
  assert.equal(getActualHealGained({ hp: 101, maxHp: 101 }, 30, 0.2), 0)
  assert.equal(getActualHealGained({ hp: 0, maxHp: 101 }, 30), 0)
  assert.equal(getActualHealGained(player, 0.5), 0)
  assert.equal(getActualHealGained(player, Infinity), 0)
  assert.equal(getActualHealGained(player, -4), 0)
  assert.match(summarizeEffect(effectOf('heal_1'), { effectivePlayer: player, modifiers: { healingPenalty: 0.2 } }), /恢复10点/)
  assert.equal(summarizeEffect(effectOf('max_hp_1'), { effectivePlayer: { hp: 101, maxHp: 101 }, modifiers: { healingPenalty: 0.2 } }), '生命上限+8（同时恢复6）')
  assert.equal(JSON.stringify({ cards: UPGRADE_POOL, items: CONSUMABLE_POOL }), before, 'display helpers never mutate domain definitions')

  // Compare display-only healing to the existing authoritative actions, without changing them.
  const { createPinia, setActivePinia } = createRequire(import.meta.url)('pinia')
  const { useGameStore } = loadProject('./store/gameStore')
  for (const [hp, maxHp, layers] of [[20, 101, 1], [99, 101, 2], [80, 100, 0], [100, 100, 1]]) {
    setActivePinia(createPinia())
    const store = useGameStore()
    store.screen = 'rest'
    store.player.hp = hp
    store.player.maxHp = maxHp
    store.upgrades = layers ? [{ def: cardById('curse_decay'), count: layers }] : []
    const preview = getActualHealGained(store.effectivePlayer, Math.floor(store.effectivePlayer.maxHp * 0.3), store.activeCardModifiers.healingPenalty)
    store.REST_HEAL()
    assert.equal(store.player.hp - hp, preview, 'camp preview equals actual floor/cap')
  }
}
