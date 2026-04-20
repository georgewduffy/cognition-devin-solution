from fastapi import APIRouter, Depends

from app.devin.client import DevinClient
from app.devin.models import CreateSessionRequest, CreateSessionResponse
from app.devin.service import get_client

router = APIRouter(prefix="/devin", tags=["devin"])


@router.get("/ping")
async def ping(client: DevinClient = Depends(get_client)):
    return await client.ping()


@router.post("/sessions", response_model=CreateSessionResponse)
async def create_session(
    request: CreateSessionRequest,
    client: DevinClient = Depends(get_client),
):
    raw = await client.create_session(request.prompt, idempotent=request.idempotent)
    return CreateSessionResponse(
        session_id=raw.get("session_id") or raw.get("id", ""),
        url=raw.get("url"),
    )
