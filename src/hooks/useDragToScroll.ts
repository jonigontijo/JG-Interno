import { useRef, useEffect, useCallback } from "react";

/**
 * Enables horizontal "grab and drag" scrolling on a container.
 * Skips activation when the mousedown target is (or is inside) a [draggable="true"] element
 * so it doesn't conflict with native HTML5 drag-and-drop on kanban cards.
 */
export function useDragToScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = useCallback((e: MouseEvent) => {
    const container = ref.current;
    if (!container) return;

    const target = e.target as HTMLElement;
    if (target.closest("[draggable='true']") || target.closest("button, a, input, select, textarea")) return;

    state.current = {
      isDown: true,
      startX: e.pageX - container.offsetLeft,
      scrollLeft: container.scrollLeft,
    };
    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!state.current.isDown) return;
    const container = ref.current;
    if (!container) return;

    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - state.current.startX) * 1.5;
    container.scrollLeft = state.current.scrollLeft - walk;
  }, []);

  const onMouseUp = useCallback(() => {
    state.current.isDown = false;
    const container = ref.current;
    if (container) {
      container.style.cursor = "grab";
      container.style.userSelect = "";
    }
  }, []);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    container.style.cursor = "grab";
    container.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseDown, onMouseMove, onMouseUp]);

  return ref;
}
