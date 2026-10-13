import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, HelpCircle, FileText, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

import { useCrearConvocatoria } from "@/hooks/useConvocatorias";

interface ReviewPoint {
  id: string;
  label: string;
  predefined: boolean;
}

interface RequiredDoc {
  id: string;
  name: string;
  description: string;
  mandatory: boolean;
  reviewPoints: ReviewPoint[];
}

const PREDEFINED_REVIEW_POINTS: ReviewPoint[] = [
  { id: "rp1", label: "Firma presente y legible", predefined: true },
  { id: "rp2", label: "Fecha vigente (< 3 meses)", predefined: true },
  { id: "rp3", label: "Sello institucional visible", predefined: true },
  { id: "rp4", label: "Nombre coincide con cédula", predefined: true },
  { id: "rp5", label: "Documento completo (todas las páginas)", predefined: true },
  { id: "rp6", label: "Resolución legible (> 200 DPI)", predefined: true },
];

export default function NuevaConvocatoria() {
  const navigate = useNavigate();
  const crearConvocatoria = useCrearConvocatoria();
  const [activeTab, setActiveTab] = useState("detalles");

  // Datos de contratación
  const [titulo, setTitulo] = useState("");
  const [cargo, setCargo] = useState("");
  const [dependencia, setDependencia] = useState("");
  const [tipoVinculacion, setTipoVinculacion] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [dedicacion, setDedicacion] = useState("");

  // Documentación
  const [documents, setDocuments] = useState<RequiredDoc[]>([]);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocDescription, setNewDocDescription] = useState("");
  const [newDocMandatory, setNewDocMandatory] = useState(true);
  const [selectedReviewPoints, setSelectedReviewPoints] = useState<string[]>([]);
  const [customReviewPoint, setCustomReviewPoint] = useState("");
  const [customPoints, setCustomPoints] = useState<ReviewPoint[]>([]);

  const addCustomPoint = () => {
    if (!customReviewPoint.trim()) return;
    const newPoint: ReviewPoint = {
      id: `custom-${Date.now()}`,
      label: customReviewPoint.trim(),
      predefined: false,
    };
    setCustomPoints((prev) => [...prev, newPoint]);
    setSelectedReviewPoints((prev) => [...prev, newPoint.id]);
    setCustomReviewPoint("");
  };

  const toggleReviewPoint = (id: string) => {
    setSelectedReviewPoints((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const addDocument = () => {
    if (!newDocName.trim()) return;
    const allPoints = [...PREDEFINED_REVIEW_POINTS, ...customPoints];
    const reviewPoints = allPoints.filter((p) => selectedReviewPoints.includes(p.id));

    const doc: RequiredDoc = {
      id: `doc-${Date.now()}`,
      name: newDocName.trim(),
      description: newDocDescription.trim(),
      mandatory: newDocMandatory,
      reviewPoints,
    };

    setDocuments((prev) => [...prev, doc]);
    resetDocForm();
    setDocDialogOpen(false);
    toast({ title: "Documento agregado", description: `"${doc.name}" con ${reviewPoints.length} puntos de revisión` });
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const resetDocForm = () => {
    setNewDocName("");
    setNewDocDescription("");
    setNewDocMandatory(true);
    setSelectedReviewPoints([]);
    setCustomPoints([]);
    setCustomReviewPoint("");
  };

  const handleSubmit = () => {
    if (!titulo.trim() || !cargo.trim() || !dependencia.trim() || !fechaInicio || !fechaFin || documents.length === 0) {
      toast({
        title: "Formulario incompleto",
        description: "Por favor complete todos los campos y agregue al menos un documento requerido.",
        variant: "destructive",
      });
      return;
    }

    crearConvocatoria.mutate(
      {
        titulo: titulo.trim(),
        descripcion: `Cargo: ${cargo}, Área: ${dependencia}, Vinculación: ${tipoVinculacion}, Dedicación: ${dedicacion || "No especificada"}`,
        estado: "abierta",
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      },
      {
        onSuccess: (nueva) => {
          toast({
            title: "Convocatoria creada exitosamente",
            description: `"${titulo}" ha sido registrada y está lista para recibir postulantes.`,
          });
          navigate(`/convocatorias/${nueva.id}`);
        },
        onError: () => {
          toast({
            title: "Error al crear convocatoria",
            description: "Hubo un problema al conectar con el servidor. Inténtelo de nuevo.",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/convocatorias")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nueva Convocatoria</h1>
          <p className="text-sm text-muted-foreground">Complete la información del postulante y la documentación requerida</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="detalles">Detalles de la Convocatoria</TabsTrigger>
          <TabsTrigger value="documentacion">Documentación</TabsTrigger>
        </TabsList>

        {/* === TAB 1: DETALLES === */}
        <TabsContent value="detalles">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información de Contratación</CardTitle>
              <CardDescription>Detalles del tipo de vinculación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label>Titulo de la Convocatoria</Label>
                  <Input
                    placeholder="Ej: Convocatoria Docentes Catedra 2026-I"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cargo</Label>
                  <Input placeholder="Ej: Docente Cátedra" value={cargo} onChange={(e) => setCargo(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Dependencia</Label>
                  <Input placeholder="Ej: Facultad de Ingeniería" value={dependencia} onChange={(e) => setDependencia(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de Vinculación</Label>
                  <Input placeholder="Ej: Cátedra, Tiempo Completo, Medio Tiempo" value={tipoVinculacion} onChange={(e) => setTipoVinculacion(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Dedicación</Label>
                  <Input placeholder="Ej: 20 horas semanales" value={dedicacion} onChange={(e) => setDedicacion(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fecha de Inicio</Label>
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de Fin</Label>
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => navigate("/convocatorias")}>← Anterior</Button>
                <Button onClick={() => setActiveTab("documentacion")}>Siguiente →</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === DOCUMENTACIÓN === */}
        <TabsContent value="documentacion">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Documentación Requerida</CardTitle>
                  <CardDescription>Defina los documentos que debe presentar el postulante y sus puntos de revisión</CardDescription>
                </div>
                <Dialog open={docDialogOpen} onOpenChange={(open) => { setDocDialogOpen(open); if (!open) resetDocForm(); }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" />Agregar Documento</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Agregar Documento Requerido</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label>Nombre del Documento</Label>
                        <Input placeholder="Ej: Diploma de Pregrado" value={newDocName} onChange={(e) => setNewDocName(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Descripción</Label>
                        <Textarea placeholder="Instrucciones o detalles sobre el documento..." value={newDocDescription} onChange={(e) => setNewDocDescription(e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id="mandatory" checked={newDocMandatory} onCheckedChange={(v) => setNewDocMandatory(v === true)} />
                        <Label htmlFor="mandatory" className="cursor-pointer">Documento obligatorio</Label>
                      </div>

                      <Separator />

                      {/* Puntos de revisión */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold">Puntos de Revisión</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[280px]">
                              <p>Seleccione los aspectos que el revisor debe verificar al evaluar este documento. También puede agregar puntos personalizados.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Predefinidos */}
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Predefinidos</span>
                          <div className="grid gap-2">
                            {PREDEFINED_REVIEW_POINTS.map((rp) => (
                              <label key={rp.id} className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-accent/50 transition-colors">
                                <Checkbox checked={selectedReviewPoints.includes(rp.id)} onCheckedChange={() => toggleReviewPoint(rp.id)} />
                                <span className="text-sm">{rp.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Personalizados */}
                        {customPoints.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Personalizados</span>
                            <div className="grid gap-2">
                              {customPoints.map((cp) => (
                                <label key={cp.id} className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-accent/50 transition-colors">
                                  <Checkbox checked={selectedReviewPoints.includes(cp.id)} onCheckedChange={() => toggleReviewPoint(cp.id)} />
                                  <span className="text-sm">{cp.label}</span>
                                  <Badge variant="secondary" className="ml-auto text-xs">Personalizado</Badge>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Agregar personalizado */}
                        <div className="flex gap-2">
                          <Input
                            placeholder="Agregar punto de revisión personalizado..."
                            value={customReviewPoint}
                            onChange={(e) => setCustomReviewPoint(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomPoint())}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={addCustomPoint}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <Button className="w-full" onClick={addDocument} disabled={!newDocName.trim()}>
                        Agregar Documento
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 text-center">
                  <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">No hay documentos definidos</p>
                  <p className="mt-1 text-xs text-muted-foreground">Agregue los documentos que el postulante debe presentar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-card-foreground">{doc.name}</h4>
                            {doc.mandatory ? (
                              <Badge variant="default" className="text-xs">Obligatorio</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Opcional</Badge>
                            )}
                          </div>
                          {doc.description && <p className="mt-1 text-sm text-muted-foreground">{doc.description}</p>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeDocument(doc.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {doc.reviewPoints.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" /> Puntos de revisión ({doc.reviewPoints.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {doc.reviewPoints.map((rp) => (
                              <Badge key={rp.id} variant={rp.predefined ? "outline" : "secondary"} className="text-xs">
                                {rp.label}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => setActiveTab("detalles")}>← Anterior</Button>
                <Button onClick={handleSubmit} disabled={documents.length === 0 || crearConvocatoria.isPending}>
                  {crearConvocatoria.isPending ? "Creando..." : "Crear Convocatoria"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
