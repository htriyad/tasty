import { useState, useEffect, useRef, useCallback } from "react";
import type { Socket } from "socket.io-client";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

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

// Bot config
const BOT_NAME = "Bot";
const BOT_RATING = 1100;
const BOT_ACCURACY = 0.65;
const QUESTION_MS = 15000;
const RESULT_MS = 2200;
const TOTAL_Q = 10;

export function useBattle() {
  const [state, setState] = useState<BattleState>(initialState);
  const socketRef = useRef<Socket | null>(null);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  const bot = useRef({
    active: false,
    questions: [] as Record<string, unknown>[],
    qIndex: 0,
    yourScore: 0,
    oppScore: 0,
    botCorrectForCurrent: false,
    resolved: false,
  });

  const update = useCallback((u: Partial<BattleState>) =>
    setState(p => ({ ...p, ...u })), []);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timerIds.current.push(id);
    return id;
  }, []);

  const clearTimers = useCallback(() => {
    timerIds.current.forEach(id => clearTimeout(id));
    timerIds.current = [];
  }, []);

  useEffect(() => () => {
    clearTimers();
    socketRef.current?.disconnect();
  }, [clearTimers]);

  const advanceBotQuestion = useCallback((qIndex: number, yourScore: number, oppScore: number) => {
    clearTimers();
    const { questions } = bot.current;
    bot.current.resolved = false;

    if (qIndex >= questions.length) {
      bot.current.active = false;
      const youWon = yourScore > oppScore;
      const isDraw = yourScore === oppScore;
      update({
        phase: "game_over",
        yourScore,
        opponentScore: oppScore,
        gameOver: {
          winnerId: youWon ? "you" : isDraw ? null : "bot",
          youWon, isDraw,
          yourScore, opponentScore: oppScore,
          yourRatingBefore: 1200,
          yourRatingAfter: youWon ? 1215 : isDraw ? 1200 : 1185,
          opponentRatingBefore: BOT_RATING,
          opponentRatingAfter: youWon ? 1085 : isDraw ? BOT_RATING : 1115,
        },
      });
      return;
    }

    const q = questions[qIndex];
    const correctOpt = (q.answer as string) ?? "";
    const allLetters = (q.options as Array<{ letter: string }>).map(o => o.letter);
    const wrongLetters = allLetters.filter(l => l !== correctOpt);

    const botCorrect = !!correctOpt && Math.random() < BOT_ACCURACY;
    bot.current.qIndex = qIndex;
    bot.current.yourScore = yourScore;
    bot.current.oppScore = oppScore;
    bot.current.botCorrectForCurrent = botCorrect;

    update({
      phase: "playing",
      currentQuestionIndex: qIndex,
      totalQuestions: questions.length,
      currentQuestion: {
        text: (q.questionText as string) ?? "",
        options: (q.options as Array<{ letter: string; text: string }>) ?? [],
        stemImages: (q.stemImages as string[]) ?? [],
      },
      timeLimit: QUESTION_MS,
      questionStartTime: Date.now(),
      selectedOption: null,
      opponentAnswered: false,
      questionResult: null,
      yourScore,
      opponentScore: oppScore,
    });

    void wrongLetters;

    // Bot "presses answer" indicator at a random time
    const botDelay = 2500 + Math.random() * 8500;
    addTimer(() => {
      if (!bot.current.active || bot.current.resolved) return;
      setState(p => p.phase === "playing" ? { ...p, opponentAnswered: true } : p);
    }, Math.min(botDelay, QUESTION_MS - 500));

    // Time's up
    addTimer(() => {
      if (!bot.current.active || bot.current.resolved) return;
      bot.current.resolved = true;

      setState(p => {
        if (p.phase !== "playing") return p;
        const userAns = p.selectedOption;
        const userCorrect = !!userAns && userAns === correctOpt;
        const newYour = yourScore + (userCorrect ? 1 : 0);
        const newOpp = oppScore + (botCorrect ? 1 : 0);
        bot.current.yourScore = newYour;
        bot.current.oppScore = newOpp;
        return {
          ...p,
          phase: "question_result",
          opponentAnswered: true,
          questionResult: { correctOption: correctOpt, yourAnswer: userAns, yourCorrect: userCorrect, opponentCorrect: botCorrect },
          yourScore: newYour,
          opponentScore: newOpp,
        };
      });

      addTimer(() => {
        if (!bot.current.active) return;
        advanceBotQuestion(qIndex + 1, bot.current.yourScore, bot.current.oppScore);
      }, RESULT_MS);
    }, QUESTION_MS);
  }, [update, addTimer, clearTimers]);

  const joinBotQueue = useCallback(async (scope?: BattleScope) => {
    clearTimers();
    bot.current.active = true;
    bot.current.resolved = false;
    update({ phase: "searching", error: null });

    try {
      let setIds: number[] = [];

      if (scope?.folderId) {
        const r = await fetch(`${API_BASE}/api/folders/${scope.folderId}/sets`);
        if (r.ok) {
          const d = await r.json() as Array<{ id: number; examType: string | null }>;
          setIds = d.filter(s => !s.examType || s.examType === "mcq" || s.examType === "mixed").map(s => s.id);
        }
        if (setIds.length === 0) {
          const sr = await fetch(`${API_BASE}/api/folders?parentId=${scope.folderId}`);
          if (sr.ok) {
            const subs = await sr.json() as Array<{ id: number }>;
            for (const sf of subs.slice(0, 6)) {
              const r2 = await fetch(`${API_BASE}/api/folders/${sf.id}/sets`);
              if (r2.ok) {
                const d2 = await r2.json() as Array<{ id: number; examType: string | null }>;
                setIds.push(...d2.filter(s => !s.examType || s.examType === "mcq").map(s => s.id));
              }
            }
          }
        }
      } else {
        const rr = await fetch(`${API_BASE}/api/folders`);
        if (rr.ok) {
          const allF = await rr.json() as Array<{ id: number; parentId: number | null }>;
          const roots = allF.filter(f => !f.parentId);
          if (roots.length > 0) {
            const pick = roots[Math.floor(Math.random() * roots.length)];
            const children = allF.filter(f => f.parentId === pick.id);
            for (const child of children.slice(0, 4)) {
              const grandkids = allF.filter(f => f.parentId === child.id);
              const targets = grandkids.length > 0 ? grandkids.slice(0, 3) : [child];
              for (const t of targets) {
                const r2 = await fetch(`${API_BASE}/api/folders/${t.id}/sets`);
                if (r2.ok) {
                  const d2 = await r2.json() as Array<{ id: number; examType: string | null }>;
                  setIds.push(...d2.filter(s => !s.examType || s.examType === "mcq").map(s => s.id));
                }
              }
            }
          }
        }
      }

      if (setIds.length === 0) {
        bot.current.active = false;
        update({ phase: "lobby", error: "No MCQ question sets found. Select a specific subject first." });
        return;
      }

      const picked = [...setIds].sort(() => Math.random() - 0.5).slice(0, 30);
      const qRes = await fetch(`${API_BASE}/api/mock-exam/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setIds: picked, count: TOTAL_Q, shuffle: true, types: ["mcq"] }),
      });
      if (!qRes.ok) throw new Error("Server error");
      const { questions } = await qRes.json() as { questions: Record<string, unknown>[] };

      if (!questions?.length) {
        bot.current.active = false;
        update({ phase: "lobby", error: "No MCQ questions found. Try a different subject." });
        return;
      }

      bot.current.questions = questions;
      bot.current.yourScore = 0;
      bot.current.oppScore = 0;

      update({
        phase: "matched",
        opponentName: BOT_NAME,
        opponentRating: BOT_RATING,
        yourRating: 1200,
        yourScore: 0, opponentScore: 0,
        currentQuestionIndex: 0,
        questionResult: null, gameOver: null,
        selectedOption: null, opponentAnswered: false, error: null,
      });

      addTimer(() => update({ phase: "countdown", countdownSeconds: 3 }), 1200);
      addTimer(() => update({ phase: "countdown", countdownSeconds: 2 }), 2200);
      addTimer(() => update({ phase: "countdown", countdownSeconds: 1 }), 3200);
      addTimer(() => update({ phase: "countdown", countdownSeconds: 0 }), 4200);
      addTimer(() => advanceBotQuestion(0, 0, 0), 4700);

    } catch {
      bot.current.active = false;
      update({ phase: "lobby", error: "Failed to load questions. Please try again." });
    }
  }, [update, clearTimers, addTimer, advanceBotQuestion]);

  const joinQueue = useCallback(async (scope?: BattleScope) => {
    clearTimers();
    bot.current.active = false;
    update({ phase: "searching", error: null });

    try {
      const { io } = await import("socket.io-client");
      if (!socketRef.current) {
        const socket = io(API_BASE, { path: "/api/socket.io", withCredentials: true, transports: ["polling", "websocket"] });
        socketRef.current = socket;

        socket.on("queue_joined", () => update({ phase: "searching", error: null }));
        socket.on("match_found", ({ battleId, opponent, yourRating }: { battleId: number; opponent: { name: string; rating: number }; yourRating: number }) =>
          update({ phase: "matched", battleId, yourRating, opponentName: opponent.name, opponentRating: opponent.rating, yourScore: 0, opponentScore: 0, currentQuestionIndex: 0, questionResult: null, gameOver: null, selectedOption: null, opponentAnswered: false }));
        socket.on("countdown", ({ seconds }: { seconds: number }) => update({ phase: "countdown", countdownSeconds: seconds }));
        socket.on("question", ({ index, total, question, timeLimit }: { index: number; total: number; question: BattleQuestion; timeLimit: number }) =>
          update({ phase: "playing", currentQuestionIndex: index, totalQuestions: total, currentQuestion: question, timeLimit, questionStartTime: Date.now(), selectedOption: null, opponentAnswered: false, questionResult: null }));
        socket.on("opponent_answered", () => update({ opponentAnswered: true }));
        socket.on("question_result", ({ correctOption, yourAnswer, yourCorrect, opponentCorrect, yourScore, opponentScore }: QuestionResultData & { yourScore: number; opponentScore: number }) =>
          update({ phase: "question_result", questionResult: { correctOption, yourAnswer, yourCorrect, opponentCorrect }, yourScore, opponentScore }));
        socket.on("game_over", (data: GameOverData & { yourScore: number; opponentScore: number }) =>
          update({ phase: "game_over", gameOver: data, yourScore: data.yourScore, opponentScore: data.opponentScore }));
        socket.on("opponent_disconnected", () => update({ error: "Opponent disconnected" }));
        socket.on("error", ({ message }: { message: string }) => update({ error: message, phase: "lobby" }));
        socket.on("disconnect", () =>
          setState(p => p.phase !== "game_over" ? { ...p, error: "Connection lost", phase: "lobby" } : p));
      }
      socketRef.current.emit("join_queue", scope ?? {});
    } catch {
      update({ phase: "lobby", error: "Multiplayer connection failed. Try Practice vs Bot instead." });
    }
  }, [update, clearTimers]);

  const leaveQueue = useCallback(() => {
    clearTimers();
    bot.current.active = false;
    socketRef.current?.emit("leave_queue");
    update({ phase: "lobby" });
  }, [update, clearTimers]);

  const submitAnswer = useCallback((option: string) => {
    if (bot.current.active) {
      if (bot.current.resolved) return;
      bot.current.resolved = true;
      clearTimers();

      const q = bot.current.questions[bot.current.qIndex];
      if (!q) return;
      const correctOption = (q.answer as string) ?? "";
      const userCorrect = option === correctOption;
      const botCorrect = bot.current.botCorrectForCurrent;
      const newYour = bot.current.yourScore + (userCorrect ? 1 : 0);
      const newOpp = bot.current.oppScore + (botCorrect ? 1 : 0);
      bot.current.yourScore = newYour;
      bot.current.oppScore = newOpp;
      const nextIdx = bot.current.qIndex + 1;

      setState(p => {
        if (p.selectedOption || p.phase !== "playing") return p;
        return {
          ...p,
          selectedOption: option,
          opponentAnswered: true,
          phase: "question_result",
          questionResult: { correctOption, yourAnswer: option, yourCorrect: userCorrect, opponentCorrect: botCorrect },
          yourScore: newYour,
          opponentScore: newOpp,
        };
      });

      addTimer(() => {
        if (!bot.current.active) return;
        advanceBotQuestion(nextIdx, newYour, newOpp);
      }, RESULT_MS);
      return;
    }

    setState(prev => {
      if (prev.selectedOption || prev.phase !== "playing") return prev;
      if (prev.battleId) {
        socketRef.current?.emit("answer", { battleId: prev.battleId, questionIndex: prev.currentQuestionIndex, option });
      }
      return { ...prev, selectedOption: option };
    });
  }, [clearTimers, addTimer, advanceBotQuestion]);

  const playAgain = useCallback(() => {
    clearTimers();
    bot.current.active = false;
    setState({ ...initialState });
  }, [clearTimers]);

  return { state, joinQueue, joinBotQueue, leaveQueue, submitAnswer, playAgain };
}
