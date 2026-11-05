import { useI18n } from "@/shared/i18n";
import { ListView } from "@/shared/ui/list-view";
import { PageHeader } from "@/shared/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/table";
import { usePermissionList } from "../application/hooks";

export function PermissionsPage() {
  const { t } = useI18n();
  const q = usePermissionList();
  return (
    <>
      <PageHeader title={t("permissions.title")} />
      <ListView query={q} items={q.data ?? []} empty={{ title: t("permissions.empty") }}>
        {(rows) => (
          <Table>
            <caption className="sr-only">{t("permissions.title")}</caption>
            <THead>
              <TR>
                <TH>{t("permissions.code")}</TH>
                <TH>{t("permissions.description")}</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.code}>
                  <TD>
                    <code>{p.code}</code>
                  </TD>
                  <TD className="text-muted-foreground">{p.description}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </ListView>
    </>
  );
}
