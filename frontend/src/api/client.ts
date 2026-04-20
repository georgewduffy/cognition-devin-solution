const API_BASE = "http://localhost:8000";

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchTest(
  text: string
): Promise<{ original: string; scrambled: string }> {
  const res = await fetch(`${API_BASE}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Test request failed: ${res.status}`);
  return res.json();
}

export interface VulnerabilityIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  labels: string[];
  vulnerability_type: string | null;
}

export async function fetchVulnerabilities(): Promise<VulnerabilityIssue[]> {
  const res = await fetch(`${API_BASE}/github/vulnerabilities`);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = String((body as { detail: unknown }).detail);
      }
    } catch {
      // ignore
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json();
}
