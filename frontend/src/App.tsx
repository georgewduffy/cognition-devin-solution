import { HealthCheck } from "@/components/health-check";
import { TextScrambler } from "@/components/text-scrambler";

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">Dashboard</h1>
      <HealthCheck />
      <TextScrambler />
    </div>
  );
}

export default App;
