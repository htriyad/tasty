import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Flame, Trash2, ExternalLink, CheckCircle2, ChevronRight, Home as HomeIcon, RotateCcw } from "lucide-react";
import { readWrongCounts, clearWrong, WrongItem } from "@/lib/localStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MathText } from "@/components/folder/MathText";
import { motion, AnimatePresence } from "framer-motion";

export function WeakQuestions() {
  const [data, setData] = useState<Record<number, WrongItem>>({});

  useEffect(() => { setData(readWrongCounts()); }, []);

  const dismiss = (id: number) => {
    clearWrong(id);
    setData(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const clearAll = () => {
    Object.keys(data).forEach(k => clearWrong(Number(k)));
    setData({});
  };

  const items = Object.values(data).sort((a, b) => b.count - a.count);

  const maxCount = items[0]?.count ?? 1;

  return (
    <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Link href="/"><HomeIcon className="w-4 h-4" /></Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-white/70 font-medium">Weak Questions</span>
        </div>
        <ThemeToggle size="sm" />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-500/15 flex items-center justify-center">
            <Flame className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white/90">Weak Questions</h1>
            <p className="text-xs text-white/40">{items.length} question{items.length !== 1 ? "s" : ""} you've answered wrong</p>
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={clearAll}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-red-400 transition-colors px-3 py-2 rounded-xl hover:bg-red-500/10">
            <RotateCcw className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/50" />
          </div>
          <p className="text-white/30 text-sm">No weak questions yet!</p>
          <p className="text-white/20 text-xs">Questions you answer incorrectly in Practice mode will appear here.</p>
        </div>
      ) : (
        <motion.div className="space-y-3" layout>
          <AnimatePresence mode="popLayout">
            {items.map(item => {
              const heatPct = Math.round((item.count / maxCount) * 100);
              const heatColor = item.count >= 5 ? "#ef4444" : item.count >= 3 ? "#f97316" : "#f59e0b";
              return (
                <motion.div key={item.id} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden group relative">
                  {/* Heat bar */}
                  <div className="absolute inset-y-0 left-0 rounded-l-2xl pointer-events-none opacity-30 transition-all duration-700"
                    style={{ width: `${heatPct}%`, background: `linear-gradient(90deg, ${heatColor}22, transparent)` }} />
                  <div className="p-4 space-y-2.5 relative">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 flex flex-col items-center gap-0.5 mt-0.5">
                        <span className="text-sm font-black tabular-nums" style={{ color: heatColor }}>{item.count}</span>
                        <span className="text-[9px] text-white/25 leading-none">wrong</span>
                      </div>
                      <div className="flex-1 min-w-0 text-sm text-white/80 leading-relaxed line-clamp-3 select-none">
                        <MathText text={item.questionText || "(No text)"} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <Link href={`/sets/${item.setId}`}
                        className="flex items-center gap-1.5 text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors truncate">
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{item.setName}</span>
                      </Link>
                      <button onClick={() => dismiss(item.id)} title="Mark as learned"
                        className="flex-shrink-0 flex items-center gap-1 text-[11px] text-white/25 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100 px-2 py-1 rounded-lg hover:bg-emerald-500/10">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Learned
                      </button>
                    </div>
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
