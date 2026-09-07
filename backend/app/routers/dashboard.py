"""Dashboard aggregations (Flask blueprint).

Every figure here is computed by a ``SUM``/``COUNT``/``GROUP BY`` executed
*inside* InventDB rather than by pulling rows back and adding them up in Python.
That is not a micro-optimisation: a practice of any age has tens of thousands of
time entries, and a Python rollup over a capped ``SELECT *`` would quietly
report the total of the first page instead of the total. A wrong number that
looks right is worse than a slow one.

Missing types degrade to zero rather than erroring — on a fresh namespace no
type exists until the first write, and an empty dashboard is the correct answer
then.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from flask import Blueprint, jsonify

from .. import clock
from ..context import authed_client
from ..inventdb import InventDBClient

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

#: Values InventDB lower-cases on the way through GROUP BY, which should be
#: shouted back rather than title-cased into nonsense ("Wcab", "Sol").
_ACRONYMS = {
    "Sol": "SOL",
    "Cta": "CTA",
    "Wcab": "WCAB",
    "Adr": "ADR",
    "Ach": "ACH",
    "Nsf": "NSF",
    "Ip": "IP",
    "Eoir": "EOIR",
    "Uscis": "USCIS",
    "Lasc": "LASC",
    "Utbms": "UTBMS",
    "Mcle": "MCLE",
    "Pdf": "PDF",
    "Us": "US",
}


def _num(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace(",", "").replace("$", "").strip())
    except (TypeError, ValueError):
        return 0.0


_PUNCT = "()[]{}.,;:!?\"'"

_SMALL_WORDS = {"and", "or", "of", "the", "a", "an", "to", "for", "in", "on", "at", "by", "with", "from", "re", "v", "vs"}


def _title(value: Any) -> str:
    """Title-case a grouped value (InventDB lower-cases string GROUP BY keys).

    Acronyms are shouted and joining words stay lower unless they lead.
    """
    text = str(value).strip() if value is not None else ""
    if not text:
        return "Unknown"
    words = text.title().split(" ")
    out = []
    for i, w in enumerate(words):
        # A grouped value can arrive wrapped in punctuation — "(sol)", "cta,"
        # — so the letters are matched, and whatever surrounded them is put
        # back exactly as it was.
        core = w.strip(_PUNCT)
        lead, trail = w[: len(w) - len(w.lstrip(_PUNCT))], w[len(w.rstrip(_PUNCT)) :]
        if core in _ACRONYMS:
            out.append(lead + _ACRONYMS[core] + trail)
        elif i and core.lower() in _SMALL_WORDS:
            out.append(lead + core.lower() + trail)
        else:
            out.append(w)
    return " ".join(out)


def _rows(client: InventDBClient, sql: str) -> list[dict[str, Any]]:
    return client.query_rows(sql)


def _scalar(client: InventDBClient, sql: str, *keys: str) -> float:
    """First numeric value of a one-row aggregate, or 0.0.

    ``SUM`` over no matching rows returns null, and a type that does not exist
    yet returns no rows at all; both mean "nothing yet", which is zero.
    """
    rows = _rows(client, sql)
    if not rows:
        return 0.0
    row = rows[0]
    for key in keys:
        if key in row:
            return _num(row[key])
    for value in row.values():
        if isinstance(value, (int, float)):
            return _num(value)
    return 0.0


def _count(client: InventDBClient, table: str, where: str = "") -> int:
    clause = f" WHERE {where}" if where else ""
    return int(_scalar(client, f"SELECT COUNT(*) AS c FROM {table}{clause}", "c"))


def _dist(client: InventDBClient, table: str, column: str, limit: int = 0):
    """``[{name, value}]`` counted by one column, biggest first."""
    rows = _rows(
        client,
        f"SELECT {column}, COUNT(*) AS value FROM {table} "
        f"GROUP BY {column} ORDER BY value DESC",
    )
    out = [{"name": _title(r.get(column)), "value": int(_num(r.get("value")))} for r in rows]
    return out[:limit] if limit else out


def _sum_dist(client: InventDBClient, table: str, column: str, amount: str, limit: int = 0):
    """``[{name, value}]`` totalled by one column, biggest first."""
    rows = _rows(
        client,
        f"SELECT {column}, SUM({amount}) AS value FROM {table} "
        f"GROUP BY {column} ORDER BY value DESC",
    )
    out = [{"name": _title(r.get(column)), "value": round(_num(r.get("value")), 2)} for r in rows]
    return out[:limit] if limit else out


def _today() -> date:
    # Delegates to the shared seam so a test can pin the calendar once and have
    # every date-scoped query in the app agree with it.
    return clock.today()


def _recent_months(count: int = 6) -> list[str]:
    """The last ``count`` month keys, oldest first, ending with this month."""
    today = _today()
    year, month = today.year, today.month
    keys: list[str] = []
    for _ in range(count):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    keys.reverse()
    return keys


def _monthly(client: InventDBClient, table: str, date_col: str, amount: str) -> dict[str, float]:
    """Totals keyed ``YYYY-MM``, grouped by InventDB's own YEAR()/MONTH()."""
    rows = _rows(
        client,
        f"SELECT YEAR({date_col}) AS y, MONTH({date_col}) AS m, SUM({amount}) AS total "
        f"FROM {table} GROUP BY y, m",
    )
    out: dict[str, float] = {}
    for row in rows:
        try:
            year = int(row.get("y"))
            month = int(row.get("m"))
        except (TypeError, ValueError):
            continue
        out[f"{year:04d}-{month:02d}"] = _num(row.get("total"))
    return out


@bp.get("/summary")
def summary():
    client = authed_client()
    ns = client.namespace
    matters = f"{ns}.matters"
    clients = f"{ns}.clients"
    deadlines = f"{ns}.deadlines_and_sol"
    time_entries = f"{ns}.time_entries"
    invoices = f"{ns}.invoices"
    payments = f"{ns}.payments_and_receipts"
    trust = f"{ns}.trust_ledger_cta"
    calendar = f"{ns}.court_calendar"

    today = _today()
    horizon = today + timedelta(days=30)
    this_month = today.strftime("%Y-%m")

    # ---- caseload -------------------------------------------------------
    matters_total = _count(client, matters)
    matters_open = _count(client, matters, "lower(status) = 'open'")
    matters_closed = _count(client, matters, "lower(status) = 'closed'")

    # ---- clients --------------------------------------------------------
    clients_total = _count(client, clients)
    clients_active = _count(client, clients, "lower(status) = 'active'")

    # ---- the docket, which is the part that ends careers if it slips ----
    deadlines_total = _count(client, deadlines)
    deadlines_open = _count(client, deadlines, "lower(status) = 'open'")
    deadlines_due_30d = _count(
        client,
        deadlines,
        f"lower(status) = 'open' AND due_date >= '{today.isoformat()}' "
        f"AND due_date <= '{horizon.isoformat()}'",
    )
    deadlines_overdue = _count(
        client, deadlines, f"lower(status) = 'open' AND due_date < '{today.isoformat()}'"
    )

    # ---- work in progress: recorded, billable, not yet on an invoice ----
    unbilled_where = "billed = false AND billable = true"
    time_entries_total = _count(client, time_entries)
    unbilled_hours = _scalar(
        client, f"SELECT SUM(hours) AS h FROM {time_entries} WHERE {unbilled_where}", "h"
    )
    wip_value = _scalar(
        client,
        f"SELECT SUM(value_at_standard_rates) AS v FROM {time_entries} "
        f"WHERE {unbilled_where}",
        "v",
    )
    hours_month = _scalar(
        client,
        f"SELECT SUM(hours) AS h FROM {time_entries} "
        f"WHERE YEAR(date) = {today.year} AND MONTH(date) = {today.month}",
        "h",
    )

    # ---- money ----------------------------------------------------------
    billed_month = _scalar(
        client,
        f"SELECT SUM(invoice_total) AS t FROM {invoices} "
        f"WHERE YEAR(issue_date) = {today.year} AND MONTH(issue_date) = {today.month}",
        "t",
    )
    collected_month = _scalar(
        client,
        f"SELECT SUM(amount) AS t FROM {payments} "
        f"WHERE lower(deposited_to) = 'operating' "
        f"AND YEAR(date) = {today.year} AND MONTH(date) = {today.month}",
        "t",
    )
    ar_outstanding = _scalar(
        client,
        f"SELECT SUM(balance_due) AS t FROM {invoices} WHERE lower(status) != 'paid'",
        "t",
    )
    trust_in = _scalar(client, f"SELECT SUM(amount_in) AS t FROM {trust}", "t")
    trust_out = _scalar(client, f"SELECT SUM(amount_out) AS t FROM {trust}", "t")

    # ---- what is on the calendar next ----------------------------------
    upcoming_hearings = _count(
        client,
        calendar,
        f"date >= '{today.isoformat()}' AND date <= '{horizon.isoformat()}'",
    )

    return jsonify(
        {
            "matters": {
                "total": matters_total,
                "open": matters_open,
                "closed": matters_closed,
                "open_rate": round((matters_open / matters_total) * 100, 1)
                if matters_total
                else 0.0,
            },
            "clients": {"total": clients_total, "active": clients_active},
            "deadlines": {
                "total": deadlines_total,
                "open": deadlines_open,
                "due_30d": deadlines_due_30d,
                "overdue": deadlines_overdue,
            },
            "time": {
                "entries": time_entries_total,
                "hours_month": round(hours_month, 1),
                "unbilled_hours": round(unbilled_hours, 1),
                "wip_value": round(wip_value, 2),
            },
            "financials": {
                "billed_month": round(billed_month, 2),
                "collected_month": round(collected_month, 2),
                "ar_outstanding": round(ar_outstanding, 2),
                "trust_balance": round(trust_in - trust_out, 2),
            },
            "calendar": {"upcoming_30d": upcoming_hearings},
            "as_of": this_month,
        }
    )


@bp.get("/charts")
def charts():
    client = authed_client()
    ns = client.namespace
    matters = f"{ns}.matters"
    deadlines = f"{ns}.deadlines_and_sol"
    invoices = f"{ns}.invoices"
    payments = f"{ns}.payments_and_receipts"
    costs = f"{ns}.costs_and_disbursements"

    months = _recent_months(6)
    billed = _monthly(client, invoices, "issue_date", "invoice_total")

    # Operating deposits only. A trust-to-operating transfer is the firm taking
    # money it has now earned; a deposit *into* trust is still the client's, so
    # counting both would book the same dollar twice.
    #
    # The split is done by grouping on `deposited_to` rather than by a
    # `WHERE lower(deposited_to) = …`: an aggregate does not group reliably
    # when the WHERE contains a function call, which silently turned
    # twelve months of collections into one bar holding the lot. Grouping on the
    # column keeps the months and costs nothing — there are only two values.
    collected_rows = _rows(
        client,
        f"SELECT YEAR(date) AS y, MONTH(date) AS m, deposited_to, SUM(amount) AS total "
        f"FROM {payments} GROUP BY y, m, deposited_to",
    )
    collected: dict[str, float] = {}
    for row in collected_rows:
        if str(row.get("deposited_to", "")).strip().lower() != "operating":
            continue
        try:
            key = f"{int(row.get('y')):04d}-{int(row.get('m')):02d}"
        except (TypeError, ValueError):
            continue
        collected[key] = collected.get(key, 0.0) + _num(row.get("total"))

    cashflow = [
        {
            "month": key,
            "billed": round(billed.get(key, 0.0), 2),
            "collected": round(collected.get(key, 0.0), 2),
            "net": round(collected.get(key, 0.0) - billed.get(key, 0.0), 2),
        }
        for key in months
    ]

    return jsonify(
        {
            "cashflow": cashflow,
            "matter_status": _dist(client, matters, "status"),
            "practice_area": _dist(client, matters, "practice_area", limit=10),
            "deadline_status": _dist(client, deadlines, "status"),
            "deadline_priority": _dist(client, deadlines, "priority"),
            "cost_breakdown": _sum_dist(client, costs, "expense_category", "amount", limit=10),
            "ar_aging": _sum_dist(client, invoices, "aging_bucket", "balance_due"),
        }
    )
