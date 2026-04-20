from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from fastapi import Depends

from app.config import Settings, get_settings
from app.github.client import GitHubClient
from app.github.models import IssueSummary


async def get_client(
    settings: Settings = Depends(get_settings),
) -> AsyncIterator[GitHubClient]:
    """FastAPI dependency yielding a GitHubClient scoped to the request."""
    client = GitHubClient(settings)
    try:
        yield client
    finally:
        await client.aclose()


def to_summary(raw: dict[str, Any]) -> IssueSummary:
    """Map a raw GitHub issue payload to an IssueSummary."""
    return IssueSummary(
        number=raw["number"],
        title=raw["title"],
        state=raw["state"],
        html_url=raw["html_url"],
        user_login=(raw.get("user") or {}).get("login"),
        labels=[lbl["name"] for lbl in raw.get("labels", [])],
        body=raw.get("body"),
    )
