from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings


class DevinClient:
    """Async HTTP client for the Devin v3 Organization API.

    Wraps httpx.AsyncClient with bearer auth and a base URL scoped to the
    configured organization. One instance per request; call `aclose()` when
    done.
    """

    def __init__(self, settings: Settings, timeout: float = 30.0):
        self._org_id = settings.devin_org_id
        self._create_as_user_id = settings.devin_create_as_user_id
        self._client = httpx.AsyncClient(
            base_url=settings.devin_api_base_url,
            headers={
                "Authorization": f"Bearer {settings.devin_api_key.get_secret_value()}",
                "Content-Type": "application/json",
            },
            timeout=timeout,
        )

    async def aclose(self) -> None:
        """Close the underlying HTTP connection pool."""
        await self._client.aclose()

    def _org_path(self, suffix: str = "") -> str:
        """Build an org-scoped API path."""
        return f"/organizations/{self._org_id}{suffix}"

    async def list_sessions(self, limit: int = 10) -> dict[str, Any]:
        """List recent Devin sessions for the org."""
        resp = await self._client.get(
            self._org_path("/sessions"), params={"limit": limit}
        )
        resp.raise_for_status()
        return resp.json()

    async def create_session(
        self, prompt: str, *, idempotent: bool | None = None, **extra: Any
    ) -> dict[str, Any]:
        """Start a new Devin session with the given prompt."""
        payload: dict[str, Any] = {"prompt": prompt}
        if self._create_as_user_id:
            payload["create_as_user_id"] = self._create_as_user_id
        payload.update(
            {key: value for key, value in extra.items() if value is not None}
        )
        resp = await self._client.post(self._org_path("/sessions"), json=payload)
        resp.raise_for_status()
        return resp.json()

    async def get_session(self, session_id: str) -> dict[str, Any]:
        """Fetch a session by id."""
        resp = await self._client.get(self._org_path(f"/sessions/{session_id}"))
        resp.raise_for_status()
        return resp.json()

    async def ping(self) -> dict[str, Any]:
        """Verify credentials by listing one session."""
        data = await self.list_sessions(limit=1)
        return {
            "ok": True,
            "total": data.get("total"),
            "first_item_keys": list((data.get("items") or [{}])[0].keys())[:10],
        }
