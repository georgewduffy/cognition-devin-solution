import { useHealth } from "@/hooks/use-health";
import { Button } from "@/components/ui/button";

export function HealthCheck() {
  const { status, loading, error, checkHealth } = useHealth();

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={checkHealth}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {loading ? "Checking..." : "Check Health"}
      </Button>
      {status && (
        <p className="text-green-600 font-medium">Status: {status}</p>
      )}
      {error && <p className="text-red-600 font-medium">Error: {error}</p>}
    </div>
  );
}
