export const GOMOKU_BOARD_SIZE = 25;
export const GOMOKU_EMPTY = 0;
export const GOMOKU_BLACK = 1;
export const GOMOKU_WHITE = 2;
export const GOMOKU_GRID_CELL_SPACING = 0.096;
export const GOMOKU_GRID_CENTER = (GOMOKU_BOARD_SIZE - 1) / 2;
export const GOMOKU_GRID_HALF_SIZE =
  (GOMOKU_BOARD_SIZE - 1) * GOMOKU_GRID_CELL_SPACING / 2;
export const GOMOKU_GRID_HIT_RADIUS = GOMOKU_GRID_CELL_SPACING * 0.62;

export type GomokuCell =
  | typeof GOMOKU_EMPTY
  | typeof GOMOKU_BLACK
  | typeof GOMOKU_WHITE;
export type GomokuStone = typeof GOMOKU_BLACK | typeof GOMOKU_WHITE;
export type GomokuDifficulty = "legend" | "master" | "strong" | "fast";
export type GomokuStatus = "player" | "thinking" | "terminal" | "error";

export interface GomokuPoint {
  x: number;
  y: number;
}

export interface GomokuMove extends GomokuPoint {
  color: GomokuStone;
}

export type GomokuMoveTuple = [number, number, GomokuStone];

export interface GomokuAiStats {
  cacheHits?: number;
  depth?: number;
  difficulty?: string;
  elapsed?: number;
  gate?: string;
  nodes?: number;
  score?: number;
  source?: string;
}

export interface GomokuAiExplain {
  knowledgePoint?: string;
  reason: string;
  title: string;
  topMoves?: readonly {
    move: string;
    score: string;
  }[];
}

export interface GomokuAiWorkerRequest {
  color: GomokuStone;
  difficulty: GomokuDifficulty;
  id: number;
  snapshot: GomokuMoveTuple[];
}

export interface GomokuAiWorkerResponse {
  error?: string;
  explain: GomokuAiExplain | null;
  id: number;
  move: [number, number] | null;
  ok: boolean;
  stats: GomokuAiStats;
}

export interface GomokuGameState {
  difficulty: GomokuDifficulty;
  history: GomokuMove[];
  lastError: string | null;
  lastExplain: GomokuAiExplain | null;
  lastStats: GomokuAiStats | null;
  requestId: number | null;
  status: GomokuStatus;
  winner: GomokuStone | null;
  winLine: GomokuPoint[];
}

export const gomokuDifficultyOptions = [
  { id: "legend", label: "宗师" },
  { id: "master", label: "天元" },
  { id: "strong", label: "高手" },
  { id: "fast", label: "极速" },
] as const satisfies readonly {
  id: GomokuDifficulty;
  label: string;
}[];

export const defaultGomokuDifficulty: GomokuDifficulty = "legend";

const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export function createEmptyGomokuGrid(): GomokuCell[][] {
  return Array.from({ length: GOMOKU_BOARD_SIZE }, () =>
    Array<GomokuCell>(GOMOKU_BOARD_SIZE).fill(GOMOKU_EMPTY),
  );
}

export function moveToTuple(move: GomokuMove): GomokuMoveTuple {
  return [move.x, move.y, move.color];
}

export function buildGomokuGrid(history: readonly GomokuMove[]): GomokuCell[][] {
  const grid = createEmptyGomokuGrid();

  for (const move of history) {
    if (
      isPointInsideGomokuBoard(move.x, move.y) &&
      grid[move.y][move.x] === GOMOKU_EMPTY
    ) {
      grid[move.y][move.x] = move.color;
    }
  }

  return grid;
}

export function isPointInsideGomokuBoard(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < GOMOKU_BOARD_SIZE && y < GOMOKU_BOARD_SIZE;
}

export function isLegalGomokuMove(
  grid: readonly (readonly GomokuCell[])[],
  x: number,
  y: number,
): boolean {
  return isPointInsideGomokuBoard(x, y) && grid[y][x] === GOMOKU_EMPTY;
}

export function getGomokuWinLine(
  grid: readonly (readonly GomokuCell[])[],
  x: number,
  y: number,
  color: GomokuStone,
): GomokuPoint[] {
  for (const [dx, dy] of directions) {
    const line: GomokuPoint[] = [{ x, y }];
    let nx = x + dx;
    let ny = y + dy;

    while (
      isPointInsideGomokuBoard(nx, ny) &&
      grid[ny][nx] === color
    ) {
      line.push({ x: nx, y: ny });
      nx += dx;
      ny += dy;
    }

    nx = x - dx;
    ny = y - dy;

    while (
      isPointInsideGomokuBoard(nx, ny) &&
      grid[ny][nx] === color
    ) {
      line.unshift({ x: nx, y: ny });
      nx -= dx;
      ny -= dy;
    }

    if (line.length >= 5) {
      return line;
    }
  }

  return [];
}

export function getWinnerFromHistory(
  history: readonly GomokuMove[],
): { winLine: GomokuPoint[]; winner: GomokuStone } | null {
  const lastMove = history.at(-1);

  if (!lastMove) {
    return null;
  }

  const grid = buildGomokuGrid(history);
  const winLine = getGomokuWinLine(
    grid,
    lastMove.x,
    lastMove.y,
    lastMove.color,
  );

  if (winLine.length < 5) {
    return null;
  }

  return {
    winLine,
    winner: lastMove.color,
  };
}

export function undoLastGomokuTurn(
  history: readonly GomokuMove[],
): GomokuMove[] {
  const nextHistory = history.slice();

  if (nextHistory.at(-1)?.color === GOMOKU_WHITE) {
    nextHistory.pop();
  }

  if (nextHistory.at(-1)?.color === GOMOKU_BLACK) {
    nextHistory.pop();
  }

  return nextHistory;
}

export function cycleGomokuDifficulty(
  difficulty: GomokuDifficulty,
): GomokuDifficulty {
  const index = gomokuDifficultyOptions.findIndex((item) => item.id === difficulty);
  const nextIndex =
    index < 0 ? 0 : (index + 1) % gomokuDifficultyOptions.length;

  return gomokuDifficultyOptions[nextIndex].id;
}

export function getGomokuDifficultyLabel(
  difficulty: GomokuDifficulty,
): string {
  return (
    gomokuDifficultyOptions.find((item) => item.id === difficulty)?.label ??
    "高手"
  );
}

export function getGomokuStoneLabel(color: GomokuStone): string {
  return color === GOMOKU_BLACK ? "黑棋" : "白棋";
}

export function getGomokuCoordName(x: number, y: number): string {
  let column = x;
  let label = "";

  while (column >= 0) {
    label = String.fromCharCode(65 + (column % 26)) + label;
    column = Math.floor(column / 26) - 1;
  }

  return `${label}${y + 1}`;
}

export function formatGomokuNodes(value: number | undefined): string {
  const nodes = Number(value || 0);

  if (nodes >= 1_000_000) {
    return `${(nodes / 1_000_000).toFixed(1)}M`;
  }

  if (nodes >= 1_000) {
    return `${(nodes / 1_000).toFixed(1)}K`;
  }

  return nodes ? String(nodes) : "--";
}

export function formatGomokuElapsed(value: number | undefined): string {
  const milliseconds = Number(value || 0);

  if (!milliseconds) {
    return "--";
  }

  return `${(milliseconds / 1000).toFixed(2)}s`;
}

export function boardPointToGomokuLocal(point: GomokuPoint): {
  x: number;
  z: number;
} {
  return {
    x: (point.x - GOMOKU_GRID_CENTER) * GOMOKU_GRID_CELL_SPACING,
    z: (point.y - GOMOKU_GRID_CENTER) * GOMOKU_GRID_CELL_SPACING,
  };
}

export function gomokuLocalToBoardPoint(
  localX: number,
  localZ: number,
): GomokuPoint | null {
  const x = Math.round(localX / GOMOKU_GRID_CELL_SPACING + GOMOKU_GRID_CENTER);
  const y = Math.round(localZ / GOMOKU_GRID_CELL_SPACING + GOMOKU_GRID_CENTER);

  if (!isPointInsideGomokuBoard(x, y)) {
    return null;
  }

  const snapped = boardPointToGomokuLocal({ x, y });
  const distance = Math.hypot(localX - snapped.x, localZ - snapped.z);

  if (distance > GOMOKU_GRID_HIT_RADIUS) {
    return null;
  }

  return { x, y };
}

function getNeighborCandidates(
  grid: readonly (readonly GomokuCell[])[],
  history: readonly GomokuMove[],
): GomokuPoint[] {
  if (history.length === 0) {
    return [{ x: Math.floor(GOMOKU_BOARD_SIZE / 2), y: Math.floor(GOMOKU_BOARD_SIZE / 2) }];
  }

  const seen = new Set<string>();
  const candidates: GomokuPoint[] = [];

  for (const move of history) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }

        const x = move.x + dx;
        const y = move.y + dy;
        const key = `${x},${y}`;

        if (!seen.has(key) && isLegalGomokuMove(grid, x, y)) {
          seen.add(key);
          candidates.push({ x, y });
        }
      }
    }
  }

  return candidates;
}

function quickLineScore(
  grid: readonly (readonly GomokuCell[])[],
  x: number,
  y: number,
  color: GomokuStone,
): number {
  let total = 0;

  for (const [dx, dy] of directions) {
    let count = 1;
    let open = 0;
    let nx = x + dx;
    let ny = y + dy;

    while (isPointInsideGomokuBoard(nx, ny) && grid[ny][nx] === color) {
      count += 1;
      nx += dx;
      ny += dy;
    }

    if (isPointInsideGomokuBoard(nx, ny) && grid[ny][nx] === GOMOKU_EMPTY) {
      open += 1;
    }

    nx = x - dx;
    ny = y - dy;

    while (isPointInsideGomokuBoard(nx, ny) && grid[ny][nx] === color) {
      count += 1;
      nx -= dx;
      ny -= dy;
    }

    if (isPointInsideGomokuBoard(nx, ny) && grid[ny][nx] === GOMOKU_EMPTY) {
      open += 1;
    }

    if (count >= 5) {
      total += 1_000_000;
    } else if (count === 4 && open === 2) {
      total += 120_000;
    } else if (count === 4 && open === 1) {
      total += 18_000;
    } else if (count === 3 && open === 2) {
      total += 7_000;
    } else if (count === 3 && open === 1) {
      total += 900;
    } else if (count === 2 && open === 2) {
      total += 260;
    } else if (count === 2 && open === 1) {
      total += 70;
    }
  }

  return total;
}

export function findImmediateGomokuWin(
  history: readonly GomokuMove[],
  color: GomokuStone,
): GomokuPoint | null {
  const grid = buildGomokuGrid(history);
  const candidates = getNeighborCandidates(grid, history).sort(
    (a, b) =>
      quickLineScore(grid, b.x, b.y, color) -
      quickLineScore(grid, a.x, a.y, color),
  );

  for (const candidate of candidates) {
    const nextGrid = grid.map((row) => row.slice());
    nextGrid[candidate.y][candidate.x] = color;

    if (
      getGomokuWinLine(nextGrid, candidate.x, candidate.y, color).length >= 5
    ) {
      return candidate;
    }
  }

  return null;
}

export function findFallbackGomokuMove(
  history: readonly GomokuMove[],
  color: GomokuStone,
): GomokuPoint | null {
  const win = findImmediateGomokuWin(history, color);

  if (win) {
    return win;
  }

  const opponent = color === GOMOKU_BLACK ? GOMOKU_WHITE : GOMOKU_BLACK;
  const block = findImmediateGomokuWin(history, opponent);

  if (block) {
    return block;
  }

  const grid = buildGomokuGrid(history);
  const center = Math.floor(GOMOKU_BOARD_SIZE / 2);
  const candidates = getNeighborCandidates(grid, history)
    .map((point) => ({
      point,
      score:
        quickLineScore(grid, point.x, point.y, color) * 1.3 +
        quickLineScore(grid, point.x, point.y, opponent) +
        Math.max(0, GOMOKU_BOARD_SIZE - Math.abs(point.x - center) - Math.abs(point.y - center)),
    }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.point ?? null;
}
