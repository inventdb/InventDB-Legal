"""``app.routers.drill`` — the records behind a number, and per-record access.

As in ``test_resources``, the drill listing is asserted on the SQL the app sends
upstream: the interesting behaviour is which filter reaches the statement, and
which never may. Access is asserted on the answer, with the upstream calls that
justify it.
"""

from __future__ import annotations

import pytest

from app.errors import ApiError
from app.sqlutil import safe_where


# ===========================================================================
# safe_where: what a WHERE fragment may be
# ===========================================================================


@pytest.mark.parametrize(
    "fragment",
    [
        "status = 'Open'",
        "(status = 'Open' OR priority = 'High') AND hours > 1",
        "YEAR(date_opened) = 2026 AND practice_area IN ('Family Law', 'Probate')",
        "t.transaction_type = 'Deposit' AND t.date >= '2026-10-01'",
        "narrative LIKE '%deposition%'",
        # Keywords inside a string are data, not SQL.
        "payee_payor = 'O''Drop; Update -- set'",
        "matter_id IN (SELECT matter_id FROM legal.matters WHERE court_short = 'Stanley Mosk')",
        "REPLACE(court_short, ' ', '') = 'StanleyMosk'",
    ],
)
def test_safe_where_accepts_filters(fragment):
    assert safe_where(fragment) == fragment


@pytest.mark.parametrize(
    "fragment",
    [
        "1=1; DELETE FROM legal.invoices",
        "status = 'Open' -- trailing",
        "status = 'Open' /* c */",
        "1=1) UNION ALL SELECT * FROM legal.clients WHERE (1=1",  # unbalanced after the wrap
        "status = 'Open",
        "1=1) OR (1=1",
        "id IN (SELECT 1 INTO x)",
        "x = 1 AND (UPDATE legal.invoices SET balance_due = 0)",
        "DROP TABLE legal.invoices",
        "a" * 4001,
    ],
)
def test_safe_where_refuses_anything_but_one_condition(fragment):
    with pytest.raises(ApiError) as err:
        safe_where(fragment)
    assert err.value.status_code == 400


def test_safe_where_treats_blank_as_no_filter():
    assert safe_where("   ") == ""


# ===========================================================================
# POST /api/drill/<entity>
# ===========================================================================


def test_drill_composes_where_filters_order_and_page(api, fake):
    fake.on_sql("COUNT(*)", rows=[{"c": 23}])
    fake.on_sql("SELECT * FROM", rows=[{"_id": "a", "matter_id": "MT-2001"}])

    resp = api.post(
        "/api/drill/matters",
        json={"where": "status = 'Open'", "filters": {"practice_area": "Probate"}, "limit": 10, "offset": 20},
    )

    assert resp.status_code == 200
    assert resp.get_json() == {"items": [{"_id": "a", "matter_id": "MT-2001"}], "total": 23, "limit": 10, "offset": 20}
    assert fake.sql_log == [
        "SELECT * FROM legal.matters WHERE (status = 'Open') AND practice_area = 'Probate' "
        "ORDER BY date_opened ASC LIMIT 10 OFFSET 20",
        "SELECT COUNT(*) AS c FROM legal.matters WHERE (status = 'Open') AND practice_area = 'Probate'",
    ]


def test_drill_keeps_the_query_alias_so_its_where_still_binds(api, fake):
    api.post(
        "/api/drill/payments_and_receipts",
        json={"alias": "p", "where": "p.method = 'Check'", "order_by": "amount", "order_dir": "desc"},
    )
    assert fake.sql_log[0] == (
        "SELECT * FROM legal.payments_and_receipts p WHERE (p.method = 'Check') "
        "ORDER BY p.amount DESC LIMIT 10 OFFSET 0"
    )


def test_drill_with_nothing_lists_the_whole_module(api, fake):
    api.post("/api/drill/clients", json={})
    assert fake.sql_log == [
        "SELECT * FROM legal.clients ORDER BY client_name ASC LIMIT 10 OFFSET 0",
        "SELECT COUNT(*) AS c FROM legal.clients",
    ]


def test_drill_null_filter_becomes_is_null(api, fake):
    api.post("/api/drill/time_entries", json={"filters": {"invoice_no": None}})
    assert "WHERE invoice_no IS NULL" in fake.sql_log[0]


def test_drill_escapes_filter_values(api, fake):
    api.post("/api/drill/clients", json={"filters": {"client_name": "O'Brien, Sean"}})
    assert "WHERE client_name = 'O''Brien, Sean'" in fake.sql_log[0]


def test_drill_clamps_the_page(api, fake):
    api.post("/api/drill/invoices", json={"limit": 100000, "offset": -5})
    assert fake.sql_log[0].endswith("LIMIT 200 OFFSET 0")


@pytest.mark.parametrize(
    "body",
    [
        {"where": "1=1; DROP TABLE legal.invoices"},
        {"filters": {"bad col": "x"}},
        {"filters": {"x": {"nested": 1}}},
        {"filters": ["x"]},
        {"alias": "t; --"},
        {"order_by": "status; DROP"},
        {"limit": "ten"},
        {"limit": True},
    ],
)
def test_drill_refuses_a_hostile_body_before_any_sql(api, fake, body):
    resp = api.post("/api/drill/invoices", json=body)
    assert resp.status_code == 400
    assert fake.sql_log == []


def test_drill_unknown_module_is_404(api, fake):
    assert api.post("/api/drill/payroll", json={}).status_code == 404
    assert fake.sql_log == []


def test_drill_reports_a_failing_query_instead_of_an_empty_page(api, fake):
    """'Nothing behind this number' and 'could not re-run it' must differ."""
    fake.on_sql("SELECT * FROM", status=400, payload={"error": "unknown column cost"})
    resp = api.post("/api/drill/matters", json={"where": "cost > 1"})
    assert resp.status_code == 400
    assert "unknown column" in resp.get_json()["error"]


def test_drill_needs_a_token(api, fake):
    assert api.post("/api/drill/invoices", json={}, token=None).status_code == 401
    assert fake.calls == []


# ===========================================================================
# GET /api/drill/<entity>/<id>/access
# ===========================================================================

ME = "/api/auth/me"
CHECK = "/api/permissions/check"


def _me(fake, role):
    fake.on("GET", ME, {"ok": True, "user": {"id": "u1", "username": "x", "role": role}})


def test_admin_may_edit_any_visible_record(api, fake):
    fake.on_record("invoices", "inv-1", {"_id": "inv-1", "invoice_no": "INV-2026-0001"})
    _me(fake, "superadmin")

    body = api.get("/api/drill/invoices/inv-1/access").get_json()

    assert body["can_view"] is True and body["can_edit"] is True
    assert body["row_rules"] == "bypassed"
    assert fake.calls_to("GET", CHECK) == []  # no grant lookup needed


def test_writer_may_edit_and_is_told_row_rules_apply_on_save(api, fake):
    fake.on_record("invoices", "inv-1", {"_id": "inv-1"})
    _me(fake, "user")
    fake.on("GET", CHECK, {"ok": True, "has_permission": True})

    body = api.get("/api/drill/invoices/inv-1/access").get_json()

    assert body["can_edit"] is True
    assert body["row_rules"] == "enforced_on_save"
    check = fake.last_call("GET", CHECK)
    assert check.params == {"resource": "legal.invoices", "level": "write"}


def test_reader_sees_the_record_but_may_not_edit(api, fake):
    fake.on_record("invoices", "inv-1", {"_id": "inv-1"})
    _me(fake, "user")
    fake.on("GET", CHECK, {"ok": True, "has_permission": False})

    body = api.get("/api/drill/invoices/inv-1/access").get_json()

    assert body == {
        "can_view": True,
        "can_edit": False,
        "reason": "You can view invoices but not change them.",
        "row_rules": "n/a",
    }


def test_grant_answer_wrapped_in_data_is_read_too(api, fake):
    fake.on_record("clients", "c1", {"_id": "c1"})
    _me(fake, "user")
    fake.on("GET", CHECK, {"ok": True, "data": {"has_permission": True}})
    assert api.get("/api/drill/clients/c1/access").get_json()["can_edit"] is True


@pytest.mark.parametrize("status", [403, 404])
def test_a_record_hidden_by_row_rules_is_neither_viewable_nor_editable(api, fake, status):
    fake.on_record("invoices", "inv-9", {"error": "not found"}, status=status)
    _me(fake, "superadmin")

    body = api.get("/api/drill/invoices/inv-9/access").get_json()

    assert body["can_view"] is False and body["can_edit"] is False
    # Never asks about grants for a record it couldn't see.
    assert fake.calls_to("GET", ME) == [] and fake.calls_to("GET", CHECK) == []


@pytest.mark.parametrize("bad", ["abc?x=1", "a b", "..", "a" * 129])
def test_access_refuses_ids_that_could_change_the_upstream_url(api, fake, bad):
    resp = api.get(f"/api/drill/invoices/{bad}/access")
    assert resp.status_code in (400, 404)
    assert fake.calls == []


def test_access_on_an_unknown_module_is_404(api, fake):
    assert api.get("/api/drill/payroll/x1/access").status_code == 404


# ===========================================================================
# GET /api/drill/<entity>/<id>/files
# ===========================================================================

ROOT = "Alvarado & Sung LLP/Clients"


def _att(att_id, filename, folder, record_type="documents", record_id="_vault"):
    return {"_id": att_id, "record_type": record_type, "record_id": record_id,
            "filename": filename, "folder_path": folder, "content_type": "application/pdf"}


def test_a_matter_lists_what_is_attached_and_what_is_filed_in_its_folder(api, fake):
    fake.on_record("matters", "m1", {"_id": "m1", "matter_id": "MT-2599", "client_id": "CL-1"})
    fake.on_sql("_attachments", rows=[
        _att("a2", "2025-07-21 Petition - Alcaraz - MT-2599 - Raghunathan.pdf", f"{ROOT}/Alcaraz, Consuelo/MT-2599 Estate of Villanueva/02 Pleadings"),
        _att("a1", "signed-retainer.pdf", "", record_type="matters", record_id="m1"),
        # MT-25 is not MT-2599: a folder that merely starts with the same digits is not this matter's.
        _att("a3", "2025-01-01 Fee Agreement - Other - MT-25990 - X.pdf", f"{ROOT}/Other/MT-25990 Other v. Other/01 Intake & Engagement"),
    ])

    body = api.get("/api/drill/matters/m1/files").get_json()

    assert body["numbers"] == ["MT-2599"]
    assert [(f["attachment_id"], f["filed_under"]) for f in body["files"]] == [("a1", None), ("a2", "MT-2599")]
    sql = fake.sql_log[-1]
    assert "(record_type = 'matters' AND record_id = 'm1')" in sql
    assert "folder_path LIKE '%/MT-2599 %'" in sql
    # A LIKE on _attachments.filename finds nothing unless it is a pure prefix,
    # so file names are never matched in SQL.
    assert "filename LIKE" not in sql


def test_an_invoice_lists_the_paper_in_its_matter_folder_that_carries_its_number(api, fake):
    fake.on_record("invoices", "i1", {"_id": "i1", "invoice_no": "INV-2026-1562", "matter_id": "MT-3087"})
    fake.on_sql("_attachments", rows=[
        _att("a1", "2026-07-15 Invoice INV-2026-1562 - Alcaraz - MT-3087 - Alvarado.pdf", f"{ROOT}/Alcaraz, Alejandro/MT-3087 In re Marriage of Alcaraz/09 Billing"),
        _att("a2", "2026-08-15 Invoice INV-2026-1700 - Alcaraz - MT-3087 - Alvarado.pdf", f"{ROOT}/Alcaraz, Alejandro/MT-3087 In re Marriage of Alcaraz/09 Billing"),
    ])

    body = api.get("/api/drill/invoices/i1/files").get_json()

    assert [f["attachment_id"] for f in body["files"]] == ["a1"]
    assert body["files"][0]["filed_under"] == "INV-2026-1562"
    assert "folder_path LIKE '%/MT-3087 %'" in fake.sql_log[-1]


def test_a_client_lists_the_papers_of_every_matter_it_holds(api, fake):
    fake.on_record("clients", "c1", {"_id": "c1", "client_id": "CL-1037"})
    fake.on_sql("FROM legal.matters", rows=[{"matter_id": "MT-2039"}, {"matter_id": "MT-3247"}])
    fake.on_sql("_attachments", rows=[
        _att("a1", "2025-02-17 Complaint - Alcaraz - MT-2039 - Nwosu.pdf", f"{ROOT}/Alcaraz, Carlos/MT-2039 In re Alcaraz/02 Pleadings"),
        _att("a2", "2026-08-07 Deadline - Alcaraz - MT-3247 - Nwosu.pdf", f"{ROOT}/Alcaraz, Carlos/MT-3247 In re Alcaraz/05 Deadlines"),
    ])

    body = api.get("/api/drill/clients/c1/files").get_json()

    assert body["numbers"] == ["MT-2039", "MT-3247"]
    assert {f["filed_under"] for f in body["files"]} == {"MT-2039", "MT-3247"}
    assert "client_id = 'CL-1037'" in fake.sql_log[0]


def test_a_number_that_is_not_one_never_reaches_the_query(api, fake):
    fake.on_record("matters", "m1", {"_id": "m1", "matter_id": "x' OR '1'='1"})
    fake.on_sql("_attachments", rows=[])

    body = api.get("/api/drill/matters/m1/files").get_json()

    assert body == {"files": [], "numbers": []}
    assert "OR '1'" not in fake.sql_log[-1]
    assert "folder_path LIKE" not in fake.sql_log[-1]


@pytest.mark.parametrize("status", [403, 404])
def test_files_of_a_record_hidden_from_this_person_are_none(api, fake, status):
    fake.on_record("matters", "m9", {"error": "not found"}, status=status)
    assert api.get("/api/drill/matters/m9/files").get_json() == {"files": [], "numbers": []}
    assert fake.sql_log == []


@pytest.mark.parametrize("bad", ["abc?x=1", "a b", "..", "a" * 129])
def test_files_refuse_ids_that_could_change_the_upstream_url(api, fake, bad):
    assert api.get(f"/api/drill/matters/{bad}/files").status_code in (400, 404)
    assert fake.calls == []


def test_drill_carries_the_page_search_over_the_module_search_fields(api, fake):
    api.post("/api/drill/court_calendar", json={"filters": {"date": "2026-10-09"}, "q": "depo"})
    sql = fake.sql_log[0]
    assert "date = '2026-10-09'" in sql
    assert "event_type LIKE '%depo%' ESCAPE" in sql
    assert " OR " in sql


def test_drill_search_must_be_text(api, fake):
    assert api.post("/api/drill/court_calendar", json={"q": ["x"]}).status_code == 400
    assert fake.sql_log == []
