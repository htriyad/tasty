import type { QueueEntry } from "./types.js";

const queue: QueueEntry[] = [];

export function addToQueue(entry: QueueEntry): void {
  removeFromQueue(entry.userId);
  queue.push(entry);
}

export function removeFromQueue(userId: string): void {
  const idx = queue.findIndex((e) => e.userId === userId);
  if (idx !== -1) queue.splice(idx, 1);
}

export function removeBySocketId(socketId: string): QueueEntry | null {
  const idx = queue.findIndex((e) => e.socketId === socketId);
  if (idx !== -1) {
    const [entry] = queue.splice(idx, 1);
    return entry ?? null;
  }
  return null;
}

export function findAndPair(newEntry: QueueEntry): QueueEntry | null {
  const elapsed = Date.now() - newEntry.joinedAt;
  const ratingRange = Math.min(300 + Math.floor(elapsed / 5000) * 100, 800);

  for (let i = 0; i < queue.length; i++) {
    const candidate = queue[i]!;
    if (candidate.userId === newEntry.userId) continue;
    if (Math.abs(candidate.rating - newEntry.rating) > ratingRange) continue;
    queue.splice(i, 1);
    return candidate;
  }
  return null;
}

export function getQueueSize(): number {
  return queue.length;
}
