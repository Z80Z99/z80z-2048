import type { Cell, Direction, SlideResult } from '../types'

let nextCellId = 1

function createCell(value: number, isNew = false, isMerged = false): Cell {
  return { value, id: nextCellId++, isNew, isMerged }
}

// 兼容恢复的棋盘与测试构造的 ID，避免新方块与存量方块重名。
function reserveIds(grid: Cell[][]): void {
  for (const row of grid) {
    for (const cell of row) nextCellId = Math.max(nextCellId, cell.id + 1)
  }
}

function resetCell(cell: Cell): Cell {
  return { value: cell.value, id: cell.id, isNew: false, isMerged: false }
}

function copyCell(cell: Cell): Cell {
  return cell.mergedFrom ? { ...cell, mergedFrom: [...cell.mergedFrom] } : { ...cell }
}

export function createEmptyGrid(): Cell[][] {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => createCell(0)),
  )
}

function extractLine(grid: Cell[][], direction: Direction, index: number): Cell[] {
  const line: Cell[] = []
  for (let i = 0; i < 4; i++) {
    switch (direction) {
      case 'left': line.push(grid[index][i]); break
      case 'right': line.push(grid[index][3 - i]); break
      case 'up': line.push(grid[i][index]); break
      case 'down': line.push(grid[3 - i][index]); break
    }
  }
  return line
}

function setLine(grid: Cell[][], direction: Direction, index: number, line: Cell[]): void {
  for (let i = 0; i < 4; i++) {
    switch (direction) {
      case 'left': grid[index][i] = line[i]; break
      case 'right': grid[index][3 - i] = line[i]; break
      case 'up': grid[i][index] = line[i]; break
      case 'down': grid[3 - i][index] = line[i]; break
    }
  }
}

function mergeLine(line: Cell[]): { result: Cell[]; mergedSum: number; moved: boolean } {
  const nonEmpty = line.filter(cell => cell.value !== 0).map(resetCell)
  const empty = line.filter(cell => cell.value === 0).map(resetCell)
  const result: Cell[] = []
  let mergedSum = 0
  let i = 0

  while (i < nonEmpty.length) {
    const cell = nonEmpty[i]
    const next = nonEmpty[i + 1]
    if (next && cell.value === next.value) {
      const merged = createCell(cell.value * 2, false, true)
      // 两个源方块先滑入同一格，再显示新的合并方块。
      merged.mergedFrom = [cell.id, next.id]
      result.push(merged)
      mergedSum += merged.value
      i += 2
    } else {
      result.push(cell)
      i++
    }
  }

  let emptyIndex = 0
  while (result.length < 4) result.push(empty[emptyIndex++] ?? createCell(0))

  return {
    result,
    mergedSum,
    moved: line.some((cell, index) => cell.value !== result[index].value),
  }
}

export function slideGrid(grid: Cell[][], direction: Direction): SlideResult {
  reserveIds(grid)
  const newGrid = grid.map(row => row.map(resetCell))
  let mergedSum = 0
  let moved = false

  for (let i = 0; i < 4; i++) {
    const line = mergeLine(extractLine(grid, direction, i))
    mergedSum += line.mergedSum
    moved = moved || line.moved
    setLine(newGrid, direction, i, line.result)
  }

  return { grid: newGrid, mergedSum, moved }
}

export interface SpawnResult {
  grid: Cell[][]
  spawnedValue: number
  spawned: boolean
}

function emptyPositions(grid: Cell[][]): { r: number; c: number }[] {
  const positions: { r: number; c: number }[] = []
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c].value === 0) positions.push({ r, c })
    }
  }
  return positions
}

export function spawnTileWithValue(grid: Cell[][], rng: () => number, value: number): Cell[][] | null {
  const empty = emptyPositions(grid)
  if (empty.length === 0) return null
  reserveIds(grid)
  const { r, c } = empty[Math.floor(rng() * empty.length)]
  const newGrid = grid.map(row => row.map(copyCell))
  newGrid[r][c] = createCell(value, true)
  return newGrid
}

export function spawnTile(grid: Cell[][], rng: () => number, fourChance = 0.1): SpawnResult {
  const empty = emptyPositions(grid)
  if (empty.length === 0) return { grid, spawnedValue: 0, spawned: false }
  reserveIds(grid)
  const { r, c } = empty[Math.floor(rng() * empty.length)]
  const value = rng() < 1 - fourChance ? 2 : 4
  const newGrid = grid.map(row => row.map(copyCell))
  newGrid[r][c] = createCell(value, true)
  return { grid: newGrid, spawnedValue: value, spawned: true }
}

export function initGrid(rng: () => number): Cell[][] {
  const first = spawnTile(createEmptyGrid(), rng)
  return spawnTile(first.grid, rng).grid
}

// 回合间只改变数值，保留棋子身份；新的回合不重播上次合并特效。
// protectChance > 0 时每个非空方块消耗一次 rng，命中则本回合不减半（减半护佑）。
export function halveGridTiles(grid: Cell[][], rng: () => number, protectChance = 0): Cell[][] {
  return grid.map(row => row.map(cell => {
    const reset = resetCell(cell)
    if (cell.value === 0) return { ...reset, value: 0 }
    if (protectChance > 0 && rng() < protectChance) return { ...reset, value: cell.value }
    return { ...reset, value: Math.max(2, Math.floor(cell.value / 2)) }
  }))
}
