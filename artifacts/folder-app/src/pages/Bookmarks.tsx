import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bookmark, Trash2, BookOpen, ChevronRight, Home as HomeIcon, Hash, ArrowRight } from "lucide-react";
import { readBookmarks, saveBookmarks, BookmarkItem } from "@/lib/localStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MathText } from "@/components/folder/MathText";
import { motion, AnimatePresence } from "framer-motion";

export function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Record<number, BookmarkItem>>({});
  const [, navigate] = useLocation();

  useEffect(() => { setBookmarks(readBookmarks()); }, []);

  const remove = (id: number) => {
    setBookmarks(prev => {
      const next = { ...prev };
      delete next[id];
      saveBookmarks(next);
      return next;
    });
  };

  const items = Object.values(bookmarks).sort((a, b) => b.id - a.id);

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/"><HomeIcon className="w-4 h-4" /></Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground font-medium">Bookmarks</span>
        </div>
        <ThemeToggle size="sm" />
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center">
          <Bookmark className="w-5 h-5 text-amber-500" fill="currentColor" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Bookmarks</h1>
          <p className="text-xs text-muted-foreground">{items.length} saved question{items.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No bookmarks yet.</p>
          <p className="text-muted-foreground/60 text-xs">Tap the bookmark icon on any question while in Practice or Solution mode.</p>
        </div>
      ) : (
        <motion.div className="space-y-3" layout>
          <AnimatePresence mode="popLayout">
            {items.map(item => (
              <motion.div key={item.id} layout
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border border-border bg-card group overflow-hidden">

                {/* Clickable question body */}
                <button
                  onClick={() => navigate(`/sets/${item.setId}?highlight=${item.id}`)}
                  className="w-full text-left p-4 space-y-3 hover:bg-muted/40 transition-colors"
                >
                  {/* Top row: type badge + ID + arrow */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {item.type}
                      </span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-muted text-muted-foreground border border-border">
                        <Hash className="w-2.5 h-2.5" />{item.id}
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </div>

                  {/* Full question text — no truncation */}
                  <div className="text-sm text-foreground leading-relaxed select-none">
                    <MathText text={item.questionText || "(No text)"} />
                  </div>

                  {/* Set name */}
                  <p className="text-xs text-muted-foreground truncate">{item.setName}</p>
                </button>

                {/* Remove button row */}
                <div className="flex justify-end px-4 py-2 border-t border-border">
                  <button onClick={() => remove(item.id)}
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
