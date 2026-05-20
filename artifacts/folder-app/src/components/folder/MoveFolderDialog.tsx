import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronRight, Home as HomeIcon, X, FolderOpen } from "lucide-react";
import { useListFolders, Folder } from "@workspace/api-client-react";
import { getIcon } from "@/lib/folderIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface MoveFolderDialogProps {
  folder: Folder | null;
  onClose: () => void;
  onMoved: () => void;
}

function buildPathMap(folders: Folder[]): Record<number, string> {
  const byId: Record<number, Folder> = {};
  for (const f of folders) byId[f.id] = f;
  const cache: Record<number, string> = {};
  function path(id: number): string {
    if (cache[id] !== undefined) return cache[id];
    const f = byId[id];
    if (!f) return "";
    if (!f.parentId) { cache[id] = f.name; return f.name; }
    const parent = path(f.parentId);
    cache[id] = parent ? `${parent} / ${f.name}` : f.name;
    return cache[id];
  }
  for (const f of folders) path(f.id);
  return cache;
}

function getAllDescendants(folderId: number, allFolders: Folder[]): Set<number> {
  const result = new Set<number>();
  const queue = [folderId];
  while (queue.length > 0) {
    const cur = queue.pop()!;
    for (const f of allFolders) {
      if (f.parentId === cur) {
        result.add(f.id);
        queue.push(f.id);
      }
    }
  }
  return result;
}

export function MoveFolderDialog({ folder, onClose, onMoved }: MoveFolderDialogProps) {
  const [search, setSearch] = useState("");
  const [moving, setMoving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allFolders = [] } = useListFolders({ flat: true } as Parameters<typeof useListFolders>[0]);

  const pathMap = useMemo(() => buildPathMap(allFolders), [allFolders]);

  const excluded = useMemo(() => {
    if (!folder) return new Set<number>();
    const desc = getAllDescendants(folder.id, allFolders);
    desc.add(folder.id);
    return desc;
  }, [folder, allFolders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFolders.filter(f => {
      if (excluded.has(f.id)) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || pathMap[f.id]?.toLowerCase().includes(q);
    });
  }, [allFolders, excluded, search, pathMap]);

  useEffect(() => {
    if (folder) {
      setSearch("");
      setTimeout(() => searchRef.current?.focus(), 300);
    }
  }, [folder]);

  const moveToFolder = async (targetParentId: number | null) => {
    if (!folder || moving) return;
    setMoving(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: targetParentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Move failed" }));
        throw new Error(err.error ?? "Move failed");
      }
      queryClient.invalidateQueries();
      toast({ title: "Moved!", description: `"${folder.name}" moved successfully.` });
      onMoved();
      onClose();
    } catch (e) {
      toast({ title: "Move failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setMoving(false);
    }
  };

  return (
    <AnimatePresence>
      {folder && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-zinc-900 border-t border-white/10"
            style={{ maxHeight: "80dvh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-5 pt-2 pb-3 flex items-center gap-3 flex-shrink-0 border-b border-white/8">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/35 font-medium">Moving</p>
                <p className="text-base font-bold text-white/90 truncate">"{folder.name}"</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/6 hover:bg-white/12 flex items-center justify-center flex-shrink-0 transition-colors">
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2.5 flex-shrink-0 border-b border-white/6">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/6 border border-white/10">
                <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search folders..."
                  className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/25 outline-none"
                />
              </div>
            </div>

            {/* Destination list */}
            <div className="flex-1 overflow-y-auto py-2">
              {/* Root level option */}
              {folder.parentId != null && (
                <button
                  onClick={() => moveToFolder(null)}
                  disabled={moving}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center flex-shrink-0">
                    <HomeIcon className="w-4 h-4 text-white/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/80">Root level</p>
                    <p className="text-xs text-white/30">Top-level folder</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                </button>
              )}

              {filtered.length === 0 && (
                <div className="py-10 text-center">
                  <FolderOpen className="w-8 h-8 text-white/15 mx-auto mb-2" />
                  <p className="text-sm text-white/30">No folders found</p>
                </div>
              )}

              {filtered.map(f => {
                const Icon = getIcon(f.icon);
                const fullPath = pathMap[f.id] ?? f.name;
                const isCurrentParent = f.id === folder.parentId;
                return (
                  <button
                    key={f.id}
                    onClick={() => moveToFolder(f.id)}
                    disabled={moving || isCurrentParent}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left disabled:opacity-40"
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${f.color}22`, border: `1px solid ${f.color}35` }}>
                      <Icon className="w-4 h-4" style={{ color: f.color }} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white/80 truncate">{f.name}</p>
                      {fullPath !== f.name && (
                        <p className="text-xs text-white/30 truncate">{fullPath}</p>
                      )}
                    </div>
                    {isCurrentParent
                      ? <span className="text-[10px] text-white/25 flex-shrink-0">current</span>
                      : <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                    }
                  </button>
                );
              })}
            </div>

            {moving && (
              <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
                <p className="text-sm text-center text-white/40">Moving...</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
