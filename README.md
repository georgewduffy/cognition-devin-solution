# Cognition Devin Solution

Event-driven vulnerability remediation system for a fork of Apache Superset.

This project demonstrates how an engineering team can use the Devin API as an automation primitive: GitHub vulnerability issues are ingested into a dashboard, optionally trigger Devin remediation sessions automatically, and surface observable progress through issue status, Devin session links, PR links, webhook delivery state, and backend logs.

## What Runs

Docker Compose starts the full local system:

- `backend`: FastAPI service on `http://localhost:8000`
- `frontend`: production-built React app served by nginx on `http://localhost:5173`
- `ngrok`: optional tunnel profile for GitHub webhooks, with the inspector on `http://localhost:4040`

The host machine only needs Docker. Python, Node, npm, uv, and nginx all run inside containers.

## Prerequisites

- Docker Desktop, or Docker Engine with Docker Compose v2
- A Devin API key and organization ID
- A GitHub personal access token for your Superset fork
- Admin access to the GitHub repository if you want to configure webhooks
- An ngrok account token for webhook testing

Recommended GitHub token capabilities:

- Read repository metadata
- Read/write issues
- Read pull requests
- Access to the configured forked repository

If you configure webhooks manually in the GitHub UI, repo admin access is enough. If you later automate webhook creation, the token also needs repository webhook/admin permission.

## Configure

There are two env files:

- `.env` controls Docker Compose settings such as local ports and the optional ngrok token.
- `backend/.env` controls application credentials used by the FastAPI backend.

Create both from the checked-in examples:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

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

Fill in `.env` only if you need to change local Docker defaults or run ngrok:

```bash
BACKEND_PORT=8000
FRONTEND_PORT=5173
VITE_API_BASE_URL=http://localhost:8000
NGROK_AUTHTOKEN=...
NGROK_WEB_INTERFACE_PORT=4040
```

If you change `BACKEND_PORT`, also update `VITE_API_BASE_URL` and rebuild the frontend image because the browser API URL is compiled into the React bundle.

## Run The App

Build and start frontend and backend:

```bash
docker compose up --build
```

Open the dashboard:

```text
http://localhost:5173/vulnerabilities
```

Useful health checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8000/devin/auto_resolve
```

Expected auto-resolve response before you toggle it on:

```json
{"enabled":false}
```

To stop the app:

```bash
docker compose down
```

## Run With Ngrok

GitHub cannot call `localhost`, so webhook testing needs a public HTTPS tunnel. This repository runs ngrok through Docker as an optional Compose profile.

First put your ngrok token in `.env`:

```bash
NGROK_AUTHTOKEN=...
```

Then start the app with the tunnel:

```bash
docker compose --profile tunnel up --build
```

Find the public forwarding URL:

```bash
curl http://localhost:4040/api/tunnels
```

You can also open the ngrok inspector:

```text
http://localhost:4040
```

Use the HTTPS forwarding URL as your GitHub webhook base URL. The full payload URL should be:

```text
https://<your-ngrok-domain>/github/webhook
```

Configure the webhook in your Superset fork:

1. Go to `Settings -> Webhooks`.
2. Click `Add webhook`.
3. Set `Payload URL` to `https://<your-ngrok-domain>/github/webhook`.
4. Set `Content type` to `application/json`.
5. Set `Secret` to the same value as `GITHUB_WEBHOOK_SECRET` in `backend/.env`.
6. Select individual events and enable `Issues`.
7. Optionally enable `Pull requests` for PR state refreshes.
8. Save the webhook and confirm GitHub shows `200 OK` in Recent Deliveries.

Free ngrok URLs usually change when the tunnel restarts. If the URL changes, update the GitHub webhook payload URL.

## Simulate The Workflow

Manual sync:

1. Open `http://localhost:5173/vulnerabilities`.
2. Click the refresh icon.
3. Issues in the configured GitHub repository with the `vulnerability` label should appear.

Event-driven sync with auto remediation off:

1. Keep Compose and ngrok running.
2. Keep `Auto` toggled off in the Vulnerabilities header.
3. Create a GitHub issue in the configured repo.
4. Add the `vulnerability` label when creating it, or add the label after creation.
5. The issue should appear automatically in the frontend.
6. Devin should not start automatically.

Event-driven auto remediation:

1. Toggle `Auto` on in the Vulnerabilities header.
2. Create or label one GitHub issue with `vulnerability`.
3. The issue should appear automatically.
4. Only that newly received issue should start a Devin session.
5. The row should progress through:

```text
Identified -> Waking Devin up -> Working -> PR Ready -> Resolved
```

Use the row action links to inspect the Devin session and generated PR.

## Observability

For an engineering leader, the main question is whether the system is finding work, starting remediation, and producing PRs. The local signals are:

- Dashboard rows show each vulnerability issue and its current remediation state.
- Each active row links to the Devin session when one has started.
- Completed rows link to the generated pull request when available.
- Backend logs show webhook ingestion, GitHub sync, Devin session creation, and failures:

  ```bash
  docker compose logs -f backend
  ```

- GitHub webhook Recent Deliveries shows whether GitHub reached the backend.
- The ngrok inspector shows inbound webhook requests and backend responses:

  ```text
  http://localhost:4040
  ```

Container health is visible with:

```bash
docker compose ps
```

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

## Troubleshooting

If a port is already taken, edit `.env` and rerun `docker compose up --build`.

If the frontend cannot reach the backend, confirm `VITE_API_BASE_URL` matches the host backend URL and rebuild the frontend image.

If GitHub webhook deliveries fail, check all of these:

- Compose was started with `--profile tunnel`.
- `NGROK_AUTHTOKEN` is set in `.env`.
- The GitHub webhook uses the current ngrok HTTPS URL.
- The webhook secret exactly matches `GITHUB_WEBHOOK_SECRET`.
- The backend container is healthy in `docker compose ps`.

If credentials or environment values change, restart the containers:

```bash
docker compose down
docker compose up --build
```
