import { Cell, Direction, SlideResult } from '../types';

let nextCellId = 1;

function createCell(value: number, isNew = false, isMerged = false): Cell {
  return { value, id: nextCellId++, isNew, isMerged };
}

export function createEmptyGrid(): Cell[][] {
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => createCell(0))
  );
}

// Extract a line from the grid given direction and row/col index
function extractLine(grid: Cell[][], direction: Direction, index: number): Cell[] {
  const line: Cell[] = [];
  for (let i = 0; i < 4; i++) {
    switch (direction) {
      case 'left':  line.push(grid[index][i]); break;
      case 'right': line.push(grid[index][3 - i]); break;
      case 'up':    line.push(grid[i][index]); break;
      case 'down':  line.push(grid[3 - i][index]); break;
    }
  }
  return line;
}

// Write a line back to the grid
function setLine(grid: Cell[][], direction: Direction, index: number, line: Cell[]): void {
  for (let i = 0; i < 4; i++) {
    const cell = line[i];
    switch (direction) {
      case 'left':  grid[index][i] = cell; break;
      case 'right': grid[index][3 - i] = cell; break;
      case 'up':    grid[i][index] = cell; break;
      case 'down':  grid[3 - i][index] = cell; break;
    }
  }
}

// Core: slide a single line toward index 0
function mergeLine(line: Cell[]): { result: Cell[]; mergedSum: number; moved: boolean } {
  // Filter out empty cells and reset merge/new flags
  const nonEmpty = line
    .filter(c => c.value !== 0)
    .map(c => createCell(c.value, false, false));

  const result: Cell[] = [];
  let mergedSum = 0;
  let i = 0;

  while (i < nonEmpty.length) {
    if (i + 1 < nonEmpty.length && nonEmpty[i].value === nonEmpty[i + 1].value) {
      const mergedValue = nonEmpty[i].value * 2;
      result.push(createCell(mergedValue, false, true));
      mergedSum += mergedValue;
      i += 2;
    } else {
      result.push(nonEmpty[i]);
      i += 1;
    }
  }

  // Pad to length 4 with empty cells
  while (result.length < 4) {
    result.push(createCell(0));
  }

  // Check if anything moved
  const moved = line.some((cell, idx) => cell.value !== result[idx].value);

  return { result, mergedSum, moved };
}

export function slideGrid(grid: Cell[][], direction: Direction): SlideResult {
  const newGrid = grid.map(row => row.map(c => createCell(c.value, false, false)));
  let totalMergedSum = 0;
  let moved = false;

  for (let i = 0; i < 4; i++) {
    const line = extractLine(newGrid, direction, i);
    const { result, mergedSum, moved: lineMoved } = mergeLine(line);
    totalMergedSum += mergedSum;
    moved = moved || lineMoved;
    setLine(newGrid, direction, i, result);
  }

  return { grid: newGrid, mergedSum: totalMergedSum, moved };
}

export interface SpawnResult {
  grid: Cell[][];
  spawnedValue: number;
  spawned: boolean;
}

export function spawnTileWithValue(grid: Cell[][], rng: () => number, value: number): Cell[][] | null {
  const emptyCells: { r: number; c: number }[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c].value === 0) {
        emptyCells.push({ r, c });
      }
    }
  }
  if (emptyCells.length === 0) return null;

  const idx = Math.floor(rng() * emptyCells.length);
  const { r, c } = emptyCells[idx];
  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = createCell(value, false, false);
  return newGrid;
}

export function spawnTile(grid: Cell[][], rng: () => number): SpawnResult {
  const emptyCells: { r: number; c: number }[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c].value === 0) {
        emptyCells.push({ r, c });
      }
    }
  }

  if (emptyCells.length === 0) {
    return { grid, spawnedValue: 0, spawned: false };
  }

  const idx = Math.floor(rng() * emptyCells.length);
  const { r, c } = emptyCells[idx];
  const value = rng() < 0.9 ? 2 : 4;

  const newGrid = grid.map(row => [...row]);
  newGrid[r][c] = createCell(value, true, false);

  return { grid: newGrid, spawnedValue: value, spawned: true };
}

export function initGrid(rng: () => number): Cell[][] {
  let grid = createEmptyGrid();
  // Start with 2 random tiles
  const r1 = spawnTile(grid, rng);
  const r2 = spawnTile(r1.grid, rng);
  return r2.grid;
}

// Halve all non-zero tile values (minimum 2) for next combat round
export function halveGridTiles(grid: Cell[][]): Cell[][] {
  return grid.map(row =>
    row.map(cell => {
      if (cell.value === 0) return createCell(0);
      const halved = Math.floor(cell.value / 2);
      return createCell(Math.max(2, halved), false, false);
    }),
  );
}
