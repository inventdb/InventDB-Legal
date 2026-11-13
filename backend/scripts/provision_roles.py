#!/usr/bin/env python3
"""Install InventDB Legal's role tiers in InventDB and create the demo logins.

Run it once per InventDB instance, signed in as a **superadmin**:

    cd backend
    .venv/Scripts/python -m scripts.provision_roles            # asks for the superadmin login
    .venv/Scripts/python -m scripts.provision_roles --dry-run  # prints what it would send, sends nothing

What it does, all of it idempotent:

1. Installs one InventDB role per tier (``legal:partner``, ``legal:attorney``,
   ``legal:paralegal``, ``legal:intake``, ``legal:finance``) as an app bundle
   on the ``legal`` namespace. Each role's grants come straight from the tier
   table in ``app/access.py``, so InventDB enforces the same boundary the app
   does, including on raw SQL from Analyze, reports and dashboard widgets.
2. Creates one demo login per tier and gives it that tier as its Legal role.
3. Creates ``demo.admin`` with InventDB's global ``superadmin`` role. A global
   admin or superadmin is the app's Admin tier, so this login sees everything.
4. Signs in as each demo login and checks what InventDB actually lets it read,
   then prints a pass/fail table.

The demo passwords are generated here and written to ``backend/demo-logins.local``
(git-ignored), never to the repository. Re-running resets them.

Real staff: create them in InventDB as usual and set their Legal role to one of
the ``legal:*`` roles (InventDB: Users -> the person -> App roles -> legal), or
call ``PUT /api/users/<id>/app-roles/legal``. A global admin or superadmin
needs no Legal role.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import secrets
import sys
from pathlib import Path
from typing import Any, Optional

import requests

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
sys.path.insert(0, str(BACKEND))

from app.access import ALL_ENTITIES, TIERS, WRITE  # noqa: E402
from app.config import get_settings  # noqa: E402

APP = "legal"
BUNDLE_VERSION = "legal-2026.11.14-1"
CREDENTIALS_FILE = BACKEND / "demo-logins.local"

#: One demo login per tier. Usernames say nothing on screen; the app never
#: shows a role, and these are handed only to the people trying it.
DEMO_USERS: list[tuple[str, Optional[str]]] = [
    ("demo.admin", None),  # global superadmin -> Admin tier
    ("demo.partner", "partner"),
    ("demo.attorney", "attorney"),
    ("demo.paralegal", "paralegal"),
    ("demo.intake", "intake"),
    ("demo.finance", "finance"),
]


def role_name(tier: str) -> str:
    return f"{APP}:{tier}"


def bundle(namespace: str) -> dict[str, Any]:
    roles = []
    for key, tier in TIERS.items():
        if key == "admin":
            continue  # InventDB's own admin/superadmin roles already bypass RBAC
        grants = [
            {
                "scope": "type",
                "resource": f"{namespace}.{entity}",
                "accessLevel": "write" if level == WRITE else "read",
            }
            for entity, level in tier.entities.items()
        ]
        roles.append({"name": role_name(key), "description": tier.description, "grants": grants})
    return {"bundle_version": BUNDLE_VERSION, "types": [], "roles": roles, "seed_data": []}


class Inventdb:
    def __init__(self, base: str, token: Optional[str] = None) -> None:
        self.base = base.rstrip("/")
        self.token = token

    def call(self, method: str, path: str, **kw) -> tuple[int, Any]:
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        res = requests.request(method, self.base + path, headers=headers, timeout=60, **kw)
        try:
            body = res.json()
        except ValueError:
            body = res.text
        return res.status_code, body

    def login(self, username: str, password: str) -> dict[str, Any]:
        status, body = self.call("POST", "/api/auth/login", json={"username": username, "password": password})
        if status != 200 or not isinstance(body, dict) or not body.get("token"):
            raise SystemExit(f"Sign-in failed for {username} ({status}): {_short(body)}")
        self.token = body["token"]
        return body

    def me(self) -> dict[str, Any]:
        _, body = self.call("GET", "/api/auth/me", params={"app": APP})
        user = body.get("user") if isinstance(body, dict) else None
        return user if isinstance(user, dict) else (body if isinstance(body, dict) else {})


def _short(body: Any) -> str:
    text = body if isinstance(body, str) else json.dumps(body)
    return text[:300]


def _user_record(body: Any) -> dict[str, Any]:
    if isinstance(body, dict):
        for key in ("user", "data"):
            if isinstance(body.get(key), dict):
                return body[key]
        return body
    return {}


def find_user(admin: Inventdb, username: str) -> Optional[dict[str, Any]]:
    status, body = admin.call("GET", "/api/users")
    users = body
    if isinstance(body, dict):
        users = body.get("users") or body.get("data") or []
    for user in users if isinstance(users, list) else []:
        if isinstance(user, dict) and user.get("username") == username:
            return user
    return None


def ensure_user(admin: Inventdb, username: str, password: str) -> dict[str, Any]:
    email = f"{username}@demo.invalid"
    status, body = admin.call(
        "POST", "/api/users", json={"username": username, "password": password, "email": email, "role": "reader"}
    )
    if status in (200, 201):
        return _user_record(body)
    if status == 409:
        user = find_user(admin, username)
        if not user:
            raise SystemExit(f"{username} exists but could not be read back.")
        s, b = admin.call("PUT", f"/api/users/{user['_id']}", json={"password": password})
        if s != 200:
            raise SystemExit(f"Could not reset {username}'s password ({s}): {_short(b)}")
        admin.call("PUT", f"/api/users/{user['_id']}/activate")
        return user
    raise SystemExit(f"Could not create {username} ({status}): {_short(body)}")


def set_legal_role(admin: Inventdb, user: dict[str, Any], tier: str) -> str:
    """Give ``user`` the tier as their Legal role. Returns how it was set."""
    uid, uname = user["_id"], user.get("username")
    # Keep the global role at reader: only the tier role grants anything.
    admin.call("PUT", f"/api/users/{uid}/role", json={"role": "reader"})
    for candidate in (role_name(tier), tier):
        status, _ = admin.call("PUT", f"/api/users/{uid}/app-roles/{APP}", json={"role": candidate})
        if status == 200:
            # Attach the bundle role as well, so its grants apply whichever way
            # this instance resolves app roles to grants.
            admin.call("POST", f"/api/users/{uname}/roles", json={"role": role_name(tier)})
            return f"app role {candidate!r}"
    status, body = admin.call("POST", f"/api/users/{uname}/roles", json={"role": role_name(tier)})
    if status in (200, 201):
        return f"attached role {role_name(tier)!r} (no per-app role on this instance)"
    raise SystemExit(f"Could not give {uname} the {tier} tier ({status}): {_short(body)}")


def verify(base: str, namespace: str, username: str, password: str, tier: str) -> list[str]:
    """Sign in as the demo login and compare InventDB's answers to the tier table."""
    from app.access import tier_from_me

    who = Inventdb(base)
    who.login(username, password)
    problems = []
    resolved = tier_from_me(who.me())
    if resolved != tier:
        problems.append(f"app sees tier {resolved!r}, expected {tier!r}")
    expected = TIERS[tier]
    for entity in ALL_ENTITIES:
        _, body = who.call(
            "GET", "/api/permissions/check", params={"resource": f"{namespace}.{entity}", "level": "read"}
        )
        data = body.get("data") if isinstance(body, dict) and isinstance(body.get("data"), dict) else body
        allowed = bool(data.get("has_permission")) if isinstance(data, dict) else False
        if allowed != expected.can_read(entity):
            problems.append(f"read {entity}: InventDB says {allowed}, tier says {expected.can_read(entity)}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="print the bundle and the plan, send nothing")
    parser.add_argument("--base-url", default=None, help="InventDB base URL (default: the app's configured one)")
    args = parser.parse_args()

    settings = get_settings()
    base = (args.base_url or settings.base_url).rstrip("/")
    namespace = settings.inventdb_namespace
    payload = bundle(namespace)

    print(f"InventDB : {base}")
    print(f"Namespace: {namespace}\n")
    if args.dry_run:
        print(json.dumps(payload, indent=2))
        print("\nDemo logins:", ", ".join(u for u, _ in DEMO_USERS))
        return 0

    username = os.environ.get("INVENTDB_ADMIN_USERNAME") or input("Superadmin username: ").strip()
    password = os.environ.get("INVENTDB_ADMIN_PASSWORD") or getpass.getpass("Superadmin password: ")
    admin = Inventdb(base)
    admin.login(username, password)
    me = admin.me()
    if str(me.get("globalRole") or me.get("role") or "").lower() != "superadmin":
        raise SystemExit("Sign in as a superadmin: only a superadmin can create the admin demo login.")

    print("1. Installing the Legal roles …")
    status, body = admin.call("POST", f"/api/namespaces/{namespace}/bootstrap", json=payload)
    if status != 200:
        print(f"   bundle refused ({status}): {_short(body)}\n   falling back to one role at a time")
        for role in payload["roles"]:
            s, b = admin.call("POST", "/api/roles", json=role)
            if s == 409:
                s, b = admin.call(
                    "PUT", f"/api/roles/{role['name']}", json={"description": role["description"], "grants": role["grants"]}
                )
            if s not in (200, 201):
                raise SystemExit(f"   could not install {role['name']} ({s}): {_short(b)}")
    else:
        data = body.get("data", body) if isinstance(body, dict) else {}
        for warning in (data.get("warnings") or []) if isinstance(data, dict) else []:
            print(f"   warning: {warning}")
    print("   done:", ", ".join(r["name"] for r in payload["roles"]))

    print("2. Creating the demo logins …")
    created: list[tuple[str, str, Optional[str], str]] = []
    for uname, tier in DEMO_USERS:
        secret = secrets.token_urlsafe(12)
        user = ensure_user(admin, uname, secret)
        if tier is None:
            s, b = admin.call("PUT", f"/api/users/{user['_id']}/role", json={"role": "superadmin"})
            if s != 200:
                raise SystemExit(f"   could not make {uname} a superadmin ({s}): {_short(b)}")
            how = "global superadmin"
        else:
            how = set_legal_role(admin, user, tier)
        created.append((uname, secret, tier, how))
        print(f"   {uname:<16} {how}")

    lines = [
        "# InventDB Legal demo logins. Git-ignored; do not commit or share widely.",
        f"# Instance: {base}",
        "",
    ]
    for uname, secret, tier, _ in created:
        lines.append(f"{uname:<16} {secret:<20} {tier or 'admin'}")
    CREDENTIALS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print("3. Checking each login against the tier table …")
    failures = 0
    for uname, secret, tier, _ in created:
        problems = verify(base, namespace, uname, secret, tier or "admin")
        failures += len(problems)
        print(f"   {uname:<16} {'ok' if not problems else 'MISMATCH'}")
        for p in problems:
            print(f"      - {p}")

    print(f"\nPasswords written to {CREDENTIALS_FILE}")
    if failures:
        print("Some checks did not match. The app still enforces its own table, but fix the grants above in InventDB.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
