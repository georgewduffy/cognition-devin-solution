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
