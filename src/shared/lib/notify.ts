import { toast } from "sonner";
import { errorMessage } from "@/shared/http/problem";

/**
 * Toast policy (UX_SPEC item 12): success toasts auto-dismiss after 4 s and
 * name the object; error toasts stay until dismissed and carry the problem
 * detail, plus "Retry" when the failed call is idempotent.
 */
export const SUCCESS_MS = 4000;

export const notifySuccess = (message: string) => toast.success(message, { duration: SUCCESS_MS });

export const notifyError = (error: unknown, retry?: { label: string; onClick: () => void }) =>
  toast.error(errorMessage(error), {
    duration: Number.POSITIVE_INFINITY,
    ...(retry ? { action: { label: retry.label, onClick: retry.onClick } } : {}),
  });

export const notifyWarning = (message: string) => toast.warning(message, { duration: Number.POSITIVE_INFINITY });
