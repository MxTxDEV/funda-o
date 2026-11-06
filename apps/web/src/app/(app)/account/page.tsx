import { ROLE_LABELS } from "@vc/core";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getServiceContext } from "@/lib/session";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Minha conta" };

export default async function AccountPage() {
  const { actor } = await getServiceContext();
  return (
    <>
      <PageHeader eyebrow="Conta" title="Minha conta" description={`${actor.name} · ${actor.email} · ${ROLE_LABELS[actor.role]}`} />
      <Card className="max-w-lg">
        <CardHeader>
          <div>
            <CardTitle>Alterar senha</CardTitle>
            <CardDescription>Ao alterar, todas as sessões abertas (inclusive esta) são encerradas e você entra novamente.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </>
  );
}
