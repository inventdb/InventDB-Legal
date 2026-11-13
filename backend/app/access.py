"""Who may see what: the firm's roles collapsed into tiers.

InventDB decides who a person is. ``GET /api/auth/me?app=legal`` returns their
Legal role (``app_roles["legal"]``), and a global ``admin`` or ``superadmin``
always wins over it. This module turns that role into one of six tiers and
holds the single table of what each tier may reach.

There are three layers, and this is the middle one:

1. **InventDB grants** (the ``legal:*`` roles that ``scripts/provision_roles.py``
   installs) are the real boundary. They apply to every query, including raw
   SQL from Analyze, reports and dashboard widgets.
2. **This table**, enforced by :func:`guard` before every API request. It refuses
   modules, reports and rooms the tier has no business in, so a missing or
   too-generous InventDB grant does not turn into a leak.
3. **The frontend** shows only the sections in ``sections`` and builds the
   tier's dashboard. Hiding things there is a convenience, not security.

Tier names never appear on screen. The client receives the tier key only so it
can pick a dashboard, and every refusal message is worded without it.
"""

from __future__ import annotations

import hashlib
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from flask import g, request

from .config import get_settings
from .errors import ApiError

READ = "read"
WRITE = "write"

#: Every module (InventDB type) the app knows, mirrored from ``entities.py``.
ALL_ENTITIES = (
    "matters",
    "clients",
    "timekeepers",
    "time_entries",
    "costs_and_disbursements",
    "invoices",
    "payments_and_receipts",
    "trust_ledger_cta",
    "court_calendar",
    "deadlines_and_sol",
    "intake_and_leads",
    "settlements_and_liens",
    "lookups",
)

#: The named financial and practice reports under ``/api/reports/<name>``.
ALL_REPORTS = (
    "pnl",
    "cashflow",
    "wip",
    "deadlines",
    "caseload",
    "time-entries",
    "ar-aging",
    "trust-compliance",
)

#: Rooms that are not a module.
ROOMS = ("files", "reports", "analyze", "workflows", "import", "admin_settings")


@dataclass(frozen=True)
class Tier:
    key: str
    #: Module -> READ or WRITE. A module that is absent is not visible at all.
    entities: dict[str, str]
    reports: tuple[str, ...] = ()
    rooms: tuple[str, ...] = ()
    #: InventDB-side description, used when provisioning the role.
    description: str = ""
    #: Job titles that land in this tier (lower-case, spaces only).
    titles: tuple[str, ...] = field(default=())

    def can_read(self, entity: str) -> bool:
        return entity in self.entities

    def can_write(self, entity: str) -> bool:
        return self.entities.get(entity) == WRITE

    @property
    def sections(self) -> list[str]:
        """Frontend paths this tier is shown, in sidebar order."""
        out = ["/"]
        for name in (
            "intake_and_leads",
            "clients",
            "matters",
            "timekeepers",
            "time_entries",
            "costs_and_disbursements",
            "invoices",
            "trust_ledger_cta",
            "payments_and_receipts",
            "settlements_and_liens",
            "court_calendar",
            "deadlines_and_sol",
        ):
            if name in self.entities:
                out.append(f"/{name}")
        for room in ("files", "import", "reports", "analyze", "workflows"):
            if room in self.rooms:
                out.append(f"/{room}")
        # Lookups are reference data every tier reads behind the scenes; only
        # the people who maintain them get the section.
        if self.can_write("lookups"):
            out.append("/lookups")
        out.append("/settings")
        return out


def _all(level: str) -> dict[str, str]:
    return {name: level for name in ALL_ENTITIES}


TIERS: dict[str, Tier] = {
    "admin": Tier(
        key="admin",
        entities=_all(WRITE),
        reports=ALL_REPORTS,
        rooms=ROOMS,
        description="Firm administrators: every module, room and setting.",
        titles=("admin", "superadmin", "administrator", "it administrator", "systems administrator"),
    ),
    "partner": Tier(
        key="partner",
        entities={
            **_all(READ),
            "matters": WRITE,
            "clients": WRITE,
            "time_entries": WRITE,
            "costs_and_disbursements": WRITE,
            "invoices": WRITE,
            "settlements_and_liens": WRITE,
            "court_calendar": WRITE,
            "deadlines_and_sol": WRITE,
            "intake_and_leads": WRITE,
        },
        reports=ALL_REPORTS,
        rooms=("files", "reports", "analyze", "workflows"),
        description="Partners and Of Counsel: the whole practice, its money read-only, approvals.",
        titles=(
            "partner",
            "managing partner",
            "senior partner",
            "equity partner",
            "salaried partner",
            "non equity partner",
            "of counsel",
            "consultant",
            "practice manager",
            "coo",
        ),
    ),
    "attorney": Tier(
        key="attorney",
        entities={
            "matters": READ,
            "clients": READ,
            "time_entries": WRITE,
            "costs_and_disbursements": WRITE,
            "court_calendar": WRITE,
            "deadlines_and_sol": WRITE,
            "lookups": READ,
        },
        reports=("deadlines", "caseload", "time-entries"),
        rooms=("files", "reports", "analyze"),
        description="Associates and trainees: their matters, time, costs and the docket.",
        titles=(
            "attorney",
            "lawyer",
            "associate",
            "senior associate",
            "junior associate",
            "trainee",
            "articled clerk",
            "intern",
            "counsel",
            "barrister",
            "advocate",
        ),
    ),
    "paralegal": Tier(
        key="paralegal",
        entities={
            "matters": READ,
            "clients": READ,
            "time_entries": WRITE,
            "costs_and_disbursements": WRITE,
            "court_calendar": WRITE,
            "deadlines_and_sol": WRITE,
            "lookups": READ,
        },
        rooms=("files",),
        description="Paralegals, legal assistants, docketing and court clerks: the docket and the file.",
        titles=(
            "paralegal",
            "senior paralegal",
            "legal assistant",
            "legal secretary",
            "law clerk",
            "docketing clerk",
            "calendar clerk",
            "court clerk",
            "registry clerk",
            "munshi",
            "litigation support",
            "knowledge management",
        ),
    ),
    "intake": Tier(
        key="intake",
        entities={
            "intake_and_leads": WRITE,
            "clients": WRITE,
            "matters": READ,
            "lookups": READ,
        },
        description="Front desk, intake, conflicts and business development: new business and clients.",
        titles=(
            "intake",
            "intake coordinator",
            "intake coordinator / legal assistant",
            "receptionist",
            "client intake",
            "conflicts analyst",
            "business development",
            "marketing",
        ),
    ),
    "finance": Tier(
        key="finance",
        entities={
            "matters": READ,
            "clients": READ,
            "timekeepers": READ,
            "time_entries": WRITE,
            "costs_and_disbursements": WRITE,
            "invoices": WRITE,
            "payments_and_receipts": WRITE,
            "trust_ledger_cta": WRITE,
            "settlements_and_liens": WRITE,
            "lookups": READ,
        },
        reports=("pnl", "cashflow", "wip", "ar-aging", "trust-compliance", "time-entries"),
        rooms=("files", "reports", "analyze", "workflows"),
        description="Billing, accounts, trust and finance: time to cash, and the client account.",
        titles=(
            "finance",
            "billing",
            "billing clerk",
            "accounts",
            "accounts clerk",
            "bookkeeper",
            "trust officer",
            "trust account officer",
            "cofa",
            "cfo",
            "finance director",
            "compliance officer",
            "colp",
            "auditor",
        ),
    ),
}

ADMIN_ROLES = {"admin", "superadmin"}

_TITLE_TO_TIER = {title: tier.key for tier in TIERS.values() for title in tier.titles}


def _norm(role: Any) -> str:
    text = str(role or "").strip().lower()
    if text.startswith("legal:"):
        text = text[len("legal:") :]
    return re.sub(r"[\s_\-]+", " ", text).strip()


def tier_for_role(role: Any, global_role: Any = "") -> Optional[str]:
    """The tier for an InventDB role pair, or None when not set up for Legal."""
    if _norm(global_role) in ADMIN_ROLES or _norm(role) in ADMIN_ROLES:
        return "admin"
    key = _norm(role)
    if key in TIERS:
        return key
    return _TITLE_TO_TIER.get(key)


def tier_from_me(me: Any) -> Optional[str]:
    user = me.get("user") if isinstance(me, dict) else None
    if not isinstance(user, dict):
        user = me if isinstance(me, dict) else {}
    tier = tier_for_role(user.get("role"), user.get("globalRole"))
    if tier is None:
        # An instance without per-app roles can still attach the bundle role
        # (``legal:partner`` …) to the user's ``roles`` list. Admins are already
        # caught above, so only Legal's own role names are honoured here.
        roles = user.get("roles")
        for name in roles if isinstance(roles, list) else []:
            text = str(name or "").strip().lower()
            if text.startswith("legal:") and _norm(text) in TIERS and _norm(text) != "admin":
                return _norm(text)
    return tier


# --------------------------------------------------------------------------
# Resolving the caller's tier, cached briefly so every request does not cost a
# second round trip to InventDB. Keyed by a hash of the token and base URL; the
# raw token is never kept.

_CACHE_TTL = 60.0
_CACHE_MAX = 2048
_cache: dict[str, tuple[float, Optional[str]]] = {}
_lock = threading.Lock()


def _cache_key(token: str) -> str:
    base = get_settings().base_url
    return hashlib.sha256(f"{base}\x00{token}".encode()).hexdigest()


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def resolve_tier(client) -> Optional[str]:
    """The tier for the client's token, from ``/api/auth/me?app=legal``."""
    key = _cache_key(client.token or "")
    now = time.monotonic()
    with _lock:
        hit = _cache.get(key)
        if hit and hit[0] > now:
            return hit[1]
    tier = tier_from_me(client.me())
    with _lock:
        if len(_cache) >= _CACHE_MAX:
            _cache.clear()
        _cache[key] = (now + _CACHE_TTL, tier)
    return tier


def access_payload(tier_key: Optional[str]) -> dict[str, Any]:
    """What the frontend needs to build the signed-in frame."""
    if tier_key is None:
        return {"provisioned": False, "tier": None, "sections": [], "entities": {}, "reports": [], "rooms": []}
    tier = TIERS[tier_key]
    return {
        "provisioned": True,
        "tier": tier.key,
        "sections": tier.sections,
        "entities": dict(tier.entities),
        "reports": list(tier.reports),
        "rooms": list(tier.rooms),
    }


# --------------------------------------------------------------------------
# The request guard.

NOT_SET_UP = "Your account is not set up for InventDB Legal yet. Ask your administrator for access."
NOT_AVAILABLE = "This part of InventDB Legal is not available to your account."

_PUBLIC = {
    "/api/health",
    "/api/auth/health",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/me",
    "/api/auth/access",
}

_SQL_TABLE = re.compile(r"(?:from|join)\s+([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)?)", re.I)
_QUALIFIED = re.compile(r"\b([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\b")


def sql_types(sql: str, namespace: str) -> tuple[set[str], bool]:
    """Types a SQL statement reads, and whether it touches a system namespace."""
    found: set[str] = set()
    system = False
    for ns, type_name in _QUALIFIED.findall(sql or ""):
        if ns.startswith("_"):
            system = True
        if ns == namespace:
            found.add(type_name)
    for table in _SQL_TABLE.findall(sql or ""):
        if "." in table:
            ns, type_name = table.split(".", 1)
            if ns.startswith("_"):
                system = True
            elif ns == namespace:
                found.add(type_name)
        elif table in ALL_ENTITIES:
            found.add(table)
    return found, system


def _deny(message: str = NOT_AVAILABLE) -> None:
    raise ApiError(403, message)


def _need_entity(tier: Tier, entity: str, write: bool) -> None:
    if entity not in ALL_ENTITIES:
        return  # unknown types 404 in their own router
    if write and not tier.can_write(entity):
        _deny()
    if not tier.can_read(entity):
        _deny()


def _need_room(tier: Tier, room: str) -> None:
    if room not in tier.rooms:
        _deny()


def _check_sql(tier: Tier) -> None:
    body = request.get_json(silent=True)
    sql = ""
    if isinstance(body, dict):
        sql = str(body.get("sql") or body.get("query") or body.get("statement") or "")
    types, system = sql_types(sql, get_settings().inventdb_namespace)
    if system and tier.key != "admin":
        _deny()
    for type_name in types:
        if type_name in ALL_ENTITIES and not tier.can_read(type_name):
            _deny()


def authorize(tier: Tier, method: str, path: str) -> None:
    """Raise 403 when ``tier`` may not make this request. Pure path logic."""
    parts = [p for p in path.split("/") if p][1:]  # drop "api"
    if not parts:
        return
    head, rest = parts[0], parts[1:]
    write = method not in ("GET", "HEAD", "OPTIONS")

    if head in ("auth", "health", "notifications"):
        return
    if head == "meta":
        if rest[:1] == ["sql"]:
            _check_sql(tier)
        return
    if head == "dashboard":
        return  # filtered per tier inside the router
    if head == "settings":
        _need_room(tier, "admin_settings")
        return
    if head == "workflows":
        _need_room(tier, "workflows")
        return
    if head == "import":
        _need_room(tier, "import")
        if rest:
            _need_entity(tier, rest[0], True)
        return
    if head == "analyze":
        _need_room(tier, "analyze")
        if rest[:1] == ["sql"]:
            _check_sql(tier)
        if rest[:1] == ["records"] and len(rest) > 1:
            _need_entity(tier, rest[1], write)
        if rest[:2] == ["change-set", "apply"]:
            body = request.get_json(silent=True)
            steps = body.get("steps") if isinstance(body, dict) else None
            for step in steps if isinstance(steps, list) else []:
                if isinstance(step, dict):
                    _need_entity(tier, str(step.get("typeName") or ""), True)
        return
    if head == "reports":
        _need_room(tier, "reports")
        if rest and rest[0] in ALL_REPORTS and rest[0] not in tier.reports:
            _deny()
        return
    if head == "files":
        if rest and rest[0] in ("search", "bulk-delete", "attach"):
            _need_room(tier, "files")
            return
        if rest:
            _need_entity(tier, rest[0], write)
        return
    if head in ("drill", "views"):
        # Both read: a drill or a saved view never writes a record.
        if rest:
            _need_entity(tier, rest[0], False)
        return
    # The generic module router: /api/<entity>[/<id>]
    _need_entity(tier, head, write)


def guard() -> None:
    """``before_request`` hook: resolve the caller's tier and check the path."""
    path = request.path
    if not path.startswith("/api/") or request.method == "OPTIONS" or path in _PUBLIC:
        return
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return  # the route itself answers 401
    from .context import authed_client  # local: context imports nothing of ours

    client = authed_client()
    tier_key = resolve_tier(client)
    if tier_key is None:
        raise ApiError(403, NOT_SET_UP)
    g.tier = TIERS[tier_key]
    authorize(g.tier, request.method, path)


def current_tier() -> Tier:
    """The tier :func:`guard` resolved for this request (admin outside a request)."""
    tier = getattr(g, "tier", None)
    return tier if isinstance(tier, Tier) else TIERS["admin"]
