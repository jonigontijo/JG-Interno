import { create } from "zustand";
import { useEffect } from "react";

// Contexto estruturado que cada página publica para a IA "enxergar" a tela atual.
interface AIContextState {
  label: string;                       // nome amigável da tela (ex: "Planilha de Postagens — JUNHO/26")
  data: unknown;                       // dados estruturados da tela (objeto/array)
  setContext: (label: string, data: unknown) => void;
  clearContext: () => void;
}

export const useAIContextStore = create<AIContextState>((set) => ({
  label: "",
  data: null,
  setContext: (label, data) => set({ label, data }),
  clearContext: () => set({ label: "", data: null }),
}));

/**
 * Hook para uma página publicar seu contexto para a IA.
 * Atualiza sempre que `deps` mudar e limpa ao desmontar.
 */
export function useAIPageContext(label: string, data: unknown, deps: unknown[] = []) {
  const setContext = useAIContextStore((s) => s.setContext);
  const clearContext = useAIContextStore((s) => s.clearContext);
  useEffect(() => {
    setContext(label, data);
    return () => clearContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, ...deps]);
}
