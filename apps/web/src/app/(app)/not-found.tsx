import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <p className="mt-2 text-sm text-muted-foreground">Registro não encontrado.</p>
      <Button asChild className="mt-6" variant="secondary">
        <Link href="/">Voltar ao centro de comando</Link>
      </Button>
    </div>
  );
}
