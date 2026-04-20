from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    prompt: str
    idempotent: bool = True


class CreateSessionResponse(BaseModel):
    session_id: str
    url: str | None = None


class SessionInfo(BaseModel):
    session_id: str
    status: str | None = None
    url: str | None = None


class DevinActionState(str, Enum):
    """State of a Devin fix session attached to a vulnerability issue.

    The frontend renders one of four action cells per row based on this
    value. ``REQUEST_SENT`` is a transient state: the frontend sets it
    optimistically the moment the user clicks *Fix* and flips to
    ``FIXING`` as soon as the backend acknowledges the session was
    created. The backend itself only ever reports ``FIXING`` or
    ``FIXED`` (or an error, which maps back to ``NOT_FIXED``).
    """

    NOT_FIXED = "NOT_FIXED"
    REQUEST_SENT = "REQUEST_SENT"
    FIXING = "FIXING"
    FIXED = "FIXED"
    RESOLVED = "RESOLVED"


class FixIssueRequest(BaseModel):
    """Client request covering one or more Devin fix sessions in a batch.

    Used both for ``POST /devin/fix_issue`` (create sessions) and for
    ``POST /devin/fix_issue/status`` (batch poll). ``issue_ids`` holds the
    GitHub issue global numeric ids, which are stable across
    label/title/state changes. The single-row *Fix* button sends a list
    of length 1; the top-level *Fix All* / *Fix N Vulnerabilities*
    button sends the selected (or full) set.
    """

    issue_ids: list[int]


class FixIssueStatus(BaseModel):
    """Current fix state for a single vulnerability issue.

    Returned by both ``POST /devin/fix_issue`` (right after a session is
    created) and ``GET /devin/fix_issue/{issue_id}`` (when the frontend
    polls for updates). ``pr_url`` is populated once the Devin session
    exits with at least one pull request.
    """

    issue_id: int
    state: DevinActionState
    session_id: str | None = None
    session_url: str | None = None
    pr_url: str | None = None
    error: str | None = None
