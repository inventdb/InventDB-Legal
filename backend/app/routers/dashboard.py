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

from flask import Blueprint, jsonify, request

from .. import clock
from ..access import current_tier
from ..context import authed_client
from ..errors import ApiError
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
    """The headline figures, limited to what the caller's tier may read.

    A block the tier cannot read is left out entirely rather than zeroed, so a
    dashboard never shows a figure its reader has no business seeing, not even
    as a "0". Figures are firm-wide within what InventDB's row rules return.
    """
    client = authed_client()
    tier = current_tier()
    ns = client.namespace
    matters = f"{ns}.matters"
    clients = f"{ns}.clients"
    deadlines = f"{ns}.deadlines_and_sol"
    time_entries = f"{ns}.time_entries"
    invoices = f"{ns}.invoices"
    payments = f"{ns}.payments_and_receipts"
    trust = f"{ns}.trust_ledger_cta"
    calendar = f"{ns}.court_calendar"
    intake = f"{ns}.intake_and_leads"

    today = _today()
    horizon = today + timedelta(days=30)
    this_month = today.strftime("%Y-%m")

    def month_where(col: str) -> str:
        return f"YEAR({col}) = {today.year} AND MONTH({col}) = {today.month}"

    out: dict[str, Any] = {"as_of": this_month}

    # ---- caseload -------------------------------------------------------
    if tier.can_read("matters"):
        matters_total = _count(client, matters)
        matters_open = _count(client, matters, "lower(status) = 'open'")
        out["matters"] = {
            "total": matters_total,
            "open": matters_open,
            "closed": _count(client, matters, "lower(status) = 'closed'"),
            "open_rate": round((matters_open / matters_total) * 100, 1) if matters_total else 0.0,
        }

    # ---- clients --------------------------------------------------------
    if tier.can_read("clients"):
        out["clients"] = {
            "total": _count(client, clients),
            "active": _count(client, clients, "lower(status) = 'active'"),
        }

    # ---- the docket, which is the part that ends careers if it slips ----
    if tier.can_read("deadlines_and_sol"):
        out["deadlines"] = {
            "total": _count(client, deadlines),
            "open": _count(client, deadlines, "lower(status) = 'open'"),
            "due_30d": _count(
                client,
                deadlines,
                f"lower(status) = 'open' AND due_date >= '{today.isoformat()}' "
                f"AND due_date <= '{horizon.isoformat()}'",
            ),
            "overdue": _count(
                client, deadlines, f"lower(status) = 'open' AND due_date < '{today.isoformat()}'"
            ),
        }

    # ---- time: hours for everyone who records them, value for money tiers --
    if tier.can_read("time_entries"):
        unbilled_where = "billed = false AND billable = true"
        time_block: dict[str, Any] = {
            "entries": _count(client, time_entries),
            "hours_month": round(
                _scalar(
                    client,
                    f"SELECT SUM(hours) AS h FROM {time_entries} WHERE {month_where('date')}",
                    "h",
                ),
                1,
            ),
            "unbilled_hours": round(
                _scalar(
                    client, f"SELECT SUM(hours) AS h FROM {time_entries} WHERE {unbilled_where}", "h"
                ),
                1,
            ),
        }
        if tier.can_read("invoices"):
            time_block["wip_value"] = round(
                _scalar(
                    client,
                    f"SELECT SUM(value_at_standard_rates) AS v FROM {time_entries} "
                    f"WHERE {unbilled_where}",
                    "v",
                ),
                2,
            )
        out["time"] = time_block

    # ---- money ----------------------------------------------------------
    financials: dict[str, Any] = {}
    if tier.can_read("invoices"):
        financials["billed_month"] = round(
            _scalar(
                client,
                f"SELECT SUM(invoice_total) AS t FROM {invoices} WHERE {month_where('issue_date')}",
                "t",
            ),
            2,
        )
        financials["ar_outstanding"] = round(
            _scalar(
                client,
                f"SELECT SUM(balance_due) AS t FROM {invoices} WHERE lower(status) != 'paid'",
                "t",
            ),
            2,
        )
    if tier.can_read("payments_and_receipts"):
        financials["collected_month"] = round(
            _scalar(
                client,
                f"SELECT SUM(amount) AS t FROM {payments} "
                f"WHERE lower(deposited_to) = 'operating' AND {month_where('date')}",
                "t",
            ),
            2,
        )
    if tier.can_read("trust_ledger_cta"):
        trust_in = _scalar(client, f"SELECT SUM(amount_in) AS t FROM {trust}", "t")
        trust_out = _scalar(client, f"SELECT SUM(amount_out) AS t FROM {trust}", "t")
        financials["trust_balance"] = round(trust_in - trust_out, 2)
    if financials:
        out["financials"] = financials

    # ---- what is on the calendar next ----------------------------------
    if tier.can_read("court_calendar"):
        out["calendar"] = {
            "upcoming_30d": _count(
                client,
                calendar,
                f"date >= '{today.isoformat()}' AND date <= '{horizon.isoformat()}'",
            )
        }

    # ---- new business ---------------------------------------------------
    if tier.can_read("intake_and_leads"):
        out["intake"] = {
            "total": _count(client, intake),
            "month": _count(client, intake, month_where("date_received")),
        }

    return jsonify(out)


# Short lists for the dashboard, one per panel. Each names the module it reads,
# so a panel gets the same tier check the module itself does.
_PANELS: dict[str, tuple[str, str]] = {
    "deadlines": (
        "deadlines_and_sol",
        "SELECT _id, matter_id, matter_caption, description, due_date, priority, owner_name "
        "FROM {t} WHERE lower(status) = 'open' AND due_date >= '{today}' "
        "ORDER BY due_date ASC LIMIT 8",
    ),
    "overdue": (
        "deadlines_and_sol",
        "SELECT _id, matter_id, matter_caption, description, due_date, priority, owner_name "
        "FROM {t} WHERE lower(status) = 'open' AND due_date < '{today}' "
        "ORDER BY due_date ASC LIMIT 8",
    ),
    "hearings": (
        "court_calendar",
        "SELECT _id, date, time, matter_id, matter_caption, court_location, appearing_name "
        "FROM {t} WHERE date >= '{today}' ORDER BY date ASC LIMIT 8",
    ),
    "matters": (
        "matters",
        "SELECT _id, matter_id, matter_caption, client_name, stage, next_court_date "
        "FROM {t} WHERE lower(status) = 'open' ORDER BY date_opened DESC LIMIT 8",
    ),
    "leads": (
        "intake_and_leads",
        "SELECT _id, date_received, prospect_name, potential_claim_type, phone "
        "FROM {t} ORDER BY date_received DESC LIMIT 8",
    ),
    "clients": (
        "clients",
        "SELECT _id, client_id, client_name, city, conflict_check_result, intake_date "
        "FROM {t} ORDER BY intake_date DESC LIMIT 8",
    ),
    "time": (
        "time_entries",
        "SELECT _id, date, matter_id, matter_caption, timekeeper, hours "
        "FROM {t} ORDER BY date DESC LIMIT 8",
    ),
    "invoices": (
        "invoices",
        "SELECT _id, matter_id, client_name, due_date, balance_due "
        "FROM {t} WHERE lower(status) != 'paid' ORDER BY due_date ASC LIMIT 8",
    ),
    "trust": (
        "trust_ledger_cta",
        "SELECT _id, date, matter_id, client_name, amount_in, amount_out "
        "FROM {t} ORDER BY date DESC LIMIT 8",
    ),
}


@bp.get("/panels")
def panels():
    """``?names=deadlines,hearings`` -> ``{name: {entity, rows}}``.

    A panel the caller's tier cannot read is left out. One whose query fails
    (a type not created yet, a row rule) comes back with no rows rather than
    failing the whole dashboard.
    """
    client = authed_client()
    tier = current_tier()
    today = _today().isoformat()
    wanted = [n.strip() for n in (request.args.get("names") or "").split(",") if n.strip()]
    out: dict[str, Any] = {}
    for name in wanted:
        spec = _PANELS.get(name)
        if not spec or not tier.can_read(spec[0]):
            continue
        entity, sql = spec
        try:
            rows = _rows(client, sql.format(t=f"{client.namespace}.{entity}", today=today))
        except ApiError:
            rows = []
        out[name] = {"entity": entity, "rows": rows}
    return jsonify(out)


@bp.get("/charts")
def charts():
    client = authed_client()
    ns = client.namespace
    matters = f"{ns}.matters"
    deadlines = f"{ns}.deadlines_and_sol"
    invoices = f"{ns}.invoices"
    payments = f"{ns}.payments_and_receipts"
    costs = f"{ns}.costs_and_disbursements"

    tier = current_tier()
    out: dict[str, Any] = {}
    if tier.can_read("matters"):
        out["matter_status"] = _dist(client, matters, "status")
        out["practice_area"] = _dist(client, matters, "practice_area", limit=10)
    if tier.can_read("deadlines_and_sol"):
        out["deadline_status"] = _dist(client, deadlines, "status")
        out["deadline_priority"] = _dist(client, deadlines, "priority")
    if tier.can_read("costs_and_disbursements"):
        out["cost_breakdown"] = _sum_dist(client, costs, "expense_category", "amount", limit=10)
    if not (tier.can_read("invoices") and tier.can_read("payments_and_receipts")):
        return jsonify(out)
    out["ar_aging"] = _sum_dist(client, invoices, "aging_bucket", "balance_due")

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

    out["cashflow"] = cashflow
    return jsonify(out)
