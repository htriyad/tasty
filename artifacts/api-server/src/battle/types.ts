import type { Server, Socket } from "socket.io";

export type IO = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type BattleSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface SocketData {
  guestUserId: string;
}

export interface BattleScope {
  folderId?: number;
  setId?: number;
}

export interface QueueEntry {
  userId: string;
  socketId: string;
  rating: number;
  userName: string;
  joinedAt: number;
  scope: BattleScope;
}

export interface PlayerState {
  userId: string;
  socketId: string;
  userName: string;
  rating: number;
  score: number;
  totalTimeMs: number;
  hasAnswered: boolean;
  answers: Array<{
    selectedOption: string | null;
    isCorrect: boolean;
    timeMs: number;
  }>;
}

export interface GameQuestion {
  id: number;
  questionText: string;
  options: Array<{ letter: string; text: string }>;
  answer: string;
  stemImages: string[];
}

export interface ActiveGame {
  battleId: number;
  roomId: string;
  player1: PlayerState;
  player2: PlayerState;
  questions: GameQuestion[];
  currentQuestionIndex: number;
  questionStartTime: number;
  questionTimer: ReturnType<typeof setTimeout> | null;
  botAnswerTimer: ReturnType<typeof setTimeout> | null;
  status: "countdown" | "active" | "result" | "ended";
  isBotGame: boolean;
}

export interface ClientToServerEvents {
  join_queue: (scope: BattleScope) => void;
  join_bot_queue: (scope: BattleScope) => void;
  leave_queue: () => void;
  answer: (payload: { battleId: number; questionIndex: number; option: string }) => void;
}

export interface ServerToClientEvents {
  queue_joined: (data: { position: number }) => void;
  match_found: (data: { battleId: number; opponent: { name: string; rating: number }; yourRating: number }) => void;
  countdown: (data: { seconds: number }) => void;
  question: (data: { index: number; total: number; question: { text: string; options: Array<{ letter: string; text: string }>; stemImages: string[] }; timeLimit: number }) => void;
  opponent_answered: (data: { questionIndex: number }) => void;
  question_result: (data: { questionIndex: number; correctOption: string; yourAnswer: string | null; yourCorrect: boolean; opponentCorrect: boolean; yourScore: number; opponentScore: number }) => void;
  game_over: (data: { winnerId: string | null; youWon: boolean; yourScore: number; opponentScore: number; yourRatingBefore: number; yourRatingAfter: number; opponentRatingBefore: number; opponentRatingAfter: number; isDraw: boolean }) => void;
  opponent_disconnected: () => void;
  error: (data: { message: string }) => void;
}
