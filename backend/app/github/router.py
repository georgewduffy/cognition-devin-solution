from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

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

_WEBHOOK_EVENT_VERSION = 0
_WEBHOOK_SUBSCRIBERS: set[asyncio.Queue[dict[str, Any]]] = set()


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
    vulnerabilities = [to_vulnerability(r) for r in raw]
    linked_prs = await asyncio.gather(
        *(
            client.find_linked_pull_request_for_issue(vulnerability.number)
            for vulnerability in vulnerabilities
        )
    )
    for vulnerability, linked_pr in zip(vulnerabilities, linked_prs, strict=True):
        if linked_pr is None:
            continue
        vulnerability.linked_pr_number = linked_pr.get("number")
        vulnerability.linked_pr_url = linked_pr.get("html_url")
        vulnerability.linked_pr_state = linked_pr.get("state")
        if linked_pr.get("state") == "open":
            vulnerability.open_pr_number = linked_pr.get("number")
            vulnerability.open_pr_url = linked_pr.get("html_url")
    return vulnerabilities


@router.get("/issues/{number}", response_model=IssueDetail)
async def get_issue(number: int, client: GitHubClient = Depends(get_client)):
    raw = await client.get_issue(number)
    return IssueDetail(
        **to_summary(raw).model_dump(),
        comments=raw.get("comments", 0),
        created_at=raw["created_at"],
        updated_at=raw["updated_at"],
    )


@router.get("/webhook/events")
async def webhook_events() -> StreamingResponse:
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=10)
    _WEBHOOK_SUBSCRIBERS.add(queue)

    async def stream():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                yield f"event: github-webhook\ndata: {json.dumps(event)}\n\n"
        finally:
            _WEBHOOK_SUBSCRIBERS.discard(queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
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
    number = (payload.get("issue") or {}).get("number") or (
        payload.get("pull_request") or {}
    ).get("number")

    logger.info(
        "github_webhook event=%s action=%s issue=%s delivery=%s",
        x_github_event,
        action,
        number,
        x_github_delivery,
    )
    if _should_refresh_vulnerabilities(x_github_event, action):
        _publish_webhook_update(
            event=x_github_event or "unknown",
            action=action,
            issue_number=number,
            delivery_id=x_github_delivery,
        )

    return WebhookAck(
        event=x_github_event or "unknown",
        action=action,
        issue_number=number,
        delivery_id=x_github_delivery,
    )


def _should_refresh_vulnerabilities(event: str | None, action: str | None) -> bool:
    return event in {"issues", "pull_request"} and action in {
        "closed",
        "edited",
        "labeled",
        "opened",
        "ready_for_review",
        "reopened",
        "synchronize",
        "unlabeled",
    }


def _publish_webhook_update(
    *,
    event: str,
    action: str | None,
    issue_number: int | None,
    delivery_id: str | None,
) -> None:
    global _WEBHOOK_EVENT_VERSION

    _WEBHOOK_EVENT_VERSION += 1
    payload = {
        "version": _WEBHOOK_EVENT_VERSION,
        "event": event,
        "action": action,
        "issue_number": issue_number,
        "delivery_id": delivery_id,
    }
    for queue in tuple(_WEBHOOK_SUBSCRIBERS):
        try:
            queue.put_nowait(payload)
        except asyncio.QueueFull:
            pass
