import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Eye, CheckCircle, XCircle, Loader2, FolderCheck, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SemaphoreBadge } from "@/components/SemaphoreBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useDocumentos, useActualizarDocumento } from "@/hooks/useDocumentos";
import { useExpedientes } from "@/hooks/useExpedientes";
import type { Documento, Expediente } from "@/types/api";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const expedienteStatusConfig = {
  completo: { label: "Completo", icon: CheckCircle, className: "text-success" },
  en_proceso: { label: "En Proceso", icon: Clock, className: "text-info" },
  incompleto: { label: "Incompleto", icon: AlertCircle, className: "text-destructive" },
} as const;

function ExpedienteCard({ expediente }: { expediente: Expediente }) {
  const progress = Math.round(expediente.progreso_porcentaje);
  const config = expedienteStatusConfig[expediente.estado] ?? expedienteStatusConfig["en_proceso"];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FolderCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">
              {expediente.postulante_nombre} {expediente.postulante_apellidos}
            </h3>
            <p className="text-xs text-muted-foreground">{expediente.convocatoria_titulo}</p>
          </div>
        </div>
        <Icon className={cn("h-5 w-5", config.className)} />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progreso</span>
          <span className="font-medium text-foreground">
            {expediente.documentos_aprobados_count}/{expediente.documentos_count}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className={cn("text-xs font-medium", config.className)}>{config.label}</p>
      </div>
    </div>
  );
}

export default function Documentos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mainTab = searchParams.get("tab") === "expedientes" ? "expedientes" : "documentos";

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Documento | null>(null);
  const [observacion, setObservacion] = useState("");

  const { data, isLoading, isError } = useDocumentos();
  const {
    data: expData,
    isLoading: expLoading,
    isError: expError,
  } = useExpedientes();
  const actualizarMutation = useActualizarDocumento();

  const documentos = data?.results ?? [];

  const filtered = documentos.filter(
    (d) =>
      (d.nombre_archivo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (d.postulante_nombre ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAprobar = (doc: Documento) => {
    actualizarMutation.mutate(
      { id: doc.id, data: { estado: "aprobado" } },
      {
        onSuccess: () => {
          toast({ title: "Documento aprobado", description: "Se aprobó el documento correctamente." });
          setSelected(null);
        },
      }
    );
  };

  const handleRechazar = (doc: Documento) => {
    if (!observacion.trim()) {
      toast({ title: "Observación requerida", description: "Escriba una observación antes de rechazar.", variant: "destructive" });
      return;
    }
    actualizarMutation.mutate(
      { id: doc.id, data: { estado: "rechazado", observaciones: observacion } },
      {
        onSuccess: () => {
          toast({ title: "Documento rechazado", description: "El documento fue rechazado con observación." });
          setSelected(null);
          setObservacion("");
        },
      }
    );
  };

  const expedientes = expData?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentación</h1>
          <p className="text-sm text-muted-foreground">Expedientes por convocatoria y revisión de archivos</p>
        </div>
      </div>

      <Tabs
        value={mainTab}
        onValueChange={(v) => {
          if (v === "expedientes") setSearchParams({ tab: "expedientes" });
          else setSearchParams({});
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="expedientes">Expedientes</TabsTrigger>
        </TabsList>

        <TabsContent value="documentos" className="mt-6 space-y-6">
      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por documento o postulante..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando documentos...</span>
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-destructive">
              Error al cargar documentos. ¿Está el backend corriendo?
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {search ? "No hay resultados para esa búsqueda." : "No hay documentos cargados aún."}
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Documento</th>
                  <th className="px-6 py-3">Postulante</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Semáforo</th>
                  <th className="px-6 py-3">Confianza OCR</th>
                  <th className="px-6 py-3">Validación</th>
                  <th className="px-6 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((doc) => (
                  <tr key={doc.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {doc.nombre_archivo ?? `Documento #${doc.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{doc.convocatoria_titulo ?? "—"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {doc.postulante_nombre ?? "—"}
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={doc.estado} /></td>
                    <td className="px-6 py-4"><SemaphoreBadge status={doc.estado_semaforo} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-border">
                          <div
                            className="h-2 rounded-full bg-primary transition-all"
                            style={{ width: `${doc.confianza_ocr}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{doc.confianza_ocr}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs capitalize text-muted-foreground">{doc.tipo_validacion}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => { setSelected(doc); setObservacion(""); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(doc.estado === "pendiente" || doc.estado === "en_revision") && (
                          <>
                            <Button
                              variant="ghost" size="sm"
                              className="text-success hover:text-success"
                              onClick={() => handleAprobar(doc)}
                              disabled={actualizarMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => { setSelected(doc); setObservacion(""); }}
                              disabled={actualizarMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail / Actions Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del Documento</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Archivo</Label>
                  <p className="text-sm font-medium text-foreground">
                    {selected.nombre_archivo ?? `#${selected.id}`}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Postulante</Label>
                  <p className="text-sm font-medium text-foreground">
                    {selected.postulante_nombre ?? "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estado</Label>
                  <div className="mt-1"><StatusBadge status={selected.estado} /></div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Semáforo</Label>
                  <div className="mt-1"><SemaphoreBadge status={selected.estado_semaforo} /></div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Confianza OCR</Label>
                  <p className="text-sm font-medium text-foreground">{selected.confianza_ocr}%</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tipo Validación</Label>
                  <p className="text-sm font-medium capitalize text-foreground">{selected.tipo_validacion}</p>
                </div>
                {selected.fecha_vencimiento && (
                  <div>
                    <Label className="text-muted-foreground">Fecha Vencimiento</Label>
                    <p className="text-sm font-medium text-foreground">{selected.fecha_vencimiento}</p>
                  </div>
                )}
              </div>
              {selected.observaciones && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <Label className="text-destructive">Observación previa</Label>
                  <p className="mt-1 text-sm text-foreground">{selected.observaciones}</p>
                </div>
              )}
              {selected.url_archivo && (
                <a
                  href={selected.url_archivo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-2"
                >
                  Ver archivo completo ↗
                </a>
              )}
              {(selected.estado === "pendiente" || selected.estado === "en_revision") && (
                <div className="space-y-3 border-t border-border pt-4">
                  <Label>Observación (requerida para rechazar)</Label>
                  <Textarea
                    placeholder="Escriba la observación..."
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="default"
                      onClick={() => handleAprobar(selected)}
                      disabled={actualizarMutation.isPending}
                    >
                      {actualizarMutation.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <CheckCircle className="mr-2 h-4 w-4" />
                      }
                      Aprobar
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      onClick={() => handleRechazar(selected)}
                      disabled={actualizarMutation.isPending}
                    >
                      {actualizarMutation.isPending
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <XCircle className="mr-2 h-4 w-4" />
                      }
                      Rechazar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="expedientes" className="mt-6 space-y-6">
          <p className="text-sm text-muted-foreground">
            Vista consolidada por postulante y convocatoria. El detalle y la validación de cada archivo están en la pestaña Documentos o en el detalle de la convocatoria.
          </p>
          {expLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando expedientes...</span>
            </div>
          ) : expError ? (
            <p className="py-16 text-center text-sm text-destructive">Error al cargar expedientes.</p>
          ) : expedientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16 text-center">
              <FolderCheck className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">No hay expedientes aún</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {expedientes.map((exp) => (
                <ExpedienteCard key={exp.id} expediente={exp} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
