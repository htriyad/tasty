import { useEffect, useRef } from "react";
import { useBackNavigation } from "@/contexts/BackNavigationContext";

/**
 * Register a hardware/browser back-button handler while `enabled` is true.
 *
 * @param handler  Function to call when back is pressed.
 *                 Return `true`  → intercept the back (stay on page).
 *                 Return `false` → pass through (let browser navigate away).
 * @param enabled  Whether the handler is currently active.
 *
 * Handlers are stacked — the most recently registered active handler fires first.
 * When `enabled` flips to false (or the component unmounts) the handler is
 * automatically deregistered.
 */
export function useBackHandler(handler: () => boolean, enabled: boolean) {
  const { pushBackHandler } = useBackNavigation();

  // Keep a stable ref so the handler can close over fresh state without
  // causing the effect to re-run on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (enabled) {
      // Register a wrapper that always calls the *latest* handler
      cleanupRef.current = pushBackHandler(() => handlerRef.current());
    } else {
      cleanupRef.current?.();
      cleanupRef.current = null;
    }

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pushBackHandler]);
}
