"""``app.routers.reports`` — SOAR saved reports plus the practice SQL rollups.

Two very different things share this blueprint. The ``/templates/*`` routes are
a proxy with real logic in front of them (parameter pickers are resolved
concurrently, and the bind-field choice decides whether a rendered report has
any rows at all). The rollups are SQL executed inside InventDB, so what matters
is the exact statement and the post-processing of grouped rows.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.routers.reports import _distribution, _num, _pick_bind_field, _title


# ===========================================================================
# Formatting helpers
# ===========================================================================


@pytest.mark.parametrize(
    "value,expected",
    [
        ("open", "Open"),
        ("in progress", "In Progress"),
        ("SOL", "SOL"),
        ("sol", "SOL"),
        ("wcab los angeles", "WCAB Los Angeles"),
        ("trust ledger cta", "Trust Ledger CTA"),
        ("ach transfer", "ACH Transfer"),
        ("probate and trust administration", "Probate and Trust Administration"),
        ("statute of limitations", "Statute of Limitations"),
        ("", "Other"),
        ("   ", "Other"),
        (None, "Other"),
    ],
)
def test_title_restores_case_that_inventdb_lowercases_on_group_by(value, expected):
    """InventDB lowercases string values in a GROUP BY, so labels have to be
    rebuilt — including the acronyms that `.title()` would otherwise mangle
    into "Sol" and "Wcab", and the joining words it would raise into "And"."""
    assert _title(value) == expected


@pytest.mark.parametrize(
    "value,expected", [(None, 0.0), ("", 0.0), ("abc", 0.0), (1.005, 1.0), (1.567, 1.57), ("12.5", 12.5)]
)
def test_num_rounds_to_cents_and_never_raises(value, expected):
    assert _num(value) == expected


def test_distribution_reads_the_dimension_by_its_real_column_name():
    """InventDB ignores `AS` aliases on grouped columns, so the dimension comes
    back under its own name while the aggregate keeps the alias."""
    rows = [{"status": "occupied", "value": 3}, {"status": "vacant", "value": 1}]

    assert _distribution(rows, "status") == [
        {"name": "Occupied", "value": 3},
        {"name": "Vacant", "value": 1},
    ]


def test_distribution_can_carry_money_instead_of_counts():
    rows = [{"expense_category": "repairs", "value": "1200.5"}]
    assert _distribution(rows, "expense_category", num=True) == [
        {"name": "Repairs", "value": 1200.5}
    ]


def test_distribution_coerces_a_missing_value_to_zero():
    assert _distribution([{"status": "occupied"}], "status") == [
        {"name": "Occupied", "value": 0}
    ]


# ===========================================================================
# Parameter binding
# ===========================================================================


def test_bind_field_prefers_the_business_key_over_the_internal_id():
    """A template's SQL filters on `client_id`, so binding InventDB's `_id` GUID
    would match nothing and the report would render empty."""
    sample = {"_id": "guid-1", "client_id": "O-001", "name": "Acme"}
    assert _pick_bind_field(sample) == "client_id"


@pytest.mark.parametrize(
    "sample,expected",
    [
        ({"_id": "g", "matter_id": "P-1"}, "matter_id"),
        ({"_id": "g", "timekeeper_id": 42}, "timekeeper_id"),  # numeric keys count
        ({"_id": "g", "client_id": "", "cost_id": "V-1"}, "cost_id"),  # empty skipped
        ({"_id": "g", "client_id": None, "cost_id": "V-1"}, "cost_id"),
        ({"_id": "g", "name": "Acme"}, None),  # no business key at all
        ({"_id": "g", "id": "x"}, None),  # `id` is internal too
        ({"_id": "g", "_owner_id": "x"}, None),  # underscore-prefixed skipped
        ({}, None),
        (None, None),
    ],
)
def test_bind_field_selection(sample, expected):
    assert _pick_bind_field(sample) == expected


def test_bind_field_takes_the_first_business_key_in_column_order():
    sample = {"_id": "g", "client_id": "O-1", "matter_id": "P-1"}
    assert _pick_bind_field(sample) == "client_id"


# ===========================================================================
# Saved report listing
# ===========================================================================


TEMPLATES = [
    {"_id": "t2", "name": "Rent Roll", "category": "Leasing", "mode": "sql", "version": 2},
    {"_id": "t1", "name": "Aged Receivables", "category": "Finance", "createdBy": "rohan"},
    {"_id": "t3", "name": "arrears", "category": "finance"},
]


def test_templates_are_sorted_by_category_then_name_case_insensitively(api, fake):
    fake.on("GET", "/api/report-templates", {"ok": True, "data": {"templates": TEMPLATES}})

    body = api.get("/api/reports/templates").get_json()

    assert [t["name"] for t in body["templates"]] == [
        "Aged Receivables",
        "arrears",  # lowercase sorts with its peers, not after them
        "Rent Roll",
    ]
    assert body["count"] == 3


def test_a_template_without_an_id_is_dropped(api, fake):
    """It could not be opened or rendered, so listing it would be a dead link."""
    fake.on(
        "GET",
        "/api/report-templates",
        {"ok": True, "data": {"templates": [{"name": "orphan"}, {"_id": "t1", "name": "ok"}]}},
    )

    body = api.get("/api/reports/templates").get_json()

    assert [t["id"] for t in body["templates"]] == ["t1"]
    assert body["count"] == 1


def test_listing_fills_in_defaults_for_absent_fields(api, fake):
    fake.on("GET", "/api/report-templates", {"ok": True, "data": {"templates": [{"_id": "t1"}]}})

    entry = api.get("/api/reports/templates").get_json()["templates"][0]

    assert entry == {
        "id": "t1",
        "name": "(untitled report)",
        "description": "",
        "category": "",
        "mode": "",
        "version": None,
        "created_by": "",
    }


@pytest.mark.parametrize(
    "upstream", [{"ok": True, "data": {}}, {"ok": True, "data": {"templates": []}}, None, {}]
)
def test_an_instance_with_no_saved_reports_returns_an_empty_list(api, fake, upstream):
    fake.on("GET", "/api/report-templates", upstream)
    assert api.get("/api/reports/templates").get_json() == {"templates": [], "count": 0}


# ===========================================================================
# Saved report detail and parameter resolution
# ===========================================================================


def test_the_template_html_is_never_sent_to_the_client(api, fake):
    """It is the report *source* — tens of kilobytes the UI never displays,
    since it only ever shows rendered output."""
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {"ok": True, "data": {"_id": "t1", "name": "R", "html": "<h1>" + "x" * 5000}},
    )

    body = api.get("/api/reports/templates/t1").get_json()

    assert "html" not in body


def test_parameters_are_normalised_with_defaults(api, fake):
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {
            "ok": True,
            "data": {
                "_id": "t1",
                "name": "R",
                "parameters": [
                    {"name": "as_of", "type": "date", "required": False, "default": "today"},
                    {"name": "bare"},
                ],
            },
        },
    )

    params = api.get("/api/reports/templates/t1").get_json()["parameters"]

    assert params[0] == {
        "name": "as_of",
        "label": "as_of",  # falls back to the name
        "type": "date",
        "required": False,
        "default": "today",
        "options": [],
    }
    assert params[1]["type"] == "text"  # default type
    assert params[1]["required"] is True  # required unless it says otherwise


def test_malformed_parameter_entries_are_skipped(api, fake):
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {"ok": True, "data": {"_id": "t1", "parameters": ["not-a-dict", None, {"name": "ok"}]}},
    )

    params = api.get("/api/reports/templates/t1").get_json()["parameters"]

    assert [p["name"] for p in params] == ["ok"]


def test_a_source_backed_parameter_is_resolved_into_dropdown_options(api, fake):
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {
            "ok": True,
            "data": {
                "_id": "t1",
                "parameters": [{"name": "client", "source": "legal.clients"}],
            },
        },
    )
    fake.on_sql(
        "FROM legal.clients",
        rows=[
            {"_id": "g1", "client_id": "O-001", "name": "Acme Holdings"},
            {"_id": "g2", "client_id": "O-002", "name": "Vista Trust"},
        ],
    )

    options = api.get("/api/reports/templates/t1").get_json()["parameters"][0]["options"]

    assert options == [
        {"value": "O-001", "label": "Acme Holdings"},
        {"value": "O-002", "label": "Vista Trust"},
    ]
    assert "SELECT * FROM legal.clients LIMIT 200" in fake.sql_log


def test_an_explicit_bind_field_overrides_the_heuristic(api, fake):
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {
            "ok": True,
            "data": {
                "_id": "t1",
                "parameters": [{"name": "o", "source": "legal.clients", "bindField": "_id"}],
            },
        },
    )
    fake.on_sql("FROM legal.clients", rows=[{"_id": "g1", "client_id": "O-001", "name": "Acme"}])

    options = api.get("/api/reports/templates/t1").get_json()["parameters"][0]["options"]

    assert options == [{"value": "g1", "label": "Acme"}]


@pytest.mark.parametrize(
    "row,expected_label",
    [
        ({"client_id": "O-1", "name": "By name"}, "By name"),
        ({"client_id": "O-1", "title": "By title"}, "By title"),
        ({"client_id": "O-1", "first_name": "By first"}, "By first"),
        ({"client_id": "O-1", "label": "By label"}, "By label"),
        ({"client_id": "O-1", "description": "By description"}, "By description"),
        ({"client_id": "O-1"}, "O-1"),  # nothing to label with -> the value
        ({"client_id": "O-1", "name": "", "title": "Skips blanks"}, "Skips blanks"),
    ],
)
def test_option_labels_follow_the_declared_field_preference(api, fake, row, expected_label):
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {"ok": True, "data": {"_id": "t1", "parameters": [{"name": "o", "source": "legal.clients"}]}},
    )
    fake.on_sql("FROM legal.clients", rows=[row])

    options = api.get("/api/reports/templates/t1").get_json()["parameters"][0]["options"]

    assert options == [{"value": "O-1", "label": expected_label}]


def test_rows_with_no_bindable_value_are_skipped(api, fake):
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {"ok": True, "data": {"_id": "t1", "parameters": [{"name": "o", "source": "legal.clients"}]}},
    )
    fake.on_sql(
        "FROM legal.clients",
        rows=[
            {"_id": "g1", "client_id": "O-1", "name": "Keep"},
            {"_id": "g2", "client_id": "", "name": "Drop"},
            {"_id": "g3", "client_id": None, "name": "Drop"},
        ],
    )

    options = api.get("/api/reports/templates/t1").get_json()["parameters"][0]["options"]

    assert [o["label"] for o in options] == ["Keep"]


@pytest.mark.parametrize(
    "source",
    [
        "",
        "clients",  # not namespace-qualified
        "a.b.c",  # too many parts
        "legal.clients; DROP TABLE x",
        "bad-ns.clients",
        "legal.own ers",
        "../etc.clients",
    ],
)
def test_a_bad_source_degrades_the_picker_to_free_text(api, fake, source):
    """One malformed parameter must not take down the whole report — the field
    just loses its dropdown."""
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {"ok": True, "data": {"_id": "t1", "parameters": [{"name": "o", "source": source}]}},
    )

    resp = api.get("/api/reports/templates/t1")

    assert resp.status_code == 200
    assert resp.get_json()["parameters"][0]["options"] == []
    assert fake.sql_log == [], "an invalid source must not reach SQL"


def test_several_pickers_are_resolved_concurrently(api, fake):
    """Sequential resolution meant one round trip per picker before the report
    could start rendering. Asserted by observing that every source is queried."""
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {
            "ok": True,
            "data": {
                "_id": "t1",
                "parameters": [
                    {"name": "o", "source": "legal.clients"},
                    {"name": "p", "source": "legal.matters"},
                    {"name": "v", "source": "legal.costs_and_disbursements"},
                    {"name": "plain"},  # no source: no query
                ],
            },
        },
    )
    fake.on_sql(rows=[{"_id": "g", "client_id": "X-1", "name": "N"}])

    body = api.get("/api/reports/templates/t1").get_json()

    assert len(fake.sql_log) == 3
    assert {p["name"] for p in body["parameters"]} == {"o", "p", "v", "plain"}
    assert body["parameters"][3]["options"] == []


def test_the_internal_source_marker_never_leaks_to_the_client(api, fake):
    fake.on(
        "GET",
        "/api/report-templates/t1",
        {"ok": True, "data": {"_id": "t1", "parameters": [{"name": "o", "source": "legal.clients"}]}},
    )

    params = api.get("/api/reports/templates/t1").get_json()["parameters"]

    assert "_source" not in params[0]


def test_a_template_with_no_parameters_resolves_to_an_empty_list(api, fake):
    fake.on("GET", "/api/report-templates/t1", {"ok": True, "data": {"_id": "t1"}})
    assert api.get("/api/reports/templates/t1").get_json()["parameters"] == []


# ===========================================================================
# Rendering
# ===========================================================================


def test_render_forwards_the_submitted_parameters(api, fake):
    fake.on(
        "POST",
        "/api/report-templates/t1/render",
        {"ok": True, "data": {"html": "<h1>Report</h1>", "meta": {"elapsed_ms": 12}}},
    )

    body = api.post("/api/reports/templates/t1/render", json={"params": {"client_id": "O-1"}}).get_json()

    assert body == {"html": "<h1>Report</h1>", "meta": {"elapsed_ms": 12}}
    assert fake.last_call("POST", "/api/report-templates/t1/render").body == {
        "params": {"client_id": "O-1"},
        "email_safe_charts": False,
    }


@pytest.mark.parametrize("body", [None, {}, {"params": None}])
def test_render_without_parameters_sends_an_empty_map(api, fake, body):
    kwargs = {} if body is None else {"json": body}
    api.post("/api/reports/templates/t1/render", **kwargs)
    assert fake.last_call("POST", "/api/report-templates/t1/render").body["params"] == {}


@pytest.mark.parametrize("params", [[], "string", 7, True])
def test_render_rejects_non_object_parameters(api, fake, params):
    resp = api.post("/api/reports/templates/t1/render", json={"params": params})
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "params must be an object"
    assert fake.calls == []


def test_render_normalises_a_missing_html_field(api, fake):
    fake.on("POST", "/api/report-templates/t1/render", {"ok": True, "data": {}})
    assert api.post("/api/reports/templates/t1/render", json={}).get_json() == {
        "html": "",
        "meta": {},
    }


def test_render_validates_the_template_id(api, fake):
    resp = api.post("/api/reports/templates/not a valid id/render", json={})
    assert resp.status_code == 400
    assert fake.calls == []


@pytest.mark.parametrize(
    "method,path",
    [
        ("GET", "/api/reports/templates"),
        ("GET", "/api/reports/templates/t1"),
        ("POST", "/api/reports/templates/t1/render"),
    ],
)
def test_report_routes_require_authentication(api, fake, method, path):
    assert api._open(method, path, token=None, json={}).status_code == 401
    assert fake.calls == []


# ===========================================================================
# SQL rollups
# ===========================================================================
# Each of these is one statement run inside InventDB. The assertions are mostly
# on the SQL rather than the JSON, because the arithmetic belongs to the engine
# and what this app decides is *which rows to add up* — billable-but-unbilled,
# operating-not-trust, open-and-overdue. Get the predicate wrong and the number
# is still a number.


def test_pnl_reports_billings_collections_costs_and_write_downs(api, fake):
    fake.on_sql("SUM(invoice_total)", rows=[{"t": 7699677.71}])
    fake.on_sql("SUM(write_downs)", rows=[{"t": 271305.62}])
    fake.on_sql("legal.payments_and_receipts", rows=[{"t": 10094497.46}])
    fake.on_sql("legal.costs_and_disbursements", rows=[{"t": 2085052.7}])

    body = api.get("/api/reports/pnl").get_json()

    assert body["billed_total"] == 7699677.71
    assert body["collected_total"] == 10094497.46
    assert body["write_downs_total"] == 271305.62
    assert body["costs_total"] == 2085052.7


def test_realization_is_collections_over_billings(api, fake):
    fake.on_sql("SUM(invoice_total)", rows=[{"t": 1000.0}])
    fake.on_sql("legal.payments_and_receipts", rows=[{"t": 850.0}])

    assert api.get("/api/reports/pnl").get_json()["realization"] == 85.0


def test_realization_on_nothing_billed_is_zero_not_a_division(api, fake):
    fake.on_sql(rows=[])
    assert api.get("/api/reports/pnl").get_json()["realization"] == 0.0


def test_pnl_counts_collections_into_operating_only(api, fake):
    """Money sitting in trust has not been earned yet."""
    api.get("/api/reports/pnl")

    payments = [s for s in fake.sql_log if "payments_and_receipts" in s]
    assert payments and all("lower(deposited_to) = 'operating'" in s for s in payments)


def test_pnl_aggregates_inside_inventdb_not_in_python(api, fake):
    api.get("/api/reports/pnl")

    assert fake.sql_log, "the rollup must actually query"
    assert any("SUM(" in s for s in fake.sql_log)
    assert not any(
        s.strip().upper().startswith("SELECT *") for s in fake.sql_log
    ), "pulling rows back to add them up would cap at the engine's page size"


def test_pnl_on_an_empty_ledger_is_all_zeroes(api, fake):
    fake.on_sql(rows=[])

    body = api.get("/api/reports/pnl").get_json()

    assert body["billed_total"] == 0.0
    assert body["collected_total"] == 0.0
    assert body["costs_total"] == 0.0
    assert body["billed_by_practice"] == []
    assert body["costs_by_category"] == []


# ---- cashflow -------------------------------------------------------------


def test_cashflow_groups_by_year_and_month_in_sql(api, fake):
    api.get("/api/reports/cashflow")

    invoices = next(s for s in fake.sql_log if "legal.invoices" in s)
    assert "YEAR(issue_date) AS y" in invoices
    assert "MONTH(issue_date) AS m" in invoices
    assert "GROUP BY y, m" in invoices


def test_cashflow_splits_the_accounts_by_grouping_not_by_filtering(api, fake):
    """The engine collapses a GROUP BY when the WHERE holds a function call.

    ``WHERE lower(deposited_to) = 'operating'`` next to ``GROUP BY y, m`` came
    back as one row carrying every month's total, so the split is done on the
    grouped column and separated here instead.
    """
    api.get("/api/reports/cashflow")

    payments = next(s for s in fake.sql_log if "payments_and_receipts" in s)
    assert "GROUP BY y, m, deposited_to" in payments
    assert "lower(" not in payments
    assert "WHERE" not in payments


def test_only_operating_deposits_are_counted_as_collected(api, fake):
    fake.on_sql("legal.invoices", rows=[])
    fake.on_sql(
        "payments_and_receipts",
        rows=[
            {"y": 2026, "m": 3, "deposited_to": "Operating", "total": 100.0},
            {"y": 2026, "m": 3, "deposited_to": "Trust", "total": 900.0},
        ],
    )

    series = api.get("/api/reports/cashflow").get_json()["cashflow"]

    assert series == [{"month": "2026-03", "billed": 0.0, "collected": 100.0, "net": 100.0}]


def test_cashflow_keeps_only_the_last_twelve_months(api, fake):
    fake.on_sql(
        "legal.invoices",
        rows=[{"y": 2025, "m": m, "total": 10.0} for m in range(1, 13)]
        + [{"y": 2026, "m": m, "total": 20.0} for m in range(1, 9)],
    )
    fake.on_sql("payments_and_receipts", rows=[])

    series = api.get("/api/reports/cashflow").get_json()["cashflow"]

    assert len(series) == 12
    assert series[0]["month"] == "2025-09"
    assert series[-1]["month"] == "2026-08"


def test_cashflow_skips_rows_with_an_unparseable_period(api, fake):
    fake.on_sql(
        "legal.invoices",
        rows=[
            {"y": None, "m": 3, "total": 5.0},
            {"y": 2026, "m": "x", "total": 5.0},
            {"y": 2026, "m": 4, "total": 7.0},
        ],
    )
    fake.on_sql("payments_and_receipts", rows=[])

    series = api.get("/api/reports/cashflow").get_json()["cashflow"]

    assert series == [{"month": "2026-04", "billed": 7.0, "collected": 0.0, "net": -7.0}]


def test_net_is_collections_less_billings(api, fake):
    fake.on_sql("legal.invoices", rows=[{"y": 2026, "m": 5, "total": 500.0}])
    fake.on_sql(
        "payments_and_receipts",
        rows=[{"y": 2026, "m": 5, "deposited_to": "Operating", "total": 200.0}],
    )

    point = api.get("/api/reports/cashflow").get_json()["cashflow"][0]

    assert point["net"] == -300.0


# ---- work in progress -----------------------------------------------------


def test_wip_selects_billable_time_that_is_not_yet_on_an_invoice(api, fake):
    api.get("/api/reports/wip")

    sql = next(s for s in fake.sql_log if "legal.time_entries" in s)
    assert "WHERE billed = false AND billable = true" in sql
    assert "GROUP BY matter_id" in sql


def test_wip_recases_the_matter_id_the_group_by_flattened(api, fake):
    """A grouped string comes back lower-cased, and "mt-2479" is not an id.

    Left alone it links to nothing — so the id is recased and the readable
    columns are read back from the matters themselves.
    """
    fake.on_sql(
        "legal.time_entries",
        rows=[{"matter_id": "mt-2479", "hours": 28.5, "value": 13356.5, "entries": 15}],
    )
    fake.on_sql(
        "legal.matters",
        rows=[
            {
                "matter_id": "MT-2479",
                "matter_caption": "Kang Brothers v. Olympic Boulevard",
                "practice_area": "Business Litigation",
                "client_name": "Kang Brothers Wholesale Produce, Inc.",
                "responsible_attorney_name": "Daniel J. Sung",
                "status": "Open",
            }
        ],
    )

    row = api.get("/api/reports/wip").get_json()["rows"][0]

    assert row["matter_id"] == "MT-2479"
    assert row["matter_caption"] == "Kang Brothers v. Olympic Boulevard"
    assert row["practice_area"] == "Business Litigation"
    assert row["responsible_attorney_name"] == "Daniel J. Sung"


def test_wip_looks_the_captions_up_by_id_rather_than_reading_every_matter(api, fake):
    fake.on_sql(
        "legal.time_entries",
        rows=[{"matter_id": "mt-1", "hours": 1, "value": 2, "entries": 1}],
    )
    api.get("/api/reports/wip")

    lookup = next(s for s in fake.sql_log if "legal.matters" in s)
    assert "WHERE matter_id IN ('MT-1')" in lookup


def test_a_matter_with_no_row_still_reports_its_time(api, fake):
    """A time entry against a deleted matter is still hours somebody worked."""
    fake.on_sql(
        "legal.time_entries",
        rows=[{"matter_id": "mt-999", "hours": 3.0, "value": 900.0, "entries": 2}],
    )
    fake.on_sql("legal.matters", rows=[])

    row = api.get("/api/reports/wip").get_json()["rows"][0]

    assert row["matter_id"] == "MT-999"
    assert row["matter_caption"] == "MT-999"  # falls back to the id, never blank
    assert row["hours"] == 3.0


def test_wip_totals_the_hours_and_the_money(api, fake):
    fake.on_sql(
        "legal.time_entries",
        rows=[
            {"matter_id": "mt-1", "hours": 2.25, "value": 100.0, "entries": 1},
            {"matter_id": "mt-2", "hours": 1.1, "value": 250.5, "entries": 3},
        ],
    )
    fake.on_sql("legal.matters", rows=[])

    body = api.get("/api/reports/wip").get_json()

    assert body["count"] == 2
    assert body["total_hours"] == 3.4
    assert body["total_value"] == 350.5


def test_wip_with_nothing_unbilled(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/reports/wip").get_json()
    assert body == {"rows": [], "count": 0, "total_hours": 0.0, "total_value": 0.0}


# ---- the docket -----------------------------------------------------------


def test_deadlines_window_on_todays_date(api, fake):
    api.get("/api/reports/deadlines")

    end = (datetime.now(timezone.utc).date() + timedelta(days=30)).isoformat()
    sql = fake.sql_log[0]
    assert f"due_date <= '{end}'" in sql
    assert "lower(status) = 'open'" in sql
    assert "ORDER BY due_date ASC" in sql


def test_the_docket_has_no_lower_bound_so_overdue_work_stays_visible(api, fake):
    """A missed limitations date does not stop mattering because it is past."""
    api.get("/api/reports/deadlines")
    assert "due_date >=" not in fake.sql_log[0]


@pytest.mark.parametrize(
    "days,expected", [(30, 30), (1, 1), (365, 365), (0, 1), (-5, 1), (9999, 365)]
)
def test_deadlines_clamps_the_window_to_one_year(api, fake, days, expected):
    api.get("/api/reports/deadlines", query_string={"days": days})
    assert api.get("/api/reports/deadlines", query_string={"days": days}).status_code == 200
    body = api.get("/api/reports/deadlines", query_string={"days": days}).get_json()
    assert body["days"] == expected


@pytest.mark.parametrize("days", ["abc", "", "1; DROP TABLE x", "3.5"])
def test_a_malformed_window_falls_back_to_thirty_days(api, fake, days):
    body = api.get("/api/reports/deadlines", query_string={"days": days}).get_json()
    assert body["days"] == 30


def test_overdue_and_critical_are_counted_out_of_the_returned_rows(api, fake):
    today = datetime.now(timezone.utc).date()
    fake.on_sql(
        "deadlines_and_sol",
        rows=[
            {"due_date": (today - timedelta(days=9)).isoformat(), "priority": "Critical"},
            {"due_date": (today - timedelta(days=1)).isoformat(), "priority": "High"},
            {"due_date": (today + timedelta(days=5)).isoformat(), "priority": "Critical"},
        ],
    )

    body = api.get("/api/reports/deadlines").get_json()

    assert body["count"] == 3
    assert body["overdue"] == 2
    assert body["critical"] == 2


def test_a_due_date_carrying_a_time_is_still_compared_by_day(api, fake):
    today = datetime.now(timezone.utc).date()
    fake.on_sql(
        "deadlines_and_sol",
        rows=[{"due_date": f"{(today - timedelta(days=2)).isoformat()}T00:00:00.000Z"}],
    )
    assert api.get("/api/reports/deadlines").get_json()["overdue"] == 1


def test_deadlines_with_nothing_open(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/reports/deadlines").get_json()
    assert body["rows"] == [] and body["count"] == 0 and body["overdue"] == 0


# ---- caseload -------------------------------------------------------------


def test_caseload_distribution_and_rate(api, fake):
    fake.on_sql(
        "legal.matters GROUP BY status",
        rows=[{"status": "open", "value": 730}, {"status": "closed", "value": 570}],
    )

    body = api.get("/api/reports/caseload").get_json()

    assert body["total"] == 1300
    assert body["open"] == 730
    assert body["open_rate"] == 56.2
    assert body["by_status"] == [
        {"name": "Open", "value": 730},
        {"name": "Closed", "value": 570},
    ]


def test_caseload_breaks_down_by_practice_area_and_attorney(api, fake):
    api.get("/api/reports/caseload")

    joined = " ".join(fake.sql_log)
    assert "GROUP BY practice_area" in joined
    assert "GROUP BY responsible_attorney_name" in joined


def test_caseload_on_an_empty_practice_does_not_divide_by_zero(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/reports/caseload").get_json()
    assert body["total"] == 0 and body["open_rate"] == 0.0


# ---- recorded time --------------------------------------------------------


def test_time_report_covers_task_activity_and_timekeeper(api, fake):
    api.get("/api/reports/time-entries")

    joined = " ".join(fake.sql_log)
    assert "GROUP BY task_description" in joined
    assert "GROUP BY activity_description" in joined
    assert "GROUP BY timekeeper" in joined


def test_the_timekeeper_series_totals_hours_rather_than_counting_entries(api, fake):
    fake.on_sql("GROUP BY timekeeper", rows=[{"timekeeper": "wei-lin chen", "value": 762.1}])

    body = api.get("/api/reports/time-entries").get_json()

    assert body["by_timekeeper"] == [{"name": "Wei-Lin Chen", "value": 762.1}]


def test_the_unbilled_value_excludes_non_billable_time(api, fake):
    api.get("/api/reports/time-entries")

    sql = next(s for s in fake.sql_log if "SUM(value_at_standard_rates)" in s)
    assert "billed = false AND billable = true" in sql


def test_time_report_with_no_rows(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/reports/time-entries").get_json()
    assert body["by_task"] == [] and body["unbilled_value"] == 0.0


# ---- receivables ----------------------------------------------------------


def test_ar_aging_reports_the_count_and_the_money_per_bucket(api, fake):
    fake.on_sql(
        "aging_bucket",
        rows=[
            {"aging_bucket": "over 120 days", "n": 184, "value": 216788.18},
            {"aging_bucket": "current (not yet due)", "n": 144, "value": 326320.66},
        ],
    )

    buckets = api.get("/api/reports/ar-aging").get_json()["buckets"]

    assert buckets[0] == {"name": "Over 120 Days", "invoices": 184, "value": 216788.18}
    assert buckets[1]["name"] == "Current (Not Yet Due)"


def test_the_outstanding_total_excludes_paid_invoices(api, fake):
    api.get("/api/reports/ar-aging")

    sql = next(s for s in fake.sql_log if "lower(status) != 'paid'" in s)
    assert "SUM(balance_due)" in sql


def test_ar_aging_with_nothing_owed(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/reports/ar-aging").get_json()
    assert body["buckets"] == [] and body["outstanding_total"] == 0.0


# ---- the trust account ----------------------------------------------------


def test_trust_balance_is_deposits_less_disbursements(api, fake):
    fake.on_sql("SUM(amount_in)", rows=[{"t": 15562000.0}])
    fake.on_sql("SUM(amount_out)", rows=[{"t": 14293098.37}])
    fake.on_sql("matter_ledger_balance < 0", rows=[])

    body = api.get("/api/reports/trust-compliance").get_json()

    assert body["amount_in"] == 15562000.0
    assert body["amount_out"] == 14293098.37
    assert body["trust_balance"] == 1268901.63


def test_a_negative_matter_ledger_is_returned_as_a_list_not_a_count(api, fake):
    """One client's money covering another's costs is the finding, and an
    auditor needs the matters — a number would only say that it happened."""
    fake.on_sql(
        "matter_ledger_balance < 0",
        rows=[
            {"matter_id": "MT-2100", "client_name": "Duvall, Gregory", "matter_ledger_balance": -250.0},
        ],
    )

    body = api.get("/api/reports/trust-compliance").get_json()

    assert body["negative_count"] == 1
    assert body["negative_ledgers"][0]["matter_id"] == "MT-2100"


def test_a_clean_trust_account_reports_no_negatives(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/reports/trust-compliance").get_json()
    assert body["negative_ledgers"] == [] and body["negative_count"] == 0


ROLLUPS = [
    "/api/reports/pnl",
    "/api/reports/cashflow",
    "/api/reports/wip",
    "/api/reports/deadlines",
    "/api/reports/caseload",
    "/api/reports/time-entries",
    "/api/reports/ar-aging",
    "/api/reports/trust-compliance",
]


@pytest.mark.parametrize("path", ROLLUPS)
def test_every_rollup_requires_authentication(api, fake, path):
    assert api.get(path, token=None).status_code == 401
    assert fake.calls == []


@pytest.mark.parametrize("path", ROLLUPS)
def test_rollups_hardcode_the_legal_namespace(api, fake, path):
    """`reports.py` uses a module-level `NS = "legal"` rather than the client's
    configured namespace, unlike every other router. Deploying against a
    differently-named namespace would leave these endpoints querying a
    namespace that does not exist while the rest of the app works.
    """
    api.get(path)
    assert all("legal." in statement for statement in fake.sql_log)
