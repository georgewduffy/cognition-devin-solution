import { useState } from "react";
import { useTest } from "@/hooks/use-test";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TextScrambler() {
  const [text, setText] = useState("");
  const { result, loading, error, sendTest } = useTest();

  const handleSend = () => {
    if (text.trim()) {
      sendTest(text);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md">
      <div className="flex w-full gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to scramble..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button
          onClick={handleSend}
          disabled={loading || !text.trim()}
          className="bg-accent-blue hover:bg-accent-blue/80 text-white"
        >
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>
      {result && (
        <div className="w-full rounded-md bg-elevated border border-border-primary p-3 text-left">
          <p className="text-[13px] text-text-secondary">
            Original: {result.original}
          </p>
          <p className="text-[13px] font-medium text-text-primary">Scrambled: {result.scrambled}</p>
        </div>
      )}
      {error && <p className="text-destructive font-medium text-[13px]">Error: {error}</p>}
    </div>
  );
}
