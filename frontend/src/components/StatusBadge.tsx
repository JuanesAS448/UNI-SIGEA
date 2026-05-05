import { cn } from "@/lib/utils";

const config: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "border-border text-muted-foreground bg-card" },
  procesando: { label: "Procesando", className: "border-border text-muted-foreground bg-muted/80" },
  en_revision: { label: "En Revisión", className: "border-info/30 text-info bg-info/10" },
  aprobado: { label: "Aprobado", className: "border-success/30 text-success bg-success/10" },
  rechazado: { label: "Rechazado", className: "border-destructive/30 text-destructive bg-destructive/10" },
  error_procesamiento: { label: "Error", className: "border-destructive/40 text-destructive bg-destructive/15" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status as string] ?? config["pendiente"]!;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium", c.className)}>
      {c.label}
    </span>
  );
}

