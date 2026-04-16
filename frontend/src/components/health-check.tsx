import { useHealth } from "@/hooks/use-health";
import { Button } from "@/components/ui/button";

export function HealthCheck() {
  const { status, loading, error, checkHealth } = useHealth();

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={checkHealth}
        disabled={loading}
        className="bg-brand-blue hover:bg-brand-blue/80 text-white"
      >
        {loading ? "Checking..." : "Check Backend Health"}
      </Button>
      {status && (
        <p className="text-green-400 font-mono text-[12px] tracking-wide">200 OK</p>
      )}
      {error && <p className="text-destructive font-medium text-[13px]">Error: {error}</p>}
    </div>
  );
}
