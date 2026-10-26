import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SemaphoreBadge } from "@/components/SemaphoreBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ExtraccionDocumento } from "@/components/ExtraccionDocumento";
import { useDocumentos, useActualizarDocumento } from "@/hooks/useDocumentos";
import type { Documento } from "@/types/api";
import { toast } from "@/hooks/use-toast";

export default function SemaforoDocs() {
  const navigate = useNavigate();
  const { status } = useParams<{ status: string }>();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Documento | null>(null);
  const [observacion, setObservacion] = useState("");

  const filtros: any = {};
  if (status === "verde") filtros.estado_semaforo = "verde";
  if (status === "amarillo") filtros.estado_semaforo = "amarillo";
  if (status === "rojo") filtros.estado_semaforo = "rojo";

  const { data, isLoading, isError } = useDocumentos(filtros);
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

  const titleMap: Record<string, string> = {
    verde: "Vigentes",
    amarillo: "Con dudas",
    rojo: "Vencidos / Ilegibles",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Documentos - {titleMap[status ?? "verde"]}</h1>
          <p className="text-sm text-muted-foreground">Filtrados por semáforo {status}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <Eye className="h-5 w-5" />
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Input
            placeholder="Buscar por documento o postulante..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table (same as Documentos page) */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Cargando documentos...</span>
            </div>
          ) : isError ? (
            <p className="py-12 text-center text-sm text-destructive">
              Error al cargar documentos.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay documentos para este filtro.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3">Documento</th>
                  <th className="px-6 py-3">Postulante</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Semáforo</th>
                  <th className="px-6 py-3">Confianza</th>
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
                      <ExtraccionDocumento documento={doc} />
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del Documento</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              {/* reuse same detail content from Documentos page */}
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
                  <Label className="text-muted-foreground">Confianza</Label>
                  <ExtraccionDocumento documento={selected} />
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
    </div>
  );
}
