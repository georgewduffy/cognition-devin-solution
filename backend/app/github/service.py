from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from fastapi import Depends

from app.config import Settings, get_settings
from app.github.client import GitHubClient
from app.github.models import IssueSummary, VulnerabilityIssue

VULNERABILITY_LABEL = "vulnerability"


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


def to_vulnerability(raw: dict[str, Any]) -> VulnerabilityIssue:
    """Map a raw GitHub issue payload to a VulnerabilityIssue.

    A vulnerability issue is expected to carry the `vulnerability` label plus
    at most one additional label describing the vulnerability type. The first
    non-vulnerability label becomes `vulnerability_type`; the full label list
    is preserved for the UI to render extras if ever present.
    """
    labels = [lbl["name"] for lbl in raw.get("labels", [])]
    vulnerability_type = next(
        (name for name in labels if name != VULNERABILITY_LABEL), None
    )
    return VulnerabilityIssue(
        id=raw["id"],
        number=raw["number"],
        title=raw["title"],
        state=raw["state"],
        html_url=raw["html_url"],
        labels=labels,
        vulnerability_type=vulnerability_type,
    )
