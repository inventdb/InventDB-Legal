"""Shared error type and JSON error handling for the Flask API."""

from __future__ import annotations

import re
from http import HTTPStatus
from typing import Any

# A body that is a web page rather than a message: a proxy's or web server's
# stock error page (`<html><head><title>403 Forbidden</title>…`).
_MARKUP = re.compile(r"^\s*<|<html|<body|<!doctype", re.IGNORECASE)


def status_message(status: int) -> str:
    """Say an HTTP status in words, for an InventDB error that carried none."""
    try:
        phrase = HTTPStatus(status).phrase
    except ValueError:
        phrase = "Error"
    message = f"InventDB answered {status} {phrase}"
    if status >= 500:
        message += " — try again in a moment"
    return message


def upstream_detail(status: int, text: str | None) -> str:
    """The message for an InventDB error whose body is not JSON.

    A short plain-text body is kept, since it is usually the reason. A web
    page is not: shown in an alert it is a wall of tags, so the status is said
    in words instead.
    """
    body = (text or "").strip()
    if body and len(body) <= 300 and not _MARKUP.search(body):
        return body
    return status_message(status)


class ApiError(Exception):
    """An error that should be returned to the client as JSON.

    Attributes
    ----------
    status_code:
        HTTP status to send.
    detail:
        Human-readable message (or structured payload) describing the error.
    extra:
        Extra top-level keys to merge into the JSON body. Used to carry
        structured detail a message cannot hold — notably InventDB's workflow
        plan-validation ``issues``, which name the offending step, so the
        editor can point at it instead of showing "plan validation failed".
    """

    def __init__(
        self, status_code: int, detail: Any, extra: dict[str, Any] | None = None
    ) -> None:
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail
        self.extra = extra or {}

    def to_dict(self) -> dict[str, Any]:
        # `ok`/`error` are never overridden by `extra`; a hostile upstream body
        # cannot turn a failure into a success by naming a key "ok".
        return {**self.extra, "ok": False, "error": self.detail}
