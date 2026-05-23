import { Folder } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Trash2, ArrowUp, ArrowDown, Move, MoreVertical } from "lucide-react";
import { getIcon } from "@/lib/folderIcons";
import { cn } from "@/lib/utils";
import { useRef, useState, useCallback, useEffect } from "react";
import { useAdmin } from "@/contexts/AdminContext";

const LONG_PRESS_MS = 600;

interface FolderCardProps {
  folder: Folder;
  index: number;
  onEdit: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  onMove?: (folder: Folder) => void;
  reorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function FolderCard({
  folder, index, onEdit, onDelete, onMove,
  reorderMode = false, onMoveUp, onMoveDown, isFirst, isLast,
}: FolderCardProps) {
  const { isAdmin } = useAdmin();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClick = useRef(false);
  const [pressing, setPressing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const startPress = useCallback(() => {
    // Long-press move is admin-only
    if (!isAdmin || reorderMode || !onMove) return;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      suppressNextClick.current = true;
      setPressing(false);
      if (navigator.vibrate) navigator.vibrate(40);
      onMove(folder);
    }, LONG_PRESS_MS);
  }, [folder, isAdmin, onMove, reorderMode]);

  const cancelPress = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setPressing(false);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [menuOpen]);

  const IconComponent = getIcon(folder.icon);

  const cardBody = (
    <div
      className={cn(
        "group relative flex flex-col gap-2 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 select-none overflow-hidden",
        "bg-card border-border hover:border-[var(--folder-color)] hover:shadow-[0_0_0_1px_var(--folder-color)]",
        reorderMode && "cursor-default pointer-events-none opacity-60",
        pressing && "scale-[0.97]",
      )}
      style={{ "--folder-color": folder.color } as React.CSSProperties}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
    >
      {/* Subtle color wash */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
        style={{ background: `linear-gradient(135deg, ${folder.color}0a 0%, transparent 60%)` }}
      />

      {/* Top row: icon + ⋮ menu */}
      <div className="flex items-start justify-between">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${folder.color}20`, color: folder.color }}
        >
          <IconComponent className="w-4 h-4" strokeWidth={2} />
        </div>

        {!reorderMode && isAdmin && (
          <div ref={menuRef} className="relative z-20" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 min-w-[140px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
                >
                  <button
                    onClick={() => { onEdit(folder); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit
                  </button>
                  <div className="h-px bg-border mx-2" />
                  <button
                    onClick={() => { onDelete(folder); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Name + count */}
      <div className="relative z-10 flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{folder.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{folder.childCount} items</p>
      </div>
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.2, delay: reorderMode ? 0 : index * 0.03, ease: "easeOut" }}
      className="relative"
    >
      {reorderMode ? (
        <div className="relative">
          {cardBody}
          <div className="absolute inset-0 flex items-center justify-between px-3 bg-background/90 backdrop-blur-sm rounded-xl border-2 border-primary/50">
            <span className="text-sm font-bold text-primary">{index + 1}</span>
            <div className="flex gap-1.5">
              <button onClick={onMoveUp} disabled={isFirst} className="w-7 h-7 rounded-lg border bg-card flex items-center justify-center disabled:opacity-30">
                <ArrowUp className="w-3.5 h-3.5 text-foreground" />
              </button>
              <button onClick={onMoveDown} disabled={isLast} className="w-7 h-7 rounded-lg border bg-card flex items-center justify-center disabled:opacity-30">
                <ArrowDown className="w-3.5 h-3.5 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Link
          href={`/folders/${folder.id}`}
          onClick={e => { if (suppressNextClick.current) { suppressNextClick.current = false; e.preventDefault(); } }}
        >
          {cardBody}
          {/* "Hold to Move" overlay — only shown to admin during long-press */}
          <AnimatePresence>
            {pressing && isAdmin && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl z-20"
              >
                <Move className="w-5 h-5 text-primary mb-1 animate-bounce" />
                <span className="text-xs font-semibold text-foreground">Hold to Move</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      )}
    </motion.div>
  );
}
