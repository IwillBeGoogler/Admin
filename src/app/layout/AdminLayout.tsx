import { Link, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import {
  KeyboardIcon,
  LanguagesIcon,
  LogOutIcon,
  MenuIcon,
  MonitorIcon,
  MonitorSmartphoneIcon,
  MoonIcon,
  NewspaperIcon,
  PanelLeftIcon,
  SearchIcon,
  SunIcon,
  XIcon,
} from "lucide-react";
import { Dialog as D } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type CurrentAdmin, useLogout, usePermissions } from "@/contexts/identity";
import { useOpenReportCount } from "@/contexts/moderation";
import { type Locale, localeNames, locales, useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { formatBadgeCount } from "@/shared/lib/format";
import { key } from "@/shared/lib/shortcuts";
import { type Hotkeys, keyLabels, useHotkeys } from "@/shared/lib/useHotkeys";
import { Button } from "@/shared/ui/button";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownRadioGroup,
  DropdownRadioItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/shared/ui/dropdown";
import { kbdClass } from "@/shared/ui/search-input";
import { OfflineBanner } from "@/shared/ui/states";
import { type Theme, useTheme } from "@/shared/ui/theme";
import { Tooltip, TooltipProvider } from "@/shared/ui/tooltip";
import { CommandPalette } from "../command/CommandPalette";
import { pushRecent } from "../command/recent";
import { type NavItem, visibleNavigation } from "../nav";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { useSidebar } from "./useSidebar";

function NavBadge({ kind, collapsed }: { kind: NonNullable<NavItem["badge"]>; collapsed: boolean }) {
  const { t } = useI18n();
  const { canAny } = usePermissions();
  const count = useOpenReportCount(kind === "reports.open" && canAny(["report.moderate"]));
  const text = formatBadgeCount(count.data);
  if (!text) return null;
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "rounded-full bg-destructive/10 px-1.5 text-xs tabular-nums text-destructive",
          collapsed ? "absolute right-0.5 top-0.5 px-1 text-[10px] leading-4" : "ml-auto",
        )}
      >
        {text}
      </span>
      <span className="sr-only">, {t("confirm.reportsOpen", { n: text })}</span>
    </>
  );
}

function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useI18n();
  const { canAny } = usePermissions();
  return (
    <nav aria-label={t("app.menu")} className={cn("flex flex-col p-3", collapsed ? "gap-2 px-2" : "gap-5")}>
      {visibleNavigation(canAny).map((g) => (
        <div key={g.label ?? "root"} className="grid gap-1">
          {g.label ? (
            collapsed ? (
              <hr className="mx-3 border-t border-border" />
            ) : (
              <p className="px-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(g.label)}</p>
            )
          ) : null}
          <ul className="grid gap-0.5">
            {g.items.map((i) => (
              <li key={i.to}>
                <Tooltip content={t(i.label)} side="right" disabled={!collapsed}>
                  <Link
                    to={i.to}
                    activeOptions={{ exact: i.to === "/" }}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:bg-primary/10 data-[status=active]:font-medium data-[status=active]:text-primary",
                      collapsed ? "justify-center px-2" : "px-3",
                    )}
                  >
                    <i.icon className="size-4 shrink-0" aria-hidden />
                    <span className={collapsed ? "sr-only" : "truncate"}>{t(i.label)}</span>
                    {i.badge ? <NavBadge kind={i.badge} collapsed={collapsed} /> : null}
                  </Link>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <Link
      to="/"
      className={cn(
        "flex items-center gap-2 rounded-md font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "px-2" : "px-3",
      )}
    >
      <NewspaperIcon className="size-5 shrink-0 text-primary" aria-hidden />
      <span className={compact ? "sr-only" : undefined}>{t("app.name")}</span>
    </Link>
  );
}

/** Avatar chip with the account menu (sessions, sign out). */
function UserMenu({ admin, collapsed = false }: { admin: CurrentAdmin; collapsed?: boolean }) {
  const { t } = useI18n();
  const logout = useLogout();
  const navigate = useNavigate();
  const name = admin.user.username;
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button
          variant="ghost"
          className={cn("h-10 min-w-0 gap-2", collapsed ? "w-10 px-0" : "w-full justify-start px-2")}
          aria-label={`${t("sidebar.account")}: ${name}`}
        >
          <span
            aria-hidden
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold uppercase text-primary"
          >
            {name.slice(0, 1)}
          </span>
          {collapsed ? null : <span className="truncate">{name}</span>}
        </Button>
      </DropdownTrigger>
      <DropdownContent align="start" side="top">
        <DropdownLabel>{t("auth.signedInAs", { name })}</DropdownLabel>
        <DropdownItem onSelect={() => void navigate({ to: "/sessions" })}>
          <MonitorSmartphoneIcon aria-hidden />
          {t("sidebar.sessions")}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem disabled={logout.isPending} onSelect={() => logout.mutate()}>
          <LogOutIcon aria-hidden />
          {t("auth.logout")}
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}

const themeIcon: Record<Theme, typeof SunIcon> = { light: SunIcon, dark: MoonIcon, system: MonitorIcon };

function Toolbar({ onSearch, onHelp }: { onSearch: () => void; onHelp: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const ThemeIcon = themeIcon[theme];
  return (
    <div className="ml-auto flex items-center gap-1">
      <Button
        variant="outline"
        className="h-9 gap-2 px-2.5 text-muted-foreground sm:w-56 sm:justify-start"
        onClick={onSearch}
        aria-label={t("command.title")}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <SearchIcon aria-hidden />
        <span className="hidden sm:inline">{t("command.trigger")}</span>
        <span className="ml-auto hidden gap-1 sm:flex" aria-hidden>
          {(keyLabels(key("palette"))[0] ?? []).map((k) => (
            <kbd key={k} className={kbdClass}>
              {k}
            </kbd>
          ))}
        </span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="max-sm:hidden"
        aria-label={t("shortcuts.open")}
        aria-keyshortcuts="?"
        onClick={onHelp}
      >
        <KeyboardIcon aria-hidden />
      </Button>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("locale.label")}>
            <LanguagesIcon aria-hidden />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="end">
          <DropdownLabel>{t("locale.label")}</DropdownLabel>
          <DropdownRadioGroup value={locale} onValueChange={(v) => setLocale(v as Locale)}>
            {locales.map((l) => (
              <DropdownRadioItem key={l} value={l} lang={l}>
                {localeNames[l]}
              </DropdownRadioItem>
            ))}
          </DropdownRadioGroup>
        </DropdownContent>
      </Dropdown>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("theme.label")}>
            <ThemeIcon aria-hidden />
          </Button>
        </DropdownTrigger>
        <DropdownContent align="end">
          <DropdownLabel>{t("theme.label")}</DropdownLabel>
          <DropdownRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            {(["light", "dark", "system"] as const).map((v) => (
              <DropdownRadioItem key={v} value={v}>
                {t(`theme.${v}`)}
              </DropdownRadioItem>
            ))}
          </DropdownRadioGroup>
        </DropdownContent>
      </Dropdown>
    </div>
  );
}

/** After each resolved navigation: focus the page h1 (skipping first load) and record the route. */
function useRouteEffects(onResolved: () => void) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.resolvedLocation?.pathname });
  const href = useRouterState({ select: (s) => s.resolvedLocation?.href });
  const first = useRef(true);
  useEffect(() => {
    if (!pathname) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const id = requestAnimationFrame(() => document.querySelector<HTMLElement>("#main h1")?.focus());
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  useEffect(() => {
    if (href) pushRecent(href);
  }, [href]);
  const latest = useRef(onResolved);
  useEffect(() => {
    latest.current = onResolved;
  });
  // Close the mobile drawer on any navigation, including palette and shortcut navigation.
  useEffect(() => router.subscribe("onResolved", () => latest.current()), [router]);
}

export function AdminLayout({ admin, children }: { admin: CurrentAdmin; children?: ReactNode }) {
  const { t } = useI18n();
  const { canAny } = usePermissions();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const sidebar = useSidebar();
  useRouteEffects(() => setOpen(false));

  const goTo: Hotkeys = Object.fromEntries(
    visibleNavigation(canAny)
      .flatMap((g) => g.items)
      .filter((i) => i.hotkey)
      .map((i) => [`g ${i.hotkey}`, () => void navigate({ to: i.to })]),
  );
  useHotkeys({
    ...goTo,
    [key("palette")]: { allowInInput: true, allowInDialog: palette, handler: () => setPalette((p) => !p) },
    [key("help")]: () => setHelp(true),
    [key("sidebar")]: sidebar.toggle,
    [key("focusSearch")]: () => {
      const input = document.querySelector<HTMLInputElement>("#main input[data-list-search]:not(:disabled)");
      if (input) input.focus();
      else setPalette(true);
    },
  });

  const collapsed = sidebar.collapsed;
  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
        >
          {t("app.skip")}
        </a>
        <aside
          className={cn(
            "fixed inset-y-0 left-0 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 lg:flex",
            collapsed ? "w-14" : "w-60",
          )}
        >
          <div className="flex h-14 shrink-0 items-center border-b border-border">
            <Brand compact={collapsed} />
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <Sidebar collapsed={collapsed} />
          </div>
          <div
            className={cn(
              "flex shrink-0 gap-1 border-t border-border p-2",
              collapsed ? "flex-col items-center" : "items-center",
            )}
          >
            <div className={collapsed ? undefined : "min-w-0 flex-1"}>
              <UserMenu admin={admin} collapsed={collapsed} />
            </div>
            <Tooltip content={t(collapsed ? "sidebar.expand" : "sidebar.collapse")} side="right">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}
                aria-expanded={!collapsed}
                aria-keyshortcuts="Control+B Meta+B"
                onClick={sidebar.toggle}
              >
                <PanelLeftIcon aria-hidden />
              </Button>
            </Tooltip>
          </div>
        </aside>
        <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-14" : "lg:pl-60")}>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-6">
            <D.Root open={open} onOpenChange={setOpen}>
              <D.Trigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("app.menu")}>
                  <MenuIcon aria-hidden />
                </Button>
              </D.Trigger>
              <D.Portal>
                <D.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
                <D.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar lg:hidden">
                  <D.Title className="sr-only">{t("app.menu")}</D.Title>
                  <D.Description className="sr-only">{t("app.name")}</D.Description>
                  <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pr-2">
                    <Brand />
                    <D.Close asChild>
                      <Button variant="ghost" size="icon" aria-label={t("app.closeMenu")}>
                        <XIcon aria-hidden />
                      </Button>
                    </D.Close>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <Sidebar />
                  </div>
                  <div className="border-t border-border p-2">
                    <UserMenu admin={admin} />
                  </div>
                </D.Content>
              </D.Portal>
            </D.Root>
            <div className="lg:hidden">
              <Brand />
            </div>
            <Toolbar onSearch={() => setPalette(true)} onHelp={() => setHelp(true)} />
          </header>
          <OfflineBanner />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl p-4 outline-none sm:p-6">
            {children ?? <Outlet />}
          </main>
        </div>
        {palette ? <CommandPalette onOpenChange={setPalette} /> : null}
        <ShortcutsDialog open={help} onOpenChange={setHelp} />
      </div>
    </TooltipProvider>
  );
}
