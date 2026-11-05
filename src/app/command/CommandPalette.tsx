import { useRouter } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  ClockIcon,
  FileTextIcon,
  LanguagesIcon,
  LogOutIcon,
  type LucideIcon,
  PlusIcon,
  SearchIcon,
  SunMoonIcon,
  UserIcon,
} from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useState } from "react";
import { useUserQuickSearch } from "@/contexts/community";
import { usePostQuickSearch } from "@/contexts/content";
import { useLogout, usePermissions } from "@/contexts/identity";
import { localeNames, locales, useI18n } from "@/shared/i18n";
import { useDebounced } from "@/shared/lib/useDebounced";
import { kbdClass } from "@/shared/ui/search-input";
import { useTheme } from "@/shared/ui/theme";
import { navigation, visibleNavigation } from "../nav";
import { useRecent } from "./recent";

const itemClass =
  "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";
const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

const POST_PERMS = ["post.update", "post.delete", "post.create"] as const;

function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="ml-auto flex gap-1" aria-hidden>
      {keys.map((k) => (
        <kbd key={k} className={kbdClass}>
          {k}
        </kbd>
      ))}
    </span>
  );
}

function Item({
  value,
  keywords,
  icon: Icon,
  label,
  hint,
  onSelect,
}: {
  value: string;
  keywords?: string[];
  icon: LucideIcon;
  label: string;
  hint?: string[];
  onSelect: () => void;
}) {
  return (
    <Command.Item value={value} keywords={keywords} onSelect={onSelect} className={itemClass}>
      <Icon aria-hidden />
      <span className="truncate">{label}</span>
      {hint ? <Kbd keys={hint} /> : null}
    </Command.Item>
  );
}

/**
 * Cmd/Ctrl+K palette: navigation (permission-filtered), actions, recent
 * routes and a debounced remote search over posts and users.
 * Mounted only while open, so state resets between uses.
 */
export function CommandPalette({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t, setLocale, locale } = useI18n();
  const { can, canAny } = usePermissions();
  const { setTheme } = useTheme();
  const logout = useLogout();
  const router = useRouter();
  const recent = useRecent();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 250);
  const posts = usePostQuickSearch(q, canAny(POST_PERMS));
  const users = useUserQuickSearch(q, can("user.read"));
  const nav = visibleNavigation(canAny);
  const allItems = navigation.flatMap((g) => g.items);
  const visibleItems = nav.flatMap((g) => g.items);

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };
  const go = (path: string) => run(() => router.history.push(path));
  const recentItems = recent.flatMap((path) => {
    const match = allItems.find((i) => i.to === path);
    if (match && !visibleItems.includes(match)) return [];
    return [{ path, label: match ? t(match.label) : path }];
  });
  const searching = q.length >= 2 && (posts.isFetching || users.isFetching);

  return (
    <D.Root open onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <D.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[15dvh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <D.Title className="sr-only">{t("command.title")}</D.Title>
          <Command label={t("command.title")} loop>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={t("command.placeholder")}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-[min(60dvh,420px)] overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {searching ? t("command.searching") : t("command.empty")}
              </Command.Empty>
              {!search && recentItems.length ? (
                <Command.Group heading={t("command.recent")} className={groupClass}>
                  {recentItems.map((r) => (
                    <Item
                      key={r.path}
                      value={`recent ${r.path} ${r.label}`}
                      icon={ClockIcon}
                      label={r.label}
                      onSelect={() => go(r.path)}
                    />
                  ))}
                </Command.Group>
              ) : null}
              <Command.Group heading={t("command.navigation")} className={groupClass}>
                {visibleItems.map((i) => (
                  <Item
                    key={i.to}
                    value={`${t(i.label)} ${i.to}`}
                    icon={i.icon}
                    label={t(i.label)}
                    hint={i.hotkey ? ["G", i.hotkey.toUpperCase()] : undefined}
                    onSelect={() => go(i.to)}
                  />
                ))}
              </Command.Group>
              <Command.Group heading={t("command.actions")} className={groupClass}>
                {can("post.create") ? (
                  <Item
                    value={t("posts.new")}
                    icon={PlusIcon}
                    label={t("posts.new")}
                    onSelect={() => go("/posts/new")}
                  />
                ) : null}
                <Item
                  value={t("command.toggleTheme")}
                  icon={SunMoonIcon}
                  label={t("command.toggleTheme")}
                  onSelect={() =>
                    run(() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark"))
                  }
                />
                {locales
                  .filter((l) => l !== locale)
                  .map((l) => (
                    <Item
                      key={l}
                      value={`${t("command.switchLanguage", { name: localeNames[l] })} ${l}`}
                      icon={LanguagesIcon}
                      label={t("command.switchLanguage", { name: localeNames[l] })}
                      onSelect={() => run(() => setLocale(l))}
                    />
                  ))}
                <Item
                  value={t("auth.logout")}
                  icon={LogOutIcon}
                  label={t("auth.logout")}
                  onSelect={() => run(() => logout.mutate())}
                />
              </Command.Group>
              {q.length >= 2 && posts.data?.length ? (
                <Command.Group heading={t("command.posts")} className={groupClass}>
                  {posts.data.map((p) => (
                    <Item
                      key={p.id}
                      value={`post ${p.id} ${p.title}`}
                      keywords={[q]}
                      icon={FileTextIcon}
                      label={p.title}
                      onSelect={() => go(`/posts/${p.id}`)}
                    />
                  ))}
                </Command.Group>
              ) : null}
              {q.length >= 2 && users.data?.length ? (
                <Command.Group heading={t("command.users")} className={groupClass}>
                  {users.data.map((u) => (
                    <Item
                      key={u.id}
                      value={`user ${u.id} ${u.username} ${u.email}`}
                      keywords={[q]}
                      icon={UserIcon}
                      label={`@${u.username}`}
                      onSelect={() => go(`/users?q=${encodeURIComponent(u.username)}`)}
                    />
                  ))}
                </Command.Group>
              ) : null}
              {searching ? (
                <Command.Loading>
                  <span className="block px-2 py-1.5 text-xs text-muted-foreground">{t("command.searching")}</span>
                </Command.Loading>
              ) : null}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
