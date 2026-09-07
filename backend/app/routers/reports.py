"""Reporting endpoints.

Two families live here.

``/templates/*`` is the real thing: a thin proxy onto **InventDB's saved report
templates** — the same reports the SOAR app's Report room lists, stored in
``_System.ReportTemplates`` and rendered by InventDB's own report engine. The
app neither defines nor computes these; it lists them, collects their
parameters, and asks InventDB to render. Authoring happens in SOAR.

The remaining endpoints are practice-specific SQL rollups (fees & costs, work
in progress, the deadline docket, AR aging, trust compliance …), each computed
by a query executed *inside* InventDB rather than aggregated in Python. They are
no longer surfaced by the Reports page — which now shows the SOAR reports — but
are left in place as a working API.
"""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import Blueprint, Response, jsonify, request, stream_with_context

from .. import clock
from ..context import authed_client
from ..errors import ApiError
from ..inventdb import InventDBClient, _safe_ident
from ..sqlutil import sql_literal

bp = Blueprint("reports", __name__, url_prefix="/api/reports")

NS = "legal"


def _rows(client: InventDBClient, sql: str) -> list[dict[str, Any]]:
    return client.query_rows(sql)


def _num(v: Any) -> float:
    try:
        return round(float(v or 0), 2)
    except (TypeError, ValueError):
        return 0.0


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


_PUNCT = "()[]{}.,;:!?\"'"

_SMALL_WORDS = {"and", "or", "of", "the", "a", "an", "to", "for", "in", "on", "at", "by", "with", "from", "re", "v", "vs"}


def _title(v: Any) -> str:
    """Title-case a value (InventDB lowercases GROUP BY string values).

    Acronyms are shouted and joining words stay lower unless they lead, so
    "probate and trust administration" reads back as "Probate and Trust
    Administration" rather than the "And" a naive ``.title()`` produces.
    """
    s = str(v).strip() if v is not None else ""
    if not s:
        return "Other"
    words = s.title().split(" ")
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


def _distribution(rows: list[dict[str, Any]], dim: str, num: bool = False):
    """Map grouped rows -> [{name, value}], reading the dimension by its real
    column name (InventDB ignores AS aliases on grouped columns)."""
    out = []
    for r in rows:
        name = _title(r.get(dim))
        value = _num(r.get("value")) if num else int(r.get("value") or 0)
        out.append({"name": name, "value": value})
    return out


# ===========================================================================
# InventDB SOAR saved reports
# ===========================================================================

_LABEL_FIELDS = ("name", "title", "first_name", "label", "description")


def _pick_bind_field(sample: dict[str, Any] | None) -> str | None:
    """Choose the column a source-backed parameter should bind to.

    Mirrors the SOAR Report room. A template's SQL filters on a *business* key
    (``WHERE owner_id = :owner_id``), so binding InventDB's internal ``_id``
    GUID matches nothing and the report renders empty. Prefer the first
    non-internal ``*_id`` column that actually carries a value; only fall back
    to ``_id`` when the type has no business key at all.
    """
    if not sample:
        return None
    for key, value in sample.items():
        if key in ("_id", "id") or key.startswith("_"):
            continue
        if not key.lower().endswith("_id"):
            continue
        if isinstance(value, (int, float)) or (isinstance(value, str) and value):
            return key
    return None


def _param_options(client: InventDBClient, param: dict[str, Any]) -> list[dict[str, str]]:
    """Resolve the dropdown choices for a parameter that declares a `source`.

    The source names an InventDB type (``legal.clients``). It comes from a stored
    template rather than the request, but it is still interpolated into SQL, so
    each half is validated as an identifier before use.
    """
    source = str(param.get("source") or "").strip()
    if not source:
        return []
    parts = source.split(".")
    if len(parts) != 2:
        return []
    ns, type_name = (_safe_ident(parts[0], "namespace"), _safe_ident(parts[1], "type"))

    rows = client.query_rows(f"SELECT * FROM {ns}.{type_name} LIMIT 200")
    if not rows:
        return []

    bind = str(param.get("bindField") or "") or _pick_bind_field(rows[0]) or "_id"
    options: list[dict[str, str]] = []
    for row in rows:
        value = row.get(bind) if bind in row else row.get("_id")
        if value in (None, ""):
            continue
        label = next(
            (str(row[f]) for f in _LABEL_FIELDS if row.get(f) not in (None, "")),
            str(value),
        )
        options.append({"value": str(value), "label": label})
    return options


@bp.get("/templates")
def list_report_templates():
    """The saved reports defined in InventDB SOAR."""
    client = authed_client()
    data = client.list_report_templates() or {}
    templates = data.get("templates") or []
    out = [
        {
            "id": t.get("_id"),
            "name": t.get("name") or "(untitled report)",
            "description": t.get("description") or "",
            "category": t.get("category") or "",
            "mode": t.get("mode") or "",
            "version": t.get("version"),
            "created_by": t.get("createdBy") or "",
        }
        for t in templates
        if t.get("_id")
    ]
    out.sort(key=lambda t: (t["category"].lower(), t["name"].lower()))
    return jsonify({"templates": out, "count": len(out)})


@bp.get("/templates/<template_id>")
def get_report_template(template_id: str):
    """A single report's definition, with its parameter pickers pre-resolved.

    The `html` body is deliberately dropped — it is the template source, can
    run to tens of kilobytes, and the client only ever displays the *rendered*
    output.
    """
    client = authed_client()
    doc = client.get_report_template(template_id) or {}
    params = doc.get("parameters") or []

    resolved = []
    for p in params:
        if not isinstance(p, dict):
            continue
        resolved.append(
            {
                "name": p.get("name"),
                "label": p.get("label") or p.get("name"),
                "type": p.get("type") or "text",
                "required": bool(p.get("required", True)),
                "default": p.get("default"),
                "options": [],
                "_source": p,
            }
        )

    # Each source-backed picker costs its own SQL round trip, and the report
    # cannot start rendering until they all land — so resolve them
    # concurrently rather than one after another. A report with four pickers
    # went from four sequential round trips to one wall-clock round trip.
    sourced = [e for e in resolved if e["_source"].get("source")]
    if sourced:
        with ThreadPoolExecutor(max_workers=min(8, len(sourced))) as pool:
            futures = {
                pool.submit(_param_options, client, e["_source"]): e for e in sourced
            }
            for future in as_completed(futures):
                entry = futures[future]
                try:
                    entry["options"] = future.result()
                except ApiError:
                    # A bad `source` on one parameter must not take down the
                    # whole report — the field degrades to a free-text input.
                    entry["options"] = []

    for entry in resolved:
        entry.pop("_source", None)

    return jsonify(
        {
            "id": doc.get("_id") or template_id,
            "name": doc.get("name") or "(untitled report)",
            "description": doc.get("description") or "",
            "category": doc.get("category") or "",
            "mode": doc.get("mode") or "",
            "version": doc.get("version"),
            "parameters": resolved,
        }
    )


@bp.post("/templates/<template_id>/render")
def render_report_template(template_id: str):
    """Render a saved report against live data. Returns InventDB's HTML."""
    body = request.get_json(silent=True)
    params = body.get("params") if isinstance(body, dict) else None
    if params is not None and not isinstance(params, dict):
        raise ApiError(400, "params must be an object")

    client = authed_client()
    result = client.render_report_template(template_id, params or {}) or {}
    return jsonify({"html": result.get("html") or "", "meta": result.get("meta") or {}})


# ===========================================================================
# Authoring — the Report Studio surface, as SOAR has it
# ===========================================================================
# A saved report is not read-only here. It can be renamed, described, edited by
# instruction, deleted; and a frozen AI snapshot can be promoted into a live
# template. InventDB owns all of it — the report agent writes the layout, the
# engine versions it — so these routes are the same allow-listed seam the
# Analyze room uses, not a second implementation of report authoring.

# Fields the studio is allowed to change directly. The `html` body is
# deliberately not among them: layout changes go through the report agent
# (`/edit/stream`), which validates the markup and versions the result. Letting
# a client PUT arbitrary HTML would bypass both.
_EDITABLE_TEMPLATE_FIELDS = ("name", "description", "category")


@bp.put("/templates/<template_id>")
def update_report_template(template_id: str):
    """Rename a report, or change its description/category."""
    client = authed_client()
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(400, "Expected a JSON object body")

    patch = {k: body[k] for k in _EDITABLE_TEMPLATE_FIELDS if k in body}
    if not patch:
        raise ApiError(
            400, f"Nothing to update — expected one of: {', '.join(_EDITABLE_TEMPLATE_FIELDS)}"
        )
    if "name" in patch:
        name = str(patch["name"] or "").strip()
        if not name:
            raise ApiError(400, "A report needs a name")
        patch["name"] = name[:200]

    client.update_report_template(template_id, patch)
    return jsonify({"ok": True, "id": template_id, **patch})


@bp.delete("/templates/<template_id>")
def delete_report_template(template_id: str):
    authed_client().delete_report_template(template_id)
    return jsonify({"ok": True, "id": template_id})


@bp.post("/templates/<template_id>/edit/stream")
def edit_report_template(template_id: str):
    """Edit a report by describing the change, streamed as it happens.

    Relayed rather than awaited: the report agent emits `reasoning` while it
    thinks, then `html`, then `saved` with the new version number. Buffering
    would turn a visible edit into a blank wait, and the events are what tell
    the studio when to re-render.

    The endpoint saves the new version itself, which is why nothing here writes
    back — a `saved` event means the template has already changed.
    """
    client = authed_client()
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        raise ApiError(400, "Expected a JSON object body")
    instruction = str(body.get("instruction") or "").strip()
    if not instruction:
        raise ApiError(400, "Describe the change you want")

    payload: dict[str, Any] = {
        "instruction": instruction,
        # Prior instructions for THIS report, so a follow-up ("now drop the
        # decimals too", "undo that") builds on the last one instead of
        # starting over.
        "messages": body.get("messages") if isinstance(body.get("messages"), list) else [],
        "conversation_mode": True,
    }
    if body.get("model_family"):
        payload["model_family"] = body["model_family"]

    upstream = client.stream_report_layout_edit(template_id, payload)

    if upstream.status_code >= 400:
        try:
            detail = upstream.json()
            detail = detail.get("error") or detail.get("detail") or detail
        except ValueError:
            detail = upstream.text or f"InventDB returned {upstream.status_code}"
        finally:
            upstream.close()
        raise ApiError(upstream.status_code, detail)

    def relay():
        try:
            for chunk in upstream.iter_content(chunk_size=None):
                if chunk:
                    yield chunk
        finally:
            upstream.close()

    return Response(
        stream_with_context(relay()),
        mimetype="text/event-stream",
        # No `Connection` header: it is hop-by-hop, which WSGI forbids the
        # application from sending and waitress rejects outright.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------- snapshots
# A snapshot is a report the assistant rendered once and stored as an HTML
# attachment on `_System.AIReports`. Its figures are frozen — unlike a template,
# it does not re-query — so the studio shows both but says which is which.

_SNAPSHOT_NS = "_System"
_SNAPSHOT_TYPE = "AIReports"

_SNAPSHOT_SQL = (
    "SELECT _id, record_id, filename, description, content_type, tags, created_at "
    "FROM _System._attachments WHERE record_type = 'AIReports' "
    "ORDER BY created_at DESC LIMIT 500"
)


def _snapshot_name(description: Any, filename: Any) -> str:
    """Recover the report's title from what the agent wrote on the attachment.

    It stores one of two forms — ``AI-generated report: <Title> (<when>)`` or
    ``Report rendered from template '<Title>' (<when>)`` — and falls back to the
    filename, which is the title slugified with a timestamp appended.
    """
    text = str(description or "").strip()
    match = re.search(r"template ['\"]([^'\"]+)['\"]", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r"report:\s*(.+?)\s*\([^)]*\)\s*$", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    if text:
        return re.sub(r"\s*\([^)]*\)\s*$", "", text).strip()
    name = re.sub(
        r"_\d{8}_\d{6}(?:\.source)?\.html$", "", str(filename or "Report"), flags=re.IGNORECASE
    )
    return name.replace("_", " ").strip() or "Report"


def _tags_of(row: dict[str, Any]) -> list[str]:
    tags = row.get("tags")
    if isinstance(tags, list):
        return [str(t) for t in tags]
    if isinstance(tags, str):
        return [t.strip() for t in tags.split(",") if t.strip()]
    return []


@bp.get("/snapshots")
def list_report_snapshots():
    """Every stored AI snapshot, newest first.

    Only the rendered report is listed. Each one has a sibling `.source.html`
    tagged `ai-report-source` — the regeneratable source that promotion reads —
    which is machinery, not a second report.
    """
    client = authed_client()
    out = []
    for row in client.query_rows(_SNAPSHOT_SQL):
        tags = _tags_of(row)
        if "ai-report" not in tags:
            continue
        if "html" not in str(row.get("content_type") or "").lower():
            continue
        record_id = str(row.get("record_id") or "")
        attachment_id = str(row.get("_id") or "")
        if not record_id or not attachment_id:
            continue
        out.append(
            {
                "record_id": record_id,
                "attachment_id": attachment_id,
                "name": _snapshot_name(row.get("description"), row.get("filename")),
                "created_at": row.get("created_at"),
                # Rendered from a saved template, rather than authored one-off.
                "from_template": "template-rendered" in tags,
            }
        )
    return jsonify({"snapshots": out, "count": len(out)})


@bp.get("/snapshots/<record_id>/<attachment_id>")
def get_report_snapshot(record_id: str, attachment_id: str):
    """The stored HTML of one snapshot.

    Proxied rather than linked: the attachment endpoint needs the bearer token,
    which a plain `<a href>` cannot carry.
    """
    html = authed_client().attachment_text(
        _SNAPSHOT_NS, _SNAPSHOT_TYPE, record_id, attachment_id
    )
    return jsonify({"html": html})


@bp.delete("/snapshots/<record_id>")
def delete_report_snapshot(record_id: str):
    """Delete a snapshot — both the rendered HTML and its `.source.html`.

    They are one report in two files; leaving the source behind would orphan it
    where nothing in the UI can reach it.
    """
    client = authed_client()
    rows = client.query_rows(
        f"SELECT _id FROM _System._attachments WHERE record_id = {sql_literal(record_id)}"
    )
    deleted = 0
    for row in rows:
        attachment_id = str(row.get("_id") or "")
        if not attachment_id:
            continue
        try:
            client.delete_attachment(
                _SNAPSHOT_NS, _SNAPSHOT_TYPE, record_id, attachment_id
            )
            deleted += 1
        except ApiError:
            # One stubborn attachment should not abandon the rest.
            continue
    return jsonify({"ok": True, "record_id": record_id, "deleted": deleted})


@bp.post("/snapshots/<record_id>/<attachment_id>/promote")
def promote_report_snapshot(record_id: str, attachment_id: str):
    """Turn a frozen snapshot into a live template that re-queries on render."""
    body = request.get_json(silent=True) or {}
    name = str(body.get("name") or "").strip() or "Report"
    result = authed_client().promote_report_snapshot(record_id, attachment_id, name)
    template_id = None
    if isinstance(result, dict):
        template_id = result.get("id") or result.get("_id")
    return jsonify({"ok": True, "id": template_id})


# ===========================================================================
# Legal SQL rollups (retained API; not surfaced by the Reports page)
# ===========================================================================
# Each is one query executed inside InventDB. A practice accumulates tens of
# thousands of time entries, so totalling rows in Python would report the total
# of whatever page came back rather than the total.


def _agg(client: InventDBClient, sql: str, key: str = "t") -> float:
    """One scalar out of a one-row aggregate. Absent type or no match -> 0."""
    rows = _rows(client, sql)
    return _num(rows[0].get(key)) if rows else 0.0


@bp.get("/pnl")
def profit_and_loss():
    """Fees billed, cash collected and costs advanced, with breakdowns."""
    client = authed_client()
    billed = _agg(client, f"SELECT SUM(invoice_total) AS t FROM {NS}.invoices")
    write_downs = _agg(client, f"SELECT SUM(write_downs) AS t FROM {NS}.invoices")
    collected = _agg(
        client,
        f"SELECT SUM(amount) AS t FROM {NS}.payments_and_receipts "
        "WHERE lower(deposited_to) = 'operating'",
    )
    costs = _agg(client, f"SELECT SUM(amount) AS t FROM {NS}.costs_and_disbursements")

    billed_by_practice = _rows(
        client,
        f"SELECT practice_area, SUM(value_at_standard_rates) AS value "
        f"FROM {NS}.time_entries GROUP BY practice_area ORDER BY value DESC",
    )
    costs_by_category = _rows(
        client,
        f"SELECT expense_category, SUM(amount) AS value "
        f"FROM {NS}.costs_and_disbursements GROUP BY expense_category ORDER BY value DESC",
    )
    return jsonify(
        {
            "billed_total": billed,
            "collected_total": collected,
            "write_downs_total": write_downs,
            "costs_total": costs,
            "realization": round((collected / billed) * 100, 1) if billed else 0.0,
            "billed_by_practice": _distribution(billed_by_practice, "practice_area", num=True),
            "costs_by_category": _distribution(costs_by_category, "expense_category", num=True),
        }
    )


@bp.get("/cashflow")
def cashflow():
    """Monthly billings vs collections using SQL YEAR()/MONTH() grouping."""
    client = authed_client()
    buckets: dict[str, dict[str, float]] = {}

    billed_rows = _rows(
        client,
        f"SELECT YEAR(issue_date) AS y, MONTH(issue_date) AS m, "
        f"SUM(invoice_total) AS total FROM {NS}.invoices GROUP BY y, m",
    )
    for r in billed_rows:
        try:
            mk = "%04d-%02d" % (int(r.get("y")), int(r.get("m")))
        except (TypeError, ValueError):
            continue
        buckets.setdefault(mk, {"billed": 0.0, "collected": 0.0})["billed"] += _num(
            r.get("total")
        )

    # Operating deposits only — a deposit into trust is still the client's money.
    # Grouped on `deposited_to` rather than filtered by `lower(deposited_to)`:
    # an aggregate does not group reliably when the WHERE holds a function
    # call, which would pile every month's collections into a single bucket.
    collected_rows = _rows(
        client,
        f"SELECT YEAR(date) AS y, MONTH(date) AS m, deposited_to, SUM(amount) AS total "
        f"FROM {NS}.payments_and_receipts GROUP BY y, m, deposited_to",
    )
    for r in collected_rows:
        if str(r.get("deposited_to", "")).strip().lower() != "operating":
            continue
        try:
            mk = "%04d-%02d" % (int(r.get("y")), int(r.get("m")))
        except (TypeError, ValueError):
            continue
        buckets.setdefault(mk, {"billed": 0.0, "collected": 0.0})["collected"] += _num(
            r.get("total")
        )

    months = sorted(buckets.keys())[-12:]
    series = [
        {
            "month": mk,
            "billed": round(buckets[mk]["billed"], 2),
            "collected": round(buckets[mk]["collected"], 2),
            "net": round(buckets[mk]["collected"] - buckets[mk]["billed"], 2),
        }
        for mk in months
    ]
    return jsonify({"cashflow": series})


@bp.get("/wip")
def work_in_progress():
    """Unbilled billable time, by matter — the firm's inventory (SQL GROUP BY).

    This is the report a practice runs before a billing cycle: hours recorded
    against a matter that nobody has yet put on an invoice.
    """
    client = authed_client()
    # Grouped on the id alone. InventDB lower-cases the string values it groups
    # by, so carrying the caption through the GROUP BY would hand back
    # "kang brothers v. olympic boulevard" and an id of "mt-2479" that matches
    # no record. The id is recased deterministically and the readable columns are
    # read back from the matters themselves, where they are still spelled right.
    rows = _rows(
        client,
        "SELECT matter_id, SUM(hours) AS hours, "
        "SUM(value_at_standard_rates) AS value, COUNT(*) AS entries "
        f"FROM {NS}.time_entries WHERE billed = false AND billable = true "
        "GROUP BY matter_id ORDER BY value DESC",
    )

    ids = [str(r.get("matter_id") or "").upper() for r in rows]
    detail: dict[str, dict[str, Any]] = {}
    if ids:
        in_list = ", ".join(sql_literal(i) for i in ids[:500])
        for m in _rows(
            client,
            "SELECT matter_id, matter_caption, practice_area, client_name, "
            "responsible_attorney_name, status "
            f"FROM {NS}.matters WHERE matter_id IN ({in_list})",
        ):
            detail[str(m.get("matter_id") or "").upper()] = m

    out: list[dict[str, Any]] = []
    # Totalled from the raw figures, not from the rounded ones on each row —
    # summing 123 values that have each been trimmed to a decimal place walks
    # the total away from what the rows say it should be.
    total_hours = 0.0
    total_value = 0.0
    for r in rows:
        matter_id = str(r.get("matter_id") or "").upper()
        info = detail.get(matter_id, {})
        hours = _num(r.get("hours"))
        value = _num(r.get("value"))
        total_hours += hours
        total_value += value
        out.append(
            {
                "matter_id": matter_id,
                "matter_caption": info.get("matter_caption") or matter_id,
                "practice_area": info.get("practice_area"),
                "client_name": info.get("client_name"),
                "responsible_attorney_name": info.get("responsible_attorney_name"),
                "status": info.get("status"),
                "entries": int(_num(r.get("entries"))),
                "hours": round(hours, 1),
                "value": round(value, 2),
            }
        )

    return jsonify(
        {
            "rows": out,
            "count": len(out),
            "total_hours": round(total_hours, 1),
            "total_value": round(total_value, 2),
        }
    )


@bp.get("/deadlines")
def deadlines_due():
    """Open deadlines & SOL falling due within N days (default 30), soonest first.

    Anything already overdue is included whatever the window: a missed
    limitations date does not stop being urgent because it is in the past.
    """
    client = authed_client()
    try:
        days = max(1, min(int(request.args.get("days", 30)), 365))
    except (TypeError, ValueError):
        days = 30
    today = clock.today()
    end = today + timedelta(days=days)
    rows = _rows(
        client,
        "SELECT deadline_id, matter_id, matter_caption, description, category, "
        "authority, due_date, days_remaining, priority, owner_name, status "
        f"FROM {NS}.deadlines_and_sol "
        "WHERE lower(status) = 'open' "
        f"AND due_date <= '{end.isoformat()}' "
        "ORDER BY due_date ASC",
    )
    overdue = sum(1 for r in rows if str(r.get("due_date") or "")[:10] < today.isoformat())
    critical = sum(1 for r in rows if str(r.get("priority", "")).lower() == "critical")
    return jsonify(
        {
            "rows": rows,
            "count": len(rows),
            "days": days,
            "overdue": overdue,
            "critical": critical,
        }
    )


@bp.get("/caseload")
def caseload():
    """Open/closed split and practice-area mix across the matter inventory."""
    client = authed_client()
    by_status = _rows(
        client,
        f"SELECT status, COUNT(*) AS value FROM {NS}.matters "
        "GROUP BY status ORDER BY value DESC",
    )
    by_practice = _rows(
        client,
        f"SELECT practice_area, COUNT(*) AS value FROM {NS}.matters "
        "GROUP BY practice_area ORDER BY value DESC",
    )
    by_attorney = _rows(
        client,
        f"SELECT responsible_attorney_name, COUNT(*) AS value FROM {NS}.matters "
        "GROUP BY responsible_attorney_name ORDER BY value DESC",
    )
    total = sum(int(r.get("value") or 0) for r in by_status)
    open_count = sum(
        int(r.get("value") or 0)
        for r in by_status
        if str(r.get("status", "")).lower() == "open"
    )
    return jsonify(
        {
            "by_status": _distribution(by_status, "status"),
            "by_practice_area": _distribution(by_practice, "practice_area"),
            "by_responsible_attorney": _distribution(by_attorney, "responsible_attorney_name"),
            "total": total,
            "open": open_count,
            "open_rate": round((open_count / total) * 100, 1) if total else 0.0,
        }
    )


@bp.get("/time-entries")
def time_entries_report():
    """Recorded time by task, activity and timekeeper, plus unbilled value."""
    client = authed_client()
    by_task = _rows(
        client,
        f"SELECT task_description, COUNT(*) AS value FROM {NS}.time_entries "
        "GROUP BY task_description ORDER BY value DESC",
    )
    by_activity = _rows(
        client,
        f"SELECT activity_description, COUNT(*) AS value FROM {NS}.time_entries "
        "GROUP BY activity_description ORDER BY value DESC",
    )
    by_timekeeper = _rows(
        client,
        f"SELECT timekeeper, SUM(hours) AS value FROM {NS}.time_entries "
        "GROUP BY timekeeper ORDER BY value DESC",
    )
    unbilled = _agg(
        client,
        f"SELECT SUM(value_at_standard_rates) AS t FROM {NS}.time_entries "
        "WHERE billed = false AND billable = true",
    )
    return jsonify(
        {
            "by_task": _distribution(by_task, "task_description"),
            "by_activity": _distribution(by_activity, "activity_description"),
            "by_timekeeper": _distribution(by_timekeeper, "timekeeper", num=True),
            "unbilled_value": unbilled,
        }
    )


@bp.get("/ar-aging")
def ar_aging():
    """Receivables by aging bucket — what is owed, and how stale it is."""
    client = authed_client()
    rows = _rows(
        client,
        f"SELECT aging_bucket, COUNT(*) AS n, SUM(balance_due) AS value "
        f"FROM {NS}.invoices GROUP BY aging_bucket ORDER BY value DESC",
    )
    buckets = [
        {
            "name": _title(r.get("aging_bucket")),
            "invoices": int(r.get("n") or 0),
            "value": _num(r.get("value")),
        }
        for r in rows
    ]
    by_status = _rows(
        client,
        f"SELECT status, SUM(balance_due) AS value FROM {NS}.invoices "
        "GROUP BY status ORDER BY value DESC",
    )
    outstanding = _agg(
        client,
        f"SELECT SUM(balance_due) AS t FROM {NS}.invoices WHERE lower(status) != 'paid'",
    )
    return jsonify(
        {
            "buckets": buckets,
            "by_status": _distribution(by_status, "status", num=True),
            "outstanding_total": outstanding,
        }
    )


@bp.get("/trust-compliance")
def trust_compliance():
    """Client trust account position, and any matter ledger showing a negative.

    A negative matter balance inside a CTA means one client's money paid
    another's costs. It is where a State Bar audit starts, so it is reported as
    the list of matters rather than as a count to be glanced at.
    """
    client = authed_client()
    amount_in = _agg(client, f"SELECT SUM(amount_in) AS t FROM {NS}.trust_ledger_cta")
    amount_out = _agg(client, f"SELECT SUM(amount_out) AS t FROM {NS}.trust_ledger_cta")

    negatives = _rows(
        client,
        "SELECT matter_id, client_name, matter_ledger_balance, date "
        f"FROM {NS}.trust_ledger_cta WHERE matter_ledger_balance < 0 "
        "ORDER BY matter_ledger_balance ASC",
    )
    by_type = _rows(
        client,
        f"SELECT transaction_type, COUNT(*) AS value FROM {NS}.trust_ledger_cta "
        "GROUP BY transaction_type ORDER BY value DESC",
    )
    return jsonify(
        {
            "amount_in": round(amount_in, 2),
            "amount_out": round(amount_out, 2),
            "trust_balance": round(amount_in - amount_out, 2),
            "negative_ledgers": negatives,
            "negative_count": len(negatives),
            "by_transaction_type": _distribution(by_type, "transaction_type"),
        }
    )


# ===========================================================================
# Dashboard widgets — the "describe a mini-report" surface
# ===========================================================================
# A dashboard widget of kind `report` is a report-engine template like any
# other; what differs is that it is authored by description, is compact, and may
# read several types rather than one module's rows. So it uses the same
# generate -> persist -> prove-it-renders loop the view designer uses, without
# the entity scoping: a widget is not "a layout for Properties", it is whatever
# the person asked for.


def _widget_html(result: Any) -> str:
    """The HTML out of a layout-generator reply, whichever shape it arrives in."""
    data = result if isinstance(result, dict) else {}
    inner = data.get("data") if isinstance(data.get("data"), dict) else {}
    return str(data.get("html") or inner.get("html") or "")


@bp.post("/widgets/design")
def design_widget():
    """Design (or edit) one dashboard widget, and return a template that renders.

    Nothing about this is entity-scoped. The generator is told which types exist
    and may query any of them, because a widget is frequently a figure drawn
    from two or three at once -- occupancy against rent, say.
    """
    client = authed_client()
    body = request.get_json(silent=True) or {}

    instruction = body.get("instruction")
    if not isinstance(instruction, str) or not instruction.strip():
        raise ApiError(400, "Describe the widget you want")
    instruction = instruction.strip()

    base_sql = body.get("base_sql")
    base_sql = (
        base_sql.strip()
        if isinstance(base_sql, str) and base_sql.strip()
        else f"SELECT * FROM {NS}.properties"
    )

    history = body.get("history")
    history = (
        [str(h) for h in history if isinstance(h, str)][-20:]
        if isinstance(history, list)
        else []
    )
    family = body.get("model_family")

    # Editing an existing widget amends the template's *source*, never its
    # rendered output -- the render inlines every row it read and would swamp
    # the model's context for no benefit.
    template_id = body.get("template_id")
    template_id = template_id.strip() if isinstance(template_id, str) else ""
    current_html = ""
    if template_id:
        existing = client.get_report_template(template_id)
        if isinstance(existing, dict):
            current_html = str(existing.get("html") or "")

    title = body.get("title")
    title = title.strip() if isinstance(title, str) and title.strip() else "untitled"

    html = ""
    render_error = ""
    steer = instruction

    # Three attempts. A template whose server-side SQL uses an unsupported
    # function only fails at render, and the engine's error names the functions
    # it does support -- feeding that back is what turns a dead widget into a
    # working one. Past three the model is not converging and the error is worth
    # showing rather than hiding behind another retry.
    for attempt in range(3):
        payload: dict[str, Any] = {
            "baseSql": base_sql,
            "namespace": client.namespace,
            "instruction": steer,
        }
        if current_html:
            payload["currentHtml"] = current_html
        if history:
            payload["history"] = history
        if isinstance(family, str) and family.strip():
            payload["model_family"] = family.strip()

        candidate = _widget_html(client.generate_view_layout(payload))
        if not candidate:
            if attempt == 0:
                raise ApiError(502, "The assistant returned no widget")
            break
        html = candidate

        # Rendering needs a stored template, so the candidate has to be saved
        # before it can be proved. An abandoned design therefore leaves a
        # template behind -- the same trade SOAR makes, for the same reason.
        if template_id:
            client.update_report_template(template_id, {"html": html})
        else:
            created = client.create_report_template(f"Widget — {title}", html)
            new_id = ""
            if isinstance(created, dict):
                new_id = str(created.get("_id") or created.get("id") or "")
            if not new_id:
                raise ApiError(502, "Could not store the generated widget")
            template_id = new_id

        try:
            client.render_report_template(template_id, {"viewSql": base_sql})
            render_error = ""
            break
        except ApiError as exc:
            render_error = str(exc.detail)
            current_html = html
            steer = (
                f"{instruction}\n\nThe widget you produced FAILED to render with "
                f"this InventDB engine error. Fix the template so it renders "
                f"cleanly -- for example by replacing an unsupported SQL function "
                f"with a supported one from the list in the error -- without "
                f"changing the intended design:\n\n{render_error}"
            )

    if render_error:
        raise ApiError(502, f"The generated widget could not render: {render_error}")

    return jsonify({"template_id": template_id, "html": html, "base_sql": base_sql})


@bp.post("/widgets/<template_id>/render")
def render_widget(template_id: str):
    """Re-run a widget's queries and return its HTML. Live on every open."""
    body = request.get_json(silent=True) or {}
    view_sql = body.get("base_sql")
    view_sql = view_sql.strip() if isinstance(view_sql, str) else ""

    client = authed_client()
    result = client.render_report_template(template_id, {"viewSql": view_sql}) or {}
    return jsonify({"html": result.get("html") or ""})
