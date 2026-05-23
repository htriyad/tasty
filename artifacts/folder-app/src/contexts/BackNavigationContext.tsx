import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

interface BackEntry {
  fn: () => boolean;
  consumed: boolean;
}

interface BackNavContextType {
  pushBackHandler: (handler: () => boolean) => () => void;
}

const BackNavContext = createContext<BackNavContextType>({
  pushBackHandler: () => () => {},
});

const SPA_MARKER = "__spa_back__";

export function BackNavigationProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<BackEntry[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    window.history.pushState(
      { [SPA_MARKER]: true, depth: 0 },
      "",
      window.location.href,
    );

    const handlePopstate = (_e: PopStateEvent) => {
      for (let i = handlers.current.length - 1; i >= 0; i--) {
        const entry = handlers.current[i];
        if (entry.consumed) continue;

        entry.consumed = true;
        handlers.current.splice(i, 1);

        const intercept = entry.fn();
        if (intercept) {
          window.history.pushState(
            { [SPA_MARKER]: true, depth: handlers.current.length },
            "",
            window.location.href,
          );
        }
        return;
      }
    };

    window.addEventListener("popstate", handlePopstate);
    return () => {
      window.removeEventListener("popstate", handlePopstate);
      initialized.current = false;
    };
  }, []);

  const pushBackHandler = useCallback((handler: () => boolean): (() => void) => {
    const entry: BackEntry = { fn: handler, consumed: false };
    handlers.current.push(entry);

    window.history.pushState(
      { [SPA_MARKER]: true, depth: handlers.current.length },
      "",
      window.location.href,
    );

    let cleaned = false;
    return () => {
      if (cleaned) return;
      cleaned = true;
      const idx = handlers.current.indexOf(entry);
      if (idx !== -1) handlers.current.splice(idx, 1);
    };
  }, []);

  return (
    <BackNavContext.Provider value={{ pushBackHandler }}>
      {children}
    </BackNavContext.Provider>
  );
}

export function useBackNavigation() {
  return useContext(BackNavContext);
}
