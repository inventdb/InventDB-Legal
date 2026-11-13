"""Role tiers: how an InventDB role becomes a tier, and what each tier may reach.

The guard in ``app/access.py`` runs before every API route. These tests pin the
table itself (who sees which module, report and room), the resolution from
``/api/auth/me?app=legal``, and that nothing a non-admin is told names a role.
"""

from __future__ import annotations

import pytest

from app import access
from app.access import NOT_AVAILABLE, NOT_SET_UP, TIERS, tier_for_role


# ---- resolution ----------------------------------------------------------


@pytest.mark.parametrize(
    "role, global_role, expected",
    [
        ("", "superadmin", "admin"),
        ("legal:partner", "admin", "admin"),
        ("", "admin", "admin"),
        ("legal:partner", "reader", "partner"),
        ("Managing Partner", "reader", "partner"),
        ("Of Counsel", "writer", "partner"),
        ("legal:attorney", "reader", "attorney"),
        ("Senior Associate", "reader", "attorney"),
        ("legal:paralegal", "reader", "paralegal"),
        ("Intake Coordinator / Legal Assistant", "reader", "intake"),
        ("legal:finance", "reader", "finance"),
        ("Trust Officer", "reader", "finance"),
        ("", "reader", None),
        ("manager", "writer", None),
        ("", "", None),
    ],
)
def test_role_to_tier(role, global_role, expected):
    assert tier_for_role(role, global_role) == expected


def test_access_is_resolved_from_the_legal_app_role(api, fake, tier):
    tier.real = True
    fake.on(
        "GET",
        "/api/auth/me",
        {"username": "a.paralegal", "role": "legal:paralegal", "globalRole": "reader"},
    )

    body = api.get("/api/auth/access").get_json()

    assert body["provisioned"] is True
    assert body["tier"] == "paralegal"
    assert "/trust_ledger_cta" not in body["sections"]
    assert "/court_calendar" in body["sections"]
    me = fake.last_call("GET", "/api/auth/me")
    assert me.params.get("app") == "legal"


def test_a_person_with_no_legal_role_is_not_set_up(api, fake, tier):
    tier.real = True
    fake.on("GET", "/api/auth/me", {"username": "x", "role": "", "globalRole": "reader"})

    body = api.get("/api/auth/access").get_json()
    assert body == {
        "provisioned": False,
        "tier": None,
        "sections": [],
        "entities": {},
        "reports": [],
        "rooms": [],
    }

    res = api.get("/api/matters")
    assert res.status_code == 403
    assert res.get_json()["error"] == NOT_SET_UP


def test_the_tier_is_cached_per_token(api, fake, tier):
    tier.real = True
    fake.on("GET", "/api/auth/me", {"role": "legal:partner", "globalRole": "reader"})
    fake.on_sql(rows=[])

    api.get("/api/dashboard/summary")
    api.get("/api/dashboard/summary")

    assert len(fake.calls_to("GET", "/api/auth/me")) == 1


# ---- the table -----------------------------------------------------------


def test_admin_reaches_everything():
    admin = TIERS["admin"]
    for name in access.ALL_ENTITIES:
        assert admin.can_write(name)
    assert set(admin.reports) == set(access.ALL_REPORTS)
    assert "/settings" in admin.sections and "/import" in admin.sections


@pytest.mark.parametrize("key", ["attorney", "paralegal", "intake"])
def test_non_money_tiers_never_see_the_money(key):
    t = TIERS[key]
    for name in ("invoices", "payments_and_receipts", "trust_ledger_cta"):
        assert not t.can_read(name), (key, name)


def test_intake_sees_only_new_business():
    t = TIERS["intake"]
    assert t.can_write("intake_and_leads") and t.can_write("clients")
    assert not t.can_read("time_entries") and not t.can_read("deadlines_and_sol")
    assert t.sections == ["/", "/intake_and_leads", "/clients", "/matters", "/settings"]


def test_only_admin_maintains_lookups_and_imports():
    for key, t in TIERS.items():
        assert ("/lookups" in t.sections) == (key == "admin")
        assert ("/import" in t.sections) == (key == "admin")


# ---- the guard -----------------------------------------------------------


@pytest.mark.parametrize(
    "key, method, path, allowed",
    [
        ("intake", "GET", "/api/intake_and_leads", True),
        ("intake", "GET", "/api/invoices", False),
        ("intake", "GET", "/api/trust_ledger_cta/abc", False),
        ("intake", "GET", "/api/reports/pnl", False),
        ("intake", "POST", "/api/analyze/sql", False),
        ("intake", "GET", "/api/workflows", False),
        ("paralegal", "GET", "/api/matters", True),
        ("paralegal", "POST", "/api/matters", False),
        ("paralegal", "POST", "/api/court_calendar", True),
        ("paralegal", "POST", "/api/drill/invoices", False),
        ("paralegal", "GET", "/api/views/trust_ledger_cta", False),
        ("attorney", "GET", "/api/reports/deadlines", True),
        ("attorney", "GET", "/api/reports/pnl", False),
        ("finance", "GET", "/api/reports/trust-compliance", True),
        ("finance", "GET", "/api/deadlines_and_sol", False),
        ("finance", "GET", "/api/settings/connection", False),
        ("partner", "PUT", "/api/trust_ledger_cta/abc", False),
        ("partner", "GET", "/api/trust_ledger_cta", True),
        ("partner", "POST", "/api/import/matters", False),
        ("admin", "POST", "/api/import/matters", True),
        ("admin", "GET", "/api/settings/connection", True),
    ],
)
def test_guard(api, fake, tier, key, method, path, allowed):
    tier.key = key
    fake.on_sql(rows=[])
    res = api._open(method, path, json={"sql": "SELECT 1"} if method != "GET" else None)
    if allowed:
        assert res.status_code != 403, res.get_json()
    else:
        assert res.status_code == 403
        assert res.get_json()["error"] == NOT_AVAILABLE


def test_sql_naming_a_module_the_tier_cannot_read_is_refused(api, fake, tier):
    tier.key = "attorney"
    fake.on_sql(rows=[])

    ok = api.post("/api/meta/sql", json={"sql": "SELECT COUNT(*) FROM legal.matters"})
    assert ok.status_code == 200

    for sql in (
        "SELECT * FROM legal.trust_ledger_cta",
        "SELECT m.matter_id FROM legal.matters m JOIN legal.invoices i ON i.matter_id = m.matter_id",
        "SELECT * FROM _system.users",
    ):
        res = api.post("/api/meta/sql", json={"sql": sql})
        assert res.status_code == 403, sql
    assert not any("trust_ledger_cta" in q or "_system" in q for q in fake.sql_log)


def test_a_change_set_touching_a_read_only_module_is_refused(api, fake, tier):
    tier.key = "finance"
    res = api.post(
        "/api/analyze/change-set/apply",
        json={"steps": [{"op": "update", "typeName": "deadlines_and_sol", "data": {}}]},
    )
    assert res.status_code == 403
    assert not fake.calls_to("POST", "/api/change-sets/apply")


# ---- what reaches the screen --------------------------------------------


def test_dashboard_summary_leaves_out_what_the_tier_cannot_read(api, fake, tier):
    tier.key = "intake"
    fake.on_sql(rows=[])

    body = api.get("/api/dashboard/summary").get_json()

    assert set(body) == {"as_of", "matters", "clients", "intake"}
    assert not any("invoices" in q or "trust_ledger" in q for q in fake.sql_log)


def test_paralegal_time_block_has_hours_but_no_money(api, fake, tier):
    tier.key = "paralegal"
    fake.on_sql(rows=[])

    body = api.get("/api/dashboard/summary").get_json()

    assert "financials" not in body
    assert "wip_value" not in body["time"]
    assert {"hours_month", "unbilled_hours"} <= set(body["time"])


def test_panels_skip_the_ones_the_tier_cannot_read(api, fake, tier):
    tier.key = "attorney"
    fake.on_sql(rows=[{"_id": "d1", "description": "Answer due"}])

    body = api.get("/api/dashboard/panels?names=deadlines,trust,invoices,hearings").get_json()

    assert set(body) == {"deadlines", "hearings"}
    assert body["deadlines"]["entity"] == "deadlines_and_sol"
    assert body["deadlines"]["rows"][0]["description"] == "Answer due"


def test_a_failing_panel_comes_back_empty(api, fake, tier):
    tier.key = "partner"
    fake.on_sql(status=500, payload={"error": "no such type"})

    body = api.get("/api/dashboard/panels?names=leads").get_json()

    assert body == {"leads": {"entity": "intake_and_leads", "rows": []}}


def test_read_only_record_reason_never_names_a_role(api, fake, tier):
    tier.key = "attorney"
    fake.on_record("matters", "m1", {"_id": "m1"})

    body = api.get("/api/drill/matters/m1/access").get_json()

    assert body["can_edit"] is False
    assert "role" not in body["reason"].lower()
    assert "attorney" not in body["reason"].lower()


def test_admin_record_reason_never_names_a_role(api, fake, tier):
    fake.on_record("matters", "m1", {"_id": "m1"})
    fake.on("GET", "/api/auth/me", {"role": "superadmin"})

    body = api.get("/api/drill/matters/m1/access").get_json()

    assert body["can_edit"] is True
    assert "superadmin" not in body["reason"].lower()


def test_refusals_are_json(api, fake, tier):
    tier.key = "intake"
    res = api.get("/api/invoices")
    assert res.status_code == 403
    assert res.get_json() == {"ok": False, "error": NOT_AVAILABLE} or res.get_json()["error"] == NOT_AVAILABLE


