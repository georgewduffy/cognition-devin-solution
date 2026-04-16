from fastapi import APIRouter

from app.example.models import HealthResponse, TestRequest, TestResponse
from app.example.service import scramble_text

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok")


@router.post("/test", response_model=TestResponse)
async def test(request: TestRequest):
    scrambled = scramble_text(request.text)
    return TestResponse(original=request.text, scrambled=scrambled)
