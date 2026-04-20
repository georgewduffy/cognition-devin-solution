from pydantic import BaseModel, Field


class CreateIssueRequest(BaseModel):
    title: str
    body: str | None = None
    labels: list[str] = Field(default_factory=list)
    assignees: list[str] = Field(default_factory=list)


class IssueSummary(BaseModel):
    number: int
    title: str
    state: str
    html_url: str
    user_login: str | None = None
    labels: list[str] = Field(default_factory=list)
    body: str | None = None


class IssueDetail(IssueSummary):
    comments: int
    created_at: str
    updated_at: str


class VulnerabilityIssue(BaseModel):
    """A GitHub issue labelled `vulnerability`, enriched with its vulnerability type.

    `id` is the GitHub issue's global numeric id. It is stable across title,
    label, and state changes, which lets the frontend update rows in place on
    re-sync rather than duplicating them.
    """

    id: int
    number: int
    title: str
    state: str
    html_url: str
    labels: list[str] = Field(default_factory=list)
    vulnerability_type: str | None = None


class WebhookAck(BaseModel):
    event: str
    action: str | None = None
    issue_number: int | None = None
    delivery_id: str | None = None
    received: bool = True
