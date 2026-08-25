// Declarative field configuration for every Legal module.
// These field names match the live InventDB `legal` namespace schema exactly,
// so tables, forms and detail views read and write the real data directly.
//
// The controlled vocabularies below (practice areas, UTBMS codes, aging
// buckets, trust transaction types …) are the ones the `legal.lookups` type
// publishes. They are spelled here exactly as they are stored, because a select
// that writes "Personal injury" into a column holding "Personal Injury" makes a
// record that no filter, report or workflow will ever find again.

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "boolean"
  | "email"
  | "tel";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  /** Reference another entity; offers that entity's records as suggestions. */
  ref?: string;
  /** Show this field as a column in the list table. */
  table?: boolean;
  /** Render the value as a coloured status badge. */
  badge?: boolean;
  placeholder?: string;
  step?: number;
  /** Layout hint for the form grid. */
  full?: boolean;
}

export interface EntityConfig {
  name: string;
  label: string;
  labelPlural: string;
  key: string;
  icon: string;
  /** Fields used to build a display title for a record. */
  titleFields: string[];
  /** Hide the leading business-key column (for types without a real id). */
  hideKeyColumn?: boolean;
  /**
   * The example under "Describe it" on the New <type> form.
   *
   * Worth writing per module rather than generating: the example is what tells
   * someone how much detail is useful, and it only does that if it reads like
   * something they would actually have typed about *this* kind of record.
   */
  describeExample: string;
  fields: FieldDef[];
  defaultSort?: { field: string; dir: "asc" | "desc" };
}

// ---- Shared vocabularies (from `legal.lookups`) ----------------------------

const PRACTICE_AREAS = [
  "Appellate",
  "Bankruptcy",
  "Business Litigation",
  "Business Transactional",
  "Civil Rights",
  "Criminal Defense",
  "Employment",
  "Entertainment",
  "Estate Planning",
  "Family Law",
  "Immigration",
  "Insurance Defense",
  "Intellectual Property",
  "Landlord / Tenant",
  "Medical Malpractice",
  "Personal Injury",
  "Probate and Trust Administration",
  "Real Estate",
  "Workers Compensation",
];

const FEE_MODELS = [
  "Contingency",
  "Flat Fee",
  "Flat Fee - Staged",
  "Hourly - Evergreen Retainer",
  "Hourly - Insurance Panel",
  "Hourly - Trust Retainer",
  "MICRA Contingency",
  "Pro Bono",
  "Statutory Contingency - WCAB",
  "Statutory Fee - Probate",
];

const COURTS = [
  "C.D. Cal.",
  "Court of Appeal, 2d Dist.",
  "LA Immigration Court",
  "LASC Family Law",
  "LASC Foltz CJC",
  "LASC Probate",
  "LASC Spring Street",
  "LASC Stanley Mosk",
  "LASC Unlawful Detainer",
  "LASC Van Nuys",
  "U.S. Bankruptcy Court",
  "USCIS",
  "USPTO / TTAB",
  "WCAB Los Angeles",
];

const TIMEKEEPER_ROLES = [
  "Managing Partner",
  "Partner",
  "Of Counsel",
  "Senior Associate",
  "Associate",
  "Senior Paralegal",
  "Paralegal",
  "Intake Coordinator / Legal Assistant",
  "Office Manager / Bookkeeper",
];

const REFERRAL_SOURCES = [
  "Accountant or financial adviser",
  "Attorney referral",
  "Bar association LRS",
  "Church or temple referral",
  "Community organization",
  "Consulate or community centre",
  "Family or friend",
  "Former client referral",
  "Google search",
  "Realtor referral",
  "Repeat client",
  "Spanish-language radio ad",
  "Union or worker centre",
  "Walk-in",
];

const LANGUAGES = ["English", "Spanish", "Korean", "Mandarin", "Armenian", "Farsi", "Tagalog"];

/** Phase codes L100–L500, in the order the ABA set defines them. */
const UTBMS_PHASE_CODES = ["L100", "L200", "L300", "L400", "L500"];

/** The litigation task set. Values pair with the codes in `UTBMS_TASK_CODES`. */
const UTBMS_TASKS = [
  "Fact Investigation/Development",
  "Analysis/Strategy",
  "Experts/Consultants",
  "Document/File Management",
  "Budgeting",
  "Settlement/Non-Binding ADR",
  "Other Case Assessment, Development and Administration",
  "Pleadings",
  "Preliminary Injunctions/Provisional Remedies",
  "Court Mandated Conferences",
  "Dispositive Motions",
  "Other Written Motions and Submissions",
  "Written Discovery",
  "Document Production",
  "Depositions",
  "Expert Discovery",
  "Discovery Motions",
  "Other Discovery",
  "Fact Witnesses",
  "Expert Witnesses",
  "Written Motions and Submissions",
  "Other Trial Preparation and Support",
  "Trial and Hearing Attendance",
  "Post-Trial Motions and Submissions",
  "Enforcement",
  "Appellate Briefs",
  "Oral Argument",
];

const UTBMS_ACTIVITIES = [
  "Plan and prepare for",
  "Research",
  "Draft/revise",
  "Review/analyze",
  "Communicate (with client)",
  "Communicate (in firm)",
  "Communicate (other external)",
  "Communicate (other outside counsel)",
  "Appear for/attend",
  "Manage data/files",
  "Other",
];

const UTBMS_EXPENSES = [
  "Arbitrators/mediators",
  "Copying",
  "Court fees",
  "Delivery services/messengers",
  "Deposition transcripts",
  "Experts",
  "Facsimile",
  "Litigation support vendors",
  "Local counsel",
  "Local travel",
  "Meals",
  "Online research",
  "Other",
  "Other professionals",
  "Out-of-town travel",
  "Outside printing",
  "Postage",
  "Private investigators",
  "Subpoena fees",
  "Telephone",
  "Trial exhibits",
  "Trial transcripts",
  "Witness fees",
  "Word processing",
];

const CALENDAR_EVENT_TYPES = [
  "Arraignment",
  "Case Management Conference",
  "Child Custody Recommending Counseling",
  "Default Prove-Up Hearing",
  "Demurrer Hearing",
  "Deposition",
  "Disposition / Sentencing",
  "DMV Administrative Per Se Hearing",
  "Ex Parte Application",
  "Final Status Conference",
  "Judgment Debtor Examination",
  "Judgment Hearing",
  "Jury Trial",
  "Mediation",
  "Motion for Summary Judgment Hearing",
  "Motion to Compel Further Responses",
  "Motion to Dismiss Hearing",
  "Post-Mediation Status Conference",
  "Preliminary Hearing",
  "Pretrial Conference",
  "Pretrial Conference (Rule 16)",
  "Rule 16 Scheduling Conference",
  "Status Conference",
  "Trial Setting Conference",
  "Unlawful Detainer Trial",
];

const HEARING_TIMES = ["08:30", "09:00", "10:00", "10:30", "13:30", "14:00"];

export const ENTITIES: EntityConfig[] = [
  {
    name: "matters",
    label: "Matter",
    labelPlural: "Matters",
    key: "matter_id",
    icon: "briefcase",
    titleFields: ["matter_caption"],
    defaultSort: { field: "date_opened", dir: "desc" },
    describeExample:
      "New personal injury matter for Carmen Pineda — rear-end collision on the 110 on 4 August, opposing party Bright Path Childcare, carrier State Farm, claim 23-954458-D. Pre-suit contingency at 33 1/3%, Marisol Alvarado responsible.",
    fields: [
      { name: "matter_caption", label: "Caption", type: "text", required: true, table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients", table: true },
      { name: "client_name", label: "Client Name", type: "text" },
      {
        name: "practice_area",
        label: "Practice Area",
        type: "select",
        options: PRACTICE_AREAS,
        table: true,
      },
      { name: "matter_type", label: "Matter Type", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["Open", "Closed"],
        table: true,
        badge: true,
      },
      { name: "stage", label: "Stage", type: "text", table: true },
      { name: "fee_model", label: "Fee Model", type: "select", options: FEE_MODELS, table: true },
      { name: "fee_terms", label: "Fee Terms", type: "textarea", full: true },
      { name: "flat_fee_total", label: "Flat Fee Total", type: "currency" },
      { name: "contingency_pre_suit", label: "Contingency (pre-suit)", type: "number", step: 0.0001 },
      { name: "contingency_post_filing", label: "Contingency (post-filing)", type: "number", step: 0.0001 },
      { name: "volume_discount", label: "Volume Discount", type: "number", step: 0.01 },
      {
        name: "rate_tier",
        label: "Rate Tier",
        type: "select",
        options: [
          "Standard",
          "Discounted 5%",
          "Discounted 10%",
          "Insurance panel (28% off standard)",
          "Pro Bono",
        ],
      },
      { name: "trust_required", label: "Trust Required", type: "boolean" },
      { name: "retainer_amount", label: "Retainer Amount", type: "currency" },
      { name: "replenish_threshold", label: "Replenish Threshold", type: "currency" },
      { name: "pro_bono", label: "Pro Bono", type: "boolean" },
      { name: "court", label: "Court", type: "text", full: true },
      { name: "court_short", label: "Court (short)", type: "select", options: COURTS },
      { name: "case_number", label: "Case Number", type: "text", table: true },
      { name: "judicial_officer", label: "Judicial Officer", type: "text" },
      { name: "department", label: "Department", type: "text" },
      { name: "date_opened", label: "Opened", type: "date", table: true },
      { name: "date_filed", label: "Filed", type: "date" },
      { name: "date_closed", label: "Closed", type: "date" },
      { name: "disposition", label: "Disposition", type: "text", full: true },
      { name: "fee_agreement_date", label: "Fee Agreement", type: "date" },
      { name: "incident_trigger_date", label: "Incident / Trigger Date", type: "date" },
      { name: "limitations_authority", label: "Limitations Authority", type: "text", full: true },
      { name: "limitations_date", label: "Limitations Date", type: "date" },
      { name: "opposing_party", label: "Opposing Party", type: "text", full: true },
      { name: "opposing_counsel", label: "Opposing Counsel", type: "text", full: true },
      { name: "insurance_carrier", label: "Insurance Carrier", type: "text" },
      { name: "claim_number", label: "Claim Number", type: "text" },
      {
        name: "responsible_attorney",
        label: "Responsible Attorney",
        type: "text",
        ref: "timekeepers",
      },
      { name: "responsible_attorney_name", label: "Responsible", type: "text", table: true },
      {
        name: "originating_attorney",
        label: "Originating Attorney",
        type: "text",
        ref: "timekeepers",
      },
      { name: "paralegal", label: "Paralegal", type: "text", ref: "timekeepers" },
      { name: "next_court_date", label: "Next Court Date", type: "date", table: true },
      { name: "recorded_hours", label: "Recorded Hours", type: "number", step: 0.1 },
      {
        name: "recorded_value_at_standard_rates",
        label: "Recorded Value",
        type: "currency",
      },
      { name: "costs_advanced", label: "Costs Advanced", type: "currency" },
      { name: "fees_billed", label: "Fees Billed", type: "currency" },
      { name: "collected", label: "Collected", type: "currency" },
      { name: "trust_balance", label: "Trust Balance", type: "currency" },
    ],
  },
  {
    name: "clients",
    label: "Client",
    labelPlural: "Clients",
    key: "client_id",
    icon: "user-round",
    titleFields: ["client_name"],
    defaultSort: { field: "client_name", dir: "asc" },
    describeExample:
      "New individual client Esperanza Escobedo, 6614 Slauson Ave, Van Nuys 91405. (626) 976-7073, esperanza.escobedo@gmail.com. Spanish-speaking, came in on an attorney referral. Conflict check cleared, photo ID verified, engagement letter signed today.",
    fields: [
      { name: "client_name", label: "Client Name", type: "text", required: true, table: true },
      {
        name: "client_type",
        label: "Type",
        type: "select",
        options: ["Individual", "Entity"],
        table: true,
        badge: true,
      },
      { name: "first_name", label: "First Name", type: "text" },
      { name: "last_name", label: "Last Name", type: "text" },
      { name: "entity_name", label: "Entity Name", type: "text", full: true },
      { name: "primary_contact", label: "Primary Contact", type: "text", table: true },
      { name: "date_of_birth", label: "Date of Birth", type: "date" },
      {
        name: "preferred_language",
        label: "Language",
        type: "select",
        options: LANGUAGES,
      },
      { name: "address", label: "Address", type: "text", full: true },
      { name: "city", label: "City", type: "text", table: true },
      { name: "state", label: "State", type: "text" },
      { name: "zip", label: "ZIP", type: "text" },
      { name: "phone", label: "Phone", type: "tel", table: true },
      { name: "email", label: "Email", type: "email", table: true },
      {
        name: "referral_source",
        label: "Referral Source",
        type: "select",
        options: REFERRAL_SOURCES,
      },
      { name: "intake_date", label: "Intake", type: "date" },
      { name: "engagement_letter_date", label: "Engagement Letter", type: "date" },
      { name: "conflict_check_date", label: "Conflict Check", type: "date" },
      {
        name: "conflict_check_result",
        label: "Conflict Result",
        type: "select",
        options: ["Cleared", "Cleared with waiver"],
      },
      {
        name: "conflict_cleared_by",
        label: "Cleared By",
        type: "text",
        ref: "timekeepers",
      },
      { name: "photo_id_verified", label: "Photo ID Verified", type: "boolean" },
      { name: "client_portal_enabled", label: "Portal Enabled", type: "boolean" },
      {
        name: "responsible_attorney",
        label: "Responsible Attorney",
        type: "text",
        ref: "timekeepers",
      },
      { name: "responsible_attorney_name", label: "Responsible", type: "text", table: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["Active", "Former"],
        table: true,
        badge: true,
      },
      { name: "total_matters", label: "Total Matters", type: "number" },
      { name: "open_matters", label: "Open Matters", type: "number" },
      { name: "last_matter_opened", label: "Last Matter Opened", type: "date" },
    ],
  },
  {
    name: "timekeepers",
    label: "Timekeeper",
    labelPlural: "Timekeepers",
    key: "timekeeper_id",
    icon: "users",
    titleFields: ["name"],
    defaultSort: { field: "name", dir: "asc" },
    describeExample:
      "Add associate Wei-Lin Chen, initials WLC, bar number 328765 admitted June 2019. Standard rate $325 for 2026, cost rate $96. Target 1,700 hours at 71% utilisation. MCLE group 2, due 31 January 2027.",
    fields: [
      { name: "name", label: "Name", type: "text", required: true, table: true },
      { name: "first_name", label: "First Name", type: "text" },
      { name: "last_name", label: "Last Name", type: "text" },
      { name: "initials", label: "Initials", type: "text", table: true },
      { name: "role", label: "Role", type: "select", options: TIMEKEEPER_ROLES, table: true },
      { name: "billing_timekeeper", label: "Billing Timekeeper", type: "boolean", table: true },
      { name: "active", label: "Active", type: "boolean" },
      { name: "date_hired", label: "Hired", type: "date" },
      { name: "california_bar_number", label: "CA Bar Number", type: "number", table: true },
      { name: "bar_admission_date", label: "Bar Admission", type: "date" },
      { name: "standard_rate_2026", label: "Standard Rate 2026", type: "currency", table: true },
      { name: "standard_rate_2025", label: "Standard Rate 2025", type: "currency" },
      { name: "standard_rate_2024", label: "Standard Rate 2024", type: "currency" },
      { name: "hourly_cost_rate", label: "Cost Rate", type: "currency" },
      { name: "annual_target_hours", label: "Target Hours", type: "number" },
      { name: "utilization_target", label: "Utilisation Target", type: "number", step: 0.01 },
      { name: "recorded_hours_in_dataset", label: "Recorded Hours", type: "number", step: 0.1 },
      { name: "billable_hours_in_dataset", label: "Billable Hours", type: "number", step: 0.1 },
      {
        name: "recorded_value_at_standard_rates",
        label: "Recorded Value",
        type: "currency",
      },
      { name: "matters_worked", label: "Matters Worked", type: "number" },
      {
        name: "mcle_compliance_group",
        label: "MCLE Group",
        type: "select",
        options: ["Group 1", "Group 2", "Group 3"],
      },
      { name: "mcle_hours_completed", label: "MCLE Hours", type: "number", step: 0.5 },
      { name: "mcle_compliance_due", label: "MCLE Due", type: "date" },
    ],
  },
  {
    name: "time_entries",
    label: "Time Entry",
    labelPlural: "Time Entries",
    key: "time_entry_id",
    icon: "timer",
    titleFields: ["narrative"],
    defaultSort: { field: "date", dir: "desc" },
    describeExample:
      "1.4 hours today on MT-2932 — telephone conference with the client about the mediation outcome and the tax treatment of the settlement. Billable, L160 settlement/ADR, activity A106.",
    fields: [
      { name: "date", label: "Date", type: "date", required: true, table: true },
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", required: true, table: true },
      { name: "matter_caption", label: "Matter Caption", type: "text", table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "timekeeper_id", label: "Timekeeper", type: "text", ref: "timekeepers" },
      { name: "timekeeper", label: "Timekeeper Name", type: "text", table: true },
      { name: "role", label: "Role", type: "select", options: TIMEKEEPER_ROLES },
      { name: "practice_area", label: "Practice Area", type: "select", options: PRACTICE_AREAS },
      { name: "narrative", label: "Narrative", type: "textarea", required: true, full: true },
      { name: "phase", label: "Phase Code", type: "select", options: UTBMS_PHASE_CODES },
      { name: "task_code", label: "Task Code", type: "text", placeholder: "L120" },
      { name: "task_description", label: "Task", type: "select", options: UTBMS_TASKS },
      { name: "activity_code", label: "Activity Code", type: "text", placeholder: "A103" },
      {
        name: "activity_description",
        label: "Activity",
        type: "select",
        options: UTBMS_ACTIVITIES,
      },
      { name: "hours", label: "Hours", type: "number", step: 0.1, required: true, table: true },
      { name: "standard_rate", label: "Standard Rate", type: "currency" },
      { name: "billed_rate", label: "Billed Rate", type: "currency" },
      {
        name: "value_at_standard_rates",
        label: "Value",
        type: "currency",
        table: true,
      },
      { name: "billable", label: "Billable", type: "boolean", table: true },
      { name: "non_billable_reason", label: "Non-billable Reason", type: "text", full: true },
      { name: "lodestar_eligible", label: "Lodestar Eligible", type: "boolean" },
      { name: "gross_fee_amount", label: "Gross Fee", type: "currency" },
      { name: "write_down", label: "Write-down", type: "currency" },
      { name: "net_billed_amount", label: "Net Billed", type: "currency" },
      { name: "billed", label: "Billed", type: "boolean", table: true },
      { name: "invoice_no", label: "Invoice", type: "text", ref: "invoices" },
      { name: "date_entered", label: "Entered", type: "date" },
      { name: "entry_lag_days", label: "Entry Lag (days)", type: "number" },
      { name: "locked", label: "Locked", type: "boolean" },
    ],
  },
  {
    name: "costs_and_disbursements",
    label: "Cost",
    labelPlural: "Costs & Disbursements",
    key: "cost_id",
    icon: "receipt",
    titleFields: ["description"],
    defaultSort: { field: "date", dir: "desc" },
    describeExample:
      "Paid the USCIS filing fee of $675 for the I-130 on MT-2713 today, advanced by the firm from the operating account. Recoverable, receipt RCT-308668.",
    fields: [
      { name: "date", label: "Date", type: "date", required: true, table: true },
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", required: true, table: true },
      { name: "matter_caption", label: "Matter Caption", type: "text", table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "practice_area", label: "Practice Area", type: "select", options: PRACTICE_AREAS },
      { name: "expense_code", label: "Expense Code", type: "text", placeholder: "E112" },
      {
        name: "expense_category",
        label: "Category",
        type: "select",
        options: UTBMS_EXPENSES,
        table: true,
      },
      { name: "description", label: "Description", type: "text", required: true, full: true },
      { name: "vendor_payee", label: "Vendor / Payee", type: "text", table: true },
      { name: "amount", label: "Amount", type: "currency", required: true, table: true },
      { name: "advanced_by_firm", label: "Advanced by Firm", type: "boolean" },
      { name: "recoverable", label: "Recoverable", type: "boolean" },
      {
        name: "paid_from",
        label: "Paid From",
        type: "select",
        options: ["Operating account", "Operating account (advanced by firm)"],
      },
      { name: "receipt_reference", label: "Receipt Ref", type: "text" },
      { name: "invoice_no", label: "Invoice", type: "text", ref: "invoices" },
      { name: "billed_to_client", label: "Billed to Client", type: "boolean", table: true },
      { name: "recovered_from_settlement", label: "Recovered from Settlement", type: "boolean" },
    ],
  },
  {
    name: "invoices",
    label: "Invoice",
    labelPlural: "Invoices",
    key: "invoice_no",
    icon: "file-text",
    titleFields: ["matter_caption"],
    defaultSort: { field: "issue_date", dir: "desc" },
    describeExample:
      "Bill MT-2306 for the period 31 May to 29 June — $1,154 of fees, no costs, applied in full from trust. Issued today, due in 30 days, emailed as a PDF.",
    fields: [
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", required: true, table: true },
      { name: "matter_caption", label: "Matter Caption", type: "text", table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "client_name", label: "Client Name", type: "text", table: true },
      { name: "fee_model", label: "Fee Model", type: "select", options: FEE_MODELS },
      { name: "period_start", label: "Period Start", type: "date" },
      { name: "period_end", label: "Period End", type: "date" },
      { name: "issue_date", label: "Issued", type: "date", table: true },
      { name: "due_date", label: "Due", type: "date", table: true },
      { name: "fees_at_billed_rates", label: "Fees", type: "currency" },
      { name: "write_downs", label: "Write-downs", type: "currency" },
      { name: "courtesy_discount", label: "Courtesy Discount", type: "currency" },
      { name: "costs_billed", label: "Costs Billed", type: "currency" },
      { name: "invoice_total", label: "Total", type: "currency", table: true },
      { name: "prior_balance", label: "Prior Balance", type: "currency" },
      { name: "applied_from_trust", label: "Applied from Trust", type: "currency" },
      { name: "payments_applied", label: "Payments Applied", type: "currency" },
      { name: "balance_due", label: "Balance Due", type: "currency", table: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["Open", "Partially paid", "Paid", "Outstanding", "Sent to collections"],
        table: true,
        badge: true,
      },
      { name: "days_outstanding", label: "Days Outstanding", type: "number" },
      {
        name: "aging_bucket",
        label: "Aging",
        type: "select",
        options: [
          "Paid",
          "Current (not yet due)",
          "1-30 days",
          "31-60 days",
          "61-90 days",
          "91-120 days",
          "Over 120 days",
        ],
        badge: true,
      },
      {
        name: "delivery_method",
        label: "Delivery",
        type: "select",
        options: ["Email (PDF)", "Client portal", "US Mail", "Hand delivered at court"],
      },
      { name: "note", label: "Note", type: "textarea", full: true },
    ],
  },
  {
    name: "payments_and_receipts",
    label: "Payment",
    labelPlural: "Payments & Receipts",
    key: "payment_id",
    icon: "wallet",
    titleFields: ["description"],
    defaultSort: { field: "date", dir: "desc" },
    describeExample:
      "Received $2,210.63 from Bradley Brannigan by check today against INV-2026-0808 on MT-2540, deposited to the operating account.",
    fields: [
      { name: "date", label: "Date", type: "date", required: true, table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "client_name", label: "Client Name", type: "text", table: true },
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", table: true },
      { name: "amount", label: "Amount", type: "currency", required: true, table: true },
      {
        name: "deposited_to",
        label: "Deposited To",
        type: "select",
        options: ["Operating", "Trust"],
        table: true,
        badge: true,
      },
      {
        name: "method",
        label: "Method",
        type: "select",
        options: [
          "Check",
          "ACH transfer",
          "Credit card",
          "Cashier's check",
          "Wire transfer",
          "Cash",
          "Trust transfer",
        ],
        table: true,
      },
      { name: "payor", label: "Payor", type: "text" },
      { name: "reference", label: "Reference", type: "text" },
      { name: "description", label: "Description", type: "text", full: true },
      { name: "invoice_no", label: "Invoice", type: "text", ref: "invoices", table: true },
      { name: "returned_nsf", label: "Returned NSF", type: "boolean" },
    ],
  },
  {
    name: "trust_ledger_cta",
    label: "Trust Ledger Entry",
    labelPlural: "Trust Ledger (CTA)",
    key: "transaction_id",
    icon: "landmark",
    titleFields: ["transaction_type"],
    defaultSort: { field: "date", dir: "desc" },
    describeExample:
      "Transfer $1,627.50 of earned fees from trust to operating on MT-3174 for Gregory Duvall, against this period's invoice. Check 7289.",
    fields: [
      { name: "date", label: "Date", type: "date", required: true, table: true },
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", required: true, table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "client_name", label: "Client Name", type: "text", table: true },
      {
        name: "transaction_type",
        label: "Transaction Type",
        type: "select",
        options: [
          "Deposit - advance fee retainer",
          "Deposit - flat fee (unearned)",
          "Deposit - retainer replenishment",
          "Deposit - settlement proceeds",
          "Transfer to operating - earned fees",
          "Transfer to operating - earned flat fee",
          "Transfer to operating - contingency fee",
          "Transfer to operating - cost reimbursement",
          "Disbursement - lien payment",
          "Disbursement - net to client",
          "Refund - unearned balance to client",
          "Refund - unearned flat fee",
        ],
        table: true,
      },
      { name: "description", label: "Description", type: "text", full: true },
      { name: "payee_payor", label: "Payee / Payor", type: "text" },
      { name: "check_no", label: "Check No", type: "number" },
      { name: "reference", label: "Reference", type: "text", full: true },
      { name: "amount_in", label: "In", type: "currency", table: true },
      { name: "amount_out", label: "Out", type: "currency", table: true },
      { name: "matter_ledger_balance", label: "Matter Balance", type: "currency", table: true },
      { name: "trust_account_balance", label: "Account Balance", type: "currency" },
      { name: "bank_cleared_date", label: "Bank Cleared", type: "date" },
      { name: "reconciliation_month", label: "Reconciled", type: "date" },
    ],
  },
  {
    name: "court_calendar",
    label: "Court Event",
    labelPlural: "Court Calendar",
    key: "event_id",
    icon: "gavel",
    titleFields: ["event_type"],
    defaultSort: { field: "date", dir: "desc" },
    describeExample:
      "Case management conference on MT-3213 at LASC Stanley Mosk, Dept. 56 before Hon. Priscilla Yee-Barron, 3 December at 08:30. Farid Nazarian appearing.",
    fields: [
      { name: "date", label: "Date", type: "date", required: true, table: true },
      { name: "time", label: "Time", type: "select", options: HEARING_TIMES, table: true },
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", required: true, table: true },
      { name: "matter_caption", label: "Matter Caption", type: "text", table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "case_number", label: "Case Number", type: "text" },
      {
        name: "event_type",
        label: "Event Type",
        type: "select",
        options: CALENDAR_EVENT_TYPES,
        table: true,
      },
      { name: "in_court", label: "In Court", type: "boolean" },
      { name: "court_location", label: "Location", type: "text", table: true },
      { name: "department", label: "Department", type: "text" },
      { name: "judicial_officer", label: "Judicial Officer", type: "text" },
      {
        name: "appearing_timekeeper",
        label: "Appearing Timekeeper",
        type: "text",
        ref: "timekeepers",
      },
      { name: "appearing_name", label: "Appearing", type: "text", table: true },
      { name: "deponent_witness", label: "Deponent / Witness", type: "text" },
      { name: "outcome", label: "Outcome", type: "text", full: true },
      { name: "appeared", label: "Appeared", type: "boolean" },
      { name: "continued_to", label: "Continued To", type: "date" },
    ],
  },
  {
    name: "deadlines_and_sol",
    label: "Deadline",
    labelPlural: "Deadlines & SOL",
    key: "deadline_id",
    icon: "alarm-clock",
    titleFields: ["description"],
    defaultSort: { field: "due_date", dir: "asc" },
    describeExample:
      "Response to complaint due on MT-2792 — 30 days from service on 20 July under CCP 412.20(a)(3), so due 19 August. High priority, Farid Nazarian owns it, calendared.",
    fields: [
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", required: true, table: true },
      { name: "matter_caption", label: "Matter Caption", type: "text", table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "description", label: "Description", type: "text", required: true, table: true },
      {
        name: "category",
        label: "Category",
        type: "select",
        options: [
          "Case Administration",
          "Court Filing",
          "Criminal",
          "Disclosure",
          "Discovery",
          "Law and Motion",
          "Pleading",
          "Post-Judgment",
          "Statute of Limitations",
        ],
        table: true,
      },
      { name: "authority", label: "Authority", type: "text", full: true },
      { name: "trigger_event", label: "Trigger Event", type: "text" },
      { name: "trigger_date", label: "Trigger Date", type: "date" },
      { name: "computation", label: "Computation", type: "text", full: true },
      { name: "due_date", label: "Due", type: "date", required: true, table: true },
      { name: "days_remaining", label: "Days Remaining", type: "number", table: true },
      {
        name: "priority",
        label: "Priority",
        type: "select",
        options: ["Critical", "High", "Medium"],
        table: true,
        badge: true,
      },
      { name: "owner", label: "Owner", type: "text", ref: "timekeepers" },
      { name: "owner_name", label: "Owner Name", type: "text", table: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: ["Open", "Completed", "Completed late"],
        table: true,
        badge: true,
      },
      { name: "completed_date", label: "Completed", type: "date" },
      { name: "calendared", label: "Calendared", type: "boolean" },
    ],
  },
  {
    name: "intake_and_leads",
    label: "Lead",
    labelPlural: "Intake & Leads",
    key: "lead_id",
    icon: "megaphone",
    titleFields: ["prospect_name"],
    defaultSort: { field: "date_received", dir: "desc" },
    describeExample:
      "Call from Josefina Tolentino about a rear-end collision on the 405 last month, (424) 822-8650, found us through a Spanish-language radio ad. Screened by intake; signing.",
    fields: [
      { name: "date_received", label: "Received", type: "date", required: true, table: true },
      { name: "prospect_name", label: "Prospect", type: "text", required: true, table: true },
      { name: "phone", label: "Phone", type: "tel", table: true },
      {
        name: "referral_source",
        label: "Referral Source",
        type: "select",
        options: REFERRAL_SOURCES,
        table: true,
      },
      { name: "potential_claim_type", label: "Potential Claim", type: "text", table: true },
      {
        name: "disposition",
        label: "Disposition",
        type: "select",
        options: ["Signed", "Declined", "Referred out"],
        table: true,
        badge: true,
      },
      {
        name: "decline_reason",
        label: "Decline Reason",
        type: "select",
        options: [
          "Client already represented",
          "Conflict of interest",
          "Damages below firm threshold",
          "Fee expectation mismatch",
          "Liability too weak",
          "Outside firm practice areas",
          "Statute of limitations expired",
          "Unable to reach after screening",
        ],
      },
      { name: "consultation_fee", label: "Consultation Fee", type: "currency" },
      { name: "screened_by", label: "Screened By", type: "text", ref: "timekeepers" },
      { name: "converted_client_id", label: "Converted Client", type: "text", ref: "clients" },
      { name: "matter_id", label: "Matter", type: "text", ref: "matters" },
      { name: "limitations_date", label: "Limitations Date", type: "date" },
      {
        name: "days_to_limitations_at_intake",
        label: "Days to SOL at Intake",
        type: "number",
      },
      { name: "referred_to", label: "Referred To", type: "text", full: true },
      {
        name: "referral_fee_arrangement",
        label: "Referral Fee Arrangement",
        type: "text",
        full: true,
      },
      {
        name: "written_client_consent_rule_1_5_1",
        label: "Written Consent (Rule 1.5.1)",
        type: "select",
        options: ["Yes", "Pending"],
      },
      { name: "notes", label: "Notes", type: "textarea", full: true },
    ],
  },
  {
    name: "settlements_and_liens",
    label: "Settlement",
    labelPlural: "Settlements & Liens",
    key: "settlement_id",
    icon: "handshake",
    titleFields: ["client_name"],
    defaultSort: { field: "date_settled", dir: "desc" },
    describeExample:
      "Settled MT-2128 for Gregory Ledbetter at $273,900 pre-suit, one-third fee, $1,458.68 of costs back to the firm. Four medical liens claimed at $38,241 negotiated to $16,942. Net to client $164,208.68.",
    fields: [
      { name: "matter_id", label: "Matter", type: "text", ref: "matters", required: true, table: true },
      { name: "client_id", label: "Client", type: "text", ref: "clients" },
      { name: "client_name", label: "Client Name", type: "text", table: true },
      { name: "matter_type", label: "Matter Type", type: "text", table: true },
      { name: "date_settled", label: "Settled", type: "date", table: true },
      {
        name: "fee_basis",
        label: "Fee Basis",
        type: "select",
        options: [
          "Pre-suit (33 1/3%)",
          "Post-filing (40%)",
          "Statutory 15% approved by the WCAB (Lab. Code 4906)",
        ],
        table: true,
      },
      { name: "gross_settlement", label: "Gross Settlement", type: "currency", table: true },
      { name: "attorney_fee_rate", label: "Fee Rate", type: "number", step: 0.0001 },
      { name: "attorney_fee", label: "Attorney Fee", type: "currency", table: true },
      {
        name: "costs_reimbursed_to_firm",
        label: "Costs Reimbursed",
        type: "currency",
      },
      { name: "liens_asserted", label: "Liens Asserted", type: "number" },
      { name: "liens_claimed", label: "Liens Claimed", type: "currency" },
      { name: "liens_paid", label: "Liens Paid", type: "currency" },
      { name: "net_to_client", label: "Net to Client", type: "currency", table: true },
      { name: "trust_deposit_date", label: "Trust Deposit", type: "date" },
      { name: "disbursement_date", label: "Disbursed", type: "date" },
      { name: "insurance_carrier", label: "Insurance Carrier", type: "text" },
      { name: "claim_number", label: "Claim Number", type: "text" },
      {
        name: "statutory_liens",
        label: "Statutory Liens",
        type: "select",
        options: [
          "No statutory lien asserted",
          "California Department of Health Care Services (Medi-Cal)",
        ],
      },
      { name: "lien_detail", label: "Lien Detail", type: "textarea", full: true },
    ],
  },
  {
    name: "lookups",
    label: "Lookup",
    labelPlural: "Lookups",
    key: "value",
    icon: "list-checks",
    titleFields: ["value"],
    hideKeyColumn: true,
    defaultSort: { field: "list", dir: "asc" },
    describeExample:
      "Add a practice area called Construction Defect to the practice area list, noted as a California litigation category.",
    fields: [
      { name: "list", label: "List", type: "text", required: true, table: true },
      { name: "code", label: "Code", type: "text", table: true },
      { name: "value", label: "Value", type: "text", required: true, table: true },
      { name: "description", label: "Description", type: "text", table: true, full: true },
      { name: "authority_notes", label: "Authority Notes", type: "text", full: true },
    ],
  },
];

export const ENTITY_BY_NAME: { [name: string]: EntityConfig } = Object.fromEntries(
  ENTITIES.map((e) => [e.name, e])
);

// ---- Status/priority badge tone mapping -----------------------------------
export type Tone = "success" | "warn" | "danger" | "info" | "neutral";

const TONE_MAP: { [value: string]: Tone } = {
  // Positive / settled
  open: "success",
  active: "success",
  paid: "success",
  completed: "success",
  signed: "success",
  cleared: "success",
  operating: "success",
  individual: "info",
  entity: "info",
  // In flight / needs an eye on it
  "partially paid": "warn",
  outstanding: "warn",
  "current (not yet due)": "info",
  "cleared with waiver": "warn",
  "completed late": "warn",
  medium: "warn",
  high: "warn",
  trust: "info",
  "1-30 days": "info",
  "31-60 days": "warn",
  "61-90 days": "warn",
  "referred out": "info",
  // Danger
  critical: "danger",
  declined: "danger",
  "sent to collections": "danger",
  "91-120 days": "danger",
  "over 120 days": "danger",
  // Neutral
  closed: "neutral",
  former: "neutral",
};

export function toneForValue(value: unknown): Tone {
  if (value === null || value === undefined || value === "") return "neutral";
  return TONE_MAP[String(value).trim().toLowerCase()] ?? "neutral";
}

export function recordTitle(cfg: EntityConfig, record: Record<string, unknown>): string {
  const parts = cfg.titleFields
    .map((f) => record[f])
    .filter((v) => v !== undefined && v !== null && v !== "");
  if (parts.length) return parts.join(" ");
  const key = record[cfg.key];
  return key ? String(key) : "(untitled)";
}
