import { useState } from "react";
import {
  useListFolders,
  useGetFolderStats,
  useReorderFolders,
  getListFoldersQueryKey,
  Folder,
} from "@workspace/api-client-react";
import { FolderCard } from "@/components/folder/FolderCard";
import { FolderFormDialog } from "@/components/folder/FolderFormDialog";
import { DeleteFolderDialog } from "@/components/folder/DeleteFolderDialog";
import { MoveFolderDialog } from "@/components/folder/MoveFolderDialog";
import { QuestionIdSearch } from "@/components/QuestionIdSearch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, GripVertical, Check, Hash, Zap, Swords, Bookmark } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

export function Home() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState<Folder | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [localOrder, setLocalOrder] = useState<Folder[]>([]);
  const [idSearchOpen, setIdSearchOpen] = useState(false);

  const { data: folders = [], isLoading } = useListFolders({ search: search || undefined });
  const { data: stats } = useGetFolderStats();
  const reorderFolders = useReorderFolders();
  const queryClient = useQueryClient();

  const displayFolders = reorderMode ? localOrder : folders;

  const enterReorderMode = () => { setLocalOrder([...folders]); setReorderMode(true); };
  const moveFolder = (idx: number, dir: "up" | "down") => {
    const arr = [...localOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setLocalOrder(arr);
  };
  const saveOrder = async () => {
    await reorderFolders.mutateAsync({ data: { items: localOrder.map((f, i) => ({ id: f.id, position: i + 1 })) } });
    queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    setReorderMode(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="w-full px-4 pt-8 pb-16 space-y-5">

        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground leading-none">Question Bank</h1>
            {stats && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {stats.totalFolders} modules · depth {stats.maxDepth}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {reorderMode ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setReorderMode(false)} className="h-8 text-xs">Cancel</Button>
                <Button size="sm" onClick={saveOrder} disabled={reorderFolders.isPending} className="h-8 text-xs gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Save
                </Button>
              </>
            ) : (
              <>
                {folders.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={enterReorderMode} className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground">
                    <GripVertical className="w-3.5 h-3.5" /> Reorder
                  </Button>
                )}
                <Button size="sm" onClick={() => setCreateOpen(true)} className="h-8 text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> New
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search + actions */}
        {!reorderMode && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search modules…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm bg-card border-border"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => setIdSearchOpen(true)} className="h-9 px-3 gap-1.5 text-sm border-border bg-card">
              <Hash className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">By ID</span>
            </Button>
            <Link href="/bookmarks">
              <Button size="sm" className="h-9 px-3 gap-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white border-none">
                <Bookmark className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Saved</span>
              </Button>
            </Link>
            <Link href="/mock-exam">
              <Button size="sm" className="h-9 px-3 gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white border-none">
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exam</span>
              </Button>
            </Link>
            <Link href="/battle">
              <Button size="sm" className="h-9 px-3 gap-1.5 text-sm bg-rose-600 hover:bg-rose-500 text-white border-none">
                <Swords className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Battle</span>
              </Button>
            </Link>
          </div>
        )}

        {/* Folder list */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : displayFolders.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-sm">{search ? "No modules match your search." : "No modules yet."}</p>
            {!search && (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="mt-4 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create first module
              </Button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-2"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
          >
            <AnimatePresence mode="popLayout">
              {displayFolders.map((folder, idx) => (
                <FolderCard
                  key={folder.id}
                  folder={folder}
                  index={idx}
                  onEdit={setEditFolder}
                  onDelete={setDeleteFolder}
                  onMove={setMoveFolderTarget}
                  reorderMode={reorderMode}
                  onMoveUp={() => moveFolder(idx, "up")}
                  onMoveDown={() => moveFolder(idx, "down")}
                  isFirst={idx === 0}
                  isLast={idx === displayFolders.length - 1}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      <FolderFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editFolder && <FolderFormDialog open={true} onOpenChange={(open) => !open && setEditFolder(null)} initialData={editFolder} />}
      {deleteFolder && <DeleteFolderDialog open={true} onOpenChange={(open) => !open && setDeleteFolder(null)} folderId={deleteFolder.id} folderName={deleteFolder.name} />}
      <MoveFolderDialog folder={moveFolderTarget} onClose={() => setMoveFolderTarget(null)} onMoved={() => queryClient.invalidateQueries()} />
      <QuestionIdSearch open={idSearchOpen} onClose={() => setIdSearchOpen(false)} />
    </div>
  );
}
