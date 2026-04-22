# Cognition Devin Solution

Event-driven vulnerability remediation system for a fork of Apache Superset.

This project demonstrates how an engineering team can use the Devin API as an automation primitive: GitHub vulnerability issues are ingested into a dashboard, optionally trigger Devin remediation sessions automatically, and surface observable progress through issue status, Devin session links, PR links, and backend logs.

## What This Builds

The system connects three pieces:

- **GitHub** is the source of vulnerability work. Issues labeled `vulnerability` in the configured repository appear in the dashboard.
- **FastAPI backend** receives GitHub webhooks, verifies signatures, syncs vulnerability issues, and starts/polls Devin sessions.
- **React frontend** shows a Vulnerabilities table, live-updates when GitHub sends issue events, and provides manual or automatic remediation controls.

Core workflow:

1. A vulnerability issue is created or labeled in GitHub.
2. GitHub sends an `issues` webhook to the backend.
3. The backend publishes a server-sent event to connected browsers.
4. The frontend silently re-syncs the table from GitHub.
5. If **Auto** is enabled, only the newly received vulnerability issue is reserved and sent to Devin for remediation.
6. Devin opens a PR; the dashboard updates from `Identified` to `Working`, `PR Ready`, or `Resolved`.

## Requirements

- Python `3.12+`
- `uv`
- Node.js and npm
- A Devin API key and organization ID
- A GitHub personal access token for your Superset fork
- Admin access to the GitHub repository if you want to configure webhooks
- `ngrok` or another public HTTPS tunnel for local webhook testing

Recommended GitHub token capabilities:

- Read repository metadata
- Read/write issues
- Read pull requests
- Access to the configured forked repository

If you use the token to manage webhooks programmatically, it also needs repository webhook/admin permission. If you configure webhooks manually in the GitHub UI, repo admin access is enough.

## Project Structure

```text
backend/
  app/
    github/       GitHub REST client, issue sync, signed webhook receiver, SSE events
    devin/        Devin API client, fix-session registry, auto-resolve state
    main.py       FastAPI app and CORS setup
frontend/
  src/
    pages/        Vulnerabilities dashboard and table
    hooks/        Vulnerability sync and global auto-resolve state
    api/          Browser API client
```

## Backend Setup

Create `backend/.env`:

```bash
DEVIN_API_KEY=...
DEVIN_ORG_ID=...
DEVIN_CREATE_AS_USER_ID=...
DEVIN_API_BASE_URL=https://api.devin.ai/v3

GITHUB_TOKEN=...
GITHUB_OWNER=your-github-user-or-org
GITHUB_REPO=your-superset-fork
GITHUB_WEBHOOK_SECRET=choose-a-high-entropy-random-secret

LOG_LEVEL=INFO
```

Install and run:

```bash
cd backend
uv sync
PYTHONPATH=. uv run uvicorn app.main:app --reload --port 8000
```

Health checks:

```bash
curl http://localhost:8000/github/whoami
curl http://localhost:8000/devin/auto_resolve
```

Run the integration smoke test:

```bash
cd backend
PYTHONPATH=. uv run python scripts/test_integrations.py
```

## Docker Setup

The solution app can also be run with Docker Compose:

```bash
cp backend/.env.example backend/.env
# Fill in DEVIN_*, GITHUB_* and GITHUB_WEBHOOK_SECRET in backend/.env
docker compose up --build
```

Open:

```text
http://localhost:5173/vulnerabilities
```

The backend is exposed on:

```text
http://localhost:8000
```

For GitHub webhook testing with ngrok, point the GitHub webhook payload URL at:

```text
https://<your-ngrok-domain>/github/webhook
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173/vulnerabilities
```

Build and lint:

```bash
cd frontend
npm run build
npm run lint
```

The lint command may show a TanStack Table React Compiler warning; it is non-blocking.

## GitHub Webhook Setup For Local Testing

GitHub cannot call `localhost`, so expose the backend through ngrok:

```bash
ngrok http 8000
```

Copy the HTTPS forwarding URL, for example:

```text
https://example.ngrok-free.dev
```

Test that it reaches the backend:

```bash
curl https://example.ngrok-free.dev/devin/auto_resolve
```

Expected:

```json
{"enabled":false}
```

In your GitHub fork:

1. Go to **Settings -> Webhooks**.
2. Click **Add webhook** or edit the existing webhook.
3. Set **Payload URL** to:

   ```text
   https://example.ngrok-free.dev/github/webhook
   ```

4. Set **Content type** to `application/json`.
5. Set **Secret** to exactly the same value as `GITHUB_WEBHOOK_SECRET`.
6. Select **Let me select individual events**.
7. Enable:
   - **Issues**
   - **Pull requests** optional, but recommended for PR state refreshes
8. Ensure **Active** is checked.
9. Save the webhook.

Use **Recent Deliveries** in the GitHub webhook page to verify GitHub receives `200 OK`.

Important: free ngrok URLs usually change when ngrok restarts. If the URL changes, update the GitHub webhook payload URL again.

## Simulating The Workflow

### Manual Sync

1. Open the Vulnerabilities page.
2. Click the refresh icon.
3. Issues in the configured GitHub repository with the `vulnerability` label should appear.

### Event-Driven Sync With Auto Off

1. Keep backend, frontend, and ngrok running.
2. Keep **Auto** toggled off in the Vulnerabilities header.
3. Create a GitHub issue in the configured repo.
4. Add the `vulnerability` label when creating it, or add the label after creation.
5. The issue should appear automatically in the frontend.
6. Devin should not start automatically.

Expected status: `Identified`.

### Event-Driven Auto Remediation

1. Toggle **Auto** on in the Vulnerabilities header.
2. Create or label one GitHub issue with `vulnerability`.
3. The issue should appear automatically.
4. Only that newly received issue should start a Devin session.
5. The row should progress through:

```text
Identified -> Waking Devin up -> Working -> PR Ready -> Resolved
```

Use the row action links to inspect the Devin session and generated PR.

## API Summary

GitHub:

- `GET /github/whoami`
- `GET /github/vulnerabilities`
- `POST /github/issues`
- `POST /github/webhook`
- `GET /github/webhook/events`

Devin:

- `POST /devin/fix_issue`
- `POST /devin/fix_issue/status`
- `GET /devin/auto_resolve`
- `PUT /devin/auto_resolve`

## Demo Script

For a short technical demo:

1. Start with the problem: vulnerability issues arrive faster than teams can triage and remediate.
2. Show the dashboard with identified GitHub issues.
3. Create or label a new GitHub issue and show it appearing without manual refresh.
4. Toggle **Auto** on and create another vulnerability issue.
5. Show the row moving into Devin-managed remediation.
6. Open the Devin session and generated PR.
7. Close with observability: status table, PR links, session links, backend logs, and GitHub deliveries.

The intended business impact: reduce vulnerability remediation latency while preserving engineer visibility and control.
