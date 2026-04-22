from __future__ import annotations

import asyncio

_ENABLED = False
_LOCK = asyncio.Lock()


async def get_auto_resolve_enabled() -> bool:
    async with _LOCK:
        return _ENABLED


async def set_auto_resolve_enabled(enabled: bool) -> bool:
    global _ENABLED

    async with _LOCK:
        _ENABLED = enabled
        return _ENABLED
