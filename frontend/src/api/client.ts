const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

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
  linked_pr_number: number | null;
  linked_pr_url: string | null;
  linked_pr_state: string | null;
  open_pr_number: number | null;
  open_pr_url: string | null;
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
  RESOLVED: "RESOLVED",
} as const;
export type DevinActionState =
  (typeof DevinActionState)[keyof typeof DevinActionState];

export interface FixIssueStatus {
  issue_id: number;
  state: DevinActionState;
  session_id: string | null;
  session_url: string | null;
  pr_url: string | null;
  acus_consumed: number | null;
  error: string | null;
}

export interface AutoResolveState {
  enabled: boolean;
}

async function parseError(res: Response): Promise<string> {
  let detail = res.statusText;
  try {
    const body = await res.json();
    if (body && typeof body === "object" && "detail" in body) {
      const raw = (body as { detail: unknown }).detail;
      if (typeof raw === "string") {
        detail = raw;
      } else if (Array.isArray(raw)) {
        // FastAPI validation errors come through as an array of
        // `{loc, msg, type}` objects — `String()` on that would
        // produce "[object Object]", so pick out the human-readable
        // `msg` fields instead.
        detail = raw
          .map((entry) => {
            if (
              entry &&
              typeof entry === "object" &&
              "msg" in entry &&
              typeof (entry as { msg: unknown }).msg === "string"
            ) {
              return (entry as { msg: string }).msg;
            }
            return JSON.stringify(entry);
          })
          .join("; ");
      } else if (raw && typeof raw === "object") {
        detail = JSON.stringify(raw);
      }
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

export function subscribeGitHubWebhookEvents(onEvent: () => void): () => void {
  const source = new EventSource(`${API_BASE}/github/webhook/events`);
  const listener = () => onEvent();

  source.addEventListener("github-webhook", listener);

  return () => {
    source.removeEventListener("github-webhook", listener);
    source.close();
  };
}

export async function fetchAutoResolveState(): Promise<AutoResolveState> {
  const res = await fetch(`${API_BASE}/devin/auto_resolve`);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

export async function updateAutoResolveState(
  enabled: boolean
): Promise<AutoResolveState> {
  const res = await fetch(`${API_BASE}/devin/auto_resolve`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json();
}

/**
 * Decode a `{ "<issue_id>": FixIssueStatus }` JSON map into a typed
 * `Record<number, FixIssueStatus>`. JSON object keys are always
 * strings, but on the client we key fix state by the numeric GitHub
 * issue id everywhere else, so we coerce back to `number` at the
 * boundary.
 */
function decodeStatusMap(
  raw: Record<string, FixIssueStatus>
): Record<number, FixIssueStatus> {
  const out: Record<number, FixIssueStatus> = {};
  for (const [key, value] of Object.entries(raw)) {
    const id = Number(key);
    if (Number.isFinite(id)) {
      out[id] = value;
    }
  }
  return out;
}

/**
 * Start Devin fix sessions for one or more vulnerability issues in
 * parallel. Both the per-row *Fix* button (array of length 1) and the
 * top-level *Fix All* / *Fix N Vulnerabilities* button hit this same
 * endpoint. The backend kicks off one Devin session per id
 * concurrently and returns the initial status for each.
 */
export async function startFixIssues(
  issue_ids: number[]
): Promise<Record<number, FixIssueStatus>> {
  const res = await fetch(`${API_BASE}/devin/fix_issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_ids }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return decodeStatusMap(await res.json());
}

/**
 * Batch-poll the latest fix status for a set of issue ids. Used by
 * the sync-time hydration and the periodic polling of rows that are
 * currently `FIXING`. Returns a map keyed by numeric issue id.
 */
export async function fetchFixIssueStatuses(
  issue_ids: number[]
): Promise<Record<number, FixIssueStatus>> {
  if (issue_ids.length === 0) return {};
  const res = await fetch(`${API_BASE}/devin/fix_issue/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issue_ids }),
  });
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return decodeStatusMap(await res.json());
}
