import { defineStore } from 'pinia'
import type { BattleState, CardClass, CardModifiers, GameState, PlayerStats, RewardRequest, RoundResult, UpgradeDef } from '../types'
import { createRng, createScopedRng } from '../core/random'
import { initBattle, processTurn, resolveRound, startNewRound, getBattlePreview, getCombinedCardModifiers } from '../core/battle'
import { generateRoute } from '../core/route'
import { ENEMIES, getBestiaryId } from '../core/enemy'
import { ALL_EQUIPMENT, computeEquipBonuses, getEffectivePlayer, rollEquipEffects, equipmentById, makeEquipId, sortInventory, equipCost } from '../core/equipment'
import type { EquipSlot, SortMode } from '../core/equipment'
import { pickEvent, resolveEventEffect, buildEventResult, getEventChoiceDisabledReason } from '../core/events'
import type { EventChoiceContext, EventEffect } from '../core/events'
import { getMetaUpgrades, UPGRADE_POOL, upgradeCost, cardById, canRemoveCard, validateCard } from '../core/upgrade'
import { collectCardModifiers, deriveCardPlayer, modifiersFromEffects } from '../core/cardEffects'
import { consumableById, consumableUseDisabledReason } from '../core/consumables'
import { createInitialState } from './initialState'
import { applyMetaUpgrades, rollRewardChoices, buildShop, instantSupplyCost } from './helpers'
import { debugActions } from './debugActions'
import { gainXp } from '../core/progress'
import { loadMeta, saveMeta } from '../utils/storage'

function addBonus(current: number, amount: number): number {
  return Math.round((current + amount) * 1e10) / 1e10
}

function safeCount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

export const useGameStore = defineStore('game', {
  state: (): GameState => createInitialState(),

  getters: {
    cardModifiers(state): CardModifiers { return collectCardModifiers(state.upgrades) },
    activeCardModifiers(state): CardModifiers { return state.battle ? getCombinedCardModifiers(state.battle) : collectCardModifiers(state.upgrades) },
    cardPlayer(state): PlayerStats { return deriveCardPlayer(state.player, state.upgrades) },
    effectivePlayer(state): PlayerStats {
      return getEffectivePlayer(deriveCardPlayer(state.player, state.upgrades), state.battle?.equipEffects)
    },
    battlePreview(state): ReturnType<typeof getBattlePreview> | null {
      return state.battle ? getBattlePreview(state.battle, deriveCardPlayer(state.player, state.upgrades)) : null
    },
    eventContext(state): EventChoiceContext {
      return {
        ...state.player,
        purpleLayers: state.upgrades.reduce((sum, card) => sum + (canRemoveCard(card.def, 'cleanse') ? card.count : 0), 0),
      }
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
      let prepared: BattleState | null = null
      if (node.enemy && ['battle', 'elite', 'boss'].includes(node.type)) {
        if (!this._canGrantCards([])) return
        const effects = rollEquipEffects(computeEquipBonuses(this.player.equipment).setEffects, createScopedRng(this.runSeed, this.stage, node.id, 'equipment', 1))
        const player = getEffectivePlayer(this.cardPlayer, effects)
        const turns = Math.max(1, player.baseMaxTurns + player.bonusTurns + (effects.extraTurns || 0) - this.cardModifiers.heavyLegs)
        if (!Number.isSafeInteger(turns) || turns < 1) return
        prepared = {
          ...initBattle(node.enemy, turns, createScopedRng(this.runSeed, this.stage, node.id, 'board', 1), this.cardModifiers.startingPoints, this.cardModifiers),
          equipEffects: effects, fortifyUsed: false, totalTurns: 0, baseTurns: player.baseMaxTurns,
        }
      }
      // 商店与营地可在“选定下一层前”反复进出；战斗类进入即完成。
      const reenterable = ['shop', 'rest'].includes(node.type)
      const isReentry = this.currentNodeId === nodeId
      this.route = this.route.map(n => ({
        ...n,
        completed: n.completed || (!reenterable && n.id === nodeId),
        accessible: (reenterable && n.id === nodeId) || node.nextIds.includes(n.id),
      }))
      this.currentNodeId = nodeId

      if (prepared) {
        this.battle = prepared
        this.screen = 'battle'
      } else if (node.type === 'shop') {
        if (!isReentry) {
          Object.assign(this, buildShop(this._rng('shop', 0), this.stage, this.upgrades))
          this.shopRefreshCount = 0
        }
        this.screen = 'shop'
      } else if (node.type === 'rest') {
        if (!isReentry) {
          this.restUsed = false
          this.restResult = null
        }
        this.screen = 'rest'
      } else if (node.type === 'event') {
        this.gameEvent = pickEvent(this.stage, this._rng('event'))
        this.eventResult = null
        this.eventBlackConfirmed = false
        this.screen = 'event'
      }
    },

    eventChoiceDisabledReason(choiceIndex: number): string | null {
      const choice = this.gameEvent?.choices[choiceIndex]
      if (!choice) return '该选项不可用'
      const disabled = getEventChoiceDisabledReason(choice.effect as EventEffect, this.eventContext)
      if (disabled) return disabled
      if (this.eventResult?.choiceIndex === choiceIndex) return getEventChoiceDisabledReason(this.eventResult.effect as EventEffect, this.eventContext)
      return null
    },

    RESOLVE_EVENT(choiceIndex: number) {
      if (this.screen !== 'event' || !this.gameEvent || this.eventResult) return
      if (this.eventChoiceDisabledReason(choiceIndex)) return
      const choice = this.gameEvent.choices[choiceIndex]
      const effect = resolveEventEffect(choice.effect as EventEffect, this.stage, this._rng('event-choice', choiceIndex), this.eventContext)
      this.eventBlackConfirmed = false
      this.eventResult = { label: choice.label, desc: buildEventResult(effect), choiceIndex, effect, requiresBlackConfirmation: effect.type === 'card_trade' && effect.requiresBlackConfirmation }
    },

    CONFIRM_BLACK_EVENT() {
      if (this.screen === 'event' && this.eventResult?.requiresBlackConfirmation) this.eventBlackConfirmed = true
    },

    APPLY_EVENT() {
      if (this.screen !== 'event' || !this.gameEvent || !this.eventResult) return
      const { choiceIndex, effect: eff } = this.eventResult
      if (this.eventChoiceDisabledReason(choiceIndex) || getEventChoiceDisabledReason(eff as EventEffect, this.eventContext)) return
      const hasBlack = (eff.cardGrants ?? []).some((grant: { id: string }) => cardById(grant.id)?.cardClass === 'black')
      if ((hasBlack || this.eventResult.requiresBlackConfirmation) && !this.eventBlackConfirmed) return
      switch (eff.type) {
        case 'card_trade': {
          const grants: { id: string; count: number }[] = eff.cardGrants ?? []
          const supplies: { id: string; count: number }[] = eff.consumableGrants ?? []
          const aggregatedCards = new Map<string, number>()
          const aggregatedSupplies = new Map<string, number>()
          for (const grant of grants) aggregatedCards.set(grant.id, (aggregatedCards.get(grant.id) ?? 0) + grant.count)
          for (const grant of supplies) aggregatedSupplies.set(grant.id, (aggregatedSupplies.get(grant.id) ?? 0) + grant.count)
          const cardBatch = [...aggregatedCards].map(([id, count]) => ({ id, count }))
          if (!grants.every(grant => safeCount(grant.count)) || !this._canGrantCards(cardBatch) ||
            !supplies.every(grant => safeCount(grant.count)) || ![...aggregatedSupplies].every(([id, count]) =>
              consumableById(id) && safeCount(count) && Number.isSafeInteger((this.consumableCounts[id] ?? 0) + count))) return
          const cost = eff.cost ?? 0, hpCost = eff.hpCost ?? 0, gold = eff.gold ?? 0
          if (![cost, hpCost, gold].every(value => Number.isFinite(value) && value >= 0) || this.player.gold < cost || this.player.hp <= hpCost) return
          const removesPurple = eff.removesPurple ?? 0
          const purpleLayers = this.upgrades.reduce((sum, card) => sum + (canRemoveCard(card.def, 'cleanse') ? card.count : 0), 0)
          if (removesPurple > 0 && (!Number.isSafeInteger(removesPurple) || purpleLayers < removesPurple)) return
          this.player.gold += gold - cost
          this.player.hp -= hpCost
          for (const grant of cardBatch) this._grantUpgrade(cardById(grant.id)!, grant.count)
          for (const [id, count] of aggregatedSupplies) this._addConsumable(id, count)
          for (let index = 0; index < removesPurple; index++) {
            const target = this.upgrades.find(card => canRemoveCard(card.def, 'cleanse'))?.def.id
            if (!target || !this._removeCardLayer(target, 'cleanse')) return
          }
          break
        }
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
      this.eventBlackConfirmed = false
      if (!this._showNextReward()) this.screen = 'route'
    },

    SLIDE(direction: string) {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'playing') return
      const before = this.battle
      const updated = processTurn(before, direction, this._rng('spawn', before.round, before.turnsUsed))
      if (updated === before) return
      updated.totalTurns = (before.totalTurns || 0) + updated.turnsUsed - before.turnsUsed
      const moveDamage = updated.lastMoveDamage ?? 0
      if (moveDamage > 0) {
        this.player.hp = Math.max(0, this.player.hp - moveDamage)
        if (this.player.hp <= 0) {
          this._resolvePlayerDeath(updated, {
            playerDamage: 0, enemyDamage: 0, enemyHpAfter: updated.enemyCurrentHp,
            overflowDamage: 0, playerFirst: false, playerSpeed: this.effectivePlayer.baseSpeed,
            enemySpeed: updated.enemy.speed, playerHpAfter: 0, playerActed: false, enemyActed: false, curseDamage: moveDamage,
          })
          return
        }
      }
      if (updated.phase === 'round_delay') this._settleRound(updated)
      else this.battle = updated
    },

    END_TURN_EARLY() {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'playing') return
      const b = this.battle
      const remaining = b.maxTurns - b.turnsUsed
      if (remaining <= 0) return
      const savedSteps = Math.max(0, (b.baseTurns ?? this.player.baseMaxTurns) - b.turnsUsed)
      this._settleRound({ ...b, phase: 'round_delay', savedSteps })
    },

    SHOW_ROUND() { if (this.battle?.phase === 'round_delay') this.battle.phase = 'round_end' },
    SHOW_BATTLE_RESULT() { if (this.battle?.phase === 'finish_delay') this.battle.phase = 'finished' },

    NEXT_ROUND() {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'round_end') return
      const round = this.battle.round + 1
      const effects = rollEquipEffects(computeEquipBonuses(this.player.equipment).setEffects, this._rng('equipment', round))
      const player = getEffectivePlayer(this.cardPlayer, effects)
      const battle = startNewRound(this.battle, this._rng('board', round), this.cardModifiers.startingPoints)
      this.battle = {
        ...battle, equipEffects: effects, cardModifiers: this.cardModifiers,
        maxTurns: Math.max(1, player.baseMaxTurns + player.bonusTurns + (effects.extraTurns || 0) + (battle.battleModifiers?.bonusTurns ?? 0) - this.cardModifiers.heavyLegs),
        baseTurns: player.baseMaxTurns,
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

    PICK_UPGRADE(upgradeId: string, generation = this.rewardRollCount) {
      if (this.screen !== 'reward' || generation !== this.rewardRollCount) return
      const chosen = this.rewardChoices.find(u => u.id === upgradeId)
      if (!chosen || !this._grantUpgrade(chosen)) return
      this._consumeReward()
    },

    SKIP_REWARD(generation = this.rewardRollCount) {
      if (this.screen === 'reward' && generation === this.rewardRollCount) this._consumeReward()
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
    GO_TO_ROUTE() {
      // 商店与营地都可先回到地图再决定；选了下一层后才真正离开。
      if (this.screen === 'shop' || this.screen === 'rest') this.screen = 'route'
    },

    REST_HEAL() {
      if (this.screen !== 'rest' || this.restUsed || this.runOutcome) return
      const before = this.player.hp
      this._heal(Math.floor(this.effectivePlayer.maxHp * 0.3))
      this.restUsed = true
      this.restResult = `营地恢复 ${this.player.hp - before} 点生命。`
    },

    consumableDisabledReason(id: string): string | null {
      const def = consumableById(id)
      if (!def) return '道具不存在'
      if (!safeCount(this.consumableCounts[id] ?? 0)) return '没有该道具'
      if (this.runOutcome) return '本次冒险已结束'
      if (this.eventResult) return '先确认当前事件'
      const purple = this.upgrades.some(card => card.def.cardClass === 'purple' && card.count > 0)
      return consumableUseDisabledReason(def, this.screen, this.battle?.phase, purple)
    },

    USE_CONSUMABLE(id: string, targetCardId?: string) {
      if (this.consumableDisabledReason(id)) return
      const def = consumableById(id)!
      if (def.cleanse) {
        const target = targetCardId ?? this.upgrades.find(card => canRemoveCard(card.def, 'cleanse'))?.def.id
        if (!target || !this._removeCardLayer(target, 'cleanse')) return
      } else {
        if (!this.battle || this.battle.phase !== 'playing') return
        const additions = modifiersFromEffects(def.effects)
        const key = def.duration === 'battle' ? 'battleModifiers' : 'roundModifiers'
        const next = { ...(this.battle[key] ?? {}) }
        for (const [field, value] of Object.entries(additions)) {
          const modifier = field as keyof CardModifiers
          const total = addBonus(next[modifier] ?? 0, value)
          if (!Number.isFinite(total)) return
          next[modifier] = total
        }
        const extraTurns = additions.bonusTurns ?? 0
        if (!Number.isSafeInteger(this.battle.maxTurns + extraTurns)) return
        this.battle = { ...this.battle, [key]: next, maxTurns: this.battle.maxTurns + extraTurns }
      }
      this.consumableCounts[id]--
      if (!this.consumableCounts[id]) delete this.consumableCounts[id]
    },

    BUY_SHOP_CONSUMABLE(slot: number) {
      if (this.screen !== 'shop') return
      const id = this.shopConsumables[slot]
      const def = id ? consumableById(id) : undefined
      if (!id || !def || this.player.gold < def.price || !this._addConsumable(id)) return
      this.player.gold -= def.price
      this.shopConsumables[slot] = null
    },

    shopHealPrice(id: string | null): number { return instantSupplyCost(id ? cardById(id) : undefined) },

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
      const def = cardById(uid ?? '')
      const cost = def ? upgradeCost(def) : null
      if (!def || !['white', 'blue', 'gold'].includes(def.cardClass) || cost === null || this.player.gold < cost) return
      if (!this._grantUpgrade(def)) return
      this.player.gold -= cost
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
      const def = cardById(this.shopHeals[slot] ?? '')
      if (!def || def.kind !== 'instant') return
      const cost = instantSupplyCost(def)
      if (this.player.gold < cost || !this._grantUpgrade(def)) return
      this.player.gold -= cost
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
      this.shopConsumables = built.shopConsumables
      this.shopRefreshCount = nextCount
      this.shopRefreshCost += 10
    },

    SHOP_REMOVE_UPGRADE(upgradeId: string) {
      if (this.screen !== 'shop' || this.shopRemoveUsed || this.player.gold < this.shopRemoveCost) return
      if (!this._removeCardLayer(upgradeId, 'shop')) return
      this.player.gold -= this.shopRemoveCost
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
      const result = resolveRound(updated, this.cardPlayer, this._rng('combat', updated.round, updated.turnsUsed))
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
      const player = getEffectivePlayer(this.cardPlayer, effects)
      const enemyGoldBoost = 0
      const greed = getCombinedCardModifiers(updated).greedRating
      let baseGold = Math.floor(updated.enemy.tier * 15 * (1 + player.goldBoost + enemyGoldBoost) * (1 + greed)) * rewardMult
      let xpEarned = Math.floor((updated.enemy.tier * 8 + Math.floor(updated.totalAttack / 8)) * (1 + player.xpBoost)) * rewardMult
      if (effects.doubleGold) baseGold *= 2
      if (effects.doubleXp) xpEarned *= 2
      const savedSteps = updated.turnsUsed < updated.maxTurns ? Math.max(0, (updated.baseTurns ?? this.player.baseMaxTurns) - updated.turnsUsed) : 0
      const goldEarned = baseGold + savedSteps * 2
      this.player.hp = playerHpAfter
      this.player.gold += goldEarned
      if (nodeType === 'boss' || nodeType === 'elite') {
        this.rewardQueue.push({ reason: nodeType, allowedClasses: nodeType === 'boss' ? ['gold'] : ['blue', 'gold'] })
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
          leveledUp: levels > 0, savedSteps,
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
          excludeHeal: player.hp >= player.maxHp, hpRatio: player.hp / player.maxHp, allowedClasses: request.allowedClasses,
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

    _canGrantCards(grants: { id: string; count: number }[]): boolean {
      const next = this.upgrades.map(card => ({ ...card }))
      for (const grant of grants) {
        const def = cardById(grant.id)
        if (!def || def.kind !== 'persistent' || !validateCard(def) || !safeCount(grant.count)) return false
        const existing = next.find(card => card.def.id === grant.id)
        const count = (existing?.count ?? 0) + grant.count
        if (!Number.isSafeInteger(count)) return false
        if (existing) existing.count = count
        else next.push({ def, count })
      }
      const modifiers = collectCardModifiers(next)
      const player = deriveCardPlayer(this.player, next)
      return Object.values(modifiers).every(value => Number.isFinite(value) && value >= 0) &&
        Number.isSafeInteger(modifiers.startingPoints) && modifiers.startingPoints % 2 === 0 &&
        Number.isSafeInteger(player.baseMaxTurns + player.bonusTurns) && Number.isSafeInteger(player.maxHp)
    },

    _grantUpgrade(def: UpgradeDef, count = 1): boolean {
      if (!validateCard(def) || !safeCount(count)) return false
      if (def.kind === 'instant') {
        if (this.player.hp >= this.effectivePlayer.maxHp) return false
        const amount = def.effects.filter(effect => effect.type === 'heal').reduce((sum, effect) => sum + effect.value * count, 0)
        this._heal(amount)
        return true
      }
      if (!this._canGrantCards([{ id: def.id, count }])) return false
      const existing = this.upgrades.find(card => card.def.id === def.id)
      if (existing) existing.count += count
      else this.upgrades.push({ def, count })
      const gainedHp = def.effects.filter(effect => effect.type === 'maxHpBonus').reduce((sum, effect) => sum + effect.value * count, 0)
      if (gainedHp) this._heal(gainedHp)
      if (this.battle) {
        this.battle.cardModifiers = this.cardModifiers
        const effective = getEffectivePlayer(this.cardPlayer, this.battle.equipEffects)
        this.battle.maxTurns = Math.max(1, effective.baseMaxTurns + effective.bonusTurns + (this.battle.equipEffects?.extraTurns ?? 0) +
          (this.battle.roundModifiers?.bonusTurns ?? 0) + (this.battle.battleModifiers?.bonusTurns ?? 0) - this.cardModifiers.heavyLegs)
      }
      return true
    },

    _addConsumable(id: string, count = 1): boolean {
      if (!consumableById(id) || !safeCount(count)) return false
      const total = (this.consumableCounts[id] ?? 0) + count
      if (!Number.isSafeInteger(total)) return false
      this.consumableCounts[id] = total
      return true
    },

    _removeCardLayer(id: string, method: 'shop' | 'cleanse'): boolean {
      const index = this.upgrades.findIndex(card => card.def.id === id)
      if (index < 0 || !canRemoveCard(this.upgrades[index].def, method)) return false
      if (this.upgrades[index].count > 1) this.upgrades[index].count--
      else this.upgrades.splice(index, 1)
      this._clampHp()
      return true
    },

    _heal(amount: number) {
      if (!Number.isFinite(amount) || amount <= 0 || this.player.hp <= 0) return
      const effective = Math.floor(amount / (1 + this.activeCardModifiers.healingPenalty))
      this.player.hp = Math.min(this.effectivePlayer.maxHp, this.player.hp + effective)
    },

    _clampHp() { this.player.hp = Math.max(0, Math.min(this.effectivePlayer.maxHp, this.player.hp)) },
  },
})
