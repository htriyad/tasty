import type { IO, BattleSocket, BattleScope } from "./types.js";
import { addToQueue, removeFromQueue, findAndPair, removeBySocketId } from "./matchmaking.js";
import {
  startGame, processAnswer, forfeitGame, getGameBySocketId,
  setIO, BOT_USER_ID, BOT_SOCKET_ID, BOT_NAME, BOT_RATING,
} from "./gameEngine.js";
import { logger } from "../lib/logger.js";

let _battleIdCounter = 1;
function nextBattleId(): number { return _battleIdCounter++; }

function scopeLabel(scope: BattleScope): string {
  if (scope.setId) return `set:${scope.setId}`;
  if (scope.folderId) return `folder:${scope.folderId}`;
  return "global";
}

export function registerBattleHandlers(io: IO) {
  setIO(io);

  io.on("connection", (socket: BattleSocket) => {
    const guestId = `guest_${socket.id.slice(0, 10)}`;
    socket.data.guestUserId = guestId;
    const userId = guestId;
    const userName = `Player_${socket.id.slice(0, 5)}`;
    const rating = 1200;

    logger.info({ socketId: socket.id, userId }, "Battle socket connected");

    async function handleJoin(scope: BattleScope, isBot: boolean) {
      try {
        const safeScope: BattleScope = {
          folderId: typeof scope?.folderId === "number" ? scope.folderId : undefined,
          setId: typeof scope?.setId === "number" ? scope.setId : undefined,
        };

        if (isBot) {
          const battleId = nextBattleId();
          const humanInfo = { userId, socketId: socket.id, rating, userName };
          const botInfo = { userId: BOT_USER_ID, socketId: BOT_SOCKET_ID, rating: BOT_RATING, userName: BOT_NAME };

          socket.emit("match_found", {
            battleId, yourRating: rating,
            opponent: { name: BOT_NAME, rating: BOT_RATING },
          });

          logger.info({ battleId, scope: scopeLabel(safeScope) }, "Bot game started");
          await startGame(battleId, humanInfo, botInfo, safeScope, true);
          return;
        }

        const entry = { userId, socketId: socket.id, rating, userName, joinedAt: Date.now(), scope: safeScope };
        addToQueue(entry);
        socket.emit("queue_joined", { position: 1 });

        const opponent = findAndPair(entry);
        if (opponent) {
          removeFromQueue(entry.userId);
          const battleId = nextBattleId();
          const roomId = `battle_${battleId}`;

          socket.join(roomId);
          const opponentSocket = io.sockets.sockets.get(opponent.socketId);
          if (opponentSocket) opponentSocket.join(roomId);

          io.to(entry.socketId).emit("match_found", { battleId, yourRating: entry.rating, opponent: { name: opponent.userName, rating: opponent.rating } });
          io.to(opponent.socketId).emit("match_found", { battleId, yourRating: opponent.rating, opponent: { name: entry.userName, rating: entry.rating } });

          const gameScope = opponent.scope.setId ? opponent.scope : (opponent.scope.folderId ? opponent.scope : safeScope);
          logger.info({ battleId, scope: scopeLabel(gameScope) }, "PvP match found");
          await startGame(
            battleId,
            { userId: entry.userId, socketId: entry.socketId, rating: entry.rating, userName: entry.userName },
            { userId: opponent.userId, socketId: opponent.socketId, rating: opponent.rating, userName: opponent.userName },
            gameScope, false
          );
        }
      } catch (err) {
        logger.error({ err, userId }, "Error in handleJoin");
        socket.emit("error", { message: "Failed to start game. Please try again." });
      }
    }

    socket.on("join_queue", (scope: BattleScope) => { void handleJoin(scope ?? {}, false); });
    socket.on("join_bot_queue", (scope: BattleScope) => { void handleJoin(scope ?? {}, true); });

    socket.on("leave_queue", () => {
      try {
        removeFromQueue(userId);
        logger.info({ userId }, "Player left queue");
      } catch (err) {
        logger.error({ err, userId }, "Error in leave_queue");
      }
    });

    socket.on("answer", ({ battleId, questionIndex, option }: { battleId: number; questionIndex: number; option: string }) => {
      try {
        const game = getGameBySocketId(socket.id);
        if (!game || game.battleId !== battleId) return;
        processAnswer(game, socket.id, questionIndex, option);
      } catch (err) {
        logger.error({ err, userId }, "Error processing answer");
      }
    });

    socket.on("disconnect", () => {
      try {
        removeBySocketId(socket.id);
        const game = getGameBySocketId(socket.id);
        if (game && game.status !== "ended") {
          forfeitGame(game, socket.id);
        }
        logger.info({ userId }, "Battle socket disconnected");
      } catch (err) {
        logger.error({ err, userId }, "Error in disconnect handler");
      }
    });
  });
}
