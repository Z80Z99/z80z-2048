import { defineStore } from 'pinia'
import type { BattleState, GameState, PlayerStats, RewardRequest, RoundResult, UpgradeDef } from '../types'
import { createRng, createScopedRng } from '../core/random'
import { initBattle, processTurn, resolveRound, startNewRound, getBattlePreview } from '../core/battle'
import { generateRoute } from '../core/route'
import { ENEMIES, getBestiaryId } from '../core/enemy'
import { ALL_EQUIPMENT, computeEquipBonuses, getEffectivePlayer, rollEquipEffects, equipmentById, makeEquipId, sortInventory, equipCost } from '../core/equipment'
import type { EquipSlot, SortMode } from '../core/equipment'
import { pickEvent, resolveEventEffect, buildEventResult, getEventChoiceDisabledReason } from '../core/events'
import type { EventEffect } from '../core/events'
import { getMetaUpgrades, UPGRADE_POOL, upgradeCost } from '../core/upgrade'
import { createInitialState } from './initialState'
import { getStartingTileBonuses, applyMetaUpgrades, rollRewardChoices, buildShop } from './helpers'
import { debugActions } from './debugActions'
import { gainXp } from '../core/progress'
import { loadMeta, saveMeta } from '../utils/storage'

function addBonus(current: number, amount: number): number {
  return Math.round((current + amount) * 1e10) / 1e10
}

export const useGameStore = defineStore('game', {
  state: (): GameState => createInitialState(),

  getters: {
    effectivePlayer(state): PlayerStats {
      return getEffectivePlayer(state.player, state.battle?.equipEffects)
    },
    battlePreview(state): ReturnType<typeof getBattlePreview> | null {
      return state.battle ? getBattlePreview(state.battle, state.player) : null
    },
  },

  actions: {
    loadMeta() { this.meta = loadMeta() },
    saveMetaState() { saveMeta(this.meta) },

    START_RUN(seed?: number) {
      const s = Number.isFinite(seed) ? seed! : Date.now()
      const { meta, theme } = this
      Object.assign(this, createInitialState(), { meta, theme, runSeed: s })
      this.player = { ...this.player, ...applyMetaUpgrades(meta) }
      this.route = generateRoute(createRng(s), 1)
      this.currentNodeId = null
      if (meta.purchasedIds.includes('meta_start')) this.rewardQueue.push({ reason: 'start' })
      if (!this._showNextReward()) this.screen = 'route'
    },

    SELECT_NODE(nodeId: string) {
      if (this.screen !== 'route' || this.runOutcome) return
      const node = this.route.find(n => n.id === nodeId)
      if (!node || !node.accessible || node.completed) return
      if (['battle', 'elite', 'boss'].includes(node.type) && !node.enemy) return
      this.route = this.route.map(n => ({
        ...n,
        completed: n.completed || n.id === nodeId,
        accessible: node.nextIds.includes(n.id),
      }))
      this.currentNodeId = nodeId

      if (node.enemy && ['battle', 'elite', 'boss'].includes(node.type)) {
        const effects = rollEquipEffects(computeEquipBonuses(this.player.equipment).setEffects, this._rng('equipment', 1))
        const player = getEffectivePlayer(this.player, effects)
        this.battle = {
          ...initBattle(node.enemy, player.baseMaxTurns + player.bonusTurns + (effects.extraTurns || 0), this._rng('board', 1), getStartingTileBonuses(this.upgrades)),
          equipEffects: effects, fortifyUsed: false, totalTurns: 0,
        }
        this.screen = 'battle'
      } else if (node.type === 'shop') {
        Object.assign(this, buildShop(this._rng('shop', 0), this.stage, this.upgrades))
        this.shopRefreshCount = 0
        this.screen = 'shop'
      } else if (node.type === 'rest') {
        this._heal(Math.floor(this.effectivePlayer.maxHp * 0.3))
        this.screen = 'rest'
      } else if (node.type === 'event') {
        this.gameEvent = pickEvent(this.stage, this._rng('event'))
        this.eventResult = null
        this.screen = 'event'
      }
    },

    eventChoiceDisabledReason(choiceIndex: number): string | null {
      const choice = this.gameEvent?.choices[choiceIndex]
      if (!choice) return '该选项不可用'
      const disabled = getEventChoiceDisabledReason(choice.effect as EventEffect, this.player)
      if (disabled) return disabled
      if (this.eventResult?.choiceIndex === choiceIndex) return getEventChoiceDisabledReason(this.eventResult.effect as EventEffect, this.player)
      return null
    },

    RESOLVE_EVENT(choiceIndex: number) {
      if (this.screen !== 'event' || !this.gameEvent || this.eventResult) return
      if (this.eventChoiceDisabledReason(choiceIndex)) return
      const choice = this.gameEvent.choices[choiceIndex]
      const effect = resolveEventEffect(choice.effect as EventEffect, this.stage, this._rng('event-choice', choiceIndex), this.player)
      this.eventResult = { label: choice.label, desc: buildEventResult(effect), choiceIndex, effect }
    },

    APPLY_EVENT() {
      if (this.screen !== 'event' || !this.gameEvent || !this.eventResult) return
      const { choiceIndex, effect: eff } = this.eventResult
      if (this.eventChoiceDisabledReason(choiceIndex) || getEventChoiceDisabledReason(eff as EventEffect, this.player)) return
      switch (eff.type) {
        case 'gold': this.player.gold += eff.value ?? 0; break
        case 'heal': this._heal(Math.floor(this.effectivePlayer.maxHp * (eff.value ?? 10) / 100)); break
        case 'gold_heal':
          this._heal(Math.floor(this.effectivePlayer.maxHp * eff.heal / 100))
          this.player.gold += eff.gold
          break
        case 'heal_curse':
          this._heal(Math.floor(this.effectivePlayer.maxHp * eff.heal / 100))
          this.player.maxHp = Math.max(10, this.player.maxHp - Math.floor(this.player.maxHp * eff.curse_hp / 100))
          break
        case 'gold_xp': this.player.gold += eff.gold; this._gainXp(eff.xp); break
        case 'xp': this._gainXp(eff.value ?? 0); break
        case 'hp_reduce': this.player.hp = Math.max(1, this.player.hp - (eff.value ?? 0)); break
        case 'hp_reduce_pct':
          this.player.hp = Math.max(1, Math.floor(this.player.hp * (1 - (eff.value ?? 0) / 100)))
          this.player.attackMultiplier += eff.atk_mult ?? 0
          this.player.defenseMultiplier += eff.def_mult ?? 0
          break
        case 'maxhp_down':
        case 'maxhp_down_pct':
          this.player.maxHp = Math.max(10, this.player.maxHp - Math.floor(this.player.maxHp * (eff.value ?? 0) / 100))
          this.player.attackMultiplier += eff.atk_mult ?? 0
          this.player.defenseMultiplier += eff.def_mult ?? 0
          break
        case 'maxhp_up': this.player.maxHp += eff.value ?? 0; break
        case 'drop_equip':
          if (!this._addEquipment(eff.eqId)) return
          this.player.gold -= eff.cost ?? 0
          break
        case 'reforge': {
          const index = this.player.inventory.indexOf(eff.removeEqId)
          if (index < 0 || !equipmentById(eff.eqId)) return
          this.player.inventory.splice(index, 1)
          this._addEquipment(eff.eqId)
          this.player.gold += (eff.gold ?? 0) - (eff.cost ?? 0)
          break
        }
      }
      this._clampHp()
      this.gameEvent = null
      this.eventResult = null
      if (!this._showNextReward()) this.screen = 'route'
    },

    SLIDE(direction: string) {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'playing') return
      const before = this.battle
      const updated = processTurn(before, direction, this._rng('spawn', before.round, before.turnsUsed))
      if (updated === before) return
      updated.totalTurns = (before.totalTurns || 0) + updated.turnsUsed - before.turnsUsed
      if (updated.phase === 'round_delay') this._settleRound(updated)
      else this.battle = updated
    },

    END_TURN_EARLY() {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'playing') return
      const b = this.battle
      const remaining = b.maxTurns - b.turnsUsed
      if (remaining <= 0) return
      this._settleRound({ ...b, phase: 'round_delay', savedSteps: b.savedSteps + remaining })
    },

    SHOW_ROUND() { if (this.battle?.phase === 'round_delay') this.battle.phase = 'round_end' },
    SHOW_BATTLE_RESULT() { if (this.battle?.phase === 'finish_delay') this.battle.phase = 'finished' },

    NEXT_ROUND() {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'round_end') return
      const round = this.battle.round + 1
      const effects = rollEquipEffects(computeEquipBonuses(this.player.equipment).setEffects, this._rng('equipment', round))
      this.battle = {
        ...startNewRound(this.battle, this._rng('board', round), getStartingTileBonuses(this.upgrades)),
        equipEffects: effects,
      }
    },

    END_BATTLE(overflowChoice?: 'gold' | 'xp') {
      if (this.screen !== 'battle' || this.battle?.phase !== 'finished' || !this.battle.result) return
      const result = this.battle.result
      this.battle = null
      if (!result.playerWon) { this._finishRun('defeat'); return }
      const overflow = result.overflowDamage ?? 0
      if (overflowChoice === 'gold') this.player.gold += overflow
      if (overflowChoice === 'xp') this._gainXp(Math.floor(overflow / 2))
      if (!this._showNextReward()) this._returnFromRewards()
    },

    BOSS_DEFEATED(action: 'continue' | 'end') {
      if (this.screen !== 'boss_choice' || this.runOutcome) return
      if (action === 'continue') {
        this.stage++
        this.route = generateRoute(createScopedRng(this.runSeed, 'route', this.stage), this.stage)
        this.currentNodeId = null
        this.screen = 'route'
      } else if (action === 'end') this._finishRun('victory')
    },

    LEVEL_UP() {
      if (this.runOutcome || this.screen === 'battle') return
      this.rewardQueue.push({ reason: 'levelup' })
      this._showNextReward()
    },

    PICK_UPGRADE(upgradeId: string) {
      if (this.screen !== 'reward') return
      const chosen = this.rewardChoices.find(u => u.id === upgradeId)
      if (!chosen || !this._grantUpgrade(chosen)) return
      this._consumeReward()
    },

    SKIP_REWARD() {
      if (this.screen === 'reward') this._consumeReward()
    },

    GAME_OVER() {
      if (this.screen !== 'title' && this.screen !== 'meta') this._finishRun('defeat')
    },

    BACK_TO_TITLE() {
      const { meta, theme } = this
      Object.assign(this, createInitialState(), { meta, theme })
      this.saveMetaState()
    },

    GO_TO_META_SHOP() { if (this.screen === 'title' || this.screen === 'gameover') this.screen = 'meta' },
    GO_TO_ROUTE() { if (this.screen === 'shop' || this.screen === 'rest') this.screen = 'route' },

    BUY_META_UPGRADE(upgradeId: string) {
      if (this.screen !== 'meta') return
      const upgrade = getMetaUpgrades().find(u => u.id === upgradeId)
      if (!upgrade || this.meta.totalGold < upgrade.cost || this.meta.purchasedIds.includes(upgradeId)) return
      this.meta.totalGold -= upgrade.cost
      this.meta.purchasedIds.push(upgradeId)
      this.saveMetaState()
    },

    BUY_SHOP_UPGRADE(slot: number) {
      if (this.screen !== 'shop') return
      const uid = this.shopUpgrades[slot]
      const def = UPGRADE_POOL.find(u => u.id === uid)
      if (!def || this.player.gold < upgradeCost(def)) return
      if (!this._grantUpgrade(def)) return
      this.player.gold -= upgradeCost(def)
      this.shopUpgrades[slot] = null
    },

    BUY_SHOP_EQUIP(slot: number) {
      if (this.screen !== 'shop') return
      const eid = this.shopEquipment[slot]
      const eq = eid && equipmentById(eid)
      if (!eq || this.player.gold < equipCost(eq)) return
      if (!this._addEquipment(eid!)) return
      this.player.gold -= equipCost(eq)
      this.shopEquipment[slot] = null
    },

    BUY_SHOP_HEAL(slot: number) {
      if (this.screen !== 'shop' || this.player.hp >= this.effectivePlayer.maxHp) return
      const def = UPGRADE_POOL.find(u => u.id === this.shopHeals[slot] && u.effect.type === 'heal')
      if (!def) return
      const cost = Math.floor(def.effect.value * 1.5)
      if (this.player.gold < cost) return
      this.player.gold -= cost
      this._heal(def.effect.value)
      this.shopHeals[slot] = null
    },

    REFRESH_SHOP() {
      if (this.screen !== 'shop' || this.player.gold < this.shopRefreshCost) return
      const nextCount = this.shopRefreshCount + 1
      const built = buildShop(this._rng('shop', nextCount), this.stage, this.upgrades)
      this.player.gold -= this.shopRefreshCost
      this.shopUpgrades = built.shopUpgrades
      this.shopEquipment = built.shopEquipment
      this.shopHeals = built.shopHeals
      this.shopRefreshCount = nextCount
      this.shopRefreshCost += 10
    },

    SHOP_REMOVE_UPGRADE(upgradeId: string) {
      if (this.screen !== 'shop' || this.shopRemoveUsed || this.player.gold < this.shopRemoveCost) return
      const idx = this.upgrades.findIndex(u => u.def.id === upgradeId)
      if (idx < 0) return
      const rem = this.upgrades[idx]
      if (rem.def.effect.type === 'heal') return
      this.player.gold -= this.shopRemoveCost
      this._reverseUpgradeEffect(rem.def)
      if (rem.count > 1) rem.count--
      else this.upgrades.splice(idx, 1)
      this.shopRemoveUsed = true
    },

    TOGGLE_THEME() { this.theme = this.theme === 'dark' ? 'light' : 'dark' },

    EQUIP_ITEM(itemId: string) {
      if (this.battle || this.eventResult || this.runOutcome || !this.player.inventory.includes(itemId)) return
      const eq = equipmentById(itemId)
      if (!eq || this.player.equipment[eq.slot] === itemId) return
      this.player.equipment = { ...this.player.equipment, [eq.slot]: itemId }
      this._clampHp()
    },

    UNEQUIP_ITEM(slot: EquipSlot) {
      if (this.battle || this.eventResult || this.runOutcome || !this.player.equipment[slot]) return
      this.player.equipment = { ...this.player.equipment, [slot]: undefined }
      this._clampHp()
    },

    SORT_INVENTORY(mode: SortMode) { this.player.inventory = sortInventory(this.player.inventory, mode) },

    CLAIM_BESTIARY_REWARD(rewardType: 'enemy' | 'global', enemyId?: string) {
      if (rewardType === 'enemy' && enemyId) {
        const id = getBestiaryId(enemyId)
        if (!ENEMIES.some(e => e.id === id)) return
        const claimed = this.meta.enemyClaims[id] || 0
        if (Math.floor((this.meta.enemyKills[id] || 0) / 5) <= claimed) return
        this.meta.enemyClaims[id] = claimed + 1
        this.meta.totalGold += 3
      } else if (rewardType === 'global') {
        const milestones = Object.values(this.meta.enemyKills as Record<string, number>).reduce((sum, kills) => sum + Math.floor(kills / 5), 0)
        if (milestones < (this.meta.globalClaimLevel + 1) * 20) return
        this.meta.globalClaimLevel++
        this.meta.totalGold += 10
        this.meta.bestiaryBonusHp += 3
      } else return
      this.saveMetaState()
    },

    ...debugActions,

    _rng(...scope: (string | number)[]): () => number {
      return createScopedRng(this.runSeed, this.stage, this.currentNodeId ?? 'start', ...scope)
    },

    _settleRound(updated: BattleState) {
      const result = resolveRound(updated, this.player, this._rng('combat', updated.round, updated.turnsUsed))
      const hpAfter = result.playerHpAfter ?? Math.max(0, this.player.hp - result.playerDamage)
      this.player.hp = hpAfter
      this.battle = { ...updated, enemyCurrentHp: result.enemyHpAfter, lastRoundResult: result, fortifyUsed: result.fortifyUsed ?? updated.fortifyUsed }
      if (hpAfter <= 0) this._resolvePlayerDeath(this.battle, result)
      else if (result.enemyHpAfter <= 0) this._resolveKill(this.battle, result, hpAfter)
    },

    _resolveKill(updated: BattleState, roundRes: RoundResult, playerHpAfter: number) {
      const nodeType = this.route.find(n => n.id === this.currentNodeId)?.type
      const rewardMult = nodeType === 'boss' ? 3 : nodeType === 'elite' ? 2 : 1
      const effects = updated.equipEffects || {}
      const player = getEffectivePlayer(this.player, effects)
      const enemyGoldBoost = (updated.enemy.enemyUpgrades || []).some(id => UPGRADE_POOL.find(u => u.id === id)?.effect.type === 'gold_boost') ? 0.5 : 0
      let baseGold = Math.floor(updated.enemy.tier * 15 * (1 + player.goldBoost + enemyGoldBoost)) * rewardMult
      let xpEarned = Math.floor((updated.enemy.tier * 8 + Math.floor(updated.totalAttack / 8)) * (1 + player.xpBoost)) * rewardMult
      if (effects.doubleGold) baseGold *= 2
      if (effects.doubleXp) xpEarned *= 2
      const goldEarned = baseGold + updated.savedSteps * 2
      this.player.hp = playerHpAfter
      this.player.gold += goldEarned
      if (nodeType === 'boss' || nodeType === 'elite') {
        this.rewardQueue.push({ reason: nodeType, minRarity: nodeType === 'boss' ? 'epic' : 'rare' })
      }
      const levels = this._gainXp(xpEarned)
      const rng = this._rng('loot')
      const baseDrop = updated.enemy.tier >= 4 ? 1 : updated.enemy.tier >= 3 ? 0.4 : updated.enemy.tier >= 2 ? 0.2 : 0.1
      const dropChance = nodeType === 'boss' ? 1 : nodeType === 'elite' ? Math.min(1, baseDrop * 2) : baseDrop
      const droppedEquipmentIds: string[] = []
      if (rng() < dropChance) {
        const rarities = updated.enemy.tier >= 4 ? [0, 0, 0, 1, 1, 2, 2] : updated.enemy.tier >= 3 ? [0, 0, 0, 1, 1, 2] : updated.enemy.tier >= 2 ? [0, 0, 0, 1, 1] : [0, 0, 0, 1]
        const names = ['common', 'rare', 'epic']
        for (let i = 0; i < (effects.dropCount || 1); i++) {
          const rarity = names[Math.min(2, rarities[Math.floor(rng() * rarities.length)] + (effects.dropRarityBoost || 0))]
          const pool = ALL_EQUIPMENT.filter(e => e.rarity === rarity)
          if (!pool.length) continue
          const level = (this.stage - 1) * 2 + 1 + Math.floor(rng() * 2)
          const id = this._addEquipment(makeEquipId(pool[Math.floor(rng() * pool.length)].id, level, undefined, rng))
          if (id) droppedEquipmentIds.push(id)
        }
      }
      this._recordKill(updated.enemy.id)
      if (nodeType === 'boss') this.meta.highestDepth = Math.max(this.meta.highestDepth, this.stage)
      this.saveMetaState()
      this.battle = {
        ...updated, enemyCurrentHp: 0, phase: 'finish_delay', lastRoundResult: roundRes,
        result: {
          playerWon: true, playerDamageDealt: roundRes.enemyDamage, playerDamageTaken: roundRes.playerDamage,
          goldEarned, totalRounds: updated.round, xpEarned, overflowDamage: roundRes.overflowDamage,
          leveledUp: levels > 0, savedSteps: updated.savedSteps,
          droppedEquipment: droppedEquipmentIds[0] ?? null, droppedEquipmentIds,
        },
      }
    },

    _resolvePlayerDeath(updated: BattleState, roundRes: RoundResult) {
      this.player.hp = 0
      this.battle = {
        ...updated, phase: 'finish_delay', lastRoundResult: roundRes,
        result: { playerWon: false, playerDamageDealt: roundRes.enemyDamage, playerDamageTaken: roundRes.playerDamage, goldEarned: 0, totalRounds: updated.round, savedSteps: updated.savedSteps },
      }
    },

    _recordKill(enemyId: string) {
      const id = getBestiaryId(enemyId)
      this.meta.enemyKills[id] = (this.meta.enemyKills[id] || 0) + 1
      if (!this.meta.unlockedEnemies.includes(id)) this.meta.unlockedEnemies.push(id)
      const milestones = [
        { count: 3, gold: 15, hp: 0, atk: 0 }, { count: 6, gold: 0, hp: 5, atk: 0 },
        { count: 10, gold: 25, hp: 0, atk: 0 }, { count: 13, gold: 0, hp: 0, atk: 0.05 },
        { count: 16, gold: 50, hp: 10, atk: 0 },
      ]
      for (const milestone of milestones) {
        if (this.meta.unlockedEnemies.length < milestone.count || this.meta.bestiaryClaimed.includes(milestone.count)) continue
        this.meta.bestiaryClaimed.push(milestone.count)
        this.meta.totalGold += milestone.gold
        this.meta.bestiaryBonusHp += milestone.hp
        this.meta.bestiaryBonusAtk += milestone.atk
      }
    },

    _finishRun(outcome: 'victory' | 'defeat') {
      if (this.runOutcome) return
      this.runOutcome = outcome
      this.runShards = Math.floor(Math.max(0, this.player.gold) * 0.1) + (outcome === 'victory' ? this.stage * 10 : 5)
      this.meta.totalGold += this.runShards
      this.meta.totalRuns++
      this.battle = null
      this.rewardChoices = []
      this.rewardQueue = []
      this.pendingLevels = 0
      this.screen = 'gameover'
      this.saveMetaState()
    },

    _addEquipment(compoundId: string): string | null {
      if (!compoundId || !equipmentById(compoundId)) return null
      const base = compoundId.split(':').slice(0, 3).join(':')
      let id = base, copy = 2
      while (this.player.inventory.includes(id)) id = `${base}:copy${copy++}`
      this.player.inventory.push(id)
      return id
    },

    _gainXp(amount: number): number {
      if (!Number.isFinite(amount) || amount <= 0) return 0
      const r = gainXp(this.player.xp + Math.floor(amount), this.player.level, this.player.xpToNext)
      const levels = r.level - this.player.level
      this.player.xp = r.xp
      this.player.level = r.level
      this.player.xpToNext = r.next
      for (let i = 0; i < levels; i++) this.rewardQueue.push({ reason: 'levelup' })
      this.pendingLevels = Math.max(0, this.rewardQueue.length - 1)
      return levels
    },

    _showNextReward(): boolean {
      while (this.rewardQueue.length) {
        const request: RewardRequest = this.rewardQueue[0]
        const player = this.effectivePlayer
        this.rewardChoices = rollRewardChoices(this._rng('reward', this.rewardRollCount++), this.upgrades, {
          excludeHeal: player.hp >= player.maxHp, hpRatio: player.hp / player.maxHp, minRarity: request.minRarity,
        })
        if (this.rewardChoices.length) {
          this.rewardReason = request.reason
          this.pendingLevels = Math.max(0, this.rewardQueue.length - 1)
          this.screen = 'reward'
          return true
        }
        this.rewardQueue.shift()
      }
      this.rewardChoices = []
      this.pendingLevels = 0
      return false
    },

    _consumeReward() {
      this.rewardQueue.shift()
      if (!this._showNextReward()) this._returnFromRewards()
    },

    _returnFromRewards() {
      const boss = this.route.find(n => n.id === this.currentNodeId)?.type === 'boss'
      this.screen = boss ? 'boss_choice' : 'route'
    },

    _grantUpgrade(def: UpgradeDef): boolean {
      if (def.effect.type === 'heal') {
        if (this.player.hp >= this.effectivePlayer.maxHp) return false
        this._heal(def.effect.value)
        return true
      }
      const existing = this.upgrades.find(u => u.def.id === def.id)
      if ((existing?.count ?? 0) >= def.maxStacks) return false
      if (existing) existing.count++
      else this.upgrades.push({ def, count: 1 })
      this._applyUpgradeEffect(def)
      return true
    },

    _heal(amount: number) {
      if (this.player.hp > 0) this.player.hp = Math.min(this.effectivePlayer.maxHp, this.player.hp + Math.max(0, amount))
    },

    _clampHp() { this.player.hp = Math.max(0, Math.min(this.effectivePlayer.maxHp, this.player.hp)) },

    _applyUpgradeEffect(def: UpgradeDef, count = 1) {
      const value = def.effect.value * count
      switch (def.effect.type) {
        case 'attack_multiplier': this.player.attackMultiplier += value; break
        case 'defense_multiplier': this.player.defenseMultiplier += value; break
        case 'bonus_turns': this.player.bonusTurns += value; break
        case 'heal': this._heal(value); break
        case 'max_hp': this.player.maxHp += value; this._heal(value); break
        case 'spawn_reduction': this.player.spawnReduction = addBonus(this.player.spawnReduction, value); break
        case 'enemy_atk_down': this.player.enemyAtkDown += value; break
        case 'gold_boost': this.player.goldBoost += value; break
      }
    },

    _reverseUpgradeEffect(def: UpgradeDef, count = 1) {
      const value = def.effect.value * count
      switch (def.effect.type) {
        case 'attack_multiplier': this.player.attackMultiplier -= value; break
        case 'defense_multiplier': this.player.defenseMultiplier -= value; break
        case 'bonus_turns': this.player.bonusTurns -= value; break
        case 'max_hp': this.player.maxHp = Math.max(10, this.player.maxHp - value); break
        case 'spawn_reduction': this.player.spawnReduction = Math.max(0, addBonus(this.player.spawnReduction, -value)); break
        case 'enemy_atk_down': this.player.enemyAtkDown = Math.max(0, this.player.enemyAtkDown - value); break
        case 'gold_boost': this.player.goldBoost = Math.max(0, this.player.goldBoost - value); break
      }
      this._clampHp()
    },
  },
})
