import { FileText, Users, ClipboardList, CheckCircle, AlertCircle, CircleDot, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { SemaphoreBadge } from "@/components/SemaphoreBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useDashboardStats } from "@/hooks/useDashboard";
import { useDocumentos } from "@/hooks/useDocumentos";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: loadingStats, isError: errorStats } = useDashboardStats();
  const { data: docsData, isLoading: loadingDocs } = useDocumentos();

  const recentDocs = docsData?.results?.slice(0, 5) ?? [];

  if (errorStats) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">No se pudo conectar con el backend</p>
          <p className="text-sm mt-1 text-destructive/80">
            Asegúrate de que Django esté corriendo en <code>http://localhost:8000</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Resumen general del sistema UNI SIGEA</p>
        </div>
        {loadingStats && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Convocatorias Activas"
          value={stats?.convocatorias_activas ?? "—"}
          icon={ClipboardList}
          description={`${(stats?.convocatorias_activas ?? 0) + (stats?.convocatorias_cerradas ?? 0)} en total`}
        />
        <StatCard
          title="Documentos Cargados"
          value={stats?.total_documentos ?? "—"}
          icon={FileText}
          description={`${stats?.documentos_pendientes ?? 0} pendientes de revisión`}
        />
        <StatCard
          title="Aprobados"
          value={stats?.documentos_aprobados ?? "—"}
          icon={CheckCircle}
          iconClassName="bg-success/10 text-success"
        />
        <StatCard
          title="Postulantes"
          value={stats?.total_postulantes ?? "—"}
          icon={Users}
        />
      </div>

      {/* Semaphore Summary */}
      <div className="rounded-lg border border-border/80 bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight text-card-foreground">Semáforo Inteligente</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-muted/20 p-3.5 transition-colors hover:border-semaphore-green/30 hover:bg-semaphore-green/5 sm:gap-4 sm:p-4"
            onClick={() => navigate('/documentos/semaforo/verde')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-semaphore-green/10">
              <CircleDot className="h-5 w-5 text-semaphore-green" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{stats?.semaforo_verde ?? "—"}</p>
              <p className="text-xs font-medium text-muted-foreground">Vigentes</p>
            </div>
          </div>
          <div
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-muted/20 p-3.5 transition-colors hover:border-semaphore-yellow/40 hover:bg-semaphore-yellow/5 sm:gap-4 sm:p-4"
            onClick={() => navigate('/documentos/semaforo/amarillo')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-semaphore-yellow/15">
              <CircleDot className="h-5 w-5 text-semaphore-yellow" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{stats?.semaforo_amarillo ?? "—"}</p>
              <p className="text-xs font-medium text-muted-foreground">Con dudas</p>
            </div>
          </div>
          <div
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-muted/20 p-3.5 transition-colors hover:border-semaphore-red/30 hover:bg-semaphore-red/5 sm:gap-4 sm:p-4"
            onClick={() => navigate('/documentos/semaforo/rojo')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-semaphore-red/10">
              <CircleDot className="h-5 w-5 text-semaphore-red" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{stats?.semaforo_rojo ?? "—"}</p>
              <p className="text-xs font-medium text-muted-foreground">Vencidos / Ilegibles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Documents Table */}
      <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-card-foreground">Documentos Recientes</h2>
        </div>
        <div className="overflow-x-auto">
          {loadingDocs ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando documentos...</span>
            </div>
          ) : recentDocs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No hay documentos aún. Sube el primero desde la sección Documentos.
            </p>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-border bg-muted/35 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 sm:px-5">Documento</th>
                  <th className="px-4 py-3 sm:px-5">Postulante</th>
                  <th className="px-4 py-3 sm:px-5">Estado</th>
                  <th className="px-4 py-3 sm:px-5">Semáforo</th>
                  <th className="px-4 py-3 text-right sm:px-5">OCR</th>
                  <th className="px-4 py-3 sm:px-5">Fecha Carga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentDocs.map((doc) => (
                  <tr key={doc.id} className="transition-colors hover:bg-muted/30">
                    <td className="max-w-[240px] truncate px-4 py-3.5 text-sm font-medium text-foreground sm:px-5">
                      {doc.nombre_archivo ?? `Documento #${doc.id}`}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3.5 text-sm text-muted-foreground sm:px-5">
                      {doc.postulante_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <StatusBadge status={doc.estado} />
                    </td>
                    <td className="px-4 py-3.5 sm:px-5">
                      <SemaphoreBadge status={doc.estado_semaforo} />
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm tabular-nums text-muted-foreground sm:px-5">
                      {doc.confianza_ocr}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm text-muted-foreground sm:px-5">
                      {new Date(doc.fecha_carga).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
