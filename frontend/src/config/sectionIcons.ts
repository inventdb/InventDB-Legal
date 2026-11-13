/**
 * One icon per section, shown beside its name in the sidebar and in
 * "All sections". Keyed by the section's path so `floors.ts` stays a plain
 * list of labels.
 */
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock3,
  FileText,
  Folder,
  Home,
  Hourglass,
  Inbox,
  Landmark,
  List,
  Receipt,
  Scale,
  Settings,
  Sparkles,
  Upload,
  UserCheck,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/intake_and_leads": Inbox,
  "/clients": Users,
  "/matters": Briefcase,
  "/timekeepers": UserCheck,
  "/time_entries": Clock3,
  "/costs_and_disbursements": Receipt,
  "/invoices": FileText,
  "/trust_ledger_cta": Landmark,
  "/payments_and_receipts": Wallet,
  "/settlements_and_liens": Scale,
  "/court_calendar": CalendarDays,
  "/deadlines_and_sol": Hourglass,
  "/files": Folder,
  "/import": Upload,
  "/reports": BarChart3,
  "/analyze": Sparkles,
  "/workflows": Workflow,
  "/lookups": List,
  "/settings": Settings,
};

export function iconFor(to: string): LucideIcon {
  return ICONS[to] ?? Folder;
}
