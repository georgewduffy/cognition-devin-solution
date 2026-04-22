import { useContext } from "react";

import { AutoResolveContext } from "@/hooks/auto-resolve-context";

export function useAutoResolve() {
  const context = useContext(AutoResolveContext);
  if (!context) {
    throw new Error("useAutoResolve must be used within AutoResolveProvider");
  }
  return context;
}
