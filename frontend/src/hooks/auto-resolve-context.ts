import { createContext } from "react";

export interface AutoResolveContextValue {
  enabled: boolean;
  pending: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
}

export const AutoResolveContext =
  createContext<AutoResolveContextValue | null>(null);
