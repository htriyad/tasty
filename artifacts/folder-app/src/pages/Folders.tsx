import { useListFolders, useCreateFolder, getListFoldersQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderPlus, Folder as FolderIcon, Layers, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Folders() {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#8b5cf6");
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: rootFolders, isLoading } = useListFolders({ parentId: null });
  const { data: searchResults, isLoading: isSearching } = useListFolders(
    { search, flat: true },
    { query: { enabled: search.length > 2 } }
  );

  const createFolder = useCreateFolder();

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    createFolder.mutate(
      { data: { name: newFolderName, color: newFolderColor, parentId: null } },
      {
        onSuccess: () => {
          toast({ title: "Folder created successfully" });
          setIsCreateOpen(false);
          setNewFolderName("");
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey({ parentId: null }) });
        },
        onError: () => {
          toast({ title: "Failed to create folder", variant: "destructive" });
        }
      }
    );
  };

  const displayFolders = search.length > 2 ? searchResults : rootFolders;
  const isDisplayLoading = search.length > 2 ? isSearching : isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Folders</h1>
          <p className="text-muted-foreground mt-1">Manage your question bank hierarchy</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Root Folder</DialogTitle>
              <DialogDescription>
                Add a new top-level folder to organize your question sets.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFolder} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Folder Name</Label>
                <Input 
                  id="name" 
                  value={newFolderName} 
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Mathematics 2024"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color Label</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    id="color" 
                    value={newFolderColor} 
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input 
                    type="text" 
                    value={newFolderColor} 
                    onChange={(e) => setNewFolderColor(e.target.value)}
                    className="flex-1 font-mono uppercase"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createFolder.isPending || !newFolderName.trim()}>
                  {createFolder.isPending ? "Creating..." : "Create Folder"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search folders..." 
          className="pl-9 bg-card border-border"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isDisplayLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : displayFolders && displayFolders.length > 0 ? (
        <div className="grid gap-3">
          {displayFolders.map((folder) => (
            <Link key={folder.id} href={`/manage/folders/${folder.id}`}>
              <Card className="hover:bg-accent/50 transition-all cursor-pointer border-border group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div 
                      className="h-10 w-10 rounded-md flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: folder.color || 'hsl(var(--primary))' }}
                    >
                      <FolderIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium font-semibold group-hover:text-primary transition-colors">
                        {folder.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" /> 
                          {folder.childCount} subfolders
                        </span>
                        {folder.parentId && (
                          <span className="bg-secondary px-2 py-0.5 rounded-sm">Nested</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center border border-dashed rounded-lg bg-card/50">
          <FolderIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-20" />
          <h3 className="text-lg font-medium text-foreground">No folders found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {search.length > 0 ? "Try adjusting your search query." : "Get started by creating your first folder."}
          </p>
        </div>
      )}
    </div>
  );
}
