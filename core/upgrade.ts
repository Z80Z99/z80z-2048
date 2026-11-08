import type { CardClass, CardEffect, UpgradeDef } from '../types'
import { validateCard } from './cardEffects'
export { canRemoveCard, validateCard } from './cardEffects'

export const CARD_CLASSES: CardClass[] = ['white', 'blue', 'gold', 'red', 'purple', 'black']
export const NORMAL_CARD_CLASSES: CardClass[] = ['white', 'blue', 'gold']

const effect = (type: CardEffect['type'], value: number, polarity: CardEffect['polarity'], scope: CardEffect['scope'], description: string): CardEffect =>
  ({ type, value, polarity, scope, description })
const card = (id: string, name: string, cardClass: CardClass, icon: string, effects: CardEffect[], kind: UpgradeDef['kind'] = 'persistent'): UpgradeDef =>
  ({ id, name, cardClass, kind, icon, effects, description: effects.map(item => item.description).join('；') })

export const UPGRADE_POOL: UpgradeDef[] = [
  card('atk_up_1', '攻击强化', 'white', 'attack', [effect('attackBonus', 0.08, 'positive', 'stat', '攻击倍率 +8%，按持有数量累加')]),
  card('def_up_1', '防御强化', 'white', 'defense', [effect('defenseBonus', 0.08, 'positive', 'stat', '防御倍率 +8%，按持有数量累加')]),
  card('max_hp_1', '生命训练', 'white', 'vitality', [effect('maxHpBonus', 8, 'positive', 'stat', '最大生命 +8，获得时等量恢复生命（受治疗衰减影响）')]),
  card('gold_1', '淘金者', 'white', 'wealth', [effect('goldBonus', 0.03, 'positive', 'stat', '战斗金币倍率 +3%，按持有数量累加')]),
  card('bonus_turn_0_5', '快速思考', 'blue', 'time', [effect('bonusTurns', 1, 'positive', 'parameter', '每回合可行动步数 +1')]),
  card('atk_up_2', '强力攻击', 'blue', 'attack', [effect('mergeCoefficient', 0.1, 'positive', 'parameter', '合并攻击积蓄系数 +10%')]),
  card('spawn_red_1', '灵活身法', 'blue', 'ward', [effect('spawnArmor', 0.2, 'positive', 'parameter', '新生成方块护甲系数 +20%')]),
  card('start_tile_1', '开局优势', 'blue', 'starting-tile', [effect('startingPoints', 4, 'positive', 'parameter', '每回合开局额外分配 4 点方块数值；空位不足时延后放置')]),
  card('gold_combo', '连锁战意', 'gold', 'attack', [effect('comboBonus', 4, 'positive', 'mechanic', '连续发生合并时，每层连锁额外积蓄 4 点攻击；未合并则连锁归零')]),
  card('gold_merge_armor', '锻甲合流', 'gold', 'defense', [effect('mergeArmor', 0.25, 'positive', 'mechanic', '每次合并按合并数值的 25% 生成机制护甲')]),
  card('gold_carry', '护甲传承', 'gold', 'ward', [effect('armorCarry', 0.25, 'positive', 'mechanic', '护甲保留评级 +0.25；回合间保留比例为总评级÷（1＋总评级），叠加趋近 100%')]),
  card('gold_lifesteal', '生命汲取', 'gold', 'health', [effect('lifestealRating', 0.08, 'positive', 'mechanic', '吸血评级 +0.08；吸血比例为总评级÷（1＋总评级），仅按实际攻击伤害恢复生命')]),
  card('red_berserk', '狂战契约', 'red', 'attack', [
    effect('burstCoefficient', 1, 'positive', 'mechanic', '爆发攻击系数 +100%'),
    effect('vulnerability', 0.3, 'negative', 'mechanic', '承受的敌人攻击伤害系数 +30%'),
  ]),
  card('red_blood', '血之契约', 'red', 'health', [
    effect('lifestealRating', 0.5, 'positive', 'mechanic', '吸血评级 +0.5；吸血比例为总评级÷（1＋总评级），仅按实际攻击伤害恢复生命'),
    effect('bleed', 3, 'negative', 'mechanic', '每回合结束流血损失 3 点生命'),
  ]),
  card('red_double', '双刃赌局', 'red', 'attack', [
    effect('extraStrikeRating', 1, 'positive', 'mechanic', '追加攻击评级 +1；独立抽签概率为总评级÷（1＋总评级），每回合至多额外攻击一次'),
    effect('backlash', 4, 'negative', 'mechanic', '触发追加攻击时反噬损失 4 点生命'),
  ]),
  card('curse_burn', '灼烧诅咒', 'purple', 'weakness', [effect('burn', 2, 'negative', 'mechanic', '每回合结束灼烧损失 2 点生命；仅可净化移除')]),
  card('curse_decay', '衰败诅咒', 'purple', 'weakness', [effect('healingPenalty', 0.2, 'negative', 'mechanic', '治疗衰减评级 +0.2；治疗削减比例为总评级÷（1＋总评级），仅可净化移除')]),
  card('curse_charge', '散能诅咒', 'purple', 'weakness', [effect('chargeLoss', 0.15, 'negative', 'mechanic', '攻击散失评级 +0.15；每次合并新增积蓄按 1÷（1＋总评级）保留，不追溯已有积蓄，仅可净化移除')]),
  card('doom_soul', '噬魂宿命', 'black', 'weakness', [effect('soulRecoil', 2, 'negative', 'mechanic', '每次有效合并移动反噬损失 2 点生命；本局无法移除')]),
  card('doom_rebirth', '轮回宿命', 'black', 'vitality', [effect('enemyRegen', 4, 'negative', 'mechanic', '每回合结束存活敌人恢复 4 点生命，不超过敌人生命上限；本局无法移除')]),
  card('balanced_1', '均衡训练', 'white', 'vitality', [
    effect('attackBonus', 0.05, 'positive', 'stat', '攻击倍率 +5%，按持有数量累加'),
    effect('defenseBonus', 0.05, 'positive', 'stat', '防御倍率 +5%，按持有数量累加'),
  ]),
  card('vigor_1', '血脉坚韧', 'white', 'health', [
    effect('maxHpBonus', 6, 'positive', 'stat', '最大生命 +6，获得时等量恢复生命（受治疗衰减影响）'),
    effect('defenseBonus', 0.03, 'positive', 'stat', '防御倍率 +3%，按持有数量累加'),
  ]),
  card('xp_1', '见多识广', 'white', 'wealth', [effect('xpBonus', 0.1, 'positive', 'stat', '战斗获得经验 +10%，按持有数量累加')]),
  card('charge_start_1', '蓄力起步', 'blue', 'time', [effect('chargeStart', 3, 'positive', 'parameter', '每回合开局自带 3 点蓄力')]),
  card('spawn_luck_1', '幸运生成', 'blue', 'starting-tile', [effect('spawnLuck', 0.05, 'positive', 'parameter', '新方块更容易出现高数值；叠加后无限接近必出')]),
  card('halve_shield_1', '减半护佑', 'blue', 'ward', [effect('halveShield', 0.1, 'positive', 'parameter', '回合结束时每个方块有机会不减半；叠加后无限接近必不减半')]),
  card('gold_combo_grace', '连锁回响', 'gold', 'attack', [effect('comboGrace', 0.5, 'positive', 'mechanic', '未合并的回合，连锁按保留比例延续（向下取整）；叠加后保留更多')]),
  card('gold_execute', '猎手印记', 'gold', 'attack', [effect('executeRating', 0.05, 'positive', 'mechanic', '攻击后敌人生命低于斩杀线时直接击杀；叠加后斩杀线提高')]),
  card('gold_crit', '致命节奏', 'gold', 'attack', [effect('critRating', 0.08, 'positive', 'mechanic', '攻击有几率造成双倍伤害；叠加后几率提高')]),
  card('gold_saved_steps', '过载核心', 'gold', 'time', [effect('savedStepsCharge', 2, 'positive', 'mechanic', '回合结束时每剩余 1 步，转化为下回合开局蓄力')]),
  card('red_hunt', '猎魔契约', 'red', 'attack', [
    effect('executeRating', 1, 'positive', 'mechanic', '攻击后敌人生命低于斩杀线（最大生命的50%）时直接击杀'),
    effect('vulnerability', 0.25, 'negative', 'mechanic', '承受的敌人攻击伤害系数 +25%'),
  ]),
  card('red_greed', '贪婪之约', 'red', 'wealth', [
    effect('greedRating', 1, 'positive', 'mechanic', '战斗金币收益翻倍'),
    effect('burn', 4, 'negative', 'mechanic', '每回合结束灼烧损失 4 点生命'),
  ]),
  card('curse_heavy', '迟滞诅咒', 'purple', 'weakness', [effect('heavyLegs', 1, 'negative', 'mechanic', '每回合行动步数减少，最多减到 1 步；仅可净化移除')]),
  card('curse_brittle', '脆甲诅咒', 'purple', 'weakness', [effect('armorErosion', 0.15, 'negative', 'mechanic', '回合间保留的护甲会被侵蚀抵扣；仅可净化移除')]),
  card('doom_rage', '阴影低语', 'black', 'weakness', [effect('enemyRage', 1, 'negative', 'mechanic', '敌人攻击每回合成长；本局无法移除')]),
  card('heal_1', '急救包', 'white', 'health', [effect('heal', 12, 'positive', 'stat', '立即恢复 12 点生命，受治疗衰减影响且不超过最大生命；不加入持有卡牌')], 'instant'),
  card('heal_2', '大急救包', 'white', 'health', [effect('heal', 30, 'positive', 'stat', '立即恢复 30 点生命，受治疗衰减影响且不超过最大生命；不加入持有卡牌')], 'instant'),
]

if (UPGRADE_POOL.some(def => !validateCard(def)) || new Set(UPGRADE_POOL.map(def => def.id)).size !== UPGRADE_POOL.length) {
  throw new Error('卡牌定义不符合六色分类规则或编号重复')
}
const CARD_BY_ID = new Map(UPGRADE_POOL.map(def => [def.id, def]))
export function cardById(id: string): UpgradeDef | undefined {
  return CARD_BY_ID.get(id)
}

export interface PickUpgradeOptions {
  count?: number;
  allowedClasses?: CardClass[];
  excludeHeal?: boolean;
  hpRatio?: number;
}

const CLASS_WEIGHTS: Record<CardClass, number> = { white: 60, blue: 30, gold: 10, red: 1, purple: 1, black: 1 }

export function pickUpgrades(rng: () => number, opts: PickUpgradeOptions = {}): UpgradeDef[] {
  const requested = opts.count ?? 3
  const count = Number.isFinite(requested) ? Math.max(0, Math.floor(requested)) : 0
  const allowed = opts.allowedClasses ?? NORMAL_CARD_CLASSES
  const remaining = UPGRADE_POOL.filter(def => allowed.includes(def.cardClass) && !(opts.excludeHeal && def.kind === 'instant'))
  const picked: UpgradeDef[] = []
  if (count === 0 || remaining.length === 0) return picked
  // 仅当白卡允许且没有排除治疗时，低生命才保证出现治疗。
  if ((opts.hpRatio ?? 1) < 0.5 && !opts.excludeHeal && allowed.includes('white')) {
    const healIndex = remaining.findIndex(def => def.kind === 'instant')
    if (healIndex >= 0) picked.push(...remaining.splice(healIndex, 1))
  }
  while (picked.length < count && remaining.length > 0) {
    const classes = CARD_CLASSES.filter(cardClass => remaining.some(def => def.cardClass === cardClass))
    const totalWeight = classes.reduce((sum, cardClass) => sum + CLASS_WEIGHTS[cardClass], 0)
    let roll = rng() * totalWeight
    let selectedClass = classes[classes.length - 1]
    for (const cardClass of classes) {
      roll -= CLASS_WEIGHTS[cardClass]
      if (roll < 0) {
        selectedClass = cardClass
        break
      }
    }
    const candidates = remaining.filter(def => def.cardClass === selectedClass)
    const selected = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(rng() * candidates.length)))]
    picked.push(selected)
    remaining.splice(remaining.indexOf(selected), 1)
  }
  return picked
}

// 无默认价：未知定义、紫卡和黑卡均不可购买。红卡仅用于明确的风险来源。
export function upgradeCost(def: Pick<UpgradeDef, 'cardClass'> | undefined): number | null {
  switch (def?.cardClass) {
    case 'white': return 20
    case 'blue': return 50
    case 'gold': return 90
    case 'red': return 0
    default: return null
  }
}

export function cardClassText(cardClass: string): string {
  const texts: Record<CardClass, string> = { white: '白色·属性', blue: '蓝色·参数', gold: '金色·机制', red: '红色·风险', purple: '紫色·诅咒', black: '黑色·宿命' }
  return Object.prototype.hasOwnProperty.call(texts, cardClass) ? texts[cardClass as CardClass] : '未知卡牌'
}

export function cardClassDescription(cardClass: string): string {
  const descriptions: Record<CardClass, string> = {
    white: '只提升基础属性；治疗卡为即时效果，不加入持有卡牌。',
    blue: '只改变战斗参数，不改变基础攻击、防御或生命。',
    gold: '只提供正面战斗机制。',
    red: '同时包含一个强力正面机制和一个负面机制，须完整接受代价。',
    purple: '只包含负面机制，商店不能移除，仅可净化。',
    black: '只包含负面机制，确认获得后本局无法移除。',
  }
  return Object.prototype.hasOwnProperty.call(descriptions, cardClass) ? descriptions[cardClass as CardClass] : '未知卡牌分类。'
}

export function cardEffectText(effect: CardEffect): string {
  return effect.description
}

export function getMetaUpgrades() {
  return [
    { id: 'meta_hp_1', name: '生命训练 I', description: '初始最大生命 +10', cost: 10, tiers: 1 },
    { id: 'meta_hp_2', name: '生命训练 II', description: '初始最大生命 +10', cost: 30, tiers: 1 },
    { id: 'meta_atk_1', name: '攻击本能 I', description: '初始攻击倍率 +10%', cost: 15, tiers: 1 },
    { id: 'meta_atk_2', name: '攻击本能 II', description: '初始攻击倍率 +10%', cost: 50, tiers: 1 },
    { id: 'meta_start', name: '初始优势', description: '开局获得一次强化选择', cost: 40, tiers: 1 },
  ]
}
