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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen general del sistema UNI SIGEA</p>
        </div>
        {loadingStats && (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-card-foreground">Semáforo Inteligente</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div
            className="flex items-center gap-4 rounded-lg border border-border p-4 cursor-pointer hover:bg-accent/10"
            onClick={() => navigate('/documentos/semaforo/verde')}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-semaphore-green/10">
              <CircleDot className="h-6 w-6 text-semaphore-green" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.semaforo_verde ?? "—"}</p>
              <p className="text-sm text-muted-foreground">Vigentes</p>
            </div>
          </div>
          <div
            className="flex items-center gap-4 rounded-lg border border-border p-4 cursor-pointer hover:bg-accent/10"
            onClick={() => navigate('/documentos/semaforo/amarillo')}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-semaphore-yellow/10">
              <CircleDot className="h-6 w-6 text-semaphore-yellow" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.semaforo_amarillo ?? "—"}</p>
              <p className="text-sm text-muted-foreground">Con dudas</p>
            </div>
          </div>
          <div
            className="flex items-center gap-4 rounded-lg border border-border p-4 cursor-pointer hover:bg-accent/10"
            onClick={() => navigate('/documentos/semaforo/rojo')}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-semaphore-red/10">
              <CircleDot className="h-6 w-6 text-semaphore-red" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats?.semaforo_rojo ?? "—"}</p>
              <p className="text-sm text-muted-foreground">Vencidos / Ilegibles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Documents Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-card-foreground">Documentos Recientes</h2>
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Documento</th>
                  <th className="px-6 py-3">Postulante</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Semáforo</th>
                  <th className="px-6 py-3">OCR</th>
                  <th className="px-6 py-3">Fecha Carga</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-foreground">
                      {doc.nombre_archivo ?? `Documento #${doc.id}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {doc.postulante_nombre ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={doc.estado} />
                    </td>
                    <td className="px-6 py-4">
                      <SemaphoreBadge status={doc.estado_semaforo} />
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {doc.confianza_ocr}%
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
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
