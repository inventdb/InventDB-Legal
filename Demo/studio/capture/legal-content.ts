// The E2E fixtures for workflows, notifications, reports, files and Analyze
// were written for InventDB's property-management sibling (owner statements,
// dripping taps). The film is about a law firm, so before any test installs
// the mock these arrays are rewritten, in place, with Alvarado & Sung LLP's
// work. Names, matters and figures come from the shipped dataset.
import {
  AGENT_STEPS,
  ANALYZE_THREADS,
  FILES,
  FILE_FOLDERS,
  FILE_TEXT,
  FILE_VERSIONS,
  INTAKE_RUN,
  INTAKE_RUN_STEPS,
  NOTIFICATIONS,
  REPORT_DETAILS,
  REPORT_SNAPSHOTS,
  REPORT_TEMPLATES,
  WORKFLOWS,
  WORKFLOW_DRAFT,
  WORKFLOW_RUNS,
  WORKFLOW_RUN_STEPS,
  WORKFLOW_VERSIONS,
} from "../../../frontend/e2e/fixtures";

function replace<T>(target: T[], items: T[]) {
  target.splice(0, target.length, ...items);
}
function replaceObj(target: Record<string, unknown>, value: Record<string, unknown>) {
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, value);
}

/** The question the film asks in Analyze, and what the dataset says. */
export const ANALYZE_QUESTION = "Which practice areas are carrying the most unbilled work?";
const WIP_SQL =
  "SELECT practice_area, ROUND(SUM(value_at_standard_rates), 2) AS unbilled_value, " +
  "ROUND(SUM(hours), 1) AS hours FROM legal.time_entries " +
  "WHERE billable = true AND billed = false GROUP BY practice_area ORDER BY unbilled_value DESC LIMIT 5";
const WIP_ROWS = [
  { practice_area: "Business Litigation", unbilled_value: 125158.5, hours: 309.9 },
  { practice_area: "Family Law", unbilled_value: 75776.5, hours: 210.7 },
  { practice_area: "Insurance Defense", unbilled_value: 35431.5, hours: 92.0 },
  { practice_area: "Appellate", unbilled_value: 19964.0, hours: 43.8 },
  { practice_area: "Probate and Trust Administration", unbilled_value: 17029.5, hours: 47.1 },
];

export function legalise() {
  // ---- Analyze -----------------------------------------------------------
  replace(AGENT_STEPS, [
    { type: "info", content: "Analyzing your question..." },
    { type: "reasoning", content: "", executionTimeMs: 388 },
    { type: "info", content: "Unbilled work is billable time not yet on an invoice, valued at standard rates" },
    { type: "sql", content: "Executing query...", sql: WIP_SQL },
    {
      type: "result",
      content: "Query returned 5 rows",
      sql: WIP_SQL,
      data: WIP_ROWS,
      executionTimeMs: 41,
    },
    {
      type: "chart",
      content: "Unbilled work by practice area",
      chart: {
        data: [
          {
            type: "bar",
            x: WIP_ROWS.map((r) => r.practice_area),
            y: WIP_ROWS.map((r) => r.unbilled_value),
            marker: { color: "#5b1a24" },
          },
        ],
        layout: { title: { text: "Unbilled work by practice area" } },
      },
    },
    {
      type: "done",
      content:
        "**Business Litigation** carries the most unbilled work: **$125,158.50** across 309.9 hours, " +
        "about 42% of the firm's $300,639.50 total. **Family Law** follows with **$75,776.50**. " +
        "Together the two hold two-thirds of everything not yet invoiced.",
    },
    {
      type: "suggestions",
      content: "",
      chart: {
        followups: [
          "Which Business Litigation matters hold the most unbilled time?",
          "How old is the oldest unbilled entry in each practice area?",
        ],
        actions: ["Email this breakdown to the partners"],
      },
    },
  ]);

  replace(ANALYZE_THREADS as Record<string, unknown>[], [
    {
      _id: "soar_thread-1",
      label: "Open matters by practice area",
      created: "2026-08-18T16:02:00.000Z",
      _exchanges: [
        {
          question: "Open matters by practice area",
          answer: "Personal Injury leads with **155** matters, then Immigration (**149**) and Estate Planning (**126**).",
          ts: "2026-08-18T16:02:05.000Z",
          steps: [{ type: "sql", sql: "SELECT practice_area, COUNT(*) AS cnt FROM legal.matters GROUP BY practice_area ORDER BY cnt DESC", ms: 6 }],
          artifacts: [],
        },
      ],
    },
    {
      _id: "soar_thread-2",
      label: "Trust balance by matter",
      created: "2026-08-17T10:15:00.000Z",
      _exchanges: [
        {
          question: "Trust balance by matter",
          answer: "The client trust account holds **$1,268,901.63** across open matters.",
          ts: "2026-08-17T10:15:04.000Z",
          steps: [{ type: "sql", sql: "SELECT matter_id, SUM(amount_in) - SUM(amount_out) AS balance FROM legal.trust_ledger_cta GROUP BY matter_id", ms: 9 }],
          artifacts: [],
        },
      ],
    },
  ]);

  // ---- Workflows -----------------------------------------------------------
  replace(WORKFLOWS as Record<string, unknown>[], [
    {
      _id: "wf-1",
      name: "Morning docket alert",
      trigger_kind: "cron",
      trigger_intent: "Every weekday at 7:00, email each attorney the critical deadlines due in the next seven days.",
      trigger_spec: { expr: "0 7 * * 1-5", tz: "America/Los_Angeles" },
      active: true,
      pending_approval: false,
      sandbox: false,
      version: 3,
      next_run_at: "2026-08-20T14:00:00Z",
      plan: [
        { idx: 0, kind: "sql_query", label: "Find critical deadlines", narration: "Open deadlines marked Critical, due within seven days.", sql: "SELECT matter_id, description, due_date, owner_name FROM legal.deadlines_and_sol WHERE status = 'Open' AND priority = 'Critical' AND due_date <= CURRENT_DATE + 7", save_as: "due" },
        { idx: 1, kind: "render_report", label: "Render the docket", narration: "One page per attorney, soonest first.", template_id: "rpt-docket", save_as: "docket" },
        { idx: 2, kind: "send_email", label: "Email each attorney", narration: "Attaches their page of the docket.", to: "${docket.owner_email}", subject: "Your docket this week", body: "Attached." },
        { idx: 3, kind: "finish", label: "Done", narration: "", summary: "Docket sent." },
      ],
      created_at: "2026-02-02T00:00:00Z",
    },
    {
      _id: "wf-2",
      name: "Trust replenishment request",
      trigger_kind: "event",
      trigger_intent: "When an hourly matter's trust balance falls below its replenish threshold, ask the client to top it up.",
      active: true,
      pending_approval: false,
      sandbox: true,
      version: 2,
      plan: [
        { idx: 0, kind: "sql_query", label: "Find low trust balances", narration: "Matters below their replenish threshold.", sql: "SELECT matter_id, client_name, trust_balance, replenish_threshold FROM legal.matters WHERE trust_balance < replenish_threshold", save_as: "low" },
        { idx: 1, kind: "notify_user", label: "Ask the responsible partner", narration: "Parks the run until a partner approves.", title: "Approve replenishment request", save_as: "ok" },
        { idx: 2, kind: "send_email", label: "Email the client", narration: "With the amount and the trust account details.", when: "${ok.approved}" },
        { idx: 3, kind: "finish", label: "Done", narration: "", summary: "Request sent." },
      ],
      created_at: "2026-03-10T00:00:00Z",
    },
  ]);
  Object.assign(WORKFLOW_DRAFT, {
    name: "Monthly pre-bill review",
    trigger_intent: "On the 25th, send each responsible attorney their unbilled time to review before invoicing.",
    plan: [{ idx: 0, kind: "render_report", label: "Render unbilled work", narration: "", template_id: "rpt-wip" }],
  });
  replaceObj(WORKFLOW_VERSIONS as Record<string, unknown>, {
    "wf-1": [
      {
        _id: "wf-1.v2",
        version: 2,
        workflow_id: "wf-1",
        name: "Morning docket alert",
        trigger_intent: "Every weekday at 7:00, email the critical deadlines due this week.",
        plan: [{ idx: 0, kind: "sql_query", label: "Find critical deadlines", narration: "" }],
        created_at: "2026-04-14T00:00:00Z",
      },
      {
        _id: "wf-1.v1",
        version: 1,
        workflow_id: "wf-1",
        name: "Morning docket alert",
        trigger_intent: "Every weekday, email the docket.",
        plan: [{ idx: 0, kind: "render_report", label: "Render the docket", narration: "" }],
        created_at: "2026-02-02T00:00:00Z",
      },
    ],
  });
  replace(WORKFLOW_RUNS as Record<string, unknown>[], [
    { _id: "run-1", workflow_id: "wf-1", status: "succeeded", started_at: "2026-08-19T14:00:00Z", ended_at: "2026-08-19T14:00:09Z" },
    { _id: "run-2", workflow_id: "wf-1", status: "failed", started_at: "2026-08-18T14:00:00Z", ended_at: "2026-08-18T14:00:31Z", error: "Mail server did not answer in time" },
    { _id: "run-3", workflow_id: "wf-2", status: "running", started_at: "2026-08-19T17:12:00Z" },
  ]);
  replaceObj(WORKFLOW_RUN_STEPS as Record<string, unknown>, {
    "run-1": [
      { _id: "rs-1", run_id: "run-1", idx: 0, role: "tool_call", created_at: "2026-08-19T14:00:01Z", content: "[Find critical deadlines] Open deadlines marked Critical, due within seven days.", tool_name: "sql_query", tool_args: { sql: "SELECT matter_id, description, due_date, owner_name FROM legal.deadlines_and_sol WHERE status = 'Open' AND priority = 'Critical'" } },
      { _id: "rs-2", run_id: "run-1", idx: 0, role: "tool_result", created_at: "2026-08-19T14:00:02Z", content: "", tool_name: "sql_query", tool_result: [
        { matter_id: "MT-2063", description: "Designation of the record on appeal", due_date: "2026-08-20", owner_name: "Devon Blackwood" },
        { matter_id: "MT-2208", description: "Credit counselling certificate to be filed", due_date: "2026-08-20", owner_name: "Wei-Lin Chen" },
      ] },
      { _id: "rs-3", run_id: "run-1", idx: 2, role: "tool_call", created_at: "2026-08-19T14:00:05Z", content: "[Email each attorney] Attaches their page of the docket.", tool_name: "send_email", tool_args: { to: "dblackwood@alvaradosung.example", subject: "Your docket this week" } },
      { _id: "rs-4", run_id: "run-1", idx: 2, role: "tool_result", created_at: "2026-08-19T14:00:09Z", content: "", tool_name: "send_email", tool_result: { ok: true, sent: 6 } },
    ],
    "run-2": [
      { _id: "rs-5", run_id: "run-2", idx: 0, role: "tool_call", created_at: "2026-08-18T14:00:01Z", content: "[Find critical deadlines]", tool_name: "sql_query", tool_args: { sql: "SELECT matter_id, due_date FROM legal.deadlines_and_sol WHERE priority = 'Critical'" } },
      { _id: "rs-6", run_id: "run-2", idx: 0, role: "tool_result", created_at: "2026-08-18T14:00:02Z", content: "", tool_name: "sql_query", tool_result: [{ matter_id: "MT-2063", due_date: "2026-08-20" }] },
      { _id: "rs-7", run_id: "run-2", idx: 2, role: "tool_result", created_at: "2026-08-18T14:00:31Z", content: "send_email failed", tool_name: "send_email", tool_result: { error: "Mail server did not answer in time" } },
    ],
    "run-3": [
      { _id: "rs-8", run_id: "run-3", idx: 1, role: "tool_call", created_at: "2026-08-19T17:12:01Z", content: "[Ask the responsible partner] Parks the run until a partner approves.", tool_name: "notify_user", tool_args: { message: "Approve replenishment request" } },
    ],
  });

  // ---- The inbox -----------------------------------------------------------
  replace(NOTIFICATIONS as Record<string, unknown>[], [
    {
      _id: "n-1",
      title: "Conflict check: new enquiry shares a surname with a client",
      body:
        "<p><strong>New enquiry</strong> — Premises Liability, received 17 Aug</p>" +
        "<p><strong>Prospect:</strong> Rosa Orozco, (424) 384-3311<br>" +
        "<strong>Possible match:</strong> In re Marriage of Orozco (MT-2368), an open Family Law matter<br>" +
        "<strong>Adverse parties named:</strong> none on file with the firm</p>" +
        "<p><strong>Suggested:</strong> clear the conflict and book a consultation with Anahit Petrosyan.</p>",
      actions: [
        { id: "approve", label: "Clear the conflict and book the consultation", kind: "approve" },
        { id: "choose", label: "Hand to another attorney", kind: "form", form_fields: [{ name: "attorney", type: "text", required: true, label: "Attorney" }] },
        { id: "decline", label: "Decline the enquiry", kind: "decline" },
      ],
      workflow_id: "wf-intake",
      run_id: "run-intake",
      step_idx: 4,
      created_at: "2026-08-17T16:42:00Z",
      read_at: null,
      resolved_action: null,
    },
    {
      _id: "n-4",
      title: "Approve trust replenishment: Kang Brothers v. Gutierrez",
      body: "<p>Trust balance <strong>$238.88</strong> is below the $3,000.00 replenish threshold on MT-2022. Request a top-up from Kang Brothers Wholesale Produce, Inc.?</p>",
      actions: [
        { id: "approve", label: "Send the replenishment request", kind: "approve" },
        { id: "decline", label: "Not now", kind: "decline" },
      ],
      workflow_id: "wf-2",
      run_id: "run-3",
      created_at: "2026-08-19T17:12:02Z",
    },
    {
      _id: "n-2",
      title: "Approve transfer of earned fees from trust",
      body: "<p>Invoice paid from trust on In re Marriage of Aparicio (MT-2588).</p>",
      actions: [
        { id: "approve", label: "Approve the transfer", kind: "approve" },
        { id: "decline", label: "Not now", kind: "decline" },
      ],
      workflow_id: "wf-2",
      run_id: "run-1",
      created_at: "2026-08-15T18:05:00Z",
      read_at: "2026-08-15T18:20:00Z",
      resolved_action: "approve",
      resolved_at: "2026-08-15T18:22:00Z",
    },
    {
      _id: "n-3",
      title: "Morning docket sent",
      body: "Six attorneys were emailed their critical deadlines for the week.",
      actions: [],
      workflow_id: "wf-1",
      run_id: "run-1",
      created_at: "2026-08-19T14:00:09Z",
      read_at: "2026-08-19T15:00:00Z",
    },
  ]);
  Object.assign(INTAKE_RUN, { started_at: "2026-08-17T16:41:40Z" });
  replace(INTAKE_RUN_STEPS as Record<string, unknown>[], [
    { _id: "irs-1", run_id: "run-intake", idx: 0, role: "tool_call", created_at: "2026-08-17T16:41:41Z", content: "[Read the enquiry] Pulls out the prospect, the claim and the other side.", tool_name: "llm_extract" },
    { _id: "irs-0-result", run_id: "run-intake", idx: 0, role: "tool_result", created_at: "2026-08-17T16:41:45Z", content: "", tool_name: "llm_extract", tool_result: { prospect: "Rosa Orozco", claim: "Premises Liability" } },
    { _id: "irs-2", run_id: "run-intake", idx: 1, role: "tool_result", created_at: "2026-08-17T16:41:49Z", content: "", tool_name: "insert_record", tool_result: { ok: true, _id: "int-587", id: "LD-3587" } },
    { _id: "irs-4", run_id: "run-intake", idx: 2, role: "tool_result", created_at: "2026-08-17T16:41:53Z", content: "", tool_name: "sql_query", tool_result: [{ matter_id: "MT-2368", matter_caption: "In re Marriage of Orozco", status: "Open" }] },
    { _id: "irs-3", run_id: "run-intake", idx: 3, role: "tool_call", created_at: "2026-08-17T16:41:56Z", content: "[Acknowledge the enquiry] Replies to the prospect.", tool_name: "send_email", tool_args: { to: "rosa.orozco@example.com", subject: "We received your enquiry" } },
  ]);

  // ---- Reports ---------------------------------------------------------------
  replace(REPORT_TEMPLATES as Record<string, unknown>[], [
    { id: "rpt-docket", name: "Docket: next 30 days", description: "Every open deadline due in the next 30 days, soonest first.", category: "Docket", mode: "sql", version: 4, created_by: "m.alvarado" },
    { id: "rpt-wip", name: "Unbilled work by matter", description: "Billable time not yet invoiced, valued at standard rates.", category: "Financial", mode: "sql", version: 2, created_by: "m.alvarado" },
    { id: "rpt-trust", name: "Trust balances by matter", description: "Client trust account (CTA) balance per matter.", category: "Compliance", mode: "sql", version: 3, created_by: "r.nakashima" },
  ]);
  replaceObj(REPORT_DETAILS as Record<string, unknown>, {
    "rpt-docket": { id: "rpt-docket", name: "Docket: next 30 days", description: "Every open deadline due in the next 30 days, soonest first.", category: "Docket", mode: "sql", version: 4, parameters: [] },
    "rpt-wip": { id: "rpt-wip", name: "Unbilled work by matter", description: "Billable time not yet invoiced, valued at standard rates.", category: "Financial", mode: "sql", version: 2, parameters: [] },
    "rpt-trust": {
      id: "rpt-trust", name: "Trust balances by matter", description: "Client trust account (CTA) balance per matter.", category: "Compliance", mode: "sql", version: 3,
      parameters: [{ name: "as_of", label: "As of", type: "date", required: false, default: "2026-08-19", options: [] }],
    },
  });
  replace(REPORT_SNAPSHOTS as Record<string, unknown>[], [
    { record_id: "report_20260801_090000", attachment_id: "att-trust-july", name: "Trust reconciliation — July 2026", created_at: "2026-08-01T09:00:00Z", from_template: false },
  ]);

  // ---- Files -----------------------------------------------------------------
  const file = (id: string, record_type: string, record_id: string, filename: string, type: string, size: number, folder: string, created: string, version = 1) => ({
    _id: id, attachment_id: id, namespace: "legal", record_type, record_id, filename, content_type: type,
    size_bytes: size, version, folder_path: folder, created_at: created, processing_state: "indexed",
  });
  const PDF = "application/pdf";
  replace(FILES as Record<string, unknown>[], [
    file("att-1", "matters", "mat-441", "Engagement letter - signed.pdf", PDF, 284113, "MT-2441", "2025-11-04T09:12:00Z", 2),
    file("att-2", "matters", "mat-441", "First amended complaint.pdf", PDF, 612840, "MT-2441/Pleadings", "2026-01-21T10:00:00Z"),
    file("att-3", "matters", "mat-441", "Notice of motion to compel.pdf", PDF, 198220, "MT-2441/Pleadings", "2026-06-11T08:30:00Z"),
    file("att-4", "court_calendar", "cou-162", "Deposition transcript - R. Halvorsen.pdf", PDF, 1903221, "MT-2441/Discovery", "2026-07-02T08:30:00Z"),
    file("att-5", "invoices", "_vault", "Settlement disbursement statement.pdf", PDF, 88442, "", "2026-08-12T10:00:00Z"),
  ]);
  replace(FILE_FOLDERS as Record<string, unknown>[], [
    { namespace: "legal", type: "matters", path: "MT-2441", count: 1 },
    { namespace: "legal", type: "matters", path: "MT-2441/Pleadings", count: 2 },
    { namespace: "legal", type: "court_calendar", path: "MT-2441/Discovery", count: 1 },
    { namespace: "legal", type: "invoices", path: "", count: 1 },
  ]);
  replaceObj(FILE_VERSIONS as Record<string, unknown>, {
    "att-1": [
      { _id: "att-1.v2", version: 2, filename: "Engagement letter - signed.pdf", size: 284113, created_at: "2025-11-04T09:12:00Z", is_current: true },
      { _id: "att-1.v1", version: 1, filename: "Engagement letter - draft.pdf", size: 210004, created_at: "2025-10-29T14:02:00Z", is_current: false },
    ],
  });
  replaceObj(FILE_TEXT as Record<string, unknown>, {
    "att-1": "ENGAGEMENT AGREEMENT — Olympic Boulevard Dental Group, APC. Hourly fees against a $7,500 evergreen retainer held in the client trust account.",
  });
}
