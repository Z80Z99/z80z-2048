import { defineStore } from 'pinia'
import type { GameState, PlayerStats, ActiveUpgrade } from '../types'
import { createRng, setGlobalSeed } from '../core/random'
import { initBattle, processTurn, resolveRound, startNewRound } from '../core/battle'
import { generateRoute } from '../core/route'
import { ENEMIES } from '../core/enemy'
import { ALL_EQUIPMENT, computeEquipBonuses, getEquipStats, makeEquipId, sortInventory, isNoSetItem, equipCost } from '../core/equipment'
import type { SortMode } from '../core/equipment'
import { pickEvent, resolveEventEffect, buildEventResult } from '../core/events'
import type { EventEffect } from '../core/events'
import { pickUpgrades, getMetaUpgrades, UPGRADE_POOL, upgradeCost } from '../core/upgrade'
import { createInitialState } from './initialState'
import { xpToNext, getStartingTileBonuses, applyMetaUpgrades, rollRewardChoices, buildShop } from './helpers'
import { gainXp } from '../core/progress'
import { loadMeta, saveMeta } from '../utils/storage'

function rollEquipLevel(stage: number): number {
  return (stage - 1) * 2 + 1 + Math.floor(Math.random() * 2)
}

export const useGameStore = defineStore('game', {
  state: (): GameState => createInitialState(),

  actions: {
    loadMeta() { this.meta = loadMeta() },
    saveMetaState() { saveMeta(this.meta) },

    START_RUN(seed?: number) {
      const s = seed ?? Date.now()
      const rng = createRng(s)
      setGlobalSeed(s)
      const route = generateRoute(rng, 1)

      const hasMetaStart = this.meta.purchasedIds.includes('meta_start')
      const startChoices = hasMetaStart ? rollRewardChoices(createRng(s + 1), [], { excludeHeal: true, hpRatio: 1 }) : []

      const fresh = createInitialState()
      this.meta = { ...this.meta }
      this.screen = startChoices.length > 0 ? 'reward' : 'route'
      this.rewardReason = 'start'
      this.rewardChoices = startChoices
      this.player = { ...fresh.player, ...applyMetaUpgrades(this.meta) }
      this.upgrades = []
      this.route = route
      this.currentNodeId = route.find(n => n.accessible)?.id ?? route[0]?.id
      this.runSeed = s
      this.battle = null
      this.pendingLevels = 0
      this.stage = 1

      if (startChoices.length > 0) this.screen = 'reward'
      else this.screen = 'route'
    },

    SELECT_NODE(nodeId: string) {
      if (this.screen !== 'route') return
      const node = this.route.find(n => n.id === nodeId)
      if (!node || !node.accessible || node.completed) return

      const nextLayer = node.layer + 1
      this.route = this.route.map(n => {
        if (n.id === nodeId) return { ...n, completed: true }
        if (n.layer === nextLayer) return { ...n, accessible: true }
        if (n.layer === node.layer && n.id !== nodeId) return { ...n, accessible: false }
        return n
      })
      this.currentNodeId = nodeId

      const selectedNode = this.route.find(n => n.id === nodeId)!

      if (selectedNode.type === 'battle' || selectedNode.type === 'elite' || selectedNode.type === 'boss') {
        if (!selectedNode.enemy) return
        const rng = createRng(this.runSeed + this.route.indexOf(selectedNode))
        const eqBonuses = computeEquipBonuses(this.player.equipment)
        const battle = {
          ...initBattle(selectedNode.enemy, this.player.baseMaxTurns + this.player.bonusTurns + (eqBonuses.setEffects.extraTurns || 0), rng, getStartingTileBonuses(this.upgrades)),
          equipEffects: eqBonuses.setEffects,
        }
        this.battle = battle
        this.screen = 'battle'
        return
      }

      if (selectedNode.type === 'shop') {
        const shopRng = createRng(this.runSeed + this.route.findIndex(n => n.id === nodeId) + 500)
        const built = buildShop(shopRng, this.stage, this.upgrades)
        this.shopUpgrades = built.shopUpgrades
        this.shopEquipment = built.shopEquipment
        this.shopHeals = built.shopHeals
        this.shopRefreshCost = built.shopRefreshCost
        this.shopRemoveCost = built.shopRemoveCost
        this.shopRemoveUsed = built.shopRemoveUsed
        this.screen = 'shop'
        return
      }

      if (selectedNode.type === 'rest') {
        const healAmount = Math.floor(this.player.maxHp * 0.3)
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount)
        this.screen = 'rest'
        return
      }

      if (selectedNode.type === 'event') {
        const erng = createRng(this.runSeed + this.route.findIndex(n => n.id === nodeId) + 700)
        this.gameEvent = pickEvent(this.stage, erng)
        this.screen = 'event'
        return
      }
    },

    RESOLVE_EVENT(choiceIndex: number) {
      if (!this.gameEvent) return
      const choice = this.gameEvent.choices[choiceIndex]
      if (!choice) return
      const erng = createRng(this.runSeed + this.currentNodeId!.charCodeAt(0) + choiceIndex)
      const eff = resolveEventEffect(choice.effect as EventEffect, this.stage, erng)

      const desc = buildEventResult(eff)
      this.eventResult = { label: choice.label, desc }
    },

    APPLY_EVENT() {
      if (!this.gameEvent || !this.eventResult) return
      const choice = this.gameEvent.choices.find(c => c.label === this.eventResult!.label)
      if (!choice) { this.gameEvent = null; this.eventResult = null; this.screen = 'route'; return }
      const erng = createRng(this.runSeed + this.currentNodeId!.charCodeAt(0) + this.gameEvent.choices.indexOf(choice))
      const eff = resolveEventEffect(choice.effect as EventEffect, this.stage, erng)

      if (eff.type === 'none') { /* no-op */ }

      if (eff.type === 'gold_heal') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.floor(this.player.maxHp * ((eff.heal / 100))))
        this.player.gold += eff.gold
      }

      if (eff.type === 'gold_xp') {
        this.player.gold += eff.gold
        const r = gainXp(this.player.xp + eff.xp, this.player.level, this.player.xpToNext)
        this.player.xp = r.xp; this.player.level = r.level; this.player.xpToNext = r.next
      }

      if (eff.type === 'gold') {
        this.player.gold += eff.value || 0
      }

      if (eff.type === 'heal') {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.floor(this.player.maxHp * ((eff.value || 10) / 100)))
      }

      if (eff.type === 'hp_reduce') {
        this.player.hp = Math.max(1, this.player.hp - (eff.value || 0))
      }

      if (eff.type === 'maxhp_down') {
        this.player.maxHp = Math.max(10, this.player.maxHp - Math.floor(this.player.maxHp * ((eff.value || 0) / 100)))
        if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp
      }

      if (eff.type === 'maxhp_up') {
        this.player.maxHp += eff.value || 0
      }

      if (eff.type === 'xp') {
        const r = gainXp(this.player.xp + (eff.value || 0), this.player.level, this.player.xpToNext)
        this.player.xp = r.xp; this.player.level = r.level; this.player.xpToNext = r.next
      }

      if (eff.type === 'drop_equip') {
        if (eff.eqId) this.player.inventory = [...this.player.inventory, eff.eqId]
        if (eff.cost) this.player.gold -= eff.cost
      }

      if (eff.type === 'hp_reduce_pct') {
        this.player.hp = Math.max(1, Math.floor(this.player.hp * (1 - ((eff.value || 0) / 100))))
        if (eff.atk_mult) this.player.attackMultiplier += eff.atk_mult
        if (eff.def_mult) this.player.defenseMultiplier += eff.def_mult
      }

      if (eff.type === 'maxhp_down_pct') {
        this.player.maxHp = Math.max(10, this.player.maxHp - Math.floor(this.player.maxHp * ((eff.value || 0) / 100)))
        if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp
        if (eff.atk_mult) this.player.attackMultiplier += eff.atk_mult
        if (eff.def_mult) this.player.defenseMultiplier += eff.def_mult
      }

      this.gameEvent = null; this.eventResult = null; this.screen = 'route'
    },

    SLIDE(direction: string) {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'playing') return
      const rng = createRng(this.runSeed + this.battle.turnsUsed)
      const updatedBattle = processTurn(this.battle, direction, rng)
      if (updatedBattle.phase === 'round_delay') {
        const roundRng = createRng(this.runSeed * 31 + updatedBattle.round * 7 + updatedBattle.turnsUsed)
        const roundRes = resolveRound(updatedBattle, this.player, roundRng)
        const enemyHpAfter = roundRes.enemyHpAfter
        const playerHpAfter = this.player.hp - roundRes.playerDamage
        this.battle = { ...updatedBattle, enemyCurrentHp: enemyHpAfter, lastRoundResult: roundRes }
        if (enemyHpAfter <= 0) { this._resolveEnemyKill(updatedBattle, roundRes, playerHpAfter); return }
        if (playerHpAfter <= 0) { this._resolvePlayerDeath(updatedBattle, roundRes); return }
        this.player.hp = playerHpAfter
        return
      }
      this.battle = updatedBattle
    },

    END_TURN_EARLY() {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'playing') return
      const b = this.battle
      const remaining = b.maxTurns - b.turnsUsed
      if (remaining <= 0) return
      const updated = { ...b, phase: 'round_delay' as const, savedSteps: b.savedSteps + remaining }
      const roundRng = createRng(this.runSeed * 31 + updated.round * 7 + updated.turnsUsed)
      const roundRes = resolveRound(updated, this.player, roundRng)
      const enemyHpAfter = roundRes.enemyHpAfter
      const playerHpAfter = this.player.hp - roundRes.playerDamage
      this.battle = { ...updated, enemyCurrentHp: enemyHpAfter, lastRoundResult: roundRes }
      if (enemyHpAfter <= 0) { this._resolveKill(updated, roundRes, playerHpAfter, updated.savedSteps * 2); return }
      if (playerHpAfter <= 0) { this._resolvePlayerDeath(updated, roundRes); return }
      this.player.hp = playerHpAfter
    },

    SHOW_ROUND() { if (this.battle && this.battle.phase === 'round_delay') this.battle.phase = 'round_end' },
    SHOW_BATTLE_RESULT() { if (this.battle && this.battle.phase === 'finish_delay') this.battle.phase = 'finished' },

    NEXT_ROUND() {
      if (this.screen !== 'battle' || !this.battle || this.battle.phase !== 'round_end') return
      const eff = this.battle?.equipEffects || {}
      if (eff.regen) this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.floor(this.player.maxHp * eff.regen))
      const rng = createRng(this.runSeed + this.battle.round + 99)
      this.battle = startNewRound(this.battle, rng, getStartingTileBonuses(this.upgrades))
    },

    END_BATTLE(overflowChoice?: 'gold' | 'xp') {
      if (!this.battle || !this.battle.result) return
      const result = this.battle.result
      const wasBoss = this.route.find(n => n.id === this.currentNodeId)?.type === 'boss'
      if (result.droppedEquipment && !this.player.inventory.includes(result.droppedEquipment)) {
        this.player.inventory = [...this.player.inventory, result.droppedEquipment]
      }
      if (!result.playerWon) {
        const metaGold = Math.floor(this.player.gold * 0.1) + 5
        this.meta.totalGold += metaGold; this.meta.totalRuns++
        this.battle = null; this.saveMetaState()
        this.screen = 'gameover'; return
      }
      const overflow = result.overflowDamage ?? 0
      if (overflowChoice === 'gold') { this.player.gold += overflow }
      else if (overflowChoice === 'xp') {
        const extraXp = Math.floor(overflow / 2)
        const newXp = this.player.xp + extraXp
        if (newXp >= this.player.xpToNext) {
          this.player.xp = newXp - this.player.xpToNext; this.player.level++; this.player.xpToNext = xpToNext(this.player.level)
          const cr = createRng(this.runSeed + this.player.level + 999)
          this.rewardChoices = rollRewardChoices(cr, this.upgrades, { excludeHeal: this.player.hp >= this.player.maxHp, hpRatio: this.player.hp / this.player.maxHp })
          this.rewardReason = 'levelup'; this.battle = null
          this.screen = 'reward'; return
        }
        this.player.xp = newXp
      }
      this.battle = null
      if (wasBoss) {
        if (this.rewardChoices.length > 0) { this.screen = 'reward'; return }
        this.screen = 'boss_choice'; return
      }
      if (result.leveledUp && this.rewardChoices.length > 0) { this.screen = 'reward'; return }
      this.screen = 'route'
    },

    BOSS_DEFEATED(action: 'continue' | 'end') {
      if (action === 'continue') {
        const rng = createRng(this.runSeed + this.stage + 1000)
        this.stage++; this.route = generateRoute(rng, this.stage)
        this.currentNodeId = this.route[0].id
        this.screen = 'route'
      } else {
        const metaGold = Math.floor(this.player.gold * 0.1) + this.stage * 10
        this.meta.totalGold += metaGold; this.meta.totalRuns++
        this.meta.highestDepth = Math.max(this.meta.highestDepth, this.stage)
        this.saveMetaState()
        this.screen = 'gameover'
      }
    },

    LEVEL_UP() {
      const rng = createRng(this.runSeed + this.player.level)
      const choices = rollRewardChoices(rng, this.upgrades, { excludeHeal: this.player.hp >= this.player.maxHp, hpRatio: this.player.hp / this.player.maxHp })
      this.rewardReason = 'levelup'; this.rewardChoices = choices
      this.screen = choices.length > 0 ? 'reward' : 'route'
    },

    PICK_UPGRADE(upgradeId: string) {
      const chosen = this.rewardChoices.find(u => u.id === upgradeId)
      if (!chosen) return
      const existingIndex = this.upgrades.findIndex(u => u.def.id === chosen.id)
      if (existingIndex >= 0) { this.upgrades[existingIndex].count++ }
      else { this.upgrades.push({ def: chosen, count: 1 }) }
      this._applyUpgradeEffect(chosen, 1)
      if (this.pendingLevels > 0) {
        const nextRng = createRng(this.runSeed + this.player.level + this.pendingLevels)
        this.rewardChoices = rollRewardChoices(nextRng, this.upgrades, { excludeHeal: this.player.hp >= this.player.maxHp, hpRatio: this.player.hp / this.player.maxHp })
        this.pendingLevels--; return
      }
      const isBoss = this.route.find(n => n.id === this.currentNodeId)?.type === 'boss'
      this.screen = isBoss ? 'boss_choice' : 'route'
    },

    SKIP_REWARD() {
      const isBoss = this.route.find(n => n.id === this.currentNodeId)?.type === 'boss'
      this.screen = isBoss ? 'boss_choice' : 'route'
    },

    GAME_OVER() {
      const metaGold = Math.floor(this.player.gold * 0.1) + 5
      this.meta.totalGold += metaGold; this.meta.totalRuns++
      this.saveMetaState(); this.screen = 'gameover'
    },

    BACK_TO_TITLE() {
      const { meta, theme } = { meta: { ...this.meta }, theme: this.theme }
      const fresh = createInitialState()
      Object.assign(this, fresh)
      this.meta = meta; this.theme = theme
      this.saveMetaState(); this.screen = 'title'
    },

    GO_TO_META_SHOP() { this.screen = 'meta' },
    GO_TO_ROUTE() { this.screen = 'route' },

    BUY_META_UPGRADE(upgradeId: string) {
      const metaUpgrades = getMetaUpgrades()
      const upgrade = metaUpgrades.find(u => u.id === upgradeId)
      if (!upgrade) return
      if (this.meta.totalGold < upgrade.cost) return
      if (this.meta.purchasedIds.includes(upgradeId)) return
      this.meta.totalGold -= upgrade.cost
      this.meta.purchasedIds = [...this.meta.purchasedIds, upgradeId]
      this.saveMetaState()
    },

    BUY_SHOP_UPGRADE(slot: number) {
      const uid = this.shopUpgrades[slot]; if (!uid) return
      const def = UPGRADE_POOL.find(u => u.id === uid); if (!def) return
      const cost = upgradeCost(def)
      if (this.player.gold < cost) return
      this.player.gold -= cost
      const idx = this.upgrades.findIndex(u => u.def.id === uid)
      if (idx >= 0) { this.upgrades[idx].count++ } else { this.upgrades.push({ def, count: 1 }) }
      this._applyUpgradeEffect(def, 1); this.shopUpgrades[slot] = null
    },

    BUY_SHOP_EQUIP(slot: number) {
      const eid = this.shopEquipment[slot]; if (!eid) return
      const baseId = eid.split(':')[0]
      const eq = ALL_EQUIPMENT.find(e => e.id === baseId); if (!eq) return
      const cost = equipCost(eq)
      if (this.player.gold < cost) return
      this.player.gold -= cost
      if (!this.player.inventory.includes(eid)) this.player.inventory = [...this.player.inventory, eid]
      this.shopEquipment[slot] = null
    },

    BUY_SHOP_HEAL(slot: number) {
      const hid = this.shopHeals[slot]; if (!hid) return
      const def = UPGRADE_POOL.find(u => u.id === hid); if (!def) return
      const cost = Math.floor(def.effect.value * 1.5)
      if (this.player.gold < cost) return
      this.player.gold -= cost
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.effect.value)
      this.shopHeals[slot] = null
    },

    REFRESH_SHOP() {
      if (this.player.gold < this.shopRefreshCost) return
      const rng = createRng(this.runSeed + this.shopRefreshCost + Date.now())
      const items = rollRewardChoices(rng, this.upgrades, { excludeHeal: true, hpRatio: 1 }).map(u => u.id)
      const pads: (string | null)[] = [null, null, null]
      for (let i = 0; i < Math.min(3, items.length); i++) pads[i] = items[i]
      this.player.gold -= this.shopRefreshCost; this.shopUpgrades = pads
      this.shopRefreshCost += 10; this.shopRemoveUsed = false
    },

    SHOP_REMOVE_UPGRADE(upgradeId: string) {
      if (this.player.gold < this.shopRemoveCost) return
      const idx = this.upgrades.findIndex(u => u.def.id === upgradeId)
      if (idx < 0) return
      const rem = this.upgrades[idx]
      this.player.gold -= this.shopRemoveCost
      for (let i = 0; i < rem.count; i++) { this._reverseUpgradeEffect(rem.def) }
      this.upgrades.splice(idx, 1); this.shopRemoveUsed = true
    },

    TOGGLE_THEME() { this.theme = this.theme === 'dark' ? 'light' : 'dark' },

    EQUIP_ITEM(itemId: string) {
      const baseId = itemId.split(':')[0]
      const eq = ALL_EQUIPMENT.find(e => e.id === baseId); if (!eq) return
      const oldId = this.player.equipment[eq.slot]
      if (oldId) this._applyEquipStats(oldId, true)
      this.player.equipment = { ...this.player.equipment, [eq.slot]: itemId }
      this._applyEquipStats(itemId, false)
    },
    UNEQUIP_ITEM(slot: string) {
      const oldId = this.player.equipment[slot]
      if (oldId) this._applyEquipStats(oldId, true)
      this.player.equipment = { ...this.player.equipment, [slot]: undefined }
    },
    SORT_INVENTORY(mode: SortMode) { this.player.inventory = sortInventory(this.player.inventory, mode) },
    _applyEquipStats(compoundId: string, remove: boolean) {
      const eqStats = getEquipStats(compoundId)
      const sign = remove ? -1 : 1
      const noset = isNoSetItem(compoundId)
      if (eqStats.atk) {
        if (noset) this.player.attackMultiplier += sign * eqStats.atk * 0.01
        else this.player.flatAttack += sign * eqStats.atk
      }
      if (eqStats.def) {
        if (noset) this.player.defenseMultiplier += sign * eqStats.def * 0.01
        else this.player.flatDefense += sign * eqStats.def
      }
      if (eqStats.spd) this.player.baseSpeed += sign * eqStats.spd
      if (eqStats.hp) {
        this.player.maxHp += sign * eqStats.hp
        if (!remove && this.player.hp < this.player.maxHp) this.player.hp = this.player.maxHp
        if (remove && this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp
      }
    },

    CLAIM_BESTIARY_REWARD(rewardType: 'enemy' | 'global', enemyId?: string) {
      if (rewardType === 'enemy' && enemyId) {
        const kills = this.meta.enemyKills[enemyId] || 0
        const claimed = this.meta.enemyClaims[enemyId] || 0
        const available = Math.floor(kills / 5)
        if (available <= claimed) return
        this.meta.enemyClaims = { ...this.meta.enemyClaims, [enemyId]: claimed + 1 }
        this.meta.totalGold += 3
      }
      if (rewardType === 'global') {
        let disc = 0
        for (const v of Object.values(this.meta.enemyKills)) { disc += Math.floor(v / 5) }
        if (disc < (this.meta.globalClaimLevel + 1) * 20) return
        this.meta.globalClaimLevel++; this.meta.totalGold += 10; this.meta.bestiaryBonusHp += 3
      }
      this.saveMetaState()
    },

    // Debug actions
    DEBUG_ADD_GOLD(amount: number) { this.player.gold = Math.max(0, this.player.gold + amount) },
    DEBUG_HEAL(amount: number) { this.player.hp = Math.max(1, Math.min(this.player.maxHp, this.player.hp + amount)) },
    DEBUG_ADD_XP(amount: number) {
      const r = gainXp(this.player.xp + amount, this.player.level, this.player.xpToNext)
      const levelUps = r.level - this.player.level
      const totalPending = (this.screen === 'reward' ? this.pendingLevels + 1 : 0) + levelUps
      let choices: any[] = this.rewardChoices
      if (levelUps > 0 || this.screen !== 'reward') {
        const rng = createRng(Date.now())
        choices = rollRewardChoices(rng, this.upgrades, { excludeHeal: this.player.hp >= this.player.maxHp, hpRatio: this.player.hp / this.player.maxHp })
      }
      if (totalPending > 0) { this.screen = 'reward' }
      this.rewardReason = 'levelup'; this.rewardChoices = choices
      this.pendingLevels = totalPending > 1 ? totalPending - 1 : 0
      this.player.xp = r.xp; this.player.level = r.level; this.player.xpToNext = r.next
    },
    DEBUG_FORCE_LEVELUP() {
      const newLv = this.player.level + 1
      const totalPending = (this.screen === 'reward' ? this.pendingLevels + 1 : 0) + 1
      const rng = createRng(Date.now())
      const choices = rollRewardChoices(rng, this.upgrades, { excludeHeal: this.player.hp >= this.player.maxHp, hpRatio: this.player.hp / this.player.maxHp })
      this.screen = 'reward'; this.rewardReason = 'levelup'; this.rewardChoices = choices
      this.pendingLevels = totalPending > 1 ? totalPending - 1 : 0
      this.player.level = newLv; this.player.xp = 0; this.player.xpToNext = xpToNext(newLv)
    },
    DEBUG_ADD_UPGRADE(upgradeId: string) {
      const def = UPGRADE_POOL.find(u => u.id === upgradeId); if (!def) return
      const existing = this.upgrades.findIndex(u => u.def.id === def.id)
      if (existing >= 0) { this.upgrades[existing].count++ } else { this.upgrades.push({ def, count: 1 }) }
      this._applyUpgradeEffect(def, 1)
    },
    DEBUG_UNLOCK_ALL_ENEMIES() { this.meta.unlockedEnemies = ENEMIES.map(e => e.id) },
    DEBUG_ADD_KILLS(amount: number) {
      const nk = { ...this.meta.enemyKills }; for (const e of ENEMIES) nk[e.id] = (nk[e.id] || 0) + amount
      this.meta.enemyKills = nk
    },
    DEBUG_KILL_ENEMY() {
      if (!this.battle) return
      const b = this.battle; const nType = this.route.find(n => n.id === this.currentNodeId)?.type
      const rMult = nType === 'boss' ? 3 : nType === 'elite' ? 2 : 1
      const roundRes = { playerDamage: 0, enemyDamage: 999, enemyHpAfter: 0, overflowDamage: 999, playerFirst: true, playerSpeed: 99, enemySpeed: 1 }
      const enemyGoldBoost = (b.enemy.enemyUpgrades || []).some((id: string) => { const u = UPGRADE_POOL.find(x => x.id === id); return u?.effect.type === 'gold_boost' }) ? 0.5 : 0
      const goldEarned = Math.floor(b.enemy.tier * 15 * (1 + this.player.goldBoost + enemyGoldBoost)) * rMult + b.savedSteps * 2
      const xpEarned = (b.enemy.tier * 8 + Math.floor(b.totalAttack / 8)) * rMult
      const newXp = this.player.xp + xpEarned
      const r = gainXp(newXp, this.player.level, this.player.xpToNext)
      const lvlUps = r.level - this.player.level
      const dropChance = b.enemy.tier >= 4 ? 1 : b.enemy.tier >= 3 ? 0.4 : b.enemy.tier >= 2 ? 0.2 : 0.1
      let droppedEq: string | null = null
      if (Math.random() < dropChance) {
        const rarities: string[] = b.enemy.tier >= 4 ? ['common','common','common','rare','rare','epic','epic'] : b.enemy.tier >= 3 ? ['common','common','common','rare','rare','epic'] : b.enemy.tier >= 2 ? ['common','common','common','rare','rare'] : ['common','common','common','rare']
        const roll = rarities[Math.floor(Math.random() * rarities.length)]
        const pool = ALL_EQUIPMENT.filter(e => e.rarity === roll)
        if (pool.length > 0) droppedEq = makeEquipId(pool[Math.floor(Math.random() * pool.length)].id, rollEquipLevel(this.stage))
      }
      const isElite = nType === 'elite', isBoss = nType === 'boss'
      const hasKillReward = isElite || isBoss; const totalRewards = lvlUps + (hasKillReward ? 1 : 0)
      const killRarity = isBoss ? 'epic' as const : isElite ? 'rare' as const : undefined
      let rewardChoices: any[] = []
      if (totalRewards > 0) {
        const cr = createRng(Date.now())
        rewardChoices = rollRewardChoices(cr, this.upgrades, { excludeHeal: this.player.hp >= this.player.maxHp, hpRatio: this.player.hp / this.player.maxHp, minRarity: killRarity })
      }
      const eid = b.enemy.id
      if (!this.meta.unlockedEnemies.includes(eid)) this.meta.unlockedEnemies = [...this.meta.unlockedEnemies, eid]
      this.meta.enemyKills[eid] = (this.meta.enemyKills[eid] || 0) + 1
      if (droppedEq) this.player.inventory = [...this.player.inventory, droppedEq]
      this.player.gold += goldEarned; this.player.xp = r.xp; this.player.level = r.level; this.player.xpToNext = r.next
      this.battle = { ...b, enemyCurrentHp: 0, phase: 'finish_delay', lastRoundResult: roundRes, result: { playerWon: true, playerDamageDealt: 999, playerDamageTaken: 0, goldEarned, totalRounds: b.round, xpEarned, overflowDamage: 999, leveledUp: lvlUps > 0, droppedEquipment: droppedEq, savedSteps: b.savedSteps } as any }
      this.rewardChoices = totalRewards > 0 ? rewardChoices : []; this.rewardReason = 'levelup'
      this.pendingLevels = totalRewards > 1 ? totalRewards - 1 : 0
    },
    DEBUG_FULL_TURNS() { if (this.battle) this.battle.turnsUsed = 0 },
    DEBUG_SET_STAGE(stage: number) { this.stage = stage },
    DEBUG_GO_SHOP() {
      const built = buildShop(createRng(Date.now()), this.stage, this.upgrades)
      this.screen = 'shop'; this.shopUpgrades = built.shopUpgrades; this.shopEquipment = built.shopEquipment; this.shopHeals = built.shopHeals
      this.shopRefreshCost = built.shopRefreshCost; this.shopRemoveCost = built.shopRemoveCost; this.shopRemoveUsed = built.shopRemoveUsed
    },
    DEBUG_GO_REST() { this.screen = 'rest' },
    DEBUG_GO_BOSS() { this.screen = 'boss_choice' },
    DEBUG_SET_INVENTORY(items: string[]) { this.player.inventory = items },
    DEBUG_DROP_10_EQUIP() {
      const rarities = ['common','common','common','rare','rare','rare','epic','epic']
      const newItems: string[] = [...this.player.inventory]
      for (let i = 0; i < 10; i++) {
        const roll = rarities[Math.floor(Math.random() * rarities.length)]
        const pool = ALL_EQUIPMENT.filter(e => e.rarity === roll)
        if (pool.length > 0) newItems.push(makeEquipId(pool[Math.floor(Math.random() * pool.length)].id, rollEquipLevel(this.stage)))
      }
      this.player.inventory = newItems
    },
    DEBUG_CLEAR_BESTIARY() {
      this.meta.unlockedEnemies = []
      this.meta.enemyKills = {}
      this.meta.enemyClaims = {}
      this.meta.bestiaryClaimed = []
      this.meta.globalClaimLevel = 0
      this.meta.bestiaryBonusHp = 0
      this.meta.bestiaryBonusAtk = 0
      this.saveMetaState()
    },

    // Internal helpers
    _resolveKill(updatedBattle: any, roundRes: any, playerHpAfter: number, savedStepsBonus: number = 0) {
      const eid = updatedBattle.enemy.id; const nType = this.route.find(n => n.id === this.currentNodeId)?.type
      const rMult = nType === 'boss' ? 3 : nType === 'elite' ? 2 : 1
      let metaUnlocked = this.meta.unlockedEnemies, metaClaimed = this.meta.bestiaryClaimed
      let metaBonusHp = this.meta.bestiaryBonusHp, metaBonusAtk = this.meta.bestiaryBonusAtk, metaBonusGold = 0
      let metaKills = { ...this.meta.enemyKills }
      metaKills[eid] = (metaKills[eid] || 0) + 1
      if (!metaUnlocked.includes(eid)) metaUnlocked = [...metaUnlocked, eid]
      if (metaUnlocked.length >= 3 && !metaClaimed.includes(3)) { metaClaimed = [...metaClaimed, 3]; metaBonusGold += 15 }
      if (metaUnlocked.length >= 6 && !metaClaimed.includes(6)) { metaClaimed = [...metaClaimed, 6]; metaBonusHp += 5 }
      if (metaUnlocked.length >= 10 && !metaClaimed.includes(10)) { metaClaimed = [...metaClaimed, 10]; metaBonusGold += 25 }
      if (metaUnlocked.length >= 13 && !metaClaimed.includes(13)) { metaClaimed = [...metaClaimed, 13]; metaBonusAtk += 0.05 }
      if (metaUnlocked.length >= 16 && !metaClaimed.includes(16)) { metaClaimed = [...metaClaimed, 16]; metaBonusGold += 50; metaBonusHp += 10 }
      const isElite = nType === 'elite', isBoss = nType === 'boss'
      const hasKillReward = isElite || isBoss
      const killRarity = isBoss ? 'epic' as const : isElite ? 'rare' as const : undefined
      const enemyGoldBoost = (updatedBattle.enemy.enemyUpgrades || []).some((id: string) => { const u = UPGRADE_POOL.find(x => x.id === id); return u?.effect.type === 'gold_boost' }) ? 0.5 : 0
      const eff = this.battle?.equipEffects || {}
      let baseGold = Math.floor(updatedBattle.enemy.tier * 15 * (1 + this.player.goldBoost + enemyGoldBoost)) * rMult
      let xpEarned = (updatedBattle.enemy.tier * 8 + Math.floor(updatedBattle.totalAttack / 8)) * rMult
      if (eff.doubleGold) baseGold *= 2
      if (eff.doubleXp) xpEarned *= 2
      const goldEarned = baseGold + savedStepsBonus
      let healHp = playerHpAfter
      if (eff.lifesteal && roundRes.enemyDamage > 0) healHp = Math.min(this.player.maxHp, healHp + Math.floor(roundRes.enemyDamage * eff.lifesteal))
      if (eff.regen) healHp = Math.min(this.player.maxHp, healHp + Math.floor(this.player.maxHp * eff.regen))
      const rawXp = this.player.xp + xpEarned
      const r = gainXp(rawXp, this.player.level, this.player.xpToNext)
      const levelUps = r.level - this.player.level
      const totalRewards = levelUps + (hasKillReward ? 1 : 0)
      let rewardChoices: any[] = []
      if (totalRewards > 0) {
        const cr = createRng(this.runSeed + updatedBattle.round + 777)
        rewardChoices = rollRewardChoices(cr, this.upgrades, { excludeHeal: this.player.hp >= this.player.maxHp, hpRatio: this.player.hp / this.player.maxHp, minRarity: killRarity })
      }
      const baseDrop = updatedBattle.enemy.tier >= 4 ? 1 : updatedBattle.enemy.tier >= 3 ? 0.4 : updatedBattle.enemy.tier >= 2 ? 0.2 : 0.1
      const dropChance = isBoss ? 1 : isElite ? Math.min(1, baseDrop * 2) : baseDrop
      let droppedEq: string | null = null
      if (Math.random() < dropChance) {
        const rarities: string[] = updatedBattle.enemy.tier >= 4 ? ['common','common','common','rare','rare','epic','epic'] : updatedBattle.enemy.tier >= 3 ? ['common','common','common','rare','rare','epic'] : updatedBattle.enemy.tier >= 2 ? ['common','common','common','rare','rare'] : ['common','common','common','rare']
        const roll = rarities[Math.floor(Math.random() * rarities.length)]
        const pool = ALL_EQUIPMENT.filter(e => e.rarity === roll)
        if (pool.length > 0) droppedEq = makeEquipId(pool[Math.floor(Math.random() * pool.length)].id, rollEquipLevel(this.stage))
      }
      this.player.hp = healHp; this.player.gold += goldEarned
      this.player.xp = r.xp; this.player.level = r.level; this.player.xpToNext = r.next
      this.battle = { ...updatedBattle, enemyCurrentHp: 0, phase: 'finish_delay', lastRoundResult: roundRes, result: { playerWon: true, playerDamageDealt: roundRes.enemyDamage, playerDamageTaken: roundRes.playerDamage, goldEarned, totalRounds: updatedBattle.round, xpEarned, overflowDamage: roundRes.overflowDamage, leveledUp: levelUps > 0, savedSteps: updatedBattle.savedSteps, droppedEquipment: droppedEq } as any }
      this.rewardChoices = totalRewards > 0 ? rewardChoices : []; this.rewardReason = 'levelup'
      this.pendingLevels = totalRewards > 1 ? totalRewards - 1 : 0
      this.meta = { ...this.meta, unlockedEnemies: metaUnlocked, enemyKills: metaKills, bestiaryBonusHp: metaBonusHp, bestiaryBonusAtk: metaBonusAtk, bestiaryClaimed: metaClaimed, totalGold: this.meta.totalGold + metaBonusGold }
    },

    _resolveEnemyKill(updatedBattle: any, roundRes: any, playerHpAfter: number) {
      this._resolveKill(updatedBattle, roundRes, playerHpAfter, 0)
    },

    _resolvePlayerDeath(updatedBattle: any, roundRes: any) {
      const metaGold = Math.floor(this.player.gold * 0.1) + 5
      this.player.hp = 0
      this.battle = { ...updatedBattle, enemyCurrentHp: roundRes.enemyHpAfter, phase: 'finish_delay', lastRoundResult: roundRes, result: { playerWon: false, playerDamageDealt: roundRes.enemyDamage, playerDamageTaken: roundRes.playerDamage, goldEarned: 0, totalRounds: updatedBattle.round, savedSteps: updatedBattle.savedSteps } as any }
      this.meta.totalGold += metaGold; this.meta.totalRuns++
      this.saveMetaState(); this.screen = 'gameover'
    },

    _applyUpgradeEffect(def: any, _count: number) {
      switch (def.effect.type) {
        case 'attack_multiplier': this.player.attackMultiplier += def.effect.value; break
        case 'defense_multiplier': this.player.defenseMultiplier += def.effect.value; break
        case 'bonus_turns': this.player.bonusTurns += def.effect.value; break
        case 'heal': this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.effect.value); break
        case 'max_hp': this.player.maxHp += def.effect.value; this.player.hp = Math.min(this.player.maxHp, this.player.hp + def.effect.value); break
        case 'spawn_reduction': this.player.spawnReduction = Math.min(0.5, this.player.spawnReduction + def.effect.value); break
        case 'enemy_atk_down': this.player.enemyAtkDown += def.effect.value; break
        case 'gold_boost': this.player.goldBoost += def.effect.value; break
      }
    },

    _reverseUpgradeEffect(def: any) {
      switch (def.effect.type) {
        case 'attack_multiplier': this.player.attackMultiplier -= def.effect.value; break
        case 'defense_multiplier': this.player.defenseMultiplier -= def.effect.value; break
        case 'bonus_turns': this.player.bonusTurns -= def.effect.value; break
        case 'max_hp': this.player.maxHp -= def.effect.value; if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp; break
        case 'spawn_reduction': this.player.spawnReduction = Math.max(0, this.player.spawnReduction - def.effect.value); break
        case 'enemy_atk_down': this.player.enemyAtkDown = Math.max(0, this.player.enemyAtkDown - def.effect.value); break
        case 'gold_boost': this.player.goldBoost = Math.max(0, this.player.goldBoost - def.effect.value); break
      }
    },
  },
})
