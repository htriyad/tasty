import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useListFolders,
  useGetFolder,
  useGetFolderBreadcrumb,
  useReorderFolders,
  useListQuestionSets,
  getListFoldersQueryKey,
  getListQuestionSetsQueryKey,
  Folder,
  QuestionSet,
} from "@workspace/api-client-react";
import { FolderCard } from "@/components/folder/FolderCard";
import { FolderFormDialog } from "@/components/folder/FolderFormDialog";
import { DeleteFolderDialog } from "@/components/folder/DeleteFolderDialog";
import { MoveFolderDialog } from "@/components/folder/MoveFolderDialog";
import { DecodeDialog } from "@/components/folder/DecodeDialog";
import { QuestionSetCard } from "@/components/folder/QuestionSetCard";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, Home as HomeIcon, Plus, FolderIcon,
  GripVertical, Check, BookOpen, BookMarked,
  Loader2, Settings, Trash2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";
import { getIcon } from "@/lib/folderIcons";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function FolderView() {
  const params = useParams();
  const folderId = parseInt(params.id ?? "0", 10);

  const { data: folder, isLoading: folderLoading } = useGetFolder(folderId);
  const { data: breadcrumbs = [], isLoading: breadcrumbLoading } = useGetFolderBreadcrumb(folderId);
  const { data: subfolders = [], isLoading: listLoading } = useListFolders({ parentId: folderId });
  const { data: questionSets = [], isLoading: setsLoading } = useListQuestionSets(folderId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState<Folder | null>(null);
  const [decodeOpen, setDecodeOpen] = useState(false);
  const [newSetOpen, setNewSetOpen] = useState(false);
  const [newSetName, setNewSetName] = useState("");
  const [newSetType, setNewSetType] = useState("");
  const [newSetSaving, setNewSetSaving] = useState(false);
  const [, navigate] = useLocation();

  const [folderReorderMode, setFolderReorderMode] = useState(false);
  const [localFolderOrder, setLocalFolderOrder] = useState<Folder[]>([]);
  const [setReorderMode, setSetReorderMode] = useState(false);
  const [localSetOrder, setLocalSetOrder] = useState<QuestionSet[]>([]);
  const [savingSetsOrder, setSavingSetsOrder] = useState(false);

  const reorderFolders = useReorderFolders();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createNewSet = async () => {
    const name = newSetName.trim();
    if (!name) return;
    setNewSetSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/folders/${folderId}/sets`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, examType: newSetType.trim() || null }),
      });
      if (res.ok) {
        const set = await res.json();
        queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
        setNewSetOpen(false); setNewSetName(""); setNewSetType(""); navigate(`/sets/${set.id}`);
      } else {
        toast({ title: "Failed to create set", variant: "destructive" });
      }
    } catch { toast({ title: "Failed to create set", variant: "destructive" }); }
    finally { setNewSetSaving(false); }
  };

  if (folderLoading || breadcrumbLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-sm text-muted-foreground">Module not found</p>
        <Link href="/"><Button size="sm">Go home</Button></Link>
      </div>
    );
  }

  const FolderIconComp = getIcon(folder.icon);
  const displayFolders = folderReorderMode ? localFolderOrder : subfolders;
  const displaySets = setReorderMode ? localSetOrder : questionSets;

  const enterFolderReorder = () => { setLocalFolderOrder([...subfolders]); setFolderReorderMode(true); };
  const moveFolderItem = (idx: number, dir: "up" | "down") => {
    const arr = [...localFolderOrder]; const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return; [arr[idx], arr[swap]] = [arr[swap], arr[idx]]; setLocalFolderOrder(arr);
  };
  const saveFolderOrder = async () => {
    await reorderFolders.mutateAsync({ data: { items: localFolderOrder.map((f, i) => ({ id: f.id, position: i + 1 })) } });
    queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() }); setFolderReorderMode(false);
  };

  const enterSetReorder = () => { setLocalSetOrder([...questionSets]); setSetReorderMode(true); };
  const moveSetItem = (idx: number, dir: "up" | "down") => {
    const arr = [...localSetOrder]; const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return; [arr[idx], arr[swap]] = [arr[swap], arr[idx]]; setLocalSetOrder(arr);
  };
  const saveSetOrder = async () => {
    setSavingSetsOrder(true);
    try {
      await fetch(`${API_BASE}/api/folders/${folderId}/sets/reorder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: localSetOrder.map((s, i) => ({ id: s.id, position: i + 1 })) }),
      });
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) }); setSetReorderMode(false);
    } finally { setSavingSetsOrder(false); }
  };

  const anyReorderMode = folderReorderMode || setReorderMode;
  const hasContent = subfolders.length > 0 || questionSets.length > 0;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="w-full max-w-3xl mx-auto px-4 pt-6 pb-16 space-y-5">

        {/* Top bar: breadcrumb + actions */}
        <div className="flex items-center justify-between gap-3">
          <nav className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 flex-1">
            <Link href="/"><button className="hover:text-foreground transition-colors shrink-0"><HomeIcon className="w-3.5 h-3.5" /></button></Link>
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.id} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
                {idx === breadcrumbs.length - 1 ? (
                  <span className="text-foreground font-medium truncate">{crumb.name}</span>
                ) : (
                  <Link href={`/folders/${crumb.id}`}>
                    <button className="hover:text-foreground transition-colors truncate">{crumb.name}</button>
                  </Link>
                )}
              </span>
            ))}
          </nav>
          <ThemeToggle />
        </div>

        {/* Folder header strip */}
        <div
          className="flex items-center gap-3 px-3.5 py-3 rounded-xl border"
          style={{ borderColor: `${folder.color}30`, backgroundColor: `${folder.color}08` }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${folder.color}22`, color: folder.color }}
          >
            <FolderIconComp className="w-5 h-5" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{folder.name}</p>
            <p className="text-xs text-muted-foreground">
              {subfolders.length} submodules · {questionSets.length} sets
            </p>
          </div>

          {anyReorderMode ? (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFolderReorderMode(false); setSetReorderMode(false); }}>Cancel</Button>
              {folderReorderMode && (
                <Button size="sm" className="h-8 text-xs gap-1" onClick={saveFolderOrder} disabled={reorderFolders.isPending}>
                  <Check className="w-3.5 h-3.5" /> Save
                </Button>
              )}
              {setReorderMode && (
                <Button size="sm" className="h-8 text-xs gap-1" onClick={saveSetOrder} disabled={savingSetsOrder}>
                  <Check className="w-3.5 h-3.5" /> Save
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm" variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                title="Delete this folder"
                onClick={() => setDeleteFolder(folder)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground"
                onClick={() => setEditFolder(folder)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 border-border"
                onClick={() => setDecodeOpen(true)}
              >
                <BookOpen className="w-3.5 h-3.5" /> Decode
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 text-white"
                style={{ backgroundColor: folder.color }}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Subfolders */}
        {(listLoading || displayFolders.length > 0) && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Submodules</p>
              {!anyReorderMode && subfolders.length > 1 && (
                <button onClick={enterFolderReorder} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  <GripVertical className="w-3.5 h-3.5" /> Reorder
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <AnimatePresence mode="popLayout">
                {displayFolders.map((sub, idx) => (
                  <FolderCard
                    key={sub.id} folder={sub} index={idx}
                    onEdit={setEditFolder} onDelete={setDeleteFolder} onMove={setMoveFolderTarget}
                    reorderMode={folderReorderMode}
                    onMoveUp={() => moveFolderItem(idx, "up")}
                    onMoveDown={() => moveFolderItem(idx, "down")}
                    isFirst={idx === 0} isLast={idx === displayFolders.length - 1}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Question Sets */}
        {(setsLoading || displaySets.length > 0) && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Question Sets</p>
              <div className="flex items-center gap-3">
                {!anyReorderMode && questionSets.length > 1 && (
                  <button onClick={enterSetReorder} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    <GripVertical className="w-3.5 h-3.5" /> Reorder
                  </button>
                )}
                {!anyReorderMode && (
                  <button onClick={() => setNewSetOpen(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> New set
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <AnimatePresence mode="popLayout">
                {displaySets.map((set, idx) => (
                  <QuestionSetCard
                    key={set.id} set={set} index={idx}
                    folderColor={folder.color} folderId={folderId}
                    reorderMode={setReorderMode}
                    onMoveUp={() => moveSetItem(idx, "up")}
                    onMoveDown={() => moveSetItem(idx, "down")}
                    isFirst={idx === 0} isLast={idx === displaySets.length - 1}
                    onRenamed={(id, name) => setLocalSetOrder(prev => prev.map(s => s.id === id ? { ...s, name } : s))}
                  />
                ))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* Empty state */}
        {!listLoading && !setsLoading && !hasContent && (
          <div className="py-12 text-center space-y-3">
            <div
              className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center"
              style={{ backgroundColor: `${folder.color}20`, color: folder.color }}
            >
              <FolderIconComp className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground">This module is empty</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" className="gap-1.5 text-white" style={{ backgroundColor: folder.color }} onClick={() => setCreateOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Submodule
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewSetOpen(true)}>
                <BookMarked className="w-3.5 h-3.5" /> New Set
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30" onClick={() => setDecodeOpen(true)}>
                <BookOpen className="w-3.5 h-3.5" /> Decode
              </Button>
            </div>
          </div>
        )}

        {/* Inline new set form */}
        <AnimatePresence>
          {newSetOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-card border-t border-border px-4 py-4 space-y-3 shadow-2xl"
            >
              <p className="text-sm font-semibold text-foreground">New Question Set</p>
              <input
                autoFocus
                placeholder="Set name…"
                value={newSetName}
                onChange={e => setNewSetName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createNewSet()}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                placeholder="Type: mcq / cq / sq / mixed (optional)"
                value={newSetType}
                onChange={e => setNewSetType(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createNewSet()}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" className="flex-1" onClick={() => setNewSetOpen(false)}>Cancel</Button>
                <Button size="sm" className="flex-1 gap-1.5" onClick={createNewSet} disabled={newSetSaving || !newSetName.trim()}>
                  {newSetSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Create
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FolderFormDialog open={createOpen} onOpenChange={setCreateOpen} parentId={folder.id} />
      {editFolder && <FolderFormDialog open={true} onOpenChange={(open) => !open && setEditFolder(null)} initialData={editFolder} />}
      {deleteFolder && <DeleteFolderDialog open={true} onOpenChange={(open) => !open && setDeleteFolder(null)} folderId={deleteFolder.id} folderName={deleteFolder.name} isViewingSelf={deleteFolder.id === folder.id} />}
      <DecodeDialog open={decodeOpen} onOpenChange={setDecodeOpen} folderId={folderId} folderColor={folder.color} />
      <MoveFolderDialog folder={moveFolderTarget} onClose={() => setMoveFolderTarget(null)} onMoved={() => queryClient.invalidateQueries()} />
    </div>
  );
}
