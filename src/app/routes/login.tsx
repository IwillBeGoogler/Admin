import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { isSignedIn, LoginPage } from "@/contexts/identity";
import { useI18n } from "@/shared/i18n";

const search = z.object({
  redirect: z.string().optional().catch(undefined),
  expired: z.boolean().optional().catch(undefined),
});

/** Only same-origin paths; never an absolute URL from the query string. */
const safeRedirect = (r: string | undefined) => (r?.startsWith("/") && !r.startsWith("//") ? r : "/");

export const Route = createFileRoute("/login")({
  validateSearch: search,
  beforeLoad: ({ search }) => {
    if (isSignedIn()) throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: Login,
});

function Login() {
  const { redirect: to, expired } = Route.useSearch();
  const router = useRouter();
  const { t } = useI18n();
  return (
    <LoginPage
      notice={expired ? t("auth.expired") : undefined}
      onSignedIn={() => void router.history.push(safeRedirect(to))}
    />
  );
}
