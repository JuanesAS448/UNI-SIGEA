import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import {
  Upload, CheckCircle2, AlertTriangle, Clock, FileText,
  Briefcase, Loader2, RefreshCw, Users,
} from "lucide-react";
import { usePostulantes } from "@/hooks/usePostulantes";
import { useConvocatorias } from "@/hooks/useConvocatorias";
import { useDocumentos, useActualizarDocumento } from "@/hooks/useDocumentos";
import type { Documento, EstadoDocumento, EstadoSemaforo } from "@/types/api";
import { SemaphoreBadge } from "@/components/SemaphoreBadge";
import { StatusBadge } from "@/components/StatusBadge";

// ── Config de estado ──────────────────────────────────────────────────────────
const estadoConfig: Record<EstadoDocumento, {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon: React.ReactNode;
}> = {
  pendiente:   { label: "Pendiente",   variant: "outline",     icon: <Clock className="h-4 w-4" /> },
  en_revision: { label: "En Revisión", variant: "secondary",   icon: <FileText className="h-4 w-4" /> },
  aprobado:    { label: "Aprobado",    variant: "default",     icon: <CheckCircle2 className="h-4 w-4" /> },
  rechazado:   { label: "Rechazado",   variant: "destructive", icon: <AlertTriangle className="h-4 w-4" /> },
};

// ── Vista de administrador: gestión de todos los postulantes ──────────────────
function VistaAdminPostulantes() {
  const { data, isLoading, isError, refetch, isFetching } = usePostulantes();
  const postulantes = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portal de Postulantes</h1>
          <p className="text-sm text-muted-foreground">
            Vista administrativa — {data?.count ?? "—"} postulantes registrados
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Cargando postulantes...</span>
        </div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-destructive">
          Error al cargar. ¿Está el backend corriendo?
        </p>
      ) : postulantes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No hay postulantes registrados aún</p>
          <p className="mt-1 text-xs text-muted-foreground">Los postulantes aparecen aquí al completar su registro</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3">Postulante</th>
                <th className="px-6 py-3">Documento</th>
                <th className="px-6 py-3">Contacto</th>
                <th className="px-6 py-3">Estado</th>
                <th className="px-6 py-3">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {postulantes.map((p) => (
                <tr key={p.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {p.nombres.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.nombres} {p.apellidos}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-muted-foreground">{p.tipo_documento}</p>
                    <p className="text-xs font-mono text-foreground">{p.numero_documento}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{p.telefono}</td>
                  <td className="px-6 py-4">
                    <Badge variant={p.estado === "activo" ? "default" : "secondary"}>
                      {p.estado === "activo" ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    {new Date(p.fecha_registro).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Vista del postulante: seguimiento de documentos propios ───────────────────
function VistaPostulante() {
  const { data: convData, isLoading: loadingConv } = useConvocatorias();
  const { data: docsData, isLoading: loadingDocs, isError: errorDocs } = useDocumentos();
  const { mutate: actualizarDoc } = useActualizarDocumento();

  const convocatorias = convData?.results?.filter((c) => !c.archivado && c.estado === "abierta") ?? [];
  const documentos = docsData?.results ?? [];

  // Estadísticas
  const aprobados   = documentos.filter((d) => d.estado === "aprobado").length;
  const pendientes  = documentos.filter((d) => d.estado === "pendiente").length;
  const enRevision  = documentos.filter((d) => d.estado === "en_revision").length;
  const rechazados  = documentos.filter((d) => d.estado === "rechazado").length;
  const total       = documentos.length;
  const progreso    = total > 0 ? Math.round((aprobados / total) * 100) : 0;

  const handleAprobar = (doc: Documento) => {
    actualizarDoc(
      { id: doc.id, data: { estado: "aprobado" as EstadoDocumento, estado_semaforo: "verde" as EstadoSemaforo } },
      {
        onSuccess: () => toast({ title: "Documento aprobado", description: `"${doc.nombre_archivo}" marcado como aprobado.` }),
        onError: () => toast({ title: "Error", description: "No se pudo actualizar el documento.", variant: "destructive" }),
      }
    );
  };

  const handleRechazar = (doc: Documento) => {
    actualizarDoc(
      { id: doc.id, data: { estado: "rechazado" as EstadoDocumento, estado_semaforo: "rojo" as EstadoSemaforo, observaciones: "Documento rechazado manualmente." } },
      {
        onSuccess: () => toast({ title: "Documento rechazado", description: `"${doc.nombre_archivo}" marcado como rechazado.` }),
        onError: () => toast({ title: "Error", description: "No se pudo actualizar el documento.", variant: "destructive" }),
      }
    );
  };

  if (loadingConv || loadingDocs) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando información...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Portal del Postulante</h1>
        <p className="text-muted-foreground">Revisa el estado de los documentos cargados al sistema.</p>
      </div>

      {/* Convocatorias abiertas */}
      {convocatorias.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Convocatorias Abiertas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {convocatorias.map((c) => (
              <Card key={c.id} className="border-primary/20 bg-primary/5">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground text-sm">{c.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      Hasta {new Date(c.fecha_fin).toLocaleDateString("es-CO")} · {c.postulantes_count} postulantes
                    </p>
                  </div>
                  <Badge className="shrink-0" variant="default">Abierta</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Progreso general */}
      {total > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Progreso de Documentación Global</CardTitle>
            <CardDescription>{aprobados} de {total} documentos aprobados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={progreso} className="h-3" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Pendientes",  value: pendientes,  color: "" },
                { label: "En Revisión", value: enRevision,  color: "" },
                { label: "Aprobados",   value: aprobados,   color: "text-primary" },
                { label: "Rechazados",  value: rechazados,  color: "text-destructive" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border border-border bg-muted/50 p-3 text-center">
                  <p className={`text-2xl font-bold text-foreground ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Listado de documentos */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Documentos en el Sistema</h2>
        <p className="text-sm text-muted-foreground">
          Documentos cargados por los postulantes. Puedes aprobar o rechazar cada uno.
        </p>
      </div>

      {errorDocs ? (
        <p className="py-8 text-center text-sm text-destructive">Error al cargar los documentos del sistema.</p>
      ) : documentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">No hay documentos cargados aún</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documentos.map((doc) => {
            const cfg = estadoConfig[doc.estado] ?? estadoConfig["pendiente"];
            const isAprobado = doc.estado === "aprobado";
            const isRechazado = doc.estado === "rechazado";

            return (
              <Card key={doc.id} className={isRechazado ? "border-destructive/40" : isAprobado ? "border-primary/30" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                        {doc.nombre_archivo ?? `Documento #${doc.id}`}
                        {doc.documento_requerido_nombre && (
                          <span className="text-xs font-normal text-muted-foreground">
                            — {doc.documento_requerido_nombre}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {doc.postulante_nombre ?? "Postulante desconocido"}
                        {doc.convocatoria_titulo && ` · ${doc.convocatoria_titulo}`}
                        {` · Cargado ${new Date(doc.fecha_carga).toLocaleDateString("es-CO")}`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <SemaphoreBadge status={doc.estado_semaforo} />
                      <StatusBadge status={doc.estado} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {isRechazado && doc.observaciones && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Documento Rechazado</AlertTitle>
                      <AlertDescription>{doc.observaciones}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc.url_archivo && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={doc.url_archivo} target="_blank" rel="noopener noreferrer" className="gap-2">
                          <FileText className="h-4 w-4" />
                          Ver archivo
                        </a>
                      </Button>
                    )}
                    {!isAprobado && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAprobar(doc)}
                        className="gap-2 text-green-600 border-green-300 hover:bg-green-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Aprobar
                      </Button>
                    )}
                    {!isRechazado && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRechazar(doc)}
                        className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Rechazar
                      </Button>
                    )}
                    {doc.confianza_ocr > 0 && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        OCR: {doc.confianza_ocr}%
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Componente principal: detecta si es admin o postulante ────────────────────
export default function PortalPostulante() {
  // En un sistema real se obtendría el rol desde AuthContext.
  // Por ahora mostramos ambas vistas con un toggle para demostración.
  const [vistaAdmin, setVistaAdmin] = useState(true);

  return (
    <div>
      {/* Toggle de vista (para demo) */}
      <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <span className="text-xs text-muted-foreground">Vista:</span>
        <Button
          size="sm"
          variant={vistaAdmin ? "default" : "outline"}
          onClick={() => setVistaAdmin(true)}
        >
          Administrador
        </Button>
        <Button
          size="sm"
          variant={!vistaAdmin ? "default" : "outline"}
          onClick={() => setVistaAdmin(false)}
        >
          Postulante
        </Button>
      </div>

      {vistaAdmin ? <VistaAdminPostulantes /> : <VistaPostulante />}
    </div>
  );
}
