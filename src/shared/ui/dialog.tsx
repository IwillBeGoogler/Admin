import { Loader2Icon, XIcon } from "lucide-react";
import { AlertDialog as AD, Dialog as D } from "radix-ui";
import { type ComponentProps, type ReactNode, useId, useRef, useState } from "react";
import { errorMessage } from "@/shared/http/problem";
import { useI18n } from "@/shared/i18n";
import { cn } from "@/shared/lib/cn";
import { notifyError } from "@/shared/lib/notify";
import { Button } from "./button";
import { Input } from "./input";

const overlay = "fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0";
const content =
  "fixed left-1/2 top-1/2 z-50 grid max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-lg";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** `locked` (a request is in flight) blocks Esc, outside clicks and the close button. */
export function DialogContent({
  className,
  children,
  closeLabel = "Close",
  locked = false,
  onEscapeKeyDown,
  onPointerDownOutside,
  ...p
}: ComponentProps<typeof D.Content> & { closeLabel?: string; locked?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(content, className)}
        aria-busy={locked || undefined}
        onEscapeKeyDown={(e) => {
          if (locked) e.preventDefault();
          onEscapeKeyDown?.(e);
        }}
        onPointerDownOutside={(e) => {
          if (locked) e.preventDefault();
          onPointerDownOutside?.(e);
        }}
        {...p}
      >
        {children}
        <D.Close
          disabled={locked}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring outline-none disabled:pointer-events-none"
        >
          <XIcon className="size-4" aria-hidden />
          <span className="sr-only">{closeLabel}</span>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
export const DialogTitle = ({ className, ...p }: ComponentProps<typeof D.Title>) => (
  <D.Title className={cn("text-lg font-semibold", className)} {...p} />
);
export const DialogDescription = ({ className, ...p }: ComponentProps<typeof D.Description>) => (
  <D.Description className={cn("text-sm text-muted-foreground", className)} {...p} />
);
export const DialogFooter = ({ className, ...p }: ComponentProps<"div">) => (
  <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...p} />
);

/** Button label with a spinner while `pending`. */
export function PendingLabel({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {children}
    </>
  );
}

/**
 * Confirmation for irreversible or bulk actions; focus lands on Cancel.
 *
 * `onConfirm` may return a promise: the dialog then shows a spinner, ignores
 * repeated clicks, locks Esc, closes on success and stays open with the error
 * inline (plus a persistent toast with Retry) on failure.
 * `confirmText` (high-risk actions) must be typed before confirm is enabled.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending: pendingProp = false,
  variant = "destructive",
  confirmText,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => unknown;
  pending?: boolean;
  variant?: "destructive" | "default";
  confirmText?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [typed, setTyped] = useState("");
  const inFlight = useRef(false);
  const inputId = useId();
  const pending = pendingProp || busy;
  const typedOk = !confirmText || typed.trim() === confirmText;

  const change = (o: boolean) => {
    if (!o && inFlight.current) return;
    if (!o) {
      setError(null);
      setTyped("");
    }
    onOpenChange(o);
  };

  const run = async () => {
    if (inFlight.current || pendingProp || !typedOk) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = onConfirm();
      if (r instanceof Promise) {
        await r;
        inFlight.current = false;
        setBusy(false);
        change(false);
      }
    } catch (e) {
      setError(e);
      notifyError(e, { label: t("common.retry"), onClick: () => void run() });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <AD.Root open={open} onOpenChange={change}>
      <AD.Portal>
        <AD.Overlay className={overlay} />
        <AD.Content
          className={content}
          aria-busy={pending || undefined}
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <AD.Title className="text-lg font-semibold">{title}</AD.Title>
          {description ? (
            <AD.Description className="text-sm text-muted-foreground">{description}</AD.Description>
          ) : null}
          {children}
          {confirmText ? (
            <div className="grid gap-1.5">
              <label htmlFor={inputId} className="text-sm">
                {t("list.typeToConfirm", { text: confirmText })}
              </label>
              <Input
                id={inputId}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typed}
                disabled={pending}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void run();
                  }
                }}
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(error)}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            </AD.Cancel>
            <Button
              variant={variant}
              disabled={pending || !typedOk}
              aria-busy={pending || undefined}
              onClick={(e) => {
                e.preventDefault();
                void run();
              }}
            >
              <PendingLabel pending={pending}>{confirmLabel}</PendingLabel>
            </Button>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
