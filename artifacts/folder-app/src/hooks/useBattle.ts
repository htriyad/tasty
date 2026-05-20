import { useState, useEffect, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

export interface BattleScope {
  folderId?: number;
  setId?: number;
}

export type BattlePhase =
  | "lobby"
  | "searching"
  | "matched"
  | "countdown"
  | "playing"
  | "question_result"
  | "game_over";

export interface BattleQuestion {
  text: string;
  options: Array<{ letter: string; text: string }>;
  stemImages: string[];
}

export interface QuestionResultData {
  correctOption: string;
  yourAnswer: string | null;
  yourCorrect: boolean;
  opponentCorrect: boolean;
}

export interface GameOverData {
  winnerId: string | null;
  youWon: boolean;
  yourScore: number;
  opponentScore: number;
  yourRatingBefore: number;
  yourRatingAfter: number;
  opponentRatingBefore: number;
  opponentRatingAfter: number;
  isDraw: boolean;
}

export interface BattleState {
  phase: BattlePhase;
  battleId: number | null;
  yourRating: number;
  opponentName: string | null;
  opponentRating: number;
  yourScore: number;
  opponentScore: number;
  countdownSeconds: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: BattleQuestion | null;
  questionResult: QuestionResultData | null;
  gameOver: GameOverData | null;
  selectedOption: string | null;
  opponentAnswered: boolean;
  timeLimit: number;
  questionStartTime: number;
  error: string | null;
}

const initialState: BattleState = {
  phase: "lobby",
  battleId: null,
  yourRating: 1200,
  opponentName: null,
  opponentRating: 1200,
  yourScore: 0,
  opponentScore: 0,
  countdownSeconds: 3,
  currentQuestionIndex: 0,
  totalQuestions: 10,
  currentQuestion: null,
  questionResult: null,
  gameOver: null,
  selectedOption: null,
  opponentAnswered: false,
  timeLimit: 15000,
  questionStartTime: 0,
  error: null,
};

export function useBattle() {
  const [state, setState] = useState<BattleState>(initialState);
  const socketRef = useRef<Socket | null>(null);

  const update = useCallback((updates: Partial<BattleState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    const socket = io({
      path: "/api/socket.io",
      withCredentials: true,
      transports: ["polling", "websocket"],
    });
    socketRef.current = socket;

    socket.on("queue_joined", () => update({ phase: "searching", error: null }));

    socket.on("match_found", ({ battleId, opponent, yourRating }) => {
      update({
        phase: "matched", battleId, yourRating,
        opponentName: opponent.name, opponentRating: opponent.rating,
        yourScore: 0, opponentScore: 0,
        currentQuestionIndex: 0, questionResult: null, gameOver: null,
        selectedOption: null, opponentAnswered: false,
      });
    });

    socket.on("countdown", ({ seconds }) => update({ phase: "countdown", countdownSeconds: seconds }));

    socket.on("question", ({ index, total, question, timeLimit }) => {
      update({
        phase: "playing",
        currentQuestionIndex: index, totalQuestions: total,
        currentQuestion: question, timeLimit,
        questionStartTime: Date.now(),
        selectedOption: null, opponentAnswered: false, questionResult: null,
      });
    });

    socket.on("opponent_answered", () => update({ opponentAnswered: true }));

    socket.on("question_result", ({ correctOption, yourAnswer, yourCorrect, opponentCorrect, yourScore, opponentScore }) => {
      update({
        phase: "question_result",
        questionResult: { correctOption, yourAnswer, yourCorrect, opponentCorrect },
        yourScore, opponentScore,
      });
    });

    socket.on("game_over", (data) => {
      update({ phase: "game_over", gameOver: data, yourScore: data.yourScore, opponentScore: data.opponentScore });
    });

    socket.on("opponent_disconnected", () => update({ error: "Opponent disconnected" }));

    socket.on("error", ({ message }) => update({ error: message, phase: "lobby" }));

    socket.on("disconnect", () => {
      setState(prev => prev.phase !== "game_over" ? { ...prev, error: "Disconnected", phase: "lobby" } : prev);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [update]);

  const joinQueue = useCallback((scope?: BattleScope) => {
    socketRef.current?.emit("join_queue", scope ?? {});
    update({ phase: "searching", error: null });
  }, [update]);

  const joinBotQueue = useCallback((scope?: BattleScope) => {
    socketRef.current?.emit("join_bot_queue", scope ?? {});
    update({ phase: "searching", error: null });
  }, [update]);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit("leave_queue");
    update({ phase: "lobby" });
  }, [update]);

  const submitAnswer = useCallback((option: string) => {
    setState(prev => {
      if (!prev.battleId || prev.selectedOption || prev.phase !== "playing") return prev;
      socketRef.current?.emit("answer", { battleId: prev.battleId, questionIndex: prev.currentQuestionIndex, option });
      return { ...prev, selectedOption: option };
    });
  }, []);

  const playAgain = useCallback(() => setState({ ...initialState }), []);

  return { state, joinQueue, joinBotQueue, leaveQueue, submitAnswer, playAgain };
}
