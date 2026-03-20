import { useState, useEffect } from "react";

/**
 * Returns a counter that increments every `intervalMs` milliseconds.
 * Use as a dependency to force re-renders for live time displays.
 */
export function useTimeTick(intervalMs = 30000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}
