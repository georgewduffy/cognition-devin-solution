from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import Settings, get_settings
from app.github.client import GitHubClient
from app.github.models import (
    CreateIssueRequest,
    IssueDetail,
    IssueSummary,
    VulnerabilityIssue,
    WebhookAck,
)
from app.github.service import (
    VULNERABILITY_LABEL,
    get_client,
    to_summary,
    to_vulnerability,
)
from app.github.webhook import verify_signature

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/github", tags=["github"])


@router.get("/whoami")
async def whoami(client: GitHubClient = Depends(get_client)):
    user = await client.whoami()
    return {"login": user.get("login"), "id": user.get("id")}


@router.post("/issues", response_model=IssueSummary, status_code=201)
async def create_issue(
    request: CreateIssueRequest, client: GitHubClient = Depends(get_client)
):
    raw = await client.create_issue(
        title=request.title,
        body=request.body,
        labels=request.labels,
        assignees=request.assignees,
    )
    return to_summary(raw)


@router.get("/vulnerabilities", response_model=list[VulnerabilityIssue])
async def list_vulnerabilities(
    client: GitHubClient = Depends(get_client),
) -> list[VulnerabilityIssue]:
    """Return every issue in the configured repo labelled `vulnerability`.

    Each issue carries a stable GitHub `id` so the frontend can update rows in
    place on re-sync rather than duplicating them.
    """
    raw = await client.list_issues_by_label(label=VULNERABILITY_LABEL, state="all")
    return [to_vulnerability(r) for r in raw]


@router.get("/issues/{number}", response_model=IssueDetail)
async def get_issue(number: int, client: GitHubClient = Depends(get_client)):
    raw = await client.get_issue(number)
    return IssueDetail(
        **to_summary(raw).model_dump(),
        comments=raw.get("comments", 0),
        created_at=raw["created_at"],
        updated_at=raw["updated_at"],
    )


@router.post("/webhook", response_model=WebhookAck)
async def webhook(
    request: Request,
    x_github_event: str | None = Header(None),
    x_github_delivery: str | None = Header(None),
    x_hub_signature_256: str | None = Header(None),
    settings: Settings = Depends(get_settings),
):
    raw = await request.body()
    if not verify_signature(
        secret=settings.github_webhook_secret.get_secret_value(),
        payload=raw,
        header_value=x_hub_signature_256,
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}") from exc

    action = payload.get("action")
    number = (payload.get("issue") or {}).get("number")

    logger.info(
        "github_webhook event=%s action=%s issue=%s delivery=%s",
        x_github_event,
        action,
        number,
        x_github_delivery,
    )

    return WebhookAck(
        event=x_github_event or "unknown",
        action=action,
        issue_number=number,
        delivery_id=x_github_delivery,
    )
