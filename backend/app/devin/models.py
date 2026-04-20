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
