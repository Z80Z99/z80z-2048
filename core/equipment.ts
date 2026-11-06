import type { EquipSetEffects, PlayerStats } from '../types'
import { createRng } from './random'

export type EquipSlot = 'pants' | 'helmet' | 'armor' | 'gloves' | 'boots'
export type EquipStat = 'atk' | 'def' | 'spd' | 'hp' | 'gold' | 'xp'
export type EquipStats = Partial<Record<EquipStat, number>>
type EquipRarity = 'common' | 'rare' | 'epic'
type SetThreshold = 'two' | 'three' | 'five'

type SetData = {
  name: string
  color: string
  bonuses: Record<SetThreshold, string>
  stats: Record<EquipSlot, EquipStats>
  // 各档为累加增量；升级已有效果时只加差值，文案明确最终数值。
  effects: Record<SetThreshold, Partial<EquipSetEffects>>
}

const SETS: Record<string, SetData> = {
  tempest: { name: '暴风', color: '#3498db', bonuses: { two: '速度 +4', three: '攻击倍率 +20%', five: '每回合多 2 步' },
    stats: { pants: { atk: 12 }, helmet: { spd: 1 }, armor: { atk: 8 }, gloves: { spd: 1 }, boots: { spd: 2 } },
    effects: { two: { speedBonus: 4 }, three: { attackBonus: 0.2 }, five: { extraTurns: 2 } } },
  fortress: { name: '磐石', color: '#95a5a6', bonuses: { two: '防御倍率 +20%', three: '最大生命 +25%', five: '每场首次实际受伤减半，并在该次反弹 5 伤害' },
    stats: { pants: { def: 10 }, helmet: { hp: 12 }, armor: { def: 15 }, gloves: { def: 5 }, boots: { hp: 8 } },
    effects: { two: { defenseBonus: 0.2 }, three: { hpBonus: 0.25 }, five: { fortify: true, reflect: 5 } } },
  shadow: { name: '影步', color: '#9b59b6', bonuses: { two: '速度 +3', three: '攻击倍率 +10%', five: '永远先手 + 10% 闪避' },
    stats: { pants: { spd: 2 }, helmet: { spd: 1 }, armor: { spd: 1 }, gloves: { spd: 2 }, boots: { spd: 3 } },
    effects: { two: { speedBonus: 3 }, three: { attackBonus: 0.1 }, five: { firstStrike: true, dodge: 0.1 } } },
  vampire: { name: '噬血', color: '#c0392b', bonuses: { two: '攻击倍率 +10%', three: '10% 吸血', five: '吸血提升至 20%（替代 10%），攻击倍率再 +25%' },
    stats: { pants: { atk: 15 }, helmet: { hp: 8 }, armor: { atk: 5 }, gloves: { atk: 5 }, boots: { hp: 5 } },
    effects: { two: { attackBonus: 0.1 }, three: { lifesteal: 0.1 }, five: { lifesteal: 0.1, attackBonus: 0.25 } } },
  treasure: { name: '财宝', color: '#f1c40f', bonuses: { two: '金币 +25%', three: '经验 +30%', five: '装备掉落品质升一档（最高史诗，不翻倍金币）' },
    stats: { pants: { gold: 10 }, helmet: { gold: 5 }, armor: { gold: 10 }, gloves: { gold: 5 }, boots: { gold: 10 } },
    effects: { two: { goldBonus: 0.25 }, three: { xpBonus: 0.3 }, five: { dropRarityBoost: 1 } } },
  flame: { name: '烈焰', color: '#e67e22', bonuses: { two: '攻击倍率 +15%', three: '攻击倍率再 +25%（共 +40%）', five: '攻击无视 40% 敌人防御' },
    stats: { pants: { atk: 18 }, helmet: { atk: 5 }, armor: { atk: 8 }, gloves: { atk: 8 }, boots: { atk: 5 } },
    effects: { two: { attackBonus: 0.15 }, three: { attackBonus: 0.25 }, five: { pierce: 0.4 } } },
  frost: { name: '冰霜', color: '#1abc9c', bonuses: { two: '防御倍率 +15%', three: '敌人速度 -4', five: '敌人攻击 -30%' },
    stats: { pants: { def: 8 }, helmet: { def: 5 }, armor: { def: 12 }, gloves: { def: 5 }, boots: { def: 5 } },
    effects: { two: { defenseBonus: 0.15 }, three: { enemySpdDown: 4 }, five: { enemyAtkDown: 0.3 } } },
  thunder: { name: '雷霆', color: '#f39c12', bonuses: { two: '速度 +5', three: '攻击倍率 +15%', five: '20% 概率敌人跳过本次攻击' },
    stats: { pants: { spd: 2 }, helmet: { spd: 2 }, armor: { spd: 1 }, gloves: { spd: 2 }, boots: { spd: 3 } },
    effects: { two: { speedBonus: 5 }, three: { attackBonus: 0.15 }, five: { skipChance: 0.2 } } },
  holy: { name: '圣光', color: '#f5f5dc', bonuses: { two: '最大生命 +20%', three: '每回合结束恢复最大生命的 8%', five: '恢复提升至 16%（替代 8%），防御倍率 +20%' },
    stats: { pants: { hp: 10 }, helmet: { hp: 12 }, armor: { hp: 15 }, gloves: { hp: 5 }, boots: { hp: 8 } },
    effects: { two: { hpBonus: 0.2 }, three: { regen: 0.08 }, five: { regen: 0.08, defenseBonus: 0.2 } } },
  dark: { name: '暗影', color: '#2c3e50', bonuses: { two: '攻击倍率 +25%', three: '速度 +3', five: '攻击倍率翻倍但防御倍率减半' },
    stats: { pants: { atk: 20 }, helmet: { atk: 5 }, armor: { atk: 10 }, gloves: { atk: 8 }, boots: { atk: 5 } },
    effects: { two: { attackBonus: 0.25 }, three: { speedBonus: 3 }, five: { doubleAtk: true, halfDefense: true } } },
  nature: { name: '自然', color: '#27ae60', bonuses: { two: '攻击/防御倍率、最大生命、速度 +8%', three: '上述四项再 +12%（共 +20%）', five: '上述四项再 +20%（共 +40%，不含金币/经验）' },
    stats: { pants: { atk: 5, def: 5 }, helmet: { hp: 5, spd: 1 }, armor: { def: 5, hp: 5 }, gloves: { atk: 5, spd: 1 }, boots: { spd: 1, hp: 5 } },
    effects: { two: { attackBonus: 0.08, defenseBonus: 0.08, hpBonus: 0.08, speedPercent: 0.08 }, three: { attackBonus: 0.12, defenseBonus: 0.12, hpBonus: 0.12, speedPercent: 0.12 }, five: { attackBonus: 0.2, defenseBonus: 0.2, hpBonus: 0.2, speedPercent: 0.2 } } },
  dragon: { name: '龙裔', color: '#e74c3c', bonuses: { two: '最大生命 +30%', three: '攻击倍率 +20%', five: '最大生命再 +50%，攻击倍率再 +30%' },
    stats: { pants: { atk: 10, hp: 5 }, helmet: { hp: 15 }, armor: { hp: 20 }, gloves: { atk: 8 }, boots: { hp: 10 } },
    effects: { two: { hpBonus: 0.3 }, three: { attackBonus: 0.2 }, five: { hpBonus: 0.5, attackBonus: 0.3 } } },
  void: { name: '虚空', color: '#8e44ad', bonuses: { two: '每回合随机战斗属性（攻击倍率/防御倍率/速度）+20%', three: '同一随机战斗属性再 +30%（共 +50%）', five: '每回合随机一项战斗属性（攻击倍率/防御倍率/速度）翻倍' },
    stats: { pants: { atk: 10 }, helmet: { spd: 2 }, armor: { def: 10 }, gloves: { atk: 5 }, boots: { spd: 2 } },
    effects: { two: { randomBonus: 0.2 }, three: { randomBonus: 0.3 }, five: { randomDouble: true } } },
  time: { name: '时光', color: '#16a085', bonuses: { two: '速度 +3', three: '每回合步数 +2', five: '步数再 +3（共 +5），速度再 +6（共 +9）' },
    stats: { pants: { spd: 2 }, helmet: { spd: 1 }, armor: { spd: 1 }, gloves: { spd: 2 }, boots: { spd: 3 } },
    effects: { two: { speedBonus: 3 }, three: { extraTurns: 2 }, five: { extraTurns: 3, speedBonus: 6 } } },
  soul: { name: '灵魂', color: '#dda0dd', bonuses: { two: '经验 +40%', three: '攻击倍率 +10%', five: '经验翻倍，攻击倍率再 +20%' },
    stats: { pants: { atk: 8 }, helmet: { xp: 15 }, armor: { xp: 15 }, gloves: { atk: 5 }, boots: { xp: 10 } },
    effects: { two: { xpBonus: 0.4 }, three: { attackBonus: 0.1 }, five: { doubleXp: true, attackBonus: 0.2 } } },
  warrior: { name: '战士', color: '#c0392b', bonuses: { two: '攻击倍率 +15%，防御倍率 +10%', three: '最大生命 +20%', five: '攻击倍率再 +25%，防御倍率再 +25%' },
    stats: { pants: { atk: 12 }, helmet: { def: 5 }, armor: { atk: 5, def: 5 }, gloves: { atk: 8 }, boots: { def: 5 } },
    effects: { two: { attackBonus: 0.15, defenseBonus: 0.1 }, three: { hpBonus: 0.2 }, five: { attackBonus: 0.25, defenseBonus: 0.25 } } },
  hunter: { name: '猎人', color: '#2ecc71', bonuses: { two: '速度 +4，金币 +20%', three: '永远先手', five: '保持先手，金币提升至 +40%（替代 +20%）' },
    stats: { pants: { atk: 8 }, helmet: { spd: 2 }, armor: { gold: 10 }, gloves: { spd: 1 }, boots: { spd: 2 } },
    effects: { two: { speedBonus: 4, goldBonus: 0.2 }, three: { firstStrike: true }, five: { goldBonus: 0.2 } } },
  sage: { name: '贤者', color: '#3498db', bonuses: { two: '经验 +30%，防御倍率 +10%', three: '每回合结束恢复最大生命的 5%', five: '经验翻倍，防御倍率再 +30%' },
    stats: { pants: { def: 8 }, helmet: { xp: 10 }, armor: { def: 10, hp: 5 }, gloves: { xp: 5 }, boots: { def: 5 } },
    effects: { two: { xpBonus: 0.3, defenseBonus: 0.1 }, three: { regen: 0.05 }, five: { doubleXp: true, defenseBonus: 0.3 } } },
  thief: { name: '盗贼', color: '#7f8c8d', bonuses: { two: '金币 +30%，速度 +2', three: '15% 闪避', five: '保持 15% 闪避，金币提升至 +50%（替代 +30%）' },
    stats: { pants: { gold: 10 }, helmet: { spd: 1 }, armor: { gold: 10 }, gloves: { gold: 5 }, boots: { spd: 2 } },
    effects: { two: { goldBonus: 0.3, speedBonus: 2 }, three: { dodge: 0.15 }, five: { goldBonus: 0.2 } } },
  king: { name: '王者', color: '#f1c40f', bonuses: { two: '攻击/防御倍率、最大生命、速度 +10%', three: '上述四项再 +15%（共 +25%）', five: '上述四项再 +25%（共 +50%），装备掉落数量翻倍' },
    stats: { pants: { atk: 10, def: 5 }, helmet: { hp: 8, spd: 1 }, armor: { atk: 5, def: 5, hp: 5 }, gloves: { atk: 5, spd: 1 }, boots: { spd: 2, hp: 5 } },
    effects: { two: { attackBonus: 0.1, defenseBonus: 0.1, hpBonus: 0.1, speedPercent: 0.1 }, three: { attackBonus: 0.15, defenseBonus: 0.15, hpBonus: 0.15, speedPercent: 0.15 }, five: { attackBonus: 0.25, defenseBonus: 0.25, hpBonus: 0.25, speedPercent: 0.25, dropCount: 2 } } },
}

export interface Equipment {
  id: string
  name: string
  slot: EquipSlot
  rarity: EquipRarity
  set: string
  stats: EquipStats
}

const RARITY_MULT: Record<EquipRarity, number> = { common: 1, rare: 1.5, epic: 2.2 }
const EQUIP_SLOTS: EquipSlot[] = ['pants', 'helmet', 'armor', 'gloves', 'boots']
const STAT_KEYS: EquipStat[] = ['atk', 'def', 'spd', 'hp', 'gold', 'xp']
const slotNames: Record<EquipSlot, string> = { pants: '护腿', helmet: '头盔', armor: '铠甲', gloves: '手套', boots: '战靴' }
const rarityOrder: EquipRarity[] = ['common', 'rare', 'epic']
export const ALL_EQUIPMENT: Equipment[] = []

for (const [setId, setData] of Object.entries(SETS)) {
  for (const slot of EQUIP_SLOTS) {
    for (const rarity of rarityOrder) {
      const scaledStats: EquipStats = {}
      for (const key of STAT_KEYS) {
        const value = setData.stats[slot][key]
        if (value !== undefined) scaledStats[key] = Math.round(value * RARITY_MULT[rarity])
      }
      ALL_EQUIPMENT.push({ id: `eq_${setId}_${slot}_${rarity}`, name: `${setData.name}${slotNames[slot]}`, slot, rarity, set: setId, stats: scaledStats })
    }
  }
}

// 稳定英文标识不依赖中文名称或数组位置，避免同部位散件共用一个 ID。
const NO_SET_ITEMS: { id: string; name: string; slot: EquipSlot }[] = [
  { id: 'rabbit_foot', name: '幸运兔脚', slot: 'boots' },
  { id: 'adventurer_cloak', name: '冒险者披风', slot: 'armor' },
  { id: 'iron_fist', name: '铁拳护手', slot: 'gloves' },
  { id: 'mercenary_headband', name: '佣兵头巾', slot: 'helmet' },
  { id: 'traveler_pants', name: '旅人长裤', slot: 'pants' },
  { id: 'giant_belt', name: '巨人之力腰带', slot: 'gloves' },
  { id: 'eagle_goggles', name: '鹰眼目镜', slot: 'helmet' },
  { id: 'feather_boots', name: '轻羽靴', slot: 'boots' },
  { id: 'tough_armor', name: '韧皮护甲', slot: 'armor' },
  { id: 'strength_pants', name: '力量护腿', slot: 'pants' },
  { id: 'sage_hat', name: '贤者之帽', slot: 'helmet' },
  { id: 'swift_gloves', name: '迅捷手套', slot: 'gloves' },
  { id: 'cloud_boots', name: '踏云靴', slot: 'boots' },
  { id: 'monk_wraps', name: '武僧绑带', slot: 'gloves' },
  { id: 'stalker_hood', name: '潜行者兜帽', slot: 'helmet' },
]

const legacyEquipment = new Map<string, Equipment>()
for (const item of NO_SET_ITEMS) {
  for (const rarity of rarityOrder) {
    const eq: Equipment = { id: `eq_noset_${item.id}_${item.slot}_${rarity}`, name: item.name, slot: item.slot, rarity, set: '', stats: {} }
    ALL_EQUIPMENT.push(eq)
    // 旧 ID 已丢失名称，无法还原；保留旧 find() 的首个匹配语义。
    const legacyId = `eq_noset__${item.slot}_${rarity}`
    if (!legacyEquipment.has(legacyId)) legacyEquipment.set(legacyId, eq)
  }
}
const equipmentIndex = new Map(ALL_EQUIPMENT.map(eq => [eq.id, eq]))

export function equipmentById(compoundId: string): Equipment | undefined {
  const baseId = compoundId.split(':')[0]
  return equipmentIndex.get(baseId) ?? legacyEquipment.get(baseId)
}

export function getSetData(setId: string): SetData | undefined { return SETS[setId] }

export function equipCost(eq: { rarity: string } | undefined): number {
  const costs: Record<string, number> = { common: 30, rare: 70, epic: 120 }
  return costs[eq?.rarity ?? 'common'] ?? 30
}

export interface EquipBonuses {
  // atk/def 为套装固定值；atkPercent/defPercent、gold/xp 为百分数（如 20 表示 20%）。
  stats: Record<EquipStat | 'atkPercent' | 'defPercent', number>
  setEffects: EquipSetEffects
}

function emptySetEffects(): EquipSetEffects {
  return {
    extraTurns: 0, lifesteal: 0, dodge: 0, skipChance: 0, fortify: false,
    firstStrike: false, doubleAtk: false, pierce: 0, doubleXp: false,
    doubleGold: false, regen: 0, reflect: 0, enemyAtkDown: 0, enemySpdDown: 0,
    attackBonus: 0, defenseBonus: 0, hpBonus: 0, speedBonus: 0, speedPercent: 0,
    goldBonus: 0, xpBonus: 0, halfDefense: false, dropRarityBoost: 0, dropCount: 1,
    randomBonus: 0, randomDouble: false,
  }
}

const NUMERIC_EFFECT_KEYS = [
  'extraTurns', 'lifesteal', 'dodge', 'skipChance', 'pierce', 'regen', 'reflect',
  'enemyAtkDown', 'enemySpdDown', 'attackBonus', 'defenseBonus', 'hpBonus',
  'speedBonus', 'speedPercent', 'goldBonus', 'xpBonus', 'dropRarityBoost', 'randomBonus',
] as const
const BOOLEAN_EFFECT_KEYS = ['fortify', 'firstStrike', 'doubleAtk', 'doubleXp', 'doubleGold', 'halfDefense', 'randomDouble'] as const
const SET_THRESHOLDS: [SetThreshold, number][] = [['two', 2], ['three', 3], ['five', 5]]

export function computeEquipBonuses(equipped: Record<string, string | undefined>): EquipBonuses {
  const setCounts: Record<string, number> = {}
  const stats: EquipBonuses['stats'] = { atk: 0, def: 0, atkPercent: 0, defPercent: 0, spd: 0, hp: 0, gold: 0, xp: 0 }
  for (const slot of EQUIP_SLOTS) {
    const compoundId = equipped[slot]
    if (!compoundId) continue
    const eq = equipmentById(compoundId)
    if (!eq || eq.slot !== slot) continue
    if (eq.set) setCounts[eq.set] = (setCounts[eq.set] ?? 0) + 1
    const scaled = getEquipStats(compoundId)
    for (const key of STAT_KEYS) {
      const target = !eq.set && key === 'atk' ? 'atkPercent' : !eq.set && key === 'def' ? 'defPercent' : key
      stats[target] += scaled[key] ?? 0
    }
  }
  const setEffects = emptySetEffects()
  for (const [setId, count] of Object.entries(setCounts)) {
    const setData = SETS[setId]
    if (!setData) continue
    for (const [threshold, required] of SET_THRESHOLDS) {
      if (count < required) continue
      const bonus = setData.effects[threshold]
      for (const key of NUMERIC_EFFECT_KEYS) setEffects[key] += bonus[key] ?? 0
      for (const key of BOOLEAN_EFFECT_KEYS) setEffects[key] = setEffects[key] || !!bonus[key]
      setEffects.dropCount = Math.max(setEffects.dropCount, bonus.dropCount ?? 1)
    }
  }
  return { stats, setEffects }
}

const COMBAT_ATTRIBUTES = ['attack', 'defense', 'speed'] as const

// 只在战斗/回合开始显式抽取；展示与属性计算不抽签，也不改传入对象。
export function rollEquipEffects(effects: Partial<EquipSetEffects>, rng: () => number): Partial<EquipSetEffects> {
  const rolled = { ...effects }
  delete rolled.randomStat
  delete rolled.doubleStat
  if (rolled.randomBonus) rolled.randomStat = COMBAT_ATTRIBUTES[Math.min(2, Math.max(0, Math.floor(rng() * 3)))]
  if (rolled.randomDouble) rolled.doubleStat = COMBAT_ATTRIBUTES[Math.min(2, Math.max(0, Math.floor(rng() * 3)))]
  return rolled
}

// player 始终为未叠装备的基础属性；effects 覆盖已计算的套装字段（包括本回合虚空抽签）。
// 不修改当前生命或奖励余额；额外步数由战斗创建者单独加上 setEffects.extraTurns。
export function getEffectivePlayer(player: PlayerStats, effects?: Partial<EquipSetEffects>): PlayerStats {
  const { stats, setEffects } = computeEquipBonuses(player.equipment)
  const eff = { ...setEffects, ...effects }
  let attackMultiplier = player.attackMultiplier + stats.atkPercent / 100 + (eff.attackBonus ?? 0)
  let defenseMultiplier = player.defenseMultiplier + stats.defPercent / 100 + (eff.defenseBonus ?? 0)
  let speedPercent = eff.speedPercent ?? 0
  if (eff.randomStat === 'attack') attackMultiplier += eff.randomBonus ?? 0
  if (eff.randomStat === 'defense') defenseMultiplier += eff.randomBonus ?? 0
  if (eff.randomStat === 'speed') speedPercent += eff.randomBonus ?? 0
  if (eff.doubleAtk) attackMultiplier *= 2
  if (eff.halfDefense) defenseMultiplier *= 0.5
  if (eff.doubleStat === 'attack') attackMultiplier *= 2
  if (eff.doubleStat === 'defense') defenseMultiplier *= 2
  let baseSpeed = (player.baseSpeed + stats.spd + (eff.speedBonus ?? 0)) * (1 + speedPercent)
  if (eff.doubleStat === 'speed') baseSpeed *= 2
  const maxHp = Math.max(1, Math.floor((player.maxHp + stats.hp) * (1 + (eff.hpBonus ?? 0))))
  return {
    ...player,
    hp: Math.max(0, Math.min(player.hp, maxHp)),
    maxHp,
    attackMultiplier,
    defenseMultiplier,
    flatAttack: player.flatAttack + stats.atk,
    flatDefense: player.flatDefense + stats.def,
    baseSpeed,
    spawnReduction: Math.min(0.5, Math.max(0, player.spawnReduction)),
    goldBoost: (player.goldBoost ?? 0) + stats.gold / 100 + (eff.goldBonus ?? 0),
    xpBoost: (player.xpBoost ?? 0) + stats.xp / 100 + (eff.xpBonus ?? 0),
  }
}

function equipLevel(compoundId: string): number {
  const level = Number.parseInt(compoundId.split(':')[1] ?? '1', 10)
  return Number.isFinite(level) ? Math.max(1, level) : 1
}

function clampFluct(fluct: number): number {
  return Number.isFinite(fluct) ? Math.max(70, Math.min(130, Math.round(fluct))) : 100
}

function equipFluct(compoundId: string): number {
  return clampFluct(Number.parseInt(compoundId.split(':')[2] ?? '100', 10))
}

function hashStr(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return hash >>> 0
}

const BONUS_POOL: { key: EquipStat; min: number; max: number }[] = [
  { key: 'atk', min: 10, max: 22 },
  { key: 'def', min: 8, max: 18 },
  { key: 'hp', min: 8, max: 20 },
  { key: 'spd', min: 1, max: 4 },
  { key: 'gold', min: 5, max: 12 },
  { key: 'xp', min: 5, max: 12 },
]

function genNoSetStats(eq: Equipment, level: number, fluct: number): EquipStats {
  // 只用规范的前三段，:copyN 是实例身份，不改变属性、词条或展示。
  const rng = createRng(hashStr(`${eq.id}:${level}:${fluct}`))
  const minCount = eq.rarity === 'epic' ? 3 : eq.rarity === 'rare' ? 2 : 1
  const statCount = minCount + Math.floor(rng() * 2)
  const lvlMult = 1 + (level - 1) * 0.12
  const remaining = [...BONUS_POOL]
  const result: EquipStats = {}
  for (let i = 0; i < statCount; i++) {
    const [bonus] = remaining.splice(Math.floor(rng() * remaining.length), 1)
    const baseValue = bonus.min + Math.floor(rng() * (bonus.max - bonus.min + 1))
    result[bonus.key] = Math.round(baseValue * lvlMult * fluct / 100)
  }
  return result
}

export function getEquipStats(compoundId: string): EquipStats {
  const eq = equipmentById(compoundId)
  if (!eq) return {}
  const level = equipLevel(compoundId)
  const fluct = equipFluct(compoundId)
  if (!eq.set) return genNoSetStats(eq, level, fluct)
  const lvlMult = 1 + (level - 1) * 0.12
  const scaled: EquipStats = {}
  for (const key of STAT_KEYS) {
    const value = eq.stats[key]
    if (value === undefined) continue
    // 保留套装装备原有等级公式；金币/经验词条只随等级成长。
    const raw = Math.round(value * lvlMult * (key === 'gold' || key === 'xp' ? 1 : fluct / 100))
    scaled[key] = key === 'atk' || key === 'def' || key === 'hp' ? Math.max(1, raw) : raw
  }
  return scaled
}

export function isNoSetItem(compoundId: string): boolean {
  return !equipmentById(compoundId)?.set
}

export function makeEquipId(baseId: string, level: number, fluct?: number, rng?: () => number): string {
  const eq = equipmentById(baseId)
  const id = eq?.id ?? baseId.split(':')[0]
  const lv = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1
  const f = clampFluct(fluct ?? (rng ? 70 + Math.floor(rng() * 61) : 100))
  return `${id}:${lv}:${f}`
}

export function formatEquipStats(compoundId: string): string[] {
  const eq = equipmentById(compoundId)
  if (!eq) return []
  const stats = getEquipStats(compoundId)
  const labels: Record<EquipStat, string> = { atk: '攻击', def: '防御', hp: '生命', spd: '速度', gold: '金币', xp: '经验' }
  const result: string[] = []
  for (const key of STAT_KEYS) {
    const value = stats[key]
    if (value === undefined) continue
    const percent = key === 'gold' || key === 'xp' || (!eq.set && (key === 'atk' || key === 'def'))
    result.push(`${labels[key]}${value >= 0 ? '+' : ''}${value}${percent ? '%' : ''}`)
  }
  return result
}

export type SortMode = 'quality' | 'level' | 'slot' | 'name' | 'set'

const QUALITY_ORDER: Record<EquipRarity, number> = { epic: 3, rare: 2, common: 1 }
const SLOT_ORDER: Record<EquipSlot, number> = { helmet: 1, armor: 2, gloves: 3, pants: 4, boots: 5 }

export function sortInventory(ids: string[], mode: SortMode = 'quality'): string[] {
  return [...ids].sort((a, b) => {
    const eqA = equipmentById(a)
    const eqB = equipmentById(b)
    const nameA = eqA?.name || ''
    const nameB = eqB?.name || ''
    const qA = QUALITY_ORDER[eqA?.rarity || 'common']
    const qB = QUALITY_ORDER[eqB?.rarity || 'common']
    const sA = SLOT_ORDER[eqA?.slot || 'boots']
    const sB = SLOT_ORDER[eqB?.slot || 'boots']
    const lvA = equipLevel(a)
    const lvB = equipLevel(b)
    const setA = eqA?.set ? 0 : 1
    const setB = eqB?.set ? 0 : 1

    switch (mode) {
      case 'level':
        if (lvA !== lvB) return lvB - lvA
        if (qA !== qB) return qB - qA
        return sA - sB
      case 'slot':
        if (sA !== sB) return sA - sB
        if (qA !== qB) return qB - qA
        return lvB - lvA
      case 'name':
        if (nameA !== nameB) return nameA.localeCompare(nameB)
        if (qA !== qB) return qB - qA
        return lvB - lvA
      case 'set':
        if (setA !== setB) return setA - setB
        if (qA !== qB) return qB - qA
        if (sA !== sB) return sA - sB
        return lvB - lvA
      default:
        if (qA !== qB) return qB - qA
        if (sA !== sB) return sA - sB
        return lvB - lvA
    }
  })
}
