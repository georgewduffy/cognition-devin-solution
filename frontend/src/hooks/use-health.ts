import { useState, useRef } from "react";
import { fetchHealth } from "@/api/client";

export function useHealth() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const checkHealth = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const data = await fetchHealth();
      setStatus(data.status);
      timerRef.current = setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      timerRef.current = setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  return { status, loading, error, checkHealth };
}
