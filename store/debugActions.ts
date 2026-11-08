import type { GameState, PlayerStats, RoundResult, BattleState, UpgradeDef } from '../types'
import { ALL_EQUIPMENT, makeEquipId } from '../core/equipment'
import { ENEMIES } from '../core/enemy'
import { UPGRADE_POOL } from '../core/upgrade'
import { buildShop } from './helpers'

export const DEBUG_ENABLED = typeof __DEV__ !== 'undefined' && __DEV__

interface DebugContext extends GameState {
  effectivePlayer: PlayerStats
  _rng(...scope: (string | number)[]): () => number
  _heal(amount: number): void
  _clampHp(): void
  _gainXp(amount: number): number
  _showNextReward(): boolean
  _grantUpgrade(def: UpgradeDef): boolean
  _addEquipment(id: string): string | null
  _addConsumable(id: string, count?: number): boolean
  _resolveKill(battle: BattleState, result: RoundResult, hp: number): void
  saveMetaState(): void
}

function debugAction<T extends unknown[]>(action: (this: DebugContext, ...args: T) => void) {
  return function (this: DebugContext, ...args: T) {
    if (DEBUG_ENABLED) action.apply(this, args)
  }
}

export const debugActions = {
  DEBUG_ADD_GOLD: debugAction(function (amount: number) { this.player.gold = Math.max(0, this.player.gold + amount) }),
  DEBUG_HEAL: debugAction(function (amount: number) { this._heal(amount) }),
  DEBUG_ADD_XP: debugAction(function (amount: number) {
    const wasReward = this.screen === 'reward'
    this._gainXp(amount)
    if (!this.battle && !wasReward) this._showNextReward()
  }),
  DEBUG_FORCE_LEVELUP: debugAction(function () {
    const wasReward = this.screen === 'reward'
    this._gainXp(this.player.xpToNext - this.player.xp)
    if (!this.battle && !wasReward) this._showNextReward()
  }),
  DEBUG_ADD_UPGRADE: debugAction(function (id: string) {
    const def = UPGRADE_POOL.find(u => u.id === id)
    if (def) this._grantUpgrade(def)
  }),
  DEBUG_ADD_CONSUMABLE: debugAction(function (id: string) { this._addConsumable(id) }),
  DEBUG_UNLOCK_ALL_ENEMIES: debugAction(function () { this.meta.unlockedEnemies = ENEMIES.map(e => e.id) }),
  DEBUG_ADD_KILLS: debugAction(function (amount: number) {
    for (const enemy of ENEMIES) this.meta.enemyKills[enemy.id] = Math.max(0, (this.meta.enemyKills[enemy.id] || 0) + amount)
  }),
  DEBUG_KILL_ENEMY: debugAction(function () {
    const battle = this.battle
    if (!battle || battle.phase !== 'playing' || this.player.hp <= 0) return
    const result: RoundResult = {
      playerDamage: 0, enemyDamage: battle.enemyCurrentHp, enemyHpAfter: 0, overflowDamage: 0,
      playerFirst: true, playerSpeed: this.effectivePlayer.baseSpeed, enemySpeed: battle.enemy.speed,
      playerHpAfter: this.player.hp, playerActed: true, enemyActed: false, avoidReason: 'kill',
    }
    this._resolveKill(battle, result, this.player.hp)
  }),
  DEBUG_FULL_TURNS: debugAction(function () { if (this.battle?.phase === 'playing') this.battle.turnsUsed = 0 }),
  DEBUG_SET_STAGE: debugAction(function (stage: number) { if (Number.isFinite(stage)) this.stage = Math.max(1, Math.floor(stage)) }),
  DEBUG_GO_SHOP: debugAction(function () {
    if (this.battle) return
    Object.assign(this, buildShop(this._rng('debug-shop', this.debugActionCount++), this.stage, this.upgrades))
    this.shopRefreshCount = 0
    this.screen = 'shop'
  }),
  DEBUG_GO_REST: debugAction(function () {
    if (this.battle) return
    this.restUsed = false
    this.restResult = null
    this.screen = 'rest'
  }),
  DEBUG_GO_BOSS: debugAction(function () { if (!this.battle) this.screen = 'boss_choice' }),
  DEBUG_SET_INVENTORY: debugAction(function (items: string[]) {
    if (this.battle) return
    this.player.inventory = []
    this.player.equipment = {}
    for (const id of items) this._addEquipment(id)
    this._clampHp()
  }),
  DEBUG_DROP_10_EQUIP: debugAction(function () {
    const rng = this._rng('debug-loot', this.debugActionCount++)
    const rarities = ['common', 'common', 'common', 'rare', 'rare', 'rare', 'epic', 'epic']
    for (let i = 0; i < 10; i++) {
      const rarity = rarities[Math.floor(rng() * rarities.length)]
      const pool = ALL_EQUIPMENT.filter(e => e.rarity === rarity)
      if (!pool.length) continue
      const level = (this.stage - 1) * 2 + 1 + Math.floor(rng() * 2)
      this._addEquipment(makeEquipId(pool[Math.floor(rng() * pool.length)].id, level, undefined, rng))
    }
  }),
  DEBUG_CLEAR_BESTIARY: debugAction(function () {
    this.meta.unlockedEnemies = []
    this.meta.enemyKills = {}
    this.meta.enemyClaims = {}
    this.meta.bestiaryClaimed = []
    this.meta.globalClaimLevel = 0
    this.meta.bestiaryBonusHp = 0
    this.meta.bestiaryBonusAtk = 0
    this.saveMetaState()
  }),
}
