import { cn } from "@/lib/utils";
import type { EstadoSemaforo } from "@/types/api";

const config: Record<EstadoSemaforo, { label: string; className: string }> = {
  verde: { label: "Vigente", className: "border border-semaphore-green/25 bg-semaphore-green/10 text-semaphore-green" },
  amarillo: { label: "Dudas", className: "border border-semaphore-yellow/30 bg-semaphore-yellow/15 text-foreground" },
  rojo: { label: "Vencido", className: "border border-semaphore-red/25 bg-semaphore-red/10 text-semaphore-red" },
};

export function SemaphoreBadge({ status, className }: { status: EstadoSemaforo; className?: string }) {
  const c = config[status] ?? config["amarillo"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium leading-none", c.className, className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {c.label}
    </span>
  );
}
