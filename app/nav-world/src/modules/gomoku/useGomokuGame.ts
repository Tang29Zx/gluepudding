import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildGomokuGrid,
  cycleGomokuDifficulty,
  defaultGomokuDifficulty,
  findFallbackGomokuMove,
  formatGomokuElapsed,
  formatGomokuNodes,
  getGomokuCoordName,
  getGomokuDifficultyLabel,
  getGomokuStoneLabel,
  getWinnerFromHistory,
  GOMOKU_BLACK,
  GOMOKU_WHITE,
  isLegalGomokuMove,
  moveToTuple,
  undoLastGomokuTurn,
  type GomokuAiExplain,
  type GomokuAiStats,
  type GomokuAiWorkerRequest,
  type GomokuAiWorkerResponse,
  type GomokuCell,
  type GomokuGameState,
  type GomokuMove,
  type GomokuPoint,
} from "./gomokuGame";

const aiTimeoutMs = 4_500;

interface UseGomokuGameOptions {
  onMessage: (message: string) => void;
}

interface UseGomokuGameResult {
  cycleDifficulty: () => string;
  grid: GomokuCell[][];
  playPlayerMove: (point: GomokuPoint) => boolean;
  restart: () => string;
  state: GomokuGameState;
  statusText: string;
  statsText: string;
  undo: () => string;
}

function createInitialGameState(): GomokuGameState {
  return {
    difficulty: defaultGomokuDifficulty,
    history: [],
    lastError: null,
    lastExplain: null,
    lastStats: null,
    requestId: null,
    status: "player",
    winner: null,
    winLine: [],
  };
}

function createFallbackExplain(
  move: GomokuPoint | null,
  stats: GomokuAiStats,
): GomokuAiExplain {
  return {
    title: `本地兜底 · ${move ? getGomokuCoordName(move.x, move.y) : "--"}`,
    reason: "后台 Worker 暂不可用，已使用轻量策略继续对弈。",
    knowledgePoint: stats.gate === "timeout" ? "超时降级" : "降级策略",
    topMoves: move ? [{ move: getGomokuCoordName(move.x, move.y), score: "兜底" }] : [],
  };
}

function isValidAiResponse(value: unknown): value is GomokuAiWorkerResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Partial<GomokuAiWorkerResponse>;

  return typeof response.id === "number" && typeof response.ok === "boolean";
}

function createAiWorker(): Worker | null {
  if (typeof window === "undefined" || !("Worker" in window)) {
    return null;
  }

  try {
    return new Worker(new URL("./gomokuAiWorker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return null;
  }
}

function getFallbackResponse(
  history: readonly GomokuMove[],
  gate: "fallback" | "timeout",
): GomokuAiWorkerResponse {
  const move = findFallbackGomokuMove(history, GOMOKU_WHITE);
  const stats: GomokuAiStats = {
    depth: 0,
    elapsed: 0,
    gate,
    nodes: 0,
    source: "main",
  };

  return {
    id: -1,
    ok: Boolean(move),
    move: move ? [move.x, move.y] : null,
    stats,
    explain: createFallbackExplain(move, stats),
  };
}

function getStateAfterHistory(
  history: GomokuMove[],
  base: GomokuGameState,
): GomokuGameState {
  const winner = getWinnerFromHistory(history);

  if (winner) {
    return {
      ...base,
      history,
      requestId: null,
      status: "terminal",
      winner: winner.winner,
      winLine: winner.winLine,
    };
  }

  return {
    ...base,
    history,
    requestId: null,
    status: "player",
    winner: null,
    winLine: [],
  };
}

export function getGomokuStatusText(state: GomokuGameState): string {
  if (state.status === "thinking") {
    return "AI 思考中";
  }

  if (state.status === "error") {
    return "棋局错误，已保留当前局面";
  }

  if (state.status === "terminal" && state.winner) {
    return `${getGomokuStoneLabel(state.winner)}胜`;
  }

  return "黑棋回合";
}

export function getGomokuStatsText(state: GomokuGameState): string {
  if (state.lastError) {
    return state.lastError;
  }

  const stats = state.lastStats;

  if (!stats) {
    return `AI 强度：${getGomokuDifficultyLabel(state.difficulty)}`;
  }

  return `${stats.difficulty || getGomokuDifficultyLabel(state.difficulty)} D${stats.depth || 0} N${formatGomokuNodes(stats.nodes)} ${formatGomokuElapsed(stats.elapsed)} ${stats.gate || ""}`.trim();
}

export function useGomokuGame({
  onMessage,
}: UseGomokuGameOptions): UseGomokuGameResult {
  const [state, setState] = useState<GomokuGameState>(createInitialGameState);
  const stateRef = useRef(state);
  const onMessageRef = useRef(onMessage);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const grid = useMemo(() => buildGomokuGrid(state.history), [state.history]);

  const requestAiMove = useCallback((
    history: readonly GomokuMove[],
    requestId: number,
  ): Promise<GomokuAiWorkerResponse> => {
    const worker = workerRef.current ?? createAiWorker();
    workerRef.current = worker;

    if (!worker) {
      return Promise.resolve(getFallbackResponse(history, "fallback"));
    }

    const request: GomokuAiWorkerRequest = {
      id: requestId,
      snapshot: history.map(moveToTuple),
      color: GOMOKU_WHITE,
      difficulty: stateRef.current.difficulty,
    };

    return new Promise((resolve) => {
      const cleanup = () => {
        clearTimeout(timeout);
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
      };
      const finish = (response: GomokuAiWorkerResponse) => {
        cleanup();
        resolve(response);
      };
      const handleMessage = (event: MessageEvent<unknown>) => {
        if (!isValidAiResponse(event.data) || event.data.id !== requestId) {
          return;
        }

        finish(event.data);
      };
      const handleError = () => {
        workerRef.current?.terminate();
        workerRef.current = null;
        finish(getFallbackResponse(history, "fallback"));
      };
      const timeout = window.setTimeout(() => {
        finish(getFallbackResponse(history, "timeout"));
      }, aiTimeoutMs);

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage(request);
    });
  }, []);

  const playPlayerMove = useCallback((point: GomokuPoint): boolean => {
    const current = stateRef.current;

    if (current.status === "thinking") {
      onMessageRef.current("AI 正在思考，请稍等。");
      return false;
    }

    if (current.status === "terminal") {
      onMessageRef.current("棋局已经结束，点击重开开始新局。");
      return false;
    }

    const currentGrid = buildGomokuGrid(current.history);

    if (!isLegalGomokuMove(currentGrid, point.x, point.y)) {
      onMessageRef.current("这里已经有棋子了。");
      return false;
    }

    const blackMove: GomokuMove = {
      ...point,
      color: GOMOKU_BLACK,
    };
    const historyAfterBlack = current.history.concat(blackMove);
    const winnerAfterBlack = getWinnerFromHistory(historyAfterBlack);

    if (winnerAfterBlack) {
      const nextState: GomokuGameState = {
        ...current,
        history: historyAfterBlack,
        lastError: null,
        lastExplain: {
          title: `黑棋胜利 · ${getGomokuCoordName(point.x, point.y)}`,
          reason: "玩家完成五连，当前局面已经终局。",
          knowledgePoint: "终局检测",
          topMoves: [{ move: getGomokuCoordName(point.x, point.y), score: "五连" }],
        },
        lastStats: null,
        requestId: null,
        status: "terminal",
        winner: winnerAfterBlack.winner,
        winLine: winnerAfterBlack.winLine,
      };

      setState(nextState);
      stateRef.current = nextState;
      onMessageRef.current("黑棋胜利。点击重开可再来一局。");
      return true;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const thinkingState: GomokuGameState = {
      ...current,
      history: historyAfterBlack,
      lastError: null,
      requestId,
      status: "thinking",
      winner: null,
      winLine: [],
    };

    setState(thinkingState);
    stateRef.current = thinkingState;
    onMessageRef.current(
      `黑棋落在 ${getGomokuCoordName(point.x, point.y)}，AI 思考中。`,
    );

    void requestAiMove(historyAfterBlack, requestId).then((response) => {
      const latest = stateRef.current;

      if (latest.status !== "thinking" || latest.requestId !== requestId) {
        return;
      }

      const fallbackMove = findFallbackGomokuMove(latest.history, GOMOKU_WHITE);
      const aiPoint = response.move
        ? { x: response.move[0], y: response.move[1] }
        : fallbackMove;
      const latestGrid = buildGomokuGrid(latest.history);

      if (!aiPoint || !isLegalGomokuMove(latestGrid, aiPoint.x, aiPoint.y)) {
        const errorState: GomokuGameState = {
          ...latest,
          lastError: response.error ?? "AI 没有返回合法落点。",
          lastStats: response.stats,
          requestId: null,
          status: "error",
        };

        setState(errorState);
        stateRef.current = errorState;
        onMessageRef.current("AI 暂时没有返回合法落点，棋局已暂停。");
        return;
      }

      const whiteMove: GomokuMove = {
        ...aiPoint,
        color: GOMOKU_WHITE,
      };
      const historyAfterWhite = latest.history.concat(whiteMove);
      const winnerAfterWhite = getWinnerFromHistory(historyAfterWhite);
      const nextState: GomokuGameState = {
        ...latest,
        history: historyAfterWhite,
        lastError: response.ok ? null : response.error ?? null,
        lastExplain: response.explain,
        lastStats: response.stats,
        requestId: null,
        status: winnerAfterWhite ? "terminal" : "player",
        winner: winnerAfterWhite?.winner ?? null,
        winLine: winnerAfterWhite?.winLine ?? [],
      };

      setState(nextState);
      stateRef.current = nextState;
      onMessageRef.current(
        winnerAfterWhite
          ? `白棋在 ${getGomokuCoordName(aiPoint.x, aiPoint.y)} 完成五连。`
          : `AI 落在 ${getGomokuCoordName(aiPoint.x, aiPoint.y)}，轮到黑棋。`,
      );
    });

    return true;
  }, [requestAiMove]);

  const undo = useCallback(() => {
    const current = stateRef.current;

    if (current.status === "thinking") {
      return "AI 正在思考，暂时不能悔棋。";
    }

    if (current.history.length === 0) {
      return "当前没有可以悔的棋。";
    }

    const history = undoLastGomokuTurn(current.history);
    const nextState = getStateAfterHistory(history, {
      ...current,
      lastError: null,
      lastExplain: null,
      lastStats: null,
    });

    setState(nextState);
    stateRef.current = nextState;
    return "已悔棋，轮到黑棋。";
  }, []);

  const restart = useCallback(() => {
    const nextState = createInitialGameState();
    nextState.difficulty = stateRef.current.difficulty;
    setState(nextState);
    stateRef.current = nextState;
    return "新棋局已开始，玩家执黑先行。";
  }, []);

  const cycleDifficulty = useCallback(() => {
    const current = stateRef.current;

    if (current.status === "thinking") {
      return "AI 正在思考，稍后再切换强度。";
    }

    const nextDifficulty = cycleGomokuDifficulty(current.difficulty);
    const nextState: GomokuGameState = {
      ...current,
      difficulty: nextDifficulty,
      lastError: null,
    };

    setState(nextState);
    stateRef.current = nextState;
    return `AI 强度已切换为：${getGomokuDifficultyLabel(nextDifficulty)}。`;
  }, []);

  return {
    cycleDifficulty,
    grid,
    playPlayerMove,
    restart,
    state,
    statusText: getGomokuStatusText(state),
    statsText: getGomokuStatsText(state),
    undo,
  };
}
