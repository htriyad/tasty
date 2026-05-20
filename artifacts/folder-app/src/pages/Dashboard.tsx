import { useGetFolderStats, useListFolders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderIcon, Database, Layers, LayoutGrid, Clock } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetFolderStats();
  const { data: recentFolders, isLoading: foldersLoading } = useListFolders({ flat: true });

  const sortedFolders = recentFolders
    ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your question bank library</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Folders</CardTitle>
            <FolderIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalFolders || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Root Folders</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.rootFolders || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Max Depth</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{stats?.maxDepth || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-primary">System Status</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Online</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Recent Folders</h2>
          <Link href="/manage/folders" className="text-sm text-primary hover:underline">
            View all folders
          </Link>
        </div>
        
        {foldersLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {sortedFolders?.map((folder) => (
              <Link key={folder.id} href={`/manage/folders/${folder.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-border group">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div 
                      className="h-10 w-10 rounded-md flex items-center justify-center shrink-0 shadow-sm"
                      style={{ backgroundColor: folder.color || 'hsl(var(--primary))' }}
                    >
                      <FolderIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                        {folder.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" /> {folder.childCount}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> 
                          {format(new Date(folder.createdAt), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {sortedFolders?.length === 0 && (
              <div className="col-span-full py-8 text-center text-muted-foreground border border-dashed rounded-lg">
                No folders found. Get started by creating one.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
