import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowRight, Loader2, BookMarked, AlertCircle } from "lucide-react";

interface LookupResult {
  id: number;
  type: string;
  questionText: string | null;
  questionIndex: number;
  setId: number;
  setName: string;
  folderId: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuestionIdSearch({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResult(null);
      setNotFound(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    const id = parseInt(query.trim(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      setResult(null);
      setNotFound(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setResult(null);
      setNotFound(false);
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}api/questions/lookup?id=${id}`);
        if (res.ok) {
          setResult(await res.json());
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const goToQuestion = (r: LookupResult) => {
    navigate(`/sets/${r.setId}?highlight=${r.id}`);
    onClose();
  };

  const typeColors: Record<string, string> = {
    cq: "bg-amber-500/15 text-amber-400/90 border-amber-500/25",
    mcq: "bg-sky-500/15 text-sky-400/90 border-sky-500/25",
    sq: "bg-violet-500/15 text-violet-400/90 border-violet-500/25",
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ scale: 0.95, y: -16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: -12, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-3xl border border-border overflow-hidden bg-card shadow-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
              <Search className="w-4 h-4 text-primary/70 flex-shrink-0" />
              <input
                ref={inputRef}
                type="number"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") onClose(); if (e.key === "Enter" && result) goToQuestion(result); }}
                placeholder="Enter question ID..."
                className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-base outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {loading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />}
              <button onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Result */}
            <div className="min-h-[80px] flex items-center">
              {!query.trim() && (
                <p className="text-muted-foreground text-sm px-5 py-5">Type a question ID to jump to it</p>
              )}

              {query.trim() && !loading && notFound && (
                <div className="flex items-center gap-3 px-5 py-5">
                  <AlertCircle className="w-4 h-4 text-destructive/60 flex-shrink-0" />
                  <p className="text-muted-foreground text-sm">No question found with ID <span className="text-foreground font-mono font-semibold">#{query.trim()}</span></p>
                </div>
              )}

              {result && !loading && (
                <button
                  onClick={() => goToQuestion(result)}
                  className="w-full flex items-start gap-4 px-5 py-4 hover:bg-muted/50 transition-all group text-left"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${typeColors[result.type] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {result.type}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                      {result.questionText || <span className="italic text-muted-foreground">No text preview</span>}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <BookMarked className="w-3 h-3 text-primary/60" />
                      <span className="text-xs text-muted-foreground truncate">{result.setName}</span>
                      <span className="text-xs text-muted-foreground/60">· Q{result.questionIndex}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                </button>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-border flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">Press</span>
              <kbd className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 font-mono">Enter</kbd>
              <span className="text-[11px] text-muted-foreground">to go · </span>
              <kbd className="text-[10px] text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5 font-mono">Esc</kbd>
              <span className="text-[11px] text-muted-foreground">to close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
