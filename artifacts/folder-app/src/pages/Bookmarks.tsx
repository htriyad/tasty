import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Bookmark, Trash2, BookOpen, ChevronRight, Home as HomeIcon,
  ArrowRight, Star, Search, Play, ChevronDown, ChevronUp, Check
} from "lucide-react";
import {
  readBookmarks, saveBookmarks, fetchSavedFromServer,
  removeBookmarkFromServer, toggleStarOnServer, ServerSavedItem
} from "@/lib/localStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MathText } from "@/components/folder/MathText";
import { motion, AnimatePresence } from "framer-motion";

type FullSavedItem = ServerSavedItem & {
  options?: { letter: string; text: string }[];
  answer?: string | null;
  parts?: { key: string; label?: string; text: string; solution?: string | null }[];
  solution?: string | null;
};

export function Bookmarks() {
  const [items, setItems] = useState<FullSavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "starred" | "mcq" | "cq">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [, navigate] = useLocation();

  useEffect(() => {
    fetchSavedFromServer().then((data: FullSavedItem[]) => {
      if (data.length > 0) {
        setItems(data);
      } else {
        const local = readBookmarks();
        const fallback: FullSavedItem[] = Object.values(local)
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

  const remove = async (item: FullSavedItem) => {
    setItems(prev => prev.filter(i => i.question_id !== item.question_id));
    const local = readBookmarks();
    const id = Number(item.question_id);
    if (local[id]) { delete local[id]; saveBookmarks(local); }
    else removeBookmarkFromServer(id);
  };

  const toggleStar = async (item: FullSavedItem) => {
    setItems(prev => prev.map(i =>
      i.question_id === item.question_id ? { ...i, is_starred: !i.is_starred } : i
    ));
    await toggleStarOnServer(item.question_id);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const starredCount = items.filter(i => i.is_starred).length;
  const starredMcqCount = items.filter(i => i.is_starred && i.question_type === "mcq").length;
  const mcqCount = items.filter(i => i.question_type === "mcq").length;
  const cqCount = items.filter(i => i.question_type === "cq").length;

  const filtered = items
    .filter(i => {
      if (filter === "starred") return i.is_starred;
      if (filter === "mcq") return i.question_type === "mcq";
      if (filter === "cq") return i.question_type === "cq";
      return true;
    })
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
      {!loading && (
        <div className="flex gap-2">
          <Link href="/practice-saved" className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              Practice MCQ ({mcqCount})
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
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "all", label: `All (${items.length})` },
          { key: "mcq", label: `MCQ (${mcqCount})` },
          { key: "cq", label: `CQ (${cqCount})` },
          { key: "starred", label: `⭐ Starred (${starredCount})` },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === key
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">
            {search ? "No questions match your search."
              : filter === "starred" ? "No starred questions yet."
              : filter === "mcq" ? "No saved MCQ questions yet."
              : filter === "cq" ? "No saved CQ questions yet."
              : "No saved questions yet."}
          </p>
          <p className="text-muted-foreground/60 text-xs">Tap the bookmark icon on any question while practising.</p>
        </div>
      ) : (
        <motion.div className="space-y-3" layout>
          <AnimatePresence mode="popLayout">
            {filtered.map(item => {
              const isOpen = expanded.has(item.question_id);
              const hasOptions = Array.isArray(item.options) && item.options.length > 0;
              const hasParts = Array.isArray(item.parts) && item.parts.length > 0;
              const isMcq = item.question_type === "mcq";
              const isCq = item.question_type === "cq";

              return (
                <motion.div key={item.question_id} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl border border-border bg-card overflow-hidden">

                  {/* Question header — always visible */}
                  <div className="p-4 space-y-2">
                    {/* Type badge + set name + arrow */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                          isMcq ? "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400"
                               : "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                        }`}>
                          {item.question_type}
                        </span>
                        {item.is_starred && <Star className="w-3.5 h-3.5 text-amber-500" fill="currentColor" />}
                      </div>
                      <button onClick={() => item.set_id && navigate(`/sets/${item.set_id}?highlight=${item.question_id}`)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <span className="truncate max-w-[120px]">{item.set_name}</span>
                        <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
                      </button>
                    </div>

                    {/* Question text — full, no truncation */}
                    <div className="text-sm text-foreground leading-relaxed">
                      <MathText text={item.question_text || "(No text)"} />
                    </div>

                    {/* Expand/collapse toggle */}
                    {(hasOptions || hasParts) && (
                      <button onClick={() => toggleExpand(item.question_id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
                        {isOpen
                          ? <><ChevronUp className="w-3.5 h-3.5" />Hide {isMcq ? "options" : "parts"}</>
                          : <><ChevronDown className="w-3.5 h-3.5" />Show {isMcq ? "options & answer" : "CQ parts"}</>
                        }
                      </button>
                    )}
                  </div>

                  {/* Expandable: MCQ options */}
                  <AnimatePresence>
                    {isOpen && isMcq && hasOptions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="px-4 pb-3 space-y-1.5 border-t border-border pt-3">
                          {item.options!.map(opt => {
                            const isAnswer = item.answer && opt.letter === item.answer;
                            return (
                              <div key={opt.letter}
                                className={`flex items-start gap-3 px-3 py-2.5 rounded-xl text-sm border transition-colors ${
                                  isAnswer
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-foreground"
                                    : "border-border bg-muted/30 text-muted-foreground"
                                }`}>
                                <span className={`font-bold w-5 flex-shrink-0 ${isAnswer ? "text-emerald-500" : "text-muted-foreground"}`}>
                                  {opt.letter}.
                                </span>
                                <span className="leading-relaxed flex-1"><MathText text={opt.text} /></span>
                                {isAnswer && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />}
                              </div>
                            );
                          })}
                          {!item.answer && (
                            <p className="text-xs text-muted-foreground italic px-1">Answer not stored</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Expandable: CQ parts */}
                    {isOpen && isCq && hasParts && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden">
                        <div className="px-4 pb-3 space-y-3 border-t border-border pt-3">
                          {item.parts!.filter(p => p.text?.trim()).map(part => (
                            <div key={part.key} className="space-y-1">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-xs text-purple-500 w-5 flex-shrink-0 mt-0.5">
                                  {part.key}.
                                </span>
                                <div className="text-sm text-foreground leading-relaxed flex-1">
                                  <MathText text={part.text} />
                                </div>
                              </div>
                              {part.solution?.trim() && (
                                <div className="ml-7 p-2.5 rounded-lg bg-muted/50 border border-border">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Solution</p>
                                  <div className="text-xs text-foreground leading-relaxed">
                                    <MathText text={part.solution} />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action row */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
                    <button onClick={() => toggleStar(item)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                        item.is_starred ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
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
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
