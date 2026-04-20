"""In-memory registry + polling loop for Devin fix sessions.

Design notes:

* There is one registry per backend process (``_REGISTRY``). Each entry
  represents the latest fix attempt for a given GitHub issue id. We
  overwrite on re-``Fix`` rather than append — the UI only ever shows
  one Devin action per row.
* ``start_fix`` creates the Devin session synchronously (so the HTTP
  POST responds with the ``session_id`` + initial state) and then
  schedules ``_poll_session`` as a background ``asyncio`` task to
  watch the session until it reaches a terminal state.
* The poller creates its own ``DevinClient`` (not the request-scoped
  one) because it outlives the originating request.
* Terminal states follow the Devin v3 schema: ``exit`` means the
  session finished, ``error`` / ``suspended`` mean it bailed out. We
  look for a ``pull_requests[0].pr_url`` on exit and mark the issue
  ``FIXED``; otherwise we surface an error.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import Settings
from app.devin.client import DevinClient
from app.devin.models import DevinActionState, FixIssueStatus
from app.devin.prompt import PROMPT
from app.github.client import GitHubClient
from app.github.models import VulnerabilityIssue
from app.github.service import VULNERABILITY_LABEL, to_vulnerability

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 5.0
POLL_TIMEOUT_SECONDS = 60 * 60  # 1 hour upper bound; keeps the task from leaking forever.

_TERMINAL_STATUSES = {"exit", "error", "suspended"}

_REGISTRY: dict[int, FixIssueStatus] = {}
_TASKS: dict[int, asyncio.Task[None]] = {}
_LOCK = asyncio.Lock()


def get_status(issue_id: int) -> FixIssueStatus:
    """Return the current fix status for ``issue_id``.

    Unknown ids are reported as ``NOT_FIXED`` so the frontend can start
    from a clean slate after a backend restart.
    """
    existing = _REGISTRY.get(issue_id)
    if existing is not None:
        return existing
    return FixIssueStatus(issue_id=issue_id, state=DevinActionState.NOT_FIXED)


async def _find_vulnerability(
    github: GitHubClient, issue_id: int
) -> VulnerabilityIssue | None:
    raw_issues = await github.list_issues_by_label(
        label=VULNERABILITY_LABEL, state="all"
    )
    for raw in raw_issues:
        if raw.get("id") == issue_id:
            return to_vulnerability(raw)
    return None


def _build_prompt(issue: VulnerabilityIssue, repo: str, body: str | None) -> str:
    return PROMPT.format(
        repo=repo,
        number=issue.number,
        title=issue.title,
        html_url=issue.html_url,
        vulnerability_type=issue.vulnerability_type or "unspecified",
        body=(body or "").strip() or "(no description)",
    )


async def start_fix(
    issue_id: int, *, settings: Settings, github: GitHubClient
) -> FixIssueStatus:
    """Kick off a Devin fix session for ``issue_id`` and track it.

    Resolves the issue from GitHub (so we can embed its body in the
    prompt), creates a Devin session, stores the initial state and
    schedules background polling. Returns the ``FIXING`` status so the
    frontend can immediately flip the cell from ``REQUEST_SENT``.
    """
    issue = await _find_vulnerability(github, issue_id)
    if issue is None:
        raise LookupError(
            f"No vulnerability issue with id={issue_id} found in "
            f"{github.owner}/{github.repo}"
        )

    raw_issue = await github.get_issue(issue.number)
    prompt = _build_prompt(
        issue, repo=f"{github.owner}/{github.repo}", body=raw_issue.get("body")
    )

    client = DevinClient(settings)
    try:
        raw_session = await client.create_session(
            prompt,
            idempotent=False,
            title=f"Fix vulnerability #{issue.number}: {issue.title}"[:200],
            tags=["vulnerability", "auto-fix"],
        )
    finally:
        await client.aclose()

    session_id = raw_session.get("session_id") or raw_session.get("id") or ""
    session_url = raw_session.get("url")

    status = FixIssueStatus(
        issue_id=issue_id,
        state=DevinActionState.FIXING,
        session_id=session_id or None,
        session_url=session_url,
    )
    async with _LOCK:
        _REGISTRY[issue_id] = status
        existing = _TASKS.pop(issue_id, None)
    if existing is not None and not existing.done():
        existing.cancel()

    if session_id:
        task = asyncio.create_task(
            _poll_session(issue_id=issue_id, session_id=session_id, settings=settings)
        )
        async with _LOCK:
            _TASKS[issue_id] = task

    return status


async def _poll_session(
    *, issue_id: int, session_id: str, settings: Settings
) -> None:
    """Poll a running Devin session until it reaches a terminal state.

    Updates ``_REGISTRY`` in place. Keeps the ``FIXING`` state until the
    session's ``status`` enters ``{exit, error, suspended}``; on ``exit``
    with a pull request we move to ``FIXED`` and record the PR URL. All
    other terminal states surface an error and drop back to
    ``NOT_FIXED`` so the user can retry.
    """
    client = DevinClient(settings)
    deadline = asyncio.get_event_loop().time() + POLL_TIMEOUT_SECONDS
    try:
        while True:
            try:
                raw = await client.get_session(session_id)
            except Exception as exc:  # noqa: BLE001 - surface any network/API failure to the UI
                logger.warning(
                    "devin_fix_poll_error session_id=%s exc=%s",
                    session_id,
                    exc,
                )
                await _set_error(issue_id, str(exc), session_id)
                return

            status_str: str = raw.get("status") or ""
            pull_requests = raw.get("pull_requests") or []
            pr_url = _first_pr_url(pull_requests)

            if status_str in _TERMINAL_STATUSES:
                if status_str == "exit" and pr_url:
                    await _set_status(
                        FixIssueStatus(
                            issue_id=issue_id,
                            state=DevinActionState.FIXED,
                            session_id=session_id,
                            session_url=raw.get("url"),
                            pr_url=pr_url,
                        )
                    )
                    return
                detail = raw.get("status_detail") or status_str
                await _set_error(
                    issue_id,
                    f"Devin session ended ({status_str}, {detail}) without a pull request",
                    session_id,
                    session_url=raw.get("url"),
                )
                return

            # Still running — refresh session_url / pr_url in case one
            # appeared mid-run (Devin can open the PR before exiting).
            await _set_status(
                FixIssueStatus(
                    issue_id=issue_id,
                    state=DevinActionState.FIXING,
                    session_id=session_id,
                    session_url=raw.get("url"),
                    pr_url=pr_url,
                )
            )

            if asyncio.get_event_loop().time() > deadline:
                await _set_error(
                    issue_id,
                    "Devin session did not complete within the polling window",
                    session_id,
                    session_url=raw.get("url"),
                )
                return

            await asyncio.sleep(POLL_INTERVAL_SECONDS)
    finally:
        await client.aclose()
        async with _LOCK:
            _TASKS.pop(issue_id, None)


def _first_pr_url(pull_requests: list[dict[str, Any]]) -> str | None:
    for pr in pull_requests:
        url = pr.get("pr_url") or pr.get("url")
        if url:
            return url
    return None


async def _set_status(status: FixIssueStatus) -> None:
    async with _LOCK:
        _REGISTRY[status.issue_id] = status


async def _set_error(
    issue_id: int,
    message: str,
    session_id: str | None,
    *,
    session_url: str | None = None,
) -> None:
    async with _LOCK:
        _REGISTRY[issue_id] = FixIssueStatus(
            issue_id=issue_id,
            state=DevinActionState.NOT_FIXED,
            session_id=session_id,
            session_url=session_url,
            error=message,
        )
