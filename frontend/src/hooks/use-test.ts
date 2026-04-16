import { useState } from "react";
import { fetchTest } from "@/api/client";

export function useTest() {
  const [result, setResult] = useState<{
    original: string;
    scrambled: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTest = async (text: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTest(text);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, sendTest };
}
