import type {
  GomokuAiExplain,
  GomokuAiStats,
  GomokuAiWorkerRequest,
  GomokuAiWorkerResponse,
  GomokuDifficulty,
  GomokuMoveTuple,
  GomokuStone,
} from "./gomokuGame";

export {};

const BOARD_SIZE = 25;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const INF = 1e15;
const WIN = 10_000_000;

type WorkerCell = 0 | 1 | 2;
type WorkerMove = [number, number];
type PatternKind = "five" | "live4" | "rush4" | "live3" | "sleep3";

interface ThreatProfile {
  five: number;
  live3: number;
  live4: number;
  rank: number;
  rush4: number;
  sleep3: number;
}

interface LevelConfig {
  depth: number;
  label: string;
  reduceAfter: number;
  time: number;
  width: number;
}

const RANK = {
  FIVE: 700,
  LIVE4: 660,
  DOUBLE4: 640,
  FOUR3: 620,
  DOUBLE3: 560,
  RUSH4: 500,
  LIVE3: 300,
} as const;

const PATTERNS = [
  ["11111", "five"],
  ["011110", "live4"],
  ["011112", "rush4"],
  ["211110", "rush4"],
  ["11011", "rush4"],
  ["10111", "rush4"],
  ["11101", "rush4"],
  ["01110", "live3"],
  ["010110", "live3"],
  ["011010", "live3"],
  ["001112", "sleep3"],
  ["211100", "sleep3"],
  ["010112", "sleep3"],
  ["211010", "sleep3"],
  ["011012", "sleep3"],
  ["210110", "sleep3"],
  ["10011", "sleep3"],
  ["11001", "sleep3"],
  ["10101", "sleep3"],
] as const satisfies readonly (readonly [string, PatternKind])[];

const LEVELS = {
  fast: { label: "极速", depth: 2, time: 220, width: 7, reduceAfter: 4 },
  strong: { label: "高手", depth: 3, time: 650, width: 10, reduceAfter: 5 },
  master: { label: "天元", depth: 4, time: 1050, width: 12, reduceAfter: 6 },
  legend: { label: "宗师", depth: 5, time: 1600, width: 14, reduceAfter: 7 },
} as const satisfies Record<GomokuDifficulty, LevelConfig>;

const directions = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

let grid: WorkerCell[][] = [];
let history: GomokuMoveTuple[] = [];
let aiStats: GomokuAiStats = {};
let boardHash = 0;
let tt = new Map<string, number>();

function resetBoard(snapshot: readonly GomokuMoveTuple[] = []): void {
  grid = Array.from({ length: BOARD_SIZE }, () =>
    Array<WorkerCell>(BOARD_SIZE).fill(EMPTY),
  );
  history = [];
  boardHash = 0;

  for (const item of snapshot) {
    const [x, y, color] = item;

    if (
      x >= 0 &&
      y >= 0 &&
      x < BOARD_SIZE &&
      y < BOARD_SIZE &&
      grid[y][x] === EMPTY
    ) {
      grid[y][x] = color;
      history.push([x, y, color]);
      boardHash = (boardHash ^ hashStone(x, y, color)) >>> 0;
    }
  }
}

function hashStone(x: number, y: number, color: GomokuStone): number {
  return (
    Math.imul(x + 1, 73_856_093) ^
    Math.imul(y + 1, 19_349_663) ^
    Math.imul(color, 83_492_791)
  ) >>> 0;
}

function other(color: GomokuStone): GomokuStone {
  return color === BLACK ? WHITE : BLACK;
}

function isValid(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE && grid[y][x] === EMPTY;
}

function placeMove(x: number, y: number, color: GomokuStone): boolean {
  if (!isValid(x, y)) {
    return false;
  }

  grid[y][x] = color;
  history.push([x, y, color]);
  boardHash = (boardHash ^ hashStone(x, y, color)) >>> 0;
  return true;
}

function undoMove(): void {
  const move = history.pop();

  if (!move) {
    return;
  }

  grid[move[1]][move[0]] = EMPTY;
  boardHash = (boardHash ^ hashStone(move[0], move[1], move[2])) >>> 0;
}

function checkWin(x: number, y: number, color: GomokuStone): boolean {
  for (const [dx, dy] of directions) {
    const count =
      1 +
      countDir(x, y, dx, dy, color) +
      countDir(x, y, -dx, -dy, color);

    if (count >= 5) {
      return true;
    }
  }

  return false;
}

function countDir(
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: GomokuStone,
): number {
  let count = 0;
  let nx = x + dx;
  let ny = y + dy;

  while (
    nx >= 0 &&
    ny >= 0 &&
    nx < BOARD_SIZE &&
    ny < BOARD_SIZE &&
    grid[ny][nx] === color
  ) {
    count += 1;
    nx += dx;
    ny += dy;
  }

  return count;
}

function countLineFast(
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: GomokuStone,
): [number, number] {
  let count = 1;
  let open = 0;
  let nx = x + dx;
  let ny = y + dy;

  while (
    nx >= 0 &&
    ny >= 0 &&
    nx < BOARD_SIZE &&
    ny < BOARD_SIZE &&
    grid[ny][nx] === color
  ) {
    count += 1;
    nx += dx;
    ny += dy;
  }

  if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE && grid[ny][nx] === EMPTY) {
    open += 1;
  }

  nx = x - dx;
  ny = y - dy;

  while (
    nx >= 0 &&
    ny >= 0 &&
    nx < BOARD_SIZE &&
    ny < BOARD_SIZE &&
    grid[ny][nx] === color
  ) {
    count += 1;
    nx -= dx;
    ny -= dy;
  }

  if (nx >= 0 && ny >= 0 && nx < BOARD_SIZE && ny < BOARD_SIZE && grid[ny][nx] === EMPTY) {
    open += 1;
  }

  return [Math.min(count, 5), open];
}

function directionHits(
  x: number,
  y: number,
  dx: number,
  dy: number,
  color: GomokuStone,
): Record<PatternKind, number> {
  const radius = 5;
  const center = radius;
  let line = "";

  for (let step = -radius; step <= radius; step += 1) {
    const nx = x + dx * step;
    const ny = y + dy * step;

    if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) {
      line += "2";
    } else {
      const value = grid[ny][nx];
      line += value === EMPTY ? "0" : value === color ? "1" : "2";
    }
  }

  const hits: Record<PatternKind, number> = {
    five: 0,
    live4: 0,
    rush4: 0,
    live3: 0,
    sleep3: 0,
  };

  for (const [pattern, kind] of PATTERNS) {
    const length = pattern.length;

    for (let start = 0; start + length <= line.length; start += 1) {
      if (
        start <= center &&
        center < start + length &&
        line.slice(start, start + length) === pattern
      ) {
        hits[kind] = 1;
        break;
      }
    }

    if (hits.five) {
      break;
    }
  }

  return hits;
}

function emptyThreatProfile(): ThreatProfile {
  return { rank: 0, five: 0, live4: 0, rush4: 0, live3: 0, sleep3: 0 };
}

function threatProfile(x: number, y: number, color: GomokuStone): ThreatProfile {
  if (!isValid(x, y)) {
    return emptyThreatProfile();
  }

  grid[y][x] = color;
  let five = 0;
  let live4 = 0;
  let rush4 = 0;
  let live3 = 0;
  let sleep3 = 0;

  for (const [dx, dy] of directions) {
    const hits = directionHits(x, y, dx, dy, color);
    five += hits.five;
    live4 += hits.live4;
    rush4 += hits.rush4;
    live3 += hits.live3;
    sleep3 += hits.sleep3;
  }

  grid[y][x] = EMPTY;
  let rank = 0;

  if (five) {
    rank = RANK.FIVE;
  } else if (live4) {
    rank = RANK.LIVE4;
  } else if (rush4 >= 2) {
    rank = RANK.DOUBLE4;
  } else if (rush4 >= 1 && live3 >= 1) {
    rank = RANK.FOUR3;
  } else if (live3 >= 2) {
    rank = RANK.DOUBLE3;
  } else if (rush4 >= 1) {
    rank = RANK.RUSH4;
  } else if (live3 >= 1) {
    rank = RANK.LIVE3;
  }

  return { rank, five, live4, rush4, live3, sleep3 };
}

function profileScore(profile: ThreatProfile | null): number {
  const rank = profile?.rank ?? 0;

  if (rank >= RANK.FIVE) return WIN;
  if (rank >= RANK.LIVE4) return 1_000_000;
  if (rank >= RANK.DOUBLE4) return 900_000;
  if (rank >= RANK.FOUR3) return 760_000;
  if (rank >= RANK.DOUBLE3) return 260_000;
  if (rank >= RANK.RUSH4) return 85_000;
  if (rank >= RANK.LIVE3) return 18_000;
  return 0;
}

function quickScore(x: number, y: number, color: GomokuStone): number {
  if (!isValid(x, y)) {
    return 0;
  }

  grid[y][x] = color;
  let total = 0;

  for (const [dx, dy] of directions) {
    const [count, open] = countLineFast(x, y, dx, dy, color);

    if (count >= 5) total += 1_000_000;
    else if (count === 4 && open === 2) total += 120_000;
    else if (count === 4 && open === 1) total += 18_000;
    else if (count === 3 && open === 2) total += 7_000;
    else if (count === 3 && open === 1) total += 900;
    else if (count === 2 && open === 2) total += 260;
    else if (count === 2 && open === 1) total += 70;
  }

  grid[y][x] = EMPTY;
  return total;
}

function parseCandidateKey(key: string): WorkerMove {
  const [x, y] = key.split(",").map(Number);

  return [x, y];
}

function neighbors(): WorkerMove[] {
  if (!history.length) {
    const center = Math.floor(BOARD_SIZE / 2);

    return [[center, center]];
  }

  const set = new Set<string>();

  for (const [x, y] of history) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        if (!dx && !dy) {
          continue;
        }

        const nx = x + dx;
        const ny = y + dy;

        if (isValid(nx, ny)) {
          set.add(`${nx},${ny}`);
        }
      }
    }
  }

  return Array.from(set, parseCandidateKey);
}

function moveScore(x: number, y: number, color: GomokuStone): number {
  const opponent = other(color);
  const selfProfile = threatProfile(x, y, color);
  const opponentProfile = threatProfile(x, y, opponent);
  const center = Math.floor(BOARD_SIZE / 2);
  const centerPull = BOARD_SIZE - Math.abs(x - center) - Math.abs(y - center);
  const last = history.at(-1);
  const lastPull = last ? Math.max(0, 10 - Math.abs(x - last[0]) - Math.abs(y - last[1])) : 0;

  return (
    selfProfile.rank * 2_200_000 +
    opponentProfile.rank * 2_350_000 +
    quickScore(x, y, color) * 4.5 +
    quickScore(x, y, opponent) * 3.8 +
    centerPull * 28 +
    lastPull * 48
  );
}

function candidates(color: GomokuStone, width: number): WorkerMove[] {
  const scored = neighbors()
    .map(([x, y]) => [moveScore(x, y, color), x, y] as const)
    .sort((a, b) => b[0] - a[0]);
  const protectedMoves: WorkerMove[] = [];
  const opponent = other(color);

  for (const [, x, y] of scored) {
    if (
      threatProfile(x, y, color).rank >= RANK.LIVE3 ||
      threatProfile(x, y, opponent).rank >= RANK.LIVE3
    ) {
      protectedMoves.push([x, y]);
    }
  }

  const out: WorkerMove[] = [];
  const seen = new Set<string>();
  const topMoves = scored.slice(0, width).map((item) => [item[1], item[2]] as WorkerMove);

  for (const move of protectedMoves.concat(topMoves)) {
    const key = `${move[0]},${move[1]}`;

    if (!seen.has(key)) {
      seen.add(key);
      out.push(move);
    }

    if (out.length >= width + 10) {
      break;
    }
  }

  return out;
}

function immediateWin(color: GomokuStone): WorkerMove | null {
  const all = neighbors().sort(
    (a, b) => quickScore(b[0], b[1], color) - quickScore(a[0], a[1], color),
  );

  for (const [x, y] of all) {
    placeMove(x, y, color);
    const win = checkWin(x, y, color);
    undoMove();

    if (win) {
      return [x, y];
    }
  }

  return null;
}

function bestForcing(
  color: GomokuStone,
  minRank: number,
): [WorkerMove | null, ThreatProfile | null] {
  let best: WorkerMove | null = null;
  let bestProfile: ThreatProfile | null = null;
  let bestScore = -INF;
  const opponent = other(color);

  for (const [x, y] of neighbors()) {
    const profile = threatProfile(x, y, color);

    if (profile.rank < minRank) {
      continue;
    }

    const score =
      profile.rank * 1_000_000 +
      quickScore(x, y, color) * 4 +
      quickScore(x, y, opponent) * 2;

    if (score > bestScore) {
      bestScore = score;
      best = [x, y];
      bestProfile = profile;
    }
  }

  return [best, bestProfile];
}

function candidateSafety(move: WorkerMove, color: GomokuStone): number {
  const opponent = other(color);
  placeMove(move[0], move[1], color);
  let penalty = 0;

  if (immediateWin(opponent)) {
    penalty += WIN * 1.2;
  }

  const [, opponentForce] = bestForcing(opponent, RANK.FOUR3);
  const [, opponentPressure] = bestForcing(opponent, RANK.DOUBLE3);
  penalty += profileScore(opponentForce) * 1.25;
  penalty += profileScore(opponentPressure) * 0.9;
  undoMove();
  return penalty;
}

function evaluate(color: GomokuStone): number {
  const opponent = other(color);
  let self = 0;
  let enemy = 0;

  for (const [x, y] of neighbors()) {
    const selfProfile = threatProfile(x, y, color);
    const enemyProfile = threatProfile(x, y, opponent);
    self += profileScore(selfProfile) * 0.56 + quickScore(x, y, color) * 1.45;
    enemy += profileScore(enemyProfile) * 0.82 + quickScore(x, y, opponent) * 2.05;

    if (enemyProfile.rank >= RANK.FOUR3) {
      enemy += 520_000;
    }

    if (selfProfile.rank >= RANK.FOUR3) {
      self += 360_000;
    }
  }

  return self - enemy;
}

function terminalScore(colorToMove: GomokuStone): number | null {
  const last = history.at(-1);

  if (!last || !checkWin(last[0], last[1], last[2])) {
    return null;
  }

  return last[2] === colorToMove ? WIN : -WIN;
}

function negamax(
  depth: number,
  alphaInput: number,
  beta: number,
  color: GomokuStone,
  deadline: number,
  width: number,
  reduceAfter: number,
): number {
  let alpha = alphaInput;
  aiStats.nodes = (aiStats.nodes ?? 0) + 1;

  if (((aiStats.nodes ?? 0) & 127) === 0 && performance.now() > deadline) {
    throw new Error("timeout");
  }

  const terminal = terminalScore(color);

  if (terminal !== null) {
    return terminal;
  }

  if (depth <= 0) {
    return evaluate(color);
  }

  const key = `${color}:${depth}:${boardHash}`;
  const cached = tt.get(key);

  if (cached !== undefined) {
    aiStats.cacheHits = (aiStats.cacheHits ?? 0) + 1;
    return cached;
  }

  const win = immediateWin(color);

  if (win) {
    return WIN - (10 - depth);
  }

  const moves = candidates(color, Math.max(6, width - (depth >= 3 ? 3 : 0)));
  let best = -INF;
  const opponent = other(color);
  let searched = 0;
  let cut = false;

  for (const move of moves) {
    const rank = Math.max(
      threatProfile(move[0], move[1], color).rank,
      threatProfile(move[0], move[1], opponent).rank,
    );
    const reduction =
      searched >= reduceAfter && depth >= 3 && rank < RANK.LIVE3 ? 1 : 0;

    placeMove(move[0], move[1], color);
    const value = -negamax(
      depth - 1 - reduction,
      -beta,
      -alpha,
      opponent,
      deadline,
      width,
      reduceAfter,
    );
    undoMove();
    searched += 1;

    if (value > best) {
      best = value;
    }

    if (best > alpha) {
      alpha = best;
    }

    if (alpha >= beta) {
      cut = true;
      break;
    }
  }

  if (!cut) {
    if (tt.size > 30_000) {
      tt.clear();
    }

    tt.set(key, best);
  }

  return best;
}

function openingMove(): WorkerMove | null {
  if (history.length !== 1) {
    return null;
  }

  const [x, y] = history[0];
  const offsets = [
    [1, 1],
    [1, 0],
    [0, 1],
    [-1, 1],
    [1, -1],
    [-1, 0],
    [0, -1],
    [-1, -1],
    [2, 0],
    [0, 2],
  ] as const;

  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;

    if (isValid(nx, ny)) {
      return [nx, ny];
    }
  }

  return null;
}

function localAiMove(
  color: GomokuStone,
  difficulty: GomokuDifficulty,
): WorkerMove | null {
  const level = LEVELS[difficulty] || LEVELS.strong;
  const start = performance.now();
  const deadline = start + level.time;
  tt = new Map();
  aiStats = {
    nodes: 0,
    cacheHits: 0,
    depth: 0,
    gate: "",
    elapsed: 0,
    source: "worker",
    difficulty: level.label,
  };
  const opponent = other(color);

  if (!history.length) {
    const center = Math.floor(BOARD_SIZE / 2);

    return [center, center];
  }

  const win = immediateWin(color);

  if (win) {
    aiStats.gate = "win";
    aiStats.elapsed = performance.now() - start;
    return win;
  }

  const block = immediateWin(opponent);

  if (block) {
    aiStats.gate = "block";
    aiStats.elapsed = performance.now() - start;
    return block;
  }

  const book = openingMove();

  if (book) {
    aiStats.gate = "book";
    aiStats.elapsed = performance.now() - start;
    return book;
  }

  const [ownForce, ownForceProfile] = bestForcing(color, RANK.FOUR3);
  const [opponentForce, opponentForceProfile] = bestForcing(opponent, RANK.FOUR3);

  if (
    ownForce &&
    (!opponentForceProfile ||
      (ownForceProfile?.rank ?? 0) >= opponentForceProfile.rank ||
      (ownForceProfile?.rank ?? 0) >= RANK.LIVE4)
  ) {
    aiStats.gate = "force";
    aiStats.elapsed = performance.now() - start;
    return ownForce;
  }

  if (opponentForce) {
    aiStats.gate = "defense";
    aiStats.elapsed = performance.now() - start;
    return opponentForce;
  }

  if (ownForce) {
    aiStats.gate = "force";
    aiStats.elapsed = performance.now() - start;
    return ownForce;
  }

  const [ownPressure] = bestForcing(color, RANK.DOUBLE3);
  const [opponentPressure] = bestForcing(opponent, RANK.DOUBLE3);

  if (ownPressure && !opponentPressure) {
    aiStats.gate = "pressure";
    aiStats.elapsed = performance.now() - start;
    return ownPressure;
  }

  if (opponentPressure) {
    aiStats.gate = "anti-pressure";
    aiStats.elapsed = performance.now() - start;
    return opponentPressure;
  }

  let bestMove = candidates(color, level.width)[0] ?? null;
  let bestScore = -INF;

  for (let depth = 1; depth <= level.depth; depth += 1) {
    try {
      const moves = candidates(color, level.width + (depth >= 4 ? 1 : 0));
      let depthBest = bestMove;
      let depthScore = -INF;
      let alpha = -INF;
      const beta = INF;

      for (const move of moves) {
        placeMove(move[0], move[1], color);
        const score = -negamax(
          depth - 1,
          -beta,
          -alpha,
          opponent,
          deadline,
          level.width,
          level.reduceAfter,
        );
        undoMove();

        const safety = candidateSafety(move, color);
        const finalScore = score - safety * (difficulty === "legend" ? 1.1 : 0.9);

        if (finalScore > depthScore) {
          depthScore = finalScore;
          depthBest = move;
        }

        alpha = Math.max(alpha, score);

        if (performance.now() > deadline) {
          throw new Error("timeout");
        }
      }

      bestMove = depthBest;
      bestScore = depthScore;
      aiStats.depth = depth;
    } catch {
      aiStats.gate = aiStats.gate || "timeout";
      break;
    }
  }

  const safety = bestMove ? candidateSafety(bestMove, color) : 0;

  if (safety >= 85_000) {
    const safe = candidates(color, level.width + 6)
      .map((move) => ({
        move,
        safety: candidateSafety(move, color),
        score: -moveScore(move[0], move[1], color),
      }))
      .sort((a, b) => a.safety - b.safety || a.score - b.score)[0];

    if (safe) {
      bestMove = safe.move;
      aiStats.gate = "safe";
    }
  }

  aiStats.elapsed = performance.now() - start;
  aiStats.score = Math.round(bestScore);
  return bestMove;
}

function coordName(x: number, y: number): string {
  let column = x;
  let label = "";

  while (column >= 0) {
    label = String.fromCharCode(65 + (column % 26)) + label;
    column = Math.floor(column / 26) - 1;
  }

  return `${label}${y + 1}`;
}

function formatNodes(value: number | undefined): string {
  const nodes = Number(value || 0);

  if (nodes >= 1_000_000) return `${(nodes / 1_000_000).toFixed(1)}M`;
  if (nodes >= 1_000) return `${(nodes / 1_000).toFixed(1)}K`;
  return nodes ? String(nodes) : "--";
}

function gateInfo(gate: string | undefined): [string, string, string] {
  const table: Record<string, [string, string, string]> = {
    win: ["一手制胜", "AI 发现自己可以立即连五，因此跳过深层搜索直接落子。", "终局检测"],
    block: ["必须防守", "对手存在下一手连五威胁，本步优先封堵胜点。", "必防优先"],
    book: ["开局定式", "AI 使用轻量开局库，先占据贴近首手的高弹性位置。", "开局知识"],
    force: ["强制进攻", "AI 找到四三或更强的进攻点，迫使对手进入防守。", "威胁搜索"],
    defense: ["防守强制线", "对手存在强迫性组合威胁，AI 先化解危险。", "威胁搜索"],
    pressure: ["双三压力", "当前局面适合制造双三压力，扩大后续候选优势。", "组合棋型"],
    "anti-pressure": ["解除双三", "对手可形成双三，AI 选择先消除该战术点。", "组合棋型"],
    safe: ["安全修正", "初选落点会给对手较强反击，AI 改选更稳的候选点。", "安全过滤"],
    timeout: ["限时决策", "AI 在移动端时间预算内返回当前最优结果，保证界面流畅。", "迭代加深"],
    fallback: ["本地兜底", "后台 Worker 不可用时，使用轻量策略保证可玩。", "降级策略"],
  };

  return (
    table[gate || ""] ??
    ["Alpha-Beta 搜索", "AI 根据候选点排序、局面评估和剪枝结果选择本手。", "Minimax / Alpha-Beta"]
  );
}

function makeExplain(
  move: WorkerMove | null,
  color: GomokuStone,
  difficulty: GomokuDifficulty,
): GomokuAiExplain {
  const info = gateInfo(aiStats.gate);
  const moveText = move ? coordName(move[0], move[1]) : "--";
  const level = LEVELS[difficulty] || LEVELS.strong;
  const topMoves: { move: string; score: string }[] = [];

  try {
    for (const [index, moveCandidate] of candidates(
      color,
      Math.min(level.width, 5),
    ).slice(0, 3).entries()) {
      topMoves.push({
        move: coordName(moveCandidate[0], moveCandidate[1]),
        score: index === 0 ? "主线" : "备选",
      });
    }
  } catch {
    // Explanation candidates are best-effort and must not fail the AI move.
  }

  return {
    title: `${info[0]} · ${moveText}`,
    reason: `${info[1]} ${level.label}模式搜索深度 D${aiStats.depth || 0}，节点 ${formatNodes(aiStats.nodes)}。`,
    knowledgePoint: info[2],
    topMoves,
  };
}

function isWorkerRequest(value: unknown): value is GomokuAiWorkerRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const request = value as Partial<GomokuAiWorkerRequest>;

  return typeof request.id === "number" && Array.isArray(request.snapshot);
}

const workerScope = self as unknown as {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ) => void;
  postMessage: (message: GomokuAiWorkerResponse) => void;
};

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isWorkerRequest(event.data)) {
    return;
  }

  const { id, snapshot, color, difficulty } = event.data;

  try {
    resetBoard(snapshot);
    const aiColor = color || WHITE;
    const level = difficulty || "strong";
    const move = localAiMove(aiColor, level);
    const explain = makeExplain(move, aiColor, level);
    const response: GomokuAiWorkerResponse = {
      id,
      ok: true,
      move,
      stats: aiStats,
      explain,
    };

    workerScope.postMessage(response);
  } catch (error) {
    const response: GomokuAiWorkerResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      move: null,
      stats: aiStats,
      explain: null,
    };

    workerScope.postMessage(response);
  }
});
