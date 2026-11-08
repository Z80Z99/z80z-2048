import type { Cell } from '../types'

export const BOARD_MOVE_MS = 150
export const BOARD_IMPACT_MS = 280
export const BOARD_ATTACK_FLOAT_MS = 650
export const MAX_TRAIL_ECHOES = 32
export const MAX_IMPACT_NODES = 64

export interface BoardTile {
  cell: Cell
  row: number
  col: number
  pending: boolean
  leaving: boolean
}

interface Point { row: number; col: number }
export interface TrailEcho {
  key: string
  value: number
  index: number
  from: Point
  to: Point
}
export type ImpactTier = 'small' | 'ring' | 'chips' | 'strong'
export interface ImpactDecoration {
  key: string
  kind: 'flash' | 'ring' | 'streak' | 'chip'
  index: number
}
export interface MergeImpact {
  key: string
  cellId: number
  value: number
  row: number
  col: number
  tier: ImpactTier
  decorations: ImpactDecoration[]
}
export interface BoardRenderPlan {
  tiles: BoardTile[]
  echoes: TrailEcho[]
  impacts: MergeImpact[]
  edgeKey: string | null
  moving: boolean
  decorativeNodeCount: number
}

function copyCell(cell: Cell): Cell {
  return cell.mergedFrom ? { ...cell, mergedFrom: [...cell.mergedFrom] } : { ...cell }
}

export function copyBoardGrid(grid: Cell[][]): Cell[][] {
  return grid.map(row => row.map(copyCell))
}

export function snapshotBoard(grid: Cell[][]): BoardTile[] {
  const tiles: BoardTile[] = []
  grid.slice(0, 4).forEach((row, r) => row.slice(0, 4).forEach((cell, c) => {
    if (cell.value > 0) tiles.push({ cell: copyCell(cell), row: r, col: c, pending: false, leaving: false })
  }))
  return tiles
}

function decorations(key: string, tier: ImpactTier): ImpactDecoration[] {
  const bits: ImpactDecoration[] = [{ key: `${key}-flash`, kind: 'flash', index: 0 }]
  if (tier !== 'small') bits.push({ key: `${key}-ring`, kind: 'ring', index: 0 })
  if (tier === 'strong') bits.push({ key: `${key}-ring-second`, kind: 'ring', index: 1 })
  for (let i = 0; i < 4; i++) bits.push({ key: `${key}-streak-${i}`, kind: 'streak', index: i })
  if (tier === 'chips' || tier === 'strong') {
    for (let i = 0; i < 2; i++) bits.push({ key: `${key}-chip-${i}`, kind: 'chip', index: i })
  }
  return bits
}

// 只读取稳定 ID 和 mergedFrom；展示修订号不参与游戏 Cell ID 分配。
export function buildBoardRenderPlan(previous: Cell[][], next: Cell[][], revision: number, reducedMotion = false): BoardRenderPlan {
  const before = snapshotBoard(previous)
  const tiles = snapshotBoard(next)
  const empty = (): BoardRenderPlan => ({ tiles, echoes: [], impacts: [], edgeKey: null, moving: false, decorativeNodeCount: 0 })
  if (reducedMotion || before.length === 0) return empty()
  const oldById = new Map(before.map(tile => [tile.cell.id, tile]))
  const nextIds = new Set(tiles.map(tile => tile.cell.id))
  const ghosts: BoardTile[] = []
  const movements: { source: BoardTile; target: BoardTile }[] = []
  const impacts: MergeImpact[] = []

  for (const tile of tiles) {
    const old = oldById.get(tile.cell.id)
    if (old) {
      if (old.row !== tile.row || old.col !== tile.col) movements.push({ source: old, target: tile })
      continue
    }
    const ids = tile.cell.mergedFrom ?? []
    const sources = ids.map(id => oldById.get(id))
    // 陈旧的合并标记、道具改值和新回合都不是实际合并。
    const actualMerge = tile.cell.isMerged && ids.length === 2 && ids[0] !== ids[1] &&
      sources.every(source => source && !nextIds.has(source.cell.id)) &&
      sources[0]!.cell.value === sources[1]!.cell.value &&
      sources[0]!.cell.value + sources[1]!.cell.value === tile.cell.value
    if (!actualMerge) continue
    const key = `zbfx-${revision}-impact-${impacts.length}`
    const tier: ImpactTier = tile.cell.value < 16 ? 'small' : tile.cell.value < 64 ? 'ring' : 'chips'
    impacts.push({ key, cellId: tile.cell.id, value: tile.cell.value, row: tile.row, col: tile.col, tier, decorations: [] })
    tile.pending = true
    for (const source of sources as BoardTile[]) {
      ghosts.push({
        cell: { ...copyCell(source.cell), isNew: false, isMerged: false },
        row: tile.row, col: tile.col, pending: false, leaving: true,
      })
      if (source.row !== tile.row || source.col !== tile.col) movements.push({ source, target: tile })
    }
  }
  if (movements.length === 0) return empty()
  for (const tile of tiles) {
    if (!oldById.has(tile.cell.id) && tile.cell.isNew) tile.pending = true
  }

  const echoes: TrailEcho[] = []
  for (const [movementIndex, { source, target }] of movements.slice(0, 16).entries()) {
    for (let index = 0; index < 2; index++) {
      const lag = 0.14 * (index + 1)
      echoes.push({
        key: `zbfx-${revision}-echo-${movementIndex}-${index}`, value: source.cell.value, index,
        from: { row: source.row, col: source.col },
        to: {
          row: target.row - Math.sign(target.row - source.row) * lag,
          col: target.col - Math.sign(target.col - source.col) * lag,
        },
      })
    }
  }

  // 最多两个最强合并采用强冲击；其余仍有环、短射线及双石屑。
  const ranked = [...impacts].sort((a, b) => b.value - a.value || a.row - b.row || a.col - b.col)
  ranked.filter(impact => impact.value >= 256).slice(0, 2).forEach(impact => { impact.tier = 'strong' })
  const edgeKey = impacts.some(impact => impact.value >= 256) ? `zbfx-${revision}-edge` : null
  impacts.forEach(impact => { impact.decorations = decorations(impact.key, impact.tier) })
  let decorativeNodeCount = impacts.reduce((sum, impact) => sum + impact.decorations.length, edgeKey ? 1 : 0)
  // 八组合并的极端情况也包含边缘闪光在内；优先保留最强两组细节。
  for (const impact of [...ranked].reverse()) {
    if (decorativeNodeCount <= MAX_IMPACT_NODES) break
    if (impact.tier !== 'chips') continue
    impact.tier = 'ring'
    impact.decorations = decorations(impact.key, impact.tier)
    decorativeNodeCount -= 2
  }
  return { tiles: [...tiles, ...ghosts], echoes, impacts, edgeKey, moving: true, decorativeNodeCount }
}

export interface AttackSnapshot {
  nodeId: string | null
  round: number
  turnsUsed: number
  totalAttack: number
}

// 只供一次成功 SLIDE 的前后快照调用，不观察属性变化，也不计算伤害。
export function slideAttackDelta(before: AttackSnapshot, after: AttackSnapshot, succeeded: boolean): number {
  if (!succeeded || before.nodeId !== after.nodeId || before.round !== after.round || after.turnsUsed <= before.turnsUsed) return 0
  const delta = after.totalAttack - before.totalAttack
  return Number.isFinite(delta) && delta > 0 ? delta : 0
}

// 蓄力系数是乘除法，差值会带 17.000000000000005 一类的浮点尾巴；浮字只保留两位小数并去掉多余的零。
export function formatAttackGain(value: number): number {
  const rounded = Number(Number(value).toFixed(2))
  return Number.isFinite(rounded) ? rounded : 0
}

export function tileColors(value: number): { face: string; ink: string } {
  if (value >= 16384) return { face: '#433248', ink: '#ffe6a9' }
  if (value >= 4096) return { face: '#623c2c', ink: '#ffe6a9' }
  const colors: Record<number, [string, string]> = {
    2: ['var(--tile-stone)', 'var(--tile-text)'], 4: ['var(--tile-slate)', 'var(--tile-text)'],
    8: ['#776544', '#fff6e5'], 16: ['#8a633c', '#fff6e5'], 32: ['#975432', '#fff6e5'],
    64: ['#9f4436', '#fff6e5'], 128: ['#b38a47', '#21180c'], 256: ['#c3a052', '#21180c'],
    512: ['#d5b466', '#21180c'], 1024: ['#e1c37f', '#21180c'], 2048: ['#f0d795', '#21180c'],
  }
  const [face, ink] = colors[value] ?? ['var(--tile-stone)', 'var(--tile-text)']
  return { face, ink }
}

// 可注入时钟的轻量调度器：取消后即使平台送达旧回调也不能复活效果。
export function createBoardEffectScheduler(
  install: (callback: () => void, ms: number) => any = (callback, ms) => setTimeout(callback, ms),
  cancel: (handle: any) => void = handle => clearTimeout(handle),
) {
  let token = 0
  const pending = new Set<any>()
  return {
    schedule(ms: number, callback: () => void) {
      const current = token
      const handle = install(() => {
        pending.delete(handle)
        if (current === token) callback()
      }, ms)
      pending.add(handle)
    },
    clear() {
      token++
      pending.forEach(cancel)
      pending.clear()
    },
  }
}
