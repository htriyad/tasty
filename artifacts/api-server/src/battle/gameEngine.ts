import { db, questionsTable, questionSetsTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import type { IO, ActiveGame, PlayerState, GameQuestion, BattleScope } from "./types.js";
import { logger } from "../lib/logger.js";

const QUESTION_TIME_LIMIT = 15_000;
const RESULT_SHOW_DURATION = 2_500;
const COUNTDOWN_SECONDS = 3;
const QUESTIONS_PER_GAME = 10;

export const BOT_USER_ID = "__bot__";
export const BOT_SOCKET_ID = "__bot__";
export const BOT_NAME = "Xero Bot";
export const BOT_RATING = 1300;

let _battleCounter = 1_000_000;
const activeGames = new Map<number, ActiveGame>();
let _io: IO;

export function setIO(io: IO) { _io = io; }

function emit(game: ActiveGame, event: string, data: unknown) {
  if (game.player1.socketId !== BOT_SOCKET_ID) _io.to(game.player1.socketId).emit(event, data);
  if (game.player2.socketId !== BOT_SOCKET_ID) _io.to(game.player2.socketId).emit(event, data);
}

export function getGameBySocketId(socketId: string): ActiveGame | undefined {
  for (const game of activeGames.values()) {
    if (game.player1.socketId === socketId || game.player2.socketId === socketId) return game;
  }
  return undefined;
}

export async function pickRandomQuestions(scope?: BattleScope): Promise<GameQuestion[]> {
  const baseWhere = sql`${questionsTable.type} = 'mcq'
    AND ${questionsTable.hidden} = false
    AND jsonb_array_length(${questionsTable.options}) >= 2
    AND ${questionsTable.answer} IS NOT NULL
    AND ${questionsTable.answer} != ''`;

  try {
    if (scope?.setId) {
      const rows = await db.select({
        id: questionsTable.id, questionText: questionsTable.questionText,
        options: questionsTable.options, answer: questionsTable.answer, stemImages: questionsTable.stemImages,
      }).from(questionsTable)
        .where(and(baseWhere, eq(questionsTable.setId, scope.setId)))
        .orderBy(sql`random()`).limit(QUESTIONS_PER_GAME);
      if (rows.length >= 4) return toGameQuestions(rows);
    }

    if (scope?.folderId) {
      // Recursively get all descendant folder IDs (including the selected folder itself)
      const descendantResult = await db.execute(sql`
        WITH RECURSIVE descendants AS (
          SELECT id FROM folders WHERE id = ${scope.folderId}
          UNION ALL
          SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id
        )
        SELECT id FROM descendants
      `);
      const folderIds = (descendantResult.rows as Array<{ id: number }>).map(r => r.id);

      if (folderIds.length > 0) {
        const sets = await db.select({ id: questionSetsTable.id })
          .from(questionSetsTable).where(inArray(questionSetsTable.folderId, folderIds));
        if (sets.length > 0) {
          const setIds = sets.map(s => s.id);
          const rows = await db.select({
            id: questionsTable.id, questionText: questionsTable.questionText,
            options: questionsTable.options, answer: questionsTable.answer, stemImages: questionsTable.stemImages,
          }).from(questionsTable)
            .where(and(baseWhere, inArray(questionsTable.setId, setIds)))
            .orderBy(sql`random()`).limit(QUESTIONS_PER_GAME);
          if (rows.length >= 4) return toGameQuestions(rows);
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "Scoped question query failed, falling back to global pool");
  }

  // Global fallback
  const rows = await db.select({
    id: questionsTable.id, questionText: questionsTable.questionText,
    options: questionsTable.options, answer: questionsTable.answer, stemImages: questionsTable.stemImages,
  }).from(questionsTable).where(baseWhere).orderBy(sql`random()`).limit(QUESTIONS_PER_GAME);

  return toGameQuestions(rows);
}

function toGameQuestions(rows: Array<{ id: number; questionText: string; options: unknown; answer: string | null; stemImages: unknown }>): GameQuestion[] {
  return rows.map(r => ({
    id: r.id,
    questionText: r.questionText,
    options: (r.options ?? []) as Array<{ letter: string; text: string }>,
    answer: r.answer ?? "",
    stemImages: (r.stemImages ?? []) as string[],
  }));
}

export async function startGame(
  battleId: number,
  p1Info: Omit<PlayerState, "score" | "totalTimeMs" | "hasAnswered" | "answers">,
  p2Info: Omit<PlayerState, "score" | "totalTimeMs" | "hasAnswered" | "answers">,
  scope?: BattleScope,
  isBotGame = false,
) {
  const rawQuestions = await pickRandomQuestions(scope);
  if (rawQuestions.length < 4) {
    logger.error({ battleId, scope }, "Not enough questions for battle");
    if (p1Info.socketId !== BOT_SOCKET_ID) _io.to(p1Info.socketId).emit("error", { message: "Not enough questions in this scope. Try a broader subject." });
    if (p2Info.socketId !== BOT_SOCKET_ID) _io.to(p2Info.socketId).emit("error", { message: "Not enough questions in this scope. Try a broader subject." });
    return;
  }

  const p1: PlayerState = { ...p1Info, score: 0, totalTimeMs: 0, hasAnswered: false, answers: [] };
  const p2: PlayerState = { ...p2Info, score: 0, totalTimeMs: 0, hasAnswered: false, answers: [] };

  const game: ActiveGame = {
    battleId,
    roomId: `battle_${battleId}`,
    player1: p1,
    player2: p2,
    questions: rawQuestions,
    currentQuestionIndex: 0,
    questionStartTime: 0,
    questionTimer: null,
    botAnswerTimer: null,
    status: "countdown",
    isBotGame,
  };
  activeGames.set(battleId, game);
  sendCountdown(game, COUNTDOWN_SECONDS);
}

function sendCountdown(game: ActiveGame, seconds: number) {
  emit(game, "countdown", { seconds });
  if (seconds > 0) {
    setTimeout(() => sendCountdown(game, seconds - 1), 1000);
  } else {
    setTimeout(() => {
      game.status = "active";
      sendQuestion(game);
    }, 500);
  }
}

function sendQuestion(game: ActiveGame) {
  const q = game.questions[game.currentQuestionIndex];
  if (!q) { endGame(game); return; }
  game.player1.hasAnswered = false;
  game.player2.hasAnswered = false;
  game.questionStartTime = Date.now();

  const payload = {
    index: game.currentQuestionIndex,
    total: game.questions.length,
    question: { text: q.questionText, options: q.options, stemImages: q.stemImages },
    timeLimit: QUESTION_TIME_LIMIT,
  };
  emit(game, "question", payload);

  // Bot answer
  if (game.isBotGame) {
    const botDelay = 3000 + Math.random() * 8000;
    game.botAnswerTimer = setTimeout(() => {
      if (game.status !== "active" || game.currentQuestionIndex !== payload.index) return;
      const botIsP2 = game.player2.userId === BOT_USER_ID;
      const botPlayer = botIsP2 ? game.player2 : game.player1;
      if (!botPlayer.hasAnswered) {
        const correct = Math.random() > 0.42;
        const answer = correct ? q.answer : (q.options.find(o => o.letter !== q.answer)?.letter ?? q.answer);
        processAnswerInternal(game, botPlayer, answer, Date.now() - game.questionStartTime);
      }
    }, botDelay);
  }

  // Auto-expire timer
  game.questionTimer = setTimeout(() => {
    if (game.status !== "active" || game.currentQuestionIndex !== payload.index) return;
    if (!game.player1.hasAnswered) processAnswerInternal(game, game.player1, null, QUESTION_TIME_LIMIT);
    if (!game.player2.hasAnswered) processAnswerInternal(game, game.player2, null, QUESTION_TIME_LIMIT);
  }, QUESTION_TIME_LIMIT + 200);
}

export function processAnswer(game: ActiveGame, socketId: string, questionIndex: number, option: string) {
  if (game.status !== "active" || game.currentQuestionIndex !== questionIndex) return;
  const player = game.player1.socketId === socketId ? game.player1 : game.player2;
  if (player.hasAnswered) return;
  processAnswerInternal(game, player, option, Date.now() - game.questionStartTime);
}

function processAnswerInternal(game: ActiveGame, player: PlayerState, option: string | null, timeMs: number) {
  const q = game.questions[game.currentQuestionIndex];
  if (!q) return;
  player.hasAnswered = true;
  const isCorrect = option !== null && option === q.answer;
  if (isCorrect) { player.score++; player.totalTimeMs += timeMs; }
  player.answers[game.currentQuestionIndex] = { selectedOption: option, isCorrect, timeMs };

  // Notify opponent that this player answered
  const opponent = game.player1.userId === player.userId ? game.player2 : game.player1;
  if (opponent.socketId !== BOT_SOCKET_ID) {
    _io.to(opponent.socketId).emit("opponent_answered", { questionIndex: game.currentQuestionIndex });
  }

  if (!game.player1.hasAnswered || !game.player2.hasAnswered) return;

  // Both answered — show result
  if (game.questionTimer) { clearTimeout(game.questionTimer); game.questionTimer = null; }
  if (game.botAnswerTimer) { clearTimeout(game.botAnswerTimer); game.botAnswerTimer = null; }
  game.status = "result";
  showResult(game);
}

function showResult(game: ActiveGame) {
  const qi = game.currentQuestionIndex;
  const q = game.questions[qi];
  if (!q) return;

  const p1Ans = game.player1.answers[qi] ?? { selectedOption: null, isCorrect: false, timeMs: 0 };
  const p2Ans = game.player2.answers[qi] ?? { selectedOption: null, isCorrect: false, timeMs: 0 };

  if (game.player1.socketId !== BOT_SOCKET_ID) {
    _io.to(game.player1.socketId).emit("question_result", {
      questionIndex: qi, correctOption: q.answer,
      yourAnswer: p1Ans.selectedOption, yourCorrect: p1Ans.isCorrect, opponentCorrect: p2Ans.isCorrect,
      yourScore: game.player1.score, opponentScore: game.player2.score,
    });
  }
  if (game.player2.socketId !== BOT_SOCKET_ID) {
    _io.to(game.player2.socketId).emit("question_result", {
      questionIndex: qi, correctOption: q.answer,
      yourAnswer: p2Ans.selectedOption, yourCorrect: p2Ans.isCorrect, opponentCorrect: p1Ans.isCorrect,
      yourScore: game.player2.score, opponentScore: game.player1.score,
    });
  }

  setTimeout(() => {
    game.currentQuestionIndex++;
    if (game.currentQuestionIndex >= game.questions.length) {
      endGame(game);
    } else {
      game.status = "active";
      sendQuestion(game);
    }
  }, RESULT_SHOW_DURATION);
}

function endGame(game: ActiveGame) {
  game.status = "ended";
  if (game.questionTimer) clearTimeout(game.questionTimer);
  if (game.botAnswerTimer) clearTimeout(game.botAnswerTimer);

  const p1 = game.player1; const p2 = game.player2;
  let winnerId: string | null = null;
  if (p1.score > p2.score) winnerId = p1.userId;
  else if (p2.score > p1.score) winnerId = p2.userId;
  else if (p1.totalTimeMs < p2.totalTimeMs) winnerId = p1.userId;
  else if (p2.totalTimeMs < p1.totalTimeMs) winnerId = p2.userId;

  const { p1After, p2After } = calcElo(p1.rating, p2.rating, winnerId, p1.userId, p2.userId);

  if (p1.socketId !== BOT_SOCKET_ID) {
    _io.to(p1.socketId).emit("game_over", {
      winnerId, youWon: winnerId === p1.userId, yourScore: p1.score, opponentScore: p2.score,
      yourRatingBefore: p1.rating, yourRatingAfter: p1After,
      opponentRatingBefore: p2.rating, opponentRatingAfter: p2After,
      isDraw: winnerId === null,
    });
  }
  if (p2.socketId !== BOT_SOCKET_ID) {
    _io.to(p2.socketId).emit("game_over", {
      winnerId, youWon: winnerId === p2.userId, yourScore: p2.score, opponentScore: p1.score,
      yourRatingBefore: p2.rating, yourRatingAfter: p2After,
      opponentRatingBefore: p1.rating, opponentRatingAfter: p1After,
      isDraw: winnerId === null,
    });
  }

  activeGames.delete(game.battleId);
}

export function forfeitGame(game: ActiveGame, disconnectedSocketId: string) {
  game.status = "ended";
  if (game.questionTimer) clearTimeout(game.questionTimer);
  if (game.botAnswerTimer) clearTimeout(game.botAnswerTimer);

  const winner = game.player1.socketId === disconnectedSocketId ? game.player2 : game.player1;
  if (winner.socketId !== BOT_SOCKET_ID) {
    _io.to(winner.socketId).emit("game_over", {
      winnerId: winner.userId, youWon: true,
      yourScore: winner.score, opponentScore: 0,
      yourRatingBefore: winner.rating, yourRatingAfter: winner.rating + 10,
      opponentRatingBefore: 1200, opponentRatingAfter: 1190,
      isDraw: false,
    });
  }
  activeGames.delete(game.battleId);
}

function calcElo(r1: number, r2: number, winnerId: string | null, uid1: string, uid2: string) {
  const K = 32;
  const E1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
  const S1 = winnerId === uid1 ? 1 : winnerId === null ? 0.5 : 0;
  return { p1After: Math.round(r1 + K * (S1 - E1)), p2After: Math.round(r2 + K * ((1 - S1) - (1 - E1))) };
}
