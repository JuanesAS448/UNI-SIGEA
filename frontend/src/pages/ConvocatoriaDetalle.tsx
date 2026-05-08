import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, FileText, Users, Eye, Search, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SemaphoreBadge } from "@/components/SemaphoreBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useConvocatoria, useActualizarConvocatoria } from "@/hooks/useConvocatorias";
import { useCrearRequisito, useActualizarRequisito, useEliminarRequisito } from "@/hooks/useRequisitos";
import { useCrearPostulante, useActualizarPostulante, usePostulantes } from "@/hooks/usePostulantes";
import type { DocumentoRequerido } from "@/types/api";
import { useCrearExpediente } from "@/hooks/useExpedientes";
import { useDocumentos, useActualizarDocumento } from "@/hooks/useDocumentos";
import type { Documento } from "@/types/api";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ConvocatoriaDetalle() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const convocatoriaId = useMemo(() => Number(id), [id]);

  const { data, isLoading, isError } = useConvocatoria(convocatoriaId);
  const actualizarConv = useActualizarConvocatoria();

  // requirements modal state (used for both create and edit)
  const [reqDialogOpen, setReqDialogOpen] = useState(false);
  const [editingReq, setEditingReq] = useState<DocumentoRequerido | null>(null);
  const [newReqNombre, setNewReqNombre] = useState("");
  const [newReqDescripcion, setNewReqDescripcion] = useState("");
  const [newReqObligatorio, setNewReqObligatorio] = useState(true);

  const crearReq = useCrearRequisito();
  const actualizarReq = useActualizarRequisito();
  const eliminarReq = useEliminarRequisito();

  // postulante modal state
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [newPost, setNewPost] = useState({
    nombres: "",
    apellidos: "",
    numero_documento: "",
    email: "",
    telefono: "",
    direccion: "",
  });

  const crearPost = useCrearPostulante();
  const crearExp = useCrearExpediente();
  const actualizarPost = useActualizarPostulante();

  const { data: postulantesElegibles } = usePostulantes(
    convocatoriaId ? { excluir_convocatoria: convocatoriaId } : undefined
  );
  const [postSearch, setPostSearch] = useState("");
  const [selectedPostulanteId, setSelectedPostulanteId] = useState<number | null>(null);

  // documento modal para requisitos
  const [docsSearch, setDocsSearch] = useState("");
  const [selectedReq, setSelectedReq] = useState<DocumentoRequerido | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Documento | null>(null);
  const [docsObservacion, setDocsObservacion] = useState("");

  const { data: docsData, isLoading: docsLoading, isError: docsError } = useDocumentos(
    selectedReq
      ? ({ convocatoria: convocatoriaId, documento_requerido: selectedReq.id } as any)
      : undefined
  );

  const actualizarDocMutation = useActualizarDocumento();

  // documents list and filtering for modal
  const docsList: Documento[] = docsData?.results ?? [];
  const filteredDocs = docsList.filter((d) =>
    (d.nombre_archivo ?? "").toLowerCase().includes(docsSearch.toLowerCase()) ||
    (d.postulante_nombre ?? "").toLowerCase().includes(docsSearch.toLowerCase())
  );

  const resetReqForm = () => {
    setEditingReq(null);
    setNewReqNombre("");
    setNewReqDescripcion("");
    setNewReqObligatorio(true);
  };

  const handleAddReq = () => {
    if (!convocatoriaId) return;
    if (!newReqNombre.trim()) return;
    if (editingReq) {
      // update existing
      actualizarReq.mutate(
        {
          id: editingReq.id,
          convocatoria: editingReq.convocatoria,
          data: { nombre: newReqNombre.trim(), descripcion: newReqDescripcion.trim(), obligatorio: newReqObligatorio },
        },
        {
          onSuccess: () => {
            toast({ title: "Requisito actualizado" });
            setReqDialogOpen(false);
            resetReqForm();
          },
          onError: () => {
            toast({ title: "Error al actualizar requisito", variant: "destructive" });
          },
        }
      );
    } else {
      crearReq.mutate(
        {
          nombre: newReqNombre.trim(),
          descripcion: newReqDescripcion.trim(),
          obligatorio: newReqObligatorio,
          convocatoria: convocatoriaId,
        },
        {
          onSuccess: () => {
            toast({ title: "Requisito agregado" });
            setReqDialogOpen(false);
            resetReqForm();
          },
          onError: () => {
            toast({ title: "Error al crear requisito", variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDeleteReq = (req: DocumentoRequerido) => {
    if (!convocatoriaId) return;
    if (!window.confirm(`¿Seguro que desea eliminar el requisito "${req.nombre}"?`)) return;
    eliminarReq.mutate({ id: req.id, convocatoria: convocatoriaId }, {
      onSuccess: () => {
        toast({ title: "Requisito eliminado", variant: "destructive" });
      },
      onError: () => {
        toast({ title: "Error al eliminar requisito", variant: "destructive" });
      }
    });
  };

  const handleAddPost = () => {
    if (!convocatoriaId) return;
    crearPost.mutate(newPost, {
      onSuccess: (p) => {
        crearExp.mutate(
          { postulante: p.id, convocatoria: convocatoriaId },
          {
            onSuccess: () => {
              toast({ title: "Postulante registrado" });
              setPostDialogOpen(false);
              setNewPost({ nombres: "", apellidos: "", numero_documento: "", email: "", telefono: "", direccion: "" });
            },
          }
        );
      },
      onError: () => {
        toast({ title: "Error al registrar postulante", variant: "destructive" });
      },
    });
  };

  const handleAsignarExistente = () => {
    if (!convocatoriaId || !selectedPostulanteId) {
      toast({ title: "Seleccione un postulante", variant: "destructive" });
      return;
    }
    crearExp.mutate(
      { postulante: selectedPostulanteId, convocatoria: convocatoriaId },
      {
        onSuccess: () => {
          toast({ title: "Postulante asignado a la convocatoria" });
          setPostDialogOpen(false);
          setSelectedPostulanteId(null);
          setPostSearch("");
        },
        onError: () => {
          toast({ title: "No se pudo asignar (¿ya tiene expediente?)", variant: "destructive" });
        },
      }
    );
  };

  const listaElegibles = (postulantesElegibles?.results ?? []).filter((p) => {
    const q = postSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      `${p.nombres} ${p.apellidos}`.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.numero_documento.includes(q)
    );
  });

  const toggleEstado = (pId: number, current: string) => {
    const nuevo = current === "activo" ? "inactivo" : "activo";
    actualizarPost.mutate({ id: pId, data: { estado: nuevo } as any });
  };

  const cambiarConvEstado = () => {
    if (!data || !convocatoriaId) return;
    const nuevo = data.estado === "abierta" ? "cerrada" : "abierta";
    if (!window.confirm(`¿Desea ${nuevo === 'cerrada' ? 'cerrar' : 'abrir'} esta convocatoria?`)) return;
    actualizarConv.mutate(
      { id: convocatoriaId, data: { estado: nuevo } },
      {
        onSuccess: () => {
          toast({ title: `Convocatoria ${nuevo === 'cerrada' ? 'cerrada' : 'abierta'}` });
        },
      }
    );
  };

  const toggleArchivado = () => {
    if (!data || !convocatoriaId) return;
    const nuevo = !data.archivado;
    if (!window.confirm(`${nuevo ? 'Archivar' : 'Desarchivar'} esta convocatoria?`)) return;
    actualizarConv.mutate(
      { id: convocatoriaId, data: { archivado: nuevo } },
      {
        onSuccess: () => {
          toast({ title: `Convocatoria ${nuevo ? 'archivada' : 'desarchivada'}` });
        },
      }
    );
  };

  // acciones sobre documentos
  const handleDocAprobar = (doc: Documento) => {
    actualizarDocMutation.mutate(
      { id: doc.id, data: { estado: "aprobado" } },
      {
        onSuccess: () => {
          toast({ title: "Documento aprobado" });
          setSelectedDoc(null);
        },
      }
    );
  };

  const handleDocRechazar = (doc: Documento) => {
    if (!docsObservacion.trim()) {
      toast({ title: "Observación requerida", variant: "destructive" });
      return;
    }
    actualizarDocMutation.mutate(
      { id: doc.id, data: { estado: "rechazado", observaciones: docsObservacion } },
      {
        onSuccess: () => {
          toast({ title: "Documento rechazado" });
          setSelectedDoc(null);
          setDocsObservacion("");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/convocatorias")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Detalle de Convocatoria</h1>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">Cargando convocatoria...</CardContent>
        </Card>
      ) : isError || !data ? (
        <Card>
          <CardContent className="py-10 text-sm text-destructive">
            No se pudo cargar la convocatoria.
          </CardContent>
        </Card>
      ) : (
        <>
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl">{data.titulo}</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={data.estado === "abierta" ? "default" : "secondary"}>
                  {data.estado === "abierta" ? "Abierta" : "Cerrada"}
                </Badge>
                <Button size="sm" variant="outline" onClick={cambiarConvEstado}>
                  {data.estado === "abierta" ? "Cerrar" : "Abrir"}
                </Button>
                <Button size="sm" variant="ghost" onClick={toggleArchivado}>
                  {data.archivado ? "Desarchivar" : "Archivar"}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{data.descripcion}</p>
            {(data.estado !== "abierta" || data.archivado) && (
              <p className="text-sm text-destructive">
                Convocatoria {data.archivado ? "archivada" : "cerrada"}. Algunas acciones están deshabilitadas.
              </p>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {data.fecha_inicio} - {data.fecha_fin}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{data.postulantes_count} postulantes</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{data.documentos_requeridos.length} documentos requeridos</span>
            </div>
          </CardContent>
        </Card>

        {/* Requisitos Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Requisitos</h2>
            <Button size="sm" onClick={() => setReqDialogOpen(true)} disabled={data?.estado !== "abierta" || data?.archivado}>
              + Agregar Requisito
            </Button>
          </div>
          {data.documentos_requeridos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay requisitos definidos.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {data.documentos_requeridos.map((req) => (
                <Card key={req.id} className="rounded-xl shadow-sm">
                  <CardHeader className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-md">{req.nombre}</CardTitle>
                      <Badge variant={req.obligatorio ? "destructive" : "secondary"}>
                        {req.obligatorio ? "Obligatorio" : "Opcional"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {req.documentos_count !== undefined && (
                          <span>
                            {req.documentos_count} documento{req.documentos_count !== 1 ? 's' : ''}
                          </span>
                        )}
                        {req.subido_por && req.subido_por.length > 0 && (
                          <span>
                            Subido por: {req.subido_por.map((u) => `${u.nombres} ${u.apellidos}`).join(', ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setSelectedReq(req);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingReq(req);
                            setNewReqNombre(req.nombre);
                            setNewReqDescripcion(req.descripcion);
                            setNewReqObligatorio(req.obligatorio);
                            setReqDialogOpen(true);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 11l6-6 3.536 3.536L12.536 14.536M9 11v3h3" />
                          </svg>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => handleDeleteReq(req)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {req.descripcion}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Postulantes Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Postulantes</h2>
            <Button variant="outline" size="sm" className="text-green-600" onClick={() => setPostDialogOpen(true)} disabled={data?.estado !== "abierta" || data?.archivado}>
              + Agregar postulante
            </Button>
          </div>
          {data.postulantes && data.postulantes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombres y Apellidos</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Fecha Registro</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.postulantes.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.nombres} {p.apellidos}</TableCell>
                    <TableCell>{p.numero_documento}</TableCell>
                    <TableCell>{p.email}</TableCell>
                    <TableCell>{p.telefono}</TableCell>
                    <TableCell>{p.fecha_registro.split('T')[0]}</TableCell>
                    <TableCell>
                      <Badge
                        className="cursor-pointer"
                        variant={p.estado === "activo" ? "default" : "secondary"}
                        onClick={() => toggleEstado(p.id, p.estado)}
                      >
                        {p.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Aún no hay postulantes registrados para esta convocatoria.</p>
          )}
        </div>

        {/* Requisito modal */}
        <Dialog
          open={reqDialogOpen}
          onOpenChange={(o) => {
            if (!o) resetReqForm();
            setReqDialogOpen(o);
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingReq ? "Editar Requisito" : "Agregar Requisito"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre</Label>
                <Input value={newReqNombre} onChange={(e) => setNewReqNombre(e.target.value)} />
              </div>
              <div>
                <Label>Descripción</Label>
                <Textarea value={newReqDescripcion} onChange={(e) => setNewReqDescripcion(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newReqObligatorio}
                  onChange={(e) => setNewReqObligatorio(e.target.checked)}
                />
                <span>Obligatorio</span>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleAddReq}>{editingReq ? "Actualizar" : "Guardar"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Postulante modal */}
        <Dialog
          open={postDialogOpen}
          onOpenChange={(open) => {
            setPostDialogOpen(open);
            if (!open) {
              setSelectedPostulanteId(null);
              setPostSearch("");
            }
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar postulante a la convocatoria</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="existente" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existente">Usuario ya registrado</TabsTrigger>
                <TabsTrigger value="nuevo">Nueva ficha manual</TabsTrigger>
              </TabsList>
              <TabsContent value="existente" className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">
                  Solo aparecen usuarios con rol <strong>postulante</strong> que aún no tienen expediente en esta convocatoria
                  (incluye cuentas creadas desde el admin de Django).
                </p>
                <div>
                  <Label>Buscar</Label>
                  <Input
                    placeholder="Nombre, correo o documento..."
                    value={postSearch}
                    onChange={(e) => setPostSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {listaElegibles.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No hay coincidencias o todos ya están en esta convocatoria.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {listaElegibles.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent ${selectedPostulanteId === p.id ? "bg-accent" : ""}`}
                            onClick={() => setSelectedPostulanteId(p.id)}
                          >
                            <span className="font-medium text-foreground">
                              {p.nombres} {p.apellidos}
                            </span>
                            <span className="text-xs text-muted-foreground">{p.email} · {p.numero_documento}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAsignarExistente} disabled={!selectedPostulanteId}>
                    Asignar a convocatoria
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="nuevo" className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">
                  Cree una ficha sin cuenta de usuario (casos excepcionales). Si la persona ya tiene usuario en el sistema,
                  use la pestaña anterior.
                </p>
                <div>
                  <Label>Nombres</Label>
                  <Input
                    value={newPost.nombres}
                    onChange={(e) => setNewPost({ ...newPost, nombres: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Apellidos</Label>
                  <Input
                    value={newPost.apellidos}
                    onChange={(e) => setNewPost({ ...newPost, apellidos: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Documento</Label>
                  <Input
                    value={newPost.numero_documento}
                    onChange={(e) => setNewPost({ ...newPost, numero_documento: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Correo</Label>
                  <Input
                    type="email"
                    value={newPost.email}
                    onChange={(e) => setNewPost({ ...newPost, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input
                    value={newPost.telefono}
                    onChange={(e) => setNewPost({ ...newPost, telefono: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Dirección</Label>
                  <Input
                    value={newPost.direccion}
                    onChange={(e) => setNewPost({ ...newPost, direccion: e.target.value })}
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAddPost}>Guardar y asignar</Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Documentos por requisito modal */}
        <Dialog
          open={!!selectedReq}
          onOpenChange={(o) => {
            if (!o) {
              setSelectedReq(null);
              setDocsSearch("");
              setSelectedDoc(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Documentos para requisito: {selectedReq?.nombre}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {(data?.estado !== "abierta" || data?.archivado) && (
                <p className="text-sm text-destructive">
                  La convocatoria está {data?.archivado ? "archivada" : "cerrada"}; no se pueden subir nuevos documentos.
                </p>
              )}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o postulante..."
                    className="pl-10"
                    value={docsSearch}
                    onChange={(e) => setDocsSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* table*/}
              <div className="rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  {docsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Cargando documentos...</span>
                    </div>
                  ) : docsError ? (
                    <p className="py-12 text-center text-sm text-destructive">
                      Error al cargar documentos.
                    </p>
                  ) : filteredDocs.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      No hay documentos para este requisito.
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
                        {filteredDocs.map((doc) => (
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
                                  onClick={() => { setSelectedDoc(doc); setDocsObservacion(""); }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {(doc.estado === "pendiente" || doc.estado === "en_revision") && (
                                  <>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="text-success hover:text-success"
                                      onClick={() => handleDocAprobar(doc)}
                                      disabled={actualizarDocMutation.isPending}
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => { setSelectedDoc(doc); setDocsObservacion(""); }}
                                      disabled={actualizarDocMutation.isPending}
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

              {/* detail dialog for doc inside req modal */}
              <Dialog open={!!selectedDoc} onOpenChange={(o) => !o && setSelectedDoc(null)}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Detalle del Documento</DialogTitle>
                  </DialogHeader>
                  {selectedDoc && (
                    <div className="space-y-4 pt-2">
                      {/* copy same content as Documentos page detail */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground">Archivo</Label>
                          <p className="text-sm font-medium text-foreground">
                            {selectedDoc.nombre_archivo ?? `#${selectedDoc.id}`}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Postulante</Label>
                          <p className="text-sm font-medium text-foreground">
                            {selectedDoc.postulante_nombre ?? "—"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Estado</Label>
                          <div className="mt-1"><StatusBadge status={selectedDoc.estado} /></div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Semáforo</Label>
                          <div className="mt-1"><SemaphoreBadge status={selectedDoc.estado_semaforo} /></div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Confianza OCR</Label>
                          <p className="text-sm font-medium text-foreground">{selectedDoc.confianza_ocr}%</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Tipo Validación</Label>
                          <p className="text-sm font-medium capitalize text-foreground">{selectedDoc.tipo_validacion}</p>
                        </div>
                        {selectedDoc.fecha_vencimiento && (
                          <div>
                            <Label className="text-muted-foreground">Fecha Vencimiento</Label>
                            <p className="text-sm font-medium text-foreground">{selectedDoc.fecha_vencimiento}</p>
                          </div>
                        )}
                      </div>
                      {selectedDoc.observaciones && (
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                          <Label className="text-destructive">Observación previa</Label>
                          <p className="mt-1 text-sm text-foreground">{selectedDoc.observaciones}</p>
                        </div>
                      )}
                      {selectedDoc.url_archivo && (
                        <a
                          href={selectedDoc.url_archivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-2"
                        >
                          Ver archivo completo ↗
                        </a>
                      )}
                      {(selectedDoc.estado === "pendiente" || selectedDoc.estado === "en_revision") && (
                        <div className="space-y-3 border-t border-border pt-4">
                          <Label>Observación (requerida para rechazar)</Label>
                          <Textarea
                            placeholder="Escriba la observación..."
                            value={docsObservacion}
                            onChange={(e) => setDocsObservacion(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              variant="default"
                              onClick={() => handleDocAprobar(selectedDoc)}
                              disabled={actualizarDocMutation.isPending}
                            >
                              {actualizarDocMutation.isPending
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <CheckCircle className="mr-2 h-4 w-4" />
                              }
                              Aprobar
                            </Button>
                            <Button
                              className="flex-1"
                              variant="destructive"
                              onClick={() => handleDocRechazar(selectedDoc)}
                              disabled={actualizarDocMutation.isPending}
                            >
                              {actualizarDocMutation.isPending
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
          </DialogContent>
        </Dialog>
        </>
      )}
    </div>
  );
}
