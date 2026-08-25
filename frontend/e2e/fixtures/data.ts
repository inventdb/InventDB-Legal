/**
 * Seed data for the mocked API.
 *
 * Field names mirror `src/config/entities.ts` exactly — the UI reads records by
 * those names, so a drifting fixture shows up as a blank cell rather than a
 * test failure. `_id` is what the edit/delete paths key off, so every record
 * carries one.
 */

export type Rec = { _id: string; [k: string]: unknown };
export type Store = { [entity: string]: Rec[] };

/** Business key per entity, mirroring EntityConfig.key. */
export const ENTITY_KEYS: { [entity: string]: string } = {
  matters: "matter_id",
  clients: "client_id",
  timekeepers: "timekeeper_id",
  time_entries: "time_entry_id",
  costs_and_disbursements: "cost_id",
  invoices: "invoice_no",
  payments_and_receipts: "payment_id",
  trust_ledger_cta: "transaction_id",
  court_calendar: "event_id",
  deadlines_and_sol: "deadline_id",
  intake_and_leads: "lead_id",
  settlements_and_liens: "settlement_id",
  lookups: "value",
};

/** Every module, with the label the sidebar and page head show for it. */
export const MODULES = [
  { name: "matters", label: "Matter", plural: "Matters" },
  { name: "clients", label: "Client", plural: "Clients" },
  { name: "timekeepers", label: "Timekeeper", plural: "Timekeepers" },
  { name: "time_entries", label: "Time Entry", plural: "Time Entries" },
  {
    name: "costs_and_disbursements",
    label: "Cost",
    plural: "Costs & Disbursements",
  },
  { name: "invoices", label: "Invoice", plural: "Invoices" },
  {
    name: "payments_and_receipts",
    label: "Payment",
    plural: "Payments & Receipts",
  },
  {
    name: "trust_ledger_cta",
    label: "Trust Ledger Entry",
    plural: "Trust Ledger (CTA)",
  },
  { name: "court_calendar", label: "Court Event", plural: "Court Calendar" },
  { name: "deadlines_and_sol", label: "Deadline", plural: "Deadlines & SOL" },
  { name: "intake_and_leads", label: "Lead", plural: "Intake & Leads" },
  {
    name: "settlements_and_liens",
    label: "Settlement",
    plural: "Settlements & Liens",
  },
  { name: "lookups", label: "Lookup", plural: "Lookups" },
] as const;

export const AUTH_USER = {
  id: "u-1",
  username: "e2e.manager",
  email: "e2e.manager@inventdb.com",
  role: "manager",
  isActive: true,
};

export const AUTH_TOKEN = "e2e-test-token";

export const HEALTH = {
  ok: true,
  version: "1.0.0",
  inventdb_base_url: "https://e2e.sandbox.inventdb.com",
  namespace: "legal",
  frontend_bundled: false,
};

/** A fresh copy of the seed data — never share arrays between tests. */
export function createStore(): Store {
  return JSON.parse(JSON.stringify(SEED)) as Store;
}

/**
 * The report library for one test.
 *
 * Authoring mutates it — a rename changes a name, a delete removes a row, an
 * edit bumps a version — so it has to be per-test like `createStore()`. Sharing
 * the module constants meant a rename in the studio spec renamed the report the
 * rendering spec was waiting for, in whichever test happened to run next in the
 * same worker.
 */
export interface ReportStore {
  templates: Rec[];
  details: { [id: string]: Record<string, unknown> };
  snapshots: Rec[];
}

export function createReportStore(): ReportStore {
  return JSON.parse(
    JSON.stringify({
      templates: REPORT_TEMPLATES,
      details: REPORT_DETAILS,
      snapshots: REPORT_SNAPSHOTS,
    })
  ) as ReportStore;
}

const SEED: Store = {
  matters: [
    {
      _id: "mt-1",
      // InventDB stamps these on every record, so one fixture carries them —
      // anything reading `_updatedAt` should meet it here rather than only in
      // production.
      _createdAt: "2026-08-20T11:17:26.566184617+00:00",
      _updatedAt: "2026-08-20T11:17:26.566184617+00:00",
      matter_id: "MT-2018",
      client_id: "CL-1123",
      client_name: "Pineda, Carmen",
      matter_caption: "Pineda v. Bright Path",
      practice_area: "Personal Injury",
      matter_type: "Motor Vehicle Accident",
      fee_model: "Contingency",
      fee_terms:
        "One third of the gross recovery if resolved before suit is filed, forty " +
        "per cent thereafter. No fee unless there is a recovery.",
      fee_agreement_date: "2025-11-24",
      contingency_pre_suit: 0.3333,
      contingency_post_filing: 0.4,
      volume_discount: 0,
      pro_bono: false,
      court: "Los Angeles Superior Court - Stanley Mosk Courthouse",
      court_short: "LASC Stanley Mosk",
      case_number: "24STCV03922",
      judicial_officer: "Hon. Priscilla Yee-Barron",
      department: "Dept. 56",
      status: "Open",
      stage: "Written Discovery",
      date_opened: "2025-12-22",
      date_filed: "2026-01-18",
      incident_trigger_date: "2025-10-07",
      limitations_authority: "CCP 335.1 (2 yrs)",
      limitations_date: "2027-10-07",
      opposing_party: "Bright Path Childcare Centers, Inc.",
      opposing_counsel: "The Ferrante Law Group, APC",
      insurance_carrier: "State Farm Mutual",
      claim_number: "23-954458-D",
      responsible_attorney: "TK-02",
      responsible_attorney_name: "Marisol Alvarado",
      originating_attorney: "TK-01",
      paralegal: "TK-16",
      next_court_date: "2026-10-19",
      recorded_hours: 18.1,
      recorded_value_at_standard_rates: 6567,
      costs_advanced: 1458.68,
      fees_billed: 0,
      collected: 0,
      trust_required: false,
      trust_balance: 0,
    },
    {
      _id: "mt-2",
      matter_id: "MT-2987",
      client_id: "CL-1932",
      client_name: "Chen, Qing",
      matter_caption: "In re Marriage of Chen",
      practice_area: "Family Law",
      matter_type: "Dissolution with Minor Children",
      fee_model: "Hourly - Evergreen Retainer",
      rate_tier: "Standard",
      trust_required: true,
      retainer_amount: 10000,
      replenish_threshold: 3000,
      court: "Los Angeles Superior Court - Stanley Mosk Courthouse (Family Law)",
      court_short: "LASC Family Law",
      case_number: "24STFL01188",
      judicial_officer: "Hon. Victor Aguilar-Sandoval",
      department: "Dept. 85",
      status: "Open",
      stage: "Request for Order Pending",
      date_opened: "2026-05-31",
      date_filed: "2026-06-24",
      responsible_attorney: "TK-09",
      responsible_attorney_name: "Priya Raghunathan",
      paralegal: "TK-19",
      next_court_date: "2026-08-30",
      recorded_hours: 42.6,
      fees_billed: 18473.35,
      collected: 15000,
      trust_balance: 6500,
    },
    {
      _id: "mt-3",
      matter_id: "MT-3125",
      client_id: "CL-2071",
      client_name: "Zhang, Huiyin",
      matter_caption: "In re Zhang",
      practice_area: "Immigration",
      matter_type: "Asylum Application (Form I-589)",
      fee_model: "Flat Fee - Staged",
      flat_fee_total: 8000,
      court: "Executive Office for Immigration Review, Los Angeles Immigration Court",
      court_short: "LA Immigration Court",
      case_number: "A247-773-202",
      judicial_officer: "IJ Marisela Ocampo-Reyes",
      department: "Courtroom 4",
      status: "Closed",
      stage: "I-589 Filed",
      date_opened: "2024-09-02",
      date_closed: "2026-01-19",
      disposition: "Asylum granted",
      responsible_attorney: "TK-10",
      responsible_attorney_name: "Miguel Teran",
      recorded_hours: 31.9,
      fees_billed: 8000,
      collected: 8000,
      trust_balance: 0,
    },
  ],

  clients: [
    {
      _id: "cl-1",
      client_id: "CL-1123",
      client_name: "Pineda, Carmen",
      client_type: "Individual",
      first_name: "Carmen",
      last_name: "Pineda",
      primary_contact: "Carmen Pineda",
      preferred_language: "Spanish",
      address: "6614 Slauson Ave",
      city: "Van Nuys",
      state: "CA",
      zip: "91405",
      phone: "(626) 976-7073",
      email: "carmen.pineda@example.com",
      referral_source: "Spanish-language radio ad",
      intake_date: "2025-11-23",
      engagement_letter_date: "2025-11-24",
      conflict_check_result: "Cleared",
      photo_id_verified: true,
      responsible_attorney: "TK-02",
      responsible_attorney_name: "Marisol Alvarado",
      status: "Active",
      total_matters: 1,
      open_matters: 1,
    },
    {
      _id: "cl-2",
      client_id: "CL-1932",
      client_name: "Chen, Qing",
      client_type: "Individual",
      first_name: "Qing",
      last_name: "Chen",
      primary_contact: "Qing Chen",
      preferred_language: "Mandarin",
      address: "13986 Sunset Blvd",
      city: "Pasadena",
      state: "CA",
      zip: "91101",
      phone: "(626) 573-5156",
      email: "qingchen@example.com",
      referral_source: "Attorney referral",
      intake_date: "2026-05-28",
      conflict_check_result: "Cleared with waiver",
      responsible_attorney: "TK-09",
      responsible_attorney_name: "Priya Raghunathan",
      status: "Active",
      total_matters: 1,
      open_matters: 1,
    },
  ],

  timekeepers: [
    {
      _id: "tk-1",
      timekeeper_id: "TK-02",
      name: "Marisol Alvarado",
      first_name: "Marisol",
      last_name: "Alvarado",
      initials: "MRA",
      role: "Partner",
      billing_timekeeper: true,
      active: true,
      california_bar_number: 221340,
      bar_admission_date: "2003-06-02",
      standard_rate_2026: 525,
      hourly_cost_rate: 168,
      annual_target_hours: 1550,
      mcle_compliance_group: "Group 2",
      mcle_compliance_due: "2027-01-31",
    },
    {
      _id: "tk-2",
      timekeeper_id: "TK-16",
      name: "Guadalupe Ramirez",
      first_name: "Guadalupe",
      last_name: "Ramirez",
      initials: "GMR",
      role: "Senior Paralegal",
      billing_timekeeper: true,
      active: true,
      standard_rate_2026: 175,
      hourly_cost_rate: 55,
      annual_target_hours: 1400,
    },
  ],

  time_entries: [
    {
      _id: "te-1",
      time_entry_id: "TE-132216",
      date: "2026-07-19",
      matter_id: "MT-2987",
      matter_caption: "In re Marriage of Chen",
      client_id: "CL-1932",
      timekeeper_id: "TK-09",
      timekeeper: "Priya Raghunathan",
      role: "Partner",
      practice_area: "Family Law",
      phase: "L100",
      task_code: "L120",
      task_description: "Analysis/Strategy",
      activity_code: "A106",
      activity_description: "Communicate (with client)",
      narrative:
        "Conference with client regarding the mediation outcome and the tax treatment of the proposed support order.",
      hours: 1.1,
      standard_rate: 385,
      value_at_standard_rates: 423.5,
      billable: true,
      billed: false,
    },
    {
      _id: "te-2",
      time_entry_id: "TE-127126",
      date: "2026-04-26",
      matter_id: "MT-2018",
      matter_caption: "Pineda v. Bright Path",
      client_id: "CL-1123",
      timekeeper_id: "TK-16",
      timekeeper: "Guadalupe Ramirez",
      role: "Senior Paralegal",
      practice_area: "Personal Injury",
      phase: "L300",
      task_code: "L310",
      task_description: "Written Discovery",
      activity_code: "A103",
      activity_description: "Draft/revise",
      narrative:
        "Drafted responses to form interrogatories, set one, and assembled the supporting medical records.",
      hours: 2.4,
      standard_rate: 175,
      value_at_standard_rates: 420,
      billable: false,
      non_billable_reason: "Contingency - fee contingent on recovery",
      billed: false,
    },
  ],

  costs_and_disbursements: [
    {
      _id: "co-1",
      cost_id: "CO-46436",
      date: "2026-05-17",
      matter_id: "MT-2018",
      matter_caption: "Pineda v. Bright Path",
      client_id: "CL-1123",
      practice_area: "Personal Injury",
      expense_code: "E112",
      expense_category: "Court fees",
      description: "First appearance filing fee",
      vendor_payee: "Los Angeles Superior Court",
      amount: 435,
      advanced_by_firm: true,
      recoverable: true,
      paid_from: "Operating account",
      billed_to_client: false,
    },
    {
      _id: "co-2",
      cost_id: "CO-47440",
      date: "2026-07-14",
      matter_id: "MT-2987",
      matter_caption: "In re Marriage of Chen",
      client_id: "CL-1932",
      practice_area: "Family Law",
      expense_code: "E106",
      expense_category: "Online research",
      description: "Online legal research - support guideline authority",
      vendor_payee: "Westlaw (Thomson Reuters)",
      amount: 178.88,
      advanced_by_firm: true,
      recoverable: true,
      paid_from: "Operating account",
      billed_to_client: true,
    },
  ],

  invoices: [
    {
      _id: "inv-1",
      invoice_no: "INV-2026-1553",
      matter_id: "MT-2987",
      matter_caption: "In re Marriage of Chen",
      client_id: "CL-1932",
      client_name: "Chen, Qing",
      fee_model: "Hourly - Evergreen Retainer",
      period_start: "2026-05-31",
      period_end: "2026-06-29",
      issue_date: "2026-07-14",
      due_date: "2026-08-13",
      fees_at_billed_rates: 1154,
      invoice_total: 1154,
      applied_from_trust: 1154,
      payments_applied: 1154,
      balance_due: 0,
      status: "Paid",
      aging_bucket: "Paid",
      delivery_method: "Email (PDF)",
    },
    {
      _id: "inv-2",
      invoice_no: "INV-2026-1633",
      matter_id: "MT-2018",
      matter_caption: "Pineda v. Bright Path",
      client_id: "CL-1123",
      client_name: "Pineda, Carmen",
      fee_model: "Contingency",
      period_start: "2026-05-05",
      period_end: "2026-08-05",
      issue_date: "2026-08-09",
      due_date: "2026-09-08",
      costs_billed: 366.68,
      invoice_total: 366.68,
      balance_due: 366.68,
      status: "Open",
      days_outstanding: 9,
      aging_bucket: "1-30 days",
      delivery_method: "Client portal",
    },
  ],

  payments_and_receipts: [
    {
      _id: "py-1",
      payment_id: "PY-24789",
      date: "2026-07-20",
      client_id: "CL-1932",
      client_name: "Chen, Qing",
      matter_id: "MT-2987",
      amount: 1154,
      deposited_to: "Operating",
      method: "Trust transfer",
      payor: "Chen, Qing",
      reference: "Internal trust to operating",
      description: "Applied from client trust balance",
      invoice_no: "INV-2026-1553",
      returned_nsf: false,
    },
    {
      _id: "py-2",
      payment_id: "PY-26271",
      date: "2026-08-11",
      client_id: "CL-1932",
      client_name: "Chen, Qing",
      matter_id: "MT-2987",
      amount: 5000,
      deposited_to: "Trust",
      method: "Check",
      payor: "Chen, Qing",
      reference: "Check 4471",
      description: "Retainer replenishment",
      returned_nsf: false,
    },
  ],

  trust_ledger_cta: [
    {
      _id: "tr-1",
      transaction_id: "TR-60144",
      date: "2026-07-20",
      matter_id: "MT-2987",
      client_id: "CL-1932",
      client_name: "Chen, Qing",
      transaction_type: "Transfer to operating - earned fees",
      description: "Earned fees transferred to operating after billing",
      payee_payor: "Operating account",
      check_no: 7289,
      amount_in: 0,
      amount_out: 1154,
      matter_ledger_balance: 6500,
      trust_account_balance: 311675.64,
      bank_cleared_date: "2026-07-24",
      reconciliation_month: "2026-07-30",
    },
    {
      _id: "tr-2",
      transaction_id: "TR-64637",
      date: "2026-08-11",
      matter_id: "MT-2987",
      client_id: "CL-1932",
      client_name: "Chen, Qing",
      transaction_type: "Deposit - retainer replenishment",
      description: "Client replenished the evergreen retainer",
      payee_payor: "Chen, Qing",
      amount_in: 5000,
      amount_out: 0,
      matter_ledger_balance: 11500,
      trust_account_balance: 316675.64,
      bank_cleared_date: "2026-08-14",
      reconciliation_month: "2026-08-30",
    },
  ],

  court_calendar: [
    {
      _id: "ev-1",
      event_id: "EV-08050",
      date: "2026-08-30",
      time: "08:30",
      matter_id: "MT-2987",
      matter_caption: "In re Marriage of Chen",
      client_id: "CL-1932",
      case_number: "24STFL01188",
      event_type: "Case Management Conference",
      in_court: true,
      court_location: "LASC Family Law",
      department: "Dept. 85",
      judicial_officer: "Hon. Victor Aguilar-Sandoval",
      appearing_timekeeper: "TK-09",
      appearing_name: "Priya Raghunathan",
    },
    {
      _id: "ev-2",
      event_id: "EV-09749",
      date: "2026-10-19",
      time: "10:00",
      matter_id: "MT-2018",
      matter_caption: "Pineda v. Bright Path",
      client_id: "CL-1123",
      case_number: "24STCV03922",
      event_type: "Deposition",
      in_court: false,
      court_location: "Firm office",
      deponent_witness: "Guadalupe Villalobos",
      appearing_timekeeper: "TK-02",
      appearing_name: "Marisol Alvarado",
    },
  ],

  deadlines_and_sol: [
    {
      _id: "dl-1",
      deadline_id: "DL-06848",
      matter_id: "MT-2018",
      matter_caption: "Pineda v. Bright Path",
      client_id: "CL-1123",
      description: "Two-year limitations period on the personal injury claim",
      category: "Statute of Limitations",
      authority: "CCP 335.1",
      trigger_event: "Date of injury",
      trigger_date: "2025-10-07",
      computation: "Two years from the date of injury",
      due_date: "2027-10-07",
      days_remaining: 408,
      priority: "Critical",
      owner: "TK-02",
      owner_name: "Marisol Alvarado",
      status: "Open",
      calendared: true,
    },
    {
      _id: "dl-2",
      deadline_id: "DL-07610",
      matter_id: "MT-2987",
      matter_caption: "In re Marriage of Chen",
      client_id: "CL-1932",
      description: "Preliminary declaration of disclosure due",
      category: "Disclosure",
      authority: "Fam. Code 2104",
      trigger_event: "Service of petition",
      trigger_date: "2026-06-24",
      computation: "Sixty days from service",
      due_date: "2026-08-23",
      days_remaining: -2,
      priority: "High",
      owner: "TK-09",
      owner_name: "Priya Raghunathan",
      status: "Open",
      calendared: true,
    },
  ],

  intake_and_leads: [
    {
      _id: "ld-1",
      lead_id: "LD-3096",
      date_received: "2026-02-04",
      prospect_name: "Tolentino, Josefina",
      phone: "(424) 822-8650",
      referral_source: "Spanish-language radio ad",
      potential_claim_type: "Motor Vehicle Accident",
      disposition: "Signed",
      consultation_fee: 0,
      screened_by: "TK-07",
      converted_client_id: "CL-1123",
      matter_id: "MT-2018",
      notes: "Consultation held; engagement letter executed.",
    },
    {
      _id: "ld-2",
      lead_id: "LD-3349",
      date_received: "2026-05-10",
      prospect_name: "Bustamante, Cuauhtemoc",
      phone: "(747) 811-2756",
      referral_source: "Google search",
      potential_claim_type: "Premises Liability - Slip and Fall",
      disposition: "Declined",
      decline_reason: "Statute of limitations expired",
      consultation_fee: 0,
      screened_by: "TK-07",
      notes:
        "Incident date more than two years prior; no tolling identified. Advised to seek other counsel promptly.",
    },
  ],

  settlements_and_liens: [
    {
      _id: "st-1",
      settlement_id: "ST-0921",
      matter_id: "MT-2018",
      client_id: "CL-1123",
      client_name: "Pineda, Carmen",
      matter_type: "Motor Vehicle Accident",
      date_settled: "2026-02-19",
      fee_basis: "Pre-suit (33 1/3%)",
      gross_settlement: 273900,
      attorney_fee_rate: 0.3333,
      attorney_fee: 91290.87,
      costs_reimbursed_to_firm: 1458.68,
      liens_asserted: 4,
      liens_claimed: 38241.44,
      liens_paid: 16941.77,
      net_to_client: 164208.68,
      trust_deposit_date: "2026-03-15",
      disbursement_date: "2026-03-24",
      insurance_carrier: "State Farm Mutual",
      claim_number: "23-954458-D",
      statutory_liens: "No statutory lien asserted",
      lien_detail:
        "Wilshire Spine & Injury Center $7,039 to $2,962; Cedars Urgent Care $4,120 to $1,880.",
    },
  ],

  lookups: [
    {
      _id: "lk-1",
      list: "Practice Area",
      value: "Personal Injury",
      description: "Plaintiff-side bodily injury claims",
      authority_notes: "California",
    },
    {
      _id: "lk-2",
      list: "Limitations Period",
      code: "CCP 335.1",
      value: "2 years",
      description: "Personal injury",
      authority_notes: "California",
    },
  ],
};

export const DASHBOARD_SUMMARY = {
  matters: { total: 3, open: 2, closed: 1, open_rate: 66.7 },
  clients: { total: 2, active: 2 },
  deadlines: { total: 2, open: 2, due_30d: 1, overdue: 1 },
  time: { entries: 2, hours_month: 3.5, unbilled_hours: 1.1, wip_value: 423.5 },
  financials: {
    billed_month: 366.68,
    collected_month: 1154,
    ar_outstanding: 366.68,
    trust_balance: 316675.64,
  },
  calendar: { upcoming_30d: 1 },
  as_of: "2026-08",
};

export const DASHBOARD_CHARTS = {
  cashflow: [
    { month: "2026-03", billed: 4200, collected: 3900, net: -300 },
    { month: "2026-04", billed: 3800, collected: 4100, net: 300 },
    { month: "2026-05", billed: 4400, collected: 4400, net: 0 },
    { month: "2026-06", billed: 5100, collected: 4600, net: -500 },
    { month: "2026-07", billed: 1154, collected: 1154, net: 0 },
    { month: "2026-08", billed: 366.68, collected: 0, net: -366.68 },
  ],
  matter_status: [
    { name: "Open", value: 2 },
    { name: "Closed", value: 1 },
  ],
  practice_area: [
    { name: "Personal Injury", value: 1 },
    { name: "Family Law", value: 1 },
    { name: "Immigration", value: 1 },
  ],
  deadline_status: [{ name: "Open", value: 2 }],
  deadline_priority: [
    { name: "Critical", value: 1 },
    { name: "High", value: 1 },
  ],
  cost_breakdown: [
    { name: "Court Fees", value: 435 },
    { name: "Online Research", value: 178.88 },
  ],
  ar_aging: [
    { name: "1-30 Days", value: 366.68 },
    { name: "Paid", value: 0 },
  ],
};

/** Charts with every series empty — drives the "No data yet" branch. */
export const DASHBOARD_CHARTS_EMPTY = {
  cashflow: [],
  matter_status: [],
  practice_area: [],
  deadline_status: [],
  deadline_priority: [],
  cost_breakdown: [],
  ar_aging: [],
};

// ---- Saved reports --------------------------------------------------------

export const REPORT_TEMPLATES = [
  {
    id: "rpt-owner-statement",
    name: "Owner Statement",
    description: "Monthly income and expense summary per owner.",
    category: "Financial",
    mode: "sql",
    version: 3,
    created_by: "e2e.manager",
  },
  {
    id: "rpt-rent-roll",
    name: "Rent Roll",
    description: "Every active lease with contract and market rent.",
    category: "Leasing",
    mode: "sql",
    version: 1,
    created_by: "e2e.manager",
  },
  {
    id: "rpt-region-audit",
    name: "Region Audit",
    description: "Spend and occupancy for one region.",
    category: "Financial",
    mode: "sql",
    version: 2,
    created_by: "e2e.manager",
  },
];

/**
 * `Owner Statement` declares a required picker, so it renders only after the
 * user submits. `Rent Roll` has no parameters and renders on open — the two
 * branches of ReportSheet's seeding effect.
 */
export const REPORT_DETAILS: { [id: string]: Record<string, unknown> } = {
  "rpt-owner-statement": {
    id: "rpt-owner-statement",
    name: "Owner Statement",
    description: "Monthly income and expense summary per owner.",
    category: "Financial",
    mode: "sql",
    version: 3,
    parameters: [
      {
        name: "client_id",
        label: "Owner",
        type: "text",
        required: true,
        default: null,
        options: [
          { value: "O-001", label: "Harbourline Holdings" },
          { value: "O-002", label: "Devraj Family Trust" },
        ],
      },
      {
        name: "as_of",
        label: "As of",
        type: "date",
        required: false,
        default: "2025-11-30",
        options: [],
      },
    ],
  },
  "rpt-rent-roll": {
    id: "rpt-rent-roll",
    name: "Rent Roll",
    description: "Every active lease with contract and market rent.",
    category: "Leasing",
    mode: "sql",
    version: 1,
    parameters: [],
  },
  // A required input with neither a default nor a picker: nothing to seed
  // from, so ReportSheet leaves `applied` null and waits rather than
  // rendering on open. This is the branch that shows "Set the inputs above".
  "rpt-region-audit": {
    id: "rpt-region-audit",
    name: "Region Audit",
    description: "Spend and occupancy for one region.",
    category: "Financial",
    mode: "sql",
    version: 2,
    parameters: [
      {
        name: "region",
        label: "Region",
        type: "text",
        required: true,
        default: null,
        options: [],
      },
    ],
  },
};

export function reportHtml(title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: system-ui, sans-serif; margin: 24px; }
    h1 { font-size: 20px; }
  </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr><th>Property</th><th>Amount</th></tr></thead>
    <tbody><tr><td>P-001</td><td>$2,400</td></tr></tbody></table>
  </body></html>`;
}

// ---- Workflows ------------------------------------------------------------

export const WORKFLOWS = [
  {
    _id: "wf-1",
    name: "Monthly owner statements",
    trigger_kind: "cron",
    trigger_intent: "Render and email each owner their statement on the 1st.",
    trigger_spec: { expr: "0 6 1 * *", tz: "Asia/Kolkata" },
    active: true,
    pending_approval: false,
    // Live: this one really sends. The paused workflow below is the sandboxed
    // case, so the two axes are covered independently.
    sandbox: false,
    version: 2,
    next_run_at: "2025-12-01T06:00:00Z",
    plan: [
      {
        idx: 0,
        kind: "render_report",
        label: "Render Owner Statement",
        narration: "Runs the saved report for each owner.",
        template_id: "owner-statement",
        save_as: "statements",
      },
      {
        idx: 1,
        kind: "send_email",
        label: "Email clients",
        narration: "Attaches the rendered PDF.",
        to: "${statements.email}",
        subject: "Your monthly statement",
        body: "Attached.",
      },
      { idx: 2, kind: "finish", label: "Done", narration: "", summary: "Statements sent." },
    ],
    created_at: "2025-09-01T00:00:00Z",
  },
  {
    _id: "wf-2",
    name: "Emergency work order alert",
    trigger_kind: "event",
    trigger_intent: "Notify the on-call manager the moment a work order is filed as Emergency.",
    active: false,
    pending_approval: false,
    sandbox: true,
    version: 1,
    plan: [
      {
        idx: 0,
        kind: "sql_query",
        label: "Find emergency work orders",
        narration: "",
        sql: "SELECT * FROM legal.time_entries WHERE priority = 'Emergency'",
        save_as: "urgent",
      },
      {
        idx: 1,
        kind: "notify_user",
        label: "Page on-call manager",
        narration: "",
        title: "Emergency work order",
        body: "One just came in.",
        when: "${urgent}",
      },
    ],
    created_at: "2025-09-14T00:00:00Z",
  },
];

/**
 * A long plan, for the card grid.
 *
 * Deliberately NOT in `WORKFLOWS`: real automations run to a dozen steps, but
 * adding one to the shared seed moved every count assertion in three other
 * specs. The one spec that needs it routes it in.
 */
export const WORKFLOW_LONG =
  {
    _id: "wf-long",
    name: "Maintenance email intake & dispatch",
    trigger_kind: "inbound_email",
    trigger_spec: {},
    trigger_intent:
      "When a maintenance request arrives by email — from a tenant, or from someone writing on their behalf.",
    active: true,
    pending_approval: false,
    sandbox: false,
    version: 4,
    plan: [
      { idx: 0, kind: "llm_extract", label: "Read the request", narration: "Pulls out the issue, urgency and trade.", save_as: "req" },
      { idx: 1, kind: "sql_query", label: "Identify the tenant", narration: "Matches the sender against the tenant roll.", save_as: "tenant" },
      { idx: 2, kind: "sql_query", label: "Find the property", narration: "", save_as: "prop" },
      { idx: 3, kind: "insert_record", label: "Open a work order", narration: "Unassigned, before anyone is contacted.", save_as: "wo" },
      { idx: 4, kind: "send_email", label: "Acknowledge the request", narration: "" },
      { idx: 5, kind: "sql_query", label: "Shortlist a contractor", narration: "", save_as: "costs_and_disbursements" },
      { idx: 6, kind: "notify_user", label: "Ask before dispatching", narration: "Parks the run.", save_as: "decision" },
      { idx: 7, kind: "update_record", label: "Assign the contractor", narration: "", when: "${decision.approved}" },
      { idx: 8, kind: "create_calendar_event", label: "Book the visit", narration: "", when: "${decision.approved}" },
      { idx: 9, kind: "send_email", label: "Brief the contractor", narration: "", when: "${decision.approved}" },
      { idx: 10, kind: "send_email", label: "Confirm with the tenant", narration: "", when: "${decision.approved}" },
      { idx: 11, kind: "finish", label: "Done", narration: "", summary: "Request handled." },
    ],
    created_at: "2025-08-01T00:00:00Z",
  };

/**
 * A workflow the assistant built and nobody activated yet.
 *
 * Hidden from the Workflows page by default — which is why adding it does not
 * move the "2 workflow(s)" count the other specs assert — and reachable by
 * `?id=`, the link out of an Analyze thread.
 */
export const WORKFLOW_DRAFT = {
  _id: "wf-3",
  name: "Monthly payment timing report",
  trigger_kind: "cron",
  trigger_intent: "On the 10th of every month at 9:00 AM, email the report.",
  trigger_spec: { expr: "0 9 10 * *", tz: "Asia/Calcutta" },
  active: false,
  pending_approval: true,
  sandbox: true,
  version: 1,
  plan: [
    {
      idx: 0,
      kind: "render_report",
      label: "Render Payment Timing",
      narration: "",
      template_id: "payment-timing",
    },
  ],
  created_at: "2025-11-20T00:00:00Z",
};

/** Prior definitions, keyed by workflow — what the History tab reads. */
export const WORKFLOW_VERSIONS: { [workflowId: string]: Rec[] } = {
  "wf-1": [
    {
      // The engine mints synthetic ids for snapshots: "<workflow>.v<version>".
      _id: "wf-1.v1",
      version: 1,
      workflow_id: "wf-1",
      name: "Monthly owner statements",
      trigger_intent: "Email each owner their statement on the 1st.",
      plan: [{ idx: 0, kind: "render_report", label: "Render Owner Statement", narration: "" }],
      created_at: "2025-09-01T00:00:00Z",
    },
  ],
};

export const WORKFLOW_RUNS = [
  {
    _id: "run-1",
    workflow_id: "wf-1",
    status: "succeeded",
    started_at: "2025-11-01T06:00:00Z",
    ended_at: "2025-11-01T06:00:12Z",
  },
  {
    _id: "run-2",
    workflow_id: "wf-1",
    status: "failed",
    started_at: "2025-10-01T06:00:00Z",
    ended_at: "2025-10-01T06:00:04Z",
    error: "SMTP timeout",
  },
  {
    _id: "run-3",
    workflow_id: "wf-2",
    status: "running",
    started_at: "2025-11-09T11:30:00Z",
  },
];

/**
 * What each run actually did, keyed by run — the timeline `GET
 * /api/workflows/runs/<id>` returns alongside the run.
 *
 * The engine writes two rows per plan step at the same `idx`: a `tool_call`
 * carrying the payload it is about to send (with `${…}` already resolved) and a
 * `tool_result` carrying what came back. The fixtures keep that pairing,
 * because the UI's whole job here is to show the resolved call next to its
 * outcome — a flattened list of one row per step would let a regression in that
 * pairing pass unnoticed.
 */
export const WORKFLOW_RUN_STEPS: { [runId: string]: Rec[] } = {
  "run-1": [
    {
      _id: "rs-1",
      run_id: "run-1",
      idx: 0,
      role: "tool_call",
      created_at: "2025-11-01T06:00:01Z",
      content: "[Render Owner Statement] Runs the saved report for each owner.",
      tool_name: "render_report",
      tool_args: { template_id: "owner-statement" },
    },
    {
      _id: "rs-2",
      run_id: "run-1",
      idx: 0,
      role: "tool_result",
      created_at: "2025-11-01T06:00:06Z",
      content: "",
      tool_name: "render_report",
      tool_result: [
        { name: "Meridian Holdings", email: "owner@meridian.test", html: "<h1>Statement</h1>" },
      ],
    },
    {
      _id: "rs-3",
      run_id: "run-1",
      idx: 1,
      role: "tool_call",
      created_at: "2025-11-01T06:00:07Z",
      content: "[Email clients] Attaches the rendered PDF.",
      tool_name: "send_email",
      tool_args: {
        to: "owner@meridian.test",
        subject: "Your monthly statement",
        body: "Attached.",
      },
    },
    {
      _id: "rs-4",
      run_id: "run-1",
      idx: 1,
      role: "tool_result",
      created_at: "2025-11-01T06:00:11Z",
      content: "",
      tool_name: "send_email",
      tool_result: { ok: true, sent: 1 },
    },
  ],
  "run-2": [
    {
      _id: "rs-5",
      run_id: "run-2",
      idx: 0,
      role: "tool_call",
      created_at: "2025-10-01T06:00:01Z",
      content: "[Count overdue invoices] Finds every lease past its due date.",
      tool_name: "sql_query",
      tool_args: { sql: "SELECT _id, rent FROM legal.invoices WHERE status = 'overdue'" },
    },
    {
      _id: "rs-6",
      run_id: "run-2",
      idx: 0,
      role: "tool_result",
      created_at: "2025-10-01T06:00:02Z",
      content: "",
      tool_name: "sql_query",
      tool_result: [{ _id: "L-001", rent: 2400 }],
    },
    {
      _id: "rs-7",
      run_id: "run-2",
      idx: 1,
      role: "tool_result",
      created_at: "2025-10-01T06:00:04Z",
      content: "send_email failed",
      tool_name: "send_email",
      tool_result: { error: "SMTP timeout" },
    },
  ],
  // Mid-flight: one call written, no result yet. This is what the timeline
  // looks like the moment someone opens a running rehearsal.
  "run-3": [
    {
      _id: "rs-8",
      run_id: "run-3",
      idx: 0,
      role: "tool_call",
      created_at: "2025-11-09T11:30:01Z",
      content: "[Notify the on-call manager] Pages whoever is on call.",
      tool_name: "notify_user",
      tool_args: { message: "Emergency work order filed." },
    },
  ],
};

// ---- The inbox -----------------------------------------------------------

/**
 * What the automations have left for a person.
 *
 * The three states the page distinguishes are all here, because they behave
 * differently and each has been a bug at least once: `n-1` is a run parked on a
 * decision (actions, unanswered — the only kind that holds a run open), `n-2` is
 * the same thing after it was answered (actions, resolved — buttons stay
 * visible but disabled), and `n-3` is a bell (no actions, can never be
 * answered, must never count toward the badge).
 *
 * `n-1`'s body is the shape the real intake produces: light HTML with values
 * interpolated from an inbound email. The `<img onerror>` in `n-4` is what an
 * attacker gets to put there, and is what the sanitiser has to survive.
 */
export const NOTIFICATIONS: Rec[] = [
  {
    _id: "n-1",
    title: "Assign a contractor: kitchen tap dripping",
    body:
      "<p><strong>High priority</strong> — Plumbing</p>" +
      "<p><strong>Property:</strong> 12 Marine Drive, Mumbai<br>" +
      "<strong>Tenant:</strong> Meera Iyer (meera.iyer@example.com)<br>" +
      "<strong>Reported:</strong> Kitchen tap dripping constantly for three days</p>" +
      "<p><strong>Recommended:</strong> Coastal Plumbing — Plumbing, rated 4.6, Ravi N.</p>",
    actions: [
      { id: "approve", label: "Assign the recommended contractor", kind: "approve" },
      {
        id: "choose",
        label: "Assign a different contractor",
        kind: "form",
        form_fields: [
          { name: "vendor", type: "text", required: true, label: "Contractor (company name)" },
        ],
      },
      { id: "decline", label: "Not now", kind: "decline" },
    ],
    workflow_id: "wf-intake",
    run_id: "run-intake",
    step_idx: 6,
    created_at: "2026-08-11T06:42:00Z",
    // Explicit nulls, because that is what InventDB sends for an unanswered,
    // unread notification — and `contract.spec.ts` compares the key sets.
    read_at: null,
    resolved_action: null,
  },
  {
    _id: "n-2",
    title: "Approve overtime call-out: no hot water",
    body: "<p>Nimbus Air quoted an out-of-hours call-out.</p>",
    actions: [
      { id: "approve", label: "Approve the call-out", kind: "approve" },
      { id: "decline", label: "Not now", kind: "decline" },
    ],
    workflow_id: "wf-intake",
    run_id: "run-1",
    created_at: "2026-08-09T18:05:00Z",
    read_at: "2026-08-09T18:20:00Z",
    resolved_action: "approve",
    resolved_at: "2026-08-09T18:22:00Z",
  },
  {
    _id: "n-3",
    title: "Monthly owner statements sent",
    body: "12 clients were emailed their statement.",
    actions: [],
    workflow_id: "wf-1",
    run_id: "run-1",
    created_at: "2026-08-01T06:00:12Z",
    read_at: "2026-08-01T08:00:00Z",
  },
  {
    _id: "n-4",
    title: "Assign a contractor: front door lock jammed",
    // The "issue" here is text a stranger emailed the office, interpolated into
    // the body by the plan. Rendering it as markup would run it.
    body:
      "<p><strong>Reported:</strong> lock jammed " +
      "<img src=x onerror=\"window.__xss=1\"> " +
      "<a href=\"javascript:window.__xss=1\">click</a> " +
      "<script>window.__xss=1</script></p>",
    actions: [{ id: "approve", label: "Assign the recommended contractor", kind: "approve" }],
    workflow_id: "wf-intake",
    run_id: "run-intake",
    created_at: "2026-08-11T05:00:00Z",
  },
];

/** The run behind the parked approval — its trail is shown under the decision. */
export const INTAKE_RUN = {
  _id: "run-intake",
  workflow_id: "wf-intake",
  status: "parked",
  started_at: "2026-08-11T06:41:40Z",
  sandbox: false,
};

export const INTAKE_RUN_STEPS: Rec[] = [
  {
    _id: "irs-1",
    run_id: "run-intake",
    idx: 0,
    role: "tool_call",
    created_at: "2026-08-11T06:41:41Z",
    content: "[Read the request] Pulls out what is broken and how urgent it is.",
    tool_name: "llm_extract",
  },
  {
    _id: "irs-2",
    run_id: "run-intake",
    idx: 3,
    role: "tool_result",
    created_at: "2026-08-11T06:41:49Z",
    content: "",
    tool_name: "insert_record",
    tool_result: { ok: true, _id: "te-new", id: "WO-1003" },
  },
  {
    _id: "irs-3",
    run_id: "run-intake",
    idx: 4,
    role: "tool_call",
    created_at: "2026-08-11T06:41:52Z",
    content: "[Acknowledge the request] Replies to whoever wrote in.",
    tool_name: "send_email",
    tool_args: { to: "meera.iyer@example.com", subject: "Re: dripping tap" },
  },
  {
    _id: "irs-4",
    run_id: "run-intake",
    idx: 5,
    role: "tool_result",
    created_at: "2026-08-11T06:41:58Z",
    content: "",
    tool_name: "sql_query",
    tool_result: [
      { company: "Coastal Plumbing", trade: "Plumbing", rating: 4.6, coi_on_file: true },
    ],
  },
  // Out of order on purpose, and sharing idx 0 with the call above it. The
  // engine orders run steps `BY idx ASC` and nothing more, so the rows it
  // writes at one idx — the call, any recovery it needed, then the result —
  // come back in whatever order storage returns them.
  {
    _id: "irs-0-result",
    run_id: "run-intake",
    idx: 0,
    role: "tool_result",
    created_at: "2026-08-11T06:41:45Z",
    content: "",
    tool_name: "llm_extract",
    tool_result: { issue: "Kitchen tap dripping", trade: "Plumbing" },
  },
];

// ---- SQL rollups used by the Reports hooks -------------------------------

export const PNL = {
  billed_total: 25200,
  collected_total: 22150,
  write_downs_total: 1315,
  costs_total: 6815,
  realization: 87.9,
  billed_by_practice: [
    { name: "Family Law", value: 14200 },
    { name: "Personal Injury", value: 11000 },
  ],
  costs_by_category: [
    { name: "Court Fees", value: 4965 },
    { name: "Online Research", value: 1850 },
  ],
};

export const WIP = {
  rows: [
    {
      matter_id: "MT-2987",
      matter_caption: "In re Marriage of Chen",
      practice_area: "Family Law",
      client_name: "Chen, Qing",
      responsible_attorney_name: "Priya Raghunathan",
      status: "Open",
      entries: 4,
      hours: 6.3,
      value: 2425.5,
    },
  ],
  count: 1,
  total_hours: 6.3,
  total_value: 2425.5,
};

export const DEADLINES_DUE = { rows: [], count: 0, days: 30, overdue: 0, critical: 0 };

export const CASELOAD = {
  by_status: [
    { name: "Open", value: 2 },
    { name: "Closed", value: 1 },
  ],
  by_practice_area: [
    { name: "Personal Injury", value: 1 },
    { name: "Family Law", value: 1 },
    { name: "Immigration", value: 1 },
  ],
  by_responsible_attorney: [
    { name: "Marisol Alvarado", value: 1 },
    { name: "Priya Raghunathan", value: 1 },
    { name: "Miguel Teran", value: 1 },
  ],
  total: 3,
  open: 2,
  open_rate: 66.7,
};

export const TIME_ENTRIES_REPORT = {
  by_task: [
    { name: "Analysis/Strategy", value: 1 },
    { name: "Written Discovery", value: 1 },
  ],
  by_activity: [
    { name: "Communicate (with Client)", value: 1 },
    { name: "Draft/revise", value: 1 },
  ],
  by_timekeeper: [
    { name: "Priya Raghunathan", value: 1.1 },
    { name: "Guadalupe Ramirez", value: 2.4 },
  ],
  unbilled_value: 423.5,
};

export const AR_AGING = {
  buckets: [
    { name: "1-30 Days", invoices: 1, value: 366.68 },
    { name: "Paid", invoices: 1, value: 0 },
  ],
  by_status: [
    { name: "Open", value: 366.68 },
    { name: "Paid", value: 0 },
  ],
  outstanding_total: 366.68,
};

export const TRUST_COMPLIANCE = {
  amount_in: 5000,
  amount_out: 1154,
  trust_balance: 3846,
  negative_ledgers: [],
  negative_count: 0,
  by_transaction_type: [
    { name: "Transfer to Operating - Earned Fees", value: 1 },
    { name: "Deposit - Retainer Replenishment", value: 1 },
  ],
};

// ---- Analyze --------------------------------------------------------------
// The agent stream is the one response the frontend parses itself, so the
// fixtures below are shaped exactly like InventDB's own `AgentStep` frames —
// captured from a live turn on the sandbox instance, then trimmed.

export const ANALYZE_MODELS = [
  {
    key: "claude-sonnet-5",
    family: "Claude",
    display: "Claude Sonnet 5",
    is_reasoning: true,
  },
  {
    key: "claude-opus-4-8",
    family: "Claude",
    display: "Claude Opus 4.8",
    is_reasoning: true,
  },
];

/** One complete turn: reasoning, a plan, a query with rows, then the answer. */
export const AGENT_STEPS: Record<string, unknown>[] = [
  { type: "info", content: "Analyzing your question..." },
  { type: "reasoning", content: "", executionTimeMs: 214 },
  { type: "info", content: "Drafting a plan" },
  {
    type: "sql",
    content: "Executing query...",
    sql: "SELECT city, COUNT(*) AS cnt FROM legal.matters GROUP BY city ORDER BY cnt DESC LIMIT 3",
  },
  {
    type: "result",
    content: "Query returned 3 rows",
    sql: "SELECT city, COUNT(*) AS cnt FROM legal.matters GROUP BY city ORDER BY cnt DESC LIMIT 3",
    data: [
      { practice_area: "Personal Injury", cnt: 155 },
      { practice_area: "Immigration", cnt: 149 },
      { practice_area: "Estate Planning", cnt: 126 },
    ],
    executionTimeMs: 3,
  },
  {
    type: "chart",
    content: "Matters by Practice Area",
    chart: {
      data: [
        {
          type: "bar",
          x: ["Personal Injury", "Immigration", "Estate Planning"],
          y: [155, 149, 126],
          marker: { color: "#3b82f6" },
        },
      ],
      layout: { title: { text: "Matters by Practice Area" } },
    },
  },
  {
    type: "done",
    content:
      "Your three busiest practice areas are **Personal Injury** (155), " +
      "**Immigration** (149) and **Estate Planning** (126).",
  },
  {
    type: "suggestions",
    content: "",
    chart: {
      followups: ["Which practice area bills the most per hour?"],
      actions: ["Email this breakdown to the partners"],
    },
  },
];

/** A turn that proposes a record change instead of answering. */
export const AGENT_PROPOSAL_STEPS: Record<string, unknown>[] = [
  { type: "info", content: "Building the form" },
  {
    type: "form",
    content: "Create a cost",
    chart: {
      operation: "insert",
      entities: [
        {
          namespace: "legal",
          typeName: "costs_and_disbursements",
          existingData: {
            vendor_payee: "Barkley Court Reporters",
            expense_category: "Deposition transcripts",
          },
        },
      ],
    },
  },
];

/**
 * A "Describe it" turn: the form's fields, read back out of a sentence.
 *
 * The values are deliberately in the shapes a model actually returns rather
 * than the ones the form wants — a lowercase choice, an owner named instead of
 * keyed, "$2,100" with its symbol and separator, a date written out in words,
 * and a `not_a_field` key the module never declared. Coercion is the whole
 * feature; a fixture that arrived pre-cleaned would test nothing.
 */
export const DESCRIBE_MATTER_STEPS: Record<string, unknown>[] = [
  { type: "info", content: "Reading the description" },
  {
    type: "done",
    content: JSON.stringify({
      matter_caption: "Pineda v. Bright Path",
      client_id: "Pineda, Carmen",
      client_name: "Pineda, Carmen",
      practice_area: "personal injury",
      matter_type: "Motor Vehicle Accident",
      status: "open",
      stage: "Pre-Litigation Demand",
      fee_model: "contingency",
      court_short: "lasc stanley mosk",
      case_number: "24STCV03922",
      opposing_party: "Bright Path Childcare Centers, Inc.",
      insurance_carrier: "State Farm Mutual",
      claim_number: "23-954458-D",
      retainer_amount: "$2,100",
      date_opened: "March 4, 2026",
      not_a_field: "ignored",
    }),
  },
];

/** The same turn, wrapped in the prose and code fence the prompt asked it not to use. */
export const DESCRIBE_FENCED_STEPS: Record<string, unknown>[] = [
  {
    type: "done",
    content: [
      "Here are the fields I could read:",
      "",
      "```json",
      JSON.stringify(
        { matter_caption: "Ortega v. Verdugo Hills", client_name: "Ortega, Ruben" },
        null,
        2
      ),
      "```",
      "",
      "Let me know if you'd like anything changed.",
    ].join("\n"),
  },
];

/** A turn offering a choice that isn't one, and a client nobody has on file. */
export const DESCRIBE_UNRESOLVED_STEPS: Record<string, unknown>[] = [
  {
    type: "done",
    content: JSON.stringify({
      matter_caption: "Wexford v. Kestrel Holdings",
      status: "Under appeal",
      client_id: "Wexford Partners",
    }),
  },
];

/**
 * A turn that builds an automation.
 *
 * `create_workflow` emits a `workflow` step whose `chart.initial` is the saved
 * record — the whole thing, plan included — plus any `issues` InventDB still
 * has with the plan it just accepted. `_id` points at a workflow the mock API
 * knows, because the card refetches the live definition rather than trusting
 * the snapshot the thread is carrying.
 */
export const AGENT_WORKFLOW_STEPS: Record<string, unknown>[] = [
  { type: "info", content: "Working out what should happen, and when" },
  {
    type: "workflow",
    content: "Created workflow 'Monthly owner statements'",
    chart: {
      name: "Monthly owner statements",
      workflow_id: "wf-1",
      initial: WORKFLOWS[0],
      issues: [
        { step_idx: 1, severity: "warning", message: "No recipients matched the filter yet." },
      ],
    },
  },
  { type: "done", content: "Built it. It rehearses until you activate it." },
];

// ---- Files ---------------------------------------------------------------
/**
 * The drive.
 *
 * `folder_path: ""` is a file at its type's root — one that was never put in a
 * folder — which the tree counts on the type node rather than under any folder.
 * The set spans two types on purpose: the tree groups by type first, and a
 * same-named folder in two types must not merge.
 */
export const FILES: Rec[] = [
  {
    _id: "att-1",
    attachment_id: "att-1",
    namespace: "legal",
    record_type: "invoices",
    record_id: "inv-1",
    filename: "signed-lease.pdf",
    content_type: "application/pdf",
    size_bytes: 284113,
    version: 2,
    folder_path: "2026",
    created_at: "2026-01-04T09:12:00Z",
    processing_state: "indexed",
  },
  {
    _id: "att-2",
    attachment_id: "att-2",
    namespace: "legal",
    record_type: "invoices",
    // `_vault` is InventDB's "no parent record yet" — what a drive-level
    // upload produces, here or in SOAR's Files room. Attaching is what gives
    // it a home, so one fixture file has to be in this state.
    record_id: "_vault",
    filename: "rent-schedule.xlsx",
    content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size_bytes: 18442,
    version: 1,
    folder_path: "",
    created_at: "2025-11-02T10:00:00Z",
    processing_state: "indexed",
  },
  {
    _id: "att-3",
    attachment_id: "att-3",
    namespace: "legal",
    record_type: "court_calendar",
    record_id: "ev-1",
    filename: "kitchen.jpg",
    content_type: "image/jpeg",
    size_bytes: 903221,
    version: 1,
    folder_path: "2026/photos",
    created_at: "2026-02-11T08:30:00Z",
    processing_state: "indexed",
  },
];

/** What the tree is built from — counts per (type, folder), never from results. */
export const FILE_FOLDERS = [
  { namespace: "legal", type: "invoices", path: "", count: 1 },
  { namespace: "legal", type: "invoices", path: "2026", count: 1 },
  { namespace: "legal", type: "court_calendar", path: "2026/photos", count: 1 },
];

export const FILE_VERSIONS: { [attachmentId: string]: Rec[] } = {
  "att-1": [
    {
      _id: "att-1.v2",
      version: 2,
      filename: "signed-lease.pdf",
      size: 284113,
      created_at: "2026-01-04T09:12:00Z",
      is_current: true,
    },
    {
      _id: "att-1.v1",
      version: 1,
      filename: "draft-lease.pdf",
      size: 210004,
      created_at: "2025-12-19T14:02:00Z",
      is_current: false,
    },
  ],
};

export const FILE_TEXT: { [attachmentId: string]: string } = {
  "att-1": "RESIDENTIAL LEASE AGREEMENT — 12 Marine Drive, Mumbai. Term 36 months.",
};

/** Serialise steps as the SSE frames the backend relays. */
export function sseBody(steps: Record<string, unknown>[]): string {
  return steps.map((s) => `event: message\ndata: ${JSON.stringify(s)}\n\n`).join("");
}

export const ANALYZE_THREADS = [
  {
    _id: "soar_thread-1",
    label: "Rent roll by property type",
    created: "2026-03-01T09:00:00.000Z",
    _exchanges: [
      {
        question: "Rent roll by property type",
        answer: "Single-family homes carry **$48,200** of the monthly roll.",
        ts: "2026-03-01T09:00:04.000Z",
        steps: [
          {
            type: "sql",
            sql: "SELECT type, SUM(market_rent) AS total FROM legal.matters GROUP BY type",
            ms: 4,
          },
        ],
        artifacts: [],
      },
    ],
  },
];

// ---- Report Studio --------------------------------------------------------

/** A frozen render the assistant stored — the second kind of report. */
export const REPORT_SNAPSHOTS = [
  {
    record_id: "report_20260811_055342",
    attachment_id: "att-rentroll-1",
    name: "Rent Roll — All Properties",
    created_at: "2026-08-11T05:53:42Z",
    from_template: false,
  },
];

/** The report agent's edit stream, shaped exactly as InventDB emits it. */
export function reportEditSse(templateId: string, version: number): string {
  return [
    `event: start
data: ${JSON.stringify({ template_id: templateId, current_version: version - 1 })}

`,
    `event: reasoning
data: ${JSON.stringify({ content: "", tokens: 406 })}

`,
    `event: html
data: ${JSON.stringify({ html: "<h1>Edited</h1>" })}

`,
    `event: saved
data: ${JSON.stringify({ template_id: templateId, version })}

`,
    `event: done
data: {}

`,
  ].join("");
}

/**
 * Saved views, keyed by module.
 *
 * Empty on purpose: every module starts with no views, so the specs that
 * predate this feature see exactly the list they always did. A spec that needs
 * one creates it through the UI, which is also what exercises the save path.
 */
export interface SavedViewFixture {
  id: string;
  name: string;
  search: string;
  sort: { col: string; dir: "asc" | "desc" } | null;
  is_default: boolean;
  mode: "table" | "custom";
  template_id: string | null;
  base_sql: string;
}

/** What the mocked designer returns — a layout plus the query to drive it. */
/**
 * A layout shaped like one the designer really returns: kit classes, a card per
 * record, long values that would overflow a careless layout. Built to a count so
 * a spec can render a tall page and check nothing is clipped.
 */
export function designedLayout(entity: string, count = 12, page = 0): string {
  const card = (i: number) => `
    <div class="vk-card">
      <div class="vk-card-head">
        <div><div class="vk-title">${entity} record ${page * 100 + i}</div>
        <div class="vk-sub">Richmond, VA</div></div>
        <span class="vk-badge is-ok">Active</span>
      </div>
      <div class="vk-figures">
        <div class="vk-figure"><b>$2,100</b><span>Rent</span></div>
        <div class="vk-figure"><b>10%</b><span>Fee</span></div>
      </div>
      <div class="vk-rows">
        <div class="vk-row"><span>Email</span><b>a.very.long.address${i}@team758135.testinator.email</b></div>
        <div class="vk-row"><span>Phone</span><b>(540) 555-50${String(i).padStart(2, "0")}</b></div>
      </div>
      <div class="vk-foot">4522 Pocahontas Tr, Charlottesville, VA 20191</div>
    </div>`;
  return `<html><head><style>
    /* The kind of page styling a model emits unprompted — the app has to
       survive it, so the fixture keeps it. */
    html,body{height:100vh;margin:0;overflow:auto}
    .vk-grid{max-height:70vh;overflow-y:auto}
  </style></head><body>
    <div class="vk-grid" data-page="${page}">
      ${Array.from({ length: count }, (_, i) => card(i + 1)).join("")}
    </div>
  </body></html>`;
}

export const DESIGNED_LAYOUT = designedLayout("record");

export const SAVED_VIEWS: { [entity: string]: SavedViewFixture[] } = {};
