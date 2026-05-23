import { useState, useEffect, useCallback, useRef } from "react";
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
import { BackNavigationProvider } from "@/contexts/BackNavigationContext";

export { useTheme, ThemeContext } from "@/lib/theme";

// ─── Single-URL router with coordinated back-button support ──────────────────
//
// URL bar is always locked to "/".
//
// This router and BackNavigationProvider both listen to popstate. They
// coordinate via a marker in the history state:
//   { _router: true, idx, path }  → owned by this router
//   { __spa_back__: true, depth } → owned by BackNavigationProvider
//
// Each system only handles entries it owns — no conflicts.
//
// Sentinel at idx:-1 means "before the app" — pressing back from the first
// page bounces forward so the tab never closes unexpectedly.

const ROUTER_MARKER = "_router" as const;
type RouterState = { _router: true; idx: number; path: string };

function isRouterState(s: unknown): s is RouterState {
  return typeof s === "object" && s !== null && (s as RouterState)._router === true;
}

function useSingleUrlRouter(): [string, (to: string, ...args: unknown[]) => void] {
  const [path, setPath] = useState<string>("/");
  const idxRef  = useRef<number>(0);
  const lockRef = useRef<boolean>(false);

  useEffect(() => {
    // Seed browser history:
    //   slot -1: sentinel (before the app begins, _router owned)
    //   slot  0: home
    window.history.replaceState(
      { [ROUTER_MARKER]: true, idx: -1, path: "/" } satisfies RouterState,
      "",
    );
    window.history.pushState(
      { [ROUTER_MARKER]: true, idx: 0, path: "/" } satisfies RouterState,
      "",
    );

    const onPopState = (e: PopStateEvent) => {
      // Only handle entries we own
      if (!isRouterState(e.state)) return;
      if (lockRef.current) return;

      const { idx, path: target } = e.state;

      if (idx < 0) {
        // Sentinel — user pressed Back from the very first page.
        // Bounce forward so the tab stays open.
        lockRef.current = true;
        window.history.go(1);
        setTimeout(() => { lockRef.current = false; }, 150);
        return;
      }

      idxRef.current = idx;
      setPath(target);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (lockRef.current) return;
    idxRef.current += 1;
    window.history.pushState(
      { [ROUTER_MARKER]: true, idx: idxRef.current, path: to } satisfies RouterState,
      "",
    );
    setPath(to);
  }, []);

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
