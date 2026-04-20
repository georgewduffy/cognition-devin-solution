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


class WebhookAck(BaseModel):
    event: str
    action: str | None = None
    issue_number: int | None = None
    delivery_id: str | None = None
    received: bool = True
