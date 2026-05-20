export type BookmarkItem = { id: number; questionText: string; setId: number; setName: string; type: string };
export type ReviewItem   = { id: number; questionText: string; setId: number; setName: string };
export type WrongItem    = { id: number; questionText: string; setId: number; setName: string; count: number };

const BOOKMARK_KEY   = "chorcha_bookmarks";
const REVIEW_ID_KEY  = "chorcha_review_ids";
const REVIEW_LST_KEY = "chorcha_review_list";
const WRONG_KEY      = "chorcha_wrong_counts";

function parse<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

export function readBookmarks(): Record<number, BookmarkItem> { return parse(BOOKMARK_KEY, {}); }
export function saveBookmarks(data: Record<number, BookmarkItem>) { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(data)); }

export function readReviewList(): Record<number, ReviewItem> { return parse(REVIEW_LST_KEY, {}); }
export function readReviewIds(): Set<number>  { const arr: number[] = parse(REVIEW_ID_KEY, []); return new Set(arr); }
export function saveReviewIds(ids: Set<number>) { localStorage.setItem(REVIEW_ID_KEY, JSON.stringify([...ids])); }
export function saveReviewList(data: Record<number, ReviewItem>) { localStorage.setItem(REVIEW_LST_KEY, JSON.stringify(data)); }

export function readWrongCounts(): Record<number, WrongItem> { return parse(WRONG_KEY, {}); }
export function recordWrong(id: number, questionText: string, setId: number, setName: string) {
  const data = readWrongCounts();
  data[id] = { id, questionText, setId, setName, count: (data[id]?.count ?? 0) + 1 };
  localStorage.setItem(WRONG_KEY, JSON.stringify(data));
}
export function clearWrong(id: number) {
  const data = readWrongCounts();
  delete data[id];
  localStorage.setItem(WRONG_KEY, JSON.stringify(data));
}
