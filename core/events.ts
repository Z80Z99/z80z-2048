import { ALL_EQUIPMENT, equipmentById, formatEquipStats, makeEquipId } from './equipment'
import { cardById, cardClassText, cardEffectText, validateCard } from './upgrade'
import { consumableById, validateConsumable } from './consumables'
import type { EventEffectMap } from '../types'

export type OutcomeTone = 'good' | 'mid' | 'bad'

export interface EventOutcome {
  /** 抽取权重（百分数），同选项三个结果权重之和为 100。 */
  weight: number
  /** 档位名，按事件主题化命名（满载/有点收获/空箱、稳步落地/磨破手掌/踩空半步等）。 */
  label: string
  /** 好坏程度，用于结果页着色。 */
  tone: OutcomeTone
  effect: EventEffect
}

export interface EventChoice {
  label: string
  /** 恰好三个随机结果；选项只展示代价，收获不预告，点选即按权重结算其一。 */
  outcomes: EventOutcome[]
}

export interface EventEffect extends EventEffectMap {
  type: string
}

export interface EventGrant {
  id: string
  count: number
}

export interface EventChoiceContext {
  inventory?: string[]
  equipment?: Record<string, string | undefined>
  gold?: number
  hp?: number
  /** 可净化的紫卡总层数；card_trade 需要移除紫卡时用于预检。 */
  purpleLayers?: number
}

// 结算结果只含已掷出的数值；结算后缓存此结果用于展示，不要再次掷骰。
export type ResolvedEventEffect =
  | { type: 'none' }
  | { type: 'gold'; value: number; paid?: boolean }
  | { type: 'heal' | 'hp_reduce' | 'maxhp_down' | 'maxhp_up' | 'xp'; value: number }
  | { type: 'hp_reduce_pct' | 'maxhp_down_pct'; value: number; atk_mult: number; def_mult: number }
  | { type: 'heal_curse'; heal: number; curse_hp: number }
  | { type: 'gold_heal'; heal: number; gold: number }
  | { type: 'gold_xp'; gold: number; xp: number }
  | { type: 'drop_equip'; eqId: string; cost: number }
  | { type: 'reforge'; removeEqId: string; eqId: string; gold: number; cost: number }
  | {
    type: 'card_trade'
    cardGrants: EventGrant[]
    consumableGrants?: EventGrant[]
    cost: number
    gold: number
    hpCost: number
    removesPurple: number
  }

export interface GameEvent {
  id: string
  title: string
  icon: string
  desc: string
  stageMin: number
  /** 强制奇遇：没有安全离开，玩家必须选择一项；每事件至少有一个选项的全部三档不依赖金币、生命或持有物。 */
  forced?: boolean
  choices: EventChoice[]
}

export interface ResolvedEventOutcome {
  tone: OutcomeTone
  label: string
  effect: ResolvedEventEffect
}

type NumberRoll = number | { min: number; max: number }

function isNumberRoll(value: unknown): value is NumberRoll {
  if (typeof value === 'number') return Number.isFinite(value)
  if (!value || typeof value !== 'object') return false
  const range = value as { min: number; max: number }
  return Number.isSafeInteger(range.min) && Number.isSafeInteger(range.max) && range.min <= range.max
}

function rollNumber(value: NumberRoll, rng: () => number): number {
  return typeof value === 'number' ? value : value.min + Math.floor(rng() * (value.max - value.min + 1))
}

function o(weight: number, label: string, tone: OutcomeTone, effect: EventEffect): EventOutcome {
  // 现有全部负金币档都是玩家主动支付（购买/赌注/投币/洒币），计入“挥金如土”消费统计；
  // 未来的被动损失档需显式写 paid: false，避免被自动计入。
  if (effect.type === 'gold' && typeof effect.value === 'number' && effect.value < 0) effect.paid = true
  return { weight, label, tone, effect }
}

function pick(label: string, a: EventOutcome, b: EventOutcome, c: EventOutcome): EventChoice {
  return { label, outcomes: [a, b, c] }
}

function tradeO(
  weight: number, label: string, tone: OutcomeTone, grants: EventGrant[],
  opts: { consumableGrants?: EventGrant[]; cost?: number; gold?: NumberRoll; hpCost?: number; removesPurple?: number } = {},
): EventOutcome {
  const effect: EventEffect = {
    type: 'card_trade', grants, cost: opts.cost ?? 0, gold: opts.gold ?? 0,
    hpCost: opts.hpCost ?? 0, removesPurple: opts.removesPurple ?? 0,
  }
  if (opts.consumableGrants) effect.consumableGrants = opts.consumableGrants
  return o(weight, label, tone, effect)
}

const EVENTS: GameEvent[] = [
  // ===== Stage 1+ =====
  {
    id: 'treasure_chest',
    title: '宝箱',
    icon: '🎁',
    desc: '一只落满灰尘的木箱静静躺在角落。锁已经锈死，但盖子微微翘起。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('撬开箱盖',
        o(40, '满载', 'good', { type: 'gold', value: { min: 18, max: 30 } }),
        o(45, '有点收获', 'mid', { type: 'gold', value: { min: 8, max: 16 } }),
        o(15, '空箱', 'bad', { type: 'gold', value: { min: 1, max: 5 } })),
    ],
  },
  {
    id: 'healing_fountain',
    title: '治愈之泉',
    icon: '⛲',
    desc: '石头缝隙间涌出一汪清泉，水面上映着微光。你可以在这里补充饮水。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('畅饮泉水',
        o(70, '清冽甘泉', 'good', { type: 'heal', value: 30 }),
        o(20, '水中带刺', 'bad', { type: 'heal_curse', heal: 30, curse_hp: 10 }),
        o(10, '泉水浑浊', 'mid', { type: 'heal', value: 10 })),
      pick('轻抿一口',
        o(60, '精神一振', 'good', { type: 'heal', value: 12 }),
        o(30, '微有凉意', 'mid', { type: 'heal', value: 8 }),
        o(10, '无甚感觉', 'mid', { type: 'none' })),
      pick('装瓶出售泉水',
        o(45, '卖了个好价钱', 'good', { type: 'gold', value: { min: 15, max: 25 } }),
        o(40, '正常价钱', 'mid', { type: 'gold', value: { min: 10, max: 14 } }),
        o(15, '途中洒了', 'bad', { type: 'gold', value: { min: 2, max: 5 } })),
    ],
  },
  {
    id: 'dark_shrine',
    title: '暗影祭坛',
    icon: '🌑',
    desc: '不祥的黑色祭坛散发低语，似乎想用力量换取你的一部分。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('献上 20% 当前生命',
        o(50, '神明回应', 'good', { type: 'hp_reduce_pct', value: 20, atk_mult: 0.1 }),
        o(35, '低语应允', 'mid', { type: 'hp_reduce_pct', value: 20, atk_mult: 0.08 }),
        o(15, '祭品被无视', 'bad', { type: 'hp_reduce_pct', value: 20, atk_mult: 0.04 })),
      pick('献上 15% 基础生命上限',
        o(50, '强大庇佑', 'good', { type: 'maxhp_down_pct', value: 15, def_mult: 0.15 }),
        o(35, '稳固庇佑', 'mid', { type: 'maxhp_down_pct', value: 15, def_mult: 0.12 }),
        o(15, '庇佑摇曳', 'bad', { type: 'maxhp_down_pct', value: 15, def_mult: 0.06 })),
    ],
  },
  {
    id: 'fallen_warrior',
    title: '陨落战士',
    icon: '⚔',
    desc: '一名战士倒在路上，装备散落一地。他已经不需要这些东西了。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('拾取遗落装备',
        o(45, '完好武器', 'good', { type: 'drop_equip', rarity: 'common' }),
        o(40, '备用钱袋', 'mid', { type: 'gold', value: { min: 12, max: 20 } }),
        o(15, '只剩碎布', 'bad', { type: 'none' })),
      pick('搜刮钱袋',
        o(40, '鼓鼓囊囊', 'good', { type: 'gold', value: { min: 24, max: 35 } }),
        o(45, '有点收获', 'mid', { type: 'gold', value: { min: 12, max: 20 } }),
        o(15, '空空如也', 'bad', { type: 'gold', value: { min: 4, max: 8 } })),
    ],
  },
  {
    id: 'risk_shrine',
    title: '狂战祭坛',
    icon: '🔥',
    desc: '血红色的祭坛上刻着古老的契约，等待愿意付出代价的人。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('接受狂战契约',
        tradeO(40, '血契狂喜', 'good', [{ id: 'red_berserk', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'red_berserk', count: 1 }]),
        o(15, '血祭失败', 'bad', { type: 'none' })),
      pick('接受血之契约',
        tradeO(40, '血契狂喜', 'good', [{ id: 'red_blood', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'red_blood', count: 1 }]),
        o(15, '血祭失败', 'bad', { type: 'none' })),
      pick('接受双刃赌局',
        tradeO(40, '血契狂喜', 'good', [{ id: 'red_double', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'red_double', count: 1 }]),
        o(15, '血祭失败', 'bad', { type: 'none' })),
      pick('接受猎魔契约',
        tradeO(40, '血契狂喜', 'good', [{ id: 'red_hunt', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'red_hunt', count: 1 }]),
        o(15, '血祭失败', 'bad', { type: 'none' })),
      pick('接受贪婪之约',
        tradeO(40, '血契狂喜', 'good', [{ id: 'red_greed', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'red_greed', count: 1 }]),
        o(15, '血祭失败', 'bad', { type: 'none' })),
      pick('接受浴血狂怒',
        tradeO(40, '血契狂喜', 'good', [{ id: 'blood_fury', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'blood_fury', count: 1 }]),
        o(15, '血祭失败', 'bad', { type: 'none' })),
      pick('接受棘盾契约',
        tradeO(40, '血契狂喜', 'good', [{ id: 'thorn_aegis', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'thorn_aegis', count: 1 }]),
        o(15, '血祭失败', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'gambler',
    title: '赌徒的邀约',
    icon: '🎲',
    desc: '披着斗篷的赌徒摇着骰盅，邀请你赌一把运气。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('赌一把（20 金币）',
        o(45, '手气极佳', 'good', { type: 'drop_equip', rarity: 'rare', cost: 20 }),
        o(25, '押中彩头', 'mid', { type: 'drop_equip', rarity: 'common', cost: 20 }),
        o(30, '输个精光', 'bad', { type: 'gold', value: -20 })),
      pick('押上一点运气',
        o(25, '居然中了', 'good', { type: 'drop_equip', rarity: 'common' }),
        o(35, '捡到铜板', 'mid', { type: 'gold', value: { min: 4, max: 10 } }),
        o(40, '白费力气', 'bad', { type: 'none' })),
      pick('谨慎下注（5 金币）',
        o(45, '稳稳命中', 'good', { type: 'drop_equip', rarity: 'common', cost: 5 }),
        o(35, '赚回本金', 'mid', { type: 'gold', value: { min: 6, max: 12 } }),
        o(20, '亏掉赌注', 'bad', { type: 'gold', value: -5 })),
    ],
  },
  {
    id: 'ancient_scroll',
    title: '远古卷轴',
    icon: '📜',
    desc: '一卷古旧的羊皮纸摊在石台上，墨迹隐隐发亮。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('仔细研读',
        o(45, '豁然贯通', 'good', { type: 'xp', value: { min: 40, max: 60 } }),
        o(40, '略有所得', 'mid', { type: 'xp', value: { min: 20, max: 32 } }),
        o(15, '字迹模糊', 'bad', { type: 'xp', value: { min: 5, max: 10 } })),
      pick('简略翻阅',
        o(50, '快速浏览', 'good', { type: 'xp', value: 18 }),
        o(35, '匆匆一瞥', 'mid', { type: 'xp', value: 10 }),
        o(15, '无心阅读', 'bad', { type: 'none' })),
      pick('出售卷轴',
        o(45, '遇到识货人', 'good', { type: 'gold', value: { min: 12, max: 20 } }),
        o(40, '正常成交', 'mid', { type: 'gold', value: { min: 8, max: 14 } }),
        o(15, '只能贱卖', 'bad', { type: 'gold', value: { min: 3, max: 6 } })),
    ],
  },
  {
    id: 'spike_trap',
    title: '看似平静的地面',
    icon: '🪤',
    desc: '这段地面看起来平整，但边缘的石缝里似乎藏着机关。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('试着拆除机关',
        o(40, '完美拆除', 'good', { type: 'gold', value: { min: 18, max: 30 } }),
        o(35, '勉强拆掉', 'mid', { type: 'gold', value: { min: 8, max: 15 } }),
        o(25, '机关触发', 'bad', { type: 'hp_reduce', value: 12 })),
      pick('快速冲刺过去',
        o(55, '一跃而过', 'good', { type: 'none' }),
        o(30, '落地踉跄', 'mid', { type: 'hp_reduce', value: 6 }),
        o(15, '重重摔倒', 'bad', { type: 'hp_reduce', value: 18 })),
    ],
  },
  {
    id: 'cursed_archive',
    title: '诅咒藏书室',
    icon: '📚',
    desc: '藏书室的书架渗出黑气，每一本书都用锁链缚着。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('研读连锁书卷',
        tradeO(40, '完全领悟', 'good', [{ id: 'gold_combo', count: 1 }, { id: 'curse_burn', count: 1 }], { gold: { min: 8, max: 14 } }),
        tradeO(45, '习得诅咒', 'mid', [{ id: 'gold_combo', count: 1 }, { id: 'curse_burn', count: 1 }]),
        o(15, '书灵抗拒', 'bad', { type: 'none' })),
      pick('研读汲取书卷',
        tradeO(40, '完全领悟', 'good', [{ id: 'gold_lifesteal', count: 1 }, { id: 'curse_decay', count: 1 }], { gold: { min: 8, max: 14 } }),
        tradeO(45, '习得诅咒', 'mid', [{ id: 'gold_lifesteal', count: 1 }, { id: 'curse_decay', count: 1 }]),
        o(15, '书灵抗拒', 'bad', { type: 'none' })),
      pick('研读传承书卷',
        tradeO(40, '完全领悟', 'good', [{ id: 'gold_merge_armor', count: 1 }, { id: 'gold_carry', count: 1 }, { id: 'curse_charge', count: 1 }], { gold: { min: 8, max: 14 } }),
        tradeO(45, '习得诅咒', 'mid', [{ id: 'gold_merge_armor', count: 1 }, { id: 'gold_carry', count: 1 }, { id: 'curse_charge', count: 1 }]),
        o(15, '书灵抗拒', 'bad', { type: 'none' })),
      pick('研读迟滞书卷',
        tradeO(40, '完全领悟', 'good', [{ id: 'gold_crit', count: 1 }, { id: 'curse_heavy', count: 1 }], { gold: { min: 8, max: 14 } }),
        tradeO(45, '习得诅咒', 'mid', [{ id: 'gold_crit', count: 1 }, { id: 'curse_heavy', count: 1 }]),
        o(15, '书灵抗拒', 'bad', { type: 'none' })),
      pick('研读过载书卷',
        tradeO(40, '完全领悟', 'good', [{ id: 'gold_saved_steps', count: 1 }, { id: 'curse_brittle', count: 1 }], { gold: { min: 8, max: 14 } }),
        tradeO(45, '习得诅咒', 'mid', [{ id: 'gold_saved_steps', count: 1 }, { id: 'curse_brittle', count: 1 }]),
        o(15, '书灵抗拒', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'alchemy_supply',
    title: '炼金补给',
    icon: '⚗',
    desc: '路边支着炼金商人的摊子，架上摆满了叮当作响的药剂。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('购买战术药剂（35 金币）',
        tradeO(45, '附赠赠品', 'good', [], { consumableGrants: [{ id: 'tactical_potion', count: 1 }], cost: 35, gold: { min: 6, max: 12 } }),
        tradeO(40, '正常购买', 'mid', [], { consumableGrants: [{ id: 'tactical_potion', count: 1 }], cost: 35 }),
        o(15, '钱袋被调包', 'bad', { type: 'gold', value: -35 })),
      pick('帮忙整理药材',
        o(45, '店主道谢', 'good', { type: 'gold', value: { min: 8, max: 14 } }),
        o(40, '些许酬劳', 'mid', { type: 'gold', value: { min: 4, max: 8 } }),
        o(15, '白忙一场', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'cleansing_hermit',
    title: '流浪的净化师',
    icon: '🧙',
    desc: '白袍净化师坐在路旁，面前摆着一盏圣水灯，专司解除诅咒。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('支付 40 金币，净化一层紫卡',
        tradeO(50, '净化完成', 'good', [], { cost: 40, removesPurple: 1, gold: { min: 6, max: 10 } }),
        tradeO(35, '净化顺利', 'mid', [], { cost: 40, removesPurple: 1 }),
        o(15, '仪式被打断', 'bad', { type: 'none' })),
      pick('听一段旧事',
        o(50, '引人入胜', 'good', { type: 'xp', value: 14 }),
        o(35, '些许感悟', 'mid', { type: 'xp', value: 8 }),
        o(15, '呢喃难懂', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'mysterious_box',
    title: '神秘黑匣',
    icon: '📦',
    desc: '一只漆黑的匣子半埋在土里，缝隙中透出微光。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('打破封印',
        o(45, '匣藏珍品', 'good', { type: 'drop_equip', rarity: 'rare' }),
        o(40, '寻常器物', 'mid', { type: 'drop_equip', rarity: 'common' }),
        o(15, '空盒', 'bad', { type: 'none' })),
      pick('搜寻夹层',
        o(40, '隐藏金币', 'good', { type: 'gold', value: { min: 24, max: 40 } }),
        o(45, '少量金币', 'mid', { type: 'gold', value: { min: 12, max: 20 } }),
        o(15, '夹层是空的', 'bad', { type: 'none' })),
      pick('只拾取地面金币',
        o(40, '散落的赏金', 'good', { type: 'gold', value: { min: 8, max: 12 } }),
        o(45, '几枚硬币', 'mid', { type: 'gold', value: { min: 4, max: 7 } }),
        o(15, '只有尘土', 'bad', { type: 'gold', value: { min: 1, max: 2 } })),
    ],
  },
  {
    id: 'dying_merchant',
    title: '垂死商人',
    icon: '🧝',
    desc: '商人身负重伤倒在路边，行囊就放在手边。他还有一口气。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('协助包扎并分享药剂',
        o(40, '丰厚酬谢', 'good', { type: 'gold_heal', heal: 12, gold: { min: 8, max: 15 } }),
        o(45, '衷心感谢', 'mid', { type: 'gold_heal', heal: 10, gold: { min: 4, max: 8 } }),
        o(15, '商人昏迷', 'bad', { type: 'none' })),
      pick('拿走行囊与手记',
        o(40, '满载而归', 'good', { type: 'gold_xp', gold: { min: 35, max: 55 }, xp: { min: 18, max: 28 } }),
        o(45, '有点收获', 'mid', { type: 'gold_xp', gold: { min: 20, max: 32 }, xp: { min: 10, max: 16 } }),
        o(15, '只有杂物', 'bad', { type: 'gold_xp', gold: { min: 5, max: 10 }, xp: { min: 2, max: 5 } })),
    ],
  },
  {
    id: 'ancient_anvil',
    title: '远古锻造台',
    icon: '🔨',
    desc: '巨石的凹槽里炉火未熄，这是一座仍在工作的远古锻造台。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('淬火（消耗 25 金币）',
        o(45, '神兵出世', 'good', { type: 'drop_equip', rarity: 'epic', cost: 25 }),
        o(40, '合格作品', 'mid', { type: 'drop_equip', rarity: 'rare', cost: 25 }),
        o(15, '淬火失败', 'bad', { type: 'drop_equip', rarity: 'common', cost: 25 })),
      pick('拆装置换（消耗 1 件普通装备）',
        o(40, '精工重铸', 'good', { type: 'reforge', sell_price: { min: 20, max: 25 }, new_rarity: 'rare' }),
        o(45, '普通重铸', 'mid', { type: 'reforge', sell_price: { min: 12, max: 18 }, new_rarity: 'rare' }),
        o(15, '失手损毁', 'bad', { type: 'reforge', sell_price: { min: 4, max: 8 }, new_rarity: 'common' })),
      pick('拾取供台金币',
        o(40, '厚重的赏钱', 'good', { type: 'gold', value: { min: 10, max: 18 } }),
        o(45, '零散金币', 'mid', { type: 'gold', value: { min: 5, max: 9 } }),
        o(15, '只剩碎屑', 'bad', { type: 'gold', value: { min: 1, max: 3 } })),
      pick('感受炉温恢复',
        o(45, '暖意融融', 'good', { type: 'heal', value: 8 }),
        o(40, '稍作休整', 'mid', { type: 'heal', value: 5 }),
        o(15, '烟气呛人', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'abyss_contract',
    title: '深渊契约',
    icon: '🕳️',
    desc: '深渊在石台上摊开契约，金色的力量与黑色的宿命写在同一页。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('接受锻甲合流与噬魂宿命',
        tradeO(40, '深渊回赠', 'good', [{ id: 'gold_merge_armor', count: 1 }, { id: 'doom_soul', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'gold_merge_armor', count: 1 }, { id: 'doom_soul', count: 1 }]),
        tradeO(15, '只换来黑影', 'bad', [{ id: 'doom_soul', count: 1 }])),
      pick('接受生命汲取与轮回宿命',
        tradeO(40, '深渊回赠', 'good', [{ id: 'gold_lifesteal', count: 1 }, { id: 'doom_rebirth', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'gold_lifesteal', count: 1 }, { id: 'doom_rebirth', count: 1 }]),
        tradeO(15, '只换来黑影', 'bad', [{ id: 'doom_rebirth', count: 1 }])),
      pick('接受连锁回响与阴影低语',
        tradeO(40, '深渊回赠', 'good', [{ id: 'gold_combo_grace', count: 1 }, { id: 'doom_rage', count: 1 }], { gold: { min: 10, max: 18 } }),
        tradeO(45, '契约生效', 'mid', [{ id: 'gold_combo_grace', count: 1 }, { id: 'doom_rage', count: 1 }]),
        tradeO(15, '只换来黑影', 'bad', [{ id: 'doom_rage', count: 1 }])),
    ],
  },
  {
    id: 'abandoned_camp',
    title: '废弃营地',
    icon: '🏕️',
    desc: '一堆熄灭的篝火，散落的行囊——有人在这里扎营后匆匆离开。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('使用残留药品',
        o(45, '药效尚存', 'good', { type: 'heal', value: 22 }),
        o(40, '药力微弱', 'mid', { type: 'heal', value: 12 }),
        o(15, '药瓶已空', 'bad', { type: 'none' })),
      pick('翻找药箱',
        tradeO(40, '完整药瓶', 'good', [], { consumableGrants: [{ id: 'tactical_potion', count: 1 }] }),
        o(40, '散落药粉', 'mid', { type: 'gold', value: { min: 6, max: 12 } }),
        o(20, '只剩空瓶', 'bad', { type: 'none' })),
      pick('搜集营地散币',
        o(40, '埋藏的钱袋', 'good', { type: 'gold', value: { min: 10, max: 18 } }),
        o(45, '零散硬币', 'mid', { type: 'gold', value: { min: 5, max: 9 } }),
        o(15, '一无所获', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'lost_messenger',
    title: '迷路的信使',
    icon: '✉️',
    desc: '信使在岔路口来回踱步，手里的包裹又重又急。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('帮忙运送，领取报酬',
        tradeO(45, '重礼相酬', 'good', [{ id: 'xp_1', count: 1 }], { gold: { min: 20, max: 30 }, hpCost: 18 }),
        tradeO(40, '如约支付', 'mid', [{ id: 'xp_1', count: 1 }], { gold: { min: 12, max: 20 }, hpCost: 18 }),
        o(15, '空手而归', 'bad', { type: 'none' })),
      pick('购买旅行手记（15 金币）',
        tradeO(45, '内容翔实', 'good', [{ id: 'xp_1', count: 1 }], { cost: 15, gold: { min: 5, max: 10 } }),
        tradeO(40, '普通手记', 'mid', [{ id: 'xp_1', count: 1 }], { cost: 15 }),
        o(15, '无用小册', 'bad', { type: 'gold', value: -15 })),
      pick('顺路捎一段口信',
        o(45, '酬谢金币', 'good', { type: 'gold', value: { min: 8, max: 12 } }),
        o(40, '一句道谢', 'mid', { type: 'gold', value: { min: 3, max: 6 } }),
        o(15, '白跑一趟', 'bad', { type: 'none' })),
      pick('购买备用行装（30 金币）',
        o(40, '结实的护具', 'good', { type: 'drop_equip', rarity: 'common', cost: 30 }),
        tradeO(45, '买到补给', 'mid', [], { cost: 30, consumableGrants: [{ id: 'tactical_potion', count: 1 }] }),
        o(15, '买了假货', 'bad', { type: 'gold', value: -30 })),
    ],
  },
  {
    id: 'training_room',
    title: '机关训练室',
    icon: '🏋️',
    desc: '石室里摆满训练机关，掌事的教官正在等待学员。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('进行实战演练',
        tradeO(50, '收获颇丰', 'good', [{ id: 'balanced_1', count: 1 }], { hpCost: 10, gold: { min: 5, max: 10 } }),
        tradeO(35, '有所进步', 'mid', [{ id: 'balanced_1', count: 1 }], { hpCost: 10 }),
        o(15, '动作变形', 'bad', { type: 'hp_reduce', value: 10 })),
      pick('参加防御课程（20 金币）',
        tradeO(45, '要点尽得', 'good', [{ id: 'def_up_1', count: 1 }], { cost: 20, gold: { min: 5, max: 10 } }),
        tradeO(40, '正常上课', 'mid', [{ id: 'def_up_1', count: 1 }], { cost: 20 }),
        o(15, '听打瞌睡', 'bad', { type: 'gold', value: -20 })),
      pick('参加耐力课程（20 金币）',
        tradeO(45, '要点尽得', 'good', [{ id: 'vigor_1', count: 1 }], { cost: 20, gold: { min: 5, max: 10 } }),
        tradeO(40, '正常上课', 'mid', [{ id: 'vigor_1', count: 1 }], { cost: 20 }),
        o(15, '听打瞌睡', 'bad', { type: 'gold', value: -20 })),
      pick('旁观课程',
        o(50, '记下要点', 'good', { type: 'xp', value: 12 }),
        o(35, '一知半解', 'mid', { type: 'xp', value: 6 }),
        o(15, '无事发生', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'statue_purse',
    title: '石像的口袋',
    icon: '🗿',
    desc: '路边的石像腰间雕着一只口袋，缝隙里似乎藏着东西。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('拾取外侧散币',
        o(40, '口袋松动', 'good', { type: 'gold', value: { min: 10, max: 18 } }),
        o(45, '几枚硬币', 'mid', { type: 'gold', value: { min: 5, max: 9 } }),
        o(15, '只有石屑', 'bad', { type: 'none' })),
      pick('拆开机关暗袋',
        o(40, '完美开袋', 'good', { type: 'gold', value: { min: 25, max: 40 } }),
        o(35, '勉强掏出', 'mid', { type: 'gold', value: { min: 12, max: 20 } }),
        o(25, '触发机关', 'bad', { type: 'hp_reduce', value: 12 })),
      pick('买通守袋者（25 金币）',
        o(40, '交出袋中物', 'good', { type: 'drop_equip', rarity: 'common', cost: 25 }),
        tradeO(45, '只好买药', 'mid', [], { cost: 25, consumableGrants: [{ id: 'tactical_potion', count: 1 }] }),
        o(15, '骗走金币', 'bad', { type: 'gold', value: -25 })),
    ],
  },
  {
    id: 'mirror_pool',
    title: '镜面水池',
    icon: '🪞',
    desc: '一池静水映出倒影，水中的世界似乎与这里略有不同。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('选择数字倒影（30 金币）',
        tradeO(45, '清晰倒影', 'good', [{ id: 'spawn_luck_1', count: 1 }], { cost: 30, gold: { min: 5, max: 10 } }),
        tradeO(40, '模糊倒影', 'mid', [{ id: 'spawn_luck_1', count: 1 }], { cost: 30 }),
        o(15, '倒影破碎', 'bad', { type: 'none' })),
      pick('选择石面倒影（30 金币）',
        tradeO(45, '清晰倒影', 'good', [{ id: 'halve_shield_1', count: 1 }], { cost: 30, gold: { min: 5, max: 10 } }),
        tradeO(40, '模糊倒影', 'mid', [{ id: 'halve_shield_1', count: 1 }], { cost: 30 }),
        o(15, '倒影破碎', 'bad', { type: 'none' })),
      pick('选择力量倒影（30 金币）',
        tradeO(45, '清晰倒影', 'good', [{ id: 'atk_up_2', count: 1 }], { cost: 30, gold: { min: 5, max: 10 } }),
        tradeO(40, '模糊倒影', 'mid', [{ id: 'atk_up_2', count: 1 }], { cost: 30 }),
        o(15, '倒影破碎', 'bad', { type: 'none' })),
      pick('俯身饮水',
        o(50, '清凉入喉', 'good', { type: 'heal', value: 18 }),
        o(35, '稍解干渴', 'mid', { type: 'heal', value: 10 }),
        o(15, '水味苦涩', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'abandoned_clock',
    title: '废弃钟楼',
    icon: '🕰️',
    desc: '半塌的钟楼里，巨大的齿轮仍在缓缓转动，时间在这里走了样。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('加快节拍（35 金币）',
        tradeO(40, '齿轮咬合', 'good', [{ id: 'bonus_turn_0_5', count: 1 }], { cost: 35, gold: { min: 4, max: 8 } }),
        tradeO(45, '正常上弦', 'mid', [{ id: 'bonus_turn_0_5', count: 1 }], { cost: 35 }),
        o(15, '发条崩断', 'bad', { type: 'gold', value: -35 })),
      pick('储存时间（65 金币）',
        tradeO(40, '双重祝福', 'good', [{ id: 'charge_start_1', count: 1 }, { id: 'gold_saved_steps', count: 1 }], { cost: 65, gold: { min: 6, max: 12 } }),
        tradeO(45, '完整储存', 'mid', [{ id: 'charge_start_1', count: 1 }, { id: 'gold_saved_steps', count: 1 }], { cost: 65 }),
        o(15, '钟芯碎裂', 'bad', { type: 'gold', value: -65 })),
      pick('延续节奏（55 金币）',
        tradeO(40, '韵律相扣', 'good', [{ id: 'gold_combo_grace', count: 1 }], { cost: 55, gold: { min: 5, max: 10 } }),
        tradeO(45, '节奏延续', 'mid', [{ id: 'gold_combo_grace', count: 1 }], { cost: 55 }),
        o(15, '齿轮卡死', 'bad', { type: 'gold', value: -55 })),
      pick('带走钟芯药剂（25 金币）',
        tradeO(45, '珍藏佳酿', 'good', [], { consumableGrants: [{ id: 'tactical_potion', count: 1 }], cost: 25, gold: { min: 3, max: 6 } }),
        tradeO(40, '正常药剂', 'mid', [], { consumableGrants: [{ id: 'tactical_potion', count: 1 }], cost: 25 }),
        o(15, '瓶身龟裂', 'bad', { type: 'gold', value: -25 })),
      pick('听钟声静心',
        o(45, '心神安宁', 'good', { type: 'heal', value: 8 }),
        o(40, '稍感平静', 'mid', { type: 'heal', value: 5 }),
        o(15, '钟声刺耳', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'roaming_smith',
    title: '游荡铸匠',
    icon: '🛠️',
    desc: '铸匠背着行囊炉沿路招揽生意，炉火在风箱声里忽明忽暗。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('交旧换新（消耗 1 件普通装备）',
        o(40, '大师手笔', 'good', { type: 'reforge', sell_price: { min: 15, max: 22 }, new_rarity: 'rare' }),
        o(45, '正常重铸', 'mid', { type: 'reforge', sell_price: { min: 8, max: 15 }, new_rarity: 'rare' }),
        o(15, '失手损毁', 'bad', { type: 'reforge', sell_price: { min: 3, max: 6 }, new_rarity: 'common' })),
      pick('委托锻造（60 金币）',
        o(45, '上乘之作', 'good', { type: 'drop_equip', rarity: 'rare', cost: 60 }),
        o(40, '结实耐用', 'mid', { type: 'drop_equip', rarity: 'common', cost: 60 }),
        o(15, '卷款而逃', 'bad', { type: 'gold', value: -60 })),
      pick('学习锻甲（60 金币）',
        tradeO(40, '融会贯通', 'good', [{ id: 'gold_merge_armor', count: 1 }], { cost: 60, gold: { min: 5, max: 10 } }),
        tradeO(45, '习得要领', 'mid', [{ id: 'gold_merge_armor', count: 1 }], { cost: 60 }),
        o(15, '看走了眼', 'bad', { type: 'gold', value: -60 })),
      pick('修补护具（25 金币）',
        tradeO(45, '焕然一新', 'good', [{ id: 'def_up_1', count: 1 }, { id: 'vigor_1', count: 1 }], { cost: 25, gold: { min: 3, max: 6 } }),
        tradeO(40, '修修补补', 'mid', [{ id: 'def_up_1', count: 1 }, { id: 'vigor_1', count: 1 }], { cost: 25 }),
        o(15, '越修越坏', 'bad', { type: 'gold', value: -25 })),
      pick('帮忙拉风箱',
        o(45, '工钱丰厚', 'good', { type: 'gold', value: { min: 10, max: 16 } }),
        o(40, '几枚铜板', 'mid', { type: 'gold', value: { min: 5, max: 8 } }),
        o(15, '白干活', 'bad', { type: 'none' })),
      pick('烘干炉火',
        o(45, '暖人心脾', 'good', { type: 'heal', value: 8 }),
        o(40, '驱散寒气', 'mid', { type: 'heal', value: 5 }),
        o(15, '火星四溅', 'bad', { type: 'hp_reduce', value: 4 })),
    ],
  },
  {
    id: 'cleansing_altar',
    title: '断咒祭坛',
    icon: '⛩️',
    desc: '白色祭坛刻满断咒符文，专门用来拆解纠缠的诅咒。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('血祭断咒（支付 15 点生命）',
        tradeO(45, '咒文崩碎', 'good', [], { removesPurple: 1, hpCost: 15, gold: { min: 4, max: 8 } }),
        tradeO(40, '诅咒松动', 'mid', [], { removesPurple: 1, hpCost: 15 }),
        o(15, '血祭失败', 'bad', { type: 'hp_reduce', value: 15 })),
      pick('金币断咒（35 金币）',
        tradeO(45, '咒愿消散', 'good', [], { cost: 35, removesPurple: 1, gold: { min: 4, max: 8 } }),
        tradeO(40, '顺利净化', 'mid', [], { cost: 35, removesPurple: 1 }),
        o(15, '金币被吞噬', 'bad', { type: 'gold', value: -35 })),
      pick('购买净化药剂，留待之后（45 金币）',
        tradeO(45, '灵药一瓶', 'good', [], { consumableGrants: [{ id: 'cleanse_potion', count: 1 }], cost: 45, gold: { min: 4, max: 8 } }),
        tradeO(40, '正常购买', 'mid', [], { consumableGrants: [{ id: 'cleanse_potion', count: 1 }], cost: 45 }),
        o(15, '药剂失效', 'bad', { type: 'gold', value: -45 })),
      pick('双重断咒（65 金币）',
        tradeO(45, '双咒俱碎', 'good', [], { cost: 65, removesPurple: 2, gold: { min: 5, max: 10 } }),
        tradeO(40, '双重净化', 'mid', [], { cost: 65, removesPurple: 2 }),
        tradeO(15, '只碎一层', 'bad', [], { cost: 65, removesPurple: 1 })),
      pick('献上一段祷词',
        o(50, '祭坛低语', 'good', { type: 'heal', value: 10 }),
        o(35, '心神安定', 'mid', { type: 'heal', value: 6 }),
        o(15, '无事发生', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'astral_chess',
    title: '星界棋局',
    icon: '♟️',
    desc: '棋盘上的星子自行移动，一双看不见的手在等你落子。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('金币下注（85 金币）',
        tradeO(40, '完胜', 'good', [{ id: 'gold_execute', count: 1 }, { id: 'gold_crit', count: 1 }], { cost: 85, gold: { min: 10, max: 20 } }),
        tradeO(45, '胜局', 'mid', [{ id: 'gold_execute', count: 1 }, { id: 'gold_crit', count: 1 }], { cost: 85 }),
        o(15, '败北', 'bad', { type: 'gold', value: -85 })),
      pick('命运下注',
        tradeO(40, '命运眷顾', 'good', [{ id: 'gold_execute', count: 1 }, { id: 'gold_crit', count: 1 }, { id: 'doom_rage', count: 1 }], { gold: { min: 8, max: 16 } }),
        tradeO(45, '缔结命运', 'mid', [{ id: 'gold_execute', count: 1 }, { id: 'gold_crit', count: 1 }, { id: 'doom_rage', count: 1 }]),
        tradeO(15, '命运嘲弄', 'bad', [{ id: 'doom_rage', count: 1 }])),
      pick('防守布局（65 金币）',
        tradeO(40, '铜墙铁壁', 'good', [{ id: 'gold_merge_armor', count: 1 }, { id: 'gold_carry', count: 1 }], { cost: 65, gold: { min: 8, max: 14 } }),
        tradeO(45, '稳固防线', 'mid', [{ id: 'gold_merge_armor', count: 1 }, { id: 'gold_carry', count: 1 }], { cost: 65 }),
        o(15, '布局落空', 'bad', { type: 'gold', value: -65 })),
      pick('接受猎魔契约',
        tradeO(40, '猎魔之力', 'good', [{ id: 'red_hunt', count: 1 }], { gold: { min: 6, max: 12 } }),
        tradeO(45, '契约缔结', 'mid', [{ id: 'red_hunt', count: 1 }]),
        o(15, '契约无回应', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'crimson_garden',
    title: '猩红药圃',
    icon: '🌹',
    desc: '满园猩红的植物在无风处轻轻摇晃，果实饱满得近乎透明。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('采集危险药材',
        tradeO(45, '药材饱满', 'good', [], { consumableGrants: [{ id: 'berserk_potion', count: 2 }], hpCost: 18 }),
        tradeO(40, '一株药材', 'mid', [], { consumableGrants: [{ id: 'berserk_potion', count: 1 }], hpCost: 18 }),
        o(15, '荆棘割伤', 'bad', { type: 'hp_reduce', value: 18 })),
      pick('购买稳妥补给（60 金币）',
        tradeO(45, '双份补给', 'good', [], { consumableGrants: [{ id: 'tactical_potion', count: 1 }, { id: 'charge_potion', count: 1 }], cost: 60, gold: { min: 4, max: 8 } }),
        tradeO(40, '正常购买', 'mid', [], { consumableGrants: [{ id: 'tactical_potion', count: 1 }, { id: 'charge_potion', count: 1 }], cost: 60 }),
        o(15, '钱货两空', 'bad', { type: 'gold', value: -60 })),
      pick('搜集连锁秘卷（45 金币）',
        tradeO(45, '完好秘卷', 'good', [], { consumableGrants: [{ id: 'combo_scroll', count: 1 }], cost: 45, gold: { min: 3, max: 8 } }),
        tradeO(40, '正常购买', 'mid', [], { consumableGrants: [{ id: 'combo_scroll', count: 1 }], cost: 45 }),
        o(15, '秘卷损毁', 'bad', { type: 'gold', value: -45 })),
      pick('服用鲜红药汁',
        o(45, '药力澎湃', 'good', { type: 'heal_curse', heal: 45, curse_hp: 8 }),
        o(40, '代价浮现', 'mid', { type: 'heal_curse', heal: 35, curse_hp: 12 }),
        o(15, '药性相冲', 'bad', { type: 'hp_reduce', value: 15 })),
    ],
  },
  {
    id: 'sinking_bridge',
    title: '断裂的吊桥',
    icon: '⚠',
    desc: '吊桥在脚下断裂，你必须立刻决定如何过河。没有回头路。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('攀着残索爬过去',
        o(45, '敏捷落地', 'good', { type: 'hp_reduce_pct', value: 15, atk_mult: 0.08 }),
        o(40, '磨破手掌', 'mid', { type: 'hp_reduce_pct', value: 15, atk_mult: 0.06 }),
        o(15, '踩空半步', 'bad', { type: 'hp_reduce_pct', value: 15, atk_mult: 0.02 })),
      pick('沿河岸绕远路',
        o(50, '平安渡河', 'good', { type: 'heal', value: 12 }),
        o(35, '涉水而行', 'mid', { type: 'heal', value: 7 }),
        o(15, '滑了一跤', 'bad', { type: 'hp_reduce', value: 4 })),
      pick('拆下桥板当护具',
        o(40, '厚实桥板', 'good', { type: 'drop_equip', rarity: 'common' }),
        o(40, '木板散落', 'mid', { type: 'gold', value: { min: 8, max: 14 } }),
        o(20, '落入湍流', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'screaming_well',
    title: '哭嚎之井',
    icon: '🕯️',
    desc: '井底传来哭声。你必须给井里的东西一个答复，否则声音不会停下。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('投下金币安抚井灵',
        o(45, '哭声平息', 'good', { type: 'gold', value: -10 }),
        o(40, '短暂安静', 'mid', { type: 'gold', value: -6 }),
        o(15, '索要更多', 'bad', { type: 'gold', value: -15 })),
      pick('献上一小段生命',
        o(45, '鲜血安抚', 'good', { type: 'hp_reduce', value: 8 }),
        o(40, '疼痛抽搐', 'mid', { type: 'hp_reduce', value: 10 }),
        o(15, '井灵贪得', 'bad', { type: 'hp_reduce', value: 14 })),
      pick('割破手掌立誓',
        o(45, '血誓成立', 'good', { type: 'hp_reduce_pct', value: 10, atk_mult: 0.07 }),
        o(40, '誓言微光', 'mid', { type: 'hp_reduce_pct', value: 10, atk_mult: 0.05 }),
        o(15, '誓言反噬', 'bad', { type: 'hp_reduce_pct', value: 10 })),
    ],
  },
  {
    id: 'starving_ambush',
    title: '饥饿的伏击者',
    icon: '⚰',
    desc: '三个饿疯了的逃兵堵住去路。要么交东西，要么见血。',
    forced: true,
    stageMin: 1,
    choices: [
      pick('交出干粮',
        o(45, '伏击者满足', 'good', { type: 'hp_reduce_pct', value: 10, def_mult: 0.05 }),
        o(40, '勉强放过', 'mid', { type: 'hp_reduce_pct', value: 10, def_mult: 0.04 }),
        o(15, '得寸进尺', 'bad', { type: 'hp_reduce_pct', value: 10, def_mult: 0.01 })),
      pick('拼死突围',
        tradeO(40, '大胜', 'good', [{ id: 'atk_up_1', count: 1 }], { gold: { min: 30, max: 45 }, hpCost: 18 }),
        tradeO(45, '惨胜', 'mid', [{ id: 'atk_up_1', count: 1 }], { gold: { min: 12, max: 22 }, hpCost: 18 }),
        o(15, '落荒而逃', 'bad', { type: 'hp_reduce', value: 18 })),
      pick('说服从前的同伴',
        o(45, '旧情难忘', 'good', { type: 'heal', value: 10 }),
        o(40, '半信半疑', 'mid', { type: 'heal', value: 6 }),
        o(15, '被驱逐', 'bad', { type: 'hp_reduce', value: 6 })),
    ],
  },
  {
    id: 'collapsing_shrine',
    title: '崩塌的神龛',
    icon: '🏛',
    desc: '神龛正在坍塌，神像背后的东西即将被埋。你必须带走点什么。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('抢出供品',
        o(40, '满捧供品', 'good', { type: 'gold', value: { min: 24, max: 40 } }),
        o(45, '几件供品', 'mid', { type: 'gold', value: { min: 12, max: 20 } }),
        o(15, '供品散落', 'bad', { type: 'gold', value: { min: 4, max: 8 } })),
      pick('扛走石像碎片',
        o(40, '石心宝物', 'good', { type: 'drop_equip', rarity: 'rare' }),
        o(40, '沉碎石像', 'mid', { type: 'drop_equip', rarity: 'common' }),
        o(20, '被埋住脚', 'bad', { type: 'hp_reduce', value: 10 })),
      pick('用身体撑住横梁',
        o(45, '神明看在眼里', 'good', { type: 'hp_reduce_pct', value: 15, def_mult: 0.08 }),
        o(40, '勉强撑住', 'mid', { type: 'hp_reduce_pct', value: 15, def_mult: 0.06 }),
        o(15, '筋疲力尽', 'bad', { type: 'hp_reduce_pct', value: 15, def_mult: 0.02 })),
    ],
  },
  {
    id: 'cursed_bargain',
    title: '低语的契约',
    icon: '📜',
    desc: '一纸未签名的契约在风中翻动。签与不签，它都会从你身上取走一样东西。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('签名换取力量',
        tradeO(40, '契约兑现', 'good', [{ id: 'gold_combo', count: 1 }, { id: 'curse_burn', count: 1 }], { gold: { min: 8, max: 14 } }),
        tradeO(45, '白纸黑字', 'mid', [{ id: 'gold_combo', count: 1 }, { id: 'curse_burn', count: 1 }]),
        tradeO(15, '只余诅咒', 'bad', [{ id: 'curse_burn', count: 1 }])),
      pick('撕毁契约',
        o(45, '契约畏缩', 'good', { type: 'hp_reduce_pct', value: 12, atk_mult: 0.06 }),
        o(40, '纸片割手', 'mid', { type: 'hp_reduce_pct', value: 12, atk_mult: 0.04 }),
        o(15, '低语缠绕', 'bad', { type: 'hp_reduce_pct', value: 12 })),
      pick('把它烧掉',
        o(45, '一把烧净', 'good', { type: 'gold', value: -12 }),
        o(40, '火势失控', 'mid', { type: 'gold', value: -18 }),
        o(15, '契约不灭', 'bad', { type: 'gold', value: -25 })),
    ],
  },
  {
    id: 'midnight_auction',
    title: '午夜拍卖会',
    icon: '🧳',
    desc: '最后一件拍品是你的东西。不举牌，你就要空手离开尖叫的人群。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('花 40 金币买回自己的东西',
        o(45, '物归原主', 'good', { type: 'drop_equip', rarity: 'rare', cost: 40 }),
        o(40, '略有瑕疵', 'mid', { type: 'drop_equip', rarity: 'common', cost: 40 }),
        o(15, '竞价失败', 'bad', { type: 'gold', value: -40 })),
      pick('买下一瓶狂战药剂（35 金币）',
        tradeO(45, '真品佳酿', 'good', [], { consumableGrants: [{ id: 'berserk_potion', count: 1 }], cost: 35, gold: { min: 3, max: 6 } }),
        tradeO(40, '正常购买', 'mid', [], { consumableGrants: [{ id: 'berserk_potion', count: 1 }], cost: 35 }),
        o(15, '赝品', 'bad', { type: 'gold', value: -35 })),
      pick('把拍品让给旁人',
        o(40, '分到让利', 'good', { type: 'gold', value: { min: 14, max: 22 } }),
        o(45, '少量补偿', 'mid', { type: 'gold', value: { min: 8, max: 12 } }),
        o(15, '一无所获', 'bad', { type: 'none' })),
    ],
  },
  {
    id: 'greed_trial',
    title: '贪欲之试',
    icon: '🏛',
    desc: '石门要你证明自己的价值。你必须付出点什么才能通过。',
    forced: true,
    stageMin: 2,
    choices: [
      pick('奉上 35 金币换锋芒',
        tradeO(45, '锋芒毕露', 'good', [{ id: 'gold_crit', count: 1 }], { cost: 35, gold: { min: 4, max: 8 } }),
        tradeO(40, '一刀一诺', 'mid', [{ id: 'gold_crit', count: 1 }], { cost: 35 }),
        o(15, '石门吞金', 'bad', { type: 'gold', value: -35 })),
      pick('用血证明',
        tradeO(45, '血契响应', 'good', [{ id: 'gold_execute', count: 1 }], { hpCost: 20, gold: { min: 4, max: 8 } }),
        tradeO(40, '印记浮现', 'mid', [{ id: 'gold_execute', count: 1 }], { hpCost: 20 }),
        o(15, '血白流了', 'bad', { type: 'hp_reduce', value: 20 })),
      pick('转身离开石门',
        o(45, '石门放行', 'good', { type: 'hp_reduce', value: 6 }),
        o(40, '石屑擦伤', 'mid', { type: 'hp_reduce', value: 10 }),
        o(15, '门缝夹击', 'bad', { type: 'hp_reduce', value: 16 })),
    ],
  },
  {
    id: 'spirit_bargain',
    title: '游魂的交易',
    icon: '🕯️',
    desc: '一个游魂问你是否愿意带走它未了的心愿。你必须做出回应。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('收下它的执念',
        tradeO(40, '执念化力', 'good', [{ id: 'gold_crit', count: 1 }, { id: 'doom_soul', count: 1 }], { gold: { min: 8, max: 14 } }),
        tradeO(45, '心愿相抵', 'mid', [{ id: 'gold_crit', count: 1 }, { id: 'doom_soul', count: 1 }]),
        tradeO(15, '只有黑影', 'bad', [{ id: 'doom_soul', count: 1 }])),
      pick('替它了却心愿',
        o(40, '圆满了却', 'good', { type: 'hp_reduce_pct', value: 12 }),
        o(40, '费尽心力', 'mid', { type: 'hp_reduce_pct', value: 15 }),
        o(20, '心愿难了', 'bad', { type: 'hp_reduce_pct', value: 20 })),
      pick('洒下金币请它离开',
        o(40, '洒币安魂', 'good', { type: 'gold', value: -22 }),
        o(40, '游魂贪婪', 'mid', { type: 'gold', value: -30 }),
        o(20, '索求无度', 'bad', { type: 'gold', value: -40 })),
    ],
  },
  {
    id: 'doom_gate',
    title: '宿命之门',
    icon: '⚠',
    desc: '黑门后传来你无法拒绝的声音。它只接受一种代价，你必须选择一种。',
    forced: true,
    stageMin: 3,
    choices: [
      pick('接受宿命换取力量',
        tradeO(40, '宿命馈赠', 'good', [{ id: 'gold_crit', count: 1 }, { id: 'gold_saved_steps', count: 1 }, { id: 'doom_rage', count: 1 }], { gold: { min: 6, max: 12 } }),
        tradeO(45, '命运加身', 'mid', [{ id: 'gold_crit', count: 1 }, { id: 'gold_saved_steps', count: 1 }, { id: 'doom_rage', count: 1 }]),
        tradeO(15, '只有低语', 'bad', [{ id: 'doom_rage', count: 1 }])),
      pick('用生命封住门',
        o(45, '以血封印', 'good', { type: 'heal_curse', heal: 22, curse_hp: 4 }),
        o(40, '门后回响', 'mid', { type: 'heal_curse', heal: 20, curse_hp: 5 }),
        o(15, '门扉反噬', 'bad', { type: 'heal_curse', heal: 18, curse_hp: 8 })),
      pick('把门推开一条缝',
        o(40, '门后宝物', 'good', { type: 'gold', value: { min: 28, max: 42 } }),
        o(45, '几件遗物', 'mid', { type: 'gold', value: { min: 14, max: 22 } }),
        o(15, '门后空空', 'bad', { type: 'gold', value: { min: 3, max: 6 } })),
    ],
  },
]

function isReforgeEligible(eqId: string, context: EventChoiceContext): boolean {
  return typeof eqId === 'string' && !!context.inventory?.includes(eqId)
    && eqId.split(':')[0].startsWith('eq_')
    && equipmentById(eqId)?.rarity === 'common'
    && !Object.values(context.equipment ?? {}).some(worn => worn === eqId)
}

export function getReforgeEligibleItem(context: EventChoiceContext = {}): string | null {
  return context.inventory?.find(eqId => isReforgeEligible(eqId, context)) ?? null
}

const EFFECT_FIELDS: Record<string, string[]> = {
  none: [], gold: ['value'], heal: ['value'], hp_reduce: ['value'], maxhp_down: ['value'],
  maxhp_up: ['value'], xp: ['value'], hp_reduce_pct: ['value'], maxhp_down_pct: ['value'],
  heal_curse: ['heal', 'curse_hp'], gold_heal: ['heal', 'gold'], gold_xp: ['gold', 'xp'],
  drop_equip: [], reforge: [], card_trade: [],
}

function eventCardGrants(effect: Record<string, any>): unknown {
  return effect.cardGrants === undefined ? effect.grants : effect.cardGrants
}

function validateEventGrants(grants: unknown, consumable: boolean): string | null {
  if (!Array.isArray(grants)) return consumable ? '事件消耗品奖励列表无效' : '事件卡牌奖励列表无效'
  const totals = new Map<string, number>()
  for (const grant of grants) {
    if (!grant || typeof grant !== 'object' || typeof grant.id !== 'string') return '事件奖励缺少有效的精确 ID'
    if (!Number.isSafeInteger(grant.count) || grant.count <= 0) return '事件奖励数量必须为正的安全整数'
    const def = consumable ? consumableById(grant.id) : cardById(grant.id)
    if (!def || def.id !== grant.id) return `事件奖励不存在：${grant.id}`
    if (consumable ? !validateConsumable(def) : !validateCard(def)) return `事件奖励分类或效果无效：${grant.id}`
    const total = (totals.get(grant.id) ?? 0) + grant.count
    if (!Number.isSafeInteger(total)) return `事件奖励累计数量无效：${grant.id}`
    totals.set(grant.id, total)
  }
  return null
}

function getCardTradeDisabledReason(effect: Record<string, any>, context: EventChoiceContext): string | null {
  if (effect.grants !== undefined && effect.cardGrants !== undefined) return '事件卡牌奖励不能同时包含原始与缓存列表'
  const cardReason = validateEventGrants(eventCardGrants(effect), false)
  if (cardReason) return cardReason
  if (effect.consumableGrants !== undefined) {
    const supplyReason = validateEventGrants(effect.consumableGrants, true)
    if (supplyReason) return supplyReason
  }
  const cardGrants = eventCardGrants(effect) as EventGrant[]
  const removesPurple = effect.removesPurple ?? 0
  if (!Number.isSafeInteger(removesPurple) || removesPurple < 0) return '事件净化数量无效'
  if (cardGrants.length === 0 && (effect.consumableGrants?.length ?? 0) === 0 && removesPurple === 0) return '事件交易必须提供卡牌或消耗品奖励'
  for (const field of ['cost', 'hpCost']) {
    const value = effect[field] === undefined ? 0 : effect[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return `事件消耗数值无效：${field}`
  }
  const gold = effect.gold === undefined ? 0 : effect.gold
  if (!isNumberRoll(gold) || (typeof gold === 'number' ? gold : gold.min) < 0) return '事件金币奖励数值无效'
  if (effect.cardGrants != null && typeof gold !== 'number') return '缓存事件金币奖励必须为已结算数值'
  const cost = effect.cost ?? 0
  if (cost > 0 && (typeof context.gold !== 'number' || !Number.isFinite(context.gold) || context.gold < cost)) {
    return `金币不足：需要 ${cost} 金币`
  }
  const hpCost = effect.hpCost ?? 0
  if (hpCost > 0 && (typeof context.hp !== 'number' || !Number.isFinite(context.hp) || context.hp - hpCost < 1)) {
    return `生命不足：需要支付 ${hpCost} 点生命且至少保留 1 点`
  }
  if (removesPurple > 0 && (typeof context.purpleLayers !== 'number' || !Number.isFinite(context.purpleLayers) || context.purpleLayers < removesPurple)) {
    return removesPurple > 1 ? `需要持有至少 ${removesPurple} 层可净化的紫卡` : '没有可净化的紫色诅咒'
  }
  return null
}

// 同时接受原始选项与已结算结果。失败不掷骰、不扣款，由调用者显示原因。
export function getEventChoiceDisabledReason(effect: Record<string, any>, context: EventChoiceContext = {}): string | null {
  if (!effect || !Object.prototype.hasOwnProperty.call(EFFECT_FIELDS, effect.type)) return '事件效果不受支持'
  if (effect.type === 'card_trade') return getCardTradeDisabledReason(effect, context)
  const fields = [...EFFECT_FIELDS[effect.type]]
  if (effect.type === 'reforge') fields.push(effect.eqId != null ? 'gold' : 'sell_price')
  for (const field of fields) {
    const value = effect[field]
    if (!isNumberRoll(value)) return `事件数值无效：${field}`
    const minimum = typeof value === 'number' ? value : value.min
    if (minimum < 0 && !(effect.type === 'gold' && field === 'value')) return `事件数值不能为负：${field}`
  }
  for (const field of ['curse_hp', 'heal']) {
    if (effect[field] != null && (typeof effect[field] !== 'number' || !Number.isFinite(effect[field]) || effect[field] < 0 || effect[field] > 100)) {
      return `事件百分比无效：${field}`
    }
  }
  if (['heal', 'hp_reduce_pct', 'maxhp_down', 'maxhp_down_pct'].includes(effect.type)) {
    const maximum = typeof effect.value === 'number' ? effect.value : effect.value.max
    if (maximum > 100) return '事件生命百分比不能超过 100%'
  }
  if (effect.type === 'heal_curse' && !(effect.curse_hp > 0)) return '生命上限诅咒数值必须大于 0'
  for (const field of ['atk_mult', 'def_mult']) {
    if (effect[field] != null && (typeof effect[field] !== 'number' || !Number.isFinite(effect[field]))) return `事件倍率无效：${field}`
  }
  const cost = effect.cost ?? 0
  if (!Number.isSafeInteger(cost) || cost < 0) return '事件金币消耗无效'
  if (cost > 0 && !['drop_equip', 'reforge'].includes(effect.type)) return '此事件效果不支持额外金币消耗'
  const goldMinimum = effect.type === 'gold' ? (typeof effect.value === 'number' ? effect.value : effect.value.min) : 0
  const requiredGold = Math.max(cost, -goldMinimum)
  // 不把预期奖励拿来抵押，也不在缺少玩家信息时默认允许欠债。
  if (requiredGold > 0 && (typeof context.gold !== 'number' || !Number.isFinite(context.gold) || context.gold < requiredGold)) {
    return `金币不足：需要 ${requiredGold} 金币`
  }
  if (effect.type === 'reforge') {
    const item = effect.removeEqId ?? getReforgeEligibleItem(context)
    if (!item || !isReforgeEligible(item, context)) return '需要 1 件背包中的未装备普通装备'
    if (effect.eqId != null && !effect.removeEqId) return '重铸结果缺少待消耗装备'
  }
  if (['drop_equip', 'reforge'].includes(effect.type)) {
    if (effect.eqId != null) {
      if (typeof effect.eqId !== 'string' || !equipmentById(effect.eqId)) return '事件奖励装备不存在'
    } else {
      const rarity = effect.type === 'reforge' ? (effect.new_rarity ?? 'rare') : (effect.rarity ?? 'common')
      if (!ALL_EQUIPMENT.some(eq => eq.rarity === rarity)) return '此品质暂无可用的事件奖励装备'
    }
  }
  return null
}

// 选项级校验：三档结构合法，且至少一档在当前资源下可行。
export function getEventChoiceDisabledReasonForChoice(choice: { outcomes?: unknown }, context: EventChoiceContext = {}): string | null {
  const outcomes = choice?.outcomes as EventOutcome[] | undefined
  if (!outcomes || !Array.isArray(outcomes) || outcomes.length !== 3) return '事件选项必须恰好包含三种结果'
  let weightTotal = 0
  for (const outcome of outcomes) {
    if (!outcome || typeof outcome !== 'object') return '事件结果定义无效'
    if (!Number.isSafeInteger(outcome.weight) || outcome.weight <= 0) return '事件结果权重无效'
    weightTotal += outcome.weight
    if (typeof outcome.label !== 'string' || !outcome.label) return '事件结果缺少档位名'
    if (!['good', 'mid', 'bad'].includes(outcome.tone)) return '事件结果档位无效'
    if (!outcome.effect || typeof outcome.effect.type !== 'string') return '事件结果效果无效'
  }
  if (weightTotal !== 100) return '事件结果权重之和必须为 100'
  const reasons = outcomes.map(outcome => getEventChoiceDisabledReason(outcome.effect, context))
  if (reasons.every(reason => reason)) return reasons[0]
  return null
}

function describeEquipment(eqId: string): string {
  const eq = typeof eqId === 'string' ? equipmentById(eqId) : undefined
  if (!eq) return `装备数据不可用（${eqId ?? '缺少 ID'}）`
  const level = Number.parseInt(eqId.split(':')[1] || '1', 10) || 1
  const rarityNames = { common: '普通', rare: '稀有', epic: '史诗' }
  const stats = formatEquipStats(eqId).join('，')
  return `${rarityNames[eq.rarity]} ${eq.name} Lv.${level}（${stats || '无属性加成'}）`
}

function describeEventCard(grant: EventGrant): string {
  const def = grant && typeof grant.id === 'string' ? cardById(grant.id) : undefined
  if (!def || !validateCard(def)) return `卡牌数据不可用（${grant?.id ?? '缺少 ID'}）`
  const effects = def.effects.map(effect => `${effect.polarity === 'positive' ? '正面收益（+）' : '负面代价（−）'}：${cardEffectText(effect)}`).join('；')
  const scope = def.kind === 'instant' ? '立即生效，不加入持有卡牌'
    : def.cardClass === 'black' ? '本局持续生效，按持有数量累加；本局无法移除，商店与净化均无效'
      : def.cardClass === 'purple' ? '本局持续生效，按持有数量累加；普通商店不能移除，可用净化药剂或奇遇移除'
        : '本局持续生效，按持有数量累加；可在商店付费移除'
  return `${def.name}（${cardClassText(def.cardClass)}）×${grant.count}（每张：${effects}；${scope}）`
}

function describeEventConsumable(grant: EventGrant): string {
  const def = grant && typeof grant.id === 'string' ? consumableById(grant.id) : undefined
  if (!def || !validateConsumable(def)) return `消耗品数据不可用（${grant?.id ?? '缺少 ID'}）`
  const effects = def.effects.map(effect => `${effect.polarity === 'positive' ? '正面收益（+）' : '负面代价（−）'}：${cardEffectText(effect)}`).join('；')
  const duration = def.duration === 'round' ? '使用后仅当前回合生效，回合结束移除'
    : def.duration === 'battle' ? '使用后仅当前战斗生效，战斗结束移除' : '使用时即时生效，不留下持续效果'
  return `${def.name}（${cardClassText(def.cardClass)}消耗品）×${grant.count}（每份：${effects || def.description}；存入消耗品库存，获得时不自动使用；使用消耗 1 份；${duration}）`
}

function describeCardTrade(eff: Record<string, any>): string {
  const rewards = [
    ...((eventCardGrants(eff) ?? []) as EventGrant[]).map(describeEventCard),
    ...(eff.consumableGrants ?? []).map(describeEventConsumable),
  ]
  const removal = eff.removesPurple > 0 ? `净化一层已持有的紫卡${eff.removesPurple > 1 ? ` ×${eff.removesPurple}` : ''}` : ''
  const gains = [...(removal ? [removal] : []), ...rewards]
  const expenses = [
    eff.cost > 0 ? `支付 ${eff.cost} 金币` : '不消耗金币',
    eff.hpCost > 0 ? `支付 ${eff.hpCost} 点当前生命（需至少保留 1 点）` : '不消耗当前生命',
  ].join('；')
  const gainsText = gains.length ? `；${gains.join('；')}` : ''
  const goldReward = typeof eff.gold === 'number' && eff.gold > 0 ? `${eff.gold}`
    : eff.gold && typeof eff.gold === 'object' ? `${eff.gold.min}~${eff.gold.max}` : ''
  return `${expenses}${gainsText}。${goldReward ? `另获得 ${goldReward} 金币（先支付消耗，再获得奖励）。` : ''}`
}

export function buildEventResult(eff: Record<string, any>): string {
  if (eff.type === 'card_trade') return describeCardTrade(eff)
  if (eff.type === 'none') return '什么都没有发生。'
  if (eff.type === 'gold') {
    if (eff.value > 0) return `获得 ${eff.value} 金币。`
    if (eff.value < 0) return `失去 ${-eff.value} 金币。`
    return '金币没有变化。'
  }
  if (eff.type === 'heal') return `回复最大生命值（含装备）的 ${eff.value}%（不超过上限）。`
  if (eff.type === 'heal_curse') return `先按诅咒前的生命总上限（含装备）回复 ${eff.heal}% 生命（不超过上限）；随后触发诅咒，本局基础生命上限降低 ${eff.curse_hp}%（最低 10），当前生命不超过新的总上限。`
  if (eff.type === 'hp_reduce') return `失去 ${eff.value} 点生命（至少保留 1 点）。`
  if (eff.type === 'maxhp_down') return `本局基础生命上限降低 ${eff.value}%（最低 10），当前生命不超过新的总上限。`
  if (eff.type === 'maxhp_up') return `本局基础生命上限提升 ${eff.value} 点。`
  if (eff.type === 'xp') return `获得 ${eff.value} 经验。`
  if (eff.type === 'gold_heal') return `回复最大生命值（含装备）的 ${eff.heal}%（不超过上限），并获得 ${eff.gold} 金币。`
  if (eff.type === 'gold_xp') return `获得 ${eff.gold} 金币和 ${eff.xp} 经验。`
  if (eff.type === 'drop_equip') return `${eff.cost > 0 ? `支付 ${eff.cost} 金币；` : ''}获得 ${describeEquipment(eff.eqId)}。`
  if (eff.type === 'reforge') return `消耗 ${describeEquipment(eff.removeEqId)}；${eff.cost > 0 ? `支付 ${eff.cost} 金币；` : ''}获得 ${eff.gold} 金币和 ${describeEquipment(eff.eqId)}。`
  if (eff.type === 'hp_reduce_pct' || eff.type === 'maxhp_down_pct') {
    let desc = eff.type === 'hp_reduce_pct'
      ? `当前生命降低 ${eff.value}%（至少保留 1 点）`
      : `本局基础生命上限降低 ${eff.value}%（最低 10），当前生命不超过新的总上限`
    if (eff.atk_mult) desc += `；本局攻击倍率 +${Math.round(eff.atk_mult * 100)} 个百分点`
    if (eff.def_mult) desc += `；本局防御倍率 +${Math.round(eff.def_mult * 100)} 个百分点`
    return `${desc}。`
  }
  return `无法显示事件结果：不支持的效果「${eff.type}」。`
}

export function pickEvent(stage: number, rng: () => number): GameEvent {
  const pool = EVENTS.filter(e => e.stageMin <= stage)
  if (pool.length === 0) return EVENTS[0]
  const idx = Math.floor(rng() * pool.length)
  return { ...pool[idx] }
}

/** 只读事件目录（浅拷贝，不暴露可变内部数组）：文档生成与工具枚举用，不消耗随机。 */
export function getEventCatalog(): GameEvent[] {
  return EVENTS.map(event => ({
    ...event,
    choices: event.choices.map(choice => ({ ...choice })),
  }))
}

/** 单个结果档的代价要素：金币支付、生命支付、紫卡层数前提、未装备普通装备前提。 */
function outcomeCostFactors(effect: Record<string, any>): { gold: number; hp: number; purple: number; equip: boolean } {
  let gold = typeof effect.cost === 'number' ? effect.cost : 0
  if (effect.type === 'gold' && typeof effect.value === 'number' && effect.value < 0) gold -= effect.value
  return { gold, hp: typeof effect.hpCost === 'number' ? effect.hpCost : 0, purple: effect.removesPurple ?? 0, equip: effect.type === 'reforge' }
}

function costRangeText(values: number[], unit: string): string | null {
  const positive = values.filter(value => value > 0)
  if (positive.length === 0) return null
  const min = Math.min(...positive)
  const max = Math.max(...positive)
  if (positive.length < values.length) return `最多 ${max} ${unit}`  // 存在免费档：支付不定额
  return min === max ? `${min} ${unit}` : `${min}~${max} ${unit}`
}

/**
 * 选项代价摘要（UI 选项卡与文档生成共用）：只汇总三档的支付与前提条件，
 * 不预告收获；随机结果的损失（如 hp_reduce 档）不属于代价，不在此列。
 * 返回 null 表示三档均无金币/生命支付且无紫卡或重铸装备前提。
 */
export function summarizeChoiceCost(outcomes: EventOutcome[]): string | null {
  const factors = outcomes.map(outcome => outcomeCostFactors(outcome.effect as Record<string, any>))
  const bits: string[] = []
  const goldText = costRangeText(factors.map(factor => factor.gold), '金币')
  if (goldText) bits.push(`支付${goldText}`)
  const hpText = costRangeText(factors.map(factor => factor.hp), '点生命')
  if (hpText) bits.push(`支付${hpText}`)
  const purples = factors.map(factor => factor.purple)
  const purpleMin = Math.min(...purples)
  const purpleMax = Math.max(...purples)
  // 前提条件只在三档一致时列出；混合档的前提差异属于档位细节，由结果列说明。
  if (purpleMin > 0 && purpleMin === purpleMax) bits.push(`需持有 ${purpleMax} 层紫卡`)
  if (factors.every(factor => factor.equip)) bits.push('需 1 件未装备普通装备')
  return bits.length ? bits.join('；') : null
}

function rollEquipment(rarity: string, stage: number, rng: () => number): string {
  const pool = ALL_EQUIPMENT.filter(eq => eq.rarity === rarity)
  if (pool.length === 0) throw new Error('此品质暂无可用的事件奖励装备')
  const pick = pool[Math.floor(rng() * pool.length)]
  const level = (stage - 1) * 2 + 1 + Math.floor(rng() * 2)
  return makeEquipId(pick.id, level, undefined, rng)
}

export function resolveEventEffect(effect: EventEffect, stage: number, rng: () => number, context: EventChoiceContext = {}): ResolvedEventEffect {
  const reason = getEventChoiceDisabledReason(effect, context)
  if (reason) throw new Error(reason)
  if (!Number.isSafeInteger(stage) || stage < 1) throw new Error('事件阶段必须是正整数')
  const cost = effect.cost ?? 0
  switch (effect.type) {
    case 'card_trade': {
      const cardGrants = (eventCardGrants(effect) as EventGrant[]).map(({ id, count }) => ({ id, count }))
      const result: ResolvedEventEffect = {
        type: 'card_trade', cardGrants, cost, gold: rollNumber(effect.gold ?? 0, rng), hpCost: effect.hpCost ?? 0,
        removesPurple: effect.removesPurple ?? 0,
      }
      if (effect.consumableGrants !== undefined) result.consumableGrants = effect.consumableGrants.map(({ id, count }: EventGrant) => ({ id, count }))
      return result
    }
    case 'none': return { type: 'none' }
    case 'gold': {
      const resolved: ResolvedEventEffect = { type: 'gold', value: rollNumber(effect.value, rng) }
      if (effect.paid) resolved.paid = true
      return resolved
    }
    case 'hp_reduce':
    case 'maxhp_down':
    case 'maxhp_up':
    case 'xp':
      return { type: effect.type, value: rollNumber(effect.value, rng) }
    case 'hp_reduce_pct':
    case 'maxhp_down_pct':
      return { type: effect.type, value: rollNumber(effect.value, rng), atk_mult: effect.atk_mult ?? 0, def_mult: effect.def_mult ?? 0 }
    case 'heal': return { type: 'heal', value: rollNumber(effect.value, rng) }
    case 'heal_curse': return { type: 'heal_curse', heal: effect.heal, curse_hp: effect.curse_hp }
    case 'gold_heal': return { type: 'gold_heal', heal: effect.heal, gold: rollNumber(effect.gold, rng) }
    case 'gold_xp': return { type: 'gold_xp', gold: rollNumber(effect.gold, rng), xp: rollNumber(effect.xp, rng) }
    case 'drop_equip':
      return { type: 'drop_equip', eqId: effect.eqId ?? rollEquipment(effect.rarity ?? 'common', stage, rng), cost }
    case 'reforge': {
      const removeEqId = effect.removeEqId ?? getReforgeEligibleItem(context)!
      const gold = rollNumber(effect.eqId != null ? effect.gold : effect.sell_price, rng)
      return { type: 'reforge', removeEqId, eqId: effect.eqId ?? rollEquipment(effect.new_rarity ?? 'rare', stage, rng), gold, cost }
    }
    default: throw new Error(`事件效果不受支持：${effect.type}`)
  }
}

// 按权重抽取一档；不可行（资源不足等）的结果先被剔除，只在可行档内抽取，避免结算中途失败。
export function resolveEventOutcome(outcomes: EventOutcome[], stage: number, rng: () => number, context: EventChoiceContext = {}): ResolvedEventOutcome {
  const feasible = outcomes.filter(outcome => !getEventChoiceDisabledReason(outcome.effect, context))
  if (feasible.length === 0) throw new Error('事件结果全部不可行')
  const totalWeight = feasible.reduce((sum, outcome) => sum + outcome.weight, 0)
  const roll = rng() * totalWeight
  let acc = 0
  let picked = feasible[feasible.length - 1]
  for (const outcome of feasible) {
    acc += outcome.weight
    if (roll < acc) { picked = outcome; break }
  }
  return { tone: picked.tone, label: picked.label, effect: resolveEventEffect(picked.effect, stage, rng, context) }
}
