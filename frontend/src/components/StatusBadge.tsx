import { cn } from "@/lib/utils";

const config: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "border-border bg-muted/40 text-muted-foreground" },
  procesando: { label: "Procesando", className: "border-border bg-muted/70 text-foreground" },
  en_revision: { label: "En Revisión", className: "border-info/25 bg-info/10 text-info" },
  aprobado: { label: "Aprobado", className: "border-success/25 bg-success/10 text-success" },
  rechazado: { label: "Rechazado", className: "border-destructive/25 bg-destructive/10 text-destructive" },
  error_procesamiento: { label: "Error", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status as string] ?? config["pendiente"]!;
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium leading-none", c.className)}>
      {c.label}
    </span>
  );
}
