import { ALL_EQUIPMENT, equipmentById, formatEquipStats, makeEquipId } from './equipment'
import { cardById, cardClassText, cardEffectText, validateCard } from './upgrade'
import { consumableById, validateConsumable } from './consumables'
import type { EventEffectMap } from '../types'

export interface EventChoice {
  label: string
  tooltip?: string
  effect: EventEffect
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

// 结算结果只含已掷出的数值；预览后应缓存此结果，确认时不要再次掷骰。
export type ResolvedEventEffect =
  | { type: 'none' }
  | { type: 'gold' | 'heal' | 'hp_reduce' | 'maxhp_down' | 'maxhp_up' | 'xp'; value: number }
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
    requiresBlackConfirmation: boolean
  }

export interface GameEvent {
  id: string
  title: string
  icon: string
  desc: string
  stageMin: number
  choices: EventChoice[]
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

function cardTradeChoice(label: string, grants: EventGrant[], consumableGrants?: EventGrant[], cost = 0, removesPurple = 0, options: { gold?: NumberRoll; hpCost?: number } = {}): EventChoice {
  const effect: EventEffect = { type: 'card_trade', grants, cost, gold: options.gold ?? 0, hpCost: options.hpCost ?? 0, removesPurple }
  if (consumableGrants) effect.consumableGrants = consumableGrants
  effect.requiresBlackConfirmation = getEventRequiresBlackConfirmation(effect)
  return {
    label,
    tooltip: buildEventResult(effect),
    effect,
  }
}

function supplyChoice(id: string): EventChoice {
  const def = consumableById(id)
  if (!def || !validateConsumable(def)) throw new Error(`事件消耗品定义无效：${id}`)
  return cardTradeChoice(`购买${def.name}（${def.price} 金币）`, [], [{ id, count: 1 }], def.price)
}

const EVENTS: GameEvent[] = [
  // ===== Stage 1+ =====
  {
    id: 'treasure_chest',
    title: '宝箱',
    icon: '📦',
    desc: '路边发现一个发光的宝箱，里面似乎有贵重物品。',
    stageMin: 1,
    choices: [
      { label: '打开宝箱', tooltip: '获得 10~25 金币，无消耗', effect: { type: 'gold', value: { min: 10, max: 25 } } },
      { label: '无视它', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'healing_fountain',
    title: '治愈之泉',
    icon: '⛲',
    desc: '微光泉水可以恢复伤势，但畅饮可能招来诅咒。旁边的旅人也愿意收购少量泉水。',
    stageMin: 1,
    choices: [
      { label: '畅饮泉水', tooltip: '先回复最大生命值（含装备）的 30%（不超过上限）；随后有 30% 概率使本局基础生命上限降低 10%（最低 10），当前生命不超过新的总上限', effect: { type: 'heal', value: 30, curse: 30, curse_hp: 10 } },
      { label: '轻抿一口', tooltip: '回复最大生命值（含装备）的 10%（不超过上限），无副作用', effect: { type: 'heal', value: 10 } },
      { label: '装瓶出售泉水', tooltip: '获得 15~25 金币，不回复生命', effect: { type: 'gold', value: { min: 15, max: 25 } } },
    ],
  },
  {
    id: 'dark_shrine',
    title: '暗影祭坛',
    icon: '🏛',
    desc: '一座古老祭坛散发着不祥的气息。献上生命之力，或许能获得力量作为回报。',
    stageMin: 1,
    choices: [
      { label: '献上 20% 当前生命', tooltip: '当前生命降低 20%（至少保留 1 点），本局攻击倍率 +8 个百分点', effect: { type: 'hp_reduce_pct', value: 20, atk_mult: 0.08 } },
      { label: '献上 15% 基础生命上限', tooltip: '本局基础生命上限降低 15%（最低 10），当前生命不超过新的总上限；本局防御倍率 +12 个百分点', effect: { type: 'maxhp_down_pct', value: 15, def_mult: 0.12 } },
      { label: '离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'fallen_warrior',
    title: '陨落战士',
    icon: '⚰',
    desc: '一具白骨躺在路边，遗落的护具仍能使用。他腰间有个鼓鼓的布袋。',
    stageMin: 1,
    choices: [
      { label: '拾取遗落装备', tooltip: '随机获得 1 件普通装备，无消耗', effect: { type: 'drop_equip', rarity: 'common' } },
      { label: '搜刮钱袋', tooltip: '获得 20~35 金币，无消耗', effect: { type: 'gold', value: { min: 20, max: 35 } } },
    ],
  },
  {
    id: 'risk_shrine',
    title: '狂战祭坛',
    icon: '🏛',
    desc: '祭坛提供红色风险契约：每份都包含一条强力正面机制和一条负面机制。请先查看完整代价，可自愿接受或无消耗离开。',
    stageMin: 1,
    choices: [
      cardTradeChoice('接受狂战契约', [{ id: 'red_berserk', count: 1 }]),
      cardTradeChoice('接受血之契约', [{ id: 'red_blood', count: 1 }]),
      cardTradeChoice('接受双刃赌局', [{ id: 'red_double', count: 1 }]),
      cardTradeChoice('接受猎魔契约', [{ id: 'red_hunt', count: 1 }]),
      cardTradeChoice('接受贪婪之约', [{ id: 'red_greed', count: 1 }]),
      { label: '离开', tooltip: '无消耗、无奖励，不获得任何卡牌或持续效果', effect: { type: 'none' } },
    ],
  },
  // ===== Stage 2+ =====
  {
    id: 'gambler',
    title: '赌徒的邀约',
    icon: '🎲',
    desc: '赌徒展示了两种赌法：「先付赌注，赢了拿装备，输了没有奖励。输赢都不退赌注，不接受赊账。」',
    stageMin: 2,
    choices: [
      { label: '赌一把（20 金币）', tooltip: '需有 20 金币，输赢均只支付一次；50% 获得 1 件稀有装备，50% 无奖励', effect: { type: 'gamble', cost: 20, win_chance: 50, win_rarity: 'rare' } },
      { label: '谨慎下注（5 金币）', tooltip: '需有 5 金币，输赢均只支付一次；70% 获得 1 件普通装备，30% 无奖励', effect: { type: 'gamble', cost: 5, win_chance: 70, win_rarity: 'common' } },
      { label: '绕道走', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'ancient_scroll',
    title: '远古卷轴',
    icon: '📜',
    desc: '一卷尘封的卷轴记载着古老的知识。你可以仔细研读、简略翻阅，或把它出售给附近的收藏者。',
    stageMin: 2,
    choices: [
      { label: '仔细研读', tooltip: '获得 30~50 经验，无消耗、无副作用', effect: { type: 'xp', value: { min: 30, max: 50 } } },
      { label: '简略翻阅', tooltip: '获得 15 经验，无消耗、无副作用', effect: { type: 'xp', value: 15 } },
      { label: '出售卷轴', tooltip: '获得 8~15 金币，不获得经验', effect: { type: 'gold', value: { min: 8, max: 15 } } },
    ],
  },
  {
    id: 'spike_trap',
    title: '看似平静的地面',
    icon: '⚠',
    desc: '地面上的石板排列得异常整齐，空气中有淡淡的血腥味。你停下脚步，意识到它可能是个陷阱。',
    stageMin: 2,
    choices: [
      { label: '小心绕行', tooltip: '安全通过，无消耗、无奖励', effect: { type: 'none' } },
      { label: '试着拆除', tooltip: '50% 获得 15~30 金币；50% 损失 15 点生命（至少保留 1 点）', effect: { type: 'disarm', gold_win: { min: 15, max: 30 }, hp_lose: 15 } },
      { label: '冲刺过去', tooltip: '70% 安全通过，无消耗；30% 损失 25 点生命（至少保留 1 点）', effect: { type: 'sprint', safe: 70, hp_dmg: 25 } },
    ],
  },
  {
    id: 'cursed_archive',
    title: '诅咒藏书室',
    icon: '📜',
    desc: '藏书室赠予金色机制，代价是同时接受紫色诅咒。每份交易的收益与代价都已列出；普通商店不能移除诅咒，可用净化药剂或奇遇移除，也可无消耗离开。',
    stageMin: 2,
    choices: [
      cardTradeChoice('接受连锁战意与灼烧诅咒', [{ id: 'gold_combo', count: 1 }, { id: 'curse_burn', count: 1 }]),
      cardTradeChoice('接受生命汲取与衰败诅咒', [{ id: 'gold_lifesteal', count: 1 }, { id: 'curse_decay', count: 1 }]),
      cardTradeChoice('接受锻甲传承与散能诅咒', [{ id: 'gold_merge_armor', count: 1 }, { id: 'gold_carry', count: 1 }, { id: 'curse_charge', count: 1 }]),
      cardTradeChoice('接受致命节奏与迟滞诅咒', [{ id: 'gold_crit', count: 1 }, { id: 'curse_heavy', count: 1 }]),
      cardTradeChoice('接受过载核心与脆甲诅咒', [{ id: 'gold_saved_steps', count: 1 }, { id: 'curse_brittle', count: 1 }]),
      { label: '离开', tooltip: '无消耗、无奖励，不获得金卡或诅咒，没有持续效果', effect: { type: 'none' } },
    ],
  },
  {
    id: 'alchemy_supply',
    title: '炼金补给',
    icon: '🧳',
    desc: '炼金师出售一份战术药剂。付款后存入消耗品库存，获得时不会自动使用；也可不购买离开。',
    stageMin: 2,
    choices: [
      supplyChoice('tactical_potion'),
      { label: '不购买，离开', tooltip: '无消耗、无奖励，不获得或使用消耗品，没有持续效果', effect: { type: 'none' } },
    ],
  },
  {
    id: 'cleansing_hermit',
    title: '流浪的净化师',
    icon: '🕯️',
    desc: '一位灰袍净化师在路旁支起祭坛，声称能用秘法剥离诅咒。报酬不能少，而且只针对紫色的诅咒。',
    stageMin: 2,
    choices: [
      cardTradeChoice('支付 40 金币，净化一层紫卡', [], undefined, 40, 1),
      { label: '婉拒离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  // ===== Stage 3+ =====
  {
    id: 'mysterious_box',
    title: '神秘黑匣',
    icon: '🎁',
    desc: '黑匣刻着古老封印，里面似乎藏着装备。匣子夹层里和周围的地面上散落着金币。',
    stageMin: 3,
    choices: [
      { label: '打破封印', tooltip: '随机获得 1 件稀有装备，无消耗', effect: { type: 'drop_equip', rarity: 'rare' } },
      { label: '搜寻夹层', tooltip: '获得 20~40 金币，无消耗', effect: { type: 'gold', value: { min: 20, max: 40 } } },
      { label: '只拾取地面金币', tooltip: '获得 5~10 金币，无消耗', effect: { type: 'gold', value: { min: 5, max: 10 } } },
    ],
  },
  {
    id: 'dying_merchant',
    title: '垂死商人',
    icon: '🧳',
    desc: '一个受伤商人倒在路边，身旁散落着行囊与旅行手记：「帮我包扎，余下的药可以替你疗伤，再给你一点金币作为谢礼。」',
    stageMin: 3,
    choices: [
      { label: '协助包扎并分享药剂', tooltip: '自己回复最大生命值（含装备）的 10%（不超过上限），并获得 5~10 金币；无消耗', effect: { type: 'heal_mixed', heal: 10, cost: 0, bonus_gold: { min: 5, max: 10 } } },
      { label: '拿走行囊与手记', tooltip: '获得 30~50 金币和 15~25 经验，没有其他效果', effect: { type: 'gold_xp', gold: { min: 30, max: 50 }, xp: { min: 15, max: 25 } } },
      { label: '转身离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'ancient_anvil',
    title: '远古锻造台',
    icon: '🔨',
    desc: '温热的铁砧可以收取金币锻造史诗装备，也能回收未装备的普通装备，换给你金币和稀有装备。供台上还留着一些金币。',
    stageMin: 3,
    choices: [
      { label: '淬火（消耗 25 金币）', tooltip: '支付 25 金币，随机获得 1 件史诗装备；需有足够金币', effect: { type: 'drop_equip', rarity: 'epic', cost: 25 } },
      { label: '拆装置换（消耗 1 件普通装备）', tooltip: '消耗背包中首件未装备普通装备，获得 15~25 金币和 1 件随机稀有装备；不额外消耗金币', effect: { type: 'reforge', cost: 0, sell_price: { min: 15, max: 25 }, new_rarity: 'rare' } },
      { label: '拾取供台金币后离开', tooltip: '获得 5~15 金币，无消耗', effect: { type: 'gold', value: { min: 5, max: 15 } } },
    ],
  },
  {
    id: 'abyss_contract',
    title: '深渊契约',
    icon: '⚠',
    desc: '深渊以金色机制交换黑色宿命。黑卡本局无法移除；所有收益与代价在选择前列明，必须额外确认，也可无消耗离开。',
    stageMin: 3,
    choices: [
      cardTradeChoice('接受锻甲合流与噬魂宿命（需额外确认）', [{ id: 'gold_merge_armor', count: 1 }, { id: 'doom_soul', count: 1 }]),
      cardTradeChoice('接受生命汲取与轮回宿命（需额外确认）', [{ id: 'gold_lifesteal', count: 1 }, { id: 'doom_rebirth', count: 1 }]),
      cardTradeChoice('接受连锁回响与阴影低语（需额外确认）', [{ id: 'gold_combo_grace', count: 1 }, { id: 'doom_rage', count: 1 }]),
      { label: '拒绝契约，离开', tooltip: '无消耗、无奖励，不获得金卡或黑色宿命，没有持续效果', effect: { type: 'none' } },
    ],
  },
  // ===== 多选奇遇：原有事件与选项保持不变，新事件按阶段解锁 =====
  {
    id: 'abandoned_camp',
    title: '废弃营地',
    icon: '🧳',
    desc: '营地刚被撤走，桌上还有药品、一个药剂瓶和几枚散币。只能带走其中一份，其他留给后来者。',
    stageMin: 1,
    choices: [
      { label: '使用残留药品', tooltip: '立即恢复生命上限的 20%，受治疗减少影响且不超过上限；不获得携带道具', effect: { type: 'heal', value: 20 } },
      cardTradeChoice('带走战术药剂', [], [{ id: 'tactical_potion', count: 1 }]),
      { label: '搜集营地散币', tooltip: '获得 8~16 金币，不回复生命、不获得道具', effect: { type: 'gold', value: { min: 8, max: 16 } } },
      { label: '不打扰，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'lost_messenger',
    title: '迷路的信使',
    icon: '📜',
    desc: '疲惫的信使请你代送一袋信件，也愿意出售旅行手记和备用护具。长途运送会消耗体力，购买则要支付金币。',
    stageMin: 1,
    choices: [
      cardTradeChoice('帮忙运送，领取报酬', [{ id: 'xp_1', count: 1 }], undefined, 0, 0, { hpCost: 12, gold: { min: 15, max: 25 } }),
      cardTradeChoice('购买旅行手记', [{ id: 'xp_1', count: 1 }], undefined, 15),
      { label: '购买备用行装', tooltip: '支付 30 金币，随机获得 1 件普通装备；放入背包，不自动穿戴', effect: { type: 'drop_equip', rarity: 'common', cost: 30 } },
      { label: '指明方向后离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'training_room',
    title: '机关训练室',
    icon: '🏛',
    desc: '训练室里有木人、盾架和负重石。选择一项课程：实战演练需要付出体力，另外两项课程需要支付金币。',
    stageMin: 1,
    choices: [
      cardTradeChoice('进行实战演练', [{ id: 'balanced_1', count: 1 }], undefined, 0, 0, { hpCost: 10 }),
      cardTradeChoice('参加防御课程', [{ id: 'def_up_1', count: 1 }], undefined, 20),
      cardTradeChoice('参加耐力课程', [{ id: 'vigor_1', count: 1 }], undefined, 20),
      { label: '不训练，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'statue_purse',
    title: '石像的口袋',
    icon: '📦',
    desc: '石像外侧散落着金币，深处的暗袋却连着机关。守袋者还摆出一件普通装备，愿意收钱后交给你。',
    stageMin: 1,
    choices: [
      { label: '拾取外侧散币', tooltip: '安全获得 8~16 金币，没有其他效果', effect: { type: 'gold', value: { min: 8, max: 16 } } },
      { label: '拆开机关暗袋', tooltip: '50% 获得 25~40 金币；50% 损失 12 点生命（至少保留 1 点）；不预先支付金币', effect: { type: 'disarm', gold_win: { min: 25, max: 40 }, hp_lose: 12 } },
      { label: '买通守袋者', tooltip: '支付 25 金币，随机获得 1 件普通装备；放入背包，不自动穿戴', effect: { type: 'drop_equip', rarity: 'common', cost: 25 } },
      { label: '远离机关，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'mirror_pool',
    title: '镜面水池',
    icon: '⛲',
    desc: '水面映出数字、石面和力量三种倒影，池边还有能疗伤的清水。只能选择一种倒影，或仅饮水恢复。',
    stageMin: 2,
    choices: [
      cardTradeChoice('选择数字倒影', [{ id: 'spawn_luck_1', count: 1 }], undefined, 30),
      cardTradeChoice('选择石面倒影', [{ id: 'halve_shield_1', count: 1 }], undefined, 30),
      cardTradeChoice('选择力量倒影', [{ id: 'atk_up_2', count: 1 }], undefined, 30),
      { label: '饮水，恢复生命', tooltip: '不支付金币，立即恢复生命上限的 15%，受治疗减少影响且不超过上限；不获得强化', effect: { type: 'heal', value: 15 } },
      { label: '不触碰水池，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'abandoned_clock',
    title: '废弃钟楼',
    icon: '📜',
    desc: '停摆的钟楼里保留着不同的时间秘法。钟楼看守允许你付费学一种，也可以只带走一个装有战术药剂的钟芯。',
    stageMin: 2,
    choices: [
      cardTradeChoice('加快节拍', [{ id: 'bonus_turn_0_5', count: 1 }], undefined, 35),
      cardTradeChoice('储存时间', [{ id: 'charge_start_1', count: 1 }, { id: 'gold_saved_steps', count: 1 }], undefined, 65),
      cardTradeChoice('延续节奏', [{ id: 'gold_combo_grace', count: 1 }], undefined, 55),
      cardTradeChoice('带走钟芯药剂', [], [{ id: 'tactical_potion', count: 1 }], 25),
      { label: '不购买，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'roaming_smith',
    title: '游荡铸匠',
    icon: '🔨',
    desc: '铸匠收购旧护具，也出售新装备和锻甲课程。交旧换新只会拆背包中首件未装备的普通装备，不会拆身上的装备。',
    stageMin: 2,
    choices: [
      { label: '交旧换新', tooltip: '消耗背包中首件未装备普通装备，获得 8~15 金币与 1 件随机稀有装备；不额外消耗金币', effect: { type: 'reforge', cost: 0, sell_price: { min: 8, max: 15 }, new_rarity: 'rare' } },
      { label: '委托锻造', tooltip: '支付 60 金币，随机获得 1 件稀有装备；放入背包，不自动穿戴', effect: { type: 'drop_equip', rarity: 'rare', cost: 60 } },
      cardTradeChoice('学习锻甲', [{ id: 'gold_merge_armor', count: 1 }], undefined, 60),
      cardTradeChoice('修补护具', [{ id: 'def_up_1', count: 1 }, { id: 'vigor_1', count: 1 }], undefined, 25),
      { label: '不做交易，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'cleansing_altar',
    title: '断咒祭坛',
    icon: '🕯️',
    desc: '祭坛只能剥离紫色诅咒，黑色宿命无法解除。现在可以付生命或金币断咒，也可以买药剂留待之后使用。',
    stageMin: 2,
    choices: [
      cardTradeChoice('血祭断咒', [], undefined, 0, 1, { hpCost: 15 }),
      cardTradeChoice('金币断咒', [], undefined, 35, 1),
      cardTradeChoice('购买净化药剂，留待之后', [], [{ id: 'cleanse_potion', count: 1 }], 45),
      cardTradeChoice('双重断咒', [], undefined, 65, 2),
      { label: '保留现状，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'astral_chess',
    title: '星界棋局',
    icon: '⚠',
    desc: '棋手提出四种布局：金币换来锋芒或护甲，命运换来同样的锋芒却留下不可解除的宿命。也可以接受收益和代价同时生效的红色契约。',
    stageMin: 3,
    choices: [
      cardTradeChoice('金币下注', [{ id: 'gold_execute', count: 1 }, { id: 'gold_crit', count: 1 }], undefined, 85),
      cardTradeChoice('命运下注（黑卡需额外确认）', [{ id: 'gold_execute', count: 1 }, { id: 'gold_crit', count: 1 }, { id: 'doom_rage', count: 1 }]),
      cardTradeChoice('防守布局', [{ id: 'gold_merge_armor', count: 1 }, { id: 'gold_carry', count: 1 }], undefined, 65),
      cardTradeChoice('接受猎魔契约', [{ id: 'red_hunt', count: 1 }]),
      { label: '不参加棋局，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
  {
    id: 'crimson_garden',
    title: '猩红药圃',
    icon: '🧳',
    desc: '药圃里有危险药材、稳妥补给和连锁秘卷。鲜红药汁会先治疗，再降低生命上限；狂战药剂则带回背包，使用时才同时触发收益和代价。',
    stageMin: 3,
    choices: [
      cardTradeChoice('采集危险药材', [], [{ id: 'berserk_potion', count: 2 }], 0, 0, { hpCost: 18 }),
      cardTradeChoice('购买稳妥补给', [], [{ id: 'tactical_potion', count: 1 }, { id: 'charge_potion', count: 1 }], 60),
      cardTradeChoice('搜集连锁秘卷', [], [{ id: 'combo_scroll', count: 1 }], 45),
      { label: '服用鲜红药汁', tooltip: '先按原生命上限恢复 40% 生命（受治疗减少影响、不超过上限）；再使本局基础生命上限降低 10%（最低 10），当前生命不超过新的上限；不获得紫卡或道具', effect: { type: 'heal_curse', heal: 40, curse_hp: 10 } },
      { label: '远离药圃，离开', tooltip: '无消耗，也无奖励', effect: { type: 'none' } },
    ],
  },
]

function isReforgeEligible(eqId: string, context: EventChoiceContext): boolean {
  return typeof eqId === 'string' && !!context.inventory?.includes(eqId)
    && !Object.values(context.equipment ?? {}).includes(eqId)
    && equipmentById(eqId)?.rarity === 'common'
}

// 现有存档没有取得时间；取背包中首件合格物品，不把排序后的顺序当作取得时间。
// 相同 ID 的多份装备若有一份穿戴中，保守地全部排除，避免误拆身上装备。
export function getReforgeEligibleItem(context: EventChoiceContext = {}): string | null {
  return context.inventory?.find(eqId => isReforgeEligible(eqId, context)) ?? null
}

const EFFECT_FIELDS: Record<string, string[]> = {
  none: [], gold: ['value'], heal: ['value'], hp_reduce: ['value'], maxhp_down: ['value'],
  maxhp_up: ['value'], xp: ['value'], hp_reduce_pct: ['value'], maxhp_down_pct: ['value'],
  heal_curse: ['heal', 'curse_hp'], gold_heal: ['heal', 'gold'], gold_xp: ['gold', 'xp'],
  heal_mixed: ['heal', 'bonus_gold'], disarm: ['gold_win', 'hp_lose'], sprint: ['hp_dmg'],
  gamble: [], drop_equip: [], reforge: [], card_trade: [],
}

function eventCardGrants(effect: Record<string, any>): unknown {
  return effect.cardGrants === undefined ? effect.grants : effect.cardGrants
}

// 原始选项和缓存结果均从实际卡牌定义推导；不能用外部传入的 false 绕过黑卡确认。
export function getEventRequiresBlackConfirmation(effect: Record<string, any>): boolean {
  if (!effect || effect.type !== 'card_trade') return false
  return [effect.grants, effect.cardGrants].some(grants => Array.isArray(grants) && grants.some(grant => {
    const def = grant && typeof grant.id === 'string' ? cardById(grant.id) : undefined
    return !!def && validateCard(def) && def.id === grant.id && def.cardClass === 'black'
  }))
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
  if (effect.requiresBlackConfirmation != null && typeof effect.requiresBlackConfirmation !== 'boolean') return '事件黑卡确认标记无效'
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

// 同时接受原始选项与缓存的结算结果。失败不掷骰、不扣款，由调用者显示原因。
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
  for (const field of ['safe', 'curse', 'curse_hp', 'win_chance', 'heal']) {
    if (effect[field] != null && (typeof effect[field] !== 'number' || !Number.isFinite(effect[field]) || effect[field] < 0 || effect[field] > 100)) {
      return `事件百分比无效：${field}`
    }
  }
  if (['heal', 'hp_reduce_pct', 'maxhp_down', 'maxhp_down_pct'].includes(effect.type)) {
    const maximum = typeof effect.value === 'number' ? effect.value : effect.value.max
    if (maximum > 100) return '事件生命百分比不能超过 100%'
  }
  if (effect.type === 'heal' && effect.curse > 0 && effect.curse_hp == null) return '缺少诅咒的生命上限损失数值'
  for (const field of ['atk_mult', 'def_mult']) {
    if (effect[field] != null && (typeof effect[field] !== 'number' || !Number.isFinite(effect[field]))) return `事件倍率无效：${field}`
  }
  const cost = effect.cost ?? 0
  if (!Number.isSafeInteger(cost) || cost < 0) return '事件金币消耗无效'
  if (cost > 0 && !['drop_equip', 'gamble', 'reforge'].includes(effect.type)) return '此事件效果不支持额外金币消耗'
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
  if (['drop_equip', 'gamble', 'reforge'].includes(effect.type)) {
    if (effect.eqId != null) {
      if (typeof effect.eqId !== 'string' || !equipmentById(effect.eqId)) return '事件奖励装备不存在'
    } else {
      const rarity = effect.type === 'gamble' ? (effect.win_rarity ?? 'rare')
        : effect.type === 'reforge' ? (effect.new_rarity ?? 'rare') : (effect.rarity ?? 'common')
      if (!ALL_EQUIPMENT.some(eq => eq.rarity === rarity)) return '此品质暂无可用的事件奖励装备'
    }
  }
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
  return `${expenses}${gainsText}。${goldReward ? `另获得 ${goldReward} 金币（先支付消耗，再获得奖励）。` : ''}${getEventRequiresBlackConfirmation(eff) ? '黑卡须额外确认后才会获得；可在确认前取消。' : ''}`
}

export function buildEventResult(eff: Record<string, any>): string {
  if (eff.type === 'card_trade') return describeCardTrade(eff)
  if (eff.type === 'none') return '安全离开。无消耗，也无奖励。'
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
        requiresBlackConfirmation: getEventRequiresBlackConfirmation(effect),
      }
      if (effect.consumableGrants !== undefined) result.consumableGrants = effect.consumableGrants.map(({ id, count }: EventGrant) => ({ id, count }))
      return result
    }
    case 'none': return { type: 'none' }
    case 'gold':
    case 'hp_reduce':
    case 'maxhp_down':
    case 'maxhp_up':
    case 'xp':
      return { type: effect.type, value: rollNumber(effect.value, rng) }
    case 'hp_reduce_pct':
    case 'maxhp_down_pct':
      return { type: effect.type, value: rollNumber(effect.value, rng), atk_mult: effect.atk_mult ?? 0, def_mult: effect.def_mult ?? 0 }
    case 'heal': {
      const heal = rollNumber(effect.value, rng)
      if (effect.curse > 0 && rng() * 100 < effect.curse) return { type: 'heal_curse', heal, curse_hp: effect.curse_hp }
      return { type: 'heal', value: heal }
    }
    case 'heal_curse': return { type: 'heal_curse', heal: effect.heal, curse_hp: effect.curse_hp }
    case 'disarm': {
      const gold = rollNumber(effect.gold_win, rng)
      return rng() < 0.5 ? { type: 'gold', value: gold } : { type: 'hp_reduce', value: rollNumber(effect.hp_lose, rng) }
    }
    case 'sprint':
      return rng() * 100 < (effect.safe ?? 70) ? { type: 'none' } : { type: 'hp_reduce', value: rollNumber(effect.hp_dmg, rng) }
    case 'gamble':
      // 赌注只出现一次：赢时由装备结果的 cost 扣除，输时仅用负金币结果。
      return rng() * 100 < (effect.win_chance ?? 50)
        ? { type: 'drop_equip', eqId: rollEquipment(effect.win_rarity ?? 'rare', stage, rng), cost }
        : { type: 'gold', value: -cost }
    case 'heal_mixed': return { type: 'gold_heal', heal: effect.heal, gold: rollNumber(effect.bonus_gold, rng) }
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
