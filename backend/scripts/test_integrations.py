"""Smoke test: verifies the backend can authenticate with Devin and GitHub.

Run from the backend directory:

    PYTHONPATH=. uv run python scripts/test_integrations.py
"""
from __future__ import annotations

import asyncio
import json
import sys

import httpx

from app.config import get_settings
from app.devin.client import DevinClient
from app.github.client import GitHubClient


def _pp(label: str, data) -> None:
    print(f"\n=== {label} ===")
    print(json.dumps(data, indent=2, default=str)[:1200])


async def test_devin() -> bool:
    settings = get_settings()
    print(f"\n[devin] base_url={settings.devin_api_base_url} org={settings.devin_org_id}")
    client = DevinClient(settings)
    try:
        result = await client.ping()
        _pp("Devin /sessions (limit=1)", result)
        return True
    except httpx.HTTPStatusError as exc:
        print(f"[devin] HTTP {exc.response.status_code}: {exc.response.text[:500]}")
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"[devin] ERROR: {exc!r}")
        return False
    finally:
        await client.aclose()


async def test_github() -> bool:
    settings = get_settings()
    print(f"\n[github] target repo = {settings.github_owner}/{settings.github_repo}")
    client = GitHubClient(settings)
    try:
        user = await client.whoami()
        _pp("GitHub /user", {"login": user.get("login"), "id": user.get("id")})

        issues = await client.list_issues(state="open", per_page=5)
        summaries = [
            {"number": i["number"], "title": i["title"], "state": i["state"]}
            for i in issues
        ]
        _pp(f"GitHub open issues in {settings.github_owner}/{settings.github_repo}", summaries)
        return True
    except httpx.HTTPStatusError as exc:
        print(f"[github] HTTP {exc.response.status_code}: {exc.response.text[:500]}")
        return False
    except Exception as exc:  # noqa: BLE001
        print(f"[github] ERROR: {exc!r}")
        return False
    finally:
        await client.aclose()


async def main() -> int:
    devin_ok, github_ok = await asyncio.gather(test_devin(), test_github())

    print("\n=== Summary ===")
    print(f"  Devin:  {'OK' if devin_ok else 'FAILED'}")
    print(f"  GitHub: {'OK' if github_ok else 'FAILED'}")
    return 0 if (devin_ok and github_ok) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
