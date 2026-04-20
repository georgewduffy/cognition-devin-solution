from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends

from app.config import Settings, get_settings
from app.devin.client import DevinClient


async def get_client(
    settings: Settings = Depends(get_settings),
) -> AsyncIterator[DevinClient]:
    """FastAPI dependency yielding a DevinClient scoped to the request."""
    client = DevinClient(settings)
    try:
        yield client
    finally:
        await client.aclose()
