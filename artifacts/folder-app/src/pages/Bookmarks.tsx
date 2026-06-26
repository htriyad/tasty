import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bookmark, Trash2, BookOpen, ChevronRight, Home as HomeIcon, Hash, ArrowRight, Star, Search, Play } from "lucide-react";
import { readBookmarks, saveBookmarks, fetchSavedFromServer, removeBookmarkFromServer, toggleStarOnServer, ServerSavedItem } from "@/lib/localStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MathText } from "@/components/folder/MathText";
import { motion, AnimatePresence } from "framer-motion";

export function Bookmarks() {
  const [items, setItems] = useState<ServerSavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "starred">("all");
  const [, navigate] = useLocation();

  useEffect(() => {
    fetchSavedFromServer().then(data => {
      if (data.length > 0) {
        setItems(data);
      } else {
        const local = readBookmarks();
        const fallback: ServerSavedItem[] = Object.values(local)
          .sort((a, b) => b.id - a.id)
          .map(b => ({
            id: b.id,
            question_id: String(b.id),
            question_text: b.questionText,
            set_id: b.setId,
            set_name: b.setName,
            question_type: b.type,
            is_starred: false,
            saved_at: new Date().toISOString(),
          }));
        setItems(fallback);
      }
      setLoading(false);
    });
  }, []);

  const remove = async (item: ServerSavedItem) => {
    setItems(prev => prev.filter(i => i.question_id !== item.question_id));
    const local = readBookmarks();
    const id = Number(item.question_id);
    if (local[id]) {
      delete local[id];
      saveBookmarks(local);
    } else {
      removeBookmarkFromServer(id);
    }
  };

  const toggleStar = async (item: ServerSavedItem) => {
    setItems(prev => prev.map(i =>
      i.question_id === item.question_id ? { ...i, is_starred: !i.is_starred } : i
    ));
    await toggleStarOnServer(item.question_id);
  };

  const starredCount = items.filter(i => i.is_starred).length;
  const mcqCount = items.filter(i => i.question_type === "mcq").length;
  const starredMcqCount = items.filter(i => i.is_starred && i.question_type === "mcq").length;

  const filtered = items
    .filter(i => filter === "all" || i.is_starred)
    .filter(i => !search ||
      i.question_text.toLowerCase().includes(search.toLowerCase()) ||
      (i.set_name ?? "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/"><HomeIcon className="w-4 h-4" /></Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Saved</span>
        </div>
        <ThemeToggle size="sm" />
      </div>

      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center">
          <Bookmark className="w-5 h-5 text-amber-500" fill="currentColor" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Saved Questions</h1>
          <p className="text-xs text-muted-foreground">
            {loading ? "Loading…" : `${items.length} saved · ${starredCount} starred`}
          </p>
        </div>
      </div>

      {/* Practice buttons */}
      {!loading && mcqCount > 0 && (
        <div className="flex gap-2">
          <Link href="/practice-saved" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              Practice All ({mcqCount})
            </button>
          </Link>
          {starredMcqCount > 0 && (
            <Link href="/practice-saved?starred=1">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                <Star className="w-3.5 h-3.5" fill="currentColor" />
                Starred ({starredMcqCount})
              </button>
            </Link>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search saved questions…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "starred"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {f === "all" ? `All (${items.length})` : `⭐ Starred (${starredCount})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">
            {search
              ? "No questions match your search."
              : filter === "starred"
                ? "No starred questions yet. Tap ⭐ on any saved question."
                : "No saved questions yet."}
          </p>
          <p className="text-muted-foreground/60 text-xs">
            Tap the bookmark icon on any question while practising.
          </p>
        </div>
      ) : (
        <motion.div className="space-y-3" layout>
          <AnimatePresence mode="popLayout">
            {filtered.map(item => (
              <motion.div key={item.question_id} layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border border-border bg-card group overflow-hidden">

                <button
                  onClick={() => item.set_id && navigate(`/sets/${item.set_id}?highlight=${item.question_id}`)}
                  className="w-full text-left p-4 space-y-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {item.question_type}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
                        <Hash className="w-2.5 h-2.5" />{item.question_id}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>

                  <div className="text-sm text-foreground leading-relaxed select-none">
                    <MathText text={item.question_text || "(No text)"} />
                  </div>

                  <p className="text-xs text-muted-foreground truncate">{item.set_name}</p>
                </button>

                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
                  <button onClick={() => toggleStar(item)}
                    className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                      item.is_starred
                        ? "text-amber-500"
                        : "text-muted-foreground hover:text-amber-500"
                    }`}>
                    <Star className="w-3.5 h-3.5" fill={item.is_starred ? "currentColor" : "none"} />
                    {item.is_starred ? "Starred" : "Star"}
                  </button>
                  <button onClick={() => remove(item)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
