"""``app.routers.dashboard`` — the aggregates behind the landing page.

Every figure is a ``SUM``/``COUNT``/``GROUP BY`` run inside InventDB, so what is
worth pinning is the *statement*: which predicate selects "open", how the month
window is composed, and — the one that bit — that no aggregate is grouped by an
alias while its WHERE holds a function call.

That last one is not a style rule. A ``GROUP BY y, m`` does not survive a WHERE
that contains something like ``lower(col) = 'x'``, so twelve months of
collections came back as one bucket holding the lot. The chart
still drew, which is what made it worth a test rather than a comment.

Dates are expressed relative to "now" rather than frozen, because the handlers
call ``datetime.now`` directly. Cases sit well clear of the boundaries so the
suite does not depend on the wall clock.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import pytest

from app.routers.dashboard import _num, _recent_months, _title

NOW = datetime.now(timezone.utc)
TODAY = NOW.date()
THIS_MONTH = TODAY.strftime("%Y-%m")


def day(offset: int) -> str:
    return (TODAY + timedelta(days=offset)).isoformat()


def statements(fake) -> list[str]:
    return fake.sql_log


def find(fake, *needles: str) -> str:
    """The one statement containing every needle. Fails loudly if not unique."""
    hits = [s for s in fake.sql_log if all(n in s for n in needles)]
    assert hits, f"no statement matched {needles}\n" + "\n".join(fake.sql_log)
    assert len(hits) == 1, f"{len(hits)} statements matched {needles}: {hits}"
    return hits[0]


# ===========================================================================
# Coercion helpers
# ===========================================================================


@pytest.mark.parametrize(
    "value,expected",
    [
        (None, 0.0),
        (0, 0.0),
        (12, 12.0),
        (12.5, 12.5),
        ("12.5", 12.5),
        ("$1,200.50", 1200.5),  # currency strings from a schemaless column
        ("  42  ", 42.0),
        ("1,000", 1000.0),
        ("", 0.0),
        ("abc", 0.0),
        ("$", 0.0),
        ([], 0.0),
        ({}, 0.0),
        (True, 1.0),  # bool is a number to isinstance
        ("-500", -500.0),
    ],
)
def test_num_never_raises_on_a_schemaless_column(value, expected):
    assert _num(value) == expected


@pytest.mark.parametrize(
    "value,expected",
    [
        ("personal injury", "Personal Injury"),
        ("probate and trust administration", "Probate and Trust Administration"),
        ("statute of limitations", "Statute of Limitations"),
        ("open", "Open"),
        ("", "Unknown"),
        (None, "Unknown"),
    ],
)
def test_title_restores_values_the_engine_lower_cased(value, expected):
    """InventDB lower-cases the string values it groups by.

    Shouting them back verbatim would put "And" mid-phrase and "Sol" where the
    limitations period belongs, so joining words stay down and acronyms go up.
    """
    assert _title(value) == expected


@pytest.mark.parametrize(
    "value,expected",
    [
        ("wcab los angeles", "WCAB Los Angeles"),
        ("statute of limitations (sol)", "Statute of Limitations (SOL)"),
        ("trust ledger cta", "Trust Ledger CTA"),
    ],
)
def test_title_shouts_the_acronyms_the_practice_uses(value, expected):
    assert _title(value) == expected


def test_recent_months_ends_with_the_current_month_and_runs_backwards():
    months = _recent_months(6)

    assert len(months) == 6
    assert months[-1] == THIS_MONTH
    assert months == sorted(months), "oldest first, so a chart reads left to right"


def test_recent_months_crosses_a_year_boundary_without_a_month_zero():
    months = _recent_months(18)
    assert all(re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", m) for m in months), months
    assert len(set(months)) == 18


# ===========================================================================
# Summary — the statements it composes
# ===========================================================================


def test_summary_counts_open_and_closed_matters_separately(api, fake):
    api.get("/api/dashboard/summary")

    assert find(fake, "COUNT(*)", "legal.matters", "lower(status) = 'open'")
    assert find(fake, "COUNT(*)", "legal.matters", "lower(status) = 'closed'")
    # …and an unfiltered total, so a status nobody thought of still counts.
    assert "SELECT COUNT(*) AS c FROM legal.matters" in fake.sql_log


def test_open_rate_is_a_percentage_of_the_whole_caseload(api, fake):
    fake.on_sql("FROM legal.matters", rows=[{"c": 200}])
    fake.on_sql("lower(status) = 'open'", rows=[{"c": 50}])

    matters = api.get("/api/dashboard/summary").get_json()["matters"]

    assert matters["total"] == 200
    assert matters["open"] == 50
    assert matters["open_rate"] == 25.0


def test_open_rate_on_an_empty_practice_is_zero_not_a_crash(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/dashboard/summary").get_json()
    assert body["matters"] == {"total": 0, "open": 0, "closed": 0, "open_rate": 0.0}


def test_open_rate_is_rounded_to_one_decimal(api, fake):
    fake.on_sql("FROM legal.matters", rows=[{"c": 3}])
    fake.on_sql("lower(status) = 'open'", rows=[{"c": 1}])
    assert api.get("/api/dashboard/summary").get_json()["matters"]["open_rate"] == 33.3


# ---- the docket -----------------------------------------------------------


def test_the_deadline_window_runs_from_today_to_thirty_days_out(api, fake):
    api.get("/api/dashboard/summary")

    sql = find(fake, "legal.deadlines_and_sol", "due_date >=")
    assert f"due_date >= '{day(0)}'" in sql
    assert f"due_date <= '{day(30)}'" in sql
    assert "lower(status) = 'open'" in sql


def test_overdue_counts_open_deadlines_left_behind_today(api, fake):
    api.get("/api/dashboard/summary")

    sql = find(fake, "legal.deadlines_and_sol", "due_date < '")
    assert f"due_date < '{day(0)}'" in sql
    # An open deadline only. A completed one that ran late is history, not a
    # thing anybody still has to do.
    assert "lower(status) = 'open'" in sql


def test_deadline_counts_are_reported_separately(api, fake):
    # The fake matches the most recently registered rule first, so these run
    # from broadest to narrowest — every window query also says `status = open`.
    fake.on_sql("FROM legal.deadlines_and_sol", rows=[{"c": 3750}])
    fake.on_sql("lower(status) = 'open'", rows=[{"c": 804}])
    fake.on_sql("due_date >=", rows=[{"c": 163}])
    fake.on_sql("due_date < '", rows=[{"c": 39}])

    deadlines = api.get("/api/dashboard/summary").get_json()["deadlines"]

    assert deadlines == {"total": 3750, "open": 804, "due_30d": 163, "overdue": 39}


# ---- work in progress -----------------------------------------------------


def test_wip_counts_only_billable_time_that_is_not_yet_invoiced(api, fake):
    api.get("/api/dashboard/summary")

    sql = find(fake, "SUM(value_at_standard_rates)", "legal.time_entries")
    assert "billed = false AND billable = true" in sql


def test_hours_this_month_are_selected_by_year_and_month(api, fake):
    api.get("/api/dashboard/summary")

    sql = find(fake, "SUM(hours)", f"MONTH(date) = {TODAY.month}")
    assert f"YEAR(date) = {TODAY.year}" in sql


def test_wip_is_reported_in_hours_and_in_money(api, fake):
    fake.on_sql("SUM(hours)", rows=[{"h": 773.34}])
    fake.on_sql("SUM(value_at_standard_rates)", rows=[{"v": 300639.5}])

    time = api.get("/api/dashboard/summary").get_json()["time"]

    assert time["unbilled_hours"] == 773.3  # hours to one decimal
    assert time["wip_value"] == 300639.5  # money to cents


# ---- money ----------------------------------------------------------------


def test_collections_count_operating_deposits_only(api, fake):
    """A deposit into trust is still the client's money, not the firm's."""
    api.get("/api/dashboard/summary")

    sql = find(fake, "legal.payments_and_receipts", "SUM(amount)")
    assert "lower(deposited_to) = 'operating'" in sql


def test_receivables_exclude_paid_invoices(api, fake):
    api.get("/api/dashboard/summary")

    sql = find(fake, "SUM(balance_due)")
    assert "lower(status) != 'paid'" in sql


def test_the_trust_balance_is_deposits_less_everything_paid_out(api, fake):
    fake.on_sql("SUM(amount_in)", rows=[{"t": 15562000.0}])
    fake.on_sql("SUM(amount_out)", rows=[{"t": 14293098.37}])

    financials = api.get("/api/dashboard/summary").get_json()["financials"]

    assert financials["trust_balance"] == 1268901.63


def test_money_is_rounded_to_cents(api, fake):
    fake.on_sql("SUM(invoice_total)", rows=[{"t": 528362.005}])
    billed = api.get("/api/dashboard/summary").get_json()["financials"]["billed_month"]
    assert billed == round(528362.005, 2)


# ---- shape ----------------------------------------------------------------


def test_summary_on_a_completely_empty_instance_returns_zeroes(api, fake):
    """A namespace with no types yet is a new practice, not an error."""
    fake.on_sql(rows=[])

    body = api.get("/api/dashboard/summary").get_json()

    assert body["matters"]["total"] == 0
    assert body["clients"]["total"] == 0
    assert body["deadlines"]["open"] == 0
    assert body["time"]["wip_value"] == 0
    assert body["financials"]["trust_balance"] == 0
    assert body["as_of"] == THIS_MONTH


def test_summary_exposes_every_group_the_frontend_reads(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/dashboard/summary").get_json()

    assert set(body) == {
        "matters",
        "clients",
        "deadlines",
        "time",
        "financials",
        "calendar",
        "as_of",
    }
    assert set(body["financials"]) == {
        "billed_month",
        "collected_month",
        "ar_outstanding",
        "trust_balance",
    }


def test_summary_requires_authentication(api, fake):
    assert api.get("/api/dashboard/summary", token=None).status_code == 401
    assert fake.calls == []


# ===========================================================================
# Charts
# ===========================================================================


def test_cashflow_covers_six_months_ending_with_the_current_one(api, fake):
    fake.on_sql(rows=[])
    series = api.get("/api/dashboard/charts").get_json()["cashflow"]

    assert len(series) == 6
    assert series[-1]["month"] == THIS_MONTH
    assert [p["month"] for p in series] == sorted(p["month"] for p in series)


def test_months_with_no_activity_are_present_as_zeroes(api, fake):
    """A gap in the data is a flat month, not a missing bar."""
    fake.on_sql(rows=[])
    series = api.get("/api/dashboard/charts").get_json()["cashflow"]

    assert all(p["billed"] == 0 and p["collected"] == 0 and p["net"] == 0 for p in series)


def test_collections_are_grouped_by_account_not_filtered_by_one(api, fake):
    """The regression this file exists for.

    ``WHERE lower(deposited_to) = 'operating'`` alongside ``GROUP BY y, m``
    does not group reliably — every month's collections landing in
    a single bucket. Grouping on the column instead keeps the months, and the
    two possible values are separated here rather than upstream.
    """
    api.get("/api/dashboard/charts")

    sql = find(fake, "legal.payments_and_receipts", "SUM(amount)")
    assert "GROUP BY y, m, deposited_to" in sql
    assert "lower(" not in sql
    assert "WHERE" not in sql


def test_only_operating_deposits_reach_the_collected_series(api, fake):
    month = f"{TODAY.year:04d}-{TODAY.month:02d}"
    fake.on_sql(
        "legal.payments_and_receipts",
        rows=[
            {"y": TODAY.year, "m": TODAY.month, "deposited_to": "Operating", "total": 100.0},
            {"y": TODAY.year, "m": TODAY.month, "deposited_to": "Trust", "total": 900.0},
        ],
    )

    series = api.get("/api/dashboard/charts").get_json()["cashflow"]
    current = next(p for p in series if p["month"] == month)

    assert current["collected"] == 100.0


def test_the_account_split_is_matched_case_insensitively(api, fake):
    """GROUP BY may hand the value back lower-cased, or may not."""
    month = f"{TODAY.year:04d}-{TODAY.month:02d}"
    fake.on_sql(
        "legal.payments_and_receipts",
        rows=[
            {"y": TODAY.year, "m": TODAY.month, "deposited_to": "operating", "total": 40.0},
            {"y": TODAY.year, "m": TODAY.month, "deposited_to": " Operating ", "total": 60.0},
        ],
    )

    series = api.get("/api/dashboard/charts").get_json()["cashflow"]
    assert next(p for p in series if p["month"] == month)["collected"] == 100.0


def test_net_is_collections_less_billings_and_may_be_negative(api, fake):
    month = f"{TODAY.year:04d}-{TODAY.month:02d}"
    fake.on_sql("legal.invoices", rows=[{"y": TODAY.year, "m": TODAY.month, "total": 500.0}])
    fake.on_sql(
        "legal.payments_and_receipts",
        rows=[{"y": TODAY.year, "m": TODAY.month, "deposited_to": "Operating", "total": 200.0}],
    )

    series = api.get("/api/dashboard/charts").get_json()["cashflow"]
    current = next(p for p in series if p["month"] == month)

    assert current["billed"] == 500.0
    assert current["collected"] == 200.0
    assert current["net"] == -300.0


def test_activity_outside_the_window_is_dropped(api, fake):
    fake.on_sql("legal.invoices", rows=[{"y": TODAY.year - 3, "m": 1, "total": 9999.0}])
    series = api.get("/api/dashboard/charts").get_json()["cashflow"]
    assert all(p["billed"] == 0 for p in series)


def test_a_row_with_an_unreadable_month_is_skipped_not_fatal(api, fake):
    fake.on_sql("legal.invoices", rows=[{"y": None, "m": "x", "total": 10.0}])
    assert api.get("/api/dashboard/charts").status_code == 200


def test_distributions_carry_the_name_and_value_the_charts_read(api, fake):
    fake.on_sql(
        "legal.matters GROUP BY status",
        rows=[{"status": "open", "value": 730}, {"status": "closed", "value": 570}],
    )

    dist = api.get("/api/dashboard/charts").get_json()["matter_status"]

    assert dist == [{"name": "Open", "value": 730}, {"name": "Closed", "value": 570}]


def test_the_practice_area_mix_is_capped_to_what_a_chart_can_show(api, fake):
    fake.on_sql(
        "practice_area",
        rows=[{"practice_area": f"area {i}", "value": 100 - i} for i in range(19)],
    )

    dist = api.get("/api/dashboard/charts").get_json()["practice_area"]

    assert len(dist) == 10, "19 practice areas would be unreadable as slices"
    assert dist[0]["value"] >= dist[-1]["value"]


def test_a_blank_group_key_is_labelled_unknown(api, fake):
    fake.on_sql("legal.matters GROUP BY status", rows=[{"status": "", "value": 4}])
    dist = api.get("/api/dashboard/charts").get_json()["matter_status"]
    assert dist == [{"name": "Unknown", "value": 4}]


def test_cost_breakdown_totals_money_rather_than_counting_rows(api, fake):
    fake.on_sql(
        "expense_category",
        rows=[{"expense_category": "experts", "value": 417021.8649}],
    )

    dist = api.get("/api/dashboard/charts").get_json()["cost_breakdown"]

    assert dist == [{"name": "Experts", "value": 417021.86}]


def test_charts_expose_every_series_the_frontend_renders(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/dashboard/charts").get_json()

    assert set(body) == {
        "cashflow",
        "matter_status",
        "practice_area",
        "deadline_status",
        "deadline_priority",
        "cost_breakdown",
        "ar_aging",
    }


def test_charts_on_an_empty_instance_still_return_every_series(api, fake):
    fake.on_sql(rows=[])
    body = api.get("/api/dashboard/charts").get_json()

    assert len(body["cashflow"]) == 6
    for key in ("matter_status", "practice_area", "deadline_status", "ar_aging"):
        assert body[key] == []


def test_charts_require_authentication(api, fake):
    assert api.get("/api/dashboard/charts", token=None).status_code == 401
    assert fake.calls == []
