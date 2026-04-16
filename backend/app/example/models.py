from pydantic import BaseModel


class TestRequest(BaseModel):
    text: str


class TestResponse(BaseModel):
    original: str
    scrambled: str


class HealthResponse(BaseModel):
    status: str
