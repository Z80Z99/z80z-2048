// 三档随机事件的字面量契约与真实 Pinia 结算回归；不写存档、不记录基线。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const grants = (...ids) => ids.map(id => ({ id, count: 1 }))
// 与 core/events.ts 的 o() 保持一致：负金币档自动标记为玩家主动支付（计入挥金如土）。
const o = (weight, label, tone, effect) => {
  if (effect.type === 'gold' && typeof effect.value === 'number' && effect.value < 0) effect.paid = true
  return { weight, label, tone, effect }
}
const tradeO = (weight, label, tone, cards, opts = {}) => o(weight, label, tone, {
  type: 'card_trade', grants: cards, cost: opts.cost ?? 0, gold: opts.gold ?? 0,
  hpCost: opts.hpCost ?? 0, removesPurple: opts.removesPurple ?? 0,
  ...(opts.supplies ? { consumableGrants: opts.supplies } : {}),
})

// 冻结 19 个扩展/强制事件的顺序、阶段与全部选项（label + 三档 outcome 字面量）。任何静默改动都会失败。
export const EXPANSION_CONTRACTS = new Map([
  ['abandoned_camp', { stageMin: 1, choices: [
    { label: '使用残留药品', outcomes: [o(45, '药效尚存', 'good', { type: 'heal', value: 22 }), o(40, '药力微弱', 'mid', { type: 'heal', value: 12 }), o(15, '药瓶已空', 'bad', { type: 'none' })] },
    { label: '翻找药箱', outcomes: [tradeO(40, '完整药瓶', 'good', [], { supplies: grants('tactical_potion') }), o(40, '散落药粉', 'mid', { type: 'gold', value: { min: 6, max: 12 } }), o(20, '只剩空瓶', 'bad', { type: 'none' })] },
    { label: '搜集营地散币', outcomes: [o(40, '埋藏的钱袋', 'good', { type: 'gold', value: { min: 10, max: 18 } }), o(45, '零散硬币', 'mid', { type: 'gold', value: { min: 5, max: 9 } }), o(15, '一无所获', 'bad', { type: 'none' })] },
  ] }],
  ['lost_messenger', { stageMin: 1, choices: [
    { label: '帮忙运送，领取报酬', outcomes: [tradeO(45, '重礼相酬', 'good', grants('xp_1'), { gold: { min: 20, max: 30 }, hpCost: 18 }), tradeO(40, '如约支付', 'mid', grants('xp_1'), { gold: { min: 12, max: 20 }, hpCost: 18 }), o(15, '空手而归', 'bad', { type: 'none' })] },
    { label: '购买旅行手记（15 金币）', outcomes: [tradeO(45, '内容翔实', 'good', grants('xp_1'), { cost: 15, gold: { min: 5, max: 10 } }), tradeO(40, '普通手记', 'mid', grants('xp_1'), { cost: 15 }), o(15, '无用小册', 'bad', { type: 'gold', value: -15 })] },
    { label: '顺路捎一段口信', outcomes: [o(45, '酬谢金币', 'good', { type: 'gold', value: { min: 8, max: 12 } }), o(40, '一句道谢', 'mid', { type: 'gold', value: { min: 3, max: 6 } }), o(15, '白跑一趟', 'bad', { type: 'none' })] },
    { label: '购买备用行装（30 金币）', outcomes: [o(40, '结实的护具', 'good', { type: 'drop_equip', rarity: 'common', cost: 30 }), tradeO(45, '买到补给', 'mid', [], { cost: 30, supplies: grants('tactical_potion') }), o(15, '买了假货', 'bad', { type: 'gold', value: -30 })] },
  ] }],
  ['training_room', { stageMin: 1, choices: [
    { label: '进行实战演练', outcomes: [tradeO(50, '收获颇丰', 'good', grants('balanced_1'), { hpCost: 10, gold: { min: 5, max: 10 } }), tradeO(35, '有所进步', 'mid', grants('balanced_1'), { hpCost: 10 }), o(15, '动作变形', 'bad', { type: 'hp_reduce', value: 10 })] },
    { label: '参加防御课程（20 金币）', outcomes: [tradeO(45, '要点尽得', 'good', grants('def_up_1'), { cost: 20, gold: { min: 5, max: 10 } }), tradeO(40, '正常上课', 'mid', grants('def_up_1'), { cost: 20 }), o(15, '听打瞌睡', 'bad', { type: 'gold', value: -20 })] },
    { label: '参加耐力课程（20 金币）', outcomes: [tradeO(45, '要点尽得', 'good', grants('vigor_1'), { cost: 20, gold: { min: 5, max: 10 } }), tradeO(40, '正常上课', 'mid', grants('vigor_1'), { cost: 20 }), o(15, '听打瞌睡', 'bad', { type: 'gold', value: -20 })] },
    { label: '旁观课程', outcomes: [o(50, '记下要点', 'good', { type: 'xp', value: 12 }), o(35, '一知半解', 'mid', { type: 'xp', value: 6 }), o(15, '无事发生', 'bad', { type: 'none' })] },
  ] }],
  ['statue_purse', { stageMin: 1, choices: [
    { label: '拾取外侧散币', outcomes: [o(40, '口袋松动', 'good', { type: 'gold', value: { min: 10, max: 18 } }), o(45, '几枚硬币', 'mid', { type: 'gold', value: { min: 5, max: 9 } }), o(15, '只有石屑', 'bad', { type: 'none' })] },
    { label: '拆开机关暗袋', outcomes: [o(40, '完美开袋', 'good', { type: 'gold', value: { min: 25, max: 40 } }), o(35, '勉强掏出', 'mid', { type: 'gold', value: { min: 12, max: 20 } }), o(25, '触发机关', 'bad', { type: 'hp_reduce', value: 12 })] },
    { label: '买通守袋者（25 金币）', outcomes: [o(40, '交出袋中物', 'good', { type: 'drop_equip', rarity: 'common', cost: 25 }), tradeO(45, '只好买药', 'mid', [], { cost: 25, supplies: grants('tactical_potion') }), o(15, '骗走金币', 'bad', { type: 'gold', value: -25 })] },
  ] }],
  ['mirror_pool', { stageMin: 2, choices: [
    { label: '选择数字倒影（30 金币）', outcomes: [tradeO(45, '清晰倒影', 'good', grants('spawn_luck_1'), { cost: 30, gold: { min: 5, max: 10 } }), tradeO(40, '模糊倒影', 'mid', grants('spawn_luck_1'), { cost: 30 }), o(15, '倒影破碎', 'bad', { type: 'none' })] },
    { label: '选择石面倒影（30 金币）', outcomes: [tradeO(45, '清晰倒影', 'good', grants('halve_shield_1'), { cost: 30, gold: { min: 5, max: 10 } }), tradeO(40, '模糊倒影', 'mid', grants('halve_shield_1'), { cost: 30 }), o(15, '倒影破碎', 'bad', { type: 'none' })] },
    { label: '选择力量倒影（30 金币）', outcomes: [tradeO(45, '清晰倒影', 'good', grants('atk_up_2'), { cost: 30, gold: { min: 5, max: 10 } }), tradeO(40, '模糊倒影', 'mid', grants('atk_up_2'), { cost: 30 }), o(15, '倒影破碎', 'bad', { type: 'none' })] },
    { label: '俯身饮水', outcomes: [o(50, '清凉入喉', 'good', { type: 'heal', value: 18 }), o(35, '稍解干渴', 'mid', { type: 'heal', value: 10 }), o(15, '水味苦涩', 'bad', { type: 'none' })] },
  ] }],
  ['abandoned_clock', { stageMin: 2, choices: [
    { label: '加快节拍（35 金币）', outcomes: [tradeO(40, '齿轮咬合', 'good', grants('bonus_turn_0_5'), { cost: 35, gold: { min: 4, max: 8 } }), tradeO(45, '正常上弦', 'mid', grants('bonus_turn_0_5'), { cost: 35 }), o(15, '发条崩断', 'bad', { type: 'gold', value: -35 })] },
    { label: '储存时间（65 金币）', outcomes: [tradeO(40, '双重祝福', 'good', grants('charge_start_1', 'gold_saved_steps'), { cost: 65, gold: { min: 6, max: 12 } }), tradeO(45, '完整储存', 'mid', grants('charge_start_1', 'gold_saved_steps'), { cost: 65 }), o(15, '钟芯碎裂', 'bad', { type: 'gold', value: -65 })] },
    { label: '延续节奏（55 金币）', outcomes: [tradeO(40, '韵律相扣', 'good', grants('gold_combo_grace'), { cost: 55, gold: { min: 5, max: 10 } }), tradeO(45, '节奏延续', 'mid', grants('gold_combo_grace'), { cost: 55 }), o(15, '齿轮卡死', 'bad', { type: 'gold', value: -55 })] },
    { label: '带走钟芯药剂（25 金币）', outcomes: [tradeO(45, '珍藏佳酿', 'good', [], { supplies: grants('tactical_potion'), cost: 25, gold: { min: 3, max: 6 } }), tradeO(40, '正常药剂', 'mid', [], { supplies: grants('tactical_potion'), cost: 25 }), o(15, '瓶身龟裂', 'bad', { type: 'gold', value: -25 })] },
    { label: '听钟声静心', outcomes: [o(45, '心神安宁', 'good', { type: 'heal', value: 8 }), o(40, '稍感平静', 'mid', { type: 'heal', value: 5 }), o(15, '钟声刺耳', 'bad', { type: 'none' })] },
  ] }],
  ['roaming_smith', { stageMin: 2, choices: [
    { label: '交旧换新（消耗 1 件普通装备）', outcomes: [o(40, '大师手笔', 'good', { type: 'reforge', sell_price: { min: 15, max: 22 }, new_rarity: 'rare' }), o(45, '正常重铸', 'mid', { type: 'reforge', sell_price: { min: 8, max: 15 }, new_rarity: 'rare' }), o(15, '失手损毁', 'bad', { type: 'reforge', sell_price: { min: 3, max: 6 }, new_rarity: 'common' })] },
    { label: '委托锻造（60 金币）', outcomes: [o(45, '上乘之作', 'good', { type: 'drop_equip', rarity: 'rare', cost: 60 }), o(40, '结实耐用', 'mid', { type: 'drop_equip', rarity: 'common', cost: 60 }), o(15, '卷款而逃', 'bad', { type: 'gold', value: -60 })] },
    { label: '学习锻甲（60 金币）', outcomes: [tradeO(40, '融会贯通', 'good', grants('gold_merge_armor'), { cost: 60, gold: { min: 5, max: 10 } }), tradeO(45, '习得要领', 'mid', grants('gold_merge_armor'), { cost: 60 }), o(15, '看走了眼', 'bad', { type: 'gold', value: -60 })] },
    { label: '修补护具（25 金币）', outcomes: [tradeO(45, '焕然一新', 'good', grants('def_up_1', 'vigor_1'), { cost: 25, gold: { min: 3, max: 6 } }), tradeO(40, '修修补补', 'mid', grants('def_up_1', 'vigor_1'), { cost: 25 }), o(15, '越修越坏', 'bad', { type: 'gold', value: -25 })] },
    { label: '帮忙拉风箱', outcomes: [o(45, '工钱丰厚', 'good', { type: 'gold', value: { min: 10, max: 16 } }), o(40, '几枚铜板', 'mid', { type: 'gold', value: { min: 5, max: 8 } }), o(15, '白干活', 'bad', { type: 'none' })] },
    { label: '烘干炉火', outcomes: [o(45, '暖人心脾', 'good', { type: 'heal', value: 8 }), o(40, '驱散寒气', 'mid', { type: 'heal', value: 5 }), o(15, '火星四溅', 'bad', { type: 'hp_reduce', value: 4 })] },
  ] }],
  ['cleansing_altar', { stageMin: 2, choices: [
    { label: '血祭断咒（支付 15 点生命）', outcomes: [tradeO(45, '咒文崩碎', 'good', [], { removesPurple: 1, hpCost: 15, gold: { min: 4, max: 8 } }), tradeO(40, '诅咒松动', 'mid', [], { removesPurple: 1, hpCost: 15 }), o(15, '血祭失败', 'bad', { type: 'hp_reduce', value: 15 })] },
    { label: '金币断咒（35 金币）', outcomes: [tradeO(45, '咒愿消散', 'good', [], { cost: 35, removesPurple: 1, gold: { min: 4, max: 8 } }), tradeO(40, '顺利净化', 'mid', [], { cost: 35, removesPurple: 1 }), o(15, '金币被吞噬', 'bad', { type: 'gold', value: -35 })] },
    { label: '购买净化药剂，留待之后（45 金币）', outcomes: [tradeO(45, '灵药一瓶', 'good', [], { supplies: grants('cleanse_potion'), cost: 45, gold: { min: 4, max: 8 } }), tradeO(40, '正常购买', 'mid', [], { supplies: grants('cleanse_potion'), cost: 45 }), o(15, '药剂失效', 'bad', { type: 'gold', value: -45 })] },
    { label: '双重断咒（65 金币）', outcomes: [tradeO(45, '双咒俱碎', 'good', [], { cost: 65, removesPurple: 2, gold: { min: 5, max: 10 } }), tradeO(40, '双重净化', 'mid', [], { cost: 65, removesPurple: 2 }), tradeO(15, '只碎一层', 'bad', [], { cost: 65, removesPurple: 1 })] },
    { label: '献上一段祷词', outcomes: [o(50, '祭坛低语', 'good', { type: 'heal', value: 10 }), o(35, '心神安定', 'mid', { type: 'heal', value: 6 }), o(15, '无事发生', 'bad', { type: 'none' })] },
  ] }],
  ['astral_chess', { stageMin: 3, choices: [
    { label: '金币下注（85 金币）', outcomes: [tradeO(40, '完胜', 'good', grants('gold_execute', 'gold_crit'), { cost: 85, gold: { min: 10, max: 20 } }), tradeO(45, '胜局', 'mid', grants('gold_execute', 'gold_crit'), { cost: 85 }), o(15, '败北', 'bad', { type: 'gold', value: -85 })] },
    { label: '命运下注', outcomes: [tradeO(40, '命运眷顾', 'good', grants('gold_execute', 'gold_crit', 'doom_rage'), { gold: { min: 8, max: 16 } }), tradeO(45, '缔结命运', 'mid', grants('gold_execute', 'gold_crit', 'doom_rage')), tradeO(15, '命运嘲弄', 'bad', grants('doom_rage'))] },
    { label: '防守布局（65 金币）', outcomes: [tradeO(40, '铜墙铁壁', 'good', grants('gold_merge_armor', 'gold_carry'), { cost: 65, gold: { min: 8, max: 14 } }), tradeO(45, '稳固防线', 'mid', grants('gold_merge_armor', 'gold_carry'), { cost: 65 }), o(15, '布局落空', 'bad', { type: 'gold', value: -65 })] },
    { label: '接受猎魔契约', outcomes: [tradeO(40, '猎魔之力', 'good', grants('red_hunt'), { gold: { min: 6, max: 12 } }), tradeO(45, '契约缔结', 'mid', grants('red_hunt')), o(15, '契约无回应', 'bad', { type: 'none' })] },
  ] }],
  ['crimson_garden', { stageMin: 3, choices: [
    { label: '采集危险药材', outcomes: [tradeO(45, '药材饱满', 'good', [], { supplies: [{ id: 'berserk_potion', count: 2 }], hpCost: 18 }), tradeO(40, '一株药材', 'mid', [], { supplies: grants('berserk_potion'), hpCost: 18 }), o(15, '荆棘割伤', 'bad', { type: 'hp_reduce', value: 18 })] },
    { label: '购买稳妥补给（60 金币）', outcomes: [tradeO(45, '双份补给', 'good', [], { supplies: grants('tactical_potion', 'charge_potion'), cost: 60, gold: { min: 4, max: 8 } }), tradeO(40, '正常购买', 'mid', [], { supplies: grants('tactical_potion', 'charge_potion'), cost: 60 }), o(15, '钱货两空', 'bad', { type: 'gold', value: -60 })] },
    { label: '搜集连锁秘卷（45 金币）', outcomes: [tradeO(45, '完好秘卷', 'good', [], { supplies: grants('combo_scroll'), cost: 45, gold: { min: 3, max: 8 } }), tradeO(40, '正常购买', 'mid', [], { supplies: grants('combo_scroll'), cost: 45 }), o(15, '秘卷损毁', 'bad', { type: 'gold', value: -45 })] },
    { label: '服用鲜红药汁', outcomes: [o(45, '药力澎湃', 'good', { type: 'heal_curse', heal: 45, curse_hp: 8 }), o(40, '代价浮现', 'mid', { type: 'heal_curse', heal: 35, curse_hp: 12 }), o(15, '药性相冲', 'bad', { type: 'hp_reduce', value: 15 })] },
  ] }],
])

// 九个强制奇遇的字面量契约（黑卡三档都给；每事件至少一个选项的全部三档零依赖）。
export const FORCED_CONTRACTS = new Map([
  ['sinking_bridge', { stageMin: 1, choices: [
    { label: '攀着残索爬过去', outcomes: [o(45, '敏捷落地', 'good', { type: 'hp_reduce_pct', value: 15, atk_mult: 0.08 }), o(40, '磨破手掌', 'mid', { type: 'hp_reduce_pct', value: 15, atk_mult: 0.06 }), o(15, '踩空半步', 'bad', { type: 'hp_reduce_pct', value: 15, atk_mult: 0.02 })] },
    { label: '沿河岸绕远路', outcomes: [o(50, '平安渡河', 'good', { type: 'heal', value: 12 }), o(35, '涉水而行', 'mid', { type: 'heal', value: 7 }), o(15, '滑了一跤', 'bad', { type: 'hp_reduce', value: 4 })] },
    { label: '拆下桥板当护具', outcomes: [o(40, '厚实桥板', 'good', { type: 'drop_equip', rarity: 'common' }), o(40, '木板散落', 'mid', { type: 'gold', value: { min: 8, max: 14 } }), o(20, '落入湍流', 'bad', { type: 'none' })] },
  ] }],
  ['screaming_well', { stageMin: 1, choices: [
    { label: '投下金币安抚井灵', outcomes: [o(45, '哭声平息', 'good', { type: 'gold', value: -10 }), o(40, '短暂安静', 'mid', { type: 'gold', value: -6 }), o(15, '索要更多', 'bad', { type: 'gold', value: -15 })] },
    { label: '献上一小段生命', outcomes: [o(45, '鲜血安抚', 'good', { type: 'hp_reduce', value: 8 }), o(40, '疼痛抽搐', 'mid', { type: 'hp_reduce', value: 10 }), o(15, '井灵贪得', 'bad', { type: 'hp_reduce', value: 14 })] },
    { label: '割破手掌立誓', outcomes: [o(45, '血誓成立', 'good', { type: 'hp_reduce_pct', value: 10, atk_mult: 0.07 }), o(40, '誓言微光', 'mid', { type: 'hp_reduce_pct', value: 10, atk_mult: 0.05 }), o(15, '誓言反噬', 'bad', { type: 'hp_reduce_pct', value: 10 })] },
  ] }],
  ['starving_ambush', { stageMin: 1, choices: [
    { label: '交出干粮', outcomes: [o(45, '伏击者满足', 'good', { type: 'hp_reduce_pct', value: 10, def_mult: 0.05 }), o(40, '勉强放过', 'mid', { type: 'hp_reduce_pct', value: 10, def_mult: 0.04 }), o(15, '得寸进尺', 'bad', { type: 'hp_reduce_pct', value: 10, def_mult: 0.01 })] },
    { label: '拼死突围', outcomes: [tradeO(40, '大胜', 'good', grants('atk_up_1'), { gold: { min: 30, max: 45 }, hpCost: 18 }), tradeO(45, '惨胜', 'mid', grants('atk_up_1'), { gold: { min: 12, max: 22 }, hpCost: 18 }), o(15, '落荒而逃', 'bad', { type: 'hp_reduce', value: 18 })] },
    { label: '说服从前的同伴', outcomes: [o(45, '旧情难忘', 'good', { type: 'heal', value: 10 }), o(40, '半信半疑', 'mid', { type: 'heal', value: 6 }), o(15, '被驱逐', 'bad', { type: 'hp_reduce', value: 6 })] },
  ] }],
  ['collapsing_shrine', { stageMin: 2, choices: [
    { label: '抢出供品', outcomes: [o(40, '满捧供品', 'good', { type: 'gold', value: { min: 24, max: 40 } }), o(45, '几件供品', 'mid', { type: 'gold', value: { min: 12, max: 20 } }), o(15, '供品散落', 'bad', { type: 'gold', value: { min: 4, max: 8 } })] },
    { label: '扛走石像碎片', outcomes: [o(40, '石心宝物', 'good', { type: 'drop_equip', rarity: 'rare' }), o(40, '沉碎石像', 'mid', { type: 'drop_equip', rarity: 'common' }), o(20, '被埋住脚', 'bad', { type: 'hp_reduce', value: 10 })] },
    { label: '用身体撑住横梁', outcomes: [o(45, '神明看在眼里', 'good', { type: 'hp_reduce_pct', value: 15, def_mult: 0.08 }), o(40, '勉强撑住', 'mid', { type: 'hp_reduce_pct', value: 15, def_mult: 0.06 }), o(15, '筋疲力尽', 'bad', { type: 'hp_reduce_pct', value: 15, def_mult: 0.02 })] },
  ] }],
  ['cursed_bargain', { stageMin: 2, choices: [
    { label: '签名换取力量', outcomes: [tradeO(40, '契约兑现', 'good', grants('gold_combo', 'curse_burn'), { gold: { min: 8, max: 14 } }), tradeO(45, '白纸黑字', 'mid', grants('gold_combo', 'curse_burn')), tradeO(15, '只余诅咒', 'bad', grants('curse_burn'))] },
    { label: '撕毁契约', outcomes: [o(45, '契约畏缩', 'good', { type: 'hp_reduce_pct', value: 12, atk_mult: 0.06 }), o(40, '纸片割手', 'mid', { type: 'hp_reduce_pct', value: 12, atk_mult: 0.04 }), o(15, '低语缠绕', 'bad', { type: 'hp_reduce_pct', value: 12 })] },
    { label: '把它烧掉', outcomes: [o(45, '一把烧净', 'good', { type: 'gold', value: -12 }), o(40, '火势失控', 'mid', { type: 'gold', value: -18 }), o(15, '契约不灭', 'bad', { type: 'gold', value: -25 })] },
  ] }],
  ['midnight_auction', { stageMin: 2, choices: [
    { label: '花 40 金币买回自己的东西', outcomes: [o(45, '物归原主', 'good', { type: 'drop_equip', rarity: 'rare', cost: 40 }), o(40, '略有瑕疵', 'mid', { type: 'drop_equip', rarity: 'common', cost: 40 }), o(15, '竞价失败', 'bad', { type: 'gold', value: -40 })] },
    { label: '买下一瓶狂战药剂（35 金币）', outcomes: [tradeO(45, '真品佳酿', 'good', [], { supplies: grants('berserk_potion'), cost: 35, gold: { min: 3, max: 6 } }), tradeO(40, '正常购买', 'mid', [], { supplies: grants('berserk_potion'), cost: 35 }), o(15, '赝品', 'bad', { type: 'gold', value: -35 })] },
    { label: '把拍品让给旁人', outcomes: [o(40, '分到让利', 'good', { type: 'gold', value: { min: 14, max: 22 } }), o(45, '少量补偿', 'mid', { type: 'gold', value: { min: 8, max: 12 } }), o(15, '一无所获', 'bad', { type: 'none' })] },
  ] }],
  ['greed_trial', { stageMin: 2, choices: [
    { label: '奉上 35 金币换锋芒', outcomes: [tradeO(45, '锋芒毕露', 'good', grants('gold_crit'), { cost: 35, gold: { min: 4, max: 8 } }), tradeO(40, '一刀一诺', 'mid', grants('gold_crit'), { cost: 35 }), o(15, '石门吞金', 'bad', { type: 'gold', value: -35 })] },
    { label: '用血证明', outcomes: [tradeO(45, '血契响应', 'good', grants('gold_execute'), { hpCost: 20, gold: { min: 4, max: 8 } }), tradeO(40, '印记浮现', 'mid', grants('gold_execute'), { hpCost: 20 }), o(15, '血白流了', 'bad', { type: 'hp_reduce', value: 20 })] },
    { label: '转身离开石门', outcomes: [o(45, '石门放行', 'good', { type: 'hp_reduce', value: 6 }), o(40, '石屑擦伤', 'mid', { type: 'hp_reduce', value: 10 }), o(15, '门缝夹击', 'bad', { type: 'hp_reduce', value: 16 })] },
  ] }],
  ['spirit_bargain', { stageMin: 3, choices: [
    { label: '收下它的执念', outcomes: [tradeO(40, '执念化力', 'good', grants('gold_crit', 'doom_soul'), { gold: { min: 8, max: 14 } }), tradeO(45, '心愿相抵', 'mid', grants('gold_crit', 'doom_soul')), tradeO(15, '只有黑影', 'bad', grants('doom_soul'))] },
    { label: '替它了却心愿', outcomes: [o(40, '圆满了却', 'good', { type: 'hp_reduce_pct', value: 12 }), o(40, '费尽心力', 'mid', { type: 'hp_reduce_pct', value: 15 }), o(20, '心愿难了', 'bad', { type: 'hp_reduce_pct', value: 20 })] },
    { label: '洒下金币请它离开', outcomes: [o(40, '洒币安魂', 'good', { type: 'gold', value: -22 }), o(40, '游魂贪婪', 'mid', { type: 'gold', value: -30 }), o(20, '索求无度', 'bad', { type: 'gold', value: -40 })] },
  ] }],
  ['doom_gate', { stageMin: 3, choices: [
    { label: '接受宿命换取力量', outcomes: [tradeO(40, '宿命馈赠', 'good', grants('gold_crit', 'gold_saved_steps', 'doom_rage'), { gold: { min: 6, max: 12 } }), tradeO(45, '命运加身', 'mid', grants('gold_crit', 'gold_saved_steps', 'doom_rage')), tradeO(15, '只有低语', 'bad', grants('doom_rage'))] },
    { label: '用生命封住门', outcomes: [o(45, '以血封印', 'good', { type: 'heal_curse', heal: 22, curse_hp: 4 }), o(40, '门后回响', 'mid', { type: 'heal_curse', heal: 20, curse_hp: 5 }), o(15, '门扉反噬', 'bad', { type: 'heal_curse', heal: 18, curse_hp: 8 })] },
    { label: '把门推开一条缝', outcomes: [o(40, '门后宝物', 'good', { type: 'gold', value: { min: 28, max: 42 } }), o(45, '几件遗物', 'mid', { type: 'gold', value: { min: 14, max: 22 } }), o(15, '门后空空', 'bad', { type: 'gold', value: { min: 3, max: 6 } })] },
  ] }],
])

function catalogAt(pickEvent, stage) {
  const catalog = new Map()
  for (let index = 0; index < 1000; index++) {
    const event = pickEvent(stage, () => (index + 0.5) / 1000)
    assert.ok(event.stageMin <= stage, `${event.id}: locked event was selected at stage ${stage}`)
    catalog.set(event.id, event)
  }
  return catalog
}

function trackedRng(values, label) {
  let calls = 0
  return {
    rng: () => {
      assert.ok(calls < values.length, `${label}: unexpected RNG draw ${calls + 1}`)
      return values[calls++]
    },
    calls: () => calls,
  }
}

// 分支抽签消耗 1 次抽签；档内效果再按类型消耗（金币区间 +1、装备 +3、重铸 +区间/装备）。
function effectRollCount(effect) {
  switch (effect.type) {
    case 'gold': return typeof effect.value === 'number' ? 0 : 1
    case 'card_trade': return typeof effect.gold === 'number' ? 0 : 1
    case 'drop_equip': return effect.eqId ? 0 : 3
    case 'reforge': {
      const goldRolls = typeof (effect.eqId != null ? effect.gold : effect.sell_price) === 'number' ? 0 : 1
      return goldRolls + (effect.eqId ? 0 : 3)
    }
    case 'gold_xp': return (typeof effect.gold === 'number' ? 0 : 1) + (typeof effect.xp === 'number' ? 0 : 1)
    default: return 0
  }
}

function frozenChoiceOutcomes(choice) {
  return choice.outcomes.map(outcome => ({ weight: outcome.weight, label: outcome.label, tone: outcome.tone, effect: JSON.parse(JSON.stringify(outcome.effect)) }))
}

const noRng = () => { throw new Error('cached or fixed effect unexpectedly consumed RNG') }
const worn = 'eq_holy_helmet_common:1:100'
const spare = 'eq_tempest_pants_common:1:100'
const anotherSpare = 'eq_fortress_gloves_common:2:110'
const pureContext = () => ({ gold: 1000, hp: 70, inventory: [spare, anotherSpare], equipment: { helmet: worn }, purpleLayers: 2 })

// 供旧测试调用：扩展/强制事件的独立契约与纯函数回归。
export function assertOutcomeContracts(catalog, loadProject, contracts) {
  const events = loadProject('./core/events')
  const cards = loadProject('./core/upgrade')
  assert.ok(contracts.size >= 9)
  for (const [id, contract] of contracts) {
    const event = catalog.get(id)
    assert.ok(event, `${id}: event is reachable`)
    assert.equal(event.forced, true, `${id}: forced event`)
    assert.equal(event.stageMin, contract.stageMin, `${id}: approved stageMin`)
    assert.deepEqual(event.choices.map(choice => ({ label: choice.label, outcomes: frozenChoiceOutcomes(choice) })),
      contract.choices.map(choice => ({ label: choice.label, outcomes: frozenChoiceOutcomes(choice) })),
      `${id}: independent exact ordered choice contracts`)
    assert.ok(!event.choices.some(choice => 'tooltip' in choice), `${id}: choices carry no preview tooltip`)
    const original = JSON.stringify(event)
    for (const [choiceIndex, expected] of contract.choices.entries()) {
      const choice = event.choices[choiceIndex]
      const label = `${id}[${choiceIndex}]`
      assert.equal(choice.outcomes.length, 3, `${label}: exactly three outcomes`)
      assert.equal(choice.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0), 100, `${label}: weights sum to 100`)
      assert.ok(choice.outcomes.every(outcome => ['good', 'mid', 'bad'].includes(outcome.tone)), `${label}: valid tones`)
      assert.ok(choice.outcomes.every(outcome => typeof outcome.label === 'string' && outcome.label), `${label}: themed labels present`)
      // 纯函数回归：分支抽签 + 档内结算逐次消耗受控 RNG，与独立实现完全一致。
      for (const branchRoll of [0, 0.44, 0.79, 0.999999]) {
        const rolls = [branchRoll, ...Array.from({ length: 8 }, (_, i) => (i * 7919 % 97) / 97)]
        const rng = trackedRng(rolls, `${label} @${branchRoll}`)
        const resolved = events.resolveEventOutcome(choice.outcomes, contract.stageMin, rng.rng, pureContext())
        // 期望抽签数 = 1 次分支 + 原始档位效果的内层抽签（金币区间 +1、装备 +3、重铸 +装备3+区间1）。
        const weights = choice.outcomes.map(outcome => outcome.weight)
        let acc = 0
        const pickedIndex = weights.reduce((found, weight, index) => {
          if (found >= 0) return found
          acc += weight
          return branchRoll * 100 < acc ? index : found
        }, -1)
        assert.equal(resolved.label, choice.outcomes[pickedIndex].label, `${label}: branch roll ${branchRoll} picks tier ${pickedIndex}`)
        assert.equal(rng.calls(), 1 + effectRollCount(choice.outcomes[pickedIndex].effect), `${label} @${branchRoll}: exact RNG draw count`)
        assert.ok(resolved && ['good', 'mid', 'bad'].includes(resolved.tone), `${label}: resolved tone`)
        assert.ok(choice.outcomes.some(outcome => outcome.label === resolved.label), `${label}: resolved label comes from the outcome table`)
        assert.ok(resolved.effect && typeof resolved.effect.type === 'string', `${label}: resolved effect`)
        const text = events.buildEventResult(resolved.effect)
        assert.doesNotMatch(text, /undefined|NaN|永久|无法显示|数据不可用/, `${label}: readable result text`)
        for (const grant of resolved.effect.cardGrants ?? []) assert.equal(cards.cardById(grant.id)?.id, grant.id, `${label}: exact grant id`)
        // 权重边界重复断言（由上面的 pickedIndex 一并覆盖）。
        assert.equal(resolved.label, choice.outcomes[pickedIndex].label, `${label}: branch roll ${branchRoll} picks tier ${pickedIndex}`)
      }
      // 不可行档剔除：把资源清零后，付费档被跳过，剩余档按剩余权重归一化抽取。
      const brokeContext = { gold: 0, hp: 1, inventory: [], equipment: {}, purpleLayers: 0 }
      const feasible = choice.outcomes.filter(outcome => !events.getEventChoiceDisabledReason(outcome.effect, brokeContext))
      if (feasible.length && feasible.length < 3) {
        const resolved = events.resolveEventOutcome(choice.outcomes, contract.stageMin, () => 0.999999, brokeContext)
        assert.ok(feasible.some(outcome => outcome.label === resolved.label), `${label}: infeasible tiers excluded under broke context`)
      }
    }
    assert.equal(JSON.stringify(event), original, `${id}: no definition mutation`)
  }
}

function snapshot(store, omitResult = false) {
  const state = { ...store.$state }
  if (omitResult) { delete state.eventResult; delete state.gameEvent; delete state.screen }
  return JSON.stringify(state)
}

function cardCounts(store) {
  return Object.fromEntries(store.upgrades.map(card => [card.def.id, card.count]))
}

export async function run() {
  const { loadProject } = await import('../harness.mjs')
  const events = loadProject('./core/events')
  const { cardById } = loadProject('./core/upgrade')
  const { useGameStore } = loadProject('./store/gameStore')
  const { createScopedRng } = loadProject('./core/random')
  const { createPinia, setActivePinia } = createRequire(import.meta.url)('pinia')
  const catalogs = new Map([1, 2, 3, 4].map(stage => [stage, catalogAt(events.pickEvent, stage)]))
  for (const [stage, catalog] of catalogs) {
    assert.equal(catalog.size, stage === 1 ? 12 : stage === 2 ? 26 : 34, `S${stage}: exact catalog size`)
    for (const [id, contract] of EXPANSION_CONTRACTS) assert.equal(catalog.has(id), stage >= contract.stageMin, `${id}: stage gate ${stage}`)
  }
  const catalog = catalogs.get(3)
  assertOutcomeContracts(catalog, loadProject, EXPANSION_CONTRACTS)
  assertOutcomeContracts(catalog, loadProject, FORCED_CONTRACTS)
  assert.equal(EXPANSION_CONTRACTS.size + FORCED_CONTRACTS.size, 19)

  const fresh = (id, stage) => {
    setActivePinia(createPinia())
    const store = useGameStore()
    store.START_RUN(42)
    store.stage = stage ?? (EXPANSION_CONTRACTS.get(id) ?? FORCED_CONTRACTS.get(id)).stageMin
    store.screen = 'event'
    store.currentNodeId = `s${store.stage}_${id}`
    store.gameEvent = structuredClone(catalog.get(id))
    store.player.gold = 1000
    store.player.hp = 70
    store.player.inventory = [worn, spare, anotherSpare]
    store.player.equipment = { helmet: worn }
    store.upgrades = [{ def: cardById('doom_soul'), count: 1 }, { def: cardById('curse_burn'), count: 2 }]
    return store
  }
  const installRng = (store, values, choiceIndex) => {
    const rng = trackedRng(values, `${store.gameEvent.id}[${choiceIndex}] store`)
    let factories = 0
    store._rng = (...scope) => {
      assert.deepEqual(scope, ['event-choice', choiceIndex], 'store uses the correct deterministic choice scope')
      assert.equal(++factories, 1, 'settlement creates one scoped RNG only')
      return rng.rng
    }
    return rng
  }
  const blockRng = store => { store._rng = () => { throw new Error('blocked/settled event requested a new RNG') } }
  const outcomesFor = (id, index) => (EXPANSION_CONTRACTS.get(id) ?? FORCED_CONTRACTS.get(id)).choices[index].outcomes

  const originalRandom = Math.random
  const originalNow = Date.now
  try {
    Math.random = () => { throw new Error('unseeded event RNG') }
    Date.now = () => { throw new Error('wall clock event RNG') }

    // 生产作用域 RNG 与显式 createScopedRng 一致；同 seed/node/choice 结算完全相同。
    for (const [id, index] of [['lost_messenger', 0], ['roaming_smith', 0], ['starving_ambush', 1]]) {
      const first = fresh(id)
      const expected = events.resolveEventOutcome(first.gameEvent.choices[index].outcomes, first.stage,
        createScopedRng(first.runSeed, first.stage, first.currentNodeId, 'event-choice', index), first.eventContext)
      first.CHOOSE_EVENT(index)
      assert.equal(first.eventResult.outcomeLabel, expected.label, `${id}: production scoped RNG matches explicit deterministic scope`)
      assert.deepEqual(first.eventResult.effect, expected.effect, `${id}: resolved effect identical`)
      const second = fresh(id)
      second.CHOOSE_EVENT(index)
      assert.deepEqual(JSON.stringify(second.eventResult), JSON.stringify(first.eventResult), `${id}: same seed/node/choice settles identically`)
      // 事件内部重复结算被拒绝：结果页只能离开。
      const settled = snapshot(second)
      second.CHOOSE_EVENT(index); second.CHOOSE_EVENT((index + 1) % second.gameEvent.choices.length)
      assert.equal(snapshot(second), settled, `${id}: cannot settle twice or switch option after settlement`)
      blockRng(first); blockRng(second)
      first.LEAVE_EVENT(); second.LEAVE_EVENT()
      assert.equal(first.screen, 'route'); assert.equal(second.screen, 'route')
    }

    // 每个真实选项用契约分支下界抽样结算：资源增量与该档效果完全一致。
    const resourceDelta = (before, beforeMax, effect) => {
      const equipBonus = beforeMax - before.maxHp
      const wanted = { gold: before.gold, hp: before.hp, maxHp: before.maxHp }
      switch (effect.type) {
        case 'gold': wanted.gold += effect.value; break
        case 'heal': wanted.hp = Math.min(beforeMax, wanted.hp + Math.floor(beforeMax * effect.value / 100)); break
        case 'hp_reduce': wanted.hp = Math.max(1, wanted.hp - effect.value); break
        case 'hp_reduce_pct':
          wanted.hp = Math.max(1, Math.floor(wanted.hp * (1 - effect.value / 100)))
          break
        case 'maxhp_down_pct':
          wanted.maxHp = Math.max(10, wanted.maxHp - Math.floor(wanted.maxHp * effect.value / 100))
          wanted.hp = Math.min(wanted.hp, wanted.maxHp + equipBonus)
          break
        case 'heal_curse':
          wanted.hp = Math.min(beforeMax, wanted.hp + Math.floor(beforeMax * effect.heal / 100))
          wanted.maxHp = Math.max(10, wanted.maxHp - Math.floor(before.maxHp * effect.curse_hp / 100))
          wanted.hp = Math.min(wanted.hp, wanted.maxHp + equipBonus)
          break
        case 'gold_heal':
          wanted.gold += effect.gold
          wanted.hp = Math.min(beforeMax, wanted.hp + Math.floor(beforeMax * effect.heal / 100))
          break
        case 'gold_xp': wanted.gold += effect.gold; break
        case 'drop_equip': wanted.gold -= effect.cost; break
        case 'reforge': wanted.gold += effect.gold - effect.cost; break
        case 'card_trade': {
          wanted.gold += effect.gold - effect.cost
          wanted.hp -= effect.hpCost
          // 生命上限卡在获得时等量回复（受治疗衰减，新档上下文衰减为 0）；上限进入有效值而非基础值。
          const bonus = (effect.cardGrants ?? []).reduce((sum, grant) => {
            const def = cardById(grant.id)
            return sum + (def?.effects ?? []).filter(item => item.type === 'maxHpBonus').reduce((total, item) => total + item.value * grant.count, 0)
          }, 0)
          wanted.hp = Math.min(wanted.hp + bonus, beforeMax)
          break
        }
      }
      return wanted
    }
    for (const [id, contract] of [...EXPANSION_CONTRACTS, ...FORCED_CONTRACTS]) {
      for (const [choiceIndex, expectedChoice] of contract.choices.entries()) {
        const rolls = Array.from({ length: 8 }, () => 0.449999)
        const store = fresh(id)
        const beforePlayer = JSON.parse(JSON.stringify(store.player))
        const beforeMax = store.effectivePlayer.maxHp
        const rng = installRng(store, rolls, choiceIndex)
        store.CHOOSE_EVENT(choiceIndex)
        assert.ok(rng.calls() >= 1 && rng.calls() <= rolls.length, `${id}[${choiceIndex}]: bounded RNG consumption`)
        assert.ok(store.eventResult, `${id}[${choiceIndex}]: settled result cached`)
        assert.equal(store.screen, 'event', `${id}[${choiceIndex}]: stays on the result page`)
        assert.ok(expectedChoice.outcomes.some(outcome => outcome.label === store.eventResult.outcomeLabel), `${id}[${choiceIndex}]: outcome label from contract`)
        const wanted = resourceDelta(beforePlayer, beforeMax, store.eventResult.effect)
        assert.equal(store.player.gold, wanted.gold, `${id}[${choiceIndex}]: exact gold delta`)
        assert.equal(store.player.hp, wanted.hp, `${id}[${choiceIndex}]: exact hp delta`)
        assert.equal(store.player.maxHp, wanted.maxHp, `${id}[${choiceIndex}]: exact maxHp delta`)
        assert.ok(store.gameEvent, `${id}[${choiceIndex}]: event retained until leave`)
        const applied = snapshot(store, true)
        store.LEAVE_EVENT()
        assert.equal(snapshot(store, true), applied, `${id}[${choiceIndex}]: leaving only clears the event state`)
        assert.equal(store.screen, 'route', `${id}[${choiceIndex}]: leave returns to route`)
        blockRng(store)
      }
    }

    // 禁用选项：付费档全部不可行时选项禁用，CHOOSE 无副作用；禁用原因写明价格。
    {
      const store = fresh('gambler', 2)
      store.player.gold = 0
      assert.match(store.eventChoiceDisabledReason(0), /金币不足：需要 20 金币/)
      const before = snapshot(store, true)
      store.CHOOSE_EVENT(0)
      assert.equal(snapshot(store, true), before, 'disabled choice never settles')
      // 防死锁：0 金、1 血、无装备无紫卡时，每事件至少一个选项三档全可行。
      for (const event of catalog.values()) {
        const brokenContext = { gold: 0, hp: 1, inventory: [], equipment: {}, purpleLayers: 0 }
        assert.ok(event.choices.some(choice => events.getEventChoiceDisabledReasonForChoice(choice, brokenContext) === null),
          `${event.id}: always-available choice exists under broke context`)
      }
    }

    // 溢出注入：结算门禁 fail-fast 抛错，任何资源不发不扣。
    {
      const store = fresh('crimson_garden')
      store.consumableCounts.berserk_potion = Number.MAX_SAFE_INTEGER
      const before = snapshot(store, true)
      const rng = installRng(store, [0.44], 0)
      assert.throws(() => store.CHOOSE_EVENT(0), /事件结算失败（crimson_garden）：奖励数量溢出或定义无效/, 'overflow surfaces as fail-fast')
      assert.equal(rng.calls(), 1, 'only the branch roll consumed before the invariant trips')
      assert.equal(snapshot(store, true), before, 'overflow rejects the whole settlement atomically')
      assert.equal(store.eventResult, null, 'no result page after failed settlement')
    }

    // 黑卡直接生效：命运下注任意档位都无需确认。
    {
      const store = fresh('astral_chess')
      const rng = installRng(store, [0.2, 0.2], 1)
      store.CHOOSE_EVENT(1)
      assert.equal(rng.calls(), 2, 'branch roll + trade gold roll')
      assert.equal(store.upgrades.some(card => card.def.cardClass === 'black'), true, 'black card granted without confirmation')
      assert.equal(store.upgrades.some(card => card.def.id === 'gold_crit'), true, 'gold cards ride along')
      assert.ok(JSON.stringify(store.eventResult.effect.cardGrants).includes('doom_rage'))
      store.LEAVE_EVENT()
      assert.equal(store.screen, 'route')
    }

    // 双重断咒可跨两个紫卡条目；结算页停留期间不可选新项。
    {
      const store = fresh('cleansing_altar')
      store.upgrades = [
        { def: cardById('doom_rage'), count: 3 }, { def: cardById('red_blood'), count: 2 },
        { def: cardById('curse_burn'), count: 1 }, { def: cardById('doom_soul'), count: 1 },
        { def: cardById('curse_decay'), count: 2 }, { def: cardById('def_up_1'), count: 2 },
      ]
      store.player.gold = 1000
      const rng = installRng(store, [0.444, 0.444], 3)
      store.CHOOSE_EVENT(3)
      assert.equal(rng.calls(), 2, 'branch roll + fixed trade draws')
      assert.ok(['双咒俱碎', '双重净化'].includes(store.eventResult.outcomeLabel), 'double cleanse tier drawn')
      assert.deepEqual(cardCounts(store).curse_decay, 1, 'two layers removed from the first stack')
      store.LEAVE_EVENT()
      assert.equal(store.screen, 'route')
    }

    // 净化药剂可零紫卡购买；付费档不足时免费/负代价档剔除后仍能推进。
    {
      const store = fresh('cleansing_altar')
      store.upgrades = [{ def: cardById('doom_soul'), count: 2 }]
      const rng = installRng(store, [0.4, 0.4], 2)
      store.CHOOSE_EVENT(2)
      assert.equal(rng.calls(), 2, 'branch roll + fixed trade draws')
      assert.deepEqual(store.consumableCounts, { cleanse_potion: 1 }, 'cleanse potion bought with no purple held')
      store.LEAVE_EVENT()
    }

    // 重铸目标消失的 fail-fast：结算前门禁放行后缓存目标不可变。
    {
      const store = fresh('roaming_smith')
      store.player.inventory = [spare, worn, anotherSpare]
      store.player.equipment = { helmet: worn }
      const rolls = [0.86, 0.86, 0.86, 0.86, 0.86, 0.86, 0.86]
      const rng = installRng(store, rolls, 0)
      const previousTier = outcomesFor('roaming_smith', 0)
      store.CHOOSE_EVENT(0)
      assert.ok(rng.calls() <= rolls.length, 'bounded reforge draws')
      assert.ok(store.eventResult, 'reforge settles with eligible item held')
      assert.ok(previousTier.some(tier => tier.label === store.eventResult.outcomeLabel))
      store.LEAVE_EVENT()
    }

    // 挥金如土只统计主动支付：paid 负金币档走消费统计，意外损失只扣金币。
    {
      const mkStore = () => {
        setActivePinia(createPinia())
        const store = useGameStore()
        store.START_RUN(7)
        store.screen = 'event'
        store.stage = 2
        store.player.gold = 100
        store.upgrades = [{ def: cardById('spend_blade'), count: 1 }]
        return store
      }
      const settleUniform = (store, effect) => {
        store.gameEvent = {
          id: 'audit-gold', title: '审计', icon: '', desc: '', stageMin: 1, forced: true,
          choices: [{ label: '单一选项', outcomes: [34, 33, 33].map((weight, index) => ({ weight, label: `档${index}`, tone: 'mid', effect: { ...effect } })) }],
        }
        store.CHOOSE_EVENT(0)
        assert.ok(store.eventResult, 'uniform tiers always settle the same effect')
      }
      const paying = mkStore()
      settleUniform(paying, { type: 'gold', value: -25, paid: true })
      assert.equal(paying.player.gold, 75, 'active payment deducts gold')
      assert.equal(paying.runStats.goldSpent, 25, 'active payment counts as spending')
      assert.equal(paying.player.attackMultiplier, 1.01, 'spend blade grows across the 25-coin threshold')
      const losing = mkStore()
      settleUniform(losing, { type: 'gold', value: -25 })
      assert.equal(losing.player.gold, 75, 'accidental loss deducts gold too')
      assert.equal(losing.runStats.goldSpent, 0, 'accidental loss is not spending')
      assert.equal(losing.player.attackMultiplier, 1, 'spend blade ignores accidental loss')
      // 源数据负金币档由 o() 统一标记主动支付，结算结果保留该标记。
      const gambler = catalogs.get(3).get('gambler')
      const resolved = events.resolveEventOutcome(gambler.choices[0].outcomes, 2, () => 0.999, { gold: 1000, hp: 70, purpleLayers: 0, inventory: [], equipment: {} })
      assert.equal(resolved.effect.type, 'gold', 'bad tier loses the stake')
      assert.equal(resolved.effect.value, -20)
      assert.equal(resolved.effect.paid, true, 'stake tiers from source data are marked as active payments')
    }

    // 只读事件目录：与 pickEvent 阶段池一致，返回浅拷贝不暴露内部数组。
    {
      const catalog = events.getEventCatalog()
      assert.equal(catalog.length, 34, 'full catalog enumerated without RNG')
      assert.deepEqual([1, 2, 3].map(stage => catalog.filter(event => event.stageMin <= stage).length), [12, 26, 34], 'cumulative stage pools')
      for (const [stage, sampled] of catalogs) {
        assert.deepEqual([...sampled.keys()].sort(), catalog.filter(event => event.stageMin <= stage).map(event => event.id).sort(), `stage ${stage}: catalog matches pickEvent pool`)
      }
      const before = catalog[0].choices.length
      catalog[0].choices.push({ label: 'tamper', outcomes: [] })
      assert.equal(events.getEventCatalog()[0].choices.length, before, 'catalog returns defensive copies')
    }

    // 选项代价摘要（UI 与文档生成共用）：支付与前提条件，混合档给范围/上限。
    {
      const catalog = events.getEventCatalog()
      const byId = new Map(catalog.map(event => [event.id, event]))
      const costOf = (id, index) => events.summarizeChoiceCost(byId.get(id).choices[index].outcomes)
      assert.equal(costOf('treasure_chest', 0), null, 'free choice has no cost line')
      assert.equal(costOf('gambler', 0), '支付20 金币', 'uniform stake across tiers')
      assert.equal(costOf('screaming_well', 0), '支付6~15 金币', 'varying payment becomes a range')
      assert.equal(costOf('cleansing_hermit', 0), '支付最多 40 金币', 'free bad tier caps the payment claim')
      assert.equal(costOf('cleansing_altar', 3), '支付65 金币', 'mixed purple prerequisite is omitted from the cost line')
      assert.equal(costOf('crimson_garden', 0), '支付最多 18 点生命', 'hp payment with a loss-only bad tier is capped')
      assert.equal(costOf('roaming_smith', 0), '需 1 件未装备普通装备', 'reforge prerequisite')
      assert.equal(costOf('starving_ambush', 1), '支付最多 18 点生命', 'hpCost tiers with an unpaid bad tier are capped')
      const synthetic = [
        { weight: 50, label: 'a', tone: 'good', effect: { type: 'card_trade', grants: [], cost: 30, gold: 0, hpCost: 0, removesPurple: 2 } },
        { weight: 30, label: 'b', tone: 'mid', effect: { type: 'card_trade', grants: [], cost: 30, gold: 0, hpCost: 0, removesPurple: 2 } },
        { weight: 20, label: 'c', tone: 'bad', effect: { type: 'card_trade', grants: [], cost: 30, gold: 0, hpCost: 0, removesPurple: 2 } },
      ]
      assert.equal(events.summarizeChoiceCost(synthetic), '支付30 金币；需持有 2 层紫卡', 'uniform prerequisites are listed')
    }
  } finally {
    Math.random = originalRandom
    Date.now = originalNow
  }
}
