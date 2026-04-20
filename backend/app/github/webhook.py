"""Verification helpers for GitHub webhook deliveries.

GitHub signs payloads with HMAC-SHA256 using the shared secret and sends the
result in the `X-Hub-Signature-256` header as `sha256=<hex>`.
"""
from __future__ import annotations

import hashlib
import hmac


def verify_signature(*, secret: str, payload: bytes, header_value: str | None) -> bool:
    if not header_value or not header_value.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    provided = header_value.split("=", 1)[1]
    return hmac.compare_digest(expected, provided)
