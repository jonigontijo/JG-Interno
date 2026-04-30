import { useRef, useEffect, useCallback } from "react";

/**
 * Horizontal "grab and drag" scrolling for any overflow container.
 * Works on ALL child elements (cards, columns, etc.).
 * Only skips buttons, links, and form inputs so they remain clickable.
 * Blocks native HTML5 drag-and-drop while the user is scrolling.
 */
export function useDragToScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({
    phase: "idle" as "idle" | "pending" | "scrolling",
    startX: 0,
    scrollLeft: 0,
  });

  const preventDrag = useCallback((e: Event) => {
    if (state.current.phase === "scrolling") e.preventDefault();
  }, []);

  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button !== 0) return;
    const container = ref.current;
    if (!container) return;

    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, select, textarea, .drag-handle, [draggable='true']")) return;

    state.current = {
      phase: "pending",
      startX: e.clientX,
      scrollLeft: container.scrollLeft,
    };
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    const { phase } = state.current;
    if (phase === "idle") return;

    const container = ref.current;
    if (!container) return;

    const dx = e.clientX - state.current.startX;

    if (phase === "pending" && Math.abs(dx) > 4) {
      state.current.phase = "scrolling";
      container.style.cursor = "grabbing";
      container.style.userSelect = "none";
    }

    if (state.current.phase === "scrolling") {
      e.preventDefault();
      container.scrollLeft = state.current.scrollLeft - dx;
    }
  }, []);

  const onMouseUp = useCallback(() => {
    const wasScrolling = state.current.phase === "scrolling";
    state.current.phase = "idle";

    const container = ref.current;
    if (container) {
      container.style.cursor = "grab";
      container.style.userSelect = "";
    }

    if (wasScrolling) {
      const blocker = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      document.addEventListener("click", blocker, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", blocker, { capture: true }), 0);
    }
  }, []);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    container.style.cursor = "grab";

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("dragstart", preventDrag, { capture: true });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("dragstart", preventDrag, { capture: true });
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseDown, onMouseMove, onMouseUp, preventDrag]);

  return ref;
}
