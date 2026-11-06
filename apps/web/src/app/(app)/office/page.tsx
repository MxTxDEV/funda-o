import { getOfficeSnapshot } from "@vc/core";
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
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Escritório Virtual</h1>
        <p className="hidden text-xs text-muted-foreground md:block">Clique nos funcionários, nas salas e no Central Brain para ver detalhes.</p>
      </div>
      <VirtualOffice initial={snapshot} />
    </>
  );
}
