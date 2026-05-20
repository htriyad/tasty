import { useParams, Link } from "wouter";
import { 
  useGetFolder, 
  getGetFolderQueryKey, 
  useListQuestionSets, 
  useGetFolderBreadcrumb,
  getGetFolderBreadcrumbQueryKey,
  getListQuestionSetsQueryKey,
  useListFolders
} from "@workspace/api-client-react";
import { ChevronRight, Folder as FolderIcon, Layers, Calendar, HelpCircle, FileText, ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function FolderDetail() {
  const { id } = useParams();
  const folderId = Number(id);

  const { data: folder, isLoading: folderLoading } = useGetFolder(folderId, {
    query: { enabled: !!folderId, queryKey: getGetFolderQueryKey(folderId) }
  });

  const { data: breadcrumbs, isLoading: breadcrumbsLoading } = useGetFolderBreadcrumb(folderId, {
    query: { enabled: !!folderId, queryKey: getGetFolderBreadcrumbQueryKey(folderId) }
  });

  const { data: subfolders, isLoading: subfoldersLoading } = useListFolders(
    { parentId: folderId },
    { query: { enabled: !!folderId } }
  );

  const { data: questionSets, isLoading: setsLoading } = useListQuestionSets(folderId, {
    query: { enabled: !!folderId, queryKey: getListQuestionSetsQueryKey(folderId) }
  });

  if (folderLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!folder) {
    return <div>Folder not found.</div>;
  }

  return (
    <div className="space-y-6">
      <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
        <Link href="/manage/folders" className="hover:text-primary transition-colors flex items-center">
          <FolderIcon className="w-4 h-4 mr-1" />
          Root
        </Link>
        {breadcrumbs?.map((crumb) => (
          <div key={crumb.id} className="flex items-center space-x-1">
            <ChevronRight className="w-4 h-4" />
            <Link 
              href={`/manage/folders/${crumb.id}`} 
              className={`transition-colors ${crumb.id === folderId ? "text-foreground font-medium pointer-events-none" : "hover:text-primary"}`}
            >
              {crumb.name}
            </Link>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <div 
          className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
          style={{ backgroundColor: folder.color || 'hsl(var(--primary))' }}
        >
          <FolderIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{folder.name}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1">
              <Layers className="h-4 w-4" /> {folder.childCount} children
            </span>
            <span>•</span>
            <span>Created {format(new Date(folder.createdAt), 'MMM d, yyyy')}</span>
          </p>
        </div>
      </div>

      {subfolders && subfolders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Subfolders</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {subfolders.map((sub) => (
              <Link key={sub.id} href={`/manage/folders/${sub.id}`}>
                <Card className="hover:bg-accent/50 transition-all cursor-pointer border-border group">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div 
                      className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: sub.color || 'hsl(var(--primary))' }}
                    >
                      <FolderIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h3 className="font-medium truncate group-hover:text-primary transition-colors text-sm">
                        {sub.name}
                      </h3>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Question Sets</h2>
        
        {setsLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : questionSets && questionSets.length > 0 ? (
          <div className="grid gap-3">
            {questionSets.map((set) => (
              <Link key={set.id} href={`/manage/sets/${set.id}`}>
                <Card className="hover:bg-accent/50 transition-all cursor-pointer border-border group">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors text-base">
                          {set.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          {set.examType && (
                            <span className="bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded font-medium">
                              {set.examType}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-3.5 w-3.5" /> 
                            {set.totalQuestions} Questions
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> 
                            {format(new Date(set.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground hidden sm:block group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed rounded-lg bg-card/50">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-20" />
            <h3 className="text-lg font-medium text-foreground">No question sets</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Import question sets into this folder to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
