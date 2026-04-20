"""Prompt templates for Devin sessions created by this service.

Exposes ``PROMPT`` — the instruction we send to a new Devin session when the
user clicks **Fix** on a vulnerability in the dashboard. The prompt is
deliberately small and directive: read the issue, apply the simplest fix,
open a PR. Keep it grep-able; the frontend's ``DevinActionState`` flow
depends on Devin actually opening a pull request to reach the ``FIXED``
state.
"""

from __future__ import annotations

PROMPT = """You are Devin. Resolve the following GitHub vulnerability issue \
in the `{repo}` repository and open a pull request with the fix.

Issue: #{number} — {title}
URL: {html_url}
Vulnerability type: {vulnerability_type}

Issue body:
---
{body}
---

Steps:
1. Read the issue carefully (title + body + any linked references) and \
understand the vulnerability described.
2. Apply the simplest, most minimal code change in `{repo}` that resolves \
it. Do not refactor unrelated code.
3. Open a pull request against the default branch with a clear title and \
description that links back to issue #{number}.

Return when the pull request is open. Do not ask the user clarifying \
questions — use your best judgement.
"""
