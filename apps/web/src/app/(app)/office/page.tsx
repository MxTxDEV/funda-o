import { getOfficeSnapshot } from "@vc/core";
import { PageHeader } from "@/components/page-header";
import { VirtualOffice } from "@/components/office/VirtualOffice";
import { scheduleDrain } from "@/lib/drain";
import { getServiceContext } from "@/lib/session";

export const metadata = { title: "Escritório Virtual" };
export const dynamic = "force-dynamic";

export default async function OfficePage() {
  const ctx = await getServiceContext();
  const snapshot = await getOfficeSnapshot(ctx);
  const q = snapshot.brain.queue;
  if (q && q.waiting + q.delayed > 0) scheduleDrain();

  return (
    <>
      <PageHeader
        eyebrow="Escritório"
        title="Escritório Virtual"
        description="Visão 3D da operação em tempo real. Clique nos funcionários, nas salas e no Central Brain para ver detalhes."
      />
      <VirtualOffice initial={snapshot} />
    </>
  );
}
