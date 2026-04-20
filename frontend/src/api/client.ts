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

/**
 * State of the Devin fix session attached to a vulnerability row.
 *
 * Mirrors the backend `DevinActionState` enum. `REQUEST_SENT` is set
 * optimistically on the client the moment the user clicks *Fix*, and
 * flips to `FIXING` as soon as `POST /devin/fix_issue` returns 200.
 *
 * Written as a `const` object rather than a TS `enum` so it's compatible
 * with the repo's `erasableSyntaxOnly` tsconfig — the shape at runtime
 * and use-site ergonomics match a string enum.
 */
export const DevinActionState = {
  NOT_FIXED: "NOT_FIXED",
  REQUEST_SENT: "REQUEST_SENT",
  FIXING: "FIXING",
  FIXED: "FIXED",
} as const;
export type DevinActionState =
  (typeof DevinActionState)[keyof typeof DevinActionState];

export interface FixIssueStatus {
  issue_id: number;
  state: DevinActionState;
  session_id: string | null;
  session_url: string | null;
  pr_url: string | null;
  error: string | null;
}

async function parseError(res: Response): Promise<string> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    if (body && typeof body === "object" && "detail" in body) {
      detail = String((body as { detail: unknown }).detail);
    }
  } catch {
    // ignore
  }
  return detail || `Request failed: ${res.status}`;
}

export async function fetchVulnerabilities(): Promise<VulnerabilityIssue[]> {
  const res = await fetch(`${API_BASE}/github/vulnerabilities`);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

export async function startFixIssue(
  issue_id: number
): Promise<FixIssueStatus> {
  const res = await fetch(`${API_BASE}/devin/fix_issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_id }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

export async function fetchFixIssueStatus(
  issue_id: number
): Promise<FixIssueStatus> {
  const res = await fetch(`${API_BASE}/devin/fix_issue/${issue_id}`);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}
