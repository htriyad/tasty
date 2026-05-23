import { useState, useCallback, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Home } from "@/pages/Home";
import { Battle } from "@/pages/Battle";
import { FolderView } from "@/pages/FolderView";
import { QuestionSetView } from "@/pages/QuestionSetView";
import { MockExam } from "@/pages/MockExam";
import { Bookmarks } from "@/pages/Bookmarks";
import { WeakQuestions } from "@/pages/WeakQuestions";
import Dashboard from "@/pages/Dashboard";
import Folders from "@/pages/Folders";
import FolderDetail from "@/pages/FolderDetail";
import SetDetail from "@/pages/SetDetail";
import ImportPage from "@/pages/ImportPage";
import { AdminLogin } from "@/pages/AdminLogin";
import { AppLayout } from "@/components/layout/AppLayout";
import { ThemeProvider } from "@/lib/theme";
import { AdminProvider } from "@/contexts/AdminContext";
import {
  BackNavigationProvider,
  useBackNavigation,
} from "@/contexts/BackNavigationContext";

export { useTheme, ThemeContext } from "@/lib/theme";

// ─── Single-URL router ────────────────────────────────────────────────────────
//
// URL bar is always locked to "/".
//
// Every call to navigate() registers a back handler via BackNavigationProvider
// (the system the app already owns).  When the user presses the phone back
// button, Android hardware key, or iOS swipe, BackNavigationProvider fires the
// most-recently-registered handler, which calls setPath(previousPage).
//
// This means back navigation works identically to how the rest of the app
// handles it (modals, reorder-mode, etc.) — all through the same popstate
// pipeline — with no conflicts.

function useSingleUrlRouter(): [string, (to: string, ...args: unknown[]) => void] {
  const [path, setPath] = useState<string>("/");
  const { pushBackHandler } = useBackNavigation();
  const currentPathRef = useRef<string>("/");

  const navigate = useCallback(
    (to: string) => {
      const from = currentPathRef.current;
      currentPathRef.current = to;
      setPath(to);

      // Register a back handler so pressing back navigates to the previous page.
      // BackNavigationProvider handles popstate — no separate listener needed.
      pushBackHandler(() => {
        currentPathRef.current = from;
        setPath(from);
        return true; // intercept: stay in app, re-push guard automatically
      });
    },
    [pushBackHandler],
  );

  return [path, navigate];
}
// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Full-page views (own layout) */}
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/battle" component={Battle} />
      <Route path="/mock-exam" component={MockExam} />
      <Route path="/bookmarks" component={Bookmarks} />
      <Route path="/weak-questions" component={WeakQuestions} />
      <Route path="/folders/:id" component={FolderView} />
      <Route path="/sets/:id" component={QuestionSetView} />

      {/* Management views (sidebar layout) */}
      <Route path="/dashboard">
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/manage/folders">
        <AppLayout><Folders /></AppLayout>
      </Route>
      <Route path="/manage/folders/:id">
        <AppLayout><FolderDetail /></AppLayout>
      </Route>
      <Route path="/manage/sets/:id">
        <AppLayout><SetDetail /></AppLayout>
      </Route>
      <Route path="/import">
        <AppLayout><ImportPage /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AdminProvider>
          <BackNavigationProvider>
            <TooltipProvider>
              <WouterRouter hook={useSingleUrlRouter}>
                <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
                  <Router />
                </div>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </BackNavigationProvider>
        </AdminProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
