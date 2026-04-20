from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.devin.client import DevinClient
from app.devin.fix_issue import get_status, start_fix
from app.devin.models import (
    CreateSessionRequest,
    CreateSessionResponse,
    FixIssueRequest,
    FixIssueStatus,
)
from app.devin.service import get_client as get_devin_client
from app.github.client import GitHubClient
from app.github.service import get_client as get_github_client

router = APIRouter(prefix="/devin", tags=["devin"])


@router.get("/ping")
async def ping(client: DevinClient = Depends(get_devin_client)):
    return await client.ping()


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    client: DevinClient = Depends(get_devin_client),
):
    raw = await client.create_session(request.prompt, idempotent=request.idempotent)
    return CreateSessionResponse(
        session_id=raw.get("session_id") or raw.get("id", ""),
        url=raw.get("url"),
    )


@router.post("/fix_issue", response_model=FixIssueStatus)
async def fix_issue(
    request: FixIssueRequest,
    settings: Settings = Depends(get_settings),
    github: GitHubClient = Depends(get_github_client),
) -> FixIssueStatus:
    """Start a Devin session that fixes the given vulnerability issue.

    Returns the initial ``FIXING`` status including ``session_id`` and
    ``session_url`` so the frontend can link through to the live Devin
    run while it works. The backend polls the Devin API internally; the
    client then polls ``GET /devin/fix_issue/{issue_id}`` for updates.
    """
    try:
        return await start_fix(
            request.issue_id, settings=settings, github=github
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/fix_issue/{issue_id}", response_model=FixIssueStatus)
async def fix_issue_status(issue_id: int) -> FixIssueStatus:
    """Report the latest state for a previously-started fix session."""
    return get_status(issue_id)
