export type BookmarkItem = { id: number; questionText: string; setId: number; setName: string; type: string };
export type ReviewItem   = { id: number; questionText: string; setId: number; setName: string };
export type WrongItem    = { id: number; questionText: string; setId: number; setName: string; count: number };

export type ServerSavedItem = {
  id: number;
  question_id: string;
  question_text: string;
  set_id: number | null;
  set_name: string | null;
  question_type: string;
  is_starred: boolean;
  saved_at: string;
};

const BOOKMARK_KEY   = "chorcha_bookmarks";
const REVIEW_ID_KEY  = "chorcha_review_ids";
const REVIEW_LST_KEY = "chorcha_review_list";
const WRONG_KEY      = "chorcha_wrong_counts";
const SESSION_KEY    = "fqb_session_id";

function parse<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback; } catch { return fallback; }
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function apiBase(): string {
  const base = (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? "";
  return base.replace(/\/$/, "");
}

export async function syncBookmarkToServer(item: BookmarkItem): Promise<void> {
  try {
    await fetch(`${apiBase()}/api/saved`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session: getSessionId(),
        questionId: String(item.id),
        questionText: item.questionText,
        setId: item.setId,
        setName: item.setName,
        questionType: item.type,
      }),
    });
  } catch { /* silent */ }
}

export async function removeBookmarkFromServer(id: number): Promise<void> {
  try {
    await fetch(`${apiBase()}/api/saved/${id}?session=${getSessionId()}`, { method: "DELETE" });
  } catch { /* silent */ }
}

export async function toggleStarOnServer(questionId: string): Promise<boolean | null> {
  try {
    const r = await fetch(`${apiBase()}/api/saved/${questionId}/star?session=${getSessionId()}`, { method: "PATCH" });
    const data = await r.json() as { isStarred?: boolean };
    return data.isStarred ?? null;
  } catch { return null; }
}

export async function fetchSavedFromServer(): Promise<ServerSavedItem[]> {
  try {
    const r = await fetch(`${apiBase()}/api/saved?session=${getSessionId()}`);
    if (!r.ok) return [];
    return await r.json() as ServerSavedItem[];
  } catch { return []; }
}

export function readBookmarks(): Record<number, BookmarkItem> { return parse(BOOKMARK_KEY, {}); }

export function saveBookmarks(data: Record<number, BookmarkItem>) {
  const prev = readBookmarks();
  const prevIds = new Set(Object.keys(prev).map(Number));
  const nextIds = new Set(Object.keys(data).map(Number));
  for (const id of nextIds) {
    if (!prevIds.has(id) && data[id]) syncBookmarkToServer(data[id]);
  }
  for (const id of prevIds) {
    if (!nextIds.has(id)) removeBookmarkFromServer(id);
  }
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(data));
}

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
