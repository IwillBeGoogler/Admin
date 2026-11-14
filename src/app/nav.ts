import {
  BanIcon,
  BookOpenTextIcon,
  BoxesIcon,
  BugIcon,
  FileTextIcon,
  FlagIcon,
  FolderIcon,
  HashIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MessageSquareIcon,
  MessageSquareWarningIcon,
  MonitorSmartphoneIcon,
  PencilRulerIcon,
  ScaleIcon,
  ScrollTextIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import type { PermissionCode } from "@/contexts/identity";
import type { MessageKey } from "@/shared/i18n";

export interface NavItem {
  to:
    | "/"
    | "/posts"
    | "/categories"
    | "/labels"
    | "/tags"
    | "/glossary"
    | "/diagrams"
    | "/diagram-templates"
    | "/reports"
    | "/feedback"
    | "/client-errors"
    | "/comments"
    | "/users"
    | "/bans"
    | "/roles"
    | "/permissions"
    | "/policies"
    | "/sessions"
    | "/audit";
  label: MessageKey;
  icon: LucideIcon;
  /** Shown when the admin holds any of these (empty = everyone). */
  anyOf: readonly PermissionCode[];
  /** Live count pill next to the label. */
  badge?: "reports.open";
  /** Second key of the "g …" go-to shortcut. */
  hotkey?: string;
}
export interface NavGroup {
  label: MessageKey | null;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    label: null,
    items: [{ to: "/", label: "nav.dashboard", icon: LayoutDashboardIcon, anyOf: ["stats.read"], hotkey: "d" }],
  },
  {
    label: "nav.content",
    items: [
      {
        to: "/posts",
        label: "nav.posts",
        icon: FileTextIcon,
        anyOf: ["post.update", "post.delete", "post.create"],
        hotkey: "p",
      },
      { to: "/categories", label: "nav.categories", icon: FolderIcon, anyOf: ["category.write"] },
      { to: "/labels", label: "nav.labels", icon: TagIcon, anyOf: ["label.write"] },
      { to: "/tags", label: "nav.tags", icon: HashIcon, anyOf: [] },
      { to: "/glossary", label: "nav.glossary", icon: BookOpenTextIcon, anyOf: ["glossary.write"] },
    ],
  },
  {
    label: "nav.diagrams",
    items: [
      {
        to: "/diagrams",
        label: "nav.diagramProjects",
        icon: PencilRulerIcon,
        anyOf: ["diagrams.read", "diagrams.manage"],
      },
      { to: "/diagram-templates", label: "nav.diagramTemplates", icon: BoxesIcon, anyOf: ["templates.manage"] },
    ],
  },
  {
    label: "nav.moderation",
    items: [
      {
        to: "/reports",
        label: "nav.reports",
        icon: FlagIcon,
        anyOf: ["report.moderate"],
        badge: "reports.open",
        hotkey: "r",
      },
      { to: "/feedback", label: "nav.feedback", icon: MessageSquareWarningIcon, anyOf: ["report.moderate"] },
      { to: "/client-errors", label: "nav.clientErrors", icon: BugIcon, anyOf: ["report.moderate"] },
      { to: "/comments", label: "nav.comments", icon: MessageSquareIcon, anyOf: ["comment.moderate"], hotkey: "c" },
    ],
  },
  {
    label: "nav.community",
    items: [
      { to: "/users", label: "nav.users", icon: UsersIcon, anyOf: ["user.read"], hotkey: "u" },
      { to: "/bans", label: "nav.bans", icon: BanIcon, anyOf: ["user.ban"], hotkey: "b" },
    ],
  },
  {
    label: "nav.access",
    items: [
      { to: "/roles", label: "nav.roles", icon: ShieldIcon, anyOf: ["role.read"] },
      { to: "/permissions", label: "nav.permissions", icon: KeyRoundIcon, anyOf: ["permission.read"] },
      { to: "/policies", label: "nav.policies", icon: ScaleIcon, anyOf: ["policy.read"] },
      { to: "/sessions", label: "nav.sessions", icon: MonitorSmartphoneIcon, anyOf: [] },
      { to: "/audit", label: "nav.audit", icon: ScrollTextIcon, anyOf: ["audit.read"], hotkey: "a" },
    ],
  },
];

/** Groups and items the admin may see; empty groups are dropped. */
export const visibleNavigation = (canAny: (c: readonly PermissionCode[]) => boolean): NavGroup[] =>
  navigation.map((g) => ({ ...g, items: g.items.filter((i) => canAny(i.anyOf)) })).filter((g) => g.items.length > 0);
