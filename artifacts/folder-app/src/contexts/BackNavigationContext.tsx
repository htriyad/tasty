import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

/**
 * A back-handler entry on the stack.
 * fn()  → returns true  → intercept (re-push guard state so back is "neutralised")
 * fn()  → returns false → pass through (don't re-push; browser navigates away)
 */
interface BackEntry {
  fn: () => boolean;
  consumed: boolean;
}

interface BackNavContextType {
  /** Register a handler that fires when the hardware/browser back button is pressed.
   *  Returns a cleanup function to deregister the handler. */
  pushBackHandler: (handler: () => boolean) => () => void;
}

const BackNavContext = createContext<BackNavContextType>({
  pushBackHandler: () => () => {},
});

const SPA_MARKER = "__spa_back__";

// Tag used by the single-URL router — BackNavigationProvider must not touch
// these entries; the router owns them entirely.
const ROUTER_MARKER = "_router";

export function BackNavigationProvider({ children }: { children: ReactNode }) {
  const handlers = useRef<BackEntry[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Push an initial guard so pressing back from the very first page doesn't
    // immediately close the app — home registers its own handler on top of this.
    window.history.pushState(
      { [SPA_MARKER]: true, depth: 0 },
      "",
      window.location.href,
    );

    const handlePopstate = (e: PopStateEvent) => {
      // Router-owned entries — let the router's own listener handle these.
      if (e.state?.[ROUTER_MARKER] === true) return;

      // Walk from the top of the stack to find the first live (non-consumed) entry
      for (let i = handlers.current.length - 1; i >= 0; i--) {
        const entry = handlers.current[i];
        if (entry.consumed) continue;

        entry.consumed = true;
        handlers.current.splice(i, 1); // remove from stack immediately

        const intercept = entry.fn();
        if (intercept) {
          // Neutralise the back: re-push a guard state so there's still
          // something for back to consume if handlers remain
          window.history.pushState(
            { [SPA_MARKER]: true, depth: handlers.current.length },
            "",
            window.location.href,
          );
        }
        // if !intercept: don't re-push — let the browser navigate away
        return;
      }
      // No handlers → normal browser navigation (wouter handles it)
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

    // Push a real history state (same URL) so back has something to consume
    window.history.pushState(
      { [SPA_MARKER]: true, depth: handlers.current.length },
      "",
      window.location.href,
    );

    // Return cleanup — idempotent (safe to call multiple times)
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
