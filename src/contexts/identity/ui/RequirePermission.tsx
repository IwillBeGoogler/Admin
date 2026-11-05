import type { ReactNode } from "react";
import { useI18n } from "@/shared/i18n";
import { ErrorState } from "@/shared/ui/states";
import { usePermissions } from "../application/session";
import type { PermissionCode } from "../domain/permissions";

/** Renders children only when the admin holds one of `anyOf`. */
export function RequirePermission({
  anyOf,
  children,
  fallback,
}: {
  anyOf: readonly PermissionCode[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canAny } = usePermissions();
  const { t } = useI18n();
  if (canAny(anyOf)) return children;
  return fallback === undefined ? <ErrorState error={new Error(t("common.forbidden"))} /> : fallback;
}

/** Inline variant for buttons and menu items. */
export function Can({ code, children }: { code: PermissionCode; children: ReactNode }) {
  return usePermissions().can(code) ? children : null;
}
