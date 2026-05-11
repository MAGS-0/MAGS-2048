export const GRID_SIZE = 4;

export const getEmptyCells = (grid) => {
  const cells = [];
  grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell === 0) cells.push({ r: rowIndex, c: colIndex });
    });
  });
  return cells;
};

export const spawnTile = (grid) => {
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) return grid;
  const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newGrid = [...grid.map(row => [...row])];
  newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  return newGrid;
};

export const initializeGrid = () => {
  let grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
  grid = spawnTile(grid);
  grid = spawnTile(grid);
  return grid;
};

const slideAndMerge = (row) => {
  let line = row.filter(num => num !== 0);
  let score = 0;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === line[i + 1]) {
      line[i] *= 2;
      score += line[i];
      line.splice(i + 1, 1);
    }
  }
  while (line.length < GRID_SIZE) line.push(0);
  return { line, score };
};

export const moveGrid = (grid, direction) => {
  let newGrid = [...grid.map(row => [...row])];
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
      if (direction === 'left' || direction === 'right') {
        if (newGrid[i][j] !== finalRow[j]) changed = true;
        newGrid[i][j] = finalRow[j];
      } else {
        if (newGrid[j][i] !== finalRow[j]) changed = true;
        newGrid[j][i] = finalRow[j];
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
};