import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Pencil, Check, X, ArrowUp, ArrowDown, Loader2, ChevronRight, MoreVertical } from "lucide-react";
import { QuestionSet, useDeleteQuestionSet, getListQuestionSetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface QuestionSetCardProps {
  set: QuestionSet;
  index: number;
  folderColor: string;
  folderId: number;
  reorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  onRenamed?: (id: number, newName: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  mcq: "#22c55e",
  cq: "#f59e0b",
  sq: "#0ea5e9",
  mixed: "#8b5cf6",
};

export function QuestionSetCard({
  set, index, folderId, reorderMode = false,
  onMoveUp, onMoveDown, isFirst, isLast, onRenamed,
}: QuestionSetCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteSet = useDeleteQuestionSet();
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(set.name);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const color = TYPE_COLORS[set.examType ?? ""] ?? "#64748b";

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, [menuOpen]);

  const handleDelete = async () => {
    try {
      await deleteSet.mutateAsync({ id: set.id });
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const commitRename = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === set.name) { setRenaming(false); return; }
    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/sets/${set.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      onRenamed?.(set.id, trimmed);
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
      setRenaming(false);
    } catch {
      toast({ title: "Rename failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const row = (
    <div className="relative flex items-center gap-2.5 px-3 py-3 bg-card border border-border rounded-xl cursor-pointer hover:bg-accent/20 transition-all duration-100">
      {/* Color bar */}
      <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />

      {/* Name */}
      <div className="flex-1 min-w-0">
        {renaming ? (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
              className="flex-1 min-w-0 bg-background border border-primary/40 rounded-lg px-2 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={commitRename} disabled={saving}
              className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setRenaming(false)}
              className="w-7 h-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-sm font-medium text-foreground leading-tight" style={{ wordBreak: "break-word" }}>{set.name}</p>
        )}
      </div>

      {/* Count + type dot */}
      {!renaming && (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-semibold tabular-nums" style={{ color }}>
            {set.totalQuestions}q
          </span>
        </div>
      )}

      {/* Chevron — hidden when menu active */}
      {!reorderMode && !renaming && !menuOpen && (
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
      )}

      {/* ⋮ Menu button — always visible on touch devices */}
      {!reorderMode && !renaming && (
        <div ref={menuRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.preventDefault(); setMenuOpen(v => !v); setConfirmDelete(false); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {!confirmDelete ? (
                  <>
                    <button
                      onClick={() => { setNameInput(set.name); setRenaming(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Rename
                    </button>
                    <div className="h-px bg-border mx-2" />
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete set
                    </button>
                  </>
                ) : (
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-muted-foreground leading-snug">Delete <span className="font-semibold text-foreground">"{set.name}"</span> and all {set.totalQuestions} questions?</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                        Cancel
                      </button>
                      <button onClick={handleDelete} disabled={deleteSet.isPending}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                        {deleteSet.isPending ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className="relative"
    >
      {reorderMode ? (
        <div className="relative">
          {row}
          <div className="absolute inset-0 flex items-center justify-between px-3 bg-background/90 backdrop-blur-sm rounded-xl border-2 border-primary/50">
            <span className="text-xs font-bold text-primary">{index + 1}</span>
            <div className="flex gap-1.5">
              <button onClick={onMoveUp} disabled={isFirst}
                className="w-7 h-7 rounded-lg border bg-card flex items-center justify-center disabled:opacity-30">
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button onClick={onMoveDown} disabled={isLast}
                className="w-7 h-7 rounded-lg border bg-card flex items-center justify-center disabled:opacity-30">
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Link href={`/sets/${set.id}`}>{row}</Link>
      )}
    </motion.div>
  );
}
