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

// ─── Single-URL + working back button ────────────────────────────────────────
// URL bar is always locked to "/".
// Every internal navigation pushes a browser history entry (same URL) so the
// phone/browser back button fires popstate — we catch it and go back internally.
// A sentinel entry at idx:-1 ensures pressing Back from the very first page
// bounces the browser forward instead of closing the tab.

const { hook: rawUseMemoryLocation } = memoryLocation({ path: "/" });

// Seed browser history once on load:
//   slot -1 (sentinel)  →  slot 0 (home)
// Must run before React renders so the slots are in place.
window.history.replaceState({ idx: -1 }, "");
window.history.pushState({ idx: 0 }, "");

function useBackableMemoryLocation(): [string, (to: string) => void] {
  const [path, memNavigate] = rawUseMemoryLocation();

  // Internal path stack — mirrors what would have been the URL history
  const stackRef = useRef<string[]>(["/"]);
  const idxRef  = useRef<number>(0);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const targetIdx: number =
        typeof e.state?.idx === "number" ? e.state.idx : -1;

      if (targetIdx < 0) {
        // Pressed Back past the sentinel — bounce forward, stay in app
        window.history.go(1);
        return;
      }

      idxRef.current = targetIdx;
      const targetPath = stackRef.current[targetIdx] ?? "/";
      memNavigate(targetPath);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [memNavigate]);

  const navigate = useCallback(
    (to: string) => {
      // Advance index, discard any forward history
      idxRef.current += 1;
      stackRef.current = stackRef.current.slice(0, idxRef.current);
      stackRef.current.push(to);

      // Push a browser history entry at the same URL so back button has
      // something to pop — works on both desktop and mobile (Android/iOS)
      window.history.pushState({ idx: idxRef.current }, "");

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
