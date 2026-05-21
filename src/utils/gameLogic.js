export const GRID_SIZE = 4;

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

export const getEmptyCells = (grid) => {
  const cells = [];
  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === null) cells.push({ r: rowIndex, c: colIndex });
    });
  });
  return cells;
};

export const spawnTile = (grid) => {
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) return grid;
  const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newGrid = grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
  const val = Math.random() < 0.9 ? 2 : 4;
  newGrid[r][c] = { id: uid(), value: val };
  return newGrid;
};

export const initializeGrid = () => {
  let grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
  grid = spawnTile(grid);
  grid = spawnTile(grid);
  return grid;
};

const slideAndMerge = (row) => {
  const tiles = row.filter(t => t !== null);
  const result = [];
  let score = 0;

  for (let i = 0; i < tiles.length; i++) {
    const current = tiles[i];
    const next = tiles[i + 1];
    if (next && current.value === next.value) {
      const newValue = current.value * 2;
      score += newValue;
      result.push({ id: uid(), value: newValue });
      i++;
    } else {
      result.push({ ...current });
    }
  }

  while (result.length < GRID_SIZE) result.push(null);
  return { line: result, score };
};

export const moveGrid = (grid, direction) => {
  let newGrid = grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
  let totalScore = 0;
  let changed = false;

  for (let i = 0; i < GRID_SIZE; i++) {
    let row;
    if (direction === 'left') row = newGrid[i];
    else if (direction === 'right') row = [...newGrid[i]].reverse();
    else if (direction === 'up') row = newGrid.map(r => r[i]);
    else row = newGrid.map(r => r[i]).reverse();

    const { line, score } = slideAndMerge(row);
    totalScore += score;

    let finalRow = direction === 'right' || direction === 'down' ? [...line].reverse() : line;

    for (let j = 0; j < GRID_SIZE; j++) {
      const target = finalRow[j];
      if (direction === 'left' || direction === 'right') {
        const existing = newGrid[i][j];
        const existingVal = existing ? existing.value : null;
        const targetVal = target ? target.value : null;
        if (existingVal !== targetVal) changed = true;
        newGrid[i][j] = target ? { ...target } : null;
      } else {
        const existing = newGrid[j][i];
        const existingVal = existing ? existing.value : null;
        const targetVal = target ? target.value : null;
        if (existingVal !== targetVal) changed = true;
        newGrid[j][i] = target ? { ...target } : null;
      }
    }
  }
  return { grid: changed ? spawnTile(newGrid) : newGrid, score: totalScore, changed };
}
export const getPreviousState = (history) => {
  if (history.length > 1) {
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];
    return { previousState, newHistory };
  }
  return null;
}
export const isGameOver = (grid) => {
  // 1. Check if there are any empty cells
  if (getEmptyCells(grid).length > 0) return false;

  // 2. Check if any adjacent cells can merge (Horizontal)
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE - 1; c++) {
      const a = grid[r][c] ? grid[r][c].value : null;
      const b = grid[r][c + 1] ? grid[r][c + 1].value : null;
      if (a !== null && a === b) return false;
    }
  }

  // 3. Check if any adjacent cells can merge (Vertical)
  for (let c = 0; c < GRID_SIZE; c++) {
    for (let r = 0; r < GRID_SIZE - 1; r++) {
      const a = grid[r][c] ? grid[r][c].value : null;
      const b = grid[r + 1][c] ? grid[r + 1][c].value : null;
      if (a !== null && a === b) return false;
    }
  }

  // If no empty cells and no possible merges, it's Game Over
  return true;
};