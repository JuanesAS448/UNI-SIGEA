import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  className?: string;
  iconClassName?: string;
}

export function StatCard({ title, value, icon: Icon, description, className, iconClassName }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border border-border/80 bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-5 text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight text-card-foreground">{value}</p>
          {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
        <div className={cn("ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-md", iconClassName || "bg-primary/10")}>
          <Icon className={cn("h-[18px] w-[18px]", iconClassName ? "text-current" : "text-primary")} />
        </div>
      </div>
    </div>
  );
}
