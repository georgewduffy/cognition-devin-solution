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
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {loading ? "Sending..." : "Send"}
        </Button>
      </div>
      {result && (
        <div className="w-full rounded-md border p-3 text-left">
          <p className="text-sm text-muted-foreground">
            Original: {result.original}
          </p>
          <p className="text-sm font-medium">Scrambled: {result.scrambled}</p>
        </div>
      )}
      {error && <p className="text-red-600 font-medium">Error: {error}</p>}
    </div>
  );
}
