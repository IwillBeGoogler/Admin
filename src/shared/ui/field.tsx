import { type ReactNode, useId } from "react";
import { Label } from "./input";

/** Label + control + hint/error wired with aria-describedby. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: ReactNode;
  error?: string | undefined;
  hint?: ReactNode;
  children: (p: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": error || hint ? msgId : undefined })}
      {error ? (
        <p id={msgId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
