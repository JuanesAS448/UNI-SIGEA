import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Upload, AlertTriangle, FileText, Briefcase, Loader2, RefreshCw, Users } from "lucide-react";
import { usePostulantes } from "@/hooks/usePostulantes";
import { useExpedientes } from "@/hooks/useExpedientes";
import { useDocumentos, useSubirDocumento } from "@/hooks/useDocumentos";
import type { Documento, DocumentoRequerido } from "@/types/api";
import { SemaphoreBadge } from "@/components/SemaphoreBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { convocatoriasService } from "@/services/convocatoriasService";
import { ChatBotDocumental } from "@/components/ChatBotDocumental";

const estadoDocLabel: Record<string, string> = {
  pendiente: "Pendiente",
  procesando: "Procesando",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  error_procesamiento: "Error",
};

/** Catálogo global (admin / revisor): solo fichas con rol postulante en API */
function VistaCatalogoPostulantes() {
  const { data, isLoading, isError, refetch, isFetching } = usePostulantes();

  const postulantes = data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Postulantes registrados</h1>
          <p className="text-sm text-muted-foreground">
            Usuarios con rol postulante o fichas manuales — {data?.count ?? "—"} en total
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
          <p className="mt-1 text-xs text-muted-foreground">
            Los usuarios con rol postulante aparecen aquí; la revisión de documentos se hace en Convocatorias o Documentos.
          </p>
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
                        <p className="text-sm font-medium text-foreground">
                          {p.nombres} {p.apellidos}
                        </p>
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

function RequisitoFila({
  req,
  convocatoriaId,
  puedeSubir,
  documento,
  postulanteId,
}: {
  req: DocumentoRequerido;
  convocatoriaId: number;
  puedeSubir: boolean;
  documento: Documento | undefined;
  postulanteId: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const subir = useSubirDocumento();

  const onFile = (f: File | null) => {
    if (!f) return;
    subir.mutate(
      {
        archivo: f,
        postulante: postulanteId,
        convocatoria: convocatoriaId,
        documento_requerido: req.id,
      },
      {
        onSuccess: () => toast({ title: "Documento enviado", description: req.nombre }),
        onError: () =>
          toast({ title: "Error al subir", variant: "destructive" }),
      }
    );
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{req.nombre}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{req.descripcion}</p>
        {req.obligatorio && (
          <Badge variant="outline" className="mt-1 text-[10px]">
            Obligatorio
          </Badge>
        )}
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {documento ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={documento.estado} />
              <SemaphoreBadge status={documento.estado_semaforo} />
            </div>
            {documento.url_archivo && (
              <Button variant="outline" size="sm" asChild>
                <a href={documento.url_archivo} target="_blank" rel="noopener noreferrer" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Ver archivo
                </a>
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {estadoDocLabel[documento.estado] ?? documento.estado}
              {documento.observaciones && documento.estado === "rechazado" && (
                <span className="mt-1 block text-destructive">{documento.observaciones}</span>
              )}
            </p>
            {puedeSubir && documento.estado === "rechazado" && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  disabled={subir.isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  {subir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Subir nueva versión
                </Button>
              </>
            )}
          </>
        ) : puedeSubir ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button
              size="sm"
              variant="secondary"
              className="gap-2"
              disabled={subir.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {subir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Subir documento
            </Button>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No se admiten cargas en esta convocatoria.</p>
        )}
      </div>
    </div>
  );
}

function ultimoDocumentoPorRequisito(
  documentos: Documento[],
  reqId: number,
  convocatoriaId: number,
  postulantePk: number
): Documento | undefined {
  const lista = documentos.filter(
    (d) =>
      d.documento_requerido === reqId &&
      d.convocatoria === convocatoriaId &&
      d.postulante === postulantePk
  );
  if (lista.length === 0) return undefined;
  return [...lista].sort(
    (a, b) => new Date(b.fecha_carga).getTime() - new Date(a.fecha_carga).getTime()
  )[0];
}

/** Portal del postulante: convocatorias inscritas, requisitos y documentos */
function VistaPostulanteReal() {
  const { session } = useAuth();
  const postulanteId = session?.postulante_id;

  const { data: expData, isLoading: loadingExp } = useExpedientes(
    postulanteId ? { postulante: postulanteId } : undefined
  );
  const { data: docsData, isLoading: loadingDocs } = useDocumentos(
    postulanteId ? { postulante: postulanteId } : undefined
  );

  const expedientes = expData?.results ?? [];
  const documentos = docsData?.results ?? [];

  const convocatoriaIds = useMemo(
    () => [...new Set(expedientes.map((e) => e.convocatoria))],
    [expedientes]
  );

  const convocatoriasQueries = useQueries({
    queries: convocatoriaIds.map((id) => ({
      queryKey: ["convocatorias", id, "detalles"],
      queryFn: () => convocatoriasService.getDetails(id),
      enabled: !!postulanteId && convocatoriaIds.length > 0,
    })),
  });

  const loadingConv = convocatoriasQueries.some((q) => q.isLoading);

  const aprobados = documentos.filter((d) => d.estado === "aprobado").length;
  const total = documentos.length;
  const progreso = total > 0 ? Math.round((aprobados / total) * 100) : 0;

  if (!postulanteId) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Ficha de postulante no disponible</AlertTitle>
        <AlertDescription>
          Su usuario no tiene una ficha de postulante vinculada. Si acaba de obtener el rol en el administrador,
          vuelva a iniciar sesión. Si el problema continúa, contacte al administrador.
        </AlertDescription>
      </Alert>
    );
  }

  if (loadingExp || loadingDocs || loadingConv) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando su expediente...</span>
      </div>
    );
  }

  const nombreMostrado =
    session?.first_name || session?.last_name
      ? [session.first_name, session.last_name].filter(Boolean).join(" ")
      : session?.email ?? "Postulante";

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Mi postulación</h1>
        <p className="text-muted-foreground">
          Convocatorias en las que está inscrito, requisitos y estado de cada documento. La revisión la realiza el personal
          autorizado desde convocatorias o documentación.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Datos de la cuenta</CardTitle>
          <CardDescription>Ficha vinculada al usuario autenticado</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nombre</p>
            <p className="font-medium text-foreground">{nombreMostrado}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Correo</p>
            <p className="font-medium text-foreground">{session?.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ID postulante</p>
            <p className="font-mono text-foreground">{postulanteId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Convocatorias activas en expediente</p>
            <p className="font-medium text-foreground">{expedientes.length}</p>
          </div>
        </CardContent>
      </Card>

      {expedientes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no está inscrito en ninguna convocatoria. Cuando un administrador le asigne una convocatoria, podrá
            cargar los requisitos aquí.
          </CardContent>
        </Card>
      ) : (
        <>
          {total > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Progreso de documentación</CardTitle>
                <CardDescription>
                  {aprobados} de {total} documentos aprobados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progreso} className="h-3" />
              </CardContent>
            </Card>
          )}

          {convocatoriasQueries.map((q) => {
            const c = q.data;
            if (!c) return null;
            const puedeSubir = c.estado === "abierta" && !c.archivado;

            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{c.titulo}</CardTitle>
                        <CardDescription>
                          {c.fecha_inicio} — {c.fecha_fin}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={puedeSubir ? "default" : "secondary"}>
                      {c.archivado ? "Archivada" : c.estado === "abierta" ? "Abierta" : "Cerrada"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(!c.documentos_requeridos || c.documentos_requeridos.length === 0) && (
                    <p className="text-sm text-muted-foreground">Esta convocatoria aún no define requisitos.</p>
                  )}
                  {c.documentos_requeridos?.map((req) => {
                    const documento = ultimoDocumentoPorRequisito(
                      documentos,
                      req.id,
                      c.id,
                      postulanteId
                    );
                    return (
                      <RequisitoFila
                        key={req.id}
                        req={req}
                        convocatoriaId={c.id}
                        puedeSubir={puedeSubir}
                        documento={documento}
                        postulanteId={postulanteId}
                      />
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function PortalPostulante() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando...</span>
      </div>
    );
  }

  if (session?.rol === "postulante") {
    return (
      <>
        <VistaPostulanteReal />
        <ChatBotDocumental />
      </>
    );
  }

  return <VistaCatalogoPostulantes />;
}
