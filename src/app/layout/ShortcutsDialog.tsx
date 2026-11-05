import { usePermissions } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";
import { shortcutGroups, shortcuts } from "@/shared/lib/shortcuts";
import { keyLabels } from "@/shared/lib/useHotkeys";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { kbdClass } from "@/shared/ui/search-input";
import { visibleNavigation } from "../nav";

function Keys({ spec }: { spec: string }) {
  const { t } = useI18n();
  const steps = keyLabels(spec);
  return (
    <span className="flex shrink-0 items-center gap-1">
      {steps.map((step, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
        <span key={i} className="flex items-center gap-1">
          {i > 0 ? <span className="text-xs text-muted-foreground">{t("shortcuts.sequenceThen")}</span> : null}
          {step.map((k) => (
            <kbd key={k} className={kbdClass}>
              {k}
            </kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

/** Generated from the shortcut registry and the nav hotkeys, so it always matches the bindings. */
export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useI18n();
  const { canAny } = usePermissions();
  const goTo = visibleNavigation(canAny)
    .flatMap((g) => g.items)
    .filter((i) => i.hotkey);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t("common.close")} className="max-w-2xl">
        <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("shortcuts.help")}</DialogDescription>
        <div className="grid gap-6 sm:grid-cols-2">
          {shortcutGroups.map((g) => (
            <section key={g.label} aria-labelledby={`sc-${g.label}`}>
              <h2 id={`sc-${g.label}`} className="mb-2 text-base font-semibold">
                {t(g.label)}
              </h2>
              <dl className="grid gap-1.5 text-sm">
                {g.ids.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-3">
                    <dt>{t(shortcuts[id].label)}</dt>
                    <dd>
                      <Keys spec={shortcuts[id].keys} />
                    </dd>
                  </div>
                ))}
                {g.label === "shortcuts.global"
                  ? goTo.map((i) => (
                      <div key={i.to} className="flex items-center justify-between gap-3">
                        <dt>{t("shortcuts.goto", { page: t(i.label) })}</dt>
                        <dd>
                          <Keys spec={`g ${i.hotkey}`} />
                        </dd>
                      </div>
                    ))
                  : null}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
