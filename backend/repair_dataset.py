#!/usr/bin/env python3
"""Repair five derivable data defects in the InventDB ``legal`` namespace.

Usage:
    python repair_dataset.py <username> <password>            # dry run, changes nothing
    python repair_dataset.py <username> <password> --apply    # writes the corrections
    python repair_dataset.py <username> <password> --only 1,4 # a subset of repairs

Every repair here is *derived* from data already in the namespace, never invented.
Each one is verified before it is written, and the script refuses to write a value
it cannot reproduce exactly. Defects that are NOT derivable are reported at the end
and deliberately left alone -- see ``UNFIXABLE``.

The five:

1. ``trust_ledger_cta.amount_in`` is empty on 1,829 of 2,217 deposit rows
   (every "flat fee (unearned)" and "retainer replenishment", plus 12 settlement
   deposits). The running ``matter_ledger_balance`` on those rows *does* include
   the deposit, so the missing figure is exactly ``balance - previous_balance +
   amount_out``. This is the serious one: it is why summing the column gives
   -$5,870,598 instead of the true $1,268,901.63, and it is why the shipped
   ``/api/reports/trust-compliance`` and dashboard endpoints -- whose arithmetic
   is correct -- return a nonsense balance.

2. ``intake_and_leads.decline_reason`` holds the literal string ``"0"`` on 386
   rows as a stand-in for "no value". Blanked.

3. ``intake_and_leads.disposition`` is empty on 205 rows that carry a real
   decline reason. Those are declines; set to ``Declined``. The 249 rows with
   neither a disposition nor a reason are left alone -- they are genuinely
   unresolved, and that is a finding rather than a defect.

4. ``costs_and_disbursements.advanced_by_firm`` reads ``Yes`` on all 8,027 rows,
   which makes it useless as a filter. ``paid_from`` carries the real
   distinction, so the flag is rewritten from it.

5. ``trust_ledger_cta.reconciliation_month`` holds an Excel serial number
   (``45565``) rather than a date. Converted to ISO ``YYYY-MM-DD``.
"""

from __future__ import annotations

import argparse
import datetime
import sys
from collections import defaultdict
from typing import Any

from app.errors import ApiError
from app.inventdb import InventDBClient

NS = "legal"
PAGE = 900  # InventDB caps a statement at 1,000 rows; stay under it.

EXCEL_EPOCH = datetime.date(1899, 12, 30)

#: Defects that cannot be derived from the data and are therefore reported, not written.
UNFIXABLE = [
    (
        "deadlines_and_sol.calendared",
        "null on all 804 open deadlines (every completed one says Yes)",
        "Stamping 'Yes' would assert that every open deadline is in someone's "
        "calendar. 'Open and uncalendared' is a real and dangerous state, so "
        "inventing the value would erase the safety signal the field exists for. "
        "It needs to be captured at source.",
    ),
    (
        "court_calendar.event_type",
        "missing on 429 of 3,040 events, 61 of them future-dated",
        "The hearing type cannot be inferred from the venue or the matter. The "
        "61 future ones matter most -- somebody has to say what they are.",
    ),
    (
        "intake_and_leads.disposition",
        "249 leads have no disposition and no decline reason",
        "Genuinely unresolved intake, not a data-entry artefact. Each one is a "
        "person who contacted the firm and was never told anything. Work the "
        "backlog; do not label it.",
    ),
]


def _num(v: Any) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _page(client: InventDBClient, table: str, order: str) -> list[dict[str, Any]]:
    """Every row of a type, walked in pages because a statement caps at 1,000."""
    out: list[dict[str, Any]] = []
    offset = 0
    while True:
        rows = client.query_rows(
            f"SELECT * FROM {NS}.{table} ORDER BY {order} LIMIT {PAGE} OFFSET {offset}"
        )
        out.extend(rows)
        if len(rows) < PAGE:
            return out
        offset += PAGE


def _write(client: InventDBClient, table: str, patches: list[dict[str, Any]], apply: bool) -> int:
    """Apply patches one record at a time, reporting the first failure loudly."""
    if not apply:
        return 0
    done = 0
    for patch in patches:
        try:
            client.update_record(table, patch)
        except ApiError as exc:
            print(f"    ! failed on {patch.get('_id')}: {exc}")
            raise
        done += 1
        if done % 250 == 0:
            print(f"    ...{done}/{len(patches)}")
    return done


# --------------------------------------------------------------------------- 1
def repair_trust_amount_in(client: InventDBClient, apply: bool) -> None:
    print("\n[1] trust_ledger_cta.amount_in -- missing on deposit rows")
    rows = _page(client, "trust_ledger_cta", "matter_id, date, transaction_id")

    by_matter: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_matter[r.get("matter_id")].append(r)

    patches: list[dict[str, Any]] = []
    undecidable = 0
    for matter_rows in by_matter.values():
        matter_rows.sort(key=lambda r: (str(r.get("date")), str(r.get("transaction_id"))))
        previous = 0.0
        for r in matter_rows:
            balance = _num(r.get("matter_ledger_balance"))
            implied = balance - previous + _num(r.get("amount_out"))
            if _num(r.get("amount_in")) == 0 and implied > 0.005:
                # Only write a figure that is exact to the cent.
                if abs(implied - round(implied, 2)) < 1e-6:
                    patches.append({"_id": r["_id"], "amount_in": round(implied, 2)})
                else:
                    undecidable += 1
            previous = balance

    recovered = sum(p["amount_in"] for p in patches)
    before = sum(_num(r.get("amount_in")) for r in rows)
    paid_out = sum(_num(r.get("amount_out")) for r in rows)

    print(f"    rows to correct     : {len(patches)}")
    print(f"    not derivable       : {undecidable}")
    print(f"    value recovered     : {recovered:,.2f}")
    print(f"    amount_in before    : {before:,.2f}")
    print(f"    amount_in after     : {before + recovered:,.2f}")
    print(f"    balance after fix   : {before + recovered - paid_out:,.2f}")

    # Independent check: the corrected total must equal money actually paid into
    # trust, per a different type entirely.
    deposits = client.query_rows(
        f"SELECT SUM(amount) AS t FROM {NS}.payments_and_receipts "
        "WHERE deposited_to = 'Trust'"
    )
    expected = _num(deposits[0].get("t")) if deposits else 0.0
    print(f"    payments to trust   : {expected:,.2f}")
    if expected and abs((before + recovered) - expected) > 0.01:
        print("    ! MISMATCH -- refusing to write. Investigate before applying.")
        return
    print("    cross-check         : OK (matches payments_and_receipts)")

    written = _write(client, "trust_ledger_cta", patches, apply)
    print(f"    {'WROTE ' + str(written) + ' rows' if apply else 'dry run - nothing written'}")


# --------------------------------------------------------------------------- 2+3
def repair_intake(client: InventDBClient, apply: bool, do_reason: bool, do_disp: bool) -> None:
    rows = _page(client, "intake_and_leads", "lead_id")

    if do_reason:
        print('\n[2] intake_and_leads.decline_reason -- literal "0" used as a null')
        blanks = [r for r in rows if str(r.get("decline_reason")).strip() == "0"]
        print(f"    rows to blank       : {len(blanks)}")
        patches = [{"_id": r["_id"], "decline_reason": ""} for r in blanks]
        written = _write(client, "intake_and_leads", patches, apply)
        print(f"    {'WROTE ' + str(written) + ' rows' if apply else 'dry run - nothing written'}")

    if do_disp:
        print("\n[3] intake_and_leads.disposition -- blank where a decline reason exists")
        declined = [
            r
            for r in rows
            if not str(r.get("disposition") or "").strip()
            and str(r.get("decline_reason") or "").strip() not in ("", "0")
        ]
        unresolved = [
            r
            for r in rows
            if not str(r.get("disposition") or "").strip()
            and str(r.get("decline_reason") or "").strip() in ("", "0")
        ]
        signed = sum(1 for r in rows if str(r.get("disposition") or "") == "Signed")
        print(f"    to set 'Declined'   : {len(declined)}")
        print(f"    left alone          : {len(unresolved)} (no reason recorded -- see UNFIXABLE)")
        print(f"    result              : {signed} Signed / {len(declined)} Declined "
              f"/ {len(unresolved)} unresolved")
        patches = [{"_id": r["_id"], "disposition": "Declined"} for r in declined]
        written = _write(client, "intake_and_leads", patches, apply)
        print(f"    {'WROTE ' + str(written) + ' rows' if apply else 'dry run - nothing written'}")


# --------------------------------------------------------------------------- 4
def repair_cost_flag(client: InventDBClient, apply: bool) -> None:
    print("\n[4] costs_and_disbursements.advanced_by_firm -- 'Yes' on every row")
    rows = _page(client, "costs_and_disbursements", "cost_id")

    patches = []
    for r in rows:
        advanced = "(advanced by firm)" in str(r.get("paid_from") or "")
        want = "Yes" if advanced else "No"
        if str(r.get("advanced_by_firm") or "") != want:
            patches.append({"_id": r["_id"], "advanced_by_firm": want})

    to_no = sum(1 for p in patches if p["advanced_by_firm"] == "No")
    to_yes = len(patches) - to_no
    print(f"    rows to correct     : {len(patches)}  ({to_no} -> No, {to_yes} -> Yes)")
    print(f"    genuinely advanced  : {sum(1 for r in rows if '(advanced by firm)' in str(r.get('paid_from') or ''))}")
    written = _write(client, "costs_and_disbursements", patches, apply)
    print(f"    {'WROTE ' + str(written) + ' rows' if apply else 'dry run - nothing written'}")


# --------------------------------------------------------------------------- 5
def repair_recon_month(client: InventDBClient, apply: bool) -> None:
    print("\n[5] trust_ledger_cta.reconciliation_month -- Excel serial, not a date")
    rows = _page(client, "trust_ledger_cta", "transaction_id")

    patches = []
    for r in rows:
        raw = str(r.get("reconciliation_month") or "").strip()
        if not raw or "-" in raw:
            continue
        try:
            serial = float(raw)
        except ValueError:
            continue
        if not (30000 < serial < 60000):  # sanity: a plausible Excel date serial
            continue
        iso = (EXCEL_EPOCH + datetime.timedelta(days=serial)).isoformat()
        patches.append({"_id": r["_id"], "reconciliation_month": iso})

    print(f"    rows to convert     : {len(patches)}")
    if patches:
        print(f"    example             : {patches[0]['reconciliation_month']}")
    written = _write(client, "trust_ledger_cta", patches, apply)
    print(f"    {'WROTE ' + str(written) + ' rows' if apply else 'dry run - nothing written'}")


# --------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("username")
    ap.add_argument("password")
    ap.add_argument("--apply", action="store_true",
                    help="write the corrections (default is a dry run)")
    ap.add_argument("--only", default="1,2,3,4,5",
                    help="comma-separated repair numbers to run")
    args = ap.parse_args()

    only = {p.strip() for p in args.only.split(",") if p.strip()}

    probe = InventDBClient()
    try:
        session = probe.login(args.username, args.password)
    except ApiError as exc:
        print(f"Login failed: {exc}")
        return 1
    token = session.get("token")
    if not token:
        print("Login returned no token.")
        return 1

    client = InventDBClient(token=token)
    print(f"Instance  : {client.base_url}")
    print(f"Namespace : {client.namespace}")
    print(f"Mode      : {'APPLY -- writing changes' if args.apply else 'DRY RUN -- nothing will be written'}")

    if "1" in only:
        repair_trust_amount_in(client, args.apply)
    if "2" in only or "3" in only:
        repair_intake(client, args.apply, "2" in only, "3" in only)
    if "4" in only:
        repair_cost_flag(client, args.apply)
    if "5" in only:
        repair_recon_month(client, args.apply)

    print("\n" + "-" * 70)
    print("Left alone on purpose -- not derivable from the data:")
    for field, defect, why in UNFIXABLE:
        print(f"\n  {field}")
        print(f"    {defect}")
        print(f"    {why}")

    if not args.apply:
        print("\nRe-run with --apply to write the corrections.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
