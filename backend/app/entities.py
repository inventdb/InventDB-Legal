"""Registry of legal-practice entities stored in InventDB.

These map 1:1 to the types that already exist in the InventDB ``legal``
namespace, so the app reads and writes the live data directly. Because InventDB
is schemaless, this registry is the app's authoritative list of "tables" (types)
and drives the generic CRUD router.

The set mirrors a California litigation practice: the matters themselves, who
they are for, who works them, the time and costs those people record, what gets
billed and collected, the trust account that money passes through, and the two
calendars — court appearances and the deadlines that must not be missed.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Entity:
    #: Type name inside the InventDB namespace (also the REST path segment).
    name: str
    #: Human-readable singular label.
    label: str
    #: Human-readable plural label.
    label_plural: str
    #: Business key field used for cross-entity references (not the _id).
    key: str
    #: Fields searched by the list endpoint's free-text ``q`` parameter.
    search_fields: list[str] = field(default_factory=list)
    #: Default column to sort lists by.
    order_by: str | None = None


# Order here is also the order surfaced by /api/meta/entities.
ENTITIES: list[Entity] = [
    Entity(
        name="matters",
        label="Matter",
        label_plural="Matters",
        key="matter_id",
        search_fields=[
            "matter_id",
            "matter_caption",
            "client_name",
            "client_id",
            "practice_area",
            "matter_type",
            "case_number",
            "status",
            "stage",
            "court_short",
            "responsible_attorney_name",
            "opposing_party",
            "opposing_counsel",
        ],
        order_by="date_opened",
    ),
    Entity(
        name="clients",
        label="Client",
        label_plural="Clients",
        key="client_id",
        search_fields=[
            "client_id",
            "client_name",
            "primary_contact",
            "email",
            "phone",
            "city",
            "client_type",
            "status",
            "responsible_attorney_name",
            "referral_source",
        ],
        order_by="client_name",
    ),
    Entity(
        name="timekeepers",
        label="Timekeeper",
        label_plural="Timekeepers",
        key="timekeeper_id",
        search_fields=["timekeeper_id", "name", "initials", "role"],
        order_by="name",
    ),
    Entity(
        name="time_entries",
        label="Time Entry",
        label_plural="Time Entries",
        key="time_entry_id",
        search_fields=[
            "time_entry_id",
            "matter_id",
            "matter_caption",
            "timekeeper",
            "narrative",
            "task_description",
            "activity_description",
            "practice_area",
            "invoice_no",
            "task_code",
        ],
        order_by="date",
    ),
    Entity(
        name="costs_and_disbursements",
        label="Cost",
        label_plural="Costs & Disbursements",
        key="cost_id",
        search_fields=[
            "cost_id",
            "matter_id",
            "matter_caption",
            "expense_category",
            "expense_code",
            "vendor_payee",
            "description",
            "invoice_no",
            "practice_area",
        ],
        order_by="date",
    ),
    Entity(
        name="invoices",
        label="Invoice",
        label_plural="Invoices",
        key="invoice_no",
        search_fields=[
            "invoice_no",
            "matter_id",
            "client_id",
            "client_name",
            "matter_caption",
            "status",
            "aging_bucket",
            "fee_model",
        ],
        order_by="issue_date",
    ),
    Entity(
        name="payments_and_receipts",
        label="Payment",
        label_plural="Payments & Receipts",
        key="payment_id",
        search_fields=[
            "payment_id",
            "client_name",
            "client_id",
            "matter_id",
            "payor",
            "method",
            "reference",
            "invoice_no",
            "deposited_to",
        ],
        order_by="date",
    ),
    Entity(
        name="trust_ledger_cta",
        label="Trust Ledger Entry",
        label_plural="Trust Ledger (CTA)",
        key="transaction_id",
        search_fields=[
            "transaction_id",
            "matter_id",
            "client_id",
            "client_name",
            "transaction_type",
            "description",
            "payee_payor",
            "reference",
        ],
        order_by="date",
    ),
    Entity(
        name="court_calendar",
        label="Court Event",
        label_plural="Court Calendar",
        key="event_id",
        search_fields=[
            "event_id",
            "matter_id",
            "matter_caption",
            "event_type",
            "court_location",
            "appearing_name",
            "case_number",
            "outcome",
            "judicial_officer",
        ],
        order_by="date",
    ),
    Entity(
        name="deadlines_and_sol",
        label="Deadline",
        label_plural="Deadlines & SOL",
        key="deadline_id",
        search_fields=[
            "deadline_id",
            "matter_id",
            "matter_caption",
            "description",
            "category",
            "authority",
            "trigger_event",
            "owner_name",
            "status",
            "priority",
        ],
        order_by="due_date",
    ),
    Entity(
        name="intake_and_leads",
        label="Lead",
        label_plural="Intake & Leads",
        key="lead_id",
        search_fields=[
            "lead_id",
            "prospect_name",
            "phone",
            "referral_source",
            "potential_claim_type",
            "disposition",
            "decline_reason",
        ],
        order_by="date_received",
    ),
    Entity(
        name="settlements_and_liens",
        label="Settlement",
        label_plural="Settlements & Liens",
        key="settlement_id",
        search_fields=[
            "settlement_id",
            "matter_id",
            "client_id",
            "client_name",
            "matter_type",
            "fee_basis",
            "insurance_carrier",
            "claim_number",
            "statutory_liens",
        ],
        order_by="date_settled",
    ),
    Entity(
        name="lookups",
        label="Lookup",
        label_plural="Lookups",
        key="value",
        search_fields=["list", "code", "value", "description", "authority_notes"],
        order_by="list",
    ),
]

ENTITY_BY_NAME: dict[str, Entity] = {e.name: e for e in ENTITIES}


def get_entity(name: str) -> Entity | None:
    return ENTITY_BY_NAME.get(name)
