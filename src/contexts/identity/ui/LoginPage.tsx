import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyholeIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { errorMessage } from "@/shared/http";
import { type MessageKey, useI18n } from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { useLogin, useLoginMfa } from "../application/session";
import { type LoginInput, loginInputSchema, type MfaInput, mfaInputSchema } from "../domain/session";

export function LoginPage({ onSignedIn, notice }: { onSignedIn: () => void; notice?: string | undefined }) {
  const { t } = useI18n();
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
            <LockKeyholeIcon className="size-5" aria-hidden />
          </div>
          <CardTitle>
            <span className="text-xl">{mfaToken ? t("auth.mfaTitle") : t("auth.title")}</span>
          </CardTitle>
          <CardDescription>{mfaToken ? t("auth.mfaHint") : t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {notice ? (
            <p role="status" className="mb-4 rounded-md bg-warning/15 p-2 text-sm text-foreground">
              {notice}
            </p>
          ) : null}
          {mfaToken ? (
            <MfaForm mfaToken={mfaToken} onDone={onSignedIn} />
          ) : (
            <PasswordForm onMfa={setMfaToken} onDone={onSignedIn} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function PasswordForm({ onMfa, onDone }: { onMfa: (t: string) => void; onDone: () => void }) {
  const { t } = useI18n();
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { login: "", password: "" },
  });
  const err = form.formState.errors;
  const submit = form.handleSubmit((v) =>
    login.mutate(v, { onSuccess: (r) => (r.kind === "mfa" ? onMfa(r.mfaToken) : onDone()) }),
  );
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label={t("auth.login")} error={err.login?.message && t(err.login.message as MessageKey)}>
        {(a) => <Input {...a} autoComplete="username" autoFocus {...form.register("login")} />}
      </Field>
      <Field label={t("auth.password")} error={err.password?.message && t(err.password.message as MessageKey)}>
        {(a) => <Input {...a} type="password" autoComplete="current-password" {...form.register("password")} />}
      </Field>
      {login.error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(login.error)}
        </p>
      ) : null}
      <Button type="submit" disabled={login.isPending}>
        {login.isPending ? t("common.loading") : t("auth.submit")}
      </Button>
    </form>
  );
}

function MfaForm({ mfaToken, onDone }: { mfaToken: string; onDone: () => void }) {
  const { t } = useI18n();
  const verify = useLoginMfa();
  const form = useForm<MfaInput>({ resolver: zodResolver(mfaInputSchema), defaultValues: { code: "" } });
  const submit = form.handleSubmit((v) => verify.mutate({ mfaToken, code: v.code }, { onSuccess: onDone }));
  const e = form.formState.errors.code?.message;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label={t("auth.code")} error={e && t(e as MessageKey)}>
        {(a) => <Input {...a} inputMode="numeric" autoComplete="one-time-code" autoFocus {...form.register("code")} />}
      </Field>
      {verify.error ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(verify.error)}
        </p>
      ) : null}
      <Button type="submit" disabled={verify.isPending}>
        {t("auth.verify")}
      </Button>
    </form>
  );
}
