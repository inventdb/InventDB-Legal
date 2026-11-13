"""Authentication routes (Flask blueprint).

These proxy directly to InventDB's auth endpoints so InventDB is the single
identity provider. The frontend logs in with InventDB credentials; we hand back
the JWT which the client then presents on every subsequent request.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from .. import access
from ..context import anon_client, authed_client
from ..errors import ApiError

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError(400, "Expected a JSON object body")
    return data


@bp.get("/health")
def health():
    client = anon_client()
    try:
        data = client.health()
        return jsonify({"ok": True, "inventdb": data, "base_url": client.base_url})
    except Exception as exc:  # noqa: BLE001 - report any connectivity issue
        return jsonify({"ok": False, "error": str(exc), "base_url": client.base_url})


@bp.post("/login")
def login():
    body = _body()
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    if not username or not password:
        raise ApiError(400, "username and password are required")
    return jsonify(anon_client().login(username, password))


@bp.get("/me")
def me():
    return jsonify(authed_client().me())


@bp.get("/access")
def access_map():
    """What the signed-in person may reach: their sections, modules and rooms.

    Worked out from their InventDB Legal role on every call (briefly cached),
    so a role changed in InventDB takes effect on the next sign-in or refresh.
    Someone with no Legal role gets ``provisioned: false`` and nothing else.
    """
    return jsonify(access.access_payload(access.resolve_tier(authed_client())))


@bp.post("/forgot-password")
def forgot_password():
    body = _body()
    email = (body.get("email") or "").strip()
    if not email:
        raise ApiError(400, "email is required")
    return jsonify(anon_client().forgot_password(email))
