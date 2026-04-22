from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.devin.auto_resolve import (
    get_auto_resolve_enabled,
    set_auto_resolve_enabled,
)
from app.devin.client import DevinClient
from app.devin.fix_issue import check_and_promote_fixed, get_statuses, start_fixes
from app.devin.models import (
    AutoResolveState,
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


@router.get("/auto_resolve", response_model=AutoResolveState)
async def get_auto_resolve() -> AutoResolveState:
    return AutoResolveState(enabled=await get_auto_resolve_enabled())


@router.put("/auto_resolve", response_model=AutoResolveState)
async def update_auto_resolve(request: AutoResolveState) -> AutoResolveState:
    enabled = await set_auto_resolve_enabled(request.enabled)
    return AutoResolveState(enabled=enabled)


@router.post("/fix_issue", response_model=dict[str, FixIssueStatus])
async def fix_issue(
    request: FixIssueRequest,
    settings: Settings = Depends(get_settings),
    github: GitHubClient = Depends(get_github_client),
) -> dict[str, FixIssueStatus]:
    """Start Devin fix sessions for every id in ``request.issue_ids`` in parallel.

    Both the per-row *Fix* button and the top-level *Fix All* / *Fix N
    Vulnerabilities* button hit this endpoint — single-row clicks send
    a one-element list. Returns a mapping keyed by issue id (as a
    string, since JSON object keys are strings) containing the initial
    ``FIXING`` status (or ``NOT_FIXED`` + ``error`` for that particular
    id on failure) for each id. The backend polls Devin internally;
    the client polls ``POST /devin/fix_issue/status`` for updates.
    """
    result = await start_fixes(
        request.issue_ids, settings=settings, github=github
    )
    return {str(issue_id): status for issue_id, status in result.items()}


@router.post("/fix_issue/status", response_model=dict[str, FixIssueStatus])
async def fix_issue_statuses(
    request: FixIssueRequest,
    settings: Settings = Depends(get_settings),
    github: GitHubClient = Depends(get_github_client),
) -> dict[str, FixIssueStatus]:
    """Report the latest state for each id in ``request.issue_ids``.

    Frontend polls this every few seconds for any row currently in the
    ``FIXING`` or ``FIXED`` state. For ``FIXED`` entries the handler
    checks whether the associated PR has been merged and promotes to
    ``RESOLVED`` when it has.
    """
    result = await check_and_promote_fixed(request.issue_ids, github, settings)
    return {str(issue_id): status for issue_id, status in result.items()}
