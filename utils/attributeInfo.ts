import type { BattleState, CardModifiers, PlayerStats } from '../types'
import type { BattlePreview } from '../core/battle'

export interface AttributeInfo { title: string; summary: string; value: string; details: string[]; calculation?: string }
export interface AttributeContext { player: PlayerStats; basePlayer?: PlayerStats; modifiers?: CardModifiers; battle?: BattleState | null; preview?: BattlePreview | null }
const number = (value: number) => String(Number(value.toFixed(2)))

export function attributeInfo(key: string, context: AttributeContext): AttributeInfo {
  const { player, battle, preview, modifiers } = context
  const emptyCells = battle?.grid.flat().filter(cell => cell.value === 0).length ?? 0
  const boardSum = battle?.grid.flat().reduce((sum, cell) => sum + cell.value, 0) ?? 0
  switch (key) {
    case 'player.hp': return { title: '生命', value: `${player.hp} / ${player.maxHp}`, summary: '生命降到 0，本次冒险就会结束。', details: ['生命上限来自初始成长、生命卡、装备和套装。', '治疗最多恢复到生命上限。受到诅咒时，实际回复可能减少。', '更换装备不会自动回满生命。'] }
    case 'player.attack': return { title: '攻击', value: preview ? `现在出手可造成 ${preview.enemyDamage} 点伤害` : `攻击增强 ×${number(player.attackMultiplier)}`, summary: '合并相同数字，积攒本回合的攻击。', details: [`已积攒 ${number(battle?.totalAttack ?? 0)} 点攻击；回合结束后清空。`, `攻击增强 ×${number(player.attackMultiplier)}；装备额外攻击 ${player.flatAttack}。`, '没有合并积攒攻击时，不会仅靠装备自动出手。', '合并越多、数字越大，积攒的攻击通常越高。'], calculation: preview ? `向下取整（${number(battle?.totalAttack ?? 0)} × ${number(player.attackMultiplier)} − 敌人防御 ${preview.enemyDefense}）＋装备攻击 ${player.flatAttack}，最低 0。` : undefined }
    case 'player.defense': {
      const spawnCoefficient = (player.spawnArmor ?? 0) + (modifiers?.spawnArmor ?? 0)
      const total = (preview?.defenseValue ?? 0) + player.flatDefense
      return { title: '防御', value: preview ? `总防御 ${number(total)}，预计受伤 ${preview.playerDamage}` : `防御增强 ×${number(player.defenseMultiplier)}`, summary: '防御越高，敌人攻击时损失的生命越少。', details: [`盘面数字总和 ${number(boardSum)}，防御增强 ×${number(player.defenseMultiplier)}。`, `本回合新方块数值 ${number(battle?.totalDefense ?? 0)}，每点额外提供 ${number(spawnCoefficient)} 防御。`, `合并带来的防御 ${number(battle?.mechanicArmor ?? 0)}，从上回合留下 ${number(battle?.carryArmor ?? 0)}，装备固定防御 ${player.flatDefense}。`, '有攻击力的敌人，单靠防御至少仍会造成 1 点伤害；闪避或先手击杀可以避免受伤。'], calculation: preview ? `盘面防御、新块防御、合并防御、保留防御相加后整体向下取整，再加装备固定防御。敌人攻击 ${preview.enemyAttack} × 15 ÷（15 ＋ 总防御 ${number(total)}），向上取整；随后计算易伤与首击减半。` : undefined }
    }
    case 'player.speed': return { title: '速度', value: preview ? `${number(player.baseSpeed)} ＋ ${emptyCells} 个空格 ＝ ${number(preview.playerSpeed)}` : number(player.baseSpeed), summary: '空格越多，出手越快。', details: [`基础速度（已含装备）${number(player.baseSpeed)}。`, '速度高的一方先攻击；同速时你先攻击。', '如果先击败敌人，对方就不能反击。先手套装可直接改变顺序。'] }
    case 'player.steps': return { title: '行动次数', value: battle ? `剩余 ${Math.max(0, battle.maxTurns - battle.turnsUsed)} / ${battle.maxTurns} 步` : `每回合 ${player.baseMaxTurns + player.bonusTurns} 步`, summary: '每次能让棋盘发生变化的移动，消耗 1 步。', details: ['没移动、没合并的方向不会消耗步数。', '用完步数，或点击结束回合后，双方开始攻击。', '卡片、装备和药剂可以增加步数。只有击杀回合未用的基础步数，每步奖励 2 金币；额外步数不增加奖励。'] }
    case 'player.gold': return { title: '金币', value: String(player.gold), summary: '用来购买装备、强化和道具。', details: [`战斗基础金币奖励增加 ${number(player.goldBoost * 100)}%。`, '事件、省步奖励和溢出兑换另行结算，不再次乘这个加成。', '结束冒险时，部分金币会换成灵魂碎片。'] }
    case 'player.xp': return { title: '经验与等级', value: `等级 ${player.level}，经验 ${player.xp} / ${player.xpToNext}`, summary: '经验满了会升级，获得一次强化选择。', details: ['一次获得大量经验，可以连续升级，奖励会依次出现。', '升级后剩余经验继续保留，不是经验被扣掉。', '击败敌人、部分事件和溢出兑换可带来经验。'] }
    case 'enemy.hp': return { title: '敌人生命', value: `${battle?.enemyCurrentHp ?? 0} / ${battle?.enemy.maxHp ?? 0}`, summary: '将敌人的生命降到 0，赢得战斗。', details: ['敌人活着时才会反击；先手击杀能避免这次来袭。', '部分黑卡会让存活敌人每回合恢复生命，但不会复活已被击败的敌人。'] }
    case 'enemy.attack': return { title: '敌人攻击', value: number(preview?.enemyAttack ?? 0), summary: '这是敌人出手前的攻击力，你的防御会减少实际损血。', details: [`当前预计受到 ${preview?.playerDamage ?? 0} 点攻击伤害。`, '已计入回合成长和套装削弱，不含额外诅咒直接损血。', '预估不保证闪避或停手触发。'] }
    case 'enemy.defense': return { title: '敌人防御', value: number(preview?.enemyDefense ?? 0), summary: '敌人防御会抵消你的部分攻击。', details: ['这里已计入敌人回合成长和你的穿透效果。', '提升攻击、合并更大的方块，可以突破防御。'] }
    case 'enemy.speed': return { title: '敌人速度', value: number(preview?.enemySpeed ?? 0), summary: '与你的速度相比，决定谁先攻击。', details: ['敌人每多战斗一回合，速度通常会提高。', '清出更多空格可以提高你的速度；同速时你先手。'] }
    default: return { title: '属性说明', value: '', summary: '点击生命、攻击、防御、速度或步数，查看当前作用。', details: [] }
  }
}
