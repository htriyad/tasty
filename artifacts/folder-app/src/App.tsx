import { useEffect, useCallback, useRef } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { memoryLocation } from "wouter/memory-location";
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

// ─── Dynamic single-URL router with full back-button support ─────────────────
//
// How it works:
//   • URL bar is ALWAYS locked to "/" — never changes.
//   • Every internal navigate() pushes a real browser history entry (same URL,
//     different state) so the phone back button, Android hardware key, iOS
//     swipe gesture, and desktop Alt+← all fire popstate correctly.
//   • The target path is stored INSIDE the browser state object — not just a
//     JS array. This means it survives tab suspension on mobile (OS kills the
//     tab in background, user reopens it and presses back — still works).
//   • A sentinel entry at idx:-1 sits before the first page. If the user
//     presses Back from the very first page, we detect idx<0 and call
//     history.go(+1) to bounce back in — the tab never closes unexpectedly.
//   • A lock flag prevents re-entrant navigation from rapid back-taps.

const { hook: rawUseMemoryLocation } = memoryLocation({ path: "/" });

// Seed browser history on first load:
//   [idx:-1, sentinel] → [idx:0, home="/"]
// replaceState overwrites the initial blank entry; pushState adds home on top.
window.history.replaceState({ idx: -1, path: "/" }, "");
window.history.pushState({ idx: 0, path: "/" }, "");

type HistoryState = { idx: number; path: string };

function useBackableMemoryLocation(): [string, (to: string) => void] {
  const [path, memNavigate] = rawUseMemoryLocation();
  const idxRef  = useRef<number>(0);
  const lockRef = useRef<boolean>(false); // blocks re-entrant popstate handling

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (lockRef.current) return;

      const state = (e.state ?? {}) as Partial<HistoryState>;
      const targetIdx  = typeof state.idx  === "number" ? state.idx  : -1;
      const targetPath = typeof state.path === "string"  ? state.path : "/";

      // Hit the sentinel — user pressed Back from the very first page.
      // Bounce forward so the tab stays open.
      if (targetIdx < 0) {
        lockRef.current = true;
        window.history.go(1);
        // Release lock after the go(1) history event settles
        setTimeout(() => { lockRef.current = false; }, 100);
        return;
      }

      idxRef.current = targetIdx;
      memNavigate(targetPath);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [memNavigate]);

  const navigate = useCallback(
    (to: string) => {
      if (lockRef.current) return;
      idxRef.current += 1;
      // Push with the target path embedded in state — survives mobile tab suspend
      window.history.pushState({ idx: idxRef.current, path: to } satisfies HistoryState, "");
      memNavigate(to);
    },
    [memNavigate]
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
              <WouterRouter hook={useBackableMemoryLocation}>
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
