"""Record the InventDB responses the contract tests replay.

The point of the recordings is that the contract tests run against payloads a
real instance produced, rather than against payloads someone wrote to match
what they believed the API returned. Belief is exactly what drifts.

Rather than transcribe endpoints by hand, this drives the **real Flask app**
with a recording wrapper installed around ``requests.request``. Whatever the app
asks InventDB for during a full pass over the contract is what gets recorded —
so the recordings are, by construction, the set the tests need, and they update
themselves when the app's queries change.

Usage
-----
Refresh from a live instance (read-only)::

    cd backend
    INVENTDB_BASE_URL=https://<slug>.sandbox.inventdb.com \\
    INVENTDB_USERNAME=you INVENTDB_PASSWORD=... \\
    python -m tests.contract.capture

Also exercise create/update/delete against that instance — this **writes to the
live namespace**, creating one matter and deleting it again::

    python -m tests.contract.capture --include-writes

Regenerate the checked-in synthetic baseline (no network, no credentials)::

    python -m tests.contract.capture --synthetic

Secrets are stripped before anything is written: bearer tokens, password
fields, and any key whose name looks credential-shaped.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
RECORDING_PATH = HERE / "recordings" / "inventdb.json"

REDACTED = "<redacted>"
_SECRET_KEYS = {
    "token",
    "access_token",
    "refresh_token",
    "jwt",
    "password",
    "current_password",
    "new_password",
    "secret",
    "api_key",
    "apikey",
    "authorization",
}


# ===========================================================================
# The synthetic baseline
# ===========================================================================
# Committed so the suite is meaningful in a checkout with no credentials. These
# are shaped like InventDB's responses but the values are invented — running a
# live capture replaces them, and the `source` field in the written file says
# which of the two you are looking at.

_MATTER_ROWS = [{'matter_id': 'MT-2978',
  'client_id': 'CL-1932',
  'client_name': 'Sadeghi, Nasrin',
  'matter_caption': 'Sadeghi v. Casa Bonita (WCAB)',
  'practice_area': 'Workers Compensation',
  'matter_type': 'Workers Compensation Claim (WCAB)',
  'fee_model': 'Statutory Contingency - WCAB',
  'fee_terms': 'Attorney fee of 15% of the award or compromise and release, subject to '
               "approval by the Workers' Compensation Appeals Board under Lab. Code 4906. "
               'No fee unless benefits are recovered.',
  'contingency_pre_suit': 0.15,
  'contingency_post_filing': 0.15,
  'volume_discount': 0,
  'trust_required': True,
  'court': "Workers' Compensation Appeals Board, Los Angeles District Office",
  'court_short': 'WCAB Los Angeles',
  'case_number': 'ADJ18941560',
  'judicial_officer': 'WCJ Estevan Ruvalcaba',
  'department': 'Hearing Room F',
  'date_opened': '2024-09-02',
  'date_filed': '2024-09-19',
  'incident_trigger_date': '2024-05-15',
  'limitations_authority': 'Lab. Code 5405 (1 yr)',
  'limitations_date': '2025-05-15',
  'opposing_party': 'Casa Bonita Restaurant Holdings, LLC',
  'opposing_counsel': 'The Ferrante Law Group, APC',
  'insurance_carrier': 'Zenith Insurance Company',
  'claim_number': 'WC-159377',
  'responsible_attorney': 'TK-14',
  'responsible_attorney_name': 'Yusuf Karimi',
  'originating_attorney': 'TK-09',
  'paralegal': 'TK-19',
  'status': 'Open',
  'stage': 'Compromise and Release',
  'pro_bono': False,
  'fee_agreement_date': '2024-09-08',
  'recorded_hours': 31.9,
  'recorded_value_at_standard_rates': 7410.8,
  'costs_advanced': 4840.77,
  'fees_billed': 0,
  'collected': 0,
  'trust_balance': 0,
  'next_court_date': '2026-09-20',
  '_id': '3bdbd3cb-1cb4-4d42-a648-4610974d0c80',
  '_createdAt': '2026-08-20T11:17:26.566184617+00:00',
  '_updatedAt': '2026-08-20T11:17:26.566184617+00:00'},
 {'matter_id': 'MT-2203',
  'client_id': 'CL-1196',
  'client_name': 'Cisneros, Carlos',
  'matter_caption': 'Cisneros v. Bautista',
  'practice_area': 'Personal Injury',
  'matter_type': 'Pedestrian Collision',
  'fee_model': 'Contingency',
  'fee_terms': '33 1/3% if resolved before complaint filed; 40% thereafter. Costs advanced '
               'by firm, reimbursed from recovery.',
  'contingency_pre_suit': 0.3333,
  'contingency_post_filing': 0.4,
  'volume_discount': 0,
  'trust_required': True,
  'court': 'Los Angeles Superior Court - Stanley Mosk Courthouse',
  'court_short': 'LASC Stanley Mosk',
  'case_number': '25STCV03167',
  'judicial_officer': 'Hon. Priscilla Yee-Barron',
  'department': 'Dept. 46',
  'date_opened': '2024-09-02',
  'date_filed': '2025-09-21',
  'incident_trigger_date': '2024-08-22',
  'limitations_authority': 'CCP 335.1 (2 yrs)',
  'limitations_date': '2026-08-22',
  'opposing_party': 'Marilou Bautista',
  'opposing_counsel': 'Stanfill & Ekwueme LLP',
  'insurance_carrier': 'State Farm Mutual',
  'claim_number': '58-924052-B',
  'responsible_attorney': 'TK-01',
  'responsible_attorney_name': 'Marisol Alvarado',
  'originating_attorney': 'TK-10',
  'paralegal': 'TK-18',
  'status': 'Closed',
  'stage': 'Settled - Disbursing',
  'date_closed': '2025-12-02',
  'disposition': 'Settled at mediation',
  'pro_bono': False,
  'fee_agreement_date': '2024-09-04',
  'recorded_hours': 73.5,
  'recorded_value_at_standard_rates': 23402.2,
  'costs_advanced': 2767.33,
  'fees_billed': 0,
  'collected': 43887.33,
  'trust_balance': 0,
  '_id': 'a3aadf90-170b-4a45-9ed5-41f0b21d8940',
  '_createdAt': '2026-08-20T11:17:25.649426575+00:00',
  '_updatedAt': '2026-08-20T11:17:25.649426575+00:00'}]


_SYNTHETIC_HTTP: dict[str, dict[str, Any]] = {
    "POST /api/auth/login": {
        "status": 200,
        "payload": {
            "ok": True,
            "token": REDACTED,
            "user": {
                "id": "u-1",
                "username": "e2e.manager",
                "email": "e2e.manager@example.com",
                "role": "manager",
                "isActive": True,
            },
        },
    },
    "GET /api/auth/me": {
        "status": 200,
        "payload": {
            "id": "u-1",
            "username": "e2e.manager",
            "email": "e2e.manager@example.com",
            "role": "manager",
            "isActive": True,
        },
    },
    "GET /db/legal/matters/rec-001": {"status": 200, "payload": _MATTER_ROWS[0]},
    "POST /db/legal/matters": {"status": 200, "payload": {"ok": True, "id": "rec-001"}},
    "PUT /db/legal/matters": {"status": 200, "payload": {"ok": True, "id": "rec-001"}},
    "DELETE /db/legal/matters/rec-001": {"status": 200, "payload": {"ok": True}},
    "GET /api/report-templates": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "templates": [
                    {
                        "_id": "tpl-001",
                        "name": "Client Statement",
                        "description": "Monthly statement for a single client.",
                        "category": "Finance",
                        "mode": "sql",
                        "version": 3,
                        "createdBy": "soar.admin",
                    },
                    {
                        "_id": "tpl-002",
                        "name": "Invoice Renewals Due",
                        "description": "Invoices ending in the next 90 days.",
                        "category": "Leasing",
                        "mode": "sql",
                        "version": 1,
                        "createdBy": "soar.admin",
                    },
                ]
            },
        },
    },
    "GET /api/report-templates/tpl-001": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "_id": "tpl-001",
                "name": "Client Statement",
                "description": "Monthly statement for a single client.",
                "category": "Finance",
                "mode": "sql",
                "version": 3,
                "html": "<h1>{{ client.name }}</h1>",
                "parameters": [
                    {
                        "name": "client_id",
                        "label": "Client",
                        "type": "select",
                        "required": True,
                        "source": "legal.clients",
                    },
                    {"name": "as_of", "label": "As of", "type": "date", "required": False},
                ],
            },
        },
    },
    "POST /api/report-templates/tpl-001/render": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "html": "<section><h1>Client Statement</h1></section>",
                "meta": {"elapsed_ms": 128, "mode": "sql", "bytes": 512},
            },
        },
    },
    "GET /api/workflows": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "workflows": [
                    {
                        "_id": "wf-001",
                        "name": "Weekly Invoice Renewals Due",
                        "trigger_kind": "cron",
                        "trigger_spec": {"expr": "0 9 * * 1", "tz": "UTC"},
                        "trigger_intent": "Every Monday at 9 AM",
                        "active": True,
                        "pending_approval": False,
                        "sandbox": False,
                        "version": 2,
                        "plan": [
                            {
                                "idx": 0,
                                "kind": "sql_query",
                                "label": "Query renewals",
                                "narration": "Finds invoices ending in the next 30 days.",
                                "sql": "SELECT * FROM legal.invoices",
                                "save_as": "expiring",
                            }
                        ],
                    }
                ]
            },
        },
    },
    "GET /api/workflows/wf-001": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "_id": "wf-001",
                "name": "Weekly Invoice Renewals Due",
                "trigger_kind": "cron",
                "trigger_spec": {"expr": "0 9 * * 1", "tz": "UTC"},
                "trigger_intent": "Every Monday at 9 AM",
                "active": True,
                "pending_approval": False,
                "sandbox": False,
                "version": 2,
                "next_run_at": "2026-08-17T09:00:00Z",
                "plan": [
                    {
                        "idx": 0,
                        "kind": "sql_query",
                        "label": "Query renewals",
                        "narration": "Finds invoices ending in the next 30 days.",
                        "sql": "SELECT * FROM legal.invoices",
                        "save_as": "expiring",
                    }
                ],
            },
        },
    },
    # ---- Files -----------------------------------------------------------
    # One search serves both halves of the drive: the grid reads `results`,
    # the tree reads `folders`. A `path` of "" is the type's own root — the
    # files on a invoice that were never put in a folder.
    "POST /attach/_search": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "results": [
                    {
                        "_id": "att-001",
                        "attachment_id": "att-001",
                        "namespace": "legal",
                        "record_type": "invoices",
                        "record_id": "lea-001",
                        "filename": "signed-invoice.pdf",
                        "content_type": "application/pdf",
                        "size_bytes": 284_113,
                        "version": 2,
                        "folder_path": "2026",
                        "created_at": "2026-01-04T09:12:00Z",
                        "processing_state": "indexed",
                        "matched_sources": ["keyword"],
                    }
                ],
                "total_matches": 5,
                "folders": [
                    {"namespace": "legal", "type": "invoices", "path": "", "count": 3},
                    {"namespace": "legal", "type": "invoices", "path": "2026", "count": 2},
                    {"namespace": "legal", "type": "court_calendar", "path": "photos", "count": 4},
                ],
            },
        },
    },
    "POST /attach/_bulk_delete": {
        "status": 200,
        "payload": {"ok": True, "data": {"deleted": 15, "skipped": 1, "remaining": 26}},
    },
    # Attaching a vault file to a record. `parents[0]` is the primary home; a
    # `copy` would leave the previous one alongside it.
    "POST /attach/legal/_relink": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "mode": "move",
                "parents": [
                    {"namespace": "legal", "typeName": "invoices", "recordId": "lea-001"}
                ],
            },
        },
    },
    "GET /attach/legal/invoices/lea-001": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "attachments": [
                    {
                        "attachment_id": "att-001",
                        "filename": "signed-invoice.pdf",
                        "content_type": "application/pdf",
                        "size": 284_113,
                        "version": 2,
                    }
                ]
            },
        },
    },
    "GET /attach/legal/invoices/lea-001/att-001/text": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {"text": "RESIDENTIAL LEASE AGREEMENT — 12 Marine Drive, Mumbai…"},
        },
    },
    "GET /attach/legal/invoices/lea-001/att-001/versions": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "versions": [
                    {
                        "version": 2,
                        "filename": "signed-invoice.pdf",
                        "size": 284_113,
                        "created_at": "2026-01-04T09:12:00Z",
                        "is_current": True,
                    },
                    {
                        "version": 1,
                        "filename": "draft-invoice.pdf",
                        "size": 210_004,
                        "created_at": "2025-12-19T14:02:00Z",
                        "is_current": False,
                    },
                ]
            },
        },
    },
    "GET /api/workflows/wf-001/versions": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "versions": [
                    {
                        "_id": "wf-001.v1",
                        "workflow_id": "wf-001",
                        "version": 1,
                        "name": "Weekly Invoice Renewals Due",
                        "trigger_intent": "Every Monday at 8 AM",
                        "plan": [{"idx": 0, "kind": "sql_query", "label": "Query renewals"}],
                        "created_at": "2026-07-01T00:00:00Z",
                    }
                ]
            },
        },
    },
    "GET /api/workflows/wf-001/versions/1": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "_id": "wf-001.v1",
                "workflow_id": "wf-001",
                "version": 1,
                "name": "Weekly Invoice Renewals Due",
                "trigger_intent": "Every Monday at 8 AM",
                "plan": [{"idx": 0, "kind": "sql_query", "label": "Query renewals", "narration": ""}],
                "created_at": "2026-07-01T00:00:00Z",
            },
        },
    },
    # Writes. A created workflow comes back inactive and awaiting approval —
    # the engine's decision, not the caller's — which is what this app's
    # "Never activated" state reads from.
    "POST /api/workflows": {
        "status": 201,
        "payload": {
            "ok": True,
            "data": {
                "_id": "wf-002",
                "name": "Contract check",
                "trigger_kind": "cron",
                "trigger_spec": {"expr": "0 9 * * 1", "tz": "UTC"},
                "trigger_intent": "Every Monday at 9 AM",
                "active": False,
                "pending_approval": True,
                "sandbox": True,
                "version": 1,
                "plan": [{"idx": 0, "kind": "sql_query", "label": "Count invoices"}],
            },
            "issues": [],
        },
    },
    "PUT /api/workflows/wf-001": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "_id": "wf-001",
                "name": "Weekly Invoice Renewals Due",
                "trigger_intent": "Every Monday at 10 AM",
                "active": True,
                "version": 3,
            },
            "issues": [],
        },
    },
    "POST /api/workflows/wf-001/activate": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "_id": "wf-001",
                "name": "Weekly Invoice Renewals Due",
                "active": True,
                "pending_approval": False,
                "sandbox": False,
            },
        },
    },
    "POST /api/workflows/wf-001/run": {
        "status": 201,
        "payload": {
            "ok": True,
            "data": {
                "event_id": "ev-001",
                "workflow_id": "wf-001",
                "status": "pending",
            },
        },
    },
    "DELETE /api/workflows/wf-001": {
        "status": 200,
        "payload": {"ok": True, "data": {"deleted": "wf-001"}},
    },
    "GET /api/workflows/runs": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "runs": [
                    {
                        "_id": "run-001",
                        "workflow_id": "wf-001",
                        "status": "success",
                        "started_at": "2026-08-03T06:00:00Z",
                        "ended_at": "2026-08-03T06:00:07Z",
                        "error": None,
                    }
                ]
            },
        },
    },
    # One run's timeline. The engine writes a `tool_call` before a step runs and
    # a `tool_result` after, both at the plan step's own `idx` — so the SQL as
    # it was actually issued sits next to what it returned. The baseline keeps
    # that pairing because the UI reads the two together.
    "GET /api/workflows/runs/run-001": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "run": {
                    "_id": "run-001",
                    "workflow_id": "wf-001",
                    "status": "success",
                    "started_at": "2026-08-03T06:00:00Z",
                    "ended_at": "2026-08-03T06:00:07Z",
                    "error": None,
                    "sandbox": False,
                },
                "steps": [
                    {
                        "_id": "rs-001",
                        "run_id": "run-001",
                        "idx": 0,
                        "role": "tool_call",
                        "created_at": "2026-08-03T06:00:01Z",
                        "content": "[Query renewals] Invoices expiring in the next 30 days.",
                        "tool_name": "sql_query",
                        "tool_args": {
                            "sql": "SELECT _id FROM legal.invoices WHERE end_date < '2026-09-02'"
                        },
                        "tool_result": None,
                    },
                    {
                        "_id": "rs-002",
                        "run_id": "run-001",
                        "idx": 0,
                        "role": "tool_result",
                        "created_at": "2026-08-03T06:00:03Z",
                        "content": "",
                        "tool_name": "sql_query",
                        "tool_args": None,
                        "tool_result": [{"_id": "invoice-001"}],
                    },
                ],
            },
        },
    },
    # The inbox. One parked decision and one bell, because the difference —
    # actions present or absent — is what the whole surface keys off.
    "GET /api/workflows/notifications": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "notifications": [
                    {
                        "_id": "notif-001",
                        "title": "Assign a contractor: kitchen tap dripping",
                        "body": "<p><strong>Recommended:</strong> Coastal Plumbing</p>",
                        "actions": [
                            {"id": "approve", "label": "Assign the recommended contractor", "kind": "approve"},
                            {"id": "decline", "label": "Not now", "kind": "decline"},
                        ],
                        "workflow_id": "wf-001",
                        "run_id": "run-001",
                        "step_idx": 6,
                        "created_at": "2026-08-11T06:42:00Z",
                        "read_at": None,
                        "resolved_action": None,
                    },
                    {
                        "_id": "notif-002",
                        "title": "Weekly renewals digest sent",
                        "body": "4 renewals are due in the next 30 days.",
                        "actions": [],
                        "workflow_id": "wf-001",
                        "run_id": "run-001",
                        "created_at": "2026-08-10T08:00:00Z",
                        "read_at": "2026-08-10T09:15:00Z",
                        "resolved_action": None,
                    },
                ]
            },
        },
    },
    "GET /api/workflows/notifications/notif-001": {
        "status": 200,
        "payload": {
            "ok": True,
            "data": {
                "_id": "notif-001",
                "title": "Assign a contractor: kitchen tap dripping",
                "body": "<p><strong>Recommended:</strong> Coastal Plumbing</p>",
                "actions": [
                    {"id": "approve", "label": "Assign the recommended contractor", "kind": "approve"},
                    {"id": "decline", "label": "Not now", "kind": "decline"},
                ],
                "workflow_id": "wf-001",
                "run_id": "run-001",
                "created_at": "2026-08-11T06:42:00Z",
                "read_at": None,
                "resolved_action": None,
            },
        },
    },
    # Analyze. `/ai/config` really does return the provider's masked key and
    # gateway URL; it is reproduced here so the offline baseline exercises the
    # same trimming the live one does — the app must forward neither.
    "GET /ai/config": {
        "status": 200,
        "payload": {
            "configured": True,
            "maskedKey": "2BVN...GchL",
            "baseUrl": "http://ai-gateway.inventdb.local:4300/anthropic/v1",
            "model": "claude-sonnet-5",
            "modelFamily": "claude",
        },
    },
    "GET /ai/models": {
        "status": 200,
        "payload": [
            {
                "id": "claude-sonnet-5",
                "key": "claude-sonnet-5",
                "name": "claude-sonnet-5 (active - current default)",
                "provider": "anthropic",
                "family": "Claude",
                "display": "Claude Sonnet 5",
                "is_reasoning": True,
                "is_active": True,
            },
            {
                "id": "claude-opus-4-8",
                "key": "claude-opus-4-8",
                "name": "Claude - Claude Opus 4.8",
                "provider": "anthropic",
                "family": "Claude",
                "display": "Claude Opus 4.8",
                "is_reasoning": True,
                "is_active": False,
            },
        ],
    },
    "GET /ai/threads": {
        "status": 200,
        "payload": {
            "ok": True,
            "threads": [
                {
                    "_id": "soar_thread-001",
                    "user_id": "user-001",
                    "label": "Unbilled time by practice area",
                    "created": "2026-08-01T09:00:00.000Z",
                    "_exchanges": [
                        {
                            "question": "Unbilled time by practice area",
                            "answer": "Business litigation carries $48,200 of unbilled work.",
                            "ts": "2026-08-01T09:00:04.000Z",
                            "artifacts": [],
                            "steps": [],
                        }
                    ],
                }
            ],
        },
    },
    # An instance where the gate has been turned on. Two `false`s would satisfy
    # the shape check while proving nothing forwards, and the suite's
    # "endpoints that return data actually returned some" rule rightly rejects
    # an all-falsy body.
    # One stored AI snapshot and the `.source.html` behind it — the pair the
    # studio has to collapse into a single library row.
    "GET /attach/_System/AIReports/report_1/att-1/download": {
        "status": 200,
        "payload": None,
    },
    "GET /api/websearch/status": {
        "status": 200,
        "payload": {"enabled": True, "consented": True, "consented_at": 1786083054},
    },
}

_SYNTHETIC_SQL: dict[str, list[dict[str, Any]]] = {
    "SELECT * FROM legal.clients LIMIT 200": [{'_id': 'own-001', 'client_id': 'O-001', 'name': 'Acme Holdings'},
         {'_id': 'own-002', 'client_id': 'O-002', 'name': 'Vista Trust'}],
    "SELECT * FROM legal.invoices LIMIT 5000": [{'_id': 'invoice-001',
          'invoice_no': 'L-001',
          'tenant_name': 'Asha Rao',
          'matter_id': 'P-001',
          'status': 'Active',
          'invoice_total': 2750,
          'issue_date': '2024-01-01',
          'lease_end': '2026-12-31',
          'renewal_type': 'Auto'}],
    "SELECT * FROM legal.matters LIMIT 5000": [{'_id': 'rec-001',
          'matter_id': 'P-001',
          'matter_caption': '12 Marine Drive',
          'client_name': 'Mumbai',
          'state': 'MH',
          'zip': '400020',
          'region': 'West',
          'client_id': 'O-001',
          'type': 'Condo',
          'status': 'Occupied',
          'beds': 3,
          'baths': 2,
          'sqft': 1450,
          'year_built': 2011},
         {'_id': 'rec-002',
          'matter_id': 'P-002',
          'matter_caption': '9 Park Lane',
          'client_name': 'Delhi',
          'state': 'DL',
          'zip': '110001',
          'region': 'North',
          'client_id': 'O-002',
          'type': 'Apartment',
          'status': 'Vacant',
          'beds': 2,
          'baths': 1,
          'sqft': 980,
          'year_built': 2004}],
    "SELECT * FROM legal.matters ORDER BY date_opened ASC LIMIT 1 OFFSET 0": [{'matter_id': 'MT-2978',
          'client_id': 'CL-1932',
          'client_name': 'Sadeghi, Nasrin',
          'matter_caption': 'Sadeghi v. Casa Bonita (WCAB)',
          'practice_area': 'Workers Compensation',
          'matter_type': 'Workers Compensation Claim (WCAB)',
          'fee_model': 'Statutory Contingency - WCAB',
          'fee_terms': 'Attorney fee of 15% of the award or compromise and release, subject to '
                       "approval by the Workers' Compensation Appeals Board under Lab. Code "
                       '4906. No fee unless benefits are recovered.',
          'contingency_pre_suit': 0.15,
          'contingency_post_filing': 0.15,
          'volume_discount': 0,
          'trust_required': True,
          'court': "Workers' Compensation Appeals Board, Los Angeles District Office",
          'court_short': 'WCAB Los Angeles',
          'case_number': 'ADJ18941560',
          'judicial_officer': 'WCJ Estevan Ruvalcaba',
          'department': 'Hearing Room F',
          'date_opened': '2024-09-02',
          'date_filed': '2024-09-19',
          'incident_trigger_date': '2024-05-15',
          'limitations_authority': 'Lab. Code 5405 (1 yr)',
          'limitations_date': '2025-05-15',
          'opposing_party': 'Casa Bonita Restaurant Holdings, LLC',
          'opposing_counsel': 'The Ferrante Law Group, APC',
          'insurance_carrier': 'Zenith Insurance Company',
          'claim_number': 'WC-159377',
          'responsible_attorney': 'TK-14',
          'responsible_attorney_name': 'Yusuf Karimi',
          'originating_attorney': 'TK-09',
          'paralegal': 'TK-19',
          'status': 'Open',
          'stage': 'Compromise and Release',
          'pro_bono': False,
          'fee_agreement_date': '2024-09-08',
          'recorded_hours': 31.9,
          'recorded_value_at_standard_rates': 7410.8,
          'costs_advanced': 4840.77,
          'fees_billed': 0,
          'collected': 0,
          'trust_balance': 0,
          'next_court_date': '2026-09-20',
          '_id': '3bdbd3cb-1cb4-4d42-a648-4610974d0c80',
          '_createdAt': '2026-08-20T11:17:26.566184617+00:00',
          '_updatedAt': '2026-08-20T11:17:26.566184617+00:00'}],
    "SELECT * FROM legal.matters ORDER BY date_opened ASC LIMIT 500 OFFSET 0": [{'matter_id': 'MT-2978',
          'client_id': 'CL-1932',
          'client_name': 'Sadeghi, Nasrin',
          'matter_caption': 'Sadeghi v. Casa Bonita (WCAB)',
          'practice_area': 'Workers Compensation',
          'matter_type': 'Workers Compensation Claim (WCAB)',
          'fee_model': 'Statutory Contingency - WCAB',
          'fee_terms': 'Attorney fee of 15% of the award or compromise and release, subject to '
                       "approval by the Workers' Compensation Appeals Board under Lab. Code "
                       '4906. No fee unless benefits are recovered.',
          'contingency_pre_suit': 0.15,
          'contingency_post_filing': 0.15,
          'volume_discount': 0,
          'trust_required': True,
          'court': "Workers' Compensation Appeals Board, Los Angeles District Office",
          'court_short': 'WCAB Los Angeles',
          'case_number': 'ADJ18941560',
          'judicial_officer': 'WCJ Estevan Ruvalcaba',
          'department': 'Hearing Room F',
          'date_opened': '2024-09-02',
          'date_filed': '2024-09-19',
          'incident_trigger_date': '2024-05-15',
          'limitations_authority': 'Lab. Code 5405 (1 yr)',
          'limitations_date': '2025-05-15',
          'opposing_party': 'Casa Bonita Restaurant Holdings, LLC',
          'opposing_counsel': 'The Ferrante Law Group, APC',
          'insurance_carrier': 'Zenith Insurance Company',
          'claim_number': 'WC-159377',
          'responsible_attorney': 'TK-14',
          'responsible_attorney_name': 'Yusuf Karimi',
          'originating_attorney': 'TK-09',
          'paralegal': 'TK-19',
          'status': 'Open',
          'stage': 'Compromise and Release',
          'pro_bono': False,
          'fee_agreement_date': '2024-09-08',
          'recorded_hours': 31.9,
          'recorded_value_at_standard_rates': 7410.8,
          'costs_advanced': 4840.77,
          'fees_billed': 0,
          'collected': 0,
          'trust_balance': 0,
          'next_court_date': '2026-09-20',
          '_id': '3bdbd3cb-1cb4-4d42-a648-4610974d0c80',
          '_createdAt': '2026-08-20T11:17:26.566184617+00:00',
          '_updatedAt': '2026-08-20T11:17:26.566184617+00:00'},
         {'matter_id': 'MT-2203',
          'client_id': 'CL-1196',
          'client_name': 'Cisneros, Carlos',
          'matter_caption': 'Cisneros v. Bautista',
          'practice_area': 'Personal Injury',
          'matter_type': 'Pedestrian Collision',
          'fee_model': 'Contingency',
          'fee_terms': '33 1/3% if resolved before complaint filed; 40% thereafter. Costs '
                       'advanced by firm, reimbursed from recovery.',
          'contingency_pre_suit': 0.3333,
          'contingency_post_filing': 0.4,
          'volume_discount': 0,
          'trust_required': True,
          'court': 'Los Angeles Superior Court - Stanley Mosk Courthouse',
          'court_short': 'LASC Stanley Mosk',
          'case_number': '25STCV03167',
          'judicial_officer': 'Hon. Priscilla Yee-Barron',
          'department': 'Dept. 46',
          'date_opened': '2024-09-02',
          'date_filed': '2025-09-21',
          'incident_trigger_date': '2024-08-22',
          'limitations_authority': 'CCP 335.1 (2 yrs)',
          'limitations_date': '2026-08-22',
          'opposing_party': 'Marilou Bautista',
          'opposing_counsel': 'Stanfill & Ekwueme LLP',
          'insurance_carrier': 'State Farm Mutual',
          'claim_number': '58-924052-B',
          'responsible_attorney': 'TK-01',
          'responsible_attorney_name': 'Marisol Alvarado',
          'originating_attorney': 'TK-10',
          'paralegal': 'TK-18',
          'status': 'Closed',
          'stage': 'Settled - Disbursing',
          'date_closed': '2025-12-02',
          'disposition': 'Settled at mediation',
          'pro_bono': False,
          'fee_agreement_date': '2024-09-04',
          'recorded_hours': 73.5,
          'recorded_value_at_standard_rates': 23402.2,
          'costs_advanced': 2767.33,
          'fees_billed': 0,
          'collected': 43887.33,
          'trust_balance': 0,
          '_id': 'a3aadf90-170b-4a45-9ed5-41f0b21d8940',
          '_createdAt': '2026-08-20T11:17:25.649426575+00:00',
          '_updatedAt': '2026-08-20T11:17:25.649426575+00:00'},
         {'matter_id': 'MT-2605',
          'client_id': 'CL-1574',
          'client_name': 'Duvall, Gregory',
          'matter_caption': 'Duvall v. Alhambra Medical (WCAB)',
          'practice_area': 'Workers Compensation',
          'matter_type': 'Workers Compensation Claim (WCAB)',
          'fee_model': 'Statutory Contingency - WCAB',
          'fee_terms': 'Attorney fee of 15% of the award or compromise and release, subject to '
                       "approval by the Workers' Compensation Appeals Board under Lab. Code "
                       '4906. No fee unless benefits are recovered.',
          'contingency_pre_suit': 0.15,
          'contingency_post_filing': 0.15,
          'volume_discount': 0,
          'trust_required': True,
          'court': "Workers' Compensation Appeals Board, Los Angeles District Office",
          'court_short': 'WCAB Los Angeles',
          'case_number': 'ADJ18686300',
          'judicial_officer': 'WCJ Carla Duong',
          'department': 'Hearing Room C',
          'date_opened': '2024-09-02',
          'date_filed': '2024-09-22',
          'incident_trigger_date': '2024-07-07',
          'limitations_authority': 'Lab. Code 5405 (1 yr)',
          'limitations_date': '2025-07-07',
          'opposing_party': 'Alhambra Medical Billing Solutions, LLC',
          'opposing_counsel': 'Marchetti Bankruptcy Group, APC',
          'insurance_carrier': 'Zenith Insurance Company',
          'claim_number': 'WC-398823',
          'responsible_attorney': 'TK-14',
          'responsible_attorney_name': 'Yusuf Karimi',
          'originating_attorney': 'TK-14',
          'paralegal': 'TK-19',
          'status': 'Closed',
          'stage': 'Compromise and Release',
          'date_closed': '2026-08-02',
          'disposition': 'Findings and award after trial',
          'pro_bono': False,
          'fee_agreement_date': '2024-09-03',
          'recorded_hours': 19.3,
          'recorded_value_at_standard_rates': 4073.6,
          'costs_advanced': 4348.78,
          'fees_billed': 0,
          'collected': 23443.78,
          'trust_balance': 0,
          '_id': 'e84e8b25-23ed-4137-a154-45a5024d7e41',
          '_createdAt': '2026-08-20T11:17:26.566184617+00:00',
          '_updatedAt': '2026-08-20T11:17:26.566184617+00:00'}],
    "SELECT * FROM legal.matters ORDER BY matter_caption ASC LIMIT 500 OFFSET 0": [{'_id': 'rec-001',
          'matter_id': 'P-001',
          'matter_caption': '12 Marine Drive',
          'client_name': 'Mumbai',
          'state': 'MH',
          'zip': '400020',
          'region': 'West',
          'client_id': 'O-001',
          'type': 'Condo',
          'status': 'Occupied',
          'beds': 3,
          'baths': 2,
          'sqft': 1450,
          'year_built': 2011},
         {'_id': 'rec-002',
          'matter_id': 'P-002',
          'matter_caption': '9 Park Lane',
          'client_name': 'Delhi',
          'state': 'DL',
          'zip': '110001',
          'region': 'North',
          'client_id': 'O-002',
          'type': 'Apartment',
          'status': 'Vacant',
          'beds': 2,
          'baths': 1,
          'sqft': 980,
          'year_built': 2004}],
    "SELECT * FROM legal.matters ORDER BY matter_caption ASC LIMIT 5000": [{'_id': 'rec-001',
          'matter_id': 'P-001',
          'matter_caption': '12 Marine Drive',
          'client_name': 'Mumbai',
          'state': 'MH',
          'zip': '400020',
          'region': 'West',
          'client_id': 'O-001',
          'type': 'Condo',
          'status': 'Occupied',
          'beds': 3,
          'baths': 2,
          'sqft': 1450,
          'year_built': 2011},
         {'_id': 'rec-002',
          'matter_id': 'P-002',
          'matter_caption': '9 Park Lane',
          'client_name': 'Delhi',
          'state': 'DL',
          'zip': '110001',
          'region': 'North',
          'client_id': 'O-002',
          'type': 'Apartment',
          'status': 'Vacant',
          'beds': 2,
          'baths': 1,
          'sqft': 980,
          'year_built': 2004}],
    "SELECT * FROM legal.matters WHERE (matter_id LIKE '%a%' ESCAPE '\\' OR matter_caption LIKE '%a%' ESCAPE '\\' OR client_name LIKE '%a%' ESCAPE '\\' OR client_id LIKE '%a%' ESCAPE '\\' OR practice_area LIKE '%a%' ESCAPE '\\' OR matter_type LIKE '%a%' ESCAPE '\\' OR case_number LIKE '%a%' ESCAPE '\\' OR status LIKE '%a%' ESCAPE '\\' OR stage LIKE '%a%' ESCAPE '\\' OR court_short LIKE '%a%' ESCAPE '\\' OR responsible_attorney_name LIKE '%a%' ESCAPE '\\' OR opposing_party LIKE '%a%' ESCAPE '\\' OR opposing_counsel LIKE '%a%' ESCAPE '\\') ORDER BY date_opened ASC LIMIT 5 OFFSET 0": [{'matter_id': 'MT-2203',
          'client_id': 'CL-1196',
          'client_name': 'Cisneros, Carlos',
          'matter_caption': 'Cisneros v. Bautista',
          'practice_area': 'Personal Injury',
          'matter_type': 'Pedestrian Collision',
          'fee_model': 'Contingency',
          'fee_terms': '33 1/3% if resolved before complaint filed; 40% thereafter. Costs '
                       'advanced by firm, reimbursed from recovery.',
          'contingency_pre_suit': 0.3333,
          'contingency_post_filing': 0.4,
          'volume_discount': 0,
          'trust_required': True,
          'court': 'Los Angeles Superior Court - Stanley Mosk Courthouse',
          'court_short': 'LASC Stanley Mosk',
          'case_number': '25STCV03167',
          'judicial_officer': 'Hon. Priscilla Yee-Barron',
          'department': 'Dept. 46',
          'date_opened': '2024-09-02',
          'date_filed': '2025-09-21',
          'incident_trigger_date': '2024-08-22',
          'limitations_authority': 'CCP 335.1 (2 yrs)',
          'limitations_date': '2026-08-22',
          'opposing_party': 'Marilou Bautista',
          'opposing_counsel': 'Stanfill & Ekwueme LLP',
          'insurance_carrier': 'State Farm Mutual',
          'claim_number': '58-924052-B',
          'responsible_attorney': 'TK-01',
          'responsible_attorney_name': 'Marisol Alvarado',
          'originating_attorney': 'TK-10',
          'paralegal': 'TK-18',
          'status': 'Closed',
          'stage': 'Settled - Disbursing',
          'date_closed': '2025-12-02',
          'disposition': 'Settled at mediation',
          'pro_bono': False,
          'fee_agreement_date': '2024-09-04',
          'recorded_hours': 73.5,
          'recorded_value_at_standard_rates': 23402.2,
          'costs_advanced': 2767.33,
          'fees_billed': 0,
          'collected': 43887.33,
          'trust_balance': 0,
          '_id': 'a3aadf90-170b-4a45-9ed5-41f0b21d8940',
          '_createdAt': '2026-08-20T11:17:25.649426575+00:00',
          '_updatedAt': '2026-08-20T11:17:25.649426575+00:00'},
         {'matter_id': 'MT-2605',
          'client_id': 'CL-1574',
          'client_name': 'Duvall, Gregory',
          'matter_caption': 'Duvall v. Alhambra Medical (WCAB)',
          'practice_area': 'Workers Compensation',
          'matter_type': 'Workers Compensation Claim (WCAB)',
          'fee_model': 'Statutory Contingency - WCAB',
          'fee_terms': 'Attorney fee of 15% of the award or compromise and release, subject to '
                       "approval by the Workers' Compensation Appeals Board under Lab. Code "
                       '4906. No fee unless benefits are recovered.',
          'contingency_pre_suit': 0.15,
          'contingency_post_filing': 0.15,
          'volume_discount': 0,
          'trust_required': True,
          'court': "Workers' Compensation Appeals Board, Los Angeles District Office",
          'court_short': 'WCAB Los Angeles',
          'case_number': 'ADJ18686300',
          'judicial_officer': 'WCJ Carla Duong',
          'department': 'Hearing Room C',
          'date_opened': '2024-09-02',
          'date_filed': '2024-09-22',
          'incident_trigger_date': '2024-07-07',
          'limitations_authority': 'Lab. Code 5405 (1 yr)',
          'limitations_date': '2025-07-07',
          'opposing_party': 'Alhambra Medical Billing Solutions, LLC',
          'opposing_counsel': 'Marchetti Bankruptcy Group, APC',
          'insurance_carrier': 'Zenith Insurance Company',
          'claim_number': 'WC-398823',
          'responsible_attorney': 'TK-14',
          'responsible_attorney_name': 'Yusuf Karimi',
          'originating_attorney': 'TK-14',
          'paralegal': 'TK-19',
          'status': 'Closed',
          'stage': 'Compromise and Release',
          'date_closed': '2026-08-02',
          'disposition': 'Findings and award after trial',
          'pro_bono': False,
          'fee_agreement_date': '2024-09-03',
          'recorded_hours': 19.3,
          'recorded_value_at_standard_rates': 4073.6,
          'costs_advanced': 4348.78,
          'fees_billed': 0,
          'collected': 23443.78,
          'trust_balance': 0,
          '_id': 'e84e8b25-23ed-4137-a154-45a5024d7e41',
          '_createdAt': '2026-08-20T11:17:26.566184617+00:00',
          '_updatedAt': '2026-08-20T11:17:26.566184617+00:00'},
         {'matter_id': 'MT-2978',
          'client_id': 'CL-1932',
          'client_name': 'Sadeghi, Nasrin',
          'matter_caption': 'Sadeghi v. Casa Bonita (WCAB)',
          'practice_area': 'Workers Compensation',
          'matter_type': 'Workers Compensation Claim (WCAB)',
          'fee_model': 'Statutory Contingency - WCAB',
          'fee_terms': 'Attorney fee of 15% of the award or compromise and release, subject to '
                       "approval by the Workers' Compensation Appeals Board under Lab. Code "
                       '4906. No fee unless benefits are recovered.',
          'contingency_pre_suit': 0.15,
          'contingency_post_filing': 0.15,
          'volume_discount': 0,
          'trust_required': True,
          'court': "Workers' Compensation Appeals Board, Los Angeles District Office",
          'court_short': 'WCAB Los Angeles',
          'case_number': 'ADJ18941560',
          'judicial_officer': 'WCJ Estevan Ruvalcaba',
          'department': 'Hearing Room F',
          'date_opened': '2024-09-02',
          'date_filed': '2024-09-19',
          'incident_trigger_date': '2024-05-15',
          'limitations_authority': 'Lab. Code 5405 (1 yr)',
          'limitations_date': '2025-05-15',
          'opposing_party': 'Casa Bonita Restaurant Holdings, LLC',
          'opposing_counsel': 'The Ferrante Law Group, APC',
          'insurance_carrier': 'Zenith Insurance Company',
          'claim_number': 'WC-159377',
          'responsible_attorney': 'TK-14',
          'responsible_attorney_name': 'Yusuf Karimi',
          'originating_attorney': 'TK-09',
          'paralegal': 'TK-19',
          'status': 'Open',
          'stage': 'Compromise and Release',
          'pro_bono': False,
          'fee_agreement_date': '2024-09-08',
          'recorded_hours': 31.9,
          'recorded_value_at_standard_rates': 7410.8,
          'costs_advanced': 4840.77,
          'fees_billed': 0,
          'collected': 0,
          'trust_balance': 0,
          'next_court_date': '2026-09-20',
          '_id': '3bdbd3cb-1cb4-4d42-a648-4610974d0c80',
          '_createdAt': '2026-08-20T11:17:26.566184617+00:00',
          '_updatedAt': '2026-08-20T11:17:26.566184617+00:00'}],
    "SELECT * FROM legal.payments_and_receipts LIMIT 5000": [{'_id': 'tx-001',
          'reference': 'TX-001',
          'type': 'Income',
          'expense_category': 'Rent',
          'amount': 2500,
          'date': '2026-08-01'},
         {'_id': 'tx-002',
          'reference': 'TX-002',
          'type': 'Expense',
          'expense_category': 'Repairs',
          'amount': 320,
          'date': '2026-08-04'}],
    "SELECT * FROM legal.time_entries LIMIT 5000": [{'_id': 'wo-001',
          'wo': 'WO-001',
          'status': 'Open',
          'priority': 'High',
          'category': 'HVAC',
          'hours': 450}],
    "SELECT * FROM legal.timekeepers LIMIT 5000": [{'_id': 'ten-001', 'timekeeper_id': 'T-001', 'first': 'Asha', 'last': 'Rao'}],
    "SELECT COUNT(*) AS c FROM legal.clients": [{'c': 1239}],
    "SELECT COUNT(*) AS c FROM legal.clients WHERE lower(status) = 'active'": [{'c': 707}],
    "SELECT COUNT(*) AS c FROM legal.court_calendar WHERE date >= '<date>' AND date <= '<date>'": [{'c': 186}],
    "SELECT COUNT(*) AS c FROM legal.deadlines_and_sol": [{'c': 3750}],
    "SELECT COUNT(*) AS c FROM legal.deadlines_and_sol WHERE lower(status) = 'open'": [{'c': 804}],
    "SELECT COUNT(*) AS c FROM legal.deadlines_and_sol WHERE lower(status) = 'open' AND due_date < '<date>'": [{'c': 39}],
    "SELECT COUNT(*) AS c FROM legal.deadlines_and_sol WHERE lower(status) = 'open' AND due_date >= '<date>' AND due_date <= '<date>'": [{'c': 163}],
    "SELECT COUNT(*) AS c FROM legal.matters": [{'c': 1300}],
    "SELECT COUNT(*) AS c FROM legal.matters WHERE (matter_id LIKE '%a%' ESCAPE '\\' OR matter_caption LIKE '%a%' ESCAPE '\\' OR client_name LIKE '%a%' ESCAPE '\\' OR client_id LIKE '%a%' ESCAPE '\\' OR practice_area LIKE '%a%' ESCAPE '\\' OR matter_type LIKE '%a%' ESCAPE '\\' OR case_number LIKE '%a%' ESCAPE '\\' OR status LIKE '%a%' ESCAPE '\\' OR stage LIKE '%a%' ESCAPE '\\' OR court_short LIKE '%a%' ESCAPE '\\' OR responsible_attorney_name LIKE '%a%' ESCAPE '\\' OR opposing_party LIKE '%a%' ESCAPE '\\' OR opposing_counsel LIKE '%a%' ESCAPE '\\')": [{'c': 1300}],
    "SELECT COUNT(*) AS c FROM legal.matters WHERE lower(status) = 'closed'": [{'c': 570}],
    "SELECT COUNT(*) AS c FROM legal.matters WHERE lower(status) = 'open'": [{'c': 730}],
    "SELECT COUNT(*) AS c FROM legal.time_entries": [{'c': 34269}],
    "SELECT SUM(amount) AS t FROM legal.costs_and_disbursements": [{'t': 2085052.699999993}],
    "SELECT SUM(amount) AS t FROM legal.payments_and_receipts WHERE lower(deposited_to) = 'operating'": [{'t': 10094497.459999964}],
    "SELECT SUM(amount) AS t FROM legal.payments_and_receipts WHERE lower(deposited_to) = 'operating' AND YEAR(date) = 2026 AND MONTH(date) = 8": [{'t': 849291.9299999997}],
    "SELECT SUM(amount_in) AS t FROM legal.trust_ledger_cta": [{'t': 15562000.0}],
    "SELECT SUM(amount_out) AS t FROM legal.trust_ledger_cta": [{'t': 14293098.370000008}],
    "SELECT SUM(balance_due) AS t FROM legal.invoices WHERE lower(status) != 'paid'": [{'t': 778108.56}],
    "SELECT SUM(hours) AS h FROM legal.time_entries WHERE YEAR(date) = 2026 AND MONTH(date) = 8": [{'h': 1826.6000000000022}],
    "SELECT SUM(hours) AS h FROM legal.time_entries WHERE billed = false AND billable = true": [{'h': 773.2999999999997}],
    "SELECT SUM(hours) AS total FROM legal.time_entries WHERE lower(status) != 'completed'": [{'total': 450}],
    "SELECT SUM(invoice_total) AS t FROM legal.invoices": [{'t': 7699677.709999994}],
    "SELECT SUM(invoice_total) AS t FROM legal.invoices WHERE YEAR(issue_date) = 2026 AND MONTH(issue_date) = 8": [{'t': 528362.0}],
    "SELECT SUM(value_at_standard_rates) AS t FROM legal.time_entries WHERE billed = false AND billable = true": [{'t': 300639.5}],
    "SELECT SUM(value_at_standard_rates) AS v FROM legal.time_entries WHERE billed = false AND billable = true": [{'v': 300639.5}],
    "SELECT SUM(write_downs) AS t FROM legal.invoices": [{'t': 271305.62}],
    "SELECT YEAR(date) AS y, MONTH(date) AS m, deposited_to, SUM(amount) AS total FROM legal.payments_and_receipts GROUP BY y, m, deposited_to": [{'y': 2026, 'm': 5, 'deposited_to': 'Trust', 'total': 972750.0100000001},
         {'y': 2025, 'm': 3, 'deposited_to': 'Trust', 'total': 207641.63999999996},
         {'y': 2025, 'm': 5, 'deposited_to': 'Trust', 'total': 214291.66999999998}],
    "SELECT YEAR(issue_date) AS y, MONTH(issue_date) AS m, SUM(invoice_total) AS total FROM legal.invoices GROUP BY y, m": [{'y': 2024, 'm': 9, 'total': 2500.0},
         {'y': 2026, 'm': 6, 'total': 546006.3400000002},
         {'y': 2026, 'm': 7, 'total': 623533.2200000001}],
    "SELECT _id, record_id, filename, description, content_type, tags, created_at FROM _System._attachments WHERE record_type = 'AIReports' ORDER BY created_at DESC LIMIT 500": [{'_id': 'att-1',
          'record_id': 'report_1',
          'filename': 'AR_Aging_20260811_055342.html',
          'description': 'AI-generated report: AR Aging (2026-08-11 05:53)',
          'content_type': 'text/html',
          'tags': ['ai-report', 'auto-generated'],
          'created_at': '2026-08-11T05:53:42Z'},
         {'_id': 'att-2',
          'record_id': 'report_1',
          'filename': 'AR_Aging_20260811_055342.source.html',
          'description': 'Source HTML for AI report: AR Aging',
          'content_type': 'text/html',
          'tags': ['ai-report-source', 'auto-generated'],
          'created_at': '2026-08-11T05:53:42Z'}],
    "SELECT activity_description, COUNT(*) AS value FROM legal.time_entries GROUP BY activity_description ORDER BY value DESC": [{'activity_description': 'communicate (with client)', 'value': 10076},
         {'activity_description': 'manage data/files', 'value': 5789},
         {'activity_description': 'communicate (in firm)', 'value': 3866}],
    "SELECT aging_bucket, COUNT(*) AS n, SUM(balance_due) AS value FROM legal.invoices GROUP BY aging_bucket ORDER BY value DESC": [{'aging_bucket': 'current (not yet due)', 'n': 144, 'value': 326320.65999999986},
         {'aging_bucket': 'over 120 days', 'n': 184, 'value': 216788.18000000002},
         {'aging_bucket': '1-30 days', 'n': 55, 'value': 93851.3}],
    "SELECT aging_bucket, SUM(balance_due) AS value FROM legal.invoices GROUP BY aging_bucket ORDER BY value DESC": [{'aging_bucket': 'current (not yet due)', 'value': 326320.65999999986},
         {'aging_bucket': 'over 120 days', 'value': 216788.18000000002},
         {'aging_bucket': '1-30 days', 'value': 93851.3}],
    "SELECT category, COUNT(*) AS value FROM legal.time_entries GROUP BY category ORDER BY value DESC": [{'category': 'hvac', 'value': 1}],
    "SELECT deadline_id, matter_id, matter_caption, description, category, authority, due_date, days_remaining, priority, owner_name, status FROM legal.deadlines_and_sol WHERE lower(status) = 'open' AND due_date <= '<date>' ORDER BY due_date ASC": [{'deadline_id': 'DL-07952',
          'matter_id': 'MT-2792',
          'matter_caption': 'Salgado v. Tolentino',
          'description': 'Response to complaint due',
          'category': 'Pleading',
          'authority': 'CCP 412.20(a)(3); CCP 430.40(a)',
          'due_date': '2026-08-19',
          'days_remaining': 1,
          'priority': 'High',
          'owner_name': 'Farid Nazarian',
          'status': 'Open'},
         {'deadline_id': 'DL-07947',
          'matter_id': 'MT-2063',
          'matter_caption': 'Barajas v. Bright Path (Appeal)',
          'description': 'Designation of the record on appeal',
          'category': 'Court Filing',
          'authority': 'Cal. Rules of Court 8.121(a)',
          'due_date': '2026-08-19',
          'days_remaining': 1,
          'priority': 'Critical',
          'owner_name': 'Devon Blackwood',
          'status': 'Open'},
         {'deadline_id': 'DL-07948',
          'matter_id': 'MT-2208',
          'matter_caption': 'In re Stanfill',
          'description': 'Credit counselling certificate to be filed',
          'category': 'Court Filing',
          'authority': '11 U.S.C. 109(h)',
          'due_date': '2026-08-19',
          'days_remaining': 1,
          'priority': 'Critical',
          'owner_name': 'Wei-Lin Chen',
          'status': 'Open'}],
    "SELECT expense_category, SUM(amount) AS value FROM legal.costs_and_disbursements GROUP BY expense_category ORDER BY value DESC": [{'expense_category': 'experts', 'value': 417021.86000000004},
         {'expense_category': 'court fees', 'value': 395514.31999999995},
         {'expense_category': 'other', 'value': 252828.36999999994}],
    "SELECT matter_id, SUM(hours) AS hours, SUM(value_at_standard_rates) AS value, COUNT(*) AS entries FROM legal.time_entries WHERE billed = false AND billable = true GROUP BY matter_id ORDER BY value DESC": [{'matter_id': 'mt-2479', 'entries': 15, 'hours': 28.499999999999996, 'value': 13356.5},
         {'matter_id': 'mt-2074', 'entries': 14, 'hours': 26.9, 'value': 11521.0},
         {'matter_id': 'mt-2092', 'entries': 16, 'hours': 23.999999999999996, 'value': 10257.5}],
    "SELECT matter_id, client_name, matter_ledger_balance, date FROM legal.trust_ledger_cta WHERE matter_ledger_balance < 0 ORDER BY matter_ledger_balance ASC": [],
    "SELECT matter_id, matter_caption, practice_area, client_name, responsible_attorney_name, status FROM legal.matters WHERE matter_id IN ('MT-2479', 'MT-2074', 'MT-2092')": [],
    "SELECT matter_id, matter_caption, practice_area, client_name, responsible_attorney_name, status FROM legal.matters WHERE matter_id IN ('MT-2479', 'MT-2074', 'MT-2092', 'MT-2063', 'MT-2344', 'MT-2920', 'MT-2349', 'MT-2778', 'MT-2246', 'MT-2801', 'MT-2035', 'MT-2597', 'MT-3083', 'MT-2646', 'MT-2788', 'MT-2191', 'MT-3024', 'MT-2307', 'MT-2671', 'MT-2641', 'MT-2392', 'MT-2477', 'MT-2233', 'MT-3001', 'MT-3231', 'MT-2123', 'MT-2885', 'MT-3173', 'MT-3089', 'MT-2321', 'MT-2600', 'MT-2251', 'MT-2945', 'MT-2184', 'MT-3087', 'MT-2508', 'MT-2378', 'MT-2810', 'MT-3055', 'MT-2227', 'MT-2402', 'MT-2570', 'MT-2539', 'MT-2423', 'MT-2200', 'MT-2177', 'MT-2313', 'MT-2435', 'MT-3153', 'MT-2045', 'MT-2723', 'MT-3241', 'MT-3079', 'MT-3190', 'MT-2748', 'MT-2037', 'MT-2017', 'MT-2205', 'MT-2777', 'MT-3064', 'MT-2095', 'MT-2306', 'MT-2381', 'MT-2065', 'MT-3186', 'MT-3047', 'MT-3138', 'MT-2707', 'MT-2688', 'MT-2991', 'MT-2638', 'MT-2048', 'MT-2022', 'MT-3295', 'MT-2097', 'MT-3160', 'MT-2781', 'MT-2463', 'MT-2293', 'MT-3000', 'MT-2447', 'MT-3169', 'MT-2134', 'MT-2498', 'MT-3035', 'MT-2449', 'MT-2761', 'MT-2189', 'MT-2514', 'MT-2524', 'MT-3114', 'MT-2565', 'MT-3185', 'MT-2145', 'MT-2975', 'MT-2308', 'MT-2787', 'MT-2571', 'MT-2361', 'MT-2700', 'MT-2741', 'MT-2420', 'MT-2176', 'MT-2110', 'MT-3270', 'MT-2727', 'MT-3026', 'MT-3230', 'MT-2687', 'MT-2987', 'MT-3056', 'MT-2540', 'MT-2360', 'MT-3006', 'MT-2588', 'MT-2270', 'MT-2441', 'MT-3028', 'MT-2084', 'MT-3108', 'MT-2654', 'MT-2399', 'MT-2558')": [{'matter_id': 'MT-2017',
          'matter_caption': 'In re Marriage of Liang',
          'practice_area': 'Family Law',
          'client_name': 'Liang, Hao',
          'responsible_attorney_name': 'Miguel Teran',
          'status': 'Open'},
         {'matter_id': 'MT-2022',
          'matter_caption': 'Kang Brothers v. Gutierrez',
          'practice_area': 'Business Litigation',
          'client_name': 'Kang Brothers Wholesale Produce, Inc.',
          'responsible_attorney_name': 'Farid Nazarian',
          'status': 'Open'},
         {'matter_id': 'MT-2035',
          'matter_caption': 'Pruitt v. Figueroa Self-Storage',
          'practice_area': 'Business Litigation',
          'client_name': 'Pruitt, Sharon',
          'responsible_attorney_name': 'Daniel J. Sung',
          'status': 'Open'}],
    "SELECT matter_id, matter_caption, practice_area, client_name, responsible_attorney_name, status FROM legal.matters WHERE matter_id IN ('MT-2479', 'MT-2074', 'MT-2092', 'MT-2063', 'MT-2344', 'MT-2920', 'MT-2349', 'MT-2778', 'MT-2246', 'MT-2801', 'MT-2035', 'MT-2597', 'MT-3083', 'MT-2646', 'MT-2788', 'MT-2191', 'MT-3024', 'MT-2307', 'MT-2671', 'MT-2641', 'MT-2392', 'MT-2477', 'MT-2233', 'MT-3001', 'MT-3231', 'MT-2123', 'MT-2885', 'MT-3173', 'MT-3089', 'MT-2321', 'MT-2600', 'MT-2251', 'MT-2945', 'MT-2184', 'MT-3087', 'MT-2508', 'MT-2378', 'MT-2810', 'MT-3055', 'MT-2227', 'MT-2402', 'MT-2570', 'MT-2539', 'MT-2423', 'MT-2200', 'MT-2177', 'MT-2313', 'MT-2435', 'MT-3153', 'MT-2045', 'MT-2723', 'MT-3241', 'MT-3079', 'MT-3190', 'MT-2748', 'MT-2037', 'MT-2017', 'MT-2777', 'MT-2205', 'MT-3064', 'MT-2095', 'MT-2306', 'MT-2381', 'MT-2065', 'MT-3186', 'MT-3138', 'MT-3047', 'MT-2707', 'MT-2688', 'MT-2991', 'MT-2638', 'MT-2048', 'MT-2022', 'MT-3295', 'MT-2097', 'MT-3160', 'MT-2781', 'MT-2463', 'MT-2293', 'MT-3000', 'MT-2447', 'MT-3169', 'MT-2134', 'MT-2498', 'MT-3035', 'MT-2449', 'MT-2761', 'MT-2189', 'MT-2514', 'MT-2524', 'MT-3114', 'MT-2565', 'MT-3185', 'MT-2145', 'MT-2975', 'MT-2308', 'MT-2787', 'MT-2571', 'MT-2361', 'MT-2700', 'MT-2741', 'MT-2420', 'MT-2176', 'MT-2110', 'MT-3270', 'MT-2727', 'MT-3026', 'MT-3230', 'MT-2687', 'MT-3056', 'MT-2987', 'MT-2540', 'MT-3006', 'MT-2360', 'MT-2588', 'MT-2270', 'MT-2441', 'MT-3028', 'MT-2084', 'MT-3108', 'MT-2654', 'MT-2399', 'MT-2558')": [{'matter_id': 'MT-2646',
          'matter_caption': 'Ashworth v. Kang Brothers',
          'practice_area': 'Business Litigation',
          'client_name': 'Ashworth, Bridget',
          'responsible_attorney_name': 'Farid Nazarian',
          'status': 'Open'},
         {'matter_id': 'MT-3138',
          'matter_caption': 'In re Marriage of Trejo',
          'practice_area': 'Family Law',
          'client_name': 'Trejo, Yesenia',
          'responsible_attorney_name': 'Miguel Teran',
          'status': 'Open'},
         {'matter_id': 'MT-2399',
          'matter_caption': 'Conservatorship of Whitcombe',
          'practice_area': 'Probate and Trust Administration',
          'client_name': 'Whitcombe, Bradley',
          'responsible_attorney_name': 'Priya Raghunathan',
          'status': 'Open'}],
    "SELECT practice_area, COUNT(*) AS value FROM legal.matters GROUP BY practice_area ORDER BY value DESC": [{'practice_area': 'personal injury', 'value': 155},
         {'practice_area': 'immigration', 'value': 149},
         {'practice_area': 'estate planning', 'value': 126}],
    "SELECT practice_area, SUM(value_at_standard_rates) AS value FROM legal.time_entries GROUP BY practice_area ORDER BY value DESC": [{'practice_area': 'family law', 'value': 1892821.9000000001},
         {'practice_area': 'personal injury', 'value': 1795581.5999999994},
         {'practice_area': 'business litigation', 'value': 1572019.7999999998}],
    "SELECT priority, COUNT(*) AS value FROM legal.deadlines_and_sol GROUP BY priority ORDER BY value DESC": [{'priority': 'high', 'value': 1954},
         {'priority': 'critical', 'value': 1148},
         {'priority': 'medium', 'value': 648}],
    "SELECT priority, COUNT(*) AS value FROM legal.time_entries GROUP BY priority ORDER BY value DESC": [{'priority': 'high', 'value': 1}],
    "SELECT responsible_attorney_name, COUNT(*) AS value FROM legal.matters GROUP BY responsible_attorney_name ORDER BY value DESC": [{'responsible_attorney_name': 'priya raghunathan', 'value': 239},
         {'responsible_attorney_name': 'miguel teran', 'value': 205},
         {'responsible_attorney_name': 'marisol alvarado', 'value': 111}],
    "SELECT status, COUNT(*) AS value FROM legal.deadlines_and_sol GROUP BY status ORDER BY value DESC": [{'status': 'completed', 'value': 2807},
         {'status': 'open', 'value': 804},
         {'status': 'completed late', 'value': 139}],
    "SELECT status, COUNT(*) AS value FROM legal.matters GROUP BY status ORDER BY value DESC": [{'status': 'open', 'value': 730}, {'status': 'closed', 'value': 570}],
    "SELECT status, COUNT(*) AS value FROM legal.time_entries GROUP BY status ORDER BY value DESC": [{'status': 'open', 'value': 1}],
    "SELECT status, SUM(balance_due) AS value FROM legal.invoices GROUP BY status ORDER BY value DESC": [{'status': 'open', 'value': 326320.65999999986},
         {'status': 'partially paid', 'value': 216871.81000000017},
         {'status': 'outstanding', 'value': 149309.5299999999}],
    "SELECT task_description, COUNT(*) AS value FROM legal.time_entries GROUP BY task_description ORDER BY value DESC": [{'task_description': 'analysis/strategy', 'value': 13178},
         {'task_description': 'fact investigation/development', 'value': 7054},
         {'task_description': 'document/file management', 'value': 5789}],
    "SELECT timekeeper, SUM(hours) AS value FROM legal.time_entries GROUP BY timekeeper ORDER BY value DESC": [{'timekeeper': 'farid nazarian', 'value': 3416.4000000000024},
         {'timekeeper': 'anahit petrosyan', 'value': 3077.2999999999993},
         {'timekeeper': 'oscar villagomez', 'value': 2927.2999999999993}],
    "SELECT transaction_type, COUNT(*) AS value FROM legal.trust_ledger_cta GROUP BY transaction_type ORDER BY value DESC": [{'transaction_type': 'transfer to operating - earned fees', 'value': 2318},
         {'transaction_type': 'deposit - flat fee (unearned)', 'value': 1062},
         {'transaction_type': 'transfer to operating - earned flat fee', 'value': 792}],
}


_SYNTHETIC_BINDINGS = {
    "record_id": "rec-001",
    "template_id": "tpl-001",
    "workflow_id": "wf-001",
    "run_id": "run-001",
    "notification_id": "notif-001",
    # A file is addressed by where it lives — its type, its record, then itself.
    "file_type": "invoices",
    "file_record": "lea-001",
    "attachment_id": "att-001",
}


# ===========================================================================
# Redaction
# ===========================================================================


def redact(value: Any) -> Any:
    """Strip anything credential-shaped, at any depth."""
    if isinstance(value, dict):
        return {
            key: (REDACTED if key.lower() in _SECRET_KEYS else redact(sub))
            for key, sub in value.items()
        }
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


# ===========================================================================
# Writing
# ===========================================================================


def _carries_content(payload: Any) -> bool:
    """Is there anything in this response worth recording as an example?

    An instance that has never run a workflow answers ``{"workflows": []}``
    with a perfectly good 200. Recording that would replace a populated
    synthetic example with an empty one, and the contract would then be
    checked against a shape nothing ever fills in. Emptiness here means "this
    instance has nothing to show", not "the endpoint returns nothing".
    """
    if payload is None:
        return False
    if isinstance(payload, dict):
        # Peel InventDB's {"ok": true, "data": ...} envelope before judging.
        inner = payload.get("data") if payload.get("ok") is True else payload
        if isinstance(inner, (dict, list)) and not inner:
            return False
        if isinstance(inner, dict):
            meaningful = {k: v for k, v in inner.items() if k not in ("ok", "error")}
            return any(v not in (None, [], {}, "") for v in meaningful.values())
        return bool(inner)
    if isinstance(payload, list):
        return bool(payload)
    return True


def write_recordings(
    http: dict[str, dict[str, Any]],
    sql: dict[str, Any],
    bindings: dict[str, str],
    *,
    source: str,
    base_url: str | None = None,
    captured_at: str | None = None,
    out: Path = RECORDING_PATH,
) -> Path:
    document = {
        "_comment": (
            "InventDB responses replayed by tests/contract/test_contract.py. "
            "Regenerate with `python -m tests.contract.capture`."
        ),
        "source": source,
        "base_url": base_url,
        "captured_at": captured_at,
        "bindings": bindings,
        "http": [
            {
                "method": key.split(" ", 1)[0],
                "path": key.split(" ", 1)[1],
                "status": entry["status"],
                "payload": redact(entry["payload"]),
            }
            for key, entry in sorted(http.items())
        ],
        "sql": [
            {"key": key, "status": 200, "rows": redact(rows)}
            for key, rows in sorted(sql.items())
        ],
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(document, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    return out


# ===========================================================================
# Live capture
# ===========================================================================


def capture_live(*, include_writes: bool, out: Path) -> Path:
    """Drive the real app against a real instance, recording every upstream call."""
    import datetime

    import requests

    base_url = os.environ.get("INVENTDB_BASE_URL", "").rstrip("/")
    username = os.environ.get("INVENTDB_USERNAME")
    password = os.environ.get("INVENTDB_PASSWORD")
    if not (base_url and username and password):
        raise SystemExit(
            "Live capture needs INVENTDB_BASE_URL, INVENTDB_USERNAME and "
            "INVENTDB_PASSWORD. Run with --synthetic to regenerate the offline "
            "baseline instead."
        )

    login = requests.post(
        f"{base_url}/api/auth/login",
        json={"username": username, "password": password},
        timeout=30,
    )
    login.raise_for_status()
    token = login.json().get("token")
    if not token:
        raise SystemExit(f"No token in the login response: {login.text[:200]}")

    from app.main import create_app
    import app.inventdb as inventdb_module
    from tests.contract.spec import ENDPOINTS, sql_key

    real_request = requests.request
    # Seeded from the offline baseline, then overlaid with whatever this
    # instance actually answers. A namespace that has never run a workflow or
    # stored a file has nothing to record for those endpoints, and a captured
    # 404 against a placeholder id is not a better recording than the synthetic
    # stand-in — it is a hole the contract tests would then have to tolerate.
    http: dict[str, dict[str, Any]] = {k: dict(v) for k, v in _SYNTHETIC_HTTP.items()}
    sql: dict[str, Any] = dict(_SYNTHETIC_SQL)
    live_http: set[str] = set()

    def recording_request(method, url, **kwargs):
        response = real_request(method, url, **kwargs)
        path = url[len(base_url) :] if url.startswith(base_url) else url
        try:
            payload = response.json() if response.content else None
        except ValueError:
            payload = None

        if path == "/sql":
            statement = (kwargs.get("json") or {}).get("sql", "")
            rows = payload.get("rows", []) if isinstance(payload, dict) else payload
            sql[sql_key(statement)] = rows or []
        elif response.ok and _carries_content(payload):
            key = f"{method.upper()} {path}"
            http[key] = {"status": response.status_code, "payload": payload}
            live_http.add(key)
        return response

    inventdb_module.requests.request = recording_request
    try:
        client = create_app().test_client()
        headers = {"Authorization": f"Bearer {token}"}

        # Bind the parameterised paths to ids that exist on this instance.
        listing = client.get("/api/matters?limit=1", headers=headers).get_json() or {}
        items = listing.get("items") or []
        record_id = (items[0].get("_id") if items else None) or "rec-001"

        templates = (client.get("/api/reports/templates", headers=headers).get_json() or {}).get(
            "templates"
        ) or []
        template_id = (templates[0].get("id") if templates else None) or "tpl-001"

        workflows = (client.get("/api/workflows", headers=headers).get_json() or {}).get(
            "workflows"
        ) or []
        workflow_id = (workflows[0].get("_id") if workflows else None) or "wf-001"

        # An instance with no runs yet is normal — a fresh workflow has not
        # fired. The placeholder then records the 404, which is a real part of
        # the contract rather than a gap in it.
        runs = (client.get("/api/workflows/runs", headers=headers).get_json() or {}).get(
            "runs"
        ) or []
        run_id = (runs[0].get("_id") if runs else None) or "run-001"

        # Same reasoning as runs: an instance where nothing has ever parked has
        # an empty inbox, and the placeholder records that 404 honestly.
        notifications = (
            client.get("/api/notifications", headers=headers).get_json() or {}
        ).get("notifications") or []
        notification_id = (
            notifications[0].get("_id") if notifications else None
        ) or "notif-001"

        # Seeded from the offline set so the placeholders this pass does not
        # discover — a file's type, record and attachment — stay bound to the
        # ids the synthetic recordings answer to. Left unbound they survive
        # into the path as literal `{file_type}`, and the endpoint is asked for
        # an entity by that name.
        bindings = {
            **_SYNTHETIC_BINDINGS,
            "record_id": record_id,
            "template_id": template_id,
            "workflow_id": workflow_id,
            "run_id": run_id,
            "notification_id": notification_id,
        }
        # Skipped unless `--include-writes`. The workflow writes are more
        # consequential than the matter ones: activating or firing a real
        # workflow can send real mail, and the delete would remove an
        # automation the instance is relying on. Their synthetic recordings
        # stand in by default.
        writes = {
            "matter-create",
            "matter-update",
            "matter-delete",
            "workflow-create",
            "workflow-update",
            "workflow-activate",
            "workflow-run",
            "workflow-delete",
        }

        for endpoint in ENDPOINTS:
            if endpoint["key"] in writes and not include_writes:
                continue
            path = endpoint["path"]
            for name, value in bindings.items():
                path = path.replace("{" + name + "}", str(value))
            client.open(
                path,
                method=endpoint["method"],
                json=endpoint.get("body"),
                headers=headers if endpoint.get("auth", True) else None,
            )

        if include_writes:
            # Clean up after ourselves: the create above left a row behind.
            created = client.post(
                "/api/matters",
                json={"matter_caption": "1 Contract Way", "client_name": "Mumbai", "status": "Vacant"},
                headers=headers,
            ).get_json()
            new_id = (created or {}).get("_id")
            if new_id:
                client.delete(f"/api/matters/{new_id}", headers=headers)
    finally:
        inventdb_module.requests.request = real_request

    written = write_recordings(
        http,
        sql,
        bindings,
        source="live",
        base_url=base_url,
        captured_at=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        out=out,
    )
    print(
        f"Captured {len(live_http)} live HTTP responses and {len(sql)} SQL results "
        f"from {base_url} -> {written}"
    )
    stood_in = sorted(set(http) - live_http)
    if stood_in:
        print(
            f"{len(stood_in)} endpoint(s) this instance does not serve kept their "
            "synthetic recording: " + ", ".join(stood_in[:6])
            + (" …" if len(stood_in) > 6 else "")
        )
    if not include_writes:
        print(
            "Write endpoints were skipped; their synthetic recordings are kept. "
            "Pass --include-writes to capture them (this mutates the namespace)."
        )
    return written


def _pin_clock() -> None:
    """Record against the same date the tests replay at.

    Without this the recordings capture whatever month the capture was run in,
    and the suite breaks the next time the month rolls over.
    """
    from datetime import date

    from app import clock

    clock.today = lambda: date(2026, 8, 19)  # noqa: E731 - matches CONTRACT_TODAY


def main(argv: list[str] | None = None) -> int:
    _pin_clock()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--synthetic",
        action="store_true",
        help="regenerate the offline baseline instead of calling a live instance",
    )
    parser.add_argument(
        "--include-writes",
        action="store_true",
        help="also capture create/update/delete — WRITES TO THE LIVE NAMESPACE",
    )
    parser.add_argument("--out", type=Path, default=RECORDING_PATH)
    args = parser.parse_args(argv)

    if args.synthetic:
        written = write_recordings(
            _SYNTHETIC_HTTP, _SYNTHETIC_SQL, _SYNTHETIC_BINDINGS, source="synthetic", out=args.out
        )
        print(f"Wrote the synthetic baseline to {written}")
        return 0

    capture_live(include_writes=args.include_writes, out=args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
