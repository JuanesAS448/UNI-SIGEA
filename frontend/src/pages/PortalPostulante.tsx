import { useMemo, useRef } from "react";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { Upload, AlertTriangle, FileText, Briefcase, Loader2 } from "lucide-react";
import Postulantes from "@/pages/Postulantes";
import { useExpedientes } from "@/hooks/useExpedientes";
import { useDocumentos, useSubirDocumento } from "@/hooks/useDocumentos";
import type { Documento, DocumentoRequerido } from "@/types/api";
import { SemaphoreBadge } from "@/components/SemaphoreBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { EliminarDocumentoButton } from "@/components/EliminarDocumentoButton";
import { ExtraccionDocumento } from "@/components/ExtraccionDocumento";
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
            <ExtraccionDocumento documento={documento} mostrarOcr={false} soloPorcentaje />
            <p className="text-xs text-muted-foreground">
              {estadoDocLabel[documento.estado] ?? documento.estado}
              {documento.observaciones && documento.estado === "rechazado" && (
                <span className="mt-1 block text-destructive">{documento.observaciones}</span>
              )}
            </p>
            {puedeSubir && <EliminarDocumentoButton documento={documento} />}
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

  return <Postulantes />;
}
