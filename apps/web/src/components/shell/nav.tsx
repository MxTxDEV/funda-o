"use client";
import {
  Box,
  Building2,
  CheckCheck,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  ScrollText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Centro de comando", icon: LayoutDashboard, exact: true },
  { href: "/office", label: "Escritório Virtual", icon: Box },
  { href: "/departments", label: "Departamentos", icon: Building2 },
  { href: "/agents", label: "Funcionários", icon: Users },
  { href: "/tasks", label: "Tarefas", icon: ListTodo },
  { href: "/approvals", label: "Aprovações", icon: CheckCheck, badgeKey: "approvals" as const },
  { href: "/conversations", label: "Conversas", icon: MessagesSquare },
  { href: "/audit", label: "Auditoria", icon: ScrollText, permission: "audit" as const },
];

export function Nav({ pendingApprovals, canAudit }: { pendingApprovals: number; canAudit: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Navegação principal">
      {ITEMS.filter((i) => i.permission !== "audit" || canAudit).map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary shadow-[0_0_8px_#3d7bff]" />}
            <Icon className={cn("size-4", active && "text-primary")} />
            <span className="flex-1">{item.label}</span>
            {item.badgeKey === "approvals" && pendingApprovals > 0 && (
              <span className="rounded-full bg-warning/15 px-1.5 text-[11px] font-semibold text-warning">{pendingApprovals}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
