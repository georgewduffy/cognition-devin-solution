"""In-memory registry + polling loop for Devin fix sessions.

Design notes:

* There is one registry per backend process (``_REGISTRY``). Each entry
  represents the latest fix attempt for a given GitHub issue id. We
  overwrite on re-``Fix`` rather than append — the UI only ever shows
  one Devin action per row.
* ``start_fixes`` creates the Devin sessions synchronously in parallel
  (so the HTTP POST responds with the ``session_id`` + initial state
  for each requested issue) and then schedules one ``_poll_session``
  per issue as a background ``asyncio`` task. ``start_fix`` (singular)
  is a thin wrapper kept for tests and internal callers.
* The poller creates its own ``DevinClient`` (not the request-scoped
  one) because it outlives the originating request.
* Terminal states follow the Devin v3 schema: ``exit`` means the
  session finished, ``error`` / ``suspended`` mean it bailed out.
  From the user's perspective the issue is fixed the moment Devin
  opens a PR, so ``_poll_session`` flips ``FIXED`` as soon as
  ``pull_requests[0].pr_url`` appears rather than waiting for the
  session to exit (sessions routinely sit in ``running`` for a while
  after pushing the PR). Terminal states without a PR surface an
  error.
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


def get_statuses(issue_ids: list[int]) -> dict[int, FixIssueStatus]:
    """Batch-read current statuses for a list of issue ids.

    Preserves the order of ``issue_ids``. Missing entries are reported
    as ``NOT_FIXED`` (same fallback as :func:`get_status`).
    """
    return {iid: get_status(iid) for iid in issue_ids}


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

    Thin wrapper around :func:`start_fixes` for single-issue callers;
    the frontend always calls the batch endpoint with an array, but
    this helper is kept for tests and internal use.
    """
    result = await start_fixes([issue_id], settings=settings, github=github)
    status = result[issue_id]
    if status.state is DevinActionState.NOT_FIXED and status.error:
        # Preserve the previous single-issue contract: GitHub lookup
        # failures bubble up as ``LookupError`` so the router maps them
        # to HTTP 404.
        raise LookupError(status.error)
    return status


async def start_fixes(
    issue_ids: list[int],
    *,
    settings: Settings,
    github: GitHubClient,
) -> dict[int, FixIssueStatus]:
    """Kick off Devin fix sessions for each id in ``issue_ids`` in parallel.

    The returned mapping is keyed by issue id and preserves input
    order. Each id is processed independently: a GitHub lookup failure
    or Devin-API failure for one issue does not block or reject the
    others. Failures surface as ``NOT_FIXED`` entries carrying an
    ``error`` message so the frontend can render per-row errors
    without a page-level catch.

    The vulnerability issue list is fetched once and shared across all
    ``start_fix`` calls in the batch; we still issue one ``GET
    /issues/{number}`` per issue (to pull the body for the prompt)
    because the list endpoint truncates body text.
    """
    if not issue_ids:
        return {}

    raw_issues = await github.list_issues_by_label(
        label=VULNERABILITY_LABEL, state="all"
    )
    by_id: dict[int, dict[str, Any]] = {
        raw["id"]: raw for raw in raw_issues if raw.get("id") is not None
    }

    async def run_one(issue_id: int) -> FixIssueStatus:
        try:
            return await _start_one(
                issue_id=issue_id,
                by_id=by_id,
                settings=settings,
                github=github,
            )
        except Exception as exc:  # noqa: BLE001 - isolate per-row failures
            logger.warning(
                "devin_fix_start_error issue_id=%s exc=%s", issue_id, exc
            )
            return FixIssueStatus(
                issue_id=issue_id,
                state=DevinActionState.NOT_FIXED,
                error=str(exc),
            )

    results = await asyncio.gather(*(run_one(iid) for iid in issue_ids))
    return {status.issue_id: status for status in results}


async def _start_one(
    *,
    issue_id: int,
    by_id: dict[int, dict[str, Any]],
    settings: Settings,
    github: GitHubClient,
) -> FixIssueStatus:
    raw = by_id.get(issue_id)
    if raw is None:
        raise LookupError(
            f"No vulnerability issue with id={issue_id} found in "
            f"{github.owner}/{github.repo}"
        )
    issue = to_vulnerability(raw)

    full_issue = await github.get_issue(issue.number)
    prompt = _build_prompt(
        issue, repo=f"{github.owner}/{github.repo}", body=full_issue.get("body")
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

    Updates ``_REGISTRY`` in place. Flips to ``FIXED`` as soon as Devin
    opens a pull request (Devin sessions often remain ``running`` for a
    while after the PR is pushed, and from the user's perspective the
    issue is already fixed once the PR link exists). If the session
    reaches a terminal state (``exit`` / ``error`` / ``suspended``)
    without ever producing a PR we surface an error and drop back to
    ``NOT_FIXED`` so the user can retry.
    """
    current_task = asyncio.current_task()
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

            if pr_url:
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

            if status_str in _TERMINAL_STATUSES:
                detail = raw.get("status_detail") or status_str
                await _set_error(
                    issue_id,
                    f"Devin session ended ({status_str}, {detail}) without a pull request",
                    session_id,
                    session_url=raw.get("url"),
                )
                return

            # Still running — refresh session_url while we wait.
            await _set_status(
                FixIssueStatus(
                    issue_id=issue_id,
                    state=DevinActionState.FIXING,
                    session_id=session_id,
                    session_url=raw.get("url"),
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
        # Only clear _TASKS[issue_id] if we're still the registered task.
        # A concurrent start_fix() for the same issue may have cancelled
        # us and installed a replacement — we must not evict that
        # replacement from the registry, otherwise the new task would be
        # orphaned and a subsequent retry would fail to cancel it.
        async with _LOCK:
            if _TASKS.get(issue_id) is current_task:
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
