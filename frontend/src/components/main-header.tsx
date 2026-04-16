import { SidebarTrigger } from "@/components/ui/sidebar";
import { useHealth } from "@/hooks/use-health";

export function MainHeader() {
  const { status, loading, error, checkHealth } = useHealth();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-secondary bg-page-bg px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-text-secondary hover:text-text-primary" />
      </div>
      <div className="flex items-center gap-3">
        {status && (
          <span className="text-green-400 font-mono text-[12px] tracking-wide">200 OK</span>
        )}
        {error && (
          <span className="text-destructive font-medium text-[12px]">Error: {error}</span>
        )}
        <button
          onClick={checkHealth}
          disabled={loading}
          className="text-[12px] font-medium text-text-secondary border border-border-primary rounded-md px-2.5 py-1 hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Checking..." : "Backend Health"}
        </button>
      </div>
    </header>
  );
}
