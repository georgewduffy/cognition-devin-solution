from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings


class GitHubClient:
    """Async HTTP client for the GitHub REST API.

    Wraps httpx.AsyncClient with auth preconfigured from Settings and exposes
    the handful of issue/user endpoints this app needs. One instance per
    request; call `aclose()` when done.
    """

    def __init__(self, settings: Settings, timeout: float = 30.0):
        self.owner = settings.github_owner
        self.repo = settings.github_repo
        self._client = httpx.AsyncClient(
            base_url="https://api.github.com",
            headers={
                "Authorization": f"Bearer {settings.github_token.get_secret_value()}",
                "Accept": "application/vnd.github+json",
            },
            timeout=timeout,
        )

    async def aclose(self) -> None:
        """Close the underlying HTTP connection pool."""
        await self._client.aclose()

    async def whoami(self) -> dict[str, Any]:
        """Return the authenticated user."""
        resp = await self._client.get("/user")
        resp.raise_for_status()
        return resp.json()

    async def create_issue(
        self,
        title: str,
        body: str | None = None,
        labels: list[str] | None = None,
        assignees: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create an issue in the configured repo."""
        payload: dict[str, Any] = {"title": title}
        if body is not None:
            payload["body"] = body
        if labels:
            payload["labels"] = labels
        if assignees:
            payload["assignees"] = assignees
        resp = await self._client.post(
            f"/repos/{self.owner}/{self.repo}/issues", json=payload
        )
        resp.raise_for_status()
        return resp.json()

    async def get_issue(self, number: int) -> dict[str, Any]:
        """Fetch a single issue by number."""
        resp = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/issues/{number}"
        )
        resp.raise_for_status()
        return resp.json()

    async def list_issue_comments(self, number: int) -> list[dict[str, Any]]:
        """List comments on an issue."""
        resp = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/issues/{number}/comments"
        )
        resp.raise_for_status()
        return resp.json()

    async def list_issues(
        self, state: str = "open", per_page: int = 30
    ) -> list[dict[str, Any]]:
        """List issues in the configured repo."""
        resp = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/issues",
            params={"state": state, "per_page": per_page},
        )
        resp.raise_for_status()
        return resp.json()

    async def get_pull_request(self, number: int) -> dict[str, Any]:
        """Fetch a pull request by number from the configured repo."""
        resp = await self._client.get(
            f"/repos/{self.owner}/{self.repo}/pulls/{number}"
        )
        resp.raise_for_status()
        return resp.json()

    async def find_linked_pull_request_for_issue(
        self,
        number: int,
        per_page: int = 100,
    ) -> dict[str, Any] | None:
        """Return a linked PR from an issue's timeline, preferring open PRs."""
        page = 1
        first_linked_pr: dict[str, Any] | None = None
        while True:
            resp = await self._client.get(
                f"/repos/{self.owner}/{self.repo}/issues/{number}/timeline",
                params={"per_page": per_page, "page": page},
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                return first_linked_pr

            for event in batch:
                pr = self._linked_pr_from_timeline_event(event)
                if pr is None:
                    continue
                if pr.get("state") == "open":
                    return pr
                if first_linked_pr is None:
                    first_linked_pr = pr

            if len(batch) < per_page:
                return first_linked_pr
            page += 1

    async def list_issues_by_label(
        self,
        label: str,
        state: str = "all",
        per_page: int = 100,
    ) -> list[dict[str, Any]]:
        """List issues in the configured repo filtered by a label name.

        Returns every matching issue (paginates when necessary). Pull requests
        are filtered out — the GitHub `/issues` endpoint returns both issues
        and PRs, and PR payloads carry a `pull_request` key.
        """
        issues: list[dict[str, Any]] = []
        page = 1
        while True:
            resp = await self._client.get(
                f"/repos/{self.owner}/{self.repo}/issues",
                params={
                    "labels": label,
                    "state": state,
                    "per_page": per_page,
                    "page": page,
                },
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            issues.extend(i for i in batch if "pull_request" not in i)
            if len(batch) < per_page:
                break
            page += 1
        return issues

    @staticmethod
    def _linked_pr_from_timeline_event(event: dict[str, Any]) -> dict[str, Any] | None:
        candidates: list[dict[str, Any]] = []
        source = event.get("source")
        if isinstance(source, dict) and isinstance(source.get("issue"), dict):
            candidates.append(source["issue"])

        for key in ("subject", "pull_request"):
            value = event.get(key)
            if isinstance(value, dict):
                candidates.append(value)

        for candidate in candidates:
            html_url = candidate.get("html_url")
            is_pull_request = "pull_request" in candidate or (
                isinstance(html_url, str) and "/pull/" in html_url
            )
            if not is_pull_request:
                continue
            return {
                "number": candidate.get("number"),
                "html_url": html_url,
                "state": candidate.get("state"),
            }

        return None
