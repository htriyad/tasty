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

// ─── Single-URL router with working back button ───────────────────────────────
//
// Fully self-contained — no wouter memory-location internals involved.
//
// • URL bar is always locked to "/".
// • Every navigate() pushes a real browser history entry (same URL, different
//   state) so the phone back button, Android hardware key, iOS swipe, and
//   desktop ← button all fire popstate which we catch and handle.
// • The target path is stored IN the browser state object so it survives
//   mobile OS tab suspension (Android/iOS kill backgrounded tabs).
// • A sentinel entry at idx:-1 guards the bottom of the stack — if the user
//   presses Back from the very first page we bounce them forward instead of
//   closing the tab.
// • A lock flag prevents re-entrant handling from rapid back taps.

type NavState = { idx: number; path: string };

function useSingleUrlRouter(): [string, (to: string, ...args: unknown[]) => void] {
  const [path, setPath] = useState<string>("/");
  const idxRef  = useRef<number>(0);
  const lockRef = useRef<boolean>(false);

  useEffect(() => {
    // Slot -1: sentinel (before the app begins)
    // Slot  0: home
    window.history.replaceState({ idx: -1, path: "/" } satisfies NavState, "");
    window.history.pushState({ idx:  0, path: "/" } satisfies NavState, "");

    const onPopState = (e: PopStateEvent) => {
      if (lockRef.current) return;

      const state  = (e.state ?? {}) as Partial<NavState>;
      const idx    = typeof state.idx  === "number" ? state.idx  : -1;
      const target = typeof state.path === "string"  ? state.path : "/";

      // Sentinel hit — user pressed Back from the first page.
      // Bounce forward so the tab stays open.
      if (idx < 0) {
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
    // Push a real browser entry at the same URL — gives back button something to pop.
    // Path is embedded in state so it works even after mobile OS tab suspend.
    window.history.pushState({ idx: idxRef.current, path: to } satisfies NavState, "");
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
