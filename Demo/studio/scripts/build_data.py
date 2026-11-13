"""Turn the shipped practice dataset into what the demo recording serves.

The film records the real React app against the E2E suite's mocked `/api`.
That mock ships a handful of hand-written rows; this script replaces them with
the firm in `CA_Litigation_Practice_Dataset.xlsx` (Alvarado & Sung LLP, a
synthetic Los Angeles litigation firm) and computes the dashboard and report
figures the same way `backend/app/routers/dashboard.py` and `reports.py` do,
against the dataset's own as-of date, so every number on screen is true of
that dataset.

    python scripts/build_data.py
writes capture/data/store.json and capture/data/figures.json
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[3]
XLSX = ROOT / "CA_Litigation_Practice_Dataset.xlsx"
ENTITIES_TS = ROOT / "frontend" / "src" / "config" / "entities.ts"
OUT = Path(__file__).resolve().parents[1] / "capture" / "data"

TODAY = date(2026, 8, 19)  # the dataset's as-of date (README sheet)

SHEETS = {
    "Matters": "matters",
    "Clients": "clients",
    "Timekeepers": "timekeepers",
    "Time Entries": "time_entries",
    "Costs and Disbursements": "costs_and_disbursements",
    "Invoices": "invoices",
    "Payments and Receipts": "payments_and_receipts",
    "Trust Ledger CTA": "trust_ledger_cta",
    "Court Calendar": "court_calendar",
    "Deadlines and SOL": "deadlines_and_sol",
    "Intake and Leads": "intake_and_leads",
    "Settlements and Liens": "settlements_and_liens",
    "Lookups": "lookups",
}


def snake(header: str) -> str:
    s = header.strip().lower()
    s = s.replace("%", " pct ").replace("&", " and ").replace("#", " no ")
    s = re.sub(r"\bno\.", "no", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")


def schema() -> dict[str, list[tuple[str, str]]]:
    """entity -> [(field name, label)] parsed from the frontend's field config."""
    text = ENTITIES_TS.read_text(encoding="utf-8")
    start = text.index("export const ENTITIES")
    out: dict[str, list[tuple[str, str]]] = {}
    blocks = re.split(r"\n  \{\n    name: \"", text[start:])[1:]
    for block in blocks:
        name = block.split('"', 1)[0]
        fields = re.findall(r'name: "([a-z0-9_]+)",\s*label: "([^"]+)"', block)
        out[name] = fields
    return out


def clean(v):
    if isinstance(v, datetime):
        return v.date().isoformat() if (v.hour, v.minute, v.second) == (0, 0, 0) else v.isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e15:
        return v
    return v


def load() -> dict[str, list[dict]]:
    fields = schema()
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    store: dict[str, list[dict]] = {}
    unmapped: dict[str, list[str]] = {}
    for sheet, entity in SHEETS.items():
        ws = wb[sheet]
        rows = ws.iter_rows(values_only=True)
        headers = [str(h) if h is not None else "" for h in next(rows)]
        known = {n for n, _ in fields.get(entity, [])}
        by_label = {snake(lbl): n for n, lbl in fields.get(entity, [])}
        keys = []
        for h in headers:
            k = snake(h)
            if k not in known and k in by_label:
                k = by_label[k]
            keys.append(k)
        unmapped[entity] = sorted(known - set(keys))
        recs = []
        for i, r in enumerate(rows):
            if all(v is None for v in r):
                continue
            rec = {"_id": f"{entity[:3]}-{i + 1}"}
            for k, v in zip(keys, r):
                if k and v is not None and v != "":
                    rec[k] = clean(v)
            recs.append(rec)
        store[entity] = recs
    return store, unmapped


def num(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def low(v) -> str:
    return str(v or "").strip().lower()


def truthy(v) -> bool:
    return low(v) in ("true", "yes", "y", "1")


def dist(rows, col, limit=0):
    c = Counter(str(r.get(col)) for r in rows if r.get(col) not in (None, ""))
    items = [{"name": k, "value": v} for k, v in c.most_common()]
    return items[:limit] if limit else items


def sum_dist(rows, col, amount, limit=0):
    acc: dict[str, float] = defaultdict(float)
    for r in rows:
        if r.get(col) not in (None, ""):
            acc[str(r[col])] += num(r.get(amount))
    items = sorted(({"name": k, "value": round(v, 2)} for k, v in acc.items()), key=lambda x: -x["value"])
    return items[:limit] if limit else items


def month_of(v) -> str:
    return str(v or "")[:7]


def figures(s: dict[str, list[dict]]) -> dict:
    t = TODAY.isoformat()
    horizon = (TODAY + timedelta(days=30)).isoformat()
    this_month = TODAY.strftime("%Y-%m")
    m, d, te, inv, pay, tr = (s[k] for k in ("matters", "deadlines_and_sol", "time_entries", "invoices",
                                              "payments_and_receipts", "trust_ledger_cta"))
    cal, lead, cl, costs = s["court_calendar"], s["intake_and_leads"], s["clients"], s["costs_and_disbursements"]

    open_m = sum(1 for r in m if low(r.get("status")) == "open")
    unbilled = [r for r in te if not truthy(r.get("billed")) and truthy(r.get("billable"))]
    summary = {
        "as_of": this_month,
        "matters": {"total": len(m), "open": open_m,
                    "closed": sum(1 for r in m if low(r.get("status")) == "closed"),
                    "open_rate": round(open_m / len(m) * 100, 1)},
        "clients": {"total": len(cl), "active": sum(1 for r in cl if low(r.get("status")) == "active")},
        "deadlines": {
            "total": len(d),
            "open": sum(1 for r in d if low(r.get("status")) == "open"),
            "due_30d": sum(1 for r in d if low(r.get("status")) == "open" and t <= str(r.get("due_date", "")) <= horizon),
            "overdue": sum(1 for r in d if low(r.get("status")) == "open" and str(r.get("due_date", "")) < t and r.get("due_date")),
        },
        "time": {
            "entries": len(te),
            "hours_month": round(sum(num(r.get("hours")) for r in te if month_of(r.get("date")) == this_month), 1),
            "unbilled_hours": round(sum(num(r.get("hours")) for r in unbilled), 1),
            "wip_value": round(sum(num(r.get("value_at_standard_rates")) for r in unbilled), 2),
        },
        "financials": {
            "billed_month": round(sum(num(r.get("invoice_total")) for r in inv if month_of(r.get("issue_date")) == this_month), 2),
            "ar_outstanding": round(sum(num(r.get("balance_due")) for r in inv if low(r.get("status")) != "paid"), 2),
            "collected_month": round(sum(num(r.get("amount")) for r in pay
                                         if low(r.get("deposited_to")) == "operating" and month_of(r.get("date")) == this_month), 2),
            "trust_balance": round(sum(num(r.get("amount_in")) for r in tr) - sum(num(r.get("amount_out")) for r in tr), 2),
        },
        "calendar": {"upcoming_30d": sum(1 for r in cal if t <= str(r.get("date", "")) <= horizon)},
        "intake": {"total": len(lead), "month": sum(1 for r in lead if month_of(r.get("date_received")) == this_month)},
    }

    def pick(rows, cols):
        return [{k: r.get(k) for k in ["_id", *cols] if r.get(k) is not None} for r in rows]

    open_d = [r for r in d if low(r.get("status")) == "open" and r.get("due_date")]
    deadline_cols = ["matter_id", "matter_caption", "description", "due_date", "priority", "owner_name"]
    panels = {
        "deadlines": {"entity": "deadlines_and_sol", "rows": pick(sorted([r for r in open_d if str(r["due_date"]) >= t], key=lambda r: str(r["due_date"]))[:8], deadline_cols)},
        "overdue": {"entity": "deadlines_and_sol", "rows": pick(sorted([r for r in open_d if str(r["due_date"]) < t], key=lambda r: str(r["due_date"]))[:8], deadline_cols)},
        "hearings": {"entity": "court_calendar", "rows": pick(sorted([r for r in cal if str(r.get("date", "")) >= t], key=lambda r: (str(r["date"]), str(r.get("time", ""))))[:8],
                                                             ["date", "time", "matter_id", "matter_caption", "court_location", "appearing_name"])},
        "matters": {"entity": "matters", "rows": pick(sorted([r for r in m if low(r.get("status")) == "open"], key=lambda r: str(r.get("date_opened", "")), reverse=True)[:8],
                                                      ["matter_id", "matter_caption", "client_name", "stage", "next_court_date"])},
        "leads": {"entity": "intake_and_leads", "rows": pick(sorted(lead, key=lambda r: str(r.get("date_received", "")), reverse=True)[:8],
                                                             ["date_received", "prospect_name", "potential_claim_type", "phone"])},
        "clients": {"entity": "clients", "rows": pick(sorted(cl, key=lambda r: str(r.get("intake_date", "")), reverse=True)[:8],
                                                      ["client_id", "client_name", "city", "conflict_check_result", "intake_date"])},
        "time": {"entity": "time_entries", "rows": pick(sorted(te, key=lambda r: str(r.get("date", "")), reverse=True)[:8],
                                                        ["date", "matter_id", "matter_caption", "timekeeper", "hours"])},
        "invoices": {"entity": "invoices", "rows": pick(sorted([r for r in inv if low(r.get("status")) != "paid"], key=lambda r: str(r.get("due_date", "")))[:8],
                                                        ["matter_id", "client_name", "due_date", "balance_due"])},
        "trust": {"entity": "trust_ledger_cta", "rows": pick(sorted(tr, key=lambda r: str(r.get("date", "")), reverse=True)[:8],
                                                            ["date", "matter_id", "client_name", "amount_in", "amount_out"])},
    }

    months = []
    y, mo = TODAY.year, TODAY.month
    for _ in range(6):
        months.append(f"{y:04d}-{mo:02d}")
        mo -= 1
        if mo == 0:
            y, mo = y - 1, 12
    months.reverse()
    billed = defaultdict(float)
    for r in inv:
        billed[month_of(r.get("issue_date"))] += num(r.get("invoice_total"))
    collected = defaultdict(float)
    for r in pay:
        if low(r.get("deposited_to")) == "operating":
            collected[month_of(r.get("date"))] += num(r.get("amount"))
    charts = {
        "matter_status": dist(m, "status"),
        "practice_area": dist(m, "practice_area", 10),
        "deadline_status": dist(d, "status"),
        "deadline_priority": dist(d, "priority"),
        "cost_breakdown": sum_dist(costs, "expense_category", "amount", 10),
        "ar_aging": sum_dist(inv, "aging_bucket", "balance_due"),
        "cashflow": [{"month": k, "billed": round(billed[k], 2), "collected": round(collected[k], 2),
                      "net": round(collected[k] - billed[k], 2)} for k in months],
    }

    reports = report_pages(s)

    stats = {k: len(v) for k, v in s.items()}
    stats["practice_areas"] = len({r.get("practice_area") for r in m if r.get("practice_area")})
    stats["trust_in"] = round(sum(num(r.get("amount_in")) for r in tr), 2)
    return {"today": t, "summary": summary, "panels": panels, "charts": charts, "stats": stats, "reports": reports}


def money(v: float) -> str:
    return f"${v:,.2f}"


def page(title: str, sub: str, head: list[str], rows: list[list[str]], foot: list[str] | None = None) -> str:
    """A rendered report, styled like the firm's printed reports."""
    th = "".join(f"<th>{h}</th>" for h in head)
    body = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    tf = ("<tfoot><tr>" + "".join(f"<td>{c}</td>" for c in foot) + "</tr></tfoot>") if foot else ""
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
body{{font-family:"IBM Plex Sans",system-ui,sans-serif;margin:28px 32px;color:#1c1916;background:#fffdf9}}
h1{{font-family:"Source Serif 4",Georgia,serif;font-weight:600;font-size:22px;margin:0 0 4px}}
.sub{{color:#675c50;font-size:13px;margin-bottom:18px}}
table{{border-collapse:collapse;width:100%;font-size:13px}}
th{{text-align:left;font-weight:600;color:#4a4239;border-bottom:2px solid #5b1a24;padding:7px 8px}}
td{{padding:7px 8px;border-bottom:1px solid #ebe1cf}}
td:last-child,th:last-child{{text-align:right;font-variant-numeric:tabular-nums}}
tfoot td{{font-weight:600;border-top:2px solid #1c1916;border-bottom:none}}
.crit{{color:#8f1d2c;font-weight:600}}
</style></head><body><h1>{title}</h1><div class="sub">{sub}</div>
<table><thead><tr>{th}</tr></thead><tbody>{body}</tbody>{tf}</table></body></html>"""


def report_pages(s: dict[str, list[dict]]) -> dict[str, str]:
    t = TODAY.isoformat()
    horizon = (TODAY + timedelta(days=30)).isoformat()
    due = sorted((r for r in s["deadlines_and_sol"] if low(r.get("status")) == "open"
                  and t <= str(r.get("due_date", "")) <= horizon), key=lambda r: (str(r["due_date"]), str(r.get("priority"))))
    docket_rows = [[datetime.fromisoformat(str(r["due_date"])).strftime("%b %d"), r.get("matter_id", ""),
                    r.get("matter_caption", ""), r.get("description", ""), r.get("owner_name", ""),
                    f'<span class="crit">{r.get("priority")}</span>' if r.get("priority") == "Critical" else str(r.get("priority", ""))]
                   for r in due[:14]]
    docket = page("Docket: next 30 days", f"{len(due)} open deadlines due {TODAY:%b %d} to {(TODAY + timedelta(days=30)):%b %d, %Y}, soonest first",
                  ["Due", "Matter", "Caption", "Deadline", "Owner", "Priority"], docket_rows)

    acc: dict[str, list] = {}
    for r in s["time_entries"]:
        if truthy(r.get("billable")) and not truthy(r.get("billed")):
            a = acc.setdefault(r["matter_id"], [r.get("matter_caption", ""), r.get("practice_area", ""), 0.0, 0.0])
            a[2] += num(r.get("hours"))
            a[3] += num(r.get("value_at_standard_rates"))
    top = sorted(acc.items(), key=lambda kv: -kv[1][3])
    total_v = sum(v[3] for v in acc.values())
    total_h = sum(v[2] for v in acc.values())
    wip = page("Unbilled work by matter", f"Billable time not yet invoiced, at standard rates, as of {TODAY:%b %d, %Y}. {len(acc)} matters.",
               ["Matter", "Caption", "Practice area", "Hours", "Value"],
               [[k, v[0], v[1], f"{v[2]:.1f}", money(v[3])] for k, v in top[:14]],
               ["", "All matters", "", f"{total_h:,.1f}", money(total_v)])

    bal: dict[str, list] = {}
    for r in s["trust_ledger_cta"]:
        b = bal.setdefault(r["matter_id"], [r.get("client_name", ""), 0.0, 0.0])
        b[1] += num(r.get("amount_in"))
        b[2] += num(r.get("amount_out"))
    held = sorted(((k, v) for k, v in bal.items() if v[1] - v[2] > 0.005), key=lambda kv: -(kv[1][1] - kv[1][2]))
    total_b = sum(v[1] - v[2] for v in bal.values())
    trust = page("Trust balances by matter", f"Client trust account (IOLTA x4417) as of {TODAY:%b %d, %Y}. {len(held)} matters hold funds.",
                 ["Matter", "Client", "Deposits", "Disbursements", "Balance"],
                 [[k, v[0], money(v[1]), money(v[2]), money(v[1] - v[2])] for k, v in held[:14]],
                 ["", "Whole account", "", "", money(total_b)])
    return {"rpt-docket": docket, "rpt-wip": wip, "rpt-trust": trust}


if __name__ == "__main__":
    store, unmapped = load()
    OUT.mkdir(parents=True, exist_ok=True)
    figs = figures(store)
    (OUT / "store.json").write_text(json.dumps(store, separators=(",", ":"), default=str), encoding="utf-8")
    (OUT / "figures.json").write_text(json.dumps(figs, indent=1, default=str), encoding="utf-8")
    for e, miss in unmapped.items():
        if miss:
            print(f"{e}: schema fields with no column: {', '.join(miss)}")
    print(json.dumps(figs["summary"], indent=1))
    print(json.dumps(figs["stats"]))
